# Workbench — AI App Builder

左にチャット、右にライブプレビューを置き、Claude Design のように HTML/CSS/JS アプリをインタラクティブに開発するツールの UI プロトタイプ。Claude Design からエクスポートした設計バンドルを実装したもの。

**公開URL:** https://workapps.ddashpot.com/workbench/ （`https://ddashpot.github.io/workbench/` もこのカスタムドメインへ自動リダイレクト）

## 構成
- 左ペイン: チャット（モデル選択 + モード切替「プラン / 画面 / ロジック / デバッグ」、ストリーミング、コード適用ボタン、編集・再生成・分岐）
- 右ペイン: プレビュー / コード / コンソールのタブ、デスクトップ・タブレット・モバイルのデバイスフレーム
- 初期画面: テンプレートギャラリー（空 / Todo / ランディング / ダッシュボード / フォーム / スネーク）
- サイドバー: ファイル（ローカル / GitHub / Google Drive）、コンポーネント、履歴（バージョン分岐）、設定
- GitHub OAuth（モック）、GitHub Pages デプロイモーダル、PC/モバイル切替、JP/EN 切替

## 技術
ビルド不要の自己完結型 React アプリ。React 18 (UMD) + Babel standalone を CDN から読み込み、`type="text/babel"` でブラウザ内で JSX をトランスパイルする。静的ホスティング（GitHub Pages）にそのまま配置できる。

- エントリ: `index.html`（`Workbench.html` と同一内容）
- スタイル: `styles.css`（JetBrains 風デザインシステム）
- ロジック: `src/`（データ・i18n・API ラッパ・各 UI コンポーネント）

## 注意（AI バックエンド）
チャットの AI 生成は Claude Design のサンドボックス API（`window.claude.complete`）に依存している。GitHub Pages 等の通常ホストでは UI は完全に動作・描画されるが、チャット送信時の生成は動作しない（設計時点から Gemini / GPT は demo、Claude もサンドボックス専用）。実 API を繋ぐ差し替え口は `src/api.js` の `streamComplete` に用意されている。

## ローカルで開く
任意の静的サーバで配信する（CDN 読込のため `file://` 直開きより推奨）。

```
npx serve .
# または
python -m http.server 8000
```
