"""
Unit tests for utils.py — datetime conversion and formatting helpers.
"""

from datetime import datetime

import pytz
import pytest

from utils import (
    convert_to_madrid_time,
    datetime_to_iso_madrid,
    format_datetime_madrid,
    get_madrid_now,
)

_UTC = pytz.UTC
_MADRID_TZ = pytz.timezone("Europe/Madrid")


class TestConvertToMadridTime:
    def test_when_none_input_expect_none(self):
        result = convert_to_madrid_time(None)

        assert result is None

    def test_when_naive_datetime_expect_madrid_tz_aware_result(self):
        naive_dt = datetime(2024, 1, 15, 12, 0, 0)

        result = convert_to_madrid_time(naive_dt)

        assert result is not None
        assert result.tzinfo is not None
        assert result.tzinfo.zone == "Europe/Madrid"

    def test_when_utc_aware_datetime_in_summer_expect_cest_offset(self):
        # 2024-06-15 10:00 UTC → 12:00 CEST (UTC+2)
        utc_dt = datetime(2024, 6, 15, 10, 0, 0, tzinfo=_UTC)

        result = convert_to_madrid_time(utc_dt)

        assert result is not None
        assert result.hour == 12
        assert result.tzinfo.zone == "Europe/Madrid"

    def test_when_non_utc_aware_datetime_expect_converted_to_madrid(self):
        london_tz = pytz.timezone("Europe/London")
        london_dt = london_tz.localize(datetime(2024, 1, 15, 12, 0, 0))

        result = convert_to_madrid_time(london_dt)

        assert result is not None
        assert result.tzinfo.zone == "Europe/Madrid"


class TestFormatDatetimeMadrid:
    def test_when_none_expect_em_dash(self):
        result = format_datetime_madrid(None)

        assert result == "—"

    def test_when_valid_utc_datetime_expect_formatted_string(self):
        utc_dt = datetime(2024, 6, 15, 10, 0, 0, tzinfo=_UTC)

        result = format_datetime_madrid(utc_dt)

        assert result != "—"
        assert "/" in result

    def test_when_custom_format_expect_format_applied(self):
        utc_dt = datetime(2024, 6, 15, 10, 0, 0, tzinfo=_UTC)

        result = format_datetime_madrid(utc_dt, "%Y-%m-%d")

        assert result == "2024-06-15"


class TestDatetimeToIsoMadrid:
    def test_when_none_expect_none(self):
        result = datetime_to_iso_madrid(None)

        assert result is None

    def test_when_valid_utc_datetime_expect_iso_string_with_timezone_offset(self):
        utc_dt = datetime(2024, 6, 15, 10, 0, 0, tzinfo=_UTC)

        result = datetime_to_iso_madrid(utc_dt)

        assert result is not None
        assert "2024-06-15" in result
        # ISO string must carry a UTC offset ('+' or '-')
        assert "+" in result or result.count("-") > 2


class TestGetMadridNow:
    def test_when_called_expect_tz_aware_madrid_datetime(self):
        result = get_madrid_now()

        assert result.tzinfo is not None
        assert result.tzinfo.zone == "Europe/Madrid"
