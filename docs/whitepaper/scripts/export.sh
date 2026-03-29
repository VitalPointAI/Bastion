#!/bin/bash
# Export whitepaper to PDF and DOCX
# Usage: ./export.sh [pdf|docx|all]
# Requires: pandoc, xelatex (for PDF)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WHITEPAPER_DIR="$(dirname "$SCRIPT_DIR")"
OUTPUT_DIR="$WHITEPAPER_DIR/exports"
CONFIG="$SCRIPT_DIR/export-config.yaml"

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Define document order (matches ASSEMBLY.md)
INPUT_FILES=(
  "00-title-page.md"
  "00-abstract.md"
  "01-introduction.md"
  "02-background-daos.md"
  "02-background-military.md"
  "02-background-ai.md"
  "02-background-robotics.md"
  "02-background-knowledge-graphs.md"
  "03-methodology.md"
  "04-results.md"
  "05-discussion.md"
  "06-conclusion.md"
  "07-references.md"
  "appendix-a-sitrep.md"
)

# Build input file list with full paths
INPUTS=""
for file in "${INPUT_FILES[@]}"; do
  INPUTS="$INPUTS $WHITEPAPER_DIR/$file"
done

# Get current date for filename
DATE=$(date +%Y-%m-%d)
VERSION="v0.4"

export_pdf() {
  echo "Exporting to PDF..."
  OUTPUT="$OUTPUT_DIR/BASTION-Whitepaper-${VERSION}-${DATE}.pdf"

  if command -v xelatex &> /dev/null; then
    echo "Using xelatex..."
    pandoc $INPUTS \
      --defaults="$CONFIG" \
      -o "$OUTPUT"
  elif command -v weasyprint &> /dev/null; then
    echo "Using weasyprint (pandoc -> HTML -> PDF)..."
    HTML_TMP="$OUTPUT_DIR/.whitepaper-tmp.html"
    pandoc $INPUTS \
      --defaults="$CONFIG" \
      --embed-resources --standalone \
      --css="$SCRIPT_DIR/print.css" \
      -o "$HTML_TMP"
    weasyprint "$HTML_TMP" "$OUTPUT"
    rm -f "$HTML_TMP"
  else
    echo "No PDF engine found. Install one of:"
    echo "  sudo apt install texlive-xetex   (best quality)"
    echo "  pip install weasyprint            (good alternative)"
    return 1
  fi

  echo "PDF exported: $OUTPUT"
}

export_docx() {
  echo "Exporting to DOCX..."
  OUTPUT="$OUTPUT_DIR/BASTION-Whitepaper-${VERSION}-${DATE}.docx"

  pandoc $INPUTS \
    --defaults="$CONFIG" \
    -o "$OUTPUT"

  echo "DOCX exported: $OUTPUT"
}

# Parse command line argument
case "${1:-all}" in
  pdf)
    export_pdf
    ;;
  docx)
    export_docx
    ;;
  all)
    export_docx
    export_pdf
    ;;
  *)
    echo "Usage: $0 [pdf|docx|all]"
    echo "  pdf  - Export to PDF (requires LaTeX)"
    echo "  docx - Export to Microsoft Word"
    echo "  all  - Export to both formats (default)"
    exit 1
    ;;
esac

echo ""
echo "Exports saved to: $OUTPUT_DIR/"
ls -la "$OUTPUT_DIR/"
