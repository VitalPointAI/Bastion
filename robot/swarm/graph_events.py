"""
Swarm event graph helpers for brain graph write path.

Provides deterministic event ID generation with 5-second dedup window,
and JSON-LD assertion building with PROV-O national provenance tags.

Used by the robot agent to pre-build assertions before sending to backend,
and by the backend swarm-graph-writer for MERGE-based Neo4j event creation.
"""
import math
from datetime import datetime, timezone


# Dedup window in seconds — events within same window share the same ID
_DEDUP_WINDOW_SECONDS = 5

# Bastion ontology context
_BASTION_CONTEXT = "https://bastion.vitalpoint.ai/ontology/context.jsonld"


def build_swarm_event_id(
    swarm_id: str,
    event_type: str,
    timestamp: "datetime | str",
) -> str:
    """
    Build a deterministic event ID with 5-second dedup window.

    Events with the same swarm_id and event_type within the same
    5-second window produce identical IDs — prevents duplicate Neo4j nodes
    when multiple robots report the same event nearly simultaneously.

    Args:
        swarm_id: Swarm identifier (e.g. "swarm-alpha")
        event_type: Event type string (e.g. "swarm_detection")
        timestamp: datetime object or ISO string

    Returns:
        Deterministic event ID string e.g. "EVT-swarm-alpha-swarm_detection-1710590400"
    """
    if isinstance(timestamp, str):
        timestamp = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))

    # Convert to epoch seconds and round to 5-second window
    epoch_seconds = int(timestamp.replace(tzinfo=timezone.utc).timestamp()
                        if timestamp.tzinfo is None
                        else timestamp.timestamp())
    rounded = math.floor(epoch_seconds / _DEDUP_WINDOW_SECONDS) * _DEDUP_WINDOW_SECONDS

    return f"EVT-{swarm_id}-{event_type}-{rounded}"


def build_swarm_event_assertion(event: dict) -> dict:
    """
    Build a JSON-LD assertion dict for a swarm event.

    Includes PROV-O provenance fields (prov:wasAttributedTo set to national DID)
    for coalition information filtering. Used by robot agent to pre-build
    assertions before sending to backend.

    Args:
        event: Dict with keys: swarm_id, event_type, timestamp, national_did,
               and optional payload fields (detections, members, etc.)

    Returns:
        JSON-LD assertion dict with @context, @type, prov fields, and bastion fields
    """
    swarm_id = event.get("swarm_id", "")
    event_type = event.get("event_type", "")
    timestamp = event.get("timestamp", "")
    national_did = event.get("national_did", "")

    # Build event ID for @id field
    event_id = build_swarm_event_id(swarm_id, event_type, timestamp) if timestamp else ""

    assertion = {
        "@context": {
            "prov": "http://www.w3.org/ns/prov#",
            "xsd": "http://www.w3.org/2001/XMLSchema#",
            "bastion": _BASTION_CONTEXT,
            "cco": "http://www.ontologyrepository.com/CommonCoreOntologies/",
        },
        "@type": "prov:Entity",
        "@id": event_id,
        "prov:wasAttributedTo": {"@id": national_did},
        "prov:generatedAtTime": timestamp,
        "bastion:eventType": event_type,
        "bastion:swarmId": swarm_id,
    }

    # Include optional payload fields
    if "detections" in event:
        assertion["bastion:detections"] = event["detections"]
    if "members" in event:
        assertion["bastion:members"] = event["members"]

    return assertion
