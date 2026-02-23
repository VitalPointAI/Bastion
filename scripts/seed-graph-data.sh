#!/bin/bash
# Seed script for Strategic Intelligence Fusion dashboard
# Creates sample workspaces, actors, relationships, tensions, and OSINT events
# so you can verify graph/map visualizations are working.
#
# Usage: bash scripts/seed-graph-data.sh

set -e

API="http://localhost:3001/api/graph"
NEO4J_URL="bolt://localhost:7687"
NOW=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

echo "=== Seeding Strategic Intelligence Fusion data ==="

# ────────────────────────────────────────────────────
# 1. Create Workspace
# ────────────────────────────────────────────────────
echo ""
echo "--- Creating workspace ---"
WKS=$(curl -s -X POST "$API/workspaces" \
  -H "Content-Type: application/json" \
  -H "x-did: seed-script" \
  -d '{
    "name": "Indo-Pacific Theater",
    "description": "Strategic analysis of the Indo-Pacific region including major state and non-state actors",
    "type": "region",
    "tags": ["indo-pacific", "great-power-competition", "seed-data"],
    "classification": "SECRET"
  }')
WKS_ID=$(echo "$WKS" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null || echo "")
if [ -z "$WKS_ID" ]; then
  echo "  Failed to create workspace. Response: $WKS"
  echo "  Is the backend running? Try: docker compose ps"
  exit 1
fi
echo "  Created workspace: $WKS_ID"

# ────────────────────────────────────────────────────
# 2. Create Actors via Neo4j Cypher (no REST endpoint)
# ────────────────────────────────────────────────────
echo ""
echo "--- Creating actors in Neo4j ---"

# Use cypher-shell inside the neo4j container
CYPHER="docker exec bastion-neo4j cypher-shell -u neo4j -p password"

# Actor IDs (deterministic for relationship creation)
ACT_USA="ACT-seed-usa"
ACT_CHN="ACT-seed-china"
ACT_RUS="ACT-seed-russia"
ACT_JPN="ACT-seed-japan"
ACT_ASEAN="ACT-seed-asean"
ACT_DPRK="ACT-seed-dprk"
ACT_QUAD="ACT-seed-quad"
ACT_XI="ACT-seed-xi-jinping"

$CYPHER <<CYPHER_EOF
// Create nation actors
CREATE (usa:Actor {
  id: '$ACT_USA', name: 'United States', type: 'nation',
  aliases: ['US', 'USA', 'America'], attributes: '{"region":"North America","gdp_rank":1}',
  workspaceId: '$WKS_ID', sourceDocumentIds: [], createdAt: '$NOW', updatedAt: '$NOW'
});

CREATE (chn:Actor {
  id: '$ACT_CHN', name: 'People\'s Republic of China', type: 'nation',
  aliases: ['China', 'PRC', 'CCP'], attributes: '{"region":"East Asia","gdp_rank":2}',
  workspaceId: '$WKS_ID', sourceDocumentIds: [], createdAt: '$NOW', updatedAt: '$NOW'
});

CREATE (rus:Actor {
  id: '$ACT_RUS', name: 'Russian Federation', type: 'nation',
  aliases: ['Russia', 'RF'], attributes: '{"region":"Eurasia","nuclear_state":true}',
  workspaceId: '$WKS_ID', sourceDocumentIds: [], createdAt: '$NOW', updatedAt: '$NOW'
});

CREATE (jpn:Actor {
  id: '$ACT_JPN', name: 'Japan', type: 'nation',
  aliases: ['JPN'], attributes: '{"region":"East Asia","alliance":"US treaty ally"}',
  workspaceId: '$WKS_ID', sourceDocumentIds: [], createdAt: '$NOW', updatedAt: '$NOW'
});

CREATE (dprk:Actor {
  id: '$ACT_DPRK', name: 'North Korea', type: 'nation',
  aliases: ['DPRK', 'Democratic People\'s Republic of Korea'], attributes: '{"region":"Korean Peninsula","nuclear_state":true}',
  workspaceId: '$WKS_ID', sourceDocumentIds: [], createdAt: '$NOW', updatedAt: '$NOW'
});

// Organization actors
CREATE (asean:Actor {
  id: '$ACT_ASEAN', name: 'ASEAN', type: 'organization',
  aliases: ['Association of Southeast Asian Nations'], attributes: '{"members":10,"founded":1967}',
  workspaceId: '$WKS_ID', sourceDocumentIds: [], createdAt: '$NOW', updatedAt: '$NOW'
});

CREATE (quad:Actor {
  id: '$ACT_QUAD', name: 'Quad Alliance', type: 'organization',
  aliases: ['Quadrilateral Security Dialogue', 'QUAD'], attributes: '{"members":["US","Japan","Australia","India"]}',
  workspaceId: '$WKS_ID', sourceDocumentIds: [], createdAt: '$NOW', updatedAt: '$NOW'
});

