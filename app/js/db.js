// db.js — 保存層（リポジトリ）
//
// 画面側（app.js）は、この ShopRepository の関数だけを呼ぶ。
// IndexedDB という保存先の詳細はこのファイルに閉じ込めてある。
// 将来クラウド同期を足すときは、ここを差し替えるだけで画面は触らずに済む。

const ShopRepository = (() => {
  const DB_NAME = 'oshise-memo';
  const DB_VERSION = 1;
  const STORE = 'shops';

  function openDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  // 1トランザクションを Promise でラップする小道具
  function run(mode, fn) {
    return openDB().then(db => new Promise((resolve, reject) => {
      const t = db.transaction(STORE, mode);
      const store = t.objectStore(STORE);
      let result;
      const r = fn(store);
      if (r) r.onsuccess = () => { result = r.result; };
      t.oncomplete = () => resolve(result);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    }));
  }

  function uid() {
    return 'shop_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  // 更新日時の新しい順に並べる
  function byUpdatedDesc(a, b) { return b.updatedAt - a.updatedAt; }

  return {
    // 全件（更新日時の新しい順）
    async getAll() {
      const list = await run('readonly', s => s.getAll());
      return (list || []).sort(byUpdatedDesc);
    },

    // 1件取得
    async get(id) {
      return run('readonly', s => s.get(id));
    },

    // 新規作成。store は必須・memo は任意
    async create({ name, memo }) {
      const now = Date.now();
      const shop = {
        id: uid(),
        name: (name || '').trim(),
        memo: (memo || '').trim(),
        createdAt: now,
        updatedAt: now,
      };
      await run('readwrite', s => s.put(shop));
      return shop;
    },

    // 上書き更新。updatedAt を更新する
    async update(id, { name, memo }) {
      const shop = await this.get(id);
      if (!shop) throw new Error('not found: ' + id);
      shop.name = (name || '').trim();
      shop.memo = (memo || '').trim();
      shop.updatedAt = Date.now();
      await run('readwrite', s => s.put(shop));
      return shop;
    },

    // 削除
    async remove(id) {
      await run('readwrite', s => s.delete(id));
    },

    // インポート用の一括保存（id一致は上書き＝バックアップ復元・端末間統合に使う）
    async bulkPut(shops) {
      const now = Date.now();
      let count = 0;
      await run('readwrite', s => {
        for (const raw of shops) {
          if (!raw || typeof raw.name !== 'string' || !raw.name.trim()) continue;
          s.put({
            id: raw.id || ('shop_' + now.toString(36) + '_' + Math.random().toString(36).slice(2, 8)),
            name: raw.name.trim(),
            memo: typeof raw.memo === 'string' ? raw.memo : '',
            createdAt: Number(raw.createdAt) || now,
            updatedAt: Number(raw.updatedAt) || now,
          });
          count++;
        }
        return null;
      });
      return count;
    },

    // 店名・メモ本文を部分一致で検索（大文字小文字は無視）
    async search(query) {
      const all = await this.getAll();
      const q = (query || '').trim().toLowerCase();
      if (!q) return all;
      return all.filter(x =>
        (x.name || '').toLowerCase().includes(q) ||
        (x.memo || '').toLowerCase().includes(q)
      );
    },
  };
})();
