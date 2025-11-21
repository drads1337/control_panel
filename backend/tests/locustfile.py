"""
Load testing with Locust for critical endpoints

This file contains load tests for the most critical endpoints:
- /api/connect - Main authentication endpoint
- /api/heartbeat - Heartbeat endpoint for session maintenance

Usage:
    # Run with web UI (default port 8089)
    locust -f locustfile.py --host=http://localhost:5000

    # Run headless (no web UI)
    locust -f locustfile.py --host=http://localhost:5000 --headless -u 100 -r 10 -t 5m

    # Run with custom configuration
    locust -f locustfile.py --host=http://localhost:5000 --users=200 --spawn-rate=20 --run-time=10m

Environment variables:
    - MTLS_ENABLED=false (required for load testing, as mTLS is disabled in test mode)
    - DATABASE_URL (for test data setup)
    - REDIS_HOST, REDIS_PORT, REDIS_DB (for Redis connection)
"""

import base64
import json
import os
import random
import time
from typing import Dict, Optional

from locust import HttpUser, TaskSet, task, between

# Disable mTLS for load testing
os.environ["MTLS_ENABLED"] = "false"


class TestDataManager:
    """Manages test data for load testing"""

    def __init__(self, host: str):
        self.host = host
        self.test_keys: list = []
        self.test_projects: list = []
        self.test_sessions: list = []
        self._setup_test_data()

    def _setup_test_data(self):
        """Setup test data by creating test keys and projects"""
        # This would typically connect to the test database
        # For now, we'll use mock data that matches the expected format
        # In a real scenario, you'd want to create actual test keys in the database
        pass

    def get_random_key(self) -> Optional[str]:
        """Get a random test key"""
        if self.test_keys:
            return random.choice(self.test_keys)
        # Return a mock key format (32 hex characters)
        return "".join(random.choices("0123456789ABCDEF", k=32))

    def get_random_project_id(self) -> Optional[int]:
        """Get a random test project ID"""
        if self.test_projects:
            return random.choice(self.test_projects)
        return 1  # Default test project ID

    def create_connect_blob(self, user_key: str, project_id: Optional[int] = None) -> str:
        """
        Create encrypted blob for connect endpoint
        
        For load testing, we'll use base64 encoding (simpler than full encryption)
        The endpoint accepts both base64 and encrypted data
        """
        connect_data = {
            "user_key": user_key,
            "challenge_response": "test_challenge_response",
            "canary": "test_canary",
            "fingerprint": f"test_fingerprint_{random.randint(1000, 9999)}",
            "product": "test_product",
            "serial": f"test_serial_{random.randint(1000, 9999)}",
        }
        
        # Encode as base64 (endpoint accepts base64 encoded JSON)
        json_str = json.dumps(connect_data)
        blob = base64.b64encode(json_str.encode("utf-8")).decode("utf-8")
        return blob

    def create_heartbeat_blob(self, session_id: str) -> str:
        """
        Create encrypted blob for heartbeat endpoint
        
        For load testing, we'll use base64 encoding
        """
        heartbeat_data = {
            "session_id": session_id,
            "heartbeat_data": {
                "timestamp": int(time.time()),
                "client_id": f"test_client_{random.randint(1000, 9999)}",
            },
        }
        
        # Encode as base64 (endpoint accepts base64 encoded JSON)
        json_str = json.dumps(heartbeat_data)
        blob = base64.b64encode(json_str.encode("utf-8")).decode("utf-8")
        return blob

    def get_random_session_id(self) -> str:
        """Get a random session ID (for heartbeat testing)"""
        if self.test_sessions:
            return random.choice(self.test_sessions)
        # Generate a mock session ID (32 hex characters)
        return "".join(random.choices("0123456789abcdef", k=32))


# Global test data manager
test_data_manager: Optional[TestDataManager] = None


