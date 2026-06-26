"""
Unit tests for dependencies.py — verify_api_token and get_full_file_url.
"""

import pytest
from fastapi import HTTPException
from unittest.mock import MagicMock

from dependencies import get_full_file_url, verify_api_token


class TestVerifyApiToken:
    def test_when_valid_token_expect_token_returned(self):
        mock_request = MagicMock()
        mock_request.headers.get.return_value = "admin123"

        result = verify_api_token(mock_request)

        assert result == "admin123"

    def test_when_token_missing_expect_401_unauthorized(self):
        mock_request = MagicMock()
        mock_request.headers.get.return_value = None

        with pytest.raises(HTTPException) as exc_info:
            verify_api_token(mock_request)

        assert exc_info.value.status_code == 401

    def test_when_wrong_token_expect_401_unauthorized(self):
        mock_request = MagicMock()
        mock_request.headers.get.return_value = "completely-wrong-token"

        with pytest.raises(HTTPException) as exc_info:
            verify_api_token(mock_request)

        assert exc_info.value.status_code == 401


class TestGetFullFileUrl:
    @pytest.mark.parametrize("empty_value", [None, ""], ids=["none", "empty_string"])
    def test_when_falsy_path_expect_original_value_returned(self, empty_value):
        result = get_full_file_url(empty_value)

        assert result == empty_value

    def test_when_http_url_expect_passthrough(self):
        url = "http://cdn.example.com/images/photo.jpg"

        result = get_full_file_url(url)

        assert result == url

    def test_when_https_url_expect_passthrough(self):
        url = "https://cdn.example.com/images/photo.jpg"

        result = get_full_file_url(url)

        assert result == url

    def test_when_absolute_path_expect_server_url_prepended(self):
        result = get_full_file_url("/uploads/photo.jpg")

        assert result == "http://localhost:8000/uploads/photo.jpg"

    def test_when_relative_path_expect_server_url_with_uploads_prefix(self):
        result = get_full_file_url("photo.jpg")

        assert result == "http://localhost:8000/uploads/photo.jpg"