// Individual actor
CREATE (xi:Actor {
  id: '$ACT_XI', name: 'Xi Jinping', type: 'individual',
  aliases: ['Chairman Xi', 'President Xi'], attributes: '{"role":"President of PRC","party":"CCP"}',
  workspaceId: '$WKS_ID', sourceDocumentIds: [], createdAt: '$NOW', updatedAt: '$NOW'
});
CYPHER_EOF
echo "  Created 8 actors"

# ────────────────────────────────────────────────────
# 3. Create Relationships
# ────────────────────────────────────────────────────
echo ""
echo "--- Creating relationships ---"

$CYPHER <<CYPHER_EOF
// US-Japan Alliance
MATCH (a:Actor {id: '$ACT_USA'}), (b:Actor {id: '$ACT_JPN'})
CREATE (a)-[:RELATES_TO {
  id: 'REL-seed-us-jpn', type: 'alliance', strength: 0.9,
  description: 'Mutual defense treaty and strategic partnership since 1960',
  evidence: ['US-Japan Security Treaty'], workspaceId: '$WKS_ID',
  sourceDocumentIds: [], createdAt: '$NOW', updatedAt: '$NOW'
}]->(b);

// US-China Competition
MATCH (a:Actor {id: '$ACT_USA'}), (b:Actor {id: '$ACT_CHN'})
CREATE (a)-[:RELATES_TO {
  id: 'REL-seed-us-chn', type: 'competition', strength: -0.6,
  description: 'Strategic competition across military, economic, and technology domains',
  evidence: ['National Security Strategy 2022', 'Indo-Pacific Strategy'], workspaceId: '$WKS_ID',
  sourceDocumentIds: [], createdAt: '$NOW', updatedAt: '$NOW'
}]->(b);

// China-Russia Cooperation
MATCH (a:Actor {id: '$ACT_CHN'}), (b:Actor {id: '$ACT_RUS'})
CREATE (a)-[:RELATES_TO {
  id: 'REL-seed-chn-rus', type: 'cooperation', strength: 0.7,
  description: 'No-limits partnership with military coordination and energy trade',
  evidence: ['2022 Joint Statement'], workspaceId: '$WKS_ID',
  sourceDocumentIds: [], createdAt: '$NOW', updatedAt: '$NOW'
}]->(b);

// China-DPRK Alliance
MATCH (a:Actor {id: '$ACT_CHN'}), (b:Actor {id: '$ACT_DPRK'})
CREATE (a)-[:RELATES_TO {
  id: 'REL-seed-chn-dprk', type: 'alliance', strength: 0.5,
  description: 'Treaty ally with economic lifeline; relationship strained by nuclear tests',
  evidence: ['1961 Mutual Aid Treaty'], workspaceId: '$WKS_ID',
  sourceDocumentIds: [], createdAt: '$NOW', updatedAt: '$NOW'
}]->(b);

// US-DPRK Conflict
MATCH (a:Actor {id: '$ACT_USA'}), (b:Actor {id: '$ACT_DPRK'})
CREATE (a)-[:RELATES_TO {
  id: 'REL-seed-us-dprk', type: 'conflict', strength: -0.8,
  description: 'Ongoing denuclearization standoff with sanctions regime',
  evidence: ['UN Sanctions Resolutions'], workspaceId: '$WKS_ID',
  sourceDocumentIds: [], createdAt: '$NOW', updatedAt: '$NOW'
}]->(b);

// China-ASEAN Dependency
MATCH (a:Actor {id: '$ACT_ASEAN'}), (b:Actor {id: '$ACT_CHN'})
CREATE (a)-[:RELATES_TO {
  id: 'REL-seed-asean-chn', type: 'dependency', strength: 0.3,
  description: 'ASEAN economic dependency on Chinese trade and investment; South China Sea disputes',
  evidence: ['RCEP Agreement', 'South China Sea arbitration'], workspaceId: '$WKS_ID',
  sourceDocumentIds: [], createdAt: '$NOW', updatedAt: '$NOW'
}]->(b);

// Xi Jinping leads China
MATCH (a:Actor {id: '$ACT_XI'}), (b:Actor {id: '$ACT_CHN'})
CREATE (a)-[:RELATES_TO {
  id: 'REL-seed-xi-chn', type: 'cooperation', strength: 1.0,
  description: 'General Secretary of CCP and President — central decision authority',
  evidence: ['CCP Constitution'], workspaceId: '$WKS_ID',
  sourceDocumentIds: [], createdAt: '$NOW', updatedAt: '$NOW'
}]->(b);
CYPHER_EOF
echo "  Created 7 relationships"

# ────────────────────────────────────────────────────
# 4. Create Tensions
# ────────────────────────────────────────────────────
echo ""
echo "--- Creating tensions ---"

