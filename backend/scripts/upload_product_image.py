"""Upload one product image through the admin API.

Usage (cwd: backend/):
  uv run python -m scripts.upload_product_image FILE --product blazer --school LQD \
      --gender MALE --colour ghi
Env: API_URL (default http://127.0.0.1:8000), ADMIN_USERNAME, ADMIN_PASSWORD (prompted if unset).
"""

import argparse
import getpass
import os
import sys
from pathlib import Path

import httpx


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("file", type=Path)
    parser.add_argument("--product", required=True, help="product code")
    parser.add_argument("--school", required=True, help="school code")
    parser.add_argument("--gender", required=True, choices=["MALE", "FEMALE"])
    parser.add_argument("--colour", required=True)
    args = parser.parse_args(argv)
    username = os.environ.get("ADMIN_USERNAME") or input("Username: ")
    password = os.environ.get("ADMIN_PASSWORD") or getpass.getpass("Password: ")
    with httpx.Client(base_url=os.environ.get("API_URL", "http://127.0.0.1:8000")) as api:
        api.post(
            "/api/auth/login", json={"username": username, "password": password}
        ).raise_for_status()
        products = api.get("/api/products", params={"include_inactive": "true"}).json()
        product = next((p for p in products if p["code"] == args.product), None)
        school = next((s for s in api.get("/api/schools").json() if s["code"] == args.school), None)
        if product is None or school is None:
            print("unknown product or school code", file=sys.stderr)
            return 1
        r = api.post(
            f"/api/products/{product['id']}/images",
            data={"school_id": school["id"], "gender": args.gender, "colour": args.colour},
            files={"file": (args.file.name, args.file.read_bytes())},
        )
    if r.is_error:
        print(r.status_code, r.text, file=sys.stderr)
        return 1
    print(r.json()["url"])
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
