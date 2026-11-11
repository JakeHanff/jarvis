import pytest
from fastapi.testclient import TestClient

from jarvis_api import config
from jarvis_api.db import init_engine


@pytest.fixture()
def client(tmp_path, monkeypatch):
    for k in ("ANTHROPIC_API_KEY", "OPENAI_API_KEY", "OPENAI_MODEL", "JARVIS_ACCESS_TOKEN", "DATABASE_URL"):
        monkeypatch.setenv(k, "")
    monkeypatch.setenv("DATA_DIR", str(tmp_path))
    config.get_settings.cache_clear()
    init_engine(f"sqlite:///{tmp_path / 'test.db'}")
    from jarvis_api.main import app

    with TestClient(app) as c:
        # lifespan calls init_engine() again using DATA_DIR -> same tmp dir
        yield c
    config.get_settings.cache_clear()
