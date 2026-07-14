// sw.js — Service Worker（オフライン動作＆ホーム画面インストール用）
// 方針: ネットワーク優先。オンラインなら常に最新を取得し（push更新が即届く）、
// オフライン時だけキャッシュから返す。install時のプリキャッシュは初回オフライン対策。

const CACHE = 'oshise-memo-v2';
const ASSETS = [
  '.',
  'index.html',
  'css/styles.css',
  'js/db.js',
  'js/app.js',
  'manifest.webmanifest',
  'icons/icon.svg',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

// ネットワーク優先（成功したらキャッシュ更新、失敗＝オフライン時はキャッシュから）
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
      return res;
    }).catch(() => caches.match(e.request))
  );
});
