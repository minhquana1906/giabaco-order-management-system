import pytest
from argon2 import PasswordHasher
from httpx import AsyncClient
from starlette.requests import Request

from app.core import security
from app.core.security import RateLimiter, client_ip


def test_limiter_blocks_after_limit_and_recovers() -> None:
    now = [0.0]
    limiter = RateLimiter(2, 60, clock=lambda: now[0])
    assert limiter.allow("ip") and limiter.allow("ip")
    assert not limiter.allow("ip")
    assert limiter.allow("other")
    now[0] = 61
    assert limiter.allow("ip")


def test_retry_after_is_the_time_until_the_oldest_hit_expires() -> None:
    now = [0.0]
    limiter = RateLimiter(1, 900, clock=lambda: now[0])
    assert limiter.retry_after("ip") == 1
    limiter.allow("ip")
    now[0] = 300.5
    assert limiter.retry_after("ip") == 600


def test_limiter_forgets_keys_whose_hits_have_all_expired() -> None:
    now = [0.0]
    limiter = RateLimiter(2, 60, clock=lambda: now[0])
    limiter.allow("idle-a")
    limiter.allow("idle-b")
    now[0] = 30
    limiter.allow("active")

    now[0] = 61
    limiter.allow("active")

    assert set(limiter._hits) == {"active"}


def test_limiter_with_no_allowance_does_not_break_the_sweep() -> None:
    now = [0.0]
    limiter = RateLimiter(0, 60, clock=lambda: now[0])
    assert not limiter.allow("ip")

    now[0] = 61

    assert not limiter.allow("ip")
    assert set(limiter._hits) == {"ip"}


def request_from(peer: str, cf_ip: str | None = None) -> Request:
    headers = [(b"cf-connecting-ip", cf_ip.encode())] if cf_ip is not None else []
    return Request({"type": "http", "headers": headers, "client": (peer, 5000)})


@pytest.mark.parametrize(
    ("forwarded", "key"),
    [
        ("203.0.113.7", "203.0.113.7"),
        (" 203.0.113.7 ", "203.0.113.7"),
        ("2001:db8:aaaa:bbbb:1:2:3:4", "2001:db8:aaaa:bbbb::/64"),
        ("2001:db8:aaaa:bbbb:ffff:ffff:ffff:ffff", "2001:db8:aaaa:bbbb::/64"),
        ("2001:db8:aaaa:cccc::1", "2001:db8:aaaa:cccc::/64"),
        ("::ffff:203.0.113.7", "203.0.113.7"),
        ("not-an-ip", "198.51.100.1"),
        ("", "198.51.100.1"),
    ],
)
def test_client_ip_key(forwarded: str, key: str) -> None:
    assert client_ip(request_from("198.51.100.1", forwarded)) == key


def test_client_ip_falls_back_to_the_peer_and_groups_its_ipv6_prefix() -> None:
    assert client_ip(request_from("198.51.100.1")) == "198.51.100.1"
    assert client_ip(request_from("2001:db8::7")) == "2001:db8::/64"


async def test_addresses_in_one_ipv6_prefix_share_a_rate_limit_bucket(
    anon_client: AsyncClient,
) -> None:
    statuses = [
        (
            await anon_client.post(
                "/api/auth/login",
                json={"username": "admin", "password": "wrong"},
                headers={"cf-connecting-ip": f"2001:db8:1:2:{i:x}::{i:x}"},
            )
        ).status_code
        for i in range(1, 7)
    ]

    assert statuses == [401] * 5 + [429]


class VerifyOnly:
    def __init__(self, real: PasswordHasher) -> None:
        self.verify = real.verify

    def hash(self, password: str) -> str:
        raise AssertionError("hashing on the request path")


def test_dummy_hash_is_ready_at_import(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(security, "_hasher", VerifyOnly(security._hasher))

    assert security.verify_password(None, "any-password") is False
