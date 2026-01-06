# 電験三種 過去問 丸覚え PWA（スターター）

このフォルダは「まずWebで動く → そのままPWA化」する最小構成です。

## できること（スターター）
- 問題画像を表示
- 選択肢をランダムに並べ替えて出題
- 解答して正誤判定
- 間違いを localStorage に記録（正解/不正解回数、連続正解、最終回答日時）
- 年度・科目の切り替え（catalog.json を参照）

## 依存
- ブラウザのみ
- 数式レンダリング: KaTeX（CDN）  
  ※オフライン完全対応したい場合は、KaTeX を `vendor/` に置いて service worker でキャッシュしてください。

## 使い方（ローカル）
VS Code なら Live Server 拡張で `index.html` を開くのが一番簡単です。
もしくは Python で簡易サーバ:
```bash
python3 -m http.server 8000
# http://localhost:8000
```

## データの入れ方（基本方針）
- 問題文は「画像」: `assets/{year}/{term}/{subject}/q{no}.png`
- 選択肢は「テキスト（LaTeX可）」: `data/{year}_{term}_{subject}.json`
  - どうしても選択肢も画像にしたい場合は `optionImages` に画像パスを入れる設計にしてあります。

### 2025上期データについて
このスターターにはサンプル1問だけ入れてあります（理論 問1）。
実データ化は `tools/` のスクリプトを使って「PDF→ページ画像→質問ごとの切り出し」を作るのがおすすめです。
（自動切り出しはPDFのレイアウト依存が強いので、最初は半自動が現実的です。）

## スクリプト（任意）
`tools/render_pdf_pages.py` : PDF をページごとに PNG にレンダリング  
`tools/auto_crop_by_question_headers.py` : 「問1,問2…」の位置から縦方向にだいたい切り出す（PyMuPDF）

### 例
```bash
pip install pymupdf pillow
python tools/render_pdf_pages.py --pdf /path/to/T1-R_2025.pdf --out assets/2025/upper/theory/pages
python tools/auto_crop_by_question_headers.py --pdf /path/to/T1-R_2025.pdf --out assets/2025/upper/theory --prefix q
```

## PWA
- `manifest.json` と `sw.js` あり
- 主要ファイルとデータ/画像をキャッシュします（初回オンライン推奨）

---
このスターターをベースに、以下を追加していくと「丸覚え」に強くなります:
- 苦手優先（誤答率/連続正解/経過日数）で出題順を制御
- 科目/年度ごとの進捗メーター
- 復習モード（間違いだけ、未回答だけ、など）