$CYPHER <<CYPHER_EOF
// South China Sea tension
CREATE (t:Tension {
  id: 'TEN-seed-scs', description: 'South China Sea territorial disputes — China vs ASEAN claimants',
  intensity: 'high', domain: 'military',
  triggers: ['Chinese island-building', 'Philippine patrol confrontations', 'FONOPs'],
  mitigators: ['ASEAN COC negotiations', 'US deterrence patrols'],
  actorIds: ['$ACT_CHN', '$ACT_ASEAN', '$ACT_USA'],
  linkedObjectiveIds: [], workspaceId: '$WKS_ID',
  sourceDocumentIds: [], createdAt: '$NOW', updatedAt: '$NOW'
});

// Taiwan Strait tension
CREATE (t:Tension {
  id: 'TEN-seed-taiwan', description: 'Taiwan Strait — risk of PRC military action against Taiwan',
  intensity: 'critical', domain: 'military',
  triggers: ['PLA exercises near Taiwan', 'Arms sales to Taiwan', 'High-level visits'],
  mitigators: ['One-China policy ambiguity', 'Economic interdependence', 'US deterrence'],
  actorIds: ['$ACT_CHN', '$ACT_USA', '$ACT_JPN'],
  linkedObjectiveIds: [], workspaceId: '$WKS_ID',
  sourceDocumentIds: [], createdAt: '$NOW', updatedAt: '$NOW'
});

// Technology competition tension
CREATE (t:Tension {
  id: 'TEN-seed-tech', description: 'Technology decoupling — semiconductor export controls and AI competition',
  intensity: 'medium', domain: 'economic',
  triggers: ['Chip export restrictions', 'AI model controls', 'Rare earth supply threats'],
  mitigators: ['Allied coordination (AUKUS, Quad)', 'Diversified supply chains'],
  actorIds: ['$ACT_USA', '$ACT_CHN'],
  linkedObjectiveIds: [], workspaceId: '$WKS_ID',
  sourceDocumentIds: [], createdAt: '$NOW', updatedAt: '$NOW'
});

// Korean Peninsula nuclear tension
CREATE (t:Tension {
  id: 'TEN-seed-korea', description: 'Korean Peninsula nuclear escalation — DPRK ICBM and nuclear testing',
  intensity: 'high', domain: 'military',
  triggers: ['ICBM tests', 'Nuclear tests', 'Military provocations'],
  mitigators: ['Sanctions regime', 'China leverage', 'Extended deterrence'],
  actorIds: ['$ACT_DPRK', '$ACT_USA', '$ACT_JPN'],
  linkedObjectiveIds: [], workspaceId: '$WKS_ID',
  sourceDocumentIds: [], createdAt: '$NOW', updatedAt: '$NOW'
});
CYPHER_EOF
echo "  Created 4 tensions"

# ────────────────────────────────────────────────────
# 5. Create OSINT Events (via REST API)
# ────────────────────────────────────────────────────
echo ""
echo "--- Creating OSINT events ---"

create_event() {
  local result
  result=$(curl -s -X POST "$API/osint/events" \
    -H "Content-Type: application/json" \
    -d "$1")
  local evt_id
  evt_id=$(echo "$result" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null || echo "FAIL")
  echo "  Event: $evt_id"
}

create_event '{
  "title": "PLA Navy conducts large-scale exercises near Taiwan Strait",
  "description": "The PLA Navy deployed 3 carrier strike groups for unprecedented exercises simulating a blockade of Taiwan. The exercises included live-fire drills and anti-submarine warfare training.",
  "sourceType": "news",
  "sourceName": "Reuters",
  "publishedAt": "2026-02-18T08:00:00Z",
  "location": {"name": "Taiwan Strait", "latitude": 24.5, "longitude": 119.5, "region": "East Asia", "country": "China"},
  "actors": ["PRC", "Taiwan", "United States"],
  "tags": ["military", "taiwan", "pla-navy", "exercises"],
  "workspaceId": "'$WKS_ID'"
}'

create_event '{
  "title": "US deploys additional F-35 squadron to Kadena Air Base, Japan",
  "description": "The US Air Force announced the deployment of an additional F-35A Lightning II squadron to Kadena Air Base in Okinawa, increasing combat aircraft presence in the region by 25%.",
  "sourceType": "government",
  "sourceName": "US Pacific Command",
  "publishedAt": "2026-02-19T14:00:00Z",
  "location": {"name": "Kadena Air Base, Okinawa", "latitude": 26.35, "longitude": 127.77, "region": "East Asia", "country": "Japan"},
  "actors": ["United States", "Japan"],
  "tags": ["military", "deployment", "f-35", "japan"],
  "workspaceId": "'$WKS_ID'"
}'

