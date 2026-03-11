"""Pydantic schemas for the debate system."""
from pydantic import BaseModel, Field, computed_field
from typing import Optional
from enum import Enum


class Speaker(str, Enum):
    """Debate participant roles."""
    MODERATOR = "moderator"
    PRO = "pro"
    CON = "con"
    JUDGE = "judge"


class DebateEntry(BaseModel):
    """A single entry in the debate transcript."""
    speaker: Speaker
    text: str
    round_number: int = 0


class JudgeScores(BaseModel):
    """Scores from the judge's evaluation rubric."""
    logical_consistency: int = Field(ge=1, le=10, description="1-10")
    evidence_strength: int = Field(ge=1, le=10, description="1-10")
    rebuttal_effectiveness: int = Field(ge=1, le=10, description="1-10")
    clarity: int = Field(ge=1, le=10, description="1-10")
    
    @computed_field
    @property
    def total(self) -> int:
        return (
            self.logical_consistency 
            + self.evidence_strength 
            + self.rebuttal_effectiveness 
            + self.clarity
        )


class JudgeVerdict(BaseModel):
    """Full judge evaluation output."""
    winner: Speaker  # PRO or CON
    pro_scores: JudgeScores
    con_scores: JudgeScores
    reasoning: str


class DebateRequest(BaseModel):
    """Request to start a new debate."""
    topic: str = Field(..., min_length=5, description="The debate topic")
    image_base64: Optional[str] = Field(None, description="Base64 image - debate based on this")
    document_text: Optional[str] = Field(None, description="Document text - debate based on this")
    document_base64: Optional[str] = Field(None, description="Base64 PDF - text will be extracted")
    num_rounds: Optional[int] = Field(2, ge=1, le=5, description="Debate rounds (1=opening only, 2=+1 rebuttal, etc.)")
    num_judges: Optional[int] = Field(1, ge=1, le=3, description="Number of judges (1-3); verdicts are aggregated")


class DebateResponse(BaseModel):
    """Complete debate result."""
    topic: str
    transcript: list[DebateEntry]
    verdict: Optional[JudgeVerdict] = None
