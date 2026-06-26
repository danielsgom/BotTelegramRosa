"""
Route tests for /api/vip-config.
"""


class TestVipRoutes:
    def test_when_no_config_exists_expect_empty_defaults(self, client, auth_headers):
        resp = client.get("/api/vip-config", headers=auth_headers)

        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert body["config"]["text_translations"] == {}
        assert body["config"]["button_text_translations"] == {}
        assert body["config"]["image_url"] is None
        assert body["config"]["invite_url"] == ""

    def test_when_config_saved_expect_200_and_success(self, client, auth_headers):
        resp = client.post(
            "/api/vip-config",
            data={
                "text_es": "Bienvenido al canal VIP",
                "text_en": "Welcome to the VIP channel",
                "invite_url": "https://t.me/+abc123",
            },
            headers=auth_headers,
        )

        assert resp.status_code == 200
        assert resp.json()["success"] is True

    def test_when_config_saved_expect_get_returns_persisted_values(
        self, client, auth_headers
    ):
        client.post(
            "/api/vip-config",
            data={
                "text_es": "Hola VIP",
                "invite_url": "https://t.me/+xyz789",
            },
            headers=auth_headers,
        )

        resp = client.get("/api/vip-config", headers=auth_headers)

        assert resp.status_code == 200
        config = resp.json()["config"]
        assert config["invite_url"] == "https://t.me/+xyz789"
        assert config["text_translations"].get("es") == "Hola VIP"
