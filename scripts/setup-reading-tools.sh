#!/usr/bin/env bash
# Reading tools for imports (M3): poppler renders pages, MuPDF reads the text layer with fonts,
# Tesseract reads scanned pages in Arabic and English. Called by setup.sh; safe to re-run.
set -euo pipefail
if ! command -v mutool >/dev/null || ! command -v tesseract >/dev/null || ! command -v pdftoppm >/dev/null; then
  DEBIAN_FRONTEND=noninteractive apt-get install -y -qq -o DPkg::Lock::Timeout=300 \
    poppler-utils mupdf-tools tesseract-ocr tesseract-ocr-ara tesseract-ocr-eng
fi
