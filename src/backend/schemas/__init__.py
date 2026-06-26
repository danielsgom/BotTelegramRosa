"""
Pydantic schemas for Message Blocks (JSON body endpoints).
Form-based endpoints do not need Pydantic request models.
"""

from typing import List, Optional
from pydantic import BaseModel


class BlockStepInput(BaseModel):
    step_order: int
    text_es: str
    text_en: str
    text_pt: str


class CreateBlockInput(BaseModel):
    name: str
    description: Optional[str] = None
    category: Optional[str] = None
    steps: List[BlockStepInput]
