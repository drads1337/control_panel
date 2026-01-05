"""
IP Address Utilities
Provides functions for working with IP addresses, geolocation, and proxy detection
"""

import logging
import os
from typing import Optional, Tuple

import geoip2.database
from flask import request

def get_real_ip() -> str:
    """
    Get the real client IP address, considering proxy and headers

    Returns:
        Real IP address as string
    """

    headers_to_check = [
        "X-Forwarded-For",
        "X-Real-IP",
        "X-Client-IP",
        "CF-Connecting-IP",
        "X-Forwarded",
        "Forwarded-For",
        "Forwarded",
    ]

    for header in headers_to_check:
        ip = request.headers.get(header)
        if ip:

            if "," in ip:
                ip = ip.split(",")[0].strip()
            if ip and ip not in ("unknown", "127.0.0.1", "localhost", "::1"):
                return ip

    return request.remote_addr or "127.0.0.1"

def get_location_from_ip(ip: str) -> Tuple[Optional[str], Optional[str]]:
    """
    Get country and city from IP address

    Args:
        ip: IP address to lookup

    Returns:
        Tuple of (country, city) or (None, None) if unable to determine
    """
    if not ip or ip in ("127.0.0.1", "localhost", "::1", "unknown"):
        return None, None

    try:

        db_path = os.path.join(os.path.dirname(__file__), "..", "GeoLite2-City.mmdb")

        if not os.path.exists(db_path):
            logging.warning(f"[WARNING] GeoIP database not found at {db_path}")
            return None, None

        with geoip2.database.Reader(db_path) as reader:
            response = reader.city(ip)
            country = response.country.name
            city = response.city.name
            return country, city

    except Exception as e:

        logging.debug(f"[WARNING] Failed to get geolocation for IP {ip}: {e}")
        return None, None

def get_coordinates_from_ip(ip: str) -> Tuple[Optional[float], Optional[float], Optional[str], Optional[str]]:
    """
    Get coordinates (latitude, longitude), country and city from IP address

    Args:
        ip: IP address to lookup

    Returns:
        Tuple of (latitude, longitude, country, city) or (None, None, None, None) if unable to determine
    """
    if not ip or ip in ("127.0.0.1", "localhost", "::1", "unknown"):
        return None, None, None, None

    try:
        db_path = os.path.join(os.path.dirname(__file__), "..", "GeoLite2-City.mmdb")

        if not os.path.exists(db_path):
            logging.warning(f"[WARNING] GeoIP database not found at {db_path}")
            return None, None, None, None

        with geoip2.database.Reader(db_path) as reader:
            response = reader.city(ip)
            lat = response.location.latitude
            lng = response.location.longitude
            country = response.country.name
            city = response.city.name
            return lat, lng, country, city

    except Exception as e:
        logging.debug(f"[WARNING] Failed to get coordinates for IP {ip}: {e}")
        return None, None, None, None

def get_ip_info(ip: str) -> dict:
    """
    Get full information about an IP address

    Args:
        ip: IP address to lookup

    Returns:
        Dictionary with IP, country, city, and location information
    """
    country, city = get_location_from_ip(ip)

    return {
        "ip": ip,
        "country": country,
        "city": city,
        "location": f"{city}, {country}" if city and country else (country or "Unknown"),
    }
