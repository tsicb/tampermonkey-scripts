# tampermonkey-scripts

Tampermonkey用ユーザースクリプト置き場です。

## Scripts

### sasuke-company-link-toolbar.user.js
サスケ企業詳細ページに、Cloud Station / 運用実績分析 / 求人市場レポート検索 / AI調査メニュー / テレアポガイド / 求人媒体検索メニュー（Indeed・求人ボックス・スタンバイ）を追加します。

Install / Raw:
https://raw.githubusercontent.com/tsicb/tampermonkey-scripts/main/sasuke-company-link-toolbar.user.js

### sasuke-phone-link-ui.user.js
サスケ企業詳細ページ内の電話番号をクリック可能にし、非公開の PhoneBridge Core へ発信番号を渡すUIスクリプトです。

主な機能:
- 電話番号の自動検出・リンク化
- 通常クリック時に PhoneBridge Core へ発信要求を通知
- 電話番号をマウスドラッグで範囲選択・コピー可能
- クリックとドラッグを判定し、文字選択時の誤発信を防止
- サスケのインライン編集時に電話番号のHTMLが編集欄へ混入する事故を防止
- DOM更新後も電話番号リンクを再生成

PhoneBridge固有の接続先・認証情報・実際の送信処理は含みません。これらは非公開運用の `Saasuke PhoneBridge Core` 側で管理します。

Install / Raw:
https://raw.githubusercontent.com/tsicb/tampermonkey-scripts/main/sasuke-phone-link-ui.user.js

### indeed-helper-batch-export.user.js
Indeed求人ページから求人情報を単発/一括でTSV出力する補助スクリプトです。

Install / Raw:
https://raw.githubusercontent.com/tsicb/tampermonkey-scripts/main/indeed-helper-batch-export.user.js

## PhoneBridge の構成

PhoneBridge関連は、公開・自動更新可能なUI部分と、非公開のCore部分を分離して運用します。

- `sasuke-phone-link-ui.user.js`
  - このGitHubリポジトリで管理
  - `@updateURL` / `@downloadURL` による自動更新対象
  - 電話番号検出、表示、ドラッグ選択、クリック判定、編集安全対策を担当
- `Saasuke PhoneBridge Core`
  - GitHubには配置しない非公開スクリプト
  - 自動更新対象外
  - 連携ID、PhoneBridge固有設定、認証情報、実際の送信処理を担当

両者は固定のページ内イベントを介して連携します。UI側を更新しても、通常は非公開Core側の差し替えは不要です。

## 更新運用

- スクリプトを修正したら、必ず `@version` を上げてから main に反映してください。
- GitHub公開スクリプトの `@updateURL` と `@downloadURL` は、各 `.user.js` の Raw URL を指定します。
- `sasuke-phone-link-ui.user.js` はGitHub公開・自動更新対象です。
- `Saasuke PhoneBridge Core` は非公開運用のため、GitHubには配置せず、自動更新対象外とします。
- PhoneBridgeのUI/Core間インターフェースを変更する場合は、既存Coreとの互換性を確認してから反映してください。

## 直近更新

### sasuke-company-link-toolbar.user.js v1.6.3
- 企業名横に「求人市場レポートを横断検索」アイコンを追加
- 運用実績分析の直後へ配置し、分析・資料系のグループとして表示
- AI調査との間に細い区切り線を追加
- クリックすると `https://tsicb.github.io/pdf-text-jump/` を新しいタブで開く

### sasuke-phone-link-ui.user.js v1.0.0
- 旧 `Saasuke Phone Bridge Ws v0.4.2` から電話番号UI部分を分離
- PhoneBridge Coreとのイベント連携方式へ変更
- 電話番号のドラッグ選択・コピーに対応
- 通常クリックとドラッグ操作を判定し、選択時の誤発信を防止
- PhoneBridge固有情報を公開UIスクリプトから分離
