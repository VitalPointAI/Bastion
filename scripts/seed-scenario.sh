#!/bin/bash
# Full scenario seed for BASTION end-to-end validation
# Seeds the "Operation Pacific Shield" scenario in the Indo-Pacific Theater
#
# Prerequisites:
#   - Backend running (docker compose up)
#   - Neo4j running and accessible
#
# Usage: bash scripts/seed-scenario.sh
#
# This script populates data so that every tab/feature in the UI has
# real data to display, enabling full persona-based workflow testing.

set -e

API="${BASTION_API:-http://localhost:3001/api}"
DID_COMMANDER="did:near:radm-chen-commander"
DID_STAFF="did:near:maj-rodriguez-staff"
DID_INTEL="did:near:capt-park-intel"
NOW=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

echo "=============================================="
echo "  BASTION Scenario Seed: Operation Pacific Shield"
echo "=============================================="
echo ""
echo "API: $API"
echo "Date: $NOW"
echo ""

# ────────────────────────────────────────────────────
# Section 1: Graph Data (Indo-Pacific Theater)
# ────────────────────────────────────────────────────
echo "=== Section 1: Graph Data ==="
echo "Running seed-graph-data.sh..."
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
bash "$SCRIPT_DIR/seed-graph-data.sh"
echo ""

# ────────────────────────────────────────────────────
# Section 2: Create Mission
# ────────────────────────────────────────────────────
echo "=== Section 2: Create Mission ==="
echo "--- Creating mission: Operation Pacific Shield ---"
MISSION=$(curl -s -X POST "$API/missions" \
  -H "Content-Type: application/json" \
  -H "X-DID: $DID_COMMANDER" \
  -d '{
    "name": "Operation Pacific Shield",
    "description": "Coalition deterrence operation focused on the Taiwan Strait and South China Sea. Responds to increased PLA Navy activity and DPRK ICBM tests. Objective: maintain freedom of navigation, deter unilateral military action, and strengthen alliance posture.",
    "classification": "SECRET",
    "areaOfOperations": {
      "type": "Polygon",
      "coordinates": [[
        [115.0, 18.0],
        [130.0, 18.0],
        [130.0, 30.0],
        [115.0, 30.0],
        [115.0, 18.0]
      ]]
    }
  }')
