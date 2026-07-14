# 公開ガイド — お店メモ（PWA）

このアプリは静的ファイルだけで動くPWA。HTTPSの静的ホスティングに `app/` の中身を置けば公開できる。

## 方法A：Netlify Drop（最速・アカウント後回し可）
1. ブラウザで `https://app.netlify.com/drop` を開く
2. `oshise-memo-app.zip`（= `app/` の中身をzip化したもの）を点線エリアにドラッグ＆ドロップ
   - `projects/oshise-memo/app` フォルダを直接ドラッグしてもよい
3. 数秒で `https://xxxx.netlify.app` の公開URLが発行される
4. URLを他の人に渡す → 各自 Safari/Chrome で開き「ホーム画面に追加」

- URLを恒久化・リネームしたい → Netlify無料アカウント（GitHub連携可）でclaim
- zip再作成: PowerShell `Compress-Archive -Path 'app\*' -DestinationPath 'oshise-memo-app.zip' -Force`

## 方法B：GitHub Pages / Cloudflare Pages（git連携・更新自動反映）
更新（バックアップ機能追加など）を継続するならこちらが向く。
1. `projects/oshise-memo` を git init → GitHubへpush
2. Pages設定で公開ディレクトリを `app/` に指定（またはビルドなし静的公開）
3. push するたび自動デプロイ

## 公開後の確認（iPhone）
1. Safari で公開URLを開く
2. 共有ボタン → 「ホーム画面に追加」
3. 追加されたアイコンから起動（全画面のアプリとして動く）

## 注意
- データは各利用者の端末内（IndexedDB）に保存。利用者間で共有はされない
- パスは全て相対（`css/…`, `js/…`, `sw.js`, `manifest.webmanifest`）なので、ドメインのルート直下に配置すれば動く
- Service Worker はHTTPS（またはlocalhost）でのみ有効
