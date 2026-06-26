"""
Route tests for GET /api/admin/stripe-links (read-only admin view).
"""


class TestAdminStripeLinksRoutes:
    def test_when_no_links_exist_expect_empty_list(self, client, auth_headers):
        resp = client.get("/api/admin/stripe-links", headers=auth_headers)

        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert isinstance(body["links"], list)

    def test_when_links_exist_expect_list_with_required_fields(self, client, auth_headers):
        client.post(
            "/api/stripe-links",
            data={"name": "AdminViewLink", "url": "https://buy.stripe.com/admin"},
            headers=auth_headers,
        )

        resp = client.get("/api/admin/stripe-links", headers=auth_headers)

        assert resp.status_code == 200
        links = resp.json()["links"]
        assert len(links) == 1
        link = links[0]
        assert "id" in link
        assert link["name"] == "AdminViewLink"
        assert link["url"] == "https://buy.stripe.com/admin"
