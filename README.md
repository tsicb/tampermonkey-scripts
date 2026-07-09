# tampermonkey-scripts

Tampermonkey用ユーザースクリプト置き場です。

## Scripts

### sasuke-company-link-toolbar.user.js
サスケ企業詳細ページに、Cloud Station / AI調査メニュー / テレアポガイド / Indeedリンクを追加します。

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
