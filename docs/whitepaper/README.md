# Research Whitepaper: Decision Overmatch

This directory contains the academic whitepaper for the BASTION project, documenting the research for the master's strategic research requirement.

## Document Structure

The whitepaper is organized as numbered markdown files for git-friendly version control:

| File | Section | Description |
|------|---------|-------------|
| `00-title-page.md` | Title Page | Document metadata, title, author, version |
| `01-introduction.md` | Introduction | Problem framing, research question, contribution summary |
| `02-background.md` | Background | Web3/DAOs, military coordination, AI in defense |
| `03-methodology.md` | Methodology | BASTION architecture, design decisions |
| `04-results.md` | Results | End-to-end flow, demonstration outcomes |
| `05-discussion.md` | Discussion | Analysis, limitations, future work |
| `06-conclusion.md` | Conclusion | Summary of findings, implications |
| `07-references.md` | References | Bibliography in Chicago 18th edition format |
| `appendix-a-sitrep.md` | Appendix A | Current implementation status report |

### Figures Directory

The `figures/` directory contains:
- System architecture diagrams
- Workflow screenshots
- Physical demonstration photos
- Data flow visualizations

## Citation Format

All citations use **Chicago Manual of Style, 18th Edition** footnote format.

Example footnote:
```
1. Author Name, "Article Title," Journal Name 12, no. 3 (2025): 45-67.
```

Example bibliography entry:
```
Name, Author. "Article Title." Journal Name 12, no. 3 (2025): 45-67.
```

## Compilation Instructions

### Reading Order

For review, read the numbered files in sequence (00 through 07), then appendices.

### Export to Word

To compile into a single Word document for advisor review:

1. **Manual assembly:** Copy each section's content into a Word document in order
2. **Formatting:** Apply appropriate heading styles (H1 for section titles, H2 for subsections)
3. **Figures:** Insert images from `figures/` directory at marked locations
4. **Table of Contents:** Generate automatically from heading styles
5. **Page numbers:** Add to footer

Alternatively, use Pandoc for automated conversion:
```bash
# Concatenate all sections and convert to docx
cat 00-title-page.md 01-introduction.md 02-background.md 03-methodology.md \
    04-results.md 05-discussion.md 06-conclusion.md 07-references.md \
    appendix-a-sitrep.md | \
    pandoc -f markdown -t docx -o decision-overmatch-v0.1.docx
```

## Version Control

- **Repository:** All whitepaper files are git-tracked
- **Version numbering:** Semantic versioning in document metadata (v0.1, v0.2, etc.)
- **Change tracking:** Use git history for detailed change tracking
- **Branches:** Major revisions may use feature branches

### Current Version

See `00-title-page.md` metadata for current document version.

## Working Title

**Decision Overmatch: Accelerating Military Advantage with AI-Augmented Decentralized Autonomous Organizations**

## Research Question

> How can interconnected, AI-augmented Decentralized Autonomous Organizations (DAOs) provide a secure, transparent, and resilient governance framework that enables effective C2, accelerates decision-making, optimizes resource management, and supports autonomous, policy-compliant coordination across diverse national and organizational boundaries?

---

*Whitepaper directory created: 2026-01-24*
*Author: Aaron Luhning*
