from jarvis_api import config
from jarvis_api.ai import providers
from jarvis_api.ai.prompt import extract_proposals


def test_health_and_status(client):
    assert client.get("/api/health").json()["ok"]
    st = client.get("/api/status").json()
    assert st["ai"]["configured"] is False
    assert st["storage"]["backend"] == "sqlite"


def test_task_crud_and_persistence(client):
    r = client.post("/api/tasks", json={"title": "Revise econ", "kind": "daily", "due_date": "2026-11-12"})
    assert r.status_code == 201
    tid = r.json()["id"]
    client.post("/api/tasks", json={"title": "Launch side project", "kind": "goal"})
    r = client.patch(f"/api/tasks/{tid}", json={"status": "done"})
    assert r.json()["status"] == "done" and r.json()["completed_at"]
    tasks = client.get("/api/tasks").json()
    assert {t["title"] for t in tasks} == {"Revise econ", "Launch side project"}
    assert client.get("/api/tasks", params={"kind": "goal"}).json()[0]["kind"] == "goal"
    assert client.delete(f"/api/tasks/{tid}").status_code == 204
    assert len(client.get("/api/tasks").json()) == 1
    assert client.post("/api/tasks", json={"title": "x", "due_date": "tomorrow"}).status_code == 422


def test_memory_lifecycle(client):
    m = client.post("/api/memories", json={"layer": "core_identity", "content": "Prefers conceptual explanations"}).json()
    assert m["verification"] == "user_confirmed"
    r = client.patch(f"/api/memories/{m['id']}", json={"content": "Prefers conceptual explanations with diagrams", "note": "more precise"})
    body = r.json()
    assert body["verification"] == "user_corrected"
    assert body["correction_history"][0]["old"] == "Prefers conceptual explanations"
    new = client.post(f"/api/memories/{m['id']}/supersede", json={"content": "Prefers visual, conceptual explanations"}).json()
    assert new["supersedes_id"] == m["id"]
    old = [x for x in client.get("/api/memories").json() if x["id"] == m["id"]][0]
    assert old["status"] == "superseded" and old["superseded_by_id"] == new["id"]
    assert client.delete(f"/api/memories/{new['id']}").status_code == 204


def test_import_defaults_to_review(client):
    r = client.post("/api/import/memories", json={"memories": [
        {"layer": "life_context", "content": "Student in an IB programme"},
        {"content": "Interested in entrepreneurship", "layer": "core_identity", "kind": "stated"},
        {"content": ""},
    ]})
    assert r.json()["created"] == 2 and len(r.json()["skipped"]) == 1
    mems = client.get("/api/memories").json()
    assert all(m["status"] == "proposed" and m["verification"] == "unverified" for m in mems)
    ins = client.get("/api/insights").json()
    assert any(i["id"] == "memory_review" for i in ins)
    mid = mems[0]["id"]
    assert client.post(f"/api/memories/{mid}/confirm").json()["status"] == "active"


def test_chat_without_provider_is_honest(client):
    r = client.post("/api/chat", json={"message": "hello"})
    assert r.status_code == 503
    assert r.json()["detail"]["code"] == "ai_not_configured"
    assert client.get("/api/conversations").json() == []


class FakeProvider:
    """Test double only - the app never uses a fake provider at runtime."""
    name = "fake"
    model = "fake-model"

    def __init__(self):
        self.calls = []

    async def complete(self, stable_system, dynamic_system, turns, max_tokens=16000):
        self.calls.append((stable_system, dynamic_system, turns))
        return providers.ProviderResult(
            text='Sure.\n<jarvis_proposals>{"memories": [{"layer": "short_term", "content": "Working on a German history essay", '
            '"kind": "stated", "confidence": 0.9, "is_temporary": true}], "tasks": [{"title": "Draft essay outline", "kind": "daily"}]}</jarvis_proposals>',
            provider="fake", model="fake-model", stop_reason="end_turn",
        )


