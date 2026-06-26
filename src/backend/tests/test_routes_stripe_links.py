"""
Route tests for /api/stripe-links.
"""


class TestStripeLinksRoutes:
    def test_when_no_links_expect_empty_list(self, client, auth_headers):
        resp = client.get("/api/stripe-links", headers=auth_headers)

        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert body["links"] == []

    def test_when_link_created_expect_link_id_returned(self, client, auth_headers):
        resp = client.post(
            "/api/stripe-links",
            data={"name": "VIP 30d", "url": "https://buy.stripe.com/test123"},
            headers=auth_headers,
        )

        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert "link_id" in body

    def test_when_duplicate_name_created_expect_400(self, client, auth_headers):
        client.post(
            "/api/stripe-links",
            data={"name": "DuplicateLink", "url": "https://buy.stripe.com/first"},
            headers=auth_headers,
        )

        resp = client.post(
            "/api/stripe-links",
            data={"name": "DuplicateLink", "url": "https://buy.stripe.com/second"},
            headers=auth_headers,
        )

        assert resp.status_code == 400

    def test_when_update_nonexistent_link_expect_404(self, client, auth_headers):
        resp = client.put(
            "/api/stripe-links/999",
            data={"name": "Ghost", "url": "https://example.com"},
            headers=auth_headers,
        )

        assert resp.status_code == 404

    def test_when_link_deleted_expect_success(self, client, auth_headers):
        create_resp = client.post(
            "/api/stripe-links",
            data={"name": "LinkToDelete", "url": "https://buy.stripe.com/delete"},
            headers=auth_headers,
        )
        link_id = create_resp.json()["link_id"]

        resp = client.delete(f"/api/stripe-links/{link_id}", headers=auth_headers)

        assert resp.status_code == 200
        assert resp.json()["success"] is True
