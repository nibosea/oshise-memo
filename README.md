# お店メモ

飲食店ごとに自分専用のメモを残すPWA（Progressive Web App）。
既存グルメアプリの「他人向け評価」ではなく、「自分だけの再訪メモ」に特化。

## 構成
- `app/` … アプリ本体（HTML + CSS + バニラJS + IndexedDB）。ビルド不要
- `docs/` … 要件定義・ワイヤー・公開ガイド
- `.github/workflows/deploy.yml` … main push で `app/` をGitHub Pagesへ自動公開

## ローカルで動かす
`app/` を任意の静的サーバで配信して `index.html` を開く（HTTPS or localhost 推奨）。

## 公開
main ブランチに push すると GitHub Actions が `app/` をデプロイする。
初回のみ GitHub の Settings → Pages → Source を **GitHub Actions** に設定する。
詳細は [docs/deploy.md](docs/deploy.md)。

## 技術メモ
- データは端末内（IndexedDB）に保存。クラウド同期・アカウントなし
- 保存層は `app/js/db.js` に抽象化（将来クラウド同期へ差し替え可能）
- パスは全て相対 → プロジェクトサイト（サブパス配信）でも動作
