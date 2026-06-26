"""
Unit tests for logging_config.py — _MemHandler in-memory log buffer.
"""

import logging
import threading
import time

import pytest

from logging_config import _MemHandler


def _make_record(msg: str, level: int = logging.INFO, name: str = "test") -> logging.LogRecord:
    """Helper: build a minimal LogRecord for emit() calls."""
    record = logging.LogRecord(
        name=name,
        level=level,
        pathname="",
        lineno=0,
        msg=msg,
        args=(),
        exc_info=None,
    )
    return record


class TestMemHandler:
    def test_when_record_emitted_expect_entry_with_required_keys(self):
        handler = _MemHandler(maxlen=10)
        record = _make_record("hello world", level=logging.WARNING, name="mymod")

        handler.emit(record)

        entries = handler.get()
        assert len(entries) == 1
        entry = entries[0]
        assert set(entry.keys()) == {"ts", "level", "name", "msg"}
        assert entry["level"] == "WARNING"
        assert entry["name"] == "mymod"
        assert entry["msg"] == "hello world"
        assert len(entry["ts"]) > 0

    def test_when_multiple_records_emitted_expect_most_recent_first(self):
        handler = _MemHandler(maxlen=10)

        handler.emit(_make_record("first"))
        handler.emit(_make_record("second"))
        handler.emit(_make_record("third"))

        entries = handler.get()

        assert entries[0]["msg"] == "third"
        assert entries[1]["msg"] == "second"
        assert entries[2]["msg"] == "first"

    def test_when_limit_specified_expect_at_most_limit_entries_returned(self):
        handler = _MemHandler(maxlen=50)
        for i in range(20):
            handler.emit(_make_record(f"msg-{i}"))

        entries = handler.get(limit=5)

        assert len(entries) == 5

    def test_when_buffer_full_expect_oldest_entry_dropped(self):
        handler = _MemHandler(maxlen=3)
        handler.emit(_make_record("oldest"))
        handler.emit(_make_record("middle"))
        handler.emit(_make_record("newest"))

        # Adding one more should evict "oldest"
        handler.emit(_make_record("eviction"))

        entries = handler.get()
        msgs = [e["msg"] for e in entries]
        assert "oldest" not in msgs
        assert "eviction" in msgs
        assert len(entries) == 3

    def test_when_concurrent_emits_expect_no_state_corruption(self):
        handler = _MemHandler(maxlen=500)
        errors: list = []

        def _worker(thread_id: int) -> None:
            try:
                for i in range(50):
                    handler.emit(_make_record(f"t{thread_id}-msg{i}"))
            except Exception as exc:  # pragma: no cover
                errors.append(exc)

        threads = [threading.Thread(target=_worker, args=(t,)) for t in range(10)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        assert errors == [], f"Thread errors: {errors}"
        # 10 threads × 50 records = 500, exactly fills the buffer
        entries = handler.get(limit=500)
        assert len(entries) == 500
