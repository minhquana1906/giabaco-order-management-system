from pathlib import Path

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.main import _mount_spa


def _client(tmp_path: Path) -> TestClient:
    (tmp_path / "assets").mkdir()
    (tmp_path / "assets" / "index-abc123.js").write_text("console.log(1)")
    (tmp_path / "favicon.svg").write_text("<svg/>")
    (tmp_path / "index.html").write_text("<html></html>")
    app = FastAPI()
    _mount_spa(app, tmp_path)
    return TestClient(app)


def test_hashed_assets_are_immutable(tmp_path: Path) -> None:
    resp = _client(tmp_path).get("/assets/index-abc123.js")
    assert resp.headers["cache-control"] == "public, max-age=31536000, immutable"


def test_index_html_is_always_revalidated(tmp_path: Path) -> None:
    client = _client(tmp_path)
    for path in ("/", "/parent/children"):
        assert client.get(path).headers["cache-control"] == "no-cache"


def test_unhashed_static_files_keep_default_caching(tmp_path: Path) -> None:
    resp = _client(tmp_path).get("/favicon.svg")
    assert "immutable" not in resp.headers.get("cache-control", "")
