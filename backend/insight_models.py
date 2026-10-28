from typing import Literal

from pydantic import BaseModel, Field


# One statistic supporting an AI-generated finding
class InsightEvidence(BaseModel):
    column: str
    metric: str
    value: str


# One AI-generated insight
class DataInsight(BaseModel):
    title: str = Field(min_length=5, max_length=120)

    finding: str = Field(min_length=10)

    evidence: list[InsightEvidence] = Field(min_length=1)

    interpretation: str = Field(min_length=10)

    caveat: str = Field(min_length=5)

    severity: Literal["info", "interesting", "warning"]


# Complete AI storytelling response
class InsightResponse(BaseModel):
    dataset_summary: str = Field(min_length=20)

    insights: list[DataInsight] = Field(
        min_length=1,
        max_length=5,
    )

    overall_caveats: list[str] = Field(
        default_factory=list
    )