MISSION_ID=$(echo "$MISSION" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id', json.load(sys.stdin).get('mission',{}).get('id','')))" 2>/dev/null || echo "")
if [ -z "$MISSION_ID" ]; then
  # Try alternate response shape
  MISSION_ID=$(echo "$MISSION" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('id','') or d.get('mission',{}).get('id',''))" 2>/dev/null || echo "")
fi
if [ -z "$MISSION_ID" ]; then
  echo "  Failed to create mission. Response: $MISSION"
  echo "  Continuing with placeholder ID..."
  MISSION_ID="mission-pacific-shield-001"
fi
echo "  Created mission: $MISSION_ID"

# Create invites for staff and intel personas
echo "--- Creating mission invites ---"
curl -s -X POST "$API/missions/$MISSION_ID/invites" \
  -H "Content-Type: application/json" \
  -H "X-DID: $DID_COMMANDER" \
  -d "{\"role\": \"staff\", \"inviteeDid\": \"$DID_STAFF\"}" > /dev/null 2>&1
echo "  Invited staff planner (MAJ Rodriguez)"

curl -s -X POST "$API/missions/$MISSION_ID/invites" \
  -H "Content-Type: application/json" \
  -H "X-DID: $DID_COMMANDER" \
  -d "{\"role\": \"observer\", \"inviteeDid\": \"$DID_INTEL\"}" > /dev/null 2>&1
echo "  Invited intel analyst (CAPT Park)"

# ────────────────────────────────────────────────────
# Section 3: Command Structure
# ────────────────────────────────────────────────────
echo ""
echo "=== Section 3: Command Structure ==="

# JTF Commander (top level)
JTF_CMD=$(curl -s -X POST "$API/command/units" \
  -H "Content-Type: application/json" \
  -H "X-DID: $DID_COMMANDER" \
  -d "{
    \"missionId\": \"$MISSION_ID\",
    \"name\": \"JTF Pacific Shield\",
    \"sidc\": \"SFGPUCF---H----\",
    \"location\": {\"latitude\": 26.35, \"longitude\": 127.77}
  }")
JTF_ID=$(echo "$JTF_CMD" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null || echo "jtf-001")
echo "  Created JTF HQ: $JTF_ID"

# Component Commands
NAVFOR=$(curl -s -X POST "$API/command/units" \
  -H "Content-Type: application/json" \
  -H "X-DID: $DID_COMMANDER" \
  -d "{
    \"missionId\": \"$MISSION_ID\",
    \"name\": \"NAVFOR (Naval Forces)\",
    \"sidc\": \"SFGPUCFN--H----\",
    \"location\": {\"latitude\": 25.0, \"longitude\": 122.0}
  }")
NAVFOR_ID=$(echo "$NAVFOR" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null || echo "navfor-001")
echo "  Created NAVFOR: $NAVFOR_ID"

AIRFOR=$(curl -s -X POST "$API/command/units" \
  -H "Content-Type: application/json" \
  -H "X-DID: $DID_COMMANDER" \
  -d "{
    \"missionId\": \"$MISSION_ID\",
    \"name\": \"AIRFOR (Air Forces)\",
    \"sidc\": \"SFGPUCFA--H----\",
    \"location\": {\"latitude\": 26.35, \"longitude\": 127.77}
  }")
AIRFOR_ID=$(echo "$AIRFOR" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null || echo "airfor-001")
echo "  Created AIRFOR: $AIRFOR_ID"

SPECOPS=$(curl -s -X POST "$API/command/units" \
  -H "Content-Type: application/json" \
  -H "X-DID: $DID_COMMANDER" \
  -d "{
    \"missionId\": \"$MISSION_ID\",
    \"name\": \"SOCFOR (Special Operations)\",
    \"sidc\": \"SFGPUCSF--H----\",
    \"location\": {\"latitude\": 24.5, \"longitude\": 121.0}
  }")
SPECOPS_ID=$(echo "$SPECOPS" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null || echo "specops-001")
echo "  Created SOCFOR: $SPECOPS_ID"

# Subordinate Units
CSG=$(curl -s -X POST "$API/command/units" \
  -H "Content-Type: application/json" \
  -H "X-DID: $DID_COMMANDER" \
  -d "{
    \"missionId\": \"$MISSION_ID\",
    \"name\": \"CSG-7 (Carrier Strike Group 7)\",
    \"sidc\": \"SFGPUCFN--G----\",
    \"location\": {\"latitude\": 24.0, \"longitude\": 123.0}
  }")
CSG_ID=$(echo "$CSG" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null || echo "csg-001")
echo "  Created CSG-7: $CSG_ID"

DDG=$(curl -s -X POST "$API/command/units" \
  -H "Content-Type: application/json" \
  -H "X-DID: $DID_COMMANDER" \
  -d "{
    \"missionId\": \"$MISSION_ID\",
    \"name\": \"DESRON 15 (Destroyer Squadron)\",
    \"sidc\": \"SFGPUCFN--F----\",
    \"location\": {\"latitude\": 25.5, \"longitude\": 125.0}
  }")
DDG_ID=$(echo "$DDG" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null || echo "ddg-001")
echo "  Created DESRON 15: $DDG_ID"

F35_SQ=$(curl -s -X POST "$API/command/units" \
  -H "Content-Type: application/json" \
  -H "X-DID: $DID_COMMANDER" \
  -d "{
    \"missionId\": \"$MISSION_ID\",
    \"name\": \"VAQ-34 (F-35A Squadron)\",
    \"sidc\": \"SFGPUCFA--F----\",
    \"location\": {\"latitude\": 26.35, \"longitude\": 127.77}
  }")
F35_ID=$(echo "$F35_SQ" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null || echo "f35-001")
echo "  Created F-35 Squadron: $F35_ID"

UAV=$(curl -s -X POST "$API/command/units" \
  -H "Content-Type: application/json" \
  -H "X-DID: $DID_COMMANDER" \
  -d "{
    \"missionId\": \"$MISSION_ID\",
    \"name\": \"VUQ-1 (MQ-9 Drone Wing)\",
    \"sidc\": \"SFGPUCFRMU-----\",
    \"location\": {\"latitude\": 26.0, \"longitude\": 128.0}
  }")
UAV_ID=$(echo "$UAV" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null || echo "uav-001")
echo "  Created Drone Wing: $UAV_ID"

# Command Relationships
echo "--- Creating command relationships ---"
for UNIT_PAIR in "$NAVFOR_ID:OPCON" "$AIRFOR_ID:OPCON" "$SPECOPS_ID:TACON"; do
  SUB_ID="${UNIT_PAIR%%:*}"
  REL_TYPE="${UNIT_PAIR##*:}"
  curl -s -X POST "$API/command/relationships" \
    -H "Content-Type: application/json" \
    -H "X-DID: $DID_COMMANDER" \
    -d "{
      \"missionId\": \"$MISSION_ID\",
      \"superiorUnitId\": \"$JTF_ID\",
      \"subordinateUnitId\": \"$SUB_ID\",
      \"relationshipType\": \"$REL_TYPE\"
    }" > /dev/null 2>&1
