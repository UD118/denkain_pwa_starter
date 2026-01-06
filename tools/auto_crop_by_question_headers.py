#!/usr/bin/env python3
"""「問1」「問2」…の見出し位置から、だいたい縦方向に自動切り出しする（半自動用）
- レイアウト依存が強いので、結果は必ず目視確認してください。
依存: pymupdf (fitz), pillow
"""
import argparse, os, re
import fitz
from PIL import Image

Q_RE = re.compile(r"^問\s*([0-9]{1,2})\b")

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pdf", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--prefix", default="q")
    ap.add_argument("--zoom", type=float, default=2.0)
    ap.add_argument("--min_q", type=int, default=1)
    ap.add_argument("--max_q", type=int, default=18)
    args = ap.parse_args()

    os.makedirs(args.out, exist_ok=True)
    doc = fitz.open(args.pdf)
    mat = fitz.Matrix(args.zoom, args.zoom)

    # 1) ページごとに「問n」のbboxを収集
    anchors = []  # (qno, page_index, y0)
    for pi in range(len(doc)):
        page = doc[pi]
        blocks = page.get_text("blocks")  # (x0,y0,x1,y1,"text",...,block_no)
        for b in blocks:
            x0,y0,x1,y1,txt = b[0],b[1],b[2],b[3], b[4]
            for line in txt.splitlines():
                m = Q_RE.match(line.strip())
                if m:
                    qno = int(m.group(1))
                    if args.min_q <= qno <= args.max_q:
                        anchors.append((qno, pi, y0))
                    break

    # 2) qnoごとに、同ページ内の次のアンカーまでを切り出す
    by_page = {}
    for qno, pi, y0 in anchors:
        by_page.setdefault(pi, []).append((qno, y0))
    for pi in by_page:
        by_page[pi].sort(key=lambda x: x[1])

    for pi, qlist in by_page.items():
        page = doc[pi]
        pix = page.get_pixmap(matrix=mat, alpha=False)
        img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)

        # 変換: PDF座標→ピクセル（zoom倍）
        for idx, (qno, y0) in enumerate(qlist):
            y_top = int(y0 * args.zoom) - 10
            if y_top < 0: y_top = 0
            if idx+1 < len(qlist):
                y_bot = int(qlist[idx+1][1] * args.zoom) - 10
            else:
                y_bot = img.height
            # 余白調整
            crop = img.crop((0, y_top, img.width, y_bot))
            out = os.path.join(args.out, f"{args.prefix}{qno}.png")
            crop.save(out)
            print("saved", out)

if __name__ == "__main__":
    main()
