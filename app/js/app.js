// app.js — 画面の描画と遷移
//
// ルーティングはURLのハッシュで管理する（ブラウザの戻るとも自然に噛み合う）。
//   #/            … お店一覧
//   #/shop/<id>   … お店詳細
//   #/new         … お店登録
//   #/edit/<id>   … お店編集

const appEl = document.getElementById('app');

// ---- 小道具 ----------------------------------------------------------------

// HTMLエスケープ（入力値をそのまま埋め込むと危ないので必ず通す）
function esc(s) {
  return (s || '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

// 更新日時 → 「2026年7月14日 18:30」
function fmtDate(ts) {
  const d = new Date(ts);
  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(d);
}

// メモ本文の先頭1〜2行（一覧のプレビュー用）
function memoPreview(memo) {
  const lines = (memo || '').split('\n').map(s => s.trim()).filter(Boolean);
  return lines.slice(0, 2).join(' ');
}

function go(hash) { location.hash = hash; }
function goBack(fallback) {
  if (history.length > 1) history.back();
  else go(fallback || '#/');
}

// ---- ルーター --------------------------------------------------------------

async function render() {
  const hash = location.hash || '#/';
  const m = hash.match(/^#\/(shop|edit)\/(.+)$/);

  if (hash === '#/' || hash === '') return renderList();
  if (hash === '#/new') return renderForm({ mode: 'new' });
  if (m && m[1] === 'shop') return renderDetail(m[2]);
  if (m && m[1] === 'edit') return renderForm({ mode: 'edit', id: m[2] });
  return renderList();
}

window.addEventListener('hashchange', render);
window.addEventListener('DOMContentLoaded', render);

// ---- 画面1: お店一覧 -------------------------------------------------------

let currentQuery = '';

async function renderList() {
  const shops = await ShopRepository.search(currentQuery);

  appEl.innerHTML = `
    <div class="navbar">
      <div class="title">お店メモ</div>
      <button class="nav-btn right plus" id="addBtn" aria-label="お店を追加">＋</button>
    </div>
    <div class="search-wrap">
      <input id="search" type="search" placeholder="店名・メモで検索" value="${esc(currentQuery)}" />
    </div>
    <div class="list" id="list"></div>
  `;

  document.getElementById('addBtn').onclick = () => go('#/new');

  const search = document.getElementById('search');
  search.oninput = () => {
    currentQuery = search.value;
    // 検索は再描画せず一覧部分だけ差し替え（フォーカスを保つ）
    paintRows();
  };

  paintRows();

  async function paintRows() {
    const listEl = document.getElementById('list');
    const rows = await ShopRepository.search(currentQuery);

    if (rows.length === 0) {
      listEl.innerHTML = currentQuery
        ? `<div class="empty"><div class="lead">見つかりませんでした</div><div class="sub">別のキーワードで試してください</div></div>`
        : `<div class="empty"><div class="big">🍽️</div><div class="lead">まだお店がありません</div><div class="sub">右上の「＋」から最初のお店を追加しましょう</div></div>`;
      return;
    }

    listEl.innerHTML = rows.map(s => {
      const preview = memoPreview(s.memo);
      const memoHtml = preview
        ? `<div class="memo">${esc(preview)}</div>`
        : `<div class="memo empty">メモなし</div>`;
      return `
        <div class="swipe" data-id="${s.id}">
          <div class="delete-bg"><button data-del="${s.id}">削除</button></div>
          <div class="row" data-open="${s.id}">
            <div class="name">${esc(s.name)}</div>
            ${memoHtml}
            <div class="date">${fmtDate(s.updatedAt)} 更新</div>
          </div>
        </div>`;
    }).join('');

    wireRows(listEl, paintRows);
  }
}

// 一覧の行：タップで詳細へ / 左スワイプで削除ボタンを出す
function wireRows(listEl, refresh) {
  listEl.querySelectorAll('.swipe').forEach(swipe => {
    const row = swipe.querySelector('.row');
    const id = swipe.dataset.id;
    let startX = 0, dx = 0, dragging = false, opened = false;
    const REVEAL = 88;

    const close = () => { row.style.transform = 'translateX(0)'; opened = false; };
    const open = () => { row.style.transform = `translateX(-${REVEAL}px)`; opened = true; };

    row.addEventListener('pointerdown', e => {
      dragging = true; startX = e.clientX; dx = 0;
      row.style.transition = 'none';
    });
    row.addEventListener('pointermove', e => {
      if (!dragging) return;
      dx = e.clientX - startX;
      let base = opened ? -REVEAL : 0;
      let x = Math.min(0, Math.max(-REVEAL, base + dx));
      row.style.transform = `translateX(${x}px)`;
    });
    const end = () => {
      if (!dragging) return;
      dragging = false;
      row.style.transition = '';
      if (Math.abs(dx) < 6) return; // タップ扱い（clickに任せる）
      (dx < -30 ? open : close)();
    };
    row.addEventListener('pointerup', end);
    row.addEventListener('pointercancel', end);

    // タップ（ドラッグでない）で詳細へ。開いてる時は閉じるだけ。
    row.addEventListener('click', () => {
      if (Math.abs(dx) > 6) return;
      if (opened) { close(); return; }
      go('#/shop/' + id);
    });

    swipe.querySelector('[data-del]').addEventListener('click', async (e) => {
      e.stopPropagation();
      const shop = await ShopRepository.get(id);
      confirmDialog({
        title: `「${shop ? shop.name : ''}」を削除しますか？`,
        message: 'お店とメモが削除されます。この操作は取り消せません。',
        okLabel: '削除する',
        destructive: true,
        onOk: async () => { await ShopRepository.remove(id); refresh(); },
        onCancel: close,
      });
    });
  });
}

// ---- 画面2: お店詳細 -------------------------------------------------------

async function renderDetail(id) {
  const shop = await ShopRepository.get(id);
  if (!shop) { go('#/'); return; }

  const memoHtml = shop.memo
    ? `<div class="memo-body">${esc(shop.memo)}</div>`
    : `<div class="memo-body empty">メモはまだありません<br>右上の「編集」から追加できます</div>`;

  appEl.innerHTML = `
    <div class="navbar">
      <button class="nav-btn left" id="backBtn">‹ お店メモ</button>
      <div class="title">お店詳細</div>
      <button class="nav-btn right" id="editBtn">編集</button>
    </div>
    <div class="detail">
      <div class="shop-name">${esc(shop.name)}</div>
      <div class="section-label">メモ</div>
      <hr />
      ${memoHtml}
      <div class="updated">${fmtDate(shop.updatedAt)} 更新</div>
    </div>
  `;

  document.getElementById('backBtn').onclick = () => goBack('#/');
  document.getElementById('editBtn').onclick = () => go('#/edit/' + id);
}

// ---- 画面3: お店登録／編集 -------------------------------------------------

async function renderForm({ mode, id }) {
  const isEdit = mode === 'edit';
  const shop = isEdit ? await ShopRepository.get(id) : null;
  if (isEdit && !shop) { go('#/'); return; }

  const backLabel = isEdit ? '‹ 詳細' : '‹ お店メモ';
  const title = isEdit ? 'お店を編集' : 'お店を追加';
  const name0 = shop ? shop.name : '';
  const memo0 = shop ? shop.memo : '';

  appEl.innerHTML = `
    <div class="navbar">
      <button class="nav-btn left" id="backBtn">${backLabel}</button>
      <div class="title">${title}</div>
      <button class="nav-btn right strong" id="saveBtn" disabled>保存</button>
    </div>
    <div class="form">
      <label for="name">店名</label>
      <input id="name" type="text" placeholder="例：カフェ 青空" value="${esc(name0)}" />
      <div class="field-error" id="nameErr"></div>

      <label for="memo">メモ</label>
      <textarea id="memo" placeholder="例：オーツミルクに変更。シロップは半分がちょうどよかった">${esc(memo0)}</textarea>
      <div class="helper">注文内容、カスタマイズ、量の感想などを自由に記録できます。</div>

      ${isEdit ? `<button class="btn-delete" id="delBtn">このお店を削除</button>` : ''}
    </div>
  `;

  const nameEl = document.getElementById('name');
  const memoEl = document.getElementById('memo');
  const saveBtn = document.getElementById('saveBtn');
  const nameErr = document.getElementById('nameErr');

  // 変更を検知（未保存離脱の確認用）
  let dirty = false;
  const markDirty = () => { dirty = true; updateSave(); };

  function updateSave() {
    const hasName = nameEl.value.trim().length > 0;
    const changed = nameEl.value !== name0 || memoEl.value !== memo0;
    // 新規は「店名あり」、編集は「店名あり かつ 変更あり」で有効
    saveBtn.disabled = isEdit ? !(hasName && changed) : !hasName;
  }

  nameEl.addEventListener('input', () => { nameErr.textContent = ''; markDirty(); });
  memoEl.addEventListener('input', markDirty);
  updateSave();

  saveBtn.onclick = async () => {
    if (nameEl.value.trim().length === 0) { nameErr.textContent = '店名を入力してください'; return; }
    saveBtn.disabled = true; // 二重保存防止
    if (isEdit) {
      await ShopRepository.update(id, { name: nameEl.value, memo: memoEl.value });
      dirty = false;
      go('#/shop/' + id);
    } else {
      const created = await ShopRepository.create({ name: nameEl.value, memo: memoEl.value });
      dirty = false;
      // 新規保存後は一覧へ（作ったお店が先頭に来る）
      location.replace('#/');
    }
  };

  document.getElementById('backBtn').onclick = () => {
    if (!dirty) { goBack(isEdit ? '#/shop/' + id : '#/'); return; }
    confirmDialog({
      title: '変更を破棄しますか？',
      message: '編集した内容は保存されません。',
      okLabel: '変更を破棄',
      destructive: true,
      cancelLabel: '編集を続ける',
      onOk: () => { dirty = false; goBack(isEdit ? '#/shop/' + id : '#/'); },
    });
  };

  if (isEdit) {
    document.getElementById('delBtn').onclick = () => {
      confirmDialog({
        title: `「${shop.name}」を削除しますか？`,
        message: 'お店とメモが削除されます。この操作は取り消せません。',
        okLabel: '削除する',
        destructive: true,
        onOk: async () => { await ShopRepository.remove(id); location.replace('#/'); },
      });
    };
  }
}

// ---- 確認ダイアログ --------------------------------------------------------

function confirmDialog({ title, message, okLabel, cancelLabel = 'キャンセル', destructive, onOk, onCancel }) {
  const back = document.createElement('div');
  back.className = 'backdrop';
  back.innerHTML = `
    <div class="dialog" role="dialog" aria-modal="true">
      <div class="body">
        <div class="d-title">${esc(title)}</div>
        ${message ? `<div class="d-msg">${esc(message)}</div>` : ''}
      </div>
      <div class="actions">
        <button class="ok ${destructive ? 'destructive' : 'default'}">${esc(okLabel)}</button>
        <button class="cancel">${esc(cancelLabel)}</button>
      </div>
    </div>
  `;
  const close = () => back.remove();
  back.querySelector('.ok').onclick = () => { close(); onOk && onOk(); };
  back.querySelector('.cancel').onclick = () => { close(); onCancel && onCancel(); };
  back.onclick = (e) => { if (e.target === back) { close(); onCancel && onCancel(); } };
  document.body.appendChild(back);
}
