"""
VPN Detection Utilities
Detects VPN, proxy, and datacenter IP addresses
"""

import logging
import requests
from typing import Optional, Dict, Tuple
from functools import lru_cache
import time

logger = logging.getLogger(__name__)


class VPNDetector:
    """Detects VPN, proxy, and datacenter IP addresses"""

    def __init__(self):
        self.cache_ttl = 3600
        self._cache: Dict[str, Tuple[bool, float, Dict]] = {}
        self.timeout = 3

    def _is_cached(self, ip: str) -> Optional[Dict]:
        """Check if IP result is cached and still valid"""
        if ip in self._cache:
            is_vpn, timestamp, data = self._cache[ip]
            if time.time() - timestamp < self.cache_ttl:
                return data
        return None

    def _cache_result(self, ip: str, data: Dict):
        """Cache the detection result"""
        self._cache[ip] = (data.get("is_vpn", False), time.time(), data)

        if len(self._cache) > 1000:

            sorted_items = sorted(self._cache.items(), key=lambda x: x[1][1])
            for key, _ in sorted_items[:100]:
                del self._cache[key]

    def detect_vpn(self, ip: str) -> Dict:
        """
        Detect if an IP address is a VPN, proxy, or datacenter

        Args:
            ip: IP address to check

        Returns:
            Dictionary with detection results:
            {
                "is_vpn": bool,
                "is_proxy": bool,
                "is_datacenter": bool,
                "provider": str,
                "confidence": float,
                "method": str
            }
        """
        if not ip or ip in ("127.0.0.1", "localhost", "::1", "unknown"):
            return {
                "is_vpn": False,
                "is_proxy": False,
                "is_datacenter": False,
                "provider": None,
                "confidence": 0.0,
                "method": "local",
            }


        cached = self._is_cached(ip)
        if cached:
            return cached

        result = {
            "is_vpn": False,
            "is_proxy": False,
            "is_datacenter": False,
            "provider": None,
            "confidence": 0.0,
            "method": "unknown",
        }


        methods = [
            self._detect_via_ipapi,
            self._detect_via_ipinfo,
        ]

        for method in methods:
            try:
                method_result = method(ip)
                if method_result and method_result.get("confidence", 0) > 0.5:
                    result.update(method_result)
                    result["method"] = method.__name__.replace("_detect_via_", "")
                    break
            except Exception as e:
                logger.debug(f"VPN detection method {method.__name__} failed for {ip}: {e}")
                continue


        self._cache_result(ip, result)

        return result

    def _detect_via_ipapi(self, ip: str) -> Optional[Dict]:
        """Detect VPN using ipapi.co service"""
        try:
            response = requests.get(
                f"https://ipapi.co/{ip}/json/",
                timeout=self.timeout,
                headers={"User-Agent": "Security-System/1.0"},
            )
            if response.status_code == 200:
                data = response.json()
                org = data.get("org", "").lower()
                asn = data.get("asn", "")


                is_vpn = any(
                    keyword in org
                    for keyword in [
                        "vpn",
                        "proxy",
                        "hosting",
                        "datacenter",
                        "server",
                        "cloud",
                        "host",
                    ]
                )


                is_datacenter = any(
                    keyword in org
                    for keyword in [
                        "amazon",
                        "google",
                        "microsoft",
                        "digitalocean",
                        "linode",
                        "vultr",
                        "ovh",
                        "hetzner",
                    ]
                )

                confidence = 0.7 if is_vpn or is_datacenter else 0.3

                return {
                    "is_vpn": is_vpn,
                    "is_proxy": is_vpn,
                    "is_datacenter": is_datacenter,
                    "provider": data.get("org", "Unknown"),
                    "confidence": confidence,
                }
        except Exception as e:
            logger.debug(f"ipapi.co detection failed for {ip}: {e}")
        return None

    def _detect_via_ipinfo(self, ip: str) -> Optional[Dict]:
        """Detect VPN using ipinfo.io service"""
        try:
            response = requests.get(
                f"https://ipinfo.io/{ip}/json",
                timeout=self.timeout,
                headers={"User-Agent": "Security-System/1.0"},
            )
            if response.status_code == 200:
                data = response.json()
                org = data.get("org", "").lower()
                hostname = data.get("hostname", "").lower()


                is_vpn = any(
                    keyword in org or keyword in hostname
                    for keyword in [
                        "vpn",
                        "proxy",
                        "hosting",
                        "datacenter",
                        "server",
                        "cloud",
                    ]
                )

                is_datacenter = any(
                    keyword in org or keyword in hostname
                    for keyword in [
                        "amazon",
                        "google",
                        "microsoft",
                        "digitalocean",
                        "linode",
                        "vultr",
                    ]
                )

                confidence = 0.6 if is_vpn or is_datacenter else 0.2

                return {
                    "is_vpn": is_vpn,
                    "is_proxy": is_vpn,
                    "is_datacenter": is_datacenter,
                    "provider": data.get("org", "Unknown"),
                    "confidence": confidence,
                }
        except Exception as e:
            logger.debug(f"ipinfo.io detection failed for {ip}: {e}")
        return None

    def is_vpn(self, ip: str) -> bool:
        """
        Simple check if IP is a VPN/proxy

        Args:
            ip: IP address to check

        Returns:
            True if IP is detected as VPN/proxy
        """
        result = self.detect_vpn(ip)
        return result.get("is_vpn", False) or result.get("is_proxy", False)



vpn_detector = VPNDetector()

