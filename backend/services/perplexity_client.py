import httpx
import json
import os
import logging
from typing import Optional
from dotenv import load_dotenv

from models.schemas import AIAdjustmentRequest, AIAdjustmentResponse

# Load environment variables
load_dotenv()

logger = logging.getLogger(__name__)


class PerplexityClient:
    """
    Simple client wrapper for Perplexity 'sonar' chat endpoint.
    Returns AIAdjustmentResponse (adjustment_pct, rationale, sources).
    """

    # ------------------------------------------------------------------
    # CHANGE 1: Flexible Configuration (from Code 1)
    # ------------------------------------------------------------------
    # The __init__ method is modified to accept a `base_url` argument
    # with a default value. This is better than the hardcoded URL in the
    # original Code 2, as it makes the client more flexible for testing
    # or connecting to different API environments without changing the code.
    def __init__(self, base_url: str = "https://api.perplexity.ai"):
        self.api_key = os.getenv("PERPLEXITY_API_KEY")
        if not self.api_key:
            logger.warning("PERPLEXITY_API_KEY not found in environment; AI adjustments will fallback to 0%")
        self.base_url = base_url
        self.headers = {
            "Authorization": f"Bearer {self.api_key}" if self.api_key else "",
            "Content-Type": "application/json",
        }
    # ------------------------------------------------------------------

    def _build_prompt(self, request: AIAdjustmentRequest) -> (str, str):
        """Build system and user prompt for Perplexity sonar model."""
        freq_units_map = {"D": "days", "W": "weeks", "M": "months"}
        freq_units = freq_units_map.get(request.freq, "periods")

        holidays_text = ", ".join(request.holidays_window) if request.holidays_window else "None"

        # conservative system prompt
        system_prompt = (
            "You are a cautious forecaster. You never see raw sales data. You only output a small "
            "adjustment percentage and a concise rationale. Stay within ±10% total adjustment."
        )

        # user prompt describing context & inputs
        user_prompt = (
            f"We have a short-term {request.freq}-level sales forecast for the {request.industry} sector in "
            f"{request.city or ''}{', ' + request.state if request.state else ''}{', ' + request.country if request.country else ''}.\n"
            f"Horizon: next {request.horizon} {freq_units}.\n\n"
            f"Recent pattern summary (approximate, anonymized):\n"
            f"- Last 4 {freq_units} growth: {request.recent_summary.last4_growth_pct}%\n"
            f"- YoY last comparable period: {request.recent_summary.yoy_last_period_pct}%\n"
            f"- Volatility index (0–1): {request.recent_summary.volatility_index}\n\n"
            f"Upcoming holidays/events in scope: {holidays_text}\n\n"
            "Task:\n"
            "1) Consider macro signals (inflation, consumer confidence, rates, FX, fuel, supply/logistics), major retail events, and weather anomalies.\n"
            "2) Propose one net bounded adjustment in percent (negative for down, positive for up) in the range -20 to +20 applied to the baseline.\n"
            "3) Provide a concise rationale (≤ 60 words) with 2–4 bullet reasons.\n"
            "4) Return STRICT JSON ONLY:\n\n"
            "{\n"
            '  "adjustment_pct": <number between -10 and 10>,\n'
            '  "rationale": "<short paragraph>",\n'
            '  "sources": ["<url1>", "<url2>"]\n'
            "}\n\n"
            "Do not include any other text."
        )

        return system_prompt, user_prompt

    async def get_adjustment(self, request: AIAdjustmentRequest) -> AIAdjustmentResponse:
        """Call Perplexity 'sonar' model and return parsed AIAdjustmentResponse.

        If API key is missing or call fails, returns fallback response with 0% adjustment.
        """
        if not self.api_key:
            logger.info("Perplexity API key not configured — returning fallback 0% adjustment")
            # Using the centralized fallback with a specific reason.
            return self._fallback_response("api_key_missing")

        system_prompt, user_prompt = self._build_prompt(request)

        payload = {
            "model": "sonar",
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": 0.2,
            "max_tokens": 500,
        }

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(f"{self.base_url}/chat/completions", headers=self.headers, json=payload)

            if resp.status_code != 200:
                logger.error(f"Perplexity API returned {resp.status_code}: {resp.text}")
                return self._fallback_response("api_error")

            result = resp.json()
            # Perplexity returns choices -> message -> content (string)
            content = (
                result.get("choices", [{}])[0].get("message", {}).get("content", "")
                if isinstance(result, dict)
                else ""
            )

            if not content:
                logger.error("Perplexity response contained empty content")
                return self._fallback_response("empty_content")

            # Normalize content - sometimes wrapped in code fences
            content = content.strip()
            if content.startswith("```json"):
                content = content.replace("```json", "").replace("```", "").strip()
            elif content.startswith("```"):
                content = content.replace("```", "").strip()
            
            # ------------------------------------------------------------------
            # CHANGE 2: Robust JSON Parsing
            # ------------------------------------------------------------------
            # The original Code 2 used a single `try...except` block that would
            # fail if the API returned any text around the JSON object. This
            # robust two-step parsing logic from Code 1 is now used. It first
            # tries to parse the whole string, and if that fails, it intelligently
            # finds and parses just the JSON object within the string.
            parsed = None
            try:
                parsed = json.loads(content)
            except Exception:
                # try to find first '{' ... '}' substring
                start = content.find("{")
                end = content.rfind("}")
                if start != -1 and end != -1 and end > start:
                    try:
                        parsed = json.loads(content[start : end + 1])
                    except Exception:
                        parsed = None
            # ------------------------------------------------------------------

            if parsed is None or not isinstance(parsed, dict):
                logger.error(f"Failed to parse JSON from Perplexity content: {content}")
                return self._fallback_response("parse_error")


            
            # Extract and validate fields
            # CHANGE 3: Validate and clamp adjustment percentage
            try:
                raw_pct = parsed.get("adjustment_pct", 0)
                adj_pct = float(raw_pct)
            except Exception:
                logger.warning(f"Invalid adjustment_pct in parsed response: {parsed.get('adjustment_pct')}")
                adj_pct = 0.0
            
            adj_pct = max(-20.0, min(20.0, adj_pct))  # Clamp to [-20, 20]


            rationale = parsed.get("rationale", "").strip() or "No concise rationale provided"
            sources = parsed.get("sources", []) if isinstance(parsed.get("sources", []), list) else []

            logger.info(f"Perplexity adjustment parsed: {adj_pct}% | rationale length {len(rationale)} | sources {len(sources)}")

            return AIAdjustmentResponse(
                adjustment_pct=adj_pct,
                rationale=rationale,
                sources=sources,
            )

        except Exception as e:
            logger.exception(f"Perplexity API call failed: {e}")
            return self._fallback_response("exception")

    # ------------------------------------------------------------------
    # CHANGE 3: Centralized and Granular Fallback Logic (from Code 1)
    # ------------------------------------------------------------------
    # This `_fallback_response` method is taken directly from Code 1.
    # It accepts a `reason` string, allowing the calling code to provide
    # specific, context-aware error messages. This is superior to the
    # hardcoded fallback messages in the original Code 2, making debugging
    # much more effective.
    def _fallback_response(self, reason: str) -> AIAdjustmentResponse:
        return AIAdjustmentResponse(
            adjustment_pct=0.0,
            rationale=f"No reliable macro adjustment - {reason}",
            sources=[],
        )