done

# NAVFOR subordinates
for UNIT_PAIR in "$CSG_ID:OPCON" "$DDG_ID:OPCON"; do
  SUB_ID="${UNIT_PAIR%%:*}"
  REL_TYPE="${UNIT_PAIR##*:}"
  curl -s -X POST "$API/command/relationships" \
    -H "Content-Type: application/json" \
    -H "X-DID: $DID_COMMANDER" \
    -d "{
      \"missionId\": \"$MISSION_ID\",
      \"superiorUnitId\": \"$NAVFOR_ID\",
      \"subordinateUnitId\": \"$SUB_ID\",
      \"relationshipType\": \"$REL_TYPE\"
    }" > /dev/null 2>&1
done

# AIRFOR subordinates
for UNIT_PAIR in "$F35_ID:OPCON" "$UAV_ID:TACON"; do
  SUB_ID="${UNIT_PAIR%%:*}"
  REL_TYPE="${UNIT_PAIR##*:}"
  curl -s -X POST "$API/command/relationships" \
    -H "Content-Type: application/json" \
    -H "X-DID: $DID_COMMANDER" \
    -d "{
      \"missionId\": \"$MISSION_ID\",
      \"superiorUnitId\": \"$AIRFOR_ID\",
      \"subordinateUnitId\": \"$SUB_ID\",
      \"relationshipType\": \"$REL_TYPE\"
    }" > /dev/null 2>&1
done
echo "  Created 7 command relationships"

# ────────────────────────────────────────────────────
# Section 4: Resources
# ────────────────────────────────────────────────────
echo ""
echo "=== Section 4: Resources ==="

create_resource() {
  local result
  result=$(curl -s -X POST "$API/resources" \
    -H "Content-Type: application/json" \
    -H "X-DID: $DID_COMMANDER" \
    -d "$1")
  local id
  id=$(echo "$result" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null || echo "")
  echo "  Resource: $id"
}

echo "--- Creating equipment ---"
create_resource "{
  \"missionId\": \"$MISSION_ID\",
  \"name\": \"USS Ronald Reagan (CVN-76)\",
  \"category\": \"vessel\",
  \"status\": \"FMC\",
  \"specifications\": {\"type\": \"Nimitz-class aircraft carrier\", \"displacement\": \"100000 tons\", \"aircraft\": 90},
  \"sidc\": \"SFSPCLCV--M----\"
}"

create_resource "{
  \"missionId\": \"$MISSION_ID\",
  \"name\": \"USS Mustin (DDG-89)\",
  \"category\": \"vessel\",
  \"status\": \"FMC\",
  \"specifications\": {\"type\": \"Arleigh Burke-class destroyer\", \"displacement\": \"9200 tons\", \"missiles\": 96},
  \"sidc\": \"SFSPCLDD--M----\"
}"

