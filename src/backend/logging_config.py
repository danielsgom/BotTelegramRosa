"""
Centralized logging configuration for BotTelegramRosa.
Sets up format, in-memory buffer handler, and exposes setup_logging().
"""

import logging
import threading
from collections import deque


class _MemHandler(logging.Handler):
    """Thread-safe in-memory ring buffer that stores the last N log entries."""

    def __init__(self, maxlen: int = 500):
        super().__init__()
        self._buf: deque = deque(maxlen=maxlen)
        self._lock = threading.Lock()

    def emit(self, record: logging.LogRecord) -> None:
        from datetime import datetime
        with self._lock:
            self._buf.appendleft({
                "ts":    datetime.fromtimestamp(record.created).strftime("%H:%M:%S"),
                "level": record.levelname,
                "name":  record.name,
                "msg":   record.getMessage(),
            })

    def get(self, limit: int = 200) -> list:
        with self._lock:
            return list(self._buf)[:limit]


# Singleton — imported by routes/logs.py and main.py
mem_handler = _MemHandler()
mem_handler.setLevel(logging.DEBUG)


def setup_logging() -> None:
    """Configure root logger with module-aware format and attach the memory handler."""
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] [%(name)s] %(message)s",
        datefmt="%H:%M:%S",
    )
    logging.getLogger().addHandler(mem_handler)