def test_chat_flow_with_proposals(client, monkeypatch):
    fake = FakeProvider()
    from jarvis_api.routers import chat as chat_router
    monkeypatch.setattr(chat_router, "get_provider", lambda: fake)
    client.post("/api/memories", json={"layer": "core_identity", "content": "Enjoys debating ideas"})
    r = client.post("/api/chat", json={"message": "I have a German history essay due", "timezone": "Europe/Berlin"})
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["assistant_message"]["content"] == "Sure."
    assert data["proposed_memories"][0]["status"] == "proposed"
    assert data["proposed_actions"][0]["skill"] == "tasks.create"
    # memory made it into the prompt, labelled as data
    assert "Enjoys debating ideas" in fake.calls[0][1] and "<memories>" in fake.calls[0][1]
    # proposed memory must NOT be in context on the next turn until accepted
    client.post("/api/chat", json={"message": "essay help", "conversation_id": data["conversation"]["id"]})
    assert "German history essay" not in fake.calls[1][1]
    assert len(fake.calls[1][2]) == 3  # user, assistant, user
    # approve task proposal -> task exists
    aid = data["proposed_actions"][0]["id"]
    assert client.post(f"/api/actions/{aid}/approve").json()["status"] == "executed"
    assert any(t["title"] == "Draft essay outline" for t in client.get("/api/tasks").json())
    assert client.post(f"/api/actions/{aid}/approve").status_code == 409
    # do-not-remember rejects the message's proposals
    eff = client.post("/api/feedback", json={"target_type": "message", "target_id": data["assistant_message"]["id"], "kind": "do_not_remember"}).json()
    assert eff["rejected_proposals"] == 1


def test_extract_proposals_handles_garbage():
    text, p = extract_proposals("Hello <jarvis_proposals>{not json}</jarvis_proposals>")
    assert text == "Hello" and p == {"memories": [], "tasks": []}
    text, p = extract_proposals("Hi <jarvis_proposals>{\"memories\": [")
    assert text == "Hi"


def test_access_token(client, monkeypatch):
    monkeypatch.setenv("JARVIS_ACCESS_TOKEN", "s3cret")
    config.get_settings.cache_clear()
    assert client.get("/api/tasks").status_code == 401
    assert client.get("/api/tasks", headers={"Authorization": "Bearer s3cret"}).status_code == 200


def test_settings_events_and_conflicts(client):
    client.put("/api/settings/appearance", json={"value": {"theme": "dark", "accent": "#7dd3fc"}})
    assert client.get("/api/settings").json()["appearance"]["accent"] == "#7dd3fc"
    assert client.put("/api/settings/BAD KEY", json={"value": 1}).status_code in (404, 422)
    from datetime import datetime, timedelta, timezone
    base = datetime.now(timezone.utc).replace(microsecond=0) + timedelta(days=1)
    for title, off in (("Swim shift", 0), ("Study group", 30)):
        s = base + timedelta(minutes=off)
        r = client.post("/api/events", json={"title": title, "start": s.isoformat(), "end": (s + timedelta(hours=1)).isoformat()})
        assert r.status_code == 201
    assert any(i["id"].startswith("conflict:") for i in client.get("/api/insights").json())


def test_chatgpt_import(client):
    conv = [{
        "id": "abc", "title": "Physics help", "create_time": 1700000000, "current_node": "n3",
        "mapping": {
            "n1": {"message": None, "parent": None},
            "n2": {"message": {"author": {"role": "user"}, "content": {"parts": ["What is momentum?"]}, "create_time": 1700000001}, "parent": "n1"},
            "n3": {"message": {"author": {"role": "assistant"}, "content": {"parts": ["p = mv"]}, "create_time": 1700000002}, "parent": "n2"},
        },
    }]
    import json
    files = {"file": ("conversations.json", json.dumps(conv), "application/json")}
    assert client.post("/api/import/chatgpt-conversations", files=files).json()["imported"] == 1
    files = {"file": ("conversations.json", json.dumps(conv), "application/json")}
    assert client.post("/api/import/chatgpt-conversations", files=files).json()["skipped_duplicates"] == 1
    c = client.get("/api/conversations", params={"source": "import:chatgpt"}).json()[0]
    msgs = client.get(f"/api/conversations/{c['id']}/messages").json()
    assert [m["role"] for m in msgs] == ["user", "assistant"]


def test_export_and_wipe(client):
    client.post("/api/tasks", json={"title": "t"})
    exp = client.get("/api/export").json()
    assert exp["format"] == "jarvis-export-v1" and len(exp["tasks"]) == 1
    assert client.delete("/api/data", params={"confirm": "nope"}).status_code == 400
    client.delete("/api/data", params={"confirm": "DELETE-EVERYTHING"})
    assert client.get("/api/tasks").json() == []
