"""OllamaProvider against a stand-in HTTP server that mimics Ollama's /api/chat."""

import asyncio
import json
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer

import pytest

from jarvis_api.ai.providers import ChatTurn, OllamaProvider, ProviderError, provider_status
from jarvis_api.config import Settings


class _Handler(BaseHTTPRequestHandler):
    received: list = []

    def do_POST(self):  # noqa: N802
        body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        _Handler.received.append((self.path, body))
        if body["model"] == "missing":
            self.send_response(404)
            self.end_headers()
            self.wfile.write(b'{"error":"model not found"}')
            return
        out = {
            "model": body["model"],
            "message": {"role": "assistant", "content": "Hello from the local model."},
            "done": True,
            "done_reason": "stop",
            "prompt_eval_count": 120,
            "eval_count": 8,
        }
        data = json.dumps(out).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, *a):
        pass


@pytest.fixture()
def fake_ollama():
    srv = HTTPServer(("127.0.0.1", 0), _Handler)
    t = threading.Thread(target=srv.serve_forever, daemon=True)
    t.start()
    _Handler.received = []
    yield f"http://127.0.0.1:{srv.server_port}"
    srv.shutdown()


def test_ollama_chat(fake_ollama):
    p = OllamaProvider(Settings(ollama_model="llama3.2", ollama_base_url=fake_ollama))
    r = asyncio.run(p.complete("stable", "dynamic", [ChatTurn("user", "hi")]))
    assert r.text == "Hello from the local model." and r.provider == "ollama"
    path, body = _Handler.received[0]
    assert path == "/api/chat" and body["stream"] is False
    assert body["messages"][0]["role"] == "system" and body["messages"][-1]["content"] == "hi"
    assert body["options"]["num_ctx"] == 8192


def test_ollama_missing_model(fake_ollama):
    p = OllamaProvider(Settings(ollama_model="missing", ollama_base_url=fake_ollama))
    with pytest.raises(ProviderError, match="ollama pull missing"):
        asyncio.run(p.complete("s", "d", [ChatTurn("user", "hi")]))


def test_ollama_not_running():
    p = OllamaProvider(Settings(ollama_model="llama3.2", ollama_base_url="http://127.0.0.1:9"))
    with pytest.raises(ProviderError, match="Is it running"):
        asyncio.run(p.complete("s", "d", [ChatTurn("user", "hi")]))


def test_status_selects_ollama():
    st = provider_status(Settings(jarvis_ai_provider="ollama", ollama_model="llama3.2", anthropic_api_key=""))
    assert st["configured"] and st["active"] == "ollama" and st["model"] == "llama3.2"
