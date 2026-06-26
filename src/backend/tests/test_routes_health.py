"""
Route tests for GET /health.
"""


class TestHealthRoutes:
    def test_when_health_check_called_expect_ok_status_and_required_fields(self, client):
        resp = client.get("/health")

        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] == "ok"
        assert "app" in body
        assert "version" in body
        assert "timestamp" in body
