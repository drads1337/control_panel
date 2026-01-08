#!/usr/bin/env python3
"""
One-shot mTLS probe against /api/challenge using the same embedded cert/key as the client.
Writes temp PEMs, posts to https://ovrin.xyz/api/challenge with the provided key/user params.

Defaults match current client:
  user_key: PUBG-12M-uUakzkGT5FQY
  project_id: 9516412833
  fingerprint: 9501fe74872064166f37758d690133db520626fde103c0ad8f3b7f2822bed11f
  url: https://ovrin.xyz/api/challenge

Use --insecure to skip server verification (mirrors client behavior).
"""

import argparse
import tempfile
from pathlib import Path
import sys
import ssl

import httpx

CERT_PEM = """-----BEGIN CERTIFICATE-----
MIIEhzCCAm+gAwIBAgIUJnIkuuV4lXCcqSH+67oM/weEwEwwDQYJKoZIhvcNAQEL
BQAwPTELMAkGA1UEBhMCVVMxCzAJBgNVBAgMAkNBMQ4wDAYDVQQKDAVQYW5lbDER
MA8GA1UEAwwIUGFuZWwgQ0EwHhcNMjYwMTA4MDMxNDQ1WhcNMjcwMTA4MDMxNDQ1
WjBYMQswCQYDVQQGEwJVUzELMAkGA1UECAwCQ0ExFjAUBgNVBAcMDVNhbiBGcmFu
Y2lzY28xDjAMBgNVBAoMBVBhbmVsMRQwEgYDVQQDDAt0ZXN0LWNsaWVudDCCASIw
DQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBAKRwbUgPGEzd7HapZwoCpb21dyAI
OSfsIZoTxH6BfbLKsAjrwWrcqPDMYAC3i0zwNpjU9Y+d6A2w68NqLrctryavG3T6
eUGqCcCRpVfxgOOCQxF7/KYztwqT/MBJkNGXhbHCpr9Y5Aj6Hn2vni7lxasvNFB3
lZeHLQ55Qur0fUyZedDphQsvkLD4dpYucn6FLST8X3D26FqRkMegwlSQVmBJhgnv
kJBeXz14YkGBwTjIjPicWcy/v5hpbl2PizihfniSJ5fTP4ZzoAqIQ4n7mqPPmLzE
qSIRgobMM64YmmXwekK2UtCjL3kYi3jCT5dF4GaPU9Yva0TCO/ANeRyYO5sCAwEA
AaNkMGIwCwYDVR0PBAQDAgWgMBMGA1UdJQQMMAoGCCsGAQUFBwMCMB0GA1UdDgQW
BBTD1Q3YKn8yBOt3b89qMTR4jryh6zAfBgNVHSMEGDAWgBTNwcVmVMFDSBcDNrHG
J0Kby+9PeDANBgkqhkiG9w0BAQsFAAOCAgEAsJEGF1AZZYVG8Zlb2v8LzXGyqVFF
vBtQ/+6suiLyDC6JfLoeVaRr8QnT178hy3Eojp0foJwoR3usrBLTKnjpCLTf3tdo
54HyCAVAnGuMvB63j5S9yCxVPhzVIelN8Vt72UZCyOQkF/Fe8fS5D+52JA6M1gNW
qTCLGnR9ht237ocXvx0yzQl4WUSpgcWTJ/su2gEvXBPWfgtBNqtU6sTGJUhM5xB6
I0/FrH1QBbuJss9PL2suJf0L0z2T0tUQ8zkv+wUbQmZBlLHJBMJIWXk0uJT5+bzN
qAUHnY6cSAxaXORQHJo+K1PpiKhqgePLcn4eZ5Ykoi0Y3MIzg5fByi/Vad8n2mwQ
lPRHX09IU2xLeNI9lye5UIE0Egx+oZ+4gjhsB16TNp0aMe6zuTlqEvDVZG0hpxtp
SPmnzi28wvgfYkYgr7iqQ5yV9hhpNXEkUfmRYooZp0u9U8AFp4nG338REdToYJk7
bomDjJg5iZE3xcJFx7Pym0ZB1MapV/3F8sBQzRpjy2GuWjNMnOurZDVGzSnAws3d
WXFxAci8MGPztKBJmSriJHUPOUdwFMzlz2sNMBGTlRnXSYw9YXUdTkah+joCwX+d
xP9mKMSTRinmlSxz73by/TQok8ZIyfdvjhX0N16zC3qOzSKqpC6wS4dDp193xdS7
/oFMP4qYpiNc97o=
-----END CERTIFICATE-----"""

