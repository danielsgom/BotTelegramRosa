"""
Unit tests for schemas/__init__.py — BlockStepInput and CreateBlockInput Pydantic models.
"""

import pytest
from pydantic import ValidationError

from schemas import BlockStepInput, CreateBlockInput


class TestBlockStepInput:
    def test_when_all_fields_provided_expect_successful_creation(self):
        result = BlockStepInput(
            step_order=1,
            text_es="Hola mundo",
            text_en="Hello world",
            text_pt="Olá mundo",
        )

        assert result.step_order == 1
        assert result.text_es == "Hola mundo"
        assert result.text_en == "Hello world"
        assert result.text_pt == "Olá mundo"

    @pytest.mark.parametrize(
        "missing_field",
        ["step_order", "text_es", "text_en", "text_pt"],
        ids=["missing_step_order", "missing_text_es", "missing_text_en", "missing_text_pt"],
    )
    def test_when_required_field_missing_expect_validation_error(self, missing_field):
        data = {
            "step_order": 1,
            "text_es": "Hola",
            "text_en": "Hello",
            "text_pt": "Olá",
        }
        del data[missing_field]

        with pytest.raises(ValidationError):
            BlockStepInput(**data)


class TestCreateBlockInput:
    def test_when_valid_data_with_steps_expect_successful_creation(self):
        steps = [BlockStepInput(step_order=1, text_es="Hola", text_en="Hello", text_pt="Olá")]

        result = CreateBlockInput(
            name="Welcome Pack",
            description="First contact block",
            category="onboarding",
            steps=steps,
        )

        assert result.name == "Welcome Pack"
        assert result.description == "First contact block"
        assert result.category == "onboarding"
        assert len(result.steps) == 1

    def test_when_steps_list_is_empty_expect_no_validation_error(self):
        result = CreateBlockInput(name="Empty Block", steps=[])

        assert result.name == "Empty Block"
        assert result.steps == []

    def test_when_optional_fields_omitted_expect_none_defaults(self):
        result = CreateBlockInput(name="Minimal", steps=[])

        assert result.description is None
        assert result.category is None

    def test_when_name_missing_expect_validation_error(self):
        with pytest.raises(ValidationError):
            CreateBlockInput(steps=[])
