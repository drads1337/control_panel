"""
Full-text search utilities using PostgreSQL tsvector

This module provides efficient full-text search capabilities using PostgreSQL's
tsvector and tsquery features, replacing inefficient ILIKE queries with wildcards.
"""

from sqlalchemy import text
from sqlalchemy.orm import Query

def to_tsquery(search_term: str) -> str:
    """
    Convert a search term to PostgreSQL tsquery format.

    Args:
        search_term: The search term to convert

    Returns:
        A tsquery string suitable for PostgreSQL full-text search
    """
    if not search_term:
        return ""

    escaped = search_term.replace("'", "''").replace("\\", "\\\\")

    words = escaped.split()
    if not words:
        return ""

    return " & ".join(f"{word}:*" for word in words if word)

def fulltext_search_filter(query: Query, search_term: str, tsvector_column_name: str = "search_vector"):
    """
    Apply full-text search filter to a query using tsvector column.

    SECURITY: This function uses parameterized queries to prevent SQL injection.
    - search_term is sanitized and passed as a parameter
    - tsvector_column_name should be a trusted constant (not user input)
    - Column name is validated to contain only alphanumeric characters and underscores

    Args:
        query: SQLAlchemy query object
        search_term: The search term to filter by (user input - will be sanitized)
        tsvector_column_name: Name of the tsvector column (default: 'search_vector')
                             WARNING: Should be a trusted constant, not user input

    Returns:
        Filtered query
    """
    if not search_term or not search_term.strip():
        return query

    import re
    if not re.match(r'^[a-zA-Z_][a-zA-Z0-9_]*$', tsvector_column_name):
        raise ValueError(f"Invalid column name: {tsvector_column_name}. Only alphanumeric characters and underscores are allowed.")

    tsquery = to_tsquery(search_term)
    if not tsquery:
        return query

    return query.filter(text(f"{tsvector_column_name} @@ to_tsquery('simple', :tsquery)")).params(tsquery=tsquery)
