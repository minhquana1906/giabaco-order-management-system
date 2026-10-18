from app.core.security import RateLimiter


def test_limiter_blocks_after_limit_and_recovers() -> None:
    now = [0.0]
    limiter = RateLimiter(2, 60, clock=lambda: now[0])
    assert limiter.allow("ip") and limiter.allow("ip")
    assert not limiter.allow("ip")
    assert limiter.allow("other")
    now[0] = 61
    assert limiter.allow("ip")
