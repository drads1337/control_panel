"""
Slow Query Monitor
Tracks and logs slow database queries for performance analysis and optimization.

This module provides:
- Automatic tracking of all SQL queries
- Detection of slow queries (configurable threshold)
- Query statistics and analytics
- Integration with monitoring system
- Query pattern analysis for optimization opportunities
"""

import hashlib
import json
import time
from collections import defaultdict, deque
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple

from flask import current_app, has_request_context, request
from sqlalchemy import event, text
from sqlalchemy.engine import Engine

from ..core.extensions import db
from ..utils.redis_client import redis_client
from ..utils.structured_logging import get_logger

logger = get_logger(__name__)

class SlowQueryMonitor:
    """Monitor and track slow database queries"""

    def __init__(self, slow_query_threshold_ms: float = 1000.0, max_queries_in_memory: int = 1000):
        """
        Initialize slow query monitor

        Args:
            slow_query_threshold_ms: Threshold in milliseconds for considering a query slow
            max_queries_in_memory: Maximum number of queries to keep in memory
        """
        self.slow_query_threshold_ms = slow_query_threshold_ms
        self.max_queries_in_memory = max_queries_in_memory

        self.slow_queries: deque = deque(maxlen=max_queries_in_memory)

        self.stats = {
            "total_queries": 0,
            "slow_queries": 0,
            "total_query_time_ms": 0.0,
            "avg_query_time_ms": 0.0,
            "max_query_time_ms": 0.0,
            "queries_by_type": defaultdict(int),
            "queries_by_table": defaultdict(int),
            "queries_by_endpoint": defaultdict(int),
        }

        self.query_patterns: Dict[str, Dict[str, Any]] = {}

        self.redis_prefix = "slow_query_monitor"
        self.stats_key = f"{self.redis_prefix}:stats"
        self.slow_queries_key = f"{self.redis_prefix}:slow_queries"
        self.patterns_key = f"{self.redis_prefix}:patterns"

        self._setup_event_listeners()

    def _setup_event_listeners(self):
        """Setup SQLAlchemy event listeners for query tracking"""

        @event.listens_for(Engine, "before_cursor_execute")
        def before_cursor_execute(conn, cursor, statement, parameters, context, executemany):
            """Called before a SQL statement is executed"""

            context._query_start_time = time.time()
            context._query_statement = statement
            context._query_parameters = parameters

        @event.listens_for(Engine, "after_cursor_execute")
        def after_cursor_execute(conn, cursor, statement, parameters, context, executemany):
            """Called after a SQL statement is executed"""
            if not hasattr(context, "_query_start_time"):
                return

            duration_ms = (time.time() - context._query_start_time) * 1000

            self._track_query(
                statement=statement, parameters=parameters, duration_ms=duration_ms, context=context
            )

    def _track_query(self, statement: str, parameters: Any, duration_ms: float, context: Any):
        """Track a single query"""
        try:

            self.stats["total_queries"] += 1
            self.stats["total_query_time_ms"] += duration_ms
            self.stats["avg_query_time_ms"] = (
                self.stats["total_query_time_ms"] / self.stats["total_queries"]
            )

            if duration_ms > self.stats["max_query_time_ms"]:
                self.stats["max_query_time_ms"] = duration_ms

            query_type = self._detect_query_type(statement)
            self.stats["queries_by_type"][query_type] += 1

            tables = self._extract_tables(statement)
            for table in tables:
                self.stats["queries_by_table"][table] += 1

            if has_request_context() and request:
                endpoint = request.endpoint or request.path
                self.stats["queries_by_endpoint"][endpoint] += 1

            if duration_ms >= self.slow_query_threshold_ms:
                self._track_slow_query(statement, parameters, duration_ms, query_type, tables)

            self._track_query_pattern(statement, duration_ms, query_type, tables)

        except Exception as e:
            logger.error(f"Error tracking query: {e}", error=str(e))

    def _detect_query_type(self, statement: str) -> str:
        """Detect the type of SQL query"""
        statement_upper = statement.strip().upper()
        if statement_upper.startswith("SELECT"):
            return "SELECT"
        elif statement_upper.startswith("INSERT"):
            return "INSERT"
        elif statement_upper.startswith("UPDATE"):
            return "UPDATE"
        elif statement_upper.startswith("DELETE"):
            return "DELETE"
        elif statement_upper.startswith("CREATE"):
            return "CREATE"
        elif statement_upper.startswith("ALTER"):
            return "ALTER"
        elif statement_upper.startswith("DROP"):
            return "DROP"
        else:
            return "OTHER"

    def _extract_tables(self, statement: str) -> List[str]:
        """Extract table names from SQL statement (simple heuristic)"""
        tables = []
        statement_upper = statement.upper()

        keywords = ["FROM", "JOIN", "INTO", "UPDATE", "TABLE"]

        for keyword in keywords:
            if keyword in statement_upper:

                parts = statement_upper.split(keyword)
                if len(parts) > 1:

                    after_keyword = parts[1].strip()

                    for char in ["(", ")", ",", ";", "WHERE", "SET", "ON", "AS"]:
                        after_keyword = after_keyword.replace(char, " ")

                    words = after_keyword.split()
                    if words:
                        table_name = words[0].strip()
                        if table_name and len(table_name) > 1:
                            tables.append(table_name.lower())

        return list(set(tables))

    def _track_slow_query(
        self,
        statement: str,
        parameters: Any,
        duration_ms: float,
        query_type: str,
        tables: List[str],
    ):
        """Track a slow query"""
        try:
            self.stats["slow_queries"] += 1

            query_fingerprint = self._create_query_fingerprint(statement)

            endpoint = None
            user_id = None
            project_id = None
            request_id = None

            if has_request_context():
                try:
                    from flask import request as flask_request

                    endpoint = flask_request.endpoint or flask_request.path

                    try:
                        from flask_jwt_extended import get_jwt_identity

                        user_id = get_jwt_identity()
                    except:
                        pass

                    try:
                        project_id = flask_request.args.get(
                            "project_id"
                        ) or flask_request.headers.get("X-Project-ID")
                        if project_id:
                            project_id = int(project_id)
                    except:
                        pass

                    try:
                        from ..utils.structured_logging import request_id_var

                        request_id = request_id_var.get()
                    except:
                        pass
                except:
                    pass

            slow_query = {
                "timestamp": datetime.utcnow().isoformat(),
                "duration_ms": round(duration_ms, 2),
                "query_type": query_type,
                "tables": tables,
                "statement": statement[:500],
                "query_fingerprint": query_fingerprint,
                "endpoint": endpoint,
                "user_id": user_id,
                "project_id": project_id,
                "request_id": request_id,
                "parameters": str(parameters)[:200] if parameters else None,
            }

            self.slow_queries.append(slow_query)

            logger.warning(
                f"Slow query detected: {duration_ms:.2f}ms",
                query_type=query_type,
                duration_ms=round(duration_ms, 2),
                tables=tables,
                endpoint=endpoint,
                query_fingerprint=query_fingerprint,
                threshold_ms=self.slow_query_threshold_ms,
            )

            try:
                if redis_client and redis_client.client:

                    redis_key = f"{self.slow_queries_key}:{int(time.time())}"
                    redis_client.set_json(redis_key, slow_query, ex=86400)
            except Exception as e:
                logger.debug(f"Could not store slow query in Redis: {e}")

        except Exception as e:
            logger.error(f"Error tracking slow query: {e}", error=str(e))

    def _create_query_fingerprint(self, statement: str) -> str:
        """Create a normalized fingerprint of the query for pattern matching"""

        normalized = " ".join(statement.split())

        import re

        normalized = re.sub(r"%s|\?|:\w+", "?", normalized)

        normalized = re.sub(r"\b\d+\b", "?", normalized)

        normalized = re.sub(r"'[^']*'", "?", normalized)
        normalized = re.sub(r'"[^"]*"', "?", normalized)

        return hashlib.md5(normalized.encode()).hexdigest()[:16]

    def _track_query_pattern(
        self, statement: str, duration_ms: float, query_type: str, tables: List[str]
    ):
        """Track query patterns for analysis"""
        try:
            query_fingerprint = self._create_query_fingerprint(statement)

            if query_fingerprint not in self.query_patterns:
                self.query_patterns[query_fingerprint] = {
                    "fingerprint": query_fingerprint,
                    "sample_query": statement[:200],
                    "query_type": query_type,
                    "tables": list(set(tables)),
                    "count": 0,
                    "total_duration_ms": 0.0,
                    "avg_duration_ms": 0.0,
                    "max_duration_ms": 0.0,
                    "min_duration_ms": float("inf"),
                    "first_seen": datetime.utcnow().isoformat(),
                    "last_seen": datetime.utcnow().isoformat(),
                }

            pattern = self.query_patterns[query_fingerprint]
            pattern["count"] += 1
            pattern["total_duration_ms"] += duration_ms
            pattern["avg_duration_ms"] = pattern["total_duration_ms"] / pattern["count"]

            if duration_ms > pattern["max_duration_ms"]:
                pattern["max_duration_ms"] = duration_ms

            if duration_ms < pattern["min_duration_ms"]:
                pattern["min_duration_ms"] = duration_ms

            pattern["last_seen"] = datetime.utcnow().isoformat()

        except Exception as e:
            logger.debug(f"Error tracking query pattern: {e}")

    def get_slow_queries(
        self, limit: int = 50, min_duration_ms: Optional[float] = None
    ) -> List[Dict[str, Any]]:
        """Get recent slow queries"""
        queries = list(self.slow_queries)

        if min_duration_ms:
            queries = [q for q in queries if q["duration_ms"] >= min_duration_ms]

        queries.sort(key=lambda x: x["duration_ms"], reverse=True)

        return queries[:limit]

    def get_statistics(self) -> Dict[str, Any]:
        """Get query statistics"""
        return {
            "stats": dict(self.stats),
            "slow_query_threshold_ms": self.slow_query_threshold_ms,
            "total_slow_queries": len(self.slow_queries),
            "timestamp": datetime.utcnow().isoformat(),
        }

    def get_query_patterns(self, limit: int = 20, min_count: int = 5) -> List[Dict[str, Any]]:
        """Get query patterns sorted by frequency or average duration"""
        patterns = list(self.query_patterns.values())

        patterns = [p for p in patterns if p["count"] >= min_count]

        patterns.sort(key=lambda x: x["avg_duration_ms"], reverse=True)

        return patterns[:limit]

    def get_top_slow_patterns(self, limit: int = 10) -> List[Dict[str, Any]]:
        """Get top slowest query patterns"""
        patterns = self.get_query_patterns(limit=limit * 2, min_count=3)

        patterns.sort(key=lambda x: x["max_duration_ms"], reverse=True)

        return patterns[:limit]

    def get_table_statistics(self) -> Dict[str, Dict[str, Any]]:
        """Get statistics per table"""
        table_stats = {}

        for table, count in self.stats["queries_by_table"].items():

            table_slow_queries = [q for q in self.slow_queries if table in q.get("tables", [])]

            if table_slow_queries:
                avg_duration = sum(q["duration_ms"] for q in table_slow_queries) / len(
                    table_slow_queries
                )
                max_duration = max(q["duration_ms"] for q in table_slow_queries)
            else:
                avg_duration = 0
                max_duration = 0

            table_stats[table] = {
                "total_queries": count,
                "slow_queries": len(table_slow_queries),
                "avg_duration_ms": round(avg_duration, 2),
                "max_duration_ms": round(max_duration, 2),
            }

        return table_stats

    def reset_statistics(self):
        """Reset all statistics"""
        self.stats = {
            "total_queries": 0,
            "slow_queries": 0,
            "total_query_time_ms": 0.0,
            "avg_query_time_ms": 0.0,
            "max_query_time_ms": 0.0,
            "queries_by_type": defaultdict(int),
            "queries_by_table": defaultdict(int),
            "queries_by_endpoint": defaultdict(int),
        }
        self.slow_queries.clear()
        self.query_patterns.clear()
        logger.info("Slow query monitor statistics reset")

    def configure(self, slow_query_threshold_ms: Optional[float] = None):
        """Configure monitor settings"""
        if slow_query_threshold_ms is not None:
            self.slow_query_threshold_ms = slow_query_threshold_ms
            logger.info(f"Slow query threshold updated to {slow_query_threshold_ms}ms")

slow_query_monitor = SlowQueryMonitor(
    slow_query_threshold_ms=1000.0, max_queries_in_memory=1000
)

def get_slow_query_monitor() -> SlowQueryMonitor:
    """Get global slow query monitor instance"""
    return slow_query_monitor

def setup_slow_query_monitoring(app):
    """Setup slow query monitoring for Flask app"""

    threshold = app.config.get("SLOW_QUERY_THRESHOLD_MS", 1000.0)
    slow_query_monitor.configure(slow_query_threshold_ms=threshold)

    logger.info(
        "Slow query monitoring initialized",
        threshold_ms=threshold,
        max_queries=slow_query_monitor.max_queries_in_memory,
    )
