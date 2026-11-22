'use strict';
/* Event Deck – phát nhạc nhiều kênh. Dùng HTMLAudioElement thuần (playbackRate = 1,
   không xử lý tempo) nên bài nhạc phát đúng tốc độ gốc. */

const $ = (s, r = document) => r.querySelector(s);
const el = (tag, props = {}, ...kids) => {
  const e = Object.assign(document.createElement(tag), props);
  kids.flat().forEach(k => e.append(k));
  return e;
};
const uid = () => Math.random().toString(36).slice(2, 10);
const fmt = s => { if (!isFinite(s)) return '–:––'; s = Math.floor(s); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
const AUDIO_RE = /\.(mp3|wav|m4a|aac|ogg|oga|opus|flac|wma|webm)$/i;
const HAS_FS = 'showOpenFilePicker' in window;

/* ---------- IndexedDB: lưu file handle để lần sau mở lại không phải chọn lại ---------- */
const idb = {
  db: null,
  open() {
    return this.db ||= new Promise((res, rej) => {
      const r = indexedDB.open('event-deck', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('handles');
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    });
  },
  async tx(mode, fn) {
    const db = await this.open();
    return new Promise((res, rej) => {
      const t = db.transaction('handles', mode); const out = fn(t.objectStore('handles'));
      t.oncomplete = () => res(out.result); t.onerror = () => rej(t.error);
    });
  },
  get: k => idb.tx('readonly', s => s.get(k)).catch(() => null),
  set: (k, v) => idb.tx('readwrite', s => s.put(v, k)).catch(() => {}),
  del: k => idb.tx('readwrite', s => s.delete(k)).catch(() => {}),
};

/* ---------- Trạng thái ---------- */
const settings = { exclusive: true, fade: 2 };
let channels = [];       // dữ liệu kênh
let selected = null;     // id kênh đang chọn (phím tắt)
const rt = new Map();    // id kênh -> {audio, url, fadeTimer, fadeMul, ui}

function save() {
  try {
    localStorage.setItem('event-deck', JSON.stringify({
      settings, selected,
      channels: channels.map(c => ({ id: c.id, name: c.name, volume: c.volume, mode: c.mode, sinkId: c.sinkId, sinkLabel: c.sinkLabel, cur: c.cur,
        items: c.items.map(i => ({ id: i.id, name: i.name, hasHandle: !!i.handle })) })),
    }));
  } catch {}
}
function newChannel(name) {
  return { id: uid(), name, volume: 1, mode: 'continue', sinkId: '', sinkLabel: '', cur: -1, items: [] };
}
async function load() {
  let d = null;
  try { d = JSON.parse(localStorage.getItem('event-deck')); } catch {}
  if (d?.channels?.length) {
    Object.assign(settings, d.settings || {});
    selected = d.selected;
    channels = d.channels;
    for (const c of channels) {
      c.cur = -1; // không tự phát lại sau khi mở app
      for (const i of c.items) i.handle = i.hasHandle ? await idb.get(i.id) : null;
      c.items = c.items.filter(i => i.handle); // file không có handle (phiên cũ) không thể mở lại
    }
  } else {
    channels = [newChannel('Kênh 1'), newChannel('Kênh 2')];
  }
  selected ||= channels[0].id;
}

/* ---------- Phát nhạc ---------- */
function R(c) {
  let r = rt.get(c.id);
  if (!r) {
    const audio = new Audio(); audio.preload = 'auto'; audio.playbackRate = 1;
    r = { audio, url: null, fadeTimer: null, fadeMul: 1 };
    audio.addEventListener('ended', () => onEnded(c));
    audio.addEventListener('timeupdate', () => updateSeek(c));
    audio.addEventListener('play', () => refresh(c));
    audio.addEventListener('pause', () => refresh(c));
    audio.addEventListener('loadedmetadata', () => updateSeek(c));
    rt.set(c.id, r);
  }
  return r;
}
const applyVol = c => { const r = R(c); r.audio.volume = Math.min(1, Math.max(0, c.volume * r.fadeMul)); };
const isPlaying = c => { const a = rt.get(c.id)?.audio; return !!a && !a.paused && !a.ended; };

async function getFile(item) {
  if (item.file) return item.file;
  if (item.handle) {
    if ((await item.handle.queryPermission({ mode: 'read' })) !== 'granted' &&
        (await item.handle.requestPermission({ mode: 'read' })) !== 'granted') throw new Error('Chưa được cấp quyền đọc file');
    return item.file = await item.handle.getFile();
  }
  throw new Error('Không tìm thấy file');
}

async function loadTrack(c, index, autoplay) {
  const item = c.items[index]; if (!item) return;
  const r = R(c);
  cancelFade(c);
  try {
    const file = await getFile(item);
    item.missing = false;
    if (r.url) URL.revokeObjectURL(r.url);
    r.url = URL.createObjectURL(file);
    r.audio.src = r.url; r.audio.playbackRate = 1;
    c.cur = index; applyVol(c);
    if (c.sinkId && r.audio.setSinkId) r.audio.setSinkId(c.sinkId).catch(() => {});
    if (autoplay) { if (settings.exclusive) fadeOthers(c); await r.audio.play(); }
  } catch (e) {
    item.missing = true; console.warn(e);
    if (autoplay && index + 1 < c.items.length) return loadTrack(c, index + 1, true); // bỏ qua file lỗi
  }
  save(); render(c);
}

function playPause(c) {
  const r = R(c);
  if (c.cur < 0 || !r.audio.src) { if (c.items.length) loadTrack(c, Math.max(0, c.cur), true); return; }
  if (r.audio.paused) {
    cancelFade(c); applyVol(c);
    if (settings.exclusive) fadeOthers(c);
    r.audio.play();
  } else pauseFade(c, false);
}
function stop(c) { const r = R(c); cancelFade(c); r.audio.pause(); r.audio.currentTime = 0; applyVol(c); refresh(c); updateSeek(c); }
function next(c, auto) {
  if (!c.items.length) return;
  let i = c.cur + 1;
  if (i >= c.items.length) { if (c.mode === 'loopall') i = 0; else return auto ? stop(c) : undefined; }
  loadTrack(c, i, true);
}
function prev(c) {
  const r = R(c);
  if (r.audio.currentTime > 3) r.audio.currentTime = 0; else loadTrack(c, Math.max(0, c.cur - 1), true);
}
function onEnded(c) {
  if (c.mode === 'once') return stop(c);
  if (c.mode === 'loop') { const a = R(c).audio; a.currentTime = 0; a.play(); return; }
  next(c, true);
}

/* Mờ dần: giảm hệ số fadeMul rồi tạm dừng (hoặc dừng hẳn) */
function cancelFade(c) { const r = R(c); clearInterval(r.fadeTimer); r.fadeTimer = null; r.fadeMul = 1; }
function pauseFade(c, toStop) {
  const r = R(c); const secs = settings.fade;
  if (!isPlaying(c)) return;
  clearInterval(r.fadeTimer);
  if (secs <= 0) { r.audio.pause(); if (toStop) r.audio.currentTime = 0; r.fadeMul = 1; applyVol(c); return; }
  const start = performance.now(), from = r.fadeMul;
  r.fadeTimer = setInterval(() => {
    const t = (performance.now() - start) / (secs * 1000);
    r.fadeMul = from * Math.max(0, 1 - t); applyVol(c);
    if (t >= 1) { clearInterval(r.fadeTimer); r.fadeTimer = null; r.audio.pause(); if (toStop) r.audio.currentTime = 0; r.fadeMul = 1; applyVol(c); updateSeek(c); }
  }, 30);
}
function fadeOthers(c) { channels.forEach(o => { if (o !== c && isPlaying(o)) pauseFade(o, false); }); }

/* ---------- Thêm file ---------- */
async function addFiles(c) {
  try {
    if (HAS_FS) {
      const hs = await showOpenFilePicker({ multiple: true, types: [{ description: 'Âm thanh', accept: { 'audio/*': ['.mp3', '.wav', '.m4a', '.aac', '.ogg', '.opus', '.flac', '.wma'] } }] });
      for (const h of hs) await pushItem(c, { name: h.name, handle: h, file: await h.getFile() });
    } else {
      const inp = el('input', { type: 'file', multiple: true, accept: 'audio/*' });
      inp.onchange = async () => { for (const f of inp.files) await pushItem(c, { name: f.name, file: f }); finishAdd(c); };
      return inp.click();
    }
  } catch (e) { if (e.name !== 'AbortError') alert(e.message); return; }
  finishAdd(c);
}
async function addFolder(c) {
  try {
    if (HAS_FS) {
      const dir = await showDirectoryPicker();
      const found = [];
      for await (const [name, h] of dir.entries()) if (h.kind === 'file' && AUDIO_RE.test(name)) found.push(h);
      found.sort((a, b) => a.name.localeCompare(b.name, 'vi', { numeric: true }));
      for (const h of found) await pushItem(c, { name: h.name, handle: h, file: await h.getFile() });
    } else {
      const inp = el('input', { type: 'file', multiple: true, webkitdirectory: true });
      inp.onchange = async () => {
        const fs = [...inp.files].filter(f => AUDIO_RE.test(f.name)).sort((a, b) => a.name.localeCompare(b.name, 'vi', { numeric: true }));
        for (const f of fs) await pushItem(c, { name: f.name, file: f }); finishAdd(c);
      };
      return inp.click();
    }
  } catch (e) { if (e.name !== 'AbortError') alert(e.message); return; }
  finishAdd(c);
}
async function pushItem(c, it) {
  it.id = uid(); c.items.push(it);
  if (it.handle) await idb.set(it.id, it.handle);
}
function finishAdd(c) { save(); render(c); }
function removeItem(c, idx) {
  const [it] = c.items.splice(idx, 1); idb.del(it.id);
  if (idx < c.cur) c.cur--; else if (idx === c.cur) { stop(c); c.cur = -1; R(c).audio.removeAttribute('src'); }
  save(); render(c);
}

/* ---------- Giao diện ---------- */
function updateSeek(c) {
  const u = rt.get(c.id)?.ui; if (!u) return; const a = rt.get(c.id).audio;
  if (!u.dragging) u.seek.value = a.duration ? (a.currentTime / a.duration) * 1000 : 0;
  u.cur.textContent = fmt(a.currentTime);
  u.dur.textContent = fmt(a.duration);
  u.left.textContent = a.duration ? '-' + fmt(a.duration - a.currentTime) : '';
}
function refresh(c) {
  const u = rt.get(c.id)?.ui; if (!u) return;
  const p = isPlaying(c);
  u.root.classList.toggle('playing', p);
  u.play.textContent = p ? '⏸' : '▶';
  u.status.textContent = p ? 'ĐANG PHÁT' : (c.cur >= 0 ? 'Tạm dừng' : 'Sẵn sàng');
  u.now.textContent = c.items[c.cur]?.name || '— chưa chọn bài —';
}
function render(c) { const u = rt.get(c.id)?.ui; if (u) { renderList(c, u); refresh(c); updateSeek(c); } }

function renderList(c, u) {
  u.list.replaceChildren();
  if (!c.items.length) u.list.append(el('div', { className: 'empty', textContent: 'Chưa có bài. Bấm “+ File” hoặc “+ Thư mục”.' }));
  c.items.forEach((it, idx) => {
    const row = el('div', { className: 'item' + (idx === c.cur ? ' cur' : '') + (it.missing ? ' miss' : ''), draggable: true, title: it.name },
      el('span', { className: 'i', textContent: idx + 1 }),
      el('span', { className: 't', textContent: it.name.replace(/\.[^.]+$/, '') }),
      el('button', { className: 'x', textContent: '✕', title: 'Xóa khỏi danh sách', onclick: e => { e.stopPropagation(); removeItem(c, idx); } }));
    row.onclick = () => { select(c.id); loadTrack(c, idx, true); };
    row.ondragstart = e => { e.dataTransfer.setData('text/plain', idx); row.classList.add('drag'); };
    row.ondragend = () => row.classList.remove('drag');
    row.ondragover = e => { e.preventDefault(); row.classList.add('over'); };
    row.ondragleave = () => row.classList.remove('over');
    row.ondrop = e => {
      e.preventDefault(); const from = +e.dataTransfer.getData('text/plain'); if (isNaN(from) || from === idx) return;
      const curItem = c.items[c.cur]; const [m] = c.items.splice(from, 1); c.items.splice(idx, 0, m);
      c.cur = curItem ? c.items.indexOf(curItem) : -1; save(); render(c);
    };
    u.list.append(row);
  });
}

function select(id) {
  selected = id; save();
  channels.forEach(c => rt.get(c.id)?.ui.root.classList.toggle('sel', c.id === id));
}

async function buildChannel(c, n) {
  const r = R(c);
  const name = el('input', { className: 'name', value: c.name, onchange: () => { c.name = name.value; save(); } });
  const now = el('div', { className: 'now' }), status = el('span', { className: 'status' });
  const cur = el('span'), dur = el('span'), left = el('span');
  const seek = el('input', { type: 'range', min: 0, max: 1000, value: 0 });
  const ui = { dragging: false, seek, cur, dur, left, now, status };
  seek.oninput = () => { ui.dragging = true; if (r.audio.duration) r.audio.currentTime = seek.value / 1000 * r.audio.duration; };
  seek.onchange = () => { ui.dragging = false; };

  const play = el('button', { className: 'big primary', textContent: '▶', title: 'Phát / Tạm dừng', onclick: () => { select(c.id); playPause(c); } });
  const vol = el('input', { type: 'range', min: 0, max: 100, value: c.volume * 100, oninput: () => { c.volume = vol.value / 100; applyVol(c); save(); } });
  const mode = el('select', { onchange: () => { c.mode = mode.value; save(); } },
    ...[['continue', 'Phát liên tục'], ['once', 'Phát 1 bài rồi dừng'], ['loop', 'Lặp 1 bài'], ['loopall', 'Lặp cả danh sách']].map(([v, t]) => el('option', { value: v, textContent: t, selected: c.mode === v })));
  const sink = el('select', { title: 'Thiết bị phát âm thanh của kênh này', onchange: async () => {
    if (sink.value === '__pick') {
      // hộp chọn loa có sẵn của Chrome/Edge: không cần quyền micro
      try {
        const d = await navigator.mediaDevices.selectAudioOutput();
        c.sinkId = d.deviceId; c.sinkLabel = d.label;
      } catch {}
    } else { c.sinkId = sink.value; c.sinkLabel = sink.selectedOptions[0]?.textContent || ''; }
    if (c.sinkId) r.audio.setSinkId?.(c.sinkId).catch(e => alert('Không dùng được loa này: ' + e.message));
    else r.audio.setSinkId?.('').catch(() => {});
    save(); fillSinks();
  } });
  async function fillSinks() {
    sink.replaceChildren(el('option', { value: '', textContent: 'Loa mặc định' }));
    const seen = new Set(['', 'default']); deviceLabels = deviceLabels;
    try {
      for (const d of await navigator.mediaDevices.enumerateDevices())
        if (d.kind === 'audiooutput' && d.label && !seen.has(d.deviceId)) { seen.add(d.deviceId); sink.append(el('option', { value: d.deviceId, textContent: d.label })); }
    } catch {}
    if (c.sinkId && !seen.has(c.sinkId)) sink.append(el('option', { value: c.sinkId, textContent: c.sinkLabel || 'Loa đã chọn' }));
    if (navigator.mediaDevices?.selectAudioOutput) sink.append(el('option', { value: '__pick', textContent: '➕ Chọn loa khác…' }));
    sink.value = c.sinkId || '';
    if (seen.size > 2) deviceLabels = true;
  }
  sink.addEventListener('mousedown', e => { if (!deviceLabels) { e.preventDefault(); askDevices(); } });
  if (r.audio.setSinkId) fillSinks(); else sink.hidden = true;
  const list = el('div', { className: 'list' });

  const root = el('section', { className: 'ch' },
    el('div', { className: 'ch-head' }, el('span', { className: 'num', textContent: n + 1 }), name, status,
      el('button', { textContent: '🗑', title: 'Xóa kênh', onclick: () => { if (confirm(`Xóa kênh “${c.name}”?`)) removeChannel(c); } })),
    now,
    el('div', { className: 'seek' }, cur, seek, dur, left),
    el('div', { className: 'ctrl' },
      el('button', { textContent: '⏮', title: 'Bài trước', onclick: () => { select(c.id); prev(c); } }),
      play,
      el('button', { textContent: '⏭', title: 'Bài sau', onclick: () => { select(c.id); next(c); } }),
      el('button', { textContent: '⏹', title: 'Dừng', onclick: () => stop(c) }),
      el('button', { textContent: 'Mờ dần', title: 'Mờ dần rồi dừng (F)', onclick: () => pauseFade(c, true) }),
      el('span', { className: 'vol' }, '🔊', vol)),
    el('div', { className: 'opts' }, mode, sink),
    list,
    el('div', { className: 'add' }, el('button', { textContent: '+ File', onclick: () => addFiles(c) }), el('button', { textContent: '+ Thư mục', onclick: () => addFolder(c) }),
      el('button', { textContent: 'Xóa hết', onclick: () => { if (confirm('Xóa toàn bộ danh sách?')) { stop(c); c.items.forEach(i => idb.del(i.id)); c.items = []; c.cur = -1; save(); render(c); } } })));
  root.addEventListener('pointerdown', () => select(c.id), true);
  // kéo thả file từ Explorer vào kênh
  root.addEventListener('dragover', e => { if (e.dataTransfer.types.includes('Files')) e.preventDefault(); });
  root.addEventListener('drop', async e => {
    if (!e.dataTransfer.files.length) return; e.preventDefault();
    for (const f of [...e.dataTransfer.files].filter(f => AUDIO_RE.test(f.name))) await pushItem(c, { name: f.name, file: f });
    finishAdd(c);
  });
  ui.root = root; ui.list = list; ui.play = play; r.ui = ui;
  if (c.sinkId && r.audio.setSinkId) r.audio.setSinkId(c.sinkId).catch(() => {});
  renderList(c, ui); refresh(c); applyVol(c);
  return root;
}

async function buildAll() {
  const host = $('#channels'); host.replaceChildren();
  for (const [i, c] of channels.entries()) host.append(await buildChannel(c, i));
  select(selected in Object.fromEntries(channels.map(c => [c.id, 1])) ? selected : channels[0]?.id);
}
function removeChannel(c) {
  stop(c); c.items.forEach(i => idb.del(i.id)); rt.delete(c.id);
  channels = channels.filter(x => x !== c); save(); buildAll();
}

/* ---------- Quyền đọc tên thiết bị âm thanh ---------- */
let deviceLabels = false; // true khi trình duyệt đã cho đọc tên loa
async function askDevices() {
  const n = $('#notice');
  try {
    const s = await navigator.mediaDevices.getUserMedia({ audio: true }); // chỉ để được đọc tên loa, không ghi âm
    s.getTracks().forEach(t => t.stop());
    n.hidden = true; await buildAll();
    return true;
  } catch (e) {
    n.hidden = false;
    n.textContent = e.name === 'NotFoundError'
      ? 'Máy không có micro nên Chrome không cho đọc tên loa. Cắm tạm một micro/tai nghe có mic rồi bấm lại, hoặc dùng bản .exe.'
      : 'Chrome đã chặn quyền. Bấm biểu tượng 🔒 bên trái thanh địa chỉ → đặt “Micrô” thành Cho phép → tải lại trang (F5).';
    return false;
  }
}

/* ---------- Khởi động ---------- */
(async function init() {
  await load();
  $('#exclusive').checked = settings.exclusive; $('#fadeSecs').value = settings.fade;
  $('#exclusive').onchange = e => { settings.exclusive = e.target.checked; save(); };
  $('#fadeSecs').onchange = e => { settings.fade = Math.max(0, +e.target.value || 0); save(); };
  $('#addChannel').onclick = () => { channels.push(newChannel('Kênh ' + (channels.length + 1))); save(); buildAll(); };
  $('#showDevices').onclick = askDevices;
  navigator.mediaDevices?.addEventListener?.('devicechange', () => buildAll()); // cắm/rút loa thì cập nhật danh sách
  $('#stopAll').onclick = () => channels.forEach(c => pauseFade(c, true));
  addEventListener('keydown', e => {
    if (/INPUT|SELECT|TEXTAREA/.test(e.target.tagName) && e.target.type !== 'range') return;
    const c = channels.find(x => x.id === selected);
    if (/^[1-9]$/.test(e.key) && channels[+e.key - 1]) return select(channels[+e.key - 1].id);
    if (!c) return;
    if (e.code === 'Space') { e.preventDefault(); playPause(c); }
    else if (e.key === 'ArrowRight') next(c);
    else if (e.key === 'ArrowLeft') prev(c);
    else if (e.key.toLowerCase() === 'f') pauseFade(c, true);
  });
  addEventListener('beforeunload', e => { if (channels.some(isPlaying)) e.preventDefault(); });
  if (!HAS_FS) { const n = $('#notice'); n.hidden = false; n.textContent = 'Trình duyệt này không hỗ trợ ghi nhớ file giữa các lần mở. Hãy dùng Chrome hoặc Edge để danh sách nhạc được lưu lại.'; }
  await buildAll();
})();
