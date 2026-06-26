"""
Route tests for /api/logs.
"""

import logging

from logging_config import mem_handler


def _emit(msg: str, level: int = logging.INFO) -> None:
    """Emit a record directly to the global mem_handler used by the route."""
    record = logging.LogRecord(
        name="test.logger",
        level=level,
        pathname="",
        lineno=0,
        msg=msg,
        args=(),
        exc_info=None,
    )
    mem_handler.emit(record)


class TestLogsRoutes:
    def test_when_logs_requested_expect_success_and_logs_list(self, client, auth_headers):
        resp = client.get("/api/logs", headers=auth_headers)

        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert isinstance(body["logs"], list)

    def test_when_limit_param_set_expect_at_most_that_many_entries(
        self, client, auth_headers
    ):
        for i in range(10):
            _emit(f"entry-{i}")

        resp = client.get("/api/logs?limit=3", headers=auth_headers)

        assert resp.status_code == 200
        assert len(resp.json()["logs"]) <= 3

    def test_when_level_filter_applied_expect_only_matching_entries(
        self, client, auth_headers
    ):
        _emit("info message", level=logging.INFO)
        _emit("error message", level=logging.ERROR)

        resp = client.get("/api/logs?level=ERROR", headers=auth_headers)

        assert resp.status_code == 200
        entries = resp.json()["logs"]
        assert all(e["level"] == "ERROR" for e in entries)
