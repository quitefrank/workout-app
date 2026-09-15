#!/usr/bin/env python3
"""Dump a PDF's pages to JSON for the programme converters.

    python3 scripts/extract-pdf-tables.py <input.pdf> <output.json>

Each page becomes {"page": n, "text": [lines], "tables": [[[cell]]]}
with pdfplumber's default table detection. Cells keep their line breaks;
the converters collapse them. Needs pdfplumber: python3 -m pip install pdfplumber
"""

import json
import os
import sys

import pdfplumber


def main(src: str, out: str) -> None:
    pages = []
    with pdfplumber.open(src) as pdf:
        for number, page in enumerate(pdf.pages, 1):
            text = (page.extract_text() or "").split("\n")
            tables = [
                [[cell if cell is not None else "" for cell in row] for row in table]
                for table in page.extract_tables()
            ]
            pages.append({"page": number, "text": text, "tables": tables})
    with open(out, "w", encoding="utf-8") as handle:
        json.dump({"file": os.path.basename(src), "pages": pages}, handle, ensure_ascii=False)
    print(f"wrote {out}: {len(pages)} pages, {sum(len(p['tables']) for p in pages)} tables")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
