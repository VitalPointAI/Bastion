# Slide A11: Live Demo Script — Understanding Phase

**Deck:** Decision Overmatch: AI-Augmented Command and Control Through Blockchain Governance
**Slide:** A11 of A17 (Annex)
**Maps to core slides:** 7 (Knowledge as Infrastructure), 3 (opening demo context)
**Date:** 2026-03-26

## Style Reference

| Role | Hex | Tailwind | Usage |
|------|-----|----------|-------|
| Primary Blue | `#2563EB` | blue-600 | Headings, primary UI elements, architecture blocks |
| Sky Blue | `#0EA5E9` | sky-500 | Secondary accents, data flow lines |
| Cyan | `#06B6D4` | cyan-500 | Blockchain/crypto elements, DID references |
| White | `#FFFFFF` | white | All backgrounds |
| Light Gray | `#F8FAFC` | slate-50 | Slide background variant |
| Dark Text | `#0F172A` | slate-900 | Body text |
| Muted Text | `#64748B` | slate-500 | Captions, sub-labels |

**Rule:** Never use dark backgrounds. Never use tactical/military dark aesthetic. BASTION on the second screen provides the tactical visual; the deck is the clean analytical layer.

## Purpose

Step-by-step guided walkthrough for demoing the Understand tab during Q&A. This IS the demo script — the presenter reads from this slide while executing the demo on the second screen.

## Visual

Clean two-column layout. Left column: numbered step list. Right column: screenshot placeholder annotated with what to show at each step. Title: "DEMO: Understanding the Operational Environment"

## Demo Script (follow on second screen)

**Step 1 — Open the Understand tab**
Navigate to the Understand tab. The tab shows the brain graph visualization. Orient the audience: "This is where everything BASTION knows about the operational environment lives."

**Step 2 — Show an empty vs. populated graph**
If starting from scratch: explain that the graph begins empty and grows with every document uploaded. If the Pacific Strategy AY26 scenario is loaded: the graph already has entities from scenario initialization. Show the entity count in the graph header.

**Step 3 — Upload a document (or point to an existing one)**
If live upload: drag a planning document (OPORD fragment, intel report) into the upload zone. Watch the ingestion spinner. When complete, note that the graph node count has increased.
If pre-loaded: navigate to the Documents section and select a previously ingested document. Show the document detail panel.

**Step 4 — Watch entities appear in the graph**
Pan and zoom the brain graph visualization. Identify key entity clusters: units (blue nodes), locations (green nodes), events (red nodes). "Every node you see was extracted automatically from a planning document. No one drew this — the AI built it."

**Step 5 — Click on an entity**
Click on a unit node (e.g., 3rd Battalion or equivalent). Show the entity detail panel: name, type, confidence score, source document link, relationship list.

**Step 6 — Traverse a relationship**
From the entity detail panel, click a relationship to navigate to a linked entity. E.g., from the unit → click LOCATED_AT → navigate to the location node. Show the location's coordinates and the documents that placed the unit there.

**Step 7 — Show the source document link**
Click the source document link on the location entity. Show the original document passage where this location was mentioned. "This is the provenance chain — every piece of knowledge is traceable back to a specific sentence in a specific document."

---
*Speaking script and demo cues: [speaking-script.md](../speaking-script.md)*
*Full deck index: [slide-specs.md](../slide-specs.md)*
