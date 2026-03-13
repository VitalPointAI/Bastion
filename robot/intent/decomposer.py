"""
Strategic objective decomposer.

Splits complex multi-part operator objectives into individual MissionJSON
commands. When a cloud LLM translator is available, the full objective is
passed to it directly (the LLM handles decomposition natively). When offline,
a heuristic sentence-splitting approach is used with template_translate.

Exports:
    decompose_objective: Split an objective into a list of MissionJSON.
"""

from __future__ import annotations

import re
from typing import List, Optional, TYPE_CHECKING

if TYPE_CHECKING:
    from intent.translator import IntentTranslator

# Conjunctions that signal a compound objective
_COMPOUND_RE = re.compile(
    r"\bthen\b|\band\b|\bfollowed\s+by\b|\bafterwards?\b|\bnext\b",
    re.I,
)

# Split on conjunction words or numbered steps like "1." / "1)"
_SPLIT_RE = re.compile(
    r"\s*(?:,?\s*(?:then|and|followed\s+by|afterwards?|next)\s+|[,;]\s+|\d+[.)]\s+)",
    re.I,
)


def decompose_objective(
    objective: str,
    robot_id: str,
    issued_by: str,
    translator: Optional["IntentTranslator"] = None,
) -> List:
    """Decompose a strategic objective into a list of MissionJSON commands.

    For simple objectives (single clause, no compound conjunctions), the
    objective is translated directly. For compound objectives, each clause is
    translated independently and the results are concatenated in order.

    When a cloud translator is provided and available, the full objective is
    passed to the LLM — which handles decomposition natively and returns one
    or more missions. The local heuristic is only used in offline mode.

    Args:
        objective: Natural language objective (may be multi-part).
        robot_id: Robot identifier to embed in returned missions.
        issued_by: Operator identity to embed in returned missions.
        translator: Optional IntentTranslator. If provided and available, the
                    LLM path is used. If None or unavailable, falls back to
                    the local template heuristic.

    Returns:
        Ordered list of MissionJSON. May be empty if no parts matched.
    """
    import asyncio
    from intent.fallback import template_translate

    # If cloud translator is available, delegate entirely to LLM
    if translator is not None and translator.is_available:
        return asyncio.run(translator.translate(objective, robot_id, issued_by))

    # --- Offline heuristic path ---

    is_compound = bool(_COMPOUND_RE.search(objective))

    if not is_compound:
        # Simple single-clause objective — translate directly
        result = template_translate(objective, robot_id, issued_by)
        return [result] if result is not None else []

    # Split into clauses and translate each independently
    parts = _SPLIT_RE.split(objective)
    missions = []
    for part in parts:
        part = part.strip()
        if not part:
            continue
        result = template_translate(part, robot_id, issued_by)
        if result is not None:
            missions.append(result)

    return missions