class ConnectTaskSet(TaskSet):
    """Task set for /api/connect endpoint load testing"""

    def on_start(self):
        """Called when a user starts"""
        global test_data_manager
        if test_data_manager is None:
            test_data_manager = TestDataManager(self.client.base_url)
        
        # Prepare test data for this user
        self.user_key = test_data_manager.get_random_key()
        self.project_id = test_data_manager.get_random_project_id()
        self.connect_blob = test_data_manager.create_connect_blob(self.user_key, self.project_id)

    @task(10)
    def test_connect(self):
        """
        Test the /api/connect endpoint
        
        This is the main authentication endpoint and is expected to handle high load.
        """
        payload = {
            "blob": self.connect_blob,
        }
        
        if self.project_id:
            payload["project_id"] = self.project_id

        with self.client.post(
            "/api/connect",
            json=payload,
            headers={"Content-Type": "product/json"},
            catch_response=True,
            name="connect",
        ) as response:
            if response.status_code == 200:
                # Success - response may be encrypted blob or JSON
                response.success()
            elif response.status_code == 400:
                # Invalid request format - might be expected for some test data
                response.failure(f"Bad request: {response.text[:100]}")
            elif response.status_code == 403:
                # Access denied - might be expected for invalid keys or mTLS issues
                response.failure(f"Access denied: {response.text[:100]}")
            elif response.status_code == 429:
                # Rate limited - expected under high load
                response.failure(f"Rate limited: {response.text[:100]}")
            else:
                response.failure(f"Unexpected status: {response.status_code}")

    @task(1)
    def test_connect_missing_blob(self):
        """Test connect endpoint with missing blob (should return 400)"""
        with self.client.post(
            "/api/connect",
            json={},
            headers={"Content-Type": "product/json"},
            catch_response=True,
            name="connect_missing_blob",
        ) as response:
            if response.status_code == 400:
                response.success()
            else:
                response.failure(f"Expected 400, got {response.status_code}")


class HeartbeatTaskSet(TaskSet):
    """Task set for /api/heartbeat endpoint load testing"""

    def on_start(self):
        """Called when a user starts"""
        global test_data_manager
        if test_data_manager is None:
            test_data_manager = TestDataManager(self.client.base_url)
        
        # Prepare test data for this user
        self.session_id = test_data_manager.get_random_session_id()
        self.heartbeat_blob = test_data_manager.create_heartbeat_blob(self.session_id)

    @task(10)
    def test_heartbeat(self):
        """
        Test the /api/heartbeat endpoint
        
        This endpoint is called frequently by clients to maintain active sessions.
        It's expected to handle very high load.
        """
        payload = {
            "blob": self.heartbeat_blob,
        }

        with self.client.post(
            "/api/heartbeat",
            json=payload,
            headers={"Content-Type": "product/json"},
            catch_response=True,
            name="heartbeat",
        ) as response:
            if response.status_code == 200:
                # Success - response may be encrypted blob or JSON
                response.success()
            elif response.status_code == 400:
                # Invalid request format
                response.failure(f"Bad request: {response.text[:100]}")
            elif response.status_code == 403:
                # Session not found or invalid - expected for mock session IDs
                response.failure(f"Session invalid: {response.text[:100]}")
            elif response.status_code == 429:
                # Rate limited - expected under high load
                response.failure(f"Rate limited: {response.text[:100]}")
            else:
                response.failure(f"Unexpected status: {response.status_code}")

    @task(1)
    def test_heartbeat_missing_blob(self):
        """Test heartbeat endpoint with missing blob (should return 400)"""
        with self.client.post(
            "/api/heartbeat",
            json={},
            headers={"Content-Type": "product/json"},
            catch_response=True,
            name="heartbeat_missing_blob",
        ) as response:
            if response.status_code == 400:
                response.success()
            else:
                response.failure(f"Expected 400, got {response.status_code}")


class ConnectUser(HttpUser):
    """
    User class for testing /api/connect endpoint
    
    This simulates users connecting to the system.
    Configure load parameters:
    - users: Number of concurrent users
    - spawn-rate: Users spawned per second
    - run-time: Duration of the test
    """
    
    tasks = [ConnectTaskSet]
    wait_time = between(1, 3)  # Wait 1-3 seconds between requests
    weight = 3  # 3x more likely to be chosen than HeartbeatUser


class HeartbeatUser(HttpUser):
    """
    User class for testing /api/heartbeat endpoint
    
    This simulates clients sending periodic heartbeats to maintain sessions.
    Heartbeat requests are typically more frequent than connect requests.
    """
    
    tasks = [HeartbeatTaskSet]
    wait_time = between(0.5, 2)  # Wait 0.5-2 seconds between requests (more frequent)
    weight = 5  # 5x more likely to be chosen than ConnectUser (heartbeats are more frequent)


class CombinedUser(HttpUser):
    """
    Combined user class that tests both endpoints
    
    This simulates a real client that both connects and sends heartbeats.
    """
    
    tasks = {
        ConnectTaskSet: 1,  # 1 connect request
        HeartbeatTaskSet: 10,  # 10 heartbeat requests (more frequent)
    }
    wait_time = between(0.5, 2)


# For headless runs, you can specify which user class to use:
# locust -f locustfile.py --host=http://localhost:5000 --headless -u 100 -r 10 -t 5m ConnectUser
# locust -f locustfile.py --host=http://localhost:5000 --headless -u 200 -r 20 -t 5m HeartbeatUser
# locust -f locustfile.py --host=http://localhost:5000 --headless -u 150 -r 15 -t 5m CombinedUser