KEY_PEM = """-----BEGIN PRIVATE KEY-----
MIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQCkcG1IDxhM3ex2
qWcKAqW9tXcgCDkn7CGaE8R+gX2yyrAI68Fq3KjwzGAAt4tM8DaY1PWPnegNsOvD
ai63La8mrxt0+nlBqgnAkaVX8YDjgkMRe/ymM7cKk/zASZDRl4Wxwqa/WOQI+h59
r54u5cWrLzRQd5WXhy0OeULq9H1MmXnQ6YULL5Cw+HaWLnJ+hS0k/F9w9uhakZDH
oMJUkFZgSYYJ75CQXl89eGJBgcE4yIz4nFnMv7+YaW5dj4s4oX54kieX0z+Gc6AK
iEOJ+5qjz5i8xKkiEYKGzDOuGJpl8HpCtlLQoy95GIt4wk+XReBmj1PWL2tEwjvw
DXkcmDubAgMBAAECggEAHWd5MyR33O7mJMXgBfs5NfYoChNOXSQtUgbs4Q44surp
lX7KxFgW4ZA6LoajoytlJ+kUzAyZfTFAx13KYrkJk+pGB6HuYt6MBeJFZbdqq8QU
SCEaqYGf3oVd8eh1u/TTVFkRRjAX/r7zCtiHea1ermCvgyAPINxsIyVt4OO9MCAM
Bc3fXA8fRsDO9M02nZns8s41hKZ+Hw19g9vsMxQuXmN2YYC2n2WXrO24gfPsYN7K
zAW5tIlUUEc/E0z+q5HXg50ky9qVfIYkN0E3rlzHl9RHHk5B+fY9DcZ9PbxeZb3f
TBorPD9hL9ssGa4wLgrBMTH+K6r8Hv4tVR6R3D8lYQKBgQDchiOp3eylVsZyiAlA
pxM/6/FLiQqk4qGpVHo1zD6U7upmGRKyQiD0XH+qWEBDuwIRqQ7rEVCzwp/FwHct
FgzZmVqFV17BHP72c2/csLOh+J2V6USM0GfdGDSJpvD/e/IrltNnCSlPvjWD9q3q
FgAxBRfmyqwMB4ktSwzO/BLhawKBgQC+5IqLNEjw8oSNVkBh54LSk/VKljN2AW/s
qcDQ7cI0B1GFPHzV6i+LX2EP0nC7wPHOrMDLuFS/j7gQ2GyfvqaqCgpthLCrQdC+
h+G/Tsvku6Ah1UiTJnh+s2RUEEAtfZ132X0B4IphEX5vRkMamAk2n5baTG7G5L6h
p230coEqkQKBgEmZl3ONNvsj0A3Pq07htEIETD9KmLvZS91I7ZTg+w4YAzFaMuw9
t+P2r0E6PRCd7J3aT7lSyR2F2m9UwjHRBy7kyNpyA5TuSYYVlwMQEpP/dxDejtt0
fwXCm15J0mtigbvclefwndIYiKHnhbn35850hbqob+1/4l+0iazXYrHLAoGAfsn7
P1Rd8jOSWPHl12FWohkF/iFfUszHk1B4sgyJRddqjO1NGSPvqkmShVjH6dzQfu59
K5JmL8n8fqvREhUmS6BZpr5QPZ98T2CfT1q90FHSnUY1aw9NTxJF3BPjHJPnaDg7
cGi8YJam/K+VWG+NBwvevWWw2kgKWgKD5K29HxECgYBhzg3Ud4mx5Pv7JMEifo0G
DNfslJOABB/gnnvdxPBd9JeSPYoqfcD/c1Jgmao7X/10TGFTzqXPM8Rz/65IwlkD
23CmpBHB7cSJreOAOVteTdW4/+yLGZbTc/O4KgzgNVFxxNlaR8QKgyj52yPCNdF3
o7i+ilJIce5YDey8ZBEktw==
-----END PRIVATE KEY-----"""


def main():
    parser = argparse.ArgumentParser(description="mTLS probe using embedded cert/key")
    parser.add_argument("--url", default="https://ovrin.xyz/api/challenge")
    parser.add_argument("--user-key", default="PUBG-12M-uUakzkGT5FQY")
    parser.add_argument("--project-id", default="9516412833")
    parser.add_argument(
        "--fingerprint",
        default="9501fe74872064166f37758d690133db520626fde103c0ad8f3b7f2822bed11f",
    )
    parser.add_argument("--insecure", action="store_true", help="Disable server verification")
    args = parser.parse_args()

    with tempfile.TemporaryDirectory() as tmp:
        cert_path = Path(tmp) / "client-cert.pem"
        key_path = Path(tmp) / "client-key.pem"
        cert_path.write_text(CERT_PEM)
        key_path.write_text(KEY_PEM)

        verify = False if args.insecure else True

        payload = {
            "fingerprint": args.fingerprint,
            "user_key": args.user_key,
            "project_id": args.project_id,
        }

        try:
            with httpx.Client(
                http2=True,
                verify=verify,
                cert=(str(cert_path), str(key_path)),
                timeout=10.0,
            ) as client:
                resp = client.post(args.url, json=payload)
                print(f"Status: {resp.status_code}")
                print(f"Body: {resp.text[:500]}")
                if resp.is_error:
                    sys.exit(1)
        except ssl.SSLError as e:
            print(f"SSL error: {e}", file=sys.stderr)
            sys.exit(3)
        except Exception as e:
            print(f"Request failed: {e}", file=sys.stderr)
            sys.exit(4)


if __name__ == "__main__":
    main()