create_event '{
  "title": "China restricts rare earth exports to allied nations",
  "description": "Beijing announced new export controls on gallium, germanium, and antimony to countries participating in semiconductor export restrictions, affecting Japan, South Korea, and the Netherlands.",
  "sourceType": "news",
  "sourceName": "Financial Times",
  "publishedAt": "2026-02-15T10:30:00Z",
  "location": {"name": "Beijing", "latitude": 39.9, "longitude": 116.4, "region": "East Asia", "country": "China"},
  "actors": ["PRC", "Japan"],
  "tags": ["economic", "rare-earth", "export-controls", "technology"],
  "workspaceId": "'$WKS_ID'"
}'

create_event '{
  "title": "DPRK launches ICBM into Sea of Japan",
  "description": "North Korea launched a Hwasong-18 solid-fuel ICBM that traveled approximately 1,100 km before splashing down in Japan EEZ. Japanese PM condemned the launch as a severe provocation.",
  "sourceType": "government",
  "sourceName": "Japan Ministry of Defense",
  "publishedAt": "2026-02-20T03:15:00Z",
  "location": {"name": "Sea of Japan", "latitude": 40.0, "longitude": 135.0, "region": "East Asia", "country": "North Korea"},
  "actors": ["North Korea", "Japan", "United States"],
  "tags": ["military", "icbm", "nuclear", "dprk"],
  "workspaceId": "'$WKS_ID'"
}'

create_event '{
  "title": "Quad leaders summit in Tokyo announces expanded maritime security initiative",
  "description": "Leaders of the US, Japan, Australia, and India agreed to expand joint maritime patrols in the Indo-Pacific and establish a shared maritime domain awareness network.",
  "sourceType": "government",
  "sourceName": "White House",
  "publishedAt": "2026-02-17T09:00:00Z",
  "location": {"name": "Tokyo", "latitude": 35.68, "longitude": 139.69, "region": "East Asia", "country": "Japan"},
  "actors": ["United States", "Japan", "Quad Alliance"],
  "tags": ["diplomacy", "quad", "maritime-security", "indo-pacific"],
  "workspaceId": "'$WKS_ID'"
}'

create_event '{
  "title": "Philippine Coast Guard confrontation with China Maritime Militia near Second Thomas Shoal",
  "description": "Philippine Coast Guard vessels were water-cannoned by Chinese maritime militia during a resupply mission to the BRP Sierra Madre at Second Thomas Shoal. No casualties reported.",
  "sourceType": "social_media",
  "sourceName": "Philippine Coast Guard Twitter",
  "publishedAt": "2026-02-21T06:45:00Z",
  "location": {"name": "Second Thomas Shoal", "latitude": 9.75, "longitude": 115.87, "region": "South China Sea", "country": "Philippines"},
  "actors": ["PRC", "ASEAN"],
  "tags": ["military", "south-china-sea", "philippines", "maritime"],
  "workspaceId": "'$WKS_ID'"
}'

create_event '{
  "title": "Russia-China joint naval patrol through Tsushima Strait",
  "description": "A combined Russian-Chinese naval flotilla of 10 warships transited the Tsushima Strait between Japan and South Korea in a show of force, the third such patrol this year.",
  "sourceType": "news",
  "sourceName": "Nikkei Asia",
  "publishedAt": "2026-02-16T11:00:00Z",
  "location": {"name": "Tsushima Strait", "latitude": 34.0, "longitude": 129.5, "region": "East Asia", "country": "Japan"},
  "actors": ["Russia", "PRC", "Japan"],
  "tags": ["military", "naval", "russia-china", "patrol"],
  "workspaceId": "'$WKS_ID'"
}'

create_event '{
  "title": "ASEAN foreign ministers call for South China Sea Code of Conduct acceleration",
  "description": "ASEAN foreign ministers issued a joint statement urging acceleration of negotiations on a binding Code of Conduct for the South China Sea, citing increased tensions and military confrontations.",
  "sourceType": "government",
  "sourceName": "ASEAN Secretariat",
  "publishedAt": "2026-02-14T08:00:00Z",
  "location": {"name": "Jakarta", "latitude": -6.2, "longitude": 106.85, "region": "Southeast Asia", "country": "Indonesia"},
  "actors": ["ASEAN", "PRC"],
  "tags": ["diplomacy", "south-china-sea", "asean", "code-of-conduct"],
  "workspaceId": "'$WKS_ID'"
}'

echo ""
echo "=== Seed complete ==="
echo ""
echo "Workspace ID: $WKS_ID"
echo "Actors: 8 (5 nations, 2 orgs, 1 individual)"
echo "Relationships: 7"
echo "Tensions: 4"
echo "OSINT Events: 8 (with geographic coordinates for map markers)"
echo ""
echo "Open the app and navigate to Strategic Intelligence to see the data."
echo "Select the 'Indo-Pacific Theater' workspace."
