"""
Security Types
Data classes for security operations

This module contains shared data classes to avoid circular imports.
"""

from dataclasses import dataclass
from datetime import datetime
from typing import List, Optional

@dataclass
class ThreatAssessment:
    """Data class for threat assessment results"""

    score: int
    level: str
    factors: List[str]
    recommendations: List[str]

@dataclass
class SecurityContext:
    """Data class for security context information"""

    fingerprint: str
    ip_address: str
    user_agent: str
    user_key: Optional[str] = None
    project_id: Optional[int] = None
    country: Optional[str] = None
    city: Optional[str] = None
    timestamp: Optional[datetime] = None

