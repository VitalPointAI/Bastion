---
skillId: tac-assess-threat
name: assess_threat_capability
description: Assess a detected threat vehicle's capabilities including weapon systems, armor class, speed, crew, and recommended engagement tactics. Returns threat level and force ratio assessment.
version: 1.0.0
category: tactical
tags: [threat-assessment, intelligence, engagement, force-ratio]
inputSchema:
  type: object
  properties:
    threat_type:
      type: string
      description: Detected threat classification (e.g., T-90, CHN-99G, ZBD-04, BTR-82)
    count:
      type: number
      description: Number of threats detected
  required: [threat_type, count]
  additionalProperties: false
outputSchema:
  type: object
  properties:
    threat_type:
      type: string
    classification:
      type: string
    count:
      type: number
    capabilities:
      type: object
    threat_level:
      type: string
      enum: [HIGH, MEDIUM, LOW]
    engagement_tactics:
      type: array
      items:
        type: string
    force_ratio_assessment:
      type: string
systemPromptFragment: |
  You can assess enemy vehicle capabilities using assess_threat_capability.
  Always assess detected threats before planning engagement. The skill returns
  weapon ranges, armor ratings, speed, and specific engagement tactics.
  Use the threat_level and force_ratio_assessment to decide whether to
  engage, observe, or withdraw.
handler: tactical/assessThreat
---

## Overview
Provides detailed capability assessment for detected threat vehicles against a knowledge base of known armored vehicle types. Returns technical specifications (weapons, armor, speed, weight, crew), an overall threat level rating, specific engagement tactics, and a force ratio assessment based on detected count.

## Tactical Context
Threat assessment is critical before any engagement decision. Knowing what you're facing determines:
- **Engagement range**: Stay outside the enemy's effective weapons range
- **Weapon selection**: Match your fires to the enemy's armor class
- **Tactical approach**: Frontal vs flanking based on armor coverage
- **Force ratio**: Whether you have enough combat power to engage or should observe/report

## Knowledge Base
Currently covers:
- **T-90**: Russian MBT, composite + Kontakt-5 ERA, 125mm smoothbore
- **CHN-99G (ZTZ-99G)**: PLA advanced MBT, FY-4 ERA + APS, 125mm gun
- **ZBD-04**: PLA IFV, 100mm gun/launcher + 30mm autocannon
- **BTR-82**: Russian APC, 30mm autocannon, wheeled

Unknown types are assessed as MBT-equivalent (worst case).

## Constraints
- Knowledge base is static — does not account for field modifications or upgrades
- Assessment is per-type, not per-specific-vehicle
- Does not account for combined arms effects (infantry dismounts, air support)
