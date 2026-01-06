#!/usr/bin/env python3
"""PDFをページごとにPNGにレンダリングするスクリプト
依存: pymupdf (fitz), pillow
"""
import argparse, os
import fitz

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pdf", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--zoom", type=float, default=2.0)
    args = ap.parse_args()

    os.makedirs(args.out, exist_ok=True)
    doc = fitz.open(args.pdf)
    mat = fitz.Matrix(args.zoom, args.zoom)

    for i in range(len(doc)):
        page = doc[i]
        pix = page.get_pixmap(matrix=mat, alpha=False)
        out = os.path.join(args.out, f"page_{i+1:03d}.png")
        pix.save(out)
        print("saved", out)

if __name__ == "__main__":
    main()
