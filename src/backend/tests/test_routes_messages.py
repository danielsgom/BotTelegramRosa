"""
Route tests for /api/messages.
"""

from database import Message, MessageBatch


class TestMessagesRoutes:
    def test_when_no_token_expect_401(self, client):
        resp = client.get("/api/messages")

        assert resp.status_code == 401

    def test_when_authenticated_and_no_messages_expect_empty_list(self, client, auth_headers):
        resp = client.get("/api/messages", headers=auth_headers)

        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert body["messages"] == []

    def test_when_message_id_not_found_expect_404(self, client, auth_headers):
        resp = client.get("/api/messages/999", headers=auth_headers)

        assert resp.status_code == 404

    def test_when_delete_nonexistent_message_expect_404(self, client, auth_headers):
        resp = client.delete("/api/messages/999", headers=auth_headers)

        assert resp.status_code == 404

    def test_when_delete_existing_message_expect_success(self, client, test_db, auth_headers):
        batch = MessageBatch(name="DeleteTestBatch", description="", order=1)
        test_db.add(batch)
        test_db.commit()
        msg = Message(batch_id=batch.id, title="Delete Me", text="Some content")
        test_db.add(msg)
        test_db.commit()
        msg_id = msg.id

        resp = client.delete(f"/api/messages/{msg_id}", headers=auth_headers)

        assert resp.status_code == 200
        assert resp.json()["success"] is True