create_resource "{
  \"missionId\": \"$MISSION_ID\",
  \"name\": \"USS Shiloh (CG-67)\",
  \"category\": \"vessel\",
  \"status\": \"PMC\",
  \"specifications\": {\"type\": \"Ticonderoga-class cruiser\", \"displacement\": \"9800 tons\", \"note\": \"Radar maintenance scheduled\"},
  \"sidc\": \"SFSPCLCC--M----\"
}"

create_resource "{
  \"missionId\": \"$MISSION_ID\",
  \"name\": \"F-35A Lightning II (x24)\",
  \"category\": \"aircraft\",
  \"status\": \"FMC\",
  \"specifications\": {\"type\": \"5th-gen multirole fighter\", \"quantity\": 24, \"base\": \"Kadena AB\"},
  \"sidc\": \"SFAPMFF---M----\"
}"

create_resource "{
  \"missionId\": \"$MISSION_ID\",
  \"name\": \"MQ-9B Reaper (x12)\",
  \"category\": \"aircraft\",
  \"status\": \"FMC\",
  \"specifications\": {\"type\": \"MALE UAS\", \"quantity\": 12, \"endurance\": \"27 hours\", \"payload\": \"1700 kg\"},
  \"sidc\": \"SFAPMFRQ--M----\"
}"

create_resource "{
  \"missionId\": \"$MISSION_ID\",
  \"name\": \"P-8A Poseidon (x4)\",
  \"category\": \"aircraft\",
  \"status\": \"FMC\",
  \"specifications\": {\"type\": \"Maritime patrol aircraft\", \"quantity\": 4, \"sonobuoys\": 120},
  \"sidc\": \"SFAPMFP---M----\"
}"

echo "--- Creating personnel ---"
create_personnel() {
  curl -s -X POST "$API/resources/personnel" \
    -H "Content-Type: application/json" \
    -H "X-DID: $DID_COMMANDER" \
    -d "$1" > /dev/null 2>&1
}

create_personnel "{\"missionId\": \"$MISSION_ID\", \"name\": \"RADM David Chen\", \"rank\": \"O-7\", \"specialty\": \"Surface Warfare\", \"readinessStatus\": \"deployable\", \"clearanceLevel\": \"TS/SCI\"}"
create_personnel "{\"missionId\": \"$MISSION_ID\", \"name\": \"CAPT Sarah Mitchell\", \"rank\": \"O-6\", \"specialty\": \"Naval Aviation\", \"readinessStatus\": \"deployable\", \"clearanceLevel\": \"TS/SCI\"}"
create_personnel "{\"missionId\": \"$MISSION_ID\", \"name\": \"MAJ Carlos Rodriguez\", \"rank\": \"O-4\", \"specialty\": \"Operations Planning\", \"readinessStatus\": \"deployable\", \"clearanceLevel\": \"SECRET\"}"
create_personnel "{\"missionId\": \"$MISSION_ID\", \"name\": \"CAPT Ji-Won Park\", \"rank\": \"O-3\", \"specialty\": \"Intelligence Analysis\", \"readinessStatus\": \"deployable\", \"clearanceLevel\": \"TS/SCI\"}"
create_personnel "{\"missionId\": \"$MISSION_ID\", \"name\": \"CDR James Wilson\", \"rank\": \"O-5\", \"specialty\": \"Submarine Warfare\", \"readinessStatus\": \"deployable\", \"clearanceLevel\": \"TS/SCI\"}"
create_personnel "{\"missionId\": \"$MISSION_ID\", \"name\": \"LT Emma Torres\", \"rank\": \"O-3\", \"specialty\": \"Electronic Warfare\", \"readinessStatus\": \"deployable\", \"clearanceLevel\": \"SECRET\"}"
create_personnel "{\"missionId\": \"$MISSION_ID\", \"name\": \"LCDR Raj Patel\", \"rank\": \"O-4\", \"specialty\": \"Cyber Operations\", \"readinessStatus\": \"deployable\", \"clearanceLevel\": \"TS/SCI\"}"
create_personnel "{\"missionId\": \"$MISSION_ID\", \"name\": \"MAJ Thomas Baker\", \"rank\": \"O-4\", \"specialty\": \"Fighter Pilot\", \"readinessStatus\": \"deployable\", \"clearanceLevel\": \"SECRET\"}"
echo "  Created 8 personnel records"

