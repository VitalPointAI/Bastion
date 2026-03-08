# Whitepaper Assembly Instructions

## Version Control

**Current Version:** v0.1 (Draft)
**Last Updated:** 2026-01-24
**Status:** Initial draft for advisor review

---

## Document Order

Assemble sections in this order:

| # | File | Section |
|---|------|---------|
| 1 | `00-title-page.md` | Title, author, date |
| 2 | `00-abstract.md` | Abstract and keywords |
| 3 | *(auto-generated)* | Table of Contents |
| 4 | `01-introduction.md` | 1. Introduction |
| 5 | `02-background-daos.md` | 2.1 Background: DAOs and Web3 |
| 6 | `02-background-military.md` | 2.2 Background: Military Coordination |
| 7 | `02-background-ai.md` | 2.3 Background: AI in Defense |
| 8 | `03-methodology.md` | 3. Methodology |
| 9 | `04-results.md` | 4. Results |
| 10 | `05-discussion.md` | 5. Discussion |
| 11 | `06-conclusion.md` | 6. Conclusion |
| 12 | `07-references.md` | 7. References (Zotero-generated) |
| 13 | `appendix-a-sitrep.md` | Appendix A: SITREP |
| 14 | `appendix-b-demo-script.md` | Appendix B: Demo Script |

---

## Pre-Assembly Checklist

### Content Completeness
- [x] All sections written
- [ ] All [CITATION NEEDED] placeholders identified and counted
- [x] Cross-references between sections valid
- [x] Research question explicitly answered in Conclusion

### Figures
- [ ] System architecture diagram exported to PNG (300 DPI)
- [ ] Workflow screenshots captured and annotated:
  - Figure 2: Strategic planning dashboard with human-in-the-loop approval
  - Figure 3: Policy constraint flow from strategic to tactical
  - Figure 4: Operational monitoring dashboard showing on-the-loop operation
  - Figure 5: Tactical execution with policy-bound autonomous operations
- [ ] Demo photo captured and labeled (Figure 6)
- [ ] All figures numbered and captioned
- [ ] All figures referenced in text

### Formatting
- [x] Consistent heading levels (# for main sections, ## for subsections)
- [x] Consistent terminology throughout
- [x] Active voice used
- [x] No code snippets (per CONTEXT.md)

### Citations
- [ ] Zotero library populated with all required sources
- [ ] All [CITATION NEEDED] replaced with footnotes
- [ ] Chicago 18th edition (note) format verified
- [ ] Bibliography generated

---

## Assembly Process

### Option A: Pandoc Conversion (Recommended)

1. Navigate to whitepaper directory:
   ```bash
   cd docs/whitepaper
   ```

2. Convert markdown to Word using pandoc:
   ```bash
   pandoc -o whitepaper.docx \
     00-title-page.md \
     00-abstract.md \
     01-introduction.md \
     02-background-daos.md \
     02-background-military.md \
     02-background-ai.md \
     03-methodology.md \
     04-results.md \
     05-discussion.md \
     06-conclusion.md \
     07-references.md \
     appendix-a-sitrep.md \
     appendix-b-demo-script.md
   ```

3. Open `whitepaper.docx` in Microsoft Word

4. Insert figures at designated locations (see Figure placeholders in text)

5. Generate Table of Contents:
   - References > Table of Contents > Automatic Table 2

6. Install Zotero Word plugin (if not already installed)

7. Replace citation placeholders with Zotero citations:
   - Search for `[CITATION NEEDED]` or `[^citation_needed]`
   - For each, click Zotero > Add/Edit Citation
   - Select appropriate source from library

8. Generate bibliography:
   - Navigate to References section
   - Click Zotero > Add/Edit Bibliography
   - Bibliography populates automatically

9. Final formatting:
   - Apply consistent heading styles
   - Adjust page breaks
   - Format figures with captions

### Option B: Manual Assembly

1. Open new Word document
2. Copy/paste each section in order from markdown files
3. Format headings consistently (Heading 1 for sections, Heading 2 for subsections)
4. Insert figures with captions
5. Generate Table of Contents
6. Add citations via Zotero
7. Generate bibliography

---

## Automated Export

### Prerequisites

- **pandoc** (required): `sudo apt install pandoc` or `brew install pandoc`
- **texlive** (for PDF): `sudo apt install texlive-xetex` or `brew install --cask mactex`

### Export Commands

```bash
# Navigate to whitepaper directory
cd docs/whitepaper

# Export to both PDF and DOCX
./scripts/export.sh all

# Export to DOCX only (no LaTeX required)
./scripts/export.sh docx

# Export to PDF only
./scripts/export.sh pdf
```

### Output Location

Exports are saved to `docs/whitepaper/exports/`:
- `BASTION-Whitepaper-v0.1-YYYY-MM-DD.pdf`
- `BASTION-Whitepaper-v0.1-YYYY-MM-DD.docx`

### Customization

- Edit `scripts/export-config.yaml` to change formatting
- Update VERSION in `scripts/export.sh` for new releases

---

## Quality Checks

### Pre-Submission Review
- [ ] Page count in 20-40 range (target: 25-35 pages)
- [ ] Abstract is 150-300 words (confirmed: 279 words)
- [ ] Table of Contents accurate and properly linked
- [ ] All figure references valid (Figures 1-6)
- [ ] All citations present (no orphaned [CITATION NEEDED])
- [ ] Footnote numbering consistent
- [ ] Spelling/grammar check complete
- [ ] PDF export successful and readable

### Academic Standards Verification
- [ ] Research question clearly stated in Introduction
- [ ] Research question explicitly answered in Conclusion
- [ ] Methodology justifies all major design decisions
- [ ] Results support claims made in Introduction
- [ ] Discussion acknowledges limitations honestly
- [ ] Human authority over lethal decisions emphasized throughout

### Advisor Feedback Cycle

1. Submit v0.1 for initial review
2. Receive feedback via track changes
3. Address feedback, increment version
4. Repeat until approved

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| v0.1 | 2026-01-24 | Initial draft - all sections complete |
| v0.2 | 2026-03-08 | Major update: 131 agents, doctrinal tabs, COP, IPB, resource DIDs, training mode, 8 contributions |

---

## File Inventory

Current whitepaper files:

```
docs/whitepaper/
├── README.md                   # Directory overview
├── 00-title-page.md           # Title, author, date
├── 00-abstract.md             # Abstract and keywords
├── 01-introduction.md         # Problem, significance, approach
├── 02-background-daos.md      # DAOs, blockchain, Web3
├── 02-background-military.md  # C2, JADC2, coalitions
├── 02-background-ai.md        # AI in defense, human-machine teaming
├── 03-methodology.md          # Architecture, design decisions
├── 04-results.md              # E2E flow, physical demonstration
├── 05-discussion.md           # Limitations, risks, ethics, future work
├── 06-conclusion.md           # Research question answer
├── 07-references.md           # Bibliography placeholder
├── appendix-a-sitrep.md       # Implementation status
├── appendix-b-demo-script.md  # 20-minute demo script
├── ASSEMBLY.md                # This file
├── scripts/
│   ├── export.sh              # Export script for PDF/DOCX
│   └── export-config.yaml     # Pandoc configuration
└── exports/                   # Generated exports (gitignored)
```

---

**Note:** This is a living document. Update checklist as work progresses toward final submission.
