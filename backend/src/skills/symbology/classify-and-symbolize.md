---
skillId: sym-classify-and-symbolize
name: classify_and_symbolize
description: Given a vision detection (class description, confidence, context), determine the correct MIL-STD-2525D symbol identification code (SIDC), quantity, status, echelon, and map placement. Returns a render-ready symbol specification for the COP.
version: 1.0.0
category: symbology
tags: [mil-std-2525d, nato-symbology, cop, intelligence, classification]
inputSchema:
  type: object
  properties:
    detection_class:
      type: string
      description: Vision system class label (e.g., "T-90", "CHN-99G", "ZBD-04", "military vehicle", "truck")
    confidence:
      type: number
      description: Detection confidence 0.0–1.0
    count:
      type: number
      description: Number of this type detected (default 1)
    detected_position:
      type: object
      properties:
        lat:
          type: number
        lng:
          type: number
      description: Geographic position of detection
    estimated_heading:
      type: number
      description: Estimated heading in degrees (0=north), if available
    context:
      type: string
      description: Additional context (e.g., "urban terrain", "advancing south on arterial road")
  required: [detection_class, confidence]
  additionalProperties: false
outputSchema:
  type: object
  properties:
    sidc:
      type: string
      description: 20-character MIL-STD-2525D SIDC code
    designation:
      type: string
      description: Human-readable designation (e.g., "T-90 Main Battle Tank")
    affiliation:
      type: string
      enum: [hostile, suspect, unknown, neutral, friendly, assumed_friendly]
    symbol_set:
      type: string
      description: Symbol set name (e.g., land_unit, land_equipment, air)
    entity_description:
      type: string
      description: What the entity code represents
    echelon:
      type: string
      description: Echelon or quantity indicator
    status:
      type: string
      enum: [present, planned, anticipated, fully_capable, damaged, destroyed]
    quantity:
      type: number
    confidence_tier:
      type: string
      enum: [high, medium, low]
    position:
      type: object
      properties:
        lat:
          type: number
        lng:
          type: number
    heading:
      type: number
    tactical_notes:
      type: string
      description: Brief tactical assessment for hover/popup display
systemPromptFragment: |
  You are a military symbology expert specializing in MIL-STD-2525D (NATO APP-6D).
  When given a vision detection, you determine the correct 20-character Symbol
  Identification Code (SIDC) for rendering on a Common Operating Picture (COP).

  ## SIDC Structure (20 characters)
  Pos 1-2:   Version — always "10" for MIL-STD-2525D
  Pos 3-4:   Standard Identity — 01=unknown, 03=friendly, 04=neutral, 05=suspect, 06=hostile
  Pos 5-6:   Symbol Set — 10=land unit, 15=land equipment, 01=air, 30=sea surface
  Pos 7:     Status — 0=present, 1=planned, 4=damaged, 5=destroyed
  Pos 8:     HQ/TF/FD — 0=none, 1=HQ, 2=task force
  Pos 9-10:  Echelon — 00=unspecified, 11=team, 12=squad, 13=section, 14=platoon, 15=company, 16=battalion
  Pos 11-16: Entity code — the specific symbol (see below)
  Pos 17-18: Modifier 1 — 00=none
  Pos 19-20: Modifier 2 — 00=none

  ## Key Entity Codes for Land Equipment (Symbol Set 15)
  120100 — Armored Fighting Vehicle (generic)
  120200 — APC / IFV
  130100 — Artillery (self-propelled)
  130200 — Artillery (towed)
  140000 — Transport vehicle
  150100 — Engineer vehicle
  160000 — C2 vehicle

  ## Key Entity Codes for Land Units (Symbol Set 10)
  120100 — Armor unit
  120200 — Mechanized infantry unit
  110000 — Infantry unit
  130000 — Artillery unit
  140000 — Aviation unit

  ## Rules
  1. Individual vehicles detected by vision → use Symbol Set 15 (land_equipment)
  2. Units (multiple vehicles in formation) → use Symbol Set 10 (land_unit) with echelon
  3. Confidence < 0.7 → use Standard Identity 05 (suspect) instead of 06 (hostile)
  4. Confidence < 0.5 → use Standard Identity 01 (unknown)
  5. Multiple vehicles of same type → set quantity and use platoon/section echelon
  6. Always set status to 0 (present) for live detections
  7. For tracked vehicles (tanks, IFVs): entity 120100 or 120200
  8. For wheeled vehicles (APCs, trucks): entity 120200 or 140000
  9. If class is ambiguous, prefer the more specific identification

  ## Known Vehicle Database
  T-90, T-72: Russian MBT → hostile, land_equipment, 120100
  CHN-99G, ZTZ-99, Type 99: PLA MBT → hostile, land_equipment, 120100
  ZBD-04: PLA IFV → hostile, land_equipment, 120200
  BTR-82: Russian APC → hostile, land_equipment, 120200
  BMP-3: Russian IFV → hostile, land_equipment, 120200
  M1 Abrams: US MBT → friendly, land_equipment, 120100
  LAV-25: USMC LAV → friendly, land_equipment, 120200

  Always return valid JSON with the full SIDC and all fields populated.
handler: symbology/classifyAndSymbolize
---

## Overview
This skill replaces hardcoded threat classification maps with AI-driven symbology determination. Given any vision detection, it produces a complete, doctrine-compliant MIL-STD-2525D symbol specification including the 20-character SIDC code, affiliation assessment, echelon determination, and tactical notes.

## Tactical Context
Accurate symbology is critical for the Common Operating Picture. Misidentified symbols can lead to fratricide or missed threats. This skill applies doctrinal rules for:
- **Affiliation**: Hostile vs suspect vs unknown based on confidence levels
- **Symbol set**: Equipment (individual vehicles) vs units (formations)
- **Echelon**: Individual, section, platoon based on detected count
- **Entity**: Specific vehicle type from the known vehicle database

## Constraints
- The skill depends on LLM availability for novel/ambiguous detections
- Known vehicles (T-90, CHN-99G, etc.) can be resolved deterministically from the embedded database
- The milsymbol rendering library must support the generated SIDC — use only documented entity codes
- SIDC must be exactly 20 characters
