# tampermonkey-scripts

Tampermonkey用ユーザースクリプトを管理するリポジトリです。公開している `.user.js` は各ツールの最新版として運用しています。

## スクリプト一覧

| ファイル | 現行版 | 対象・主な用途 |
| --- | --- | --- |
| [indeed-helper-batch-export.user.js](./indeed-helper-batch-export.user.js) | v2.4.4 | Indeedの求人検索結果・求人詳細を取得し、営業用・分析用・フルTSVなどを出力 |
| [indeed-company-helper.user.js](./indeed-company-helper.user.js) | v1.0.0 | Indeedの企業クチコミ・質問箱を収集し、企業サマリー・クチコミ明細・質問回答明細をTSV出力 |
| [sasuke-company-link-toolbar.user.js](./sasuke-company-link-toolbar.user.js) | v1.6.3 | サスケ企業詳細から、社内ツール・AI調査・求人媒体検索へアクセスするツールバー |
| [sasuke-phone-link-ui.user.js](./sasuke-phone-link-ui.user.js) | v1.1.5 | サスケの電話番号・対応履歴内URLをリンク化し、非公開PhoneBridge Coreへ発信要求を通知 |

### インストール用Raw URL

- [Indeed求人取得Helper](https://raw.githubusercontent.com/tsicb/tampermonkey-scripts/main/indeed-helper-batch-export.user.js)
- [Indeed企業情報Helper](https://raw.githubusercontent.com/tsicb/tampermonkey-scripts/main/indeed-company-helper.user.js)
- [サスケ企業リンクツールバー](https://raw.githubusercontent.com/tsicb/tampermonkey-scripts/main/sasuke-company-link-toolbar.user.js)
- [サスケ電話番号リンクUI](https://raw.githubusercontent.com/tsicb/tampermonkey-scripts/main/sasuke-phone-link-ui.user.js)

TampermonkeyをインストールしたブラウザでRaw URLを開き、インストール画面に従って追加します。既存インストールを更新するときは、Tampermonkey上で対象スクリプトの更新を確認してください。

## 各スクリプトについて

### Indeed求人取得Helper — `indeed-helper-batch-export.user.js`（v2.4.4）

Indeedの求人検索結果や詳細ページを読み取り、収集結果をTSVにまとめる補助ツールです。

- 検索結果の単一ページ・指定ページ数・全ページ収集、求人詳細の一括取得
- ページ送り時の設定保持、取得進捗の表示、途中停止・再開
- 求人原稿のセクション分解（太字の独立見出し `<b>` / `<strong>` を含む）
- 営業版TSV（68列、求人本文全文を含む）、フルTSV（161列）、検索表示分析・検索語マッチ関連の出力
- 項目定義など、スクリプト画面で提供する補助出力

**注意：** HTMLやIndeedの画面構成が変わると、取得できる項目やページ巡回に影響する場合があります。全文列と項目別列を照合し、取得結果を確認してください。

### Indeed企業情報Helper — `indeed-company-helper.user.js`（v1.0.0）

Indeed企業ページのクチコミ（`/cmp/.../reviews`）と質問箱（`/cmp/.../faq`）、質問詳細ページで起動する独立したツールです。既存の求人取得Helperとは保存データ・操作UIが別です。

- 取得対象：**クチコミ／質問箱／両方**
- 取得範囲：**全ページ／各一覧の先頭1ページ**
- 質問箱：**全回答取得（不足分の質問詳細ページを確認）／代表回答のみ**
- **企業サマリー／クチコミ明細／質問・回答明細**の3種類のTSVコピー・保存
- 投稿・質問・回答のIDで重複を排除し、回答がない質問も出力
- 企業ごとの取得状態の保存、一時停止・再開、件数照合と警告表示
- ページ内に右側の開閉タブ「企業情報Helper」を表示

**利用の流れ：** 対象企業のクチコミまたは質問箱ページを開く → パネルで取得対象・範囲を選択 → 「新規取得」 → 件数と警告を確認 → 必要なTSVをコピーまたは保存。

**初版の検証範囲：** 少数のクチコミ、質問一覧と複数回答のある質問詳細のサンプルHTMLで検証しています。クチコミが大量にある場合の実ページ送りや、回答が非常に多い質問のページ送りは追加検証が必要です。件数不一致・アクセス制限などは警告を表示し、取得成功と混同しない設計です。

**データについて：** 公開されている企業クチコミ・質問回答など、目的に必要な項目のみを出力します。ページに含まれるログインメールアドレスや認証・セッション情報はTSVに出力しません。

### サスケ企業リンクツールバー — `sasuke-company-link-toolbar.user.js`（v1.6.3）

サスケ企業詳細画面から各種ツールへの導線を追加します。

- Cloud Station
- 運用実績分析
- 求人市場レポート横断検索（PDF Text Jump）
- AI調査メニュー
- テレアポガイド
- 求人媒体検索（Indeed・求人ボックス・スタンバイ）

### サスケ電話番号リンクUI — `sasuke-phone-link-ui.user.js`（v1.1.5）

サスケ企業詳細画面の電話番号をクリック可能にし、文字選択もできるようにするUIスクリプトです。

- 通常項目・対応履歴・リードソースのアコーディオン内の電話番号をリンク化
- マウスドラッグによる電話番号の範囲選択・コピーに対応し、誤発信を抑止
- 対応履歴内のWeb URLもリンク化
- インライン編集時に加工HTMLが編集内容へ混入しないよう対策
- 通常クリックで**非公開のPhoneBridge Core**へページ内イベントで発信要求を通知

**PhoneBridge Coreはこの公開リポジトリには含みません。** 接続先、認証情報、連携設定、実際の送信処理は非公開Core側で扱います。UIとCoreは別スクリプトなので、両方を利用する場合は別々に管理します。

## 更新・運用ルール

1. 既存の `.user.js` は最新版を正とし、古いローカルファイルや以前のチャットで作成したファイルで上書きしない。
2. スクリプトを改修したら `@version` を更新してから `main` へ反映する。
3. GitHub管理対象スクリプトの `@updateURL` / `@downloadURL` は、このリポジトリの対応するRaw URLを使用する。
4. READMEの版数・機能概要もコードと併せて更新する。
5. 公開リポジトリには、個人情報、認証情報、PhoneBridge Coreなどの非公開コードを置かない。
6. 外部サイトを自動巡回する機能はサイトの利用条件・負荷・アクセス制限を考慮し、警告や取得漏れがないか確認して利用する。

> スクリプトは対象WebサイトのHTML・JSON構造に依存します。サイト側の変更で動作しなくなる場合があります。
