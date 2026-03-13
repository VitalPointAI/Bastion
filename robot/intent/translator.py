"""
Cloud LLM intent translation via instructor library.

Converts natural language mission commands to List[MissionJSON] using a
structured Pydantic output from an OpenAI or Anthropic model. Falls back
transparently to template_translate when instructor is unavailable or no
API key is configured.

Integration testing of the cloud path requires OPENAI_API_KEY or
ANTHROPIC_API_KEY environment variable. Unit tests cover only the fallback
path (see tests/test_intent.py).

Exports:
    IntentTranslator: Class for cloud LLM translation with graceful fallback.
    translate_intent: Module-level convenience wrapper using config settings.
"""

from __future__ import annotations

import asyncio
import logging
from typing import List, Optional

log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# System prompt for the cloud LLM
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = """You are a military mission planning assistant for an autonomous ground robot.
Convert the operator's natural language command into one or more structured mission objects.

Supported commands:
- recon_area: Reconnaissance / survey of a geographic area
- visual_search: Search for a specific target visually
- overwatch: Stationary observation of a position
- resupply_route: Follow a route to deliver or collect supplies
- patrol_route: Patrol a route or perimeter
- find_engage: Locate and engage a target

Return a JSON list of mission objects. Each mission must include:
- mission_id: a new UUID v4 string
- robot_id: as provided
- command: one of the six supported commands
- params: {} (empty unless location/waypoint data is provided)
- issued_by: as provided
- timestamp: current UTC datetime ISO string
- auth_token: empty string

Respond ONLY with valid JSON conforming to the schema. No explanations."""


class IntentTranslator:
    """Cloud LLM intent translator with template fallback.

    Uses the instructor library to get structured Pydantic output from
    OpenAI or Anthropic. If instructor is not installed, or no API key is
    available, silently falls back to template_translate.

    Args:
        api_key: API key for the chosen provider. Defaults to reading from
                 config (OPENAI_API_KEY or ANTHROPIC_API_KEY).
        provider: ``"openai"`` (default) or ``"anthropic"``.
    """

    def __init__(self, api_key: str = "", provider: str = "openai") -> None:
        self._available = False
        self._client = None
        self._provider = provider

        try:
            import instructor  # noqa: F401
        except ImportError:
            log.warning(
                "instructor library not installed — intent translator will use "
                "template fallback only. Install with: pip install instructor"
            )
            return

        # Resolve API key from config if not provided directly
        resolved_key = api_key
        if not resolved_key:
            try:
                import config as cfg

                if provider == "anthropic":
                    resolved_key = cfg.ANTHROPIC_API_KEY
                else:
                    resolved_key = cfg.OPENAI_API_KEY
            except Exception:
                pass

        if not resolved_key:
            log.warning(
                "No API key provided for IntentTranslator (%s). "
                "Set %s env var or pass api_key=. Falling back to templates.",
                provider,
                "ANTHROPIC_API_KEY" if provider == "anthropic" else "OPENAI_API_KEY",
            )
            return

        try:
            import instructor  # noqa: F811

            if provider == "anthropic":
                from anthropic import Anthropic

                self._client = instructor.from_anthropic(Anthropic(api_key=resolved_key))
            else:
                from openai import OpenAI

                self._client = instructor.from_openai(OpenAI(api_key=resolved_key))

            self._available = True
            log.info("IntentTranslator: cloud LLM available (%s)", provider)

        except Exception as exc:  # pragma: no cover
            log.warning(
                "IntentTranslator: failed to create client — falling back to templates. "
                "Error: %s",
                exc,
            )

    @property
    def is_available(self) -> bool:
        """True if the cloud LLM client is configured and ready."""
        return self._available

    async def translate(
        self,
        text: str,
        robot_id: str,
        issued_by: str,
    ) -> List:
        """Translate a natural language command into a list of MissionJSON objects.

        Falls back to template_translate if the cloud client is unavailable or
        raises an error.

        Args:
            text: Natural language command from the operator.
            robot_id: Robot identifier to embed in missions.
            issued_by: Operator identity to embed in missions.

        Returns:
            List of MissionJSON. May be empty if translation fails and the
            template fallback also returns None.
        """
        from models import MissionJSON

        if not self._available or self._client is None:
            return self._template_fallback(text, robot_id, issued_by)

        try:
            missions: List[MissionJSON] = await asyncio.to_thread(
                self._call_llm,
                text,
                robot_id,
                issued_by,
            )
            # Enforce correct robot_id / issued_by on all returned missions
            result = []
            for m in missions:
                result.append(
                    m.model_copy(update={"robot_id": robot_id, "issued_by": issued_by})
                )
            return result

        except Exception as exc:
            log.warning(
                "IntentTranslator: cloud call failed — falling back to templates. "
                "Error: %s",
                exc,
            )
            return self._template_fallback(text, robot_id, issued_by)

    def _call_llm(self, text: str, robot_id: str, issued_by: str) -> List:
        """Synchronous LLM call (runs in a thread via asyncio.to_thread)."""
        from models import MissionJSON
        from typing import List as TList

        return self._client.chat.completions.create(
            model="gpt-4o-mini" if self._provider == "openai" else "claude-3-haiku-20240307",
            response_model=TList[MissionJSON],
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": (
                        f"robot_id={robot_id!r}, issued_by={issued_by!r}\n"
                        f"Command: {text}"
                    ),
                },
            ],
        )

    @staticmethod
    def _template_fallback(text: str, robot_id: str, issued_by: str) -> List:
        """Wrap template_translate result in a list."""
        from intent.fallback import template_translate

        result = template_translate(text, robot_id, issued_by)
        return [result] if result is not None else []


def translate_intent(
    text: str,
    robot_id: str,
    issued_by: str,
    provider: str = "openai",
) -> List:
    """Module-level convenience function for synchronous callers.

    Constructs an IntentTranslator using config settings and runs the
    translation in a new event loop. If the cloud LLM is not configured,
    falls back to template_translate.

    Args:
        text: Natural language command.
        robot_id: Robot identifier.
        issued_by: Operator identity.
        provider: ``"openai"`` or ``"anthropic"``.

    Returns:
        List of MissionJSON (may be empty if no pattern matched).
    """
    translator = IntentTranslator(provider=provider)
    return asyncio.run(translator.translate(text, robot_id, issued_by))
