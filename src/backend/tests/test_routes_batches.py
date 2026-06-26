"""
Route tests for /api/batches.
"""


class TestBatchesRoutes:
    def test_when_batch_created_expect_success_and_batch_id(self, client, auth_headers):
        resp = client.post(
            "/api/batches",
            data={"name": "Batch Alpha", "description": "First batch", "order": "1"},
            headers=auth_headers,
        )

        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert "batch_id" in body

    def test_when_duplicate_batch_name_expect_400(self, client, auth_headers):
        client.post("/api/batches", data={"name": "Dupe Batch"}, headers=auth_headers)

        resp = client.post("/api/batches", data={"name": "Dupe Batch"}, headers=auth_headers)

        assert resp.status_code == 400

    def test_when_batches_listed_expect_success_and_batches_key(self, client, auth_headers):
        client.post("/api/batches", data={"name": "Listed Batch"}, headers=auth_headers)

        resp = client.get("/api/batches", headers=auth_headers)

        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert len(body["batches"]) == 1

    def test_when_batch_not_found_by_id_expect_404(self, client, auth_headers):
        resp = client.get("/api/batches/999", headers=auth_headers)

        assert resp.status_code == 404

    def test_when_batch_activated_expect_active_and_schedule_state_set(
        self, client, auth_headers
    ):
        create_resp = client.post(
            "/api/batches", data={"name": "ActivateBatch"}, headers=auth_headers
        )
        batch_id = create_resp.json()["batch_id"]

        resp = client.post(f"/api/batches/{batch_id}/activate", headers=auth_headers)

        assert resp.status_code == 200
        state_resp = client.get("/api/batches/schedule/state", headers=auth_headers)
        state = state_resp.json()["state"]
        assert state is not None
        assert state["current_batch"]["id"] == batch_id
        assert state["current_message_index"] == 0

    def test_when_no_schedule_state_exists_expect_null(self, client, auth_headers):
        resp = client.get("/api/batches/schedule/state", headers=auth_headers)

        assert resp.status_code == 200
        assert resp.json()["state"] is None

    def test_when_batch_deleted_expect_success(self, client, auth_headers):
        create_resp = client.post(
            "/api/batches", data={"name": "BatchToDelete"}, headers=auth_headers
        )
        batch_id = create_resp.json()["batch_id"]

        resp = client.delete(f"/api/batches/{batch_id}", headers=auth_headers)

        assert resp.status_code == 200
        assert resp.json()["success"] is True