echo "--- Creating consumables ---"
create_consumable() {
  curl -s -X POST "$API/resources/consumables" \
    -H "Content-Type: application/json" \
    -H "X-DID: $DID_COMMANDER" \
    -d "$1" > /dev/null 2>&1
}

create_consumable "{\"missionId\": \"$MISSION_ID\", \"category\": \"fuel\", \"name\": \"JP-5 Aviation Fuel\", \"quantity\": 2400000, \"unit\": \"gallons\", \"minimumLevel\": 600000, \"currentLevel\": 2100000}"
create_consumable "{\"missionId\": \"$MISSION_ID\", \"category\": \"ammunition\", \"name\": \"AIM-120D AMRAAM\", \"quantity\": 96, \"unit\": \"missiles\", \"minimumLevel\": 24, \"currentLevel\": 84}"
create_consumable "{\"missionId\": \"$MISSION_ID\", \"category\": \"ammunition\", \"name\": \"Mk 48 Torpedo\", \"quantity\": 24, \"unit\": \"torpedoes\", \"minimumLevel\": 8, \"currentLevel\": 22}"
create_consumable "{\"missionId\": \"$MISSION_ID\", \"category\": \"ammunition\", \"name\": \"SM-6 Standard Missile\", \"quantity\": 64, \"unit\": \"missiles\", \"minimumLevel\": 16, \"currentLevel\": 58}"
create_consumable "{\"missionId\": \"$MISSION_ID\", \"category\": \"medical\", \"name\": \"Combat Trauma Kits\", \"quantity\": 500, \"unit\": \"kits\", \"minimumLevel\": 100, \"currentLevel\": 480}"
create_consumable "{\"missionId\": \"$MISSION_ID\", \"category\": \"rations\", \"name\": \"MRE Cases\", \"quantity\": 3000, \"unit\": \"cases\", \"minimumLevel\": 500, \"currentLevel\": 2800}"
echo "  Created 6 consumable records"

# ────────────────────────────────────────────────────
# Section 5: Operational Plan with COAs
# ────────────────────────────────────────────────────
echo ""
echo "=== Section 5: Operational Plan ==="

PLAN=$(curl -s -X POST "$API/planning/plans" \
  -H "Content-Type: application/json" \
  -H "X-DID: $DID_COMMANDER" \
  -d "{
    \"missionId\": \"$MISSION_ID\",
    \"name\": \"OPLAN Pacific Shield\",
    \"description\": \"Operational plan for coalition deterrence in the Taiwan Strait and South China Sea. Establishes naval presence, air superiority posture, and ISR coverage to deter PRC unilateral military action.\"
  }")
PLAN_ID=$(echo "$PLAN" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null || echo "")
if [ -z "$PLAN_ID" ]; then
  echo "  Failed to create plan. Response: $PLAN"
  PLAN_ID="plan-pacific-shield-001"
fi
echo "  Created plan: $PLAN_ID"

