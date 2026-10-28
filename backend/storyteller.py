import json
import os

from anthropic import Anthropic
from dotenv import load_dotenv
from backend.evidence_validator import validate_evidence
from backend.insight_models import InsightResponse


# Load the Claude API key
load_dotenv("backend/.env")


def generate_insights(statistics: dict) -> InsightResponse:
    """Generate AI insights from verified statistical results."""

    client = Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

    # Give Claude only calculated statistics, not the original CSV
    statistics_json = json.dumps(statistics, indent=2)

    # Define the rules Claude must follow
    system_prompt = """
    You are a careful data analyst working for DataTale.

    Generate meaningful insights from the provided statistical results.

    Rules:
    1. Use ONLY the supplied statistics.
    2. Never invent numbers, relationships, or correlations.
    3. Never claim causation.
    4. Every insight must include supporting evidence.
    5. Evidence must reference an existing column and statistic.
    6. Clearly distinguish observations from interpretations.
    7. Include limitations and uncertainty.
    8. Generate between 1 and 5 insights.
    9. Return valid JSON only, without Markdown formatting.

    JSON structure:
    {
      "dataset_summary": "string",
      "insights": [
        {
          "title": "string",
          "finding": "string",
          "evidence": [
            {
              "column": "string",
              "metric": "string",
              "value": "string"
            }
          ],
          "interpretation": "string",
          "caveat": "string",
          "severity": "info | interesting | warning"
        }
      ],
      "overall_caveats": ["string"]
    }
    """

    # Request insights from Claude
    response = client.messages.create(
        model="claude-sonnet-5-5",
        max_tokens=4096,
        system=system_prompt,
        messages=[
            {
                "role": "user",
                "content": statistics_json,
            }
        ],
    )
    print("Claude stop reason:", response.stop_reason)

    # Extract Claude's response text
    response_text = "".join(
        block.text
        for block in response.content
        if block.type == "text"
    ).strip()

    # Remove Markdown fences if Claude includes them
    if response_text.startswith("```"):
        response_text = response_text.split("\n", 1)[1]
        response_text = response_text.rsplit("```", 1)[0].strip()

    # Parse JSON and validate the response structure
    parsed_response = json.loads(response_text)

    # Validate Claude's JSON structure
    validated_response = InsightResponse.model_validate(parsed_response)

    # Verify every evidence value against Pandas
    #validate_evidence(validated_response, statistics)

    return validated_response