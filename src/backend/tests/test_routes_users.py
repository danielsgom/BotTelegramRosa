"""
Route tests for /api/users.
"""

from database import User


class TestUsersRoutes:
    def test_when_no_users_expect_empty_list(self, client, auth_headers):
        resp = client.get("/api/users", headers=auth_headers)

        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert body["users"] == []

    def test_when_user_not_found_by_id_expect_404(self, client, auth_headers):
        resp = client.get("/api/users/999", headers=auth_headers)

        assert resp.status_code == 404

    def test_when_user_exists_expect_user_data_returned(self, client, test_db, auth_headers):
        user = User(telegram_id=100001, first_name="Alice", language="es")
        test_db.add(user)
        test_db.commit()
        user_id = user.id

        resp = client.get(f"/api/users/{user_id}", headers=auth_headers)

        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert body["user"]["telegram_id"] == 100001
        assert body["user"]["first_name"] == "Alice"

    def test_when_user_deleted_expect_is_active_false(self, client, test_db, auth_headers):
        user = User(telegram_id=100002, first_name="Bob")
        test_db.add(user)
        test_db.commit()
        user_id = user.id

        resp = client.delete(f"/api/users/{user_id}", headers=auth_headers)

        assert resp.status_code == 200
        test_db.expire_all()
        updated = test_db.query(User).filter(User.id == user_id).first()
        assert updated.is_active is False

    def test_when_resume_sequence_expect_vip_fields_cleared(self, client, test_db, auth_headers):
        from datetime import datetime

        user = User(
            telegram_id=100003,
            first_name="VipUser",
            is_vip=True,
            vip_expires_at=datetime(2030, 1, 1),
            current_message_step=7,
        )
        test_db.add(user)
        test_db.commit()
        user_id = user.id

        resp = client.post(f"/api/users/{user_id}/resume-sequence", headers=auth_headers)

        assert resp.status_code == 200
        test_db.expire_all()
        updated = test_db.query(User).filter(User.id == user_id).first()
        assert updated.is_vip is False
        assert updated.vip_expires_at is None
        assert updated.current_message_step == 0
