"""
Route tests for /api/admin/quick-messages.
"""


class TestAdminQuickMessagesRoutes:
    def test_when_no_messages_expect_empty_list(self, client, auth_headers):
        resp = client.get("/api/admin/quick-messages", headers=auth_headers)

        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert body["messages"] == []

    def test_when_message_created_expect_message_id_returned(self, client, auth_headers):
        resp = client.post(
            "/api/admin/quick-messages",
            data={
                "name": "Greeting",
                "text_es": "Hola",
                "text_en": "Hello",
                "text_pt": "Olá",
            },
            headers=auth_headers,
        )

        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert "message_id" in body

    def test_when_message_deleted_expect_success(self, client, auth_headers):
        create_resp = client.post(
            "/api/admin/quick-messages",
            data={
                "name": "ToDelete",
                "text_es": "Adios",
                "text_en": "Goodbye",
                "text_pt": "Adeus",
            },
            headers=auth_headers,
        )
        msg_id = create_resp.json()["message_id"]

        resp = client.delete(f"/api/admin/quick-messages/{msg_id}", headers=auth_headers)

        assert resp.status_code == 200
        assert resp.json()["success"] is True

    def test_when_delete_nonexistent_message_expect_404(self, client, auth_headers):
        resp = client.delete("/api/admin/quick-messages/999", headers=auth_headers)

        assert resp.status_code == 404
