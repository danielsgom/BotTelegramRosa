"""
Route tests for /api/admin/message-blocks.
"""

from typing import List, Optional

_VALID_STEP = {"step_order": 1, "text_es": "Hola", "text_en": "Hello", "text_pt": "Olá"}


def _block_payload(name: str, steps: Optional[List[dict]] = None) -> dict:
    return {"name": name, "steps": steps if steps is not None else [_VALID_STEP]}


class TestAdminMessageBlocksRoutes:
    def test_when_no_blocks_expect_empty_list(self, client, auth_headers):
        resp = client.get("/api/admin/message-blocks", headers=auth_headers)

        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert body["blocks"] == []

    def test_when_block_created_with_steps_expect_block_id_returned(
        self, client, auth_headers
    ):
        payload = _block_payload("Onboarding Pack")

        resp = client.post("/api/admin/message-blocks", json=payload, headers=auth_headers)

        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert "block_id" in body

    def test_when_block_not_found_by_id_expect_404(self, client, auth_headers):
        resp = client.get("/api/admin/message-blocks/999", headers=auth_headers)

        assert resp.status_code == 404

    def test_when_block_updated_expect_name_and_steps_replaced(self, client, auth_headers):
        create_resp = client.post(
            "/api/admin/message-blocks",
            json=_block_payload("OriginalName"),
            headers=auth_headers,
        )
        block_id = create_resp.json()["block_id"]

        updated_payload = {
            "name": "UpdatedName",
            "steps": [
                {"step_order": 1, "text_es": "Nuevo1", "text_en": "New1", "text_pt": "Novo1"},
                {"step_order": 2, "text_es": "Nuevo2", "text_en": "New2", "text_pt": "Novo2"},
            ],
        }
        resp = client.put(
            f"/api/admin/message-blocks/{block_id}",
            json=updated_payload,
            headers=auth_headers,
        )

        assert resp.status_code == 200
        detail_resp = client.get(
            f"/api/admin/message-blocks/{block_id}", headers=auth_headers
        )
        block = detail_resp.json()["block"]
        assert block["name"] == "UpdatedName"
        assert len(block["steps"]) == 2

    def test_when_block_deleted_expect_success(self, client, auth_headers):
        create_resp = client.post(
            "/api/admin/message-blocks",
            json=_block_payload("BlockToDelete"),
            headers=auth_headers,
        )
        block_id = create_resp.json()["block_id"]

        resp = client.delete(
            f"/api/admin/message-blocks/{block_id}", headers=auth_headers
        )

        assert resp.status_code == 200
        assert resp.json()["success"] is True
        confirm = client.get(
            f"/api/admin/message-blocks/{block_id}", headers=auth_headers
        )
        assert confirm.status_code == 404