echo "--- Creating Courses of Action ---"
COA1=$(curl -s -X POST "$API/planning/plans/$PLAN_ID/coas" \
  -H "Content-Type: application/json" \
  -H "X-DID: $DID_COMMANDER" \
  -d "{
    \"planId\": \"$PLAN_ID\",
    \"name\": \"COA 1: Forward Presence\",
    \"description\": \"Establish persistent naval presence in Taiwan Strait with CSG patrol rotation. Maintain F-35 combat air patrols from Kadena. Continuous MQ-9 ISR coverage of PLA Navy ports.\",
    \"tasks\": [
      {\"name\": \"Deploy CSG-7 to Taiwan Strait patrol zone\", \"assignedUnit\": \"NAVFOR\"},
      {\"name\": \"Establish 24/7 CAP coverage from Kadena AB\", \"assignedUnit\": \"AIRFOR\"},
      {\"name\": \"Position MQ-9 ISR orbits over PLA Navy bases\", \"assignedUnit\": \"AIRFOR\"},
      {\"name\": \"Conduct FONOPs through South China Sea\", \"assignedUnit\": \"NAVFOR\"}
    ]
  }")
COA1_ID=$(echo "$COA1" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null || echo "coa-1")
echo "  Created COA 1: Forward Presence ($COA1_ID)"

COA2=$(curl -s -X POST "$API/planning/plans/$PLAN_ID/coas" \
  -H "Content-Type: application/json" \
  -H "X-DID: $DID_COMMANDER" \
  -d "{
    \"planId\": \"$PLAN_ID\",
    \"name\": \"COA 2: Distributed Deterrence\",
    \"description\": \"Distribute forces across multiple bases and sea lanes to complicate PRC targeting. Leverage Quad alliance for layered maritime domain awareness. Pre-position logistics for rapid surge.\",
    \"tasks\": [
      {\"name\": \"Disperse naval assets to multiple operating areas\", \"assignedUnit\": \"NAVFOR\"},
      {\"name\": \"Establish joint Quad maritime patrol schedule\", \"assignedUnit\": \"JTF\"},
      {\"name\": \"Pre-position fuel and ammunition at forward locations\", \"assignedUnit\": \"Logistics\"},
      {\"name\": \"Deploy undersea sensor network in key chokepoints\", \"assignedUnit\": \"SPECOPS\"}
    ]
  }")
COA2_ID=$(echo "$COA2" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null || echo "coa-2")
echo "  Created COA 2: Distributed Deterrence ($COA2_ID)"

COA3=$(curl -s -X POST "$API/planning/plans/$PLAN_ID/coas" \
  -H "Content-Type: application/json" \
  -H "X-DID: $DID_COMMANDER" \
  -d "{
    \"planId\": \"$PLAN_ID\",
    \"name\": \"COA 3: Active Defense\",
    \"description\": \"Establish defensive zones around key maritime chokepoints with layered ISR and rapid response posture. Integrate allied naval forces for combined ASW and AAW operations.\",
    \"tasks\": [
      {\"name\": \"Establish ADIZ coverage over Taiwan Strait\", \"assignedUnit\": \"AIRFOR\"},
      {\"name\": \"Deploy ASW pickets at Luzon and Miyako Straits\", \"assignedUnit\": \"NAVFOR\"},
      {\"name\": \"Integrate Japanese MSDF for combined AAW\", \"assignedUnit\": \"NAVFOR\"},
      {\"name\": \"Position SPECOPS for intelligence collection on PLA activity\", \"assignedUnit\": \"SOCFOR\"}
    ]
  }")
COA3_ID=$(echo "$COA3" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null || echo "coa-3")
echo "  Created COA 3: Active Defense ($COA3_ID)"

# Advance workflow to COA development step
echo "--- Advancing workflow to COA Development ---"
curl -s -X POST "$API/planning/plans/$PLAN_ID/workflow/events" \
  -H "Content-Type: application/json" \
  -H "X-DID: $DID_COMMANDER" \
  -d '{"type": "START_STEP", "step": "planning_initiation"}' > /dev/null 2>&1

curl -s -X POST "$API/planning/plans/$PLAN_ID/workflow/events" \
  -H "Content-Type: application/json" \
  -H "X-DID: $DID_COMMANDER" \
  -d '{"type": "COMPLETE_STEP"}' > /dev/null 2>&1

curl -s -X POST "$API/planning/plans/$PLAN_ID/workflow/events" \
  -H "Content-Type: application/json" \
  -H "X-DID: $DID_COMMANDER" \
  -d '{"type": "START_STEP", "step": "mission_analysis"}' > /dev/null 2>&1

curl -s -X POST "$API/planning/plans/$PLAN_ID/workflow/events" \
  -H "Content-Type: application/json" \
  -H "X-DID: $DID_COMMANDER" \
  -d '{"type": "COMPLETE_STEP"}' > /dev/null 2>&1

curl -s -X POST "$API/planning/plans/$PLAN_ID/workflow/events" \
  -H "Content-Type: application/json" \
  -H "X-DID: $DID_COMMANDER" \
  -d '{"type": "START_STEP", "step": "coa_development"}' > /dev/null 2>&1
echo "  Workflow at COA Development step"

# ────────────────────────────────────────────────────
# Section 6: MDMP Workflow
# ────────────────────────────────────────────────────
echo ""
echo "=== Section 6: MDMP Workflow ==="

MDMP=$(curl -s -X POST "$API/mdmp/workflows" \
  -H "Content-Type: application/json" \
  -H "X-DID: $DID_COMMANDER" \
  -d "{
    \"missionId\": \"$MISSION_ID\",
    \"daoId\": \"indopac-coalition.bastion.near\",
    \"createdBy\": \"$DID_COMMANDER\"
  }")
echo "  Created MDMP workflow"

# Register Phase 0 and Phase 1 gates
curl -s -X POST "$API/mdmp/workflows/$MISSION_ID/gates" \
  -H "Content-Type: application/json" \
  -H "X-DID: $DID_COMMANDER" \
  -d '{"phase": "phase_0_continuous"}' > /dev/null 2>&1

curl -s -X POST "$API/mdmp/workflows/$MISSION_ID/gates" \
  -H "Content-Type: application/json" \
  -H "X-DID: $DID_COMMANDER" \
  -d '{"phase": "phase_1_receipt_of_mission"}' > /dev/null 2>&1

curl -s -X POST "$API/mdmp/workflows/$MISSION_ID/gates" \
  -H "Content-Type: application/json" \
  -H "X-DID: $DID_COMMANDER" \
  -d '{"phase": "phase_2_mission_analysis"}' > /dev/null 2>&1
echo "  Registered phase gates"

# Create assumptions
echo "--- Creating planning assumptions ---"
curl -s -X POST "$API/mdmp/workflows/$MISSION_ID/assumptions" \
  -H "Content-Type: application/json" \
  -H "X-DID: $DID_COMMANDER" \
  -d '{"description": "PRC will not initiate kinetic action against Taiwan during the operation timeframe", "source": "Intelligence assessment J2"}' > /dev/null 2>&1

curl -s -X POST "$API/mdmp/workflows/$MISSION_ID/assumptions" \
  -H "Content-Type: application/json" \
  -H "X-DID: $DID_COMMANDER" \
  -d '{"description": "Japan will permit basing operations from Kadena and Yokosuka for the duration of the operation", "source": "Status of Forces Agreement review"}' > /dev/null 2>&1

curl -s -X POST "$API/mdmp/workflows/$MISSION_ID/assumptions" \
  -H "Content-Type: application/json" \
  -H "X-DID: $DID_COMMANDER" \
  -d '{"description": "Coalition logistics chain through Guam and Okinawa remains uninterrupted", "source": "J4 logistics assessment"}' > /dev/null 2>&1
echo "  Created 3 planning assumptions"

# ────────────────────────────────────────────────────
# Summary
# ────────────────────────────────────────────────────
echo ""
echo "=============================================="
echo "  Scenario Seed Complete"
echo "=============================================="
echo ""
echo "  Mission:          Operation Pacific Shield ($MISSION_ID)"
echo "  Plan:             OPLAN Pacific Shield ($PLAN_ID)"
echo "  COAs:             3 (Forward Presence, Distributed Deterrence, Active Defense)"
echo "  Units:            8 (JTF HQ + 3 components + 4 subordinate)"
echo "  Relationships:    7 command relationships"
echo "  Resources:        6 equipment, 8 personnel, 6 consumables"
echo "  MDMP:             Workflow initialized with 3 assumptions"
echo "  Graph:            8 actors, 7 relationships, 4 tensions, 8 OSINT events"
echo ""
echo "  Personas:"
echo "    Commander:  $DID_COMMANDER"
echo "    Staff:      $DID_STAFF"
echo "    Intel:      $DID_INTEL"
echo ""
echo "  Note: DAO governance uses mock data (set VITE_USE_MOCK_DATA=true in frontend .env)"
echo "  Open the app to navigate the seeded scenario."
echo ""
