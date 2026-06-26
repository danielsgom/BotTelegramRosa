"""
Route tests for /api/admin/predefined-assets.
"""


class TestAdminAssetsRoutes:
    def test_when_no_assets_expect_empty_list(self, client, auth_headers):
        resp = client.get("/api/admin/predefined-assets", headers=auth_headers)

        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert body["assets"] == []

    def test_when_duplicate_asset_name_expect_400(self, client, auth_headers):
        client.post(
            "/api/admin/predefined-assets",
            data={"name": "SharedAsset", "asset_type": "link", "link_url": "https://example.com"},
            headers=auth_headers,
        )

        resp = client.post(
            "/api/admin/predefined-assets",
            data={"name": "SharedAsset", "asset_type": "link", "link_url": "https://other.com"},
            headers=auth_headers,
        )

        assert resp.status_code == 400

    def test_when_delete_nonexistent_asset_expect_404(self, client, auth_headers):
        resp = client.delete("/api/admin/predefined-assets/999", headers=auth_headers)

        assert resp.status_code == 404

    def test_when_asset_created_and_listed_expect_asset_present(self, client, auth_headers):
        client.post(
            "/api/admin/predefined-assets",
            data={
                "name": "PromoLink",
                "asset_type": "link",
                "link_url": "https://promo.example.com",
                "category": "promo",
            },
            headers=auth_headers,
        )

        resp = client.get("/api/admin/predefined-assets", headers=auth_headers)

        assert resp.status_code == 200
        assets = resp.json()["assets"]
        assert len(assets) == 1
        assert assets[0]["name"] == "PromoLink"
        assert assets[0]["asset_type"] == "link"
