# tampermonkey-scripts

Tampermonkey用ユーザースクリプト置き場です。

## Scripts

### sasuke-company-link-toolbar.user.js
サスケ企業詳細ページに、Cloud Station / 運用実績分析 / 求人市場レポート検索 / AI調査メニュー / テレアポガイド / 求人媒体検索メニュー（Indeed・求人ボックス・スタンバイ）を追加します。

Install / Raw:
https://raw.githubusercontent.com/tsicb/tampermonkey-scripts/main/sasuke-company-link-toolbar.user.js

### indeed-helper-batch-export.user.js
Indeed求人ページから求人情報を単発/一括でTSV出力する補助スクリプトです。

Install / Raw:
https://raw.githubusercontent.com/tsicb/tampermonkey-scripts/main/indeed-helper-batch-export.user.js

## 更新運用

- スクリプトを修正したら、必ず `@version` を上げてから main に反映してください。
- `@updateURL` と `@downloadURL` は各 `.user.js` の Raw URL を指定しています。
- phoneBridge 系スクリプトは現時点では自動更新対象外とします。

## 直近更新

- sasuke-company-link-toolbar.user.js: v1.6.3
  - 企業名横に「求人市場レポートを横断検索」アイコンを追加
  - 運用実績分析の直後へ配置し、分析・資料系のグループとして表示
  - AI調査との間に細い区切り線を追加
  - クリックすると `https://tsicb.github.io/pdf-text-jump/` を新しいタブで開く
