// sw.js — Service Worker（オフライン動作＆ホーム画面インストール用）
// アプリシェルをキャッシュして、電波が無くても起動できるようにする。

const CACHE = 'oshise-memo-v1';
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

// キャッシュ優先（無ければネット取得してキャッシュに足す）
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
      return res;
    }).catch(() => hit))
  );
});
