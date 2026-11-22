'use strict';
/* Event Deck – phát nhạc nhiều kênh.
   Phát bằng HTMLAudioElement thuần (playbackRate = 1, không kéo giãn tempo) nên nhạc đúng tốc độ gốc.
   Sóng âm: đọc tín hiệu qua audio.captureStream() -> AnalyserNode (nhánh phụ, không đổi đường phát/loa). */

const $ = (s, r = document) => r.querySelector(s);
const el = (tag, props = {}, ...kids) => {
  const e = Object.assign(document.createElement(tag), props);
  kids.flat().forEach(k => e.append(k));
  return e;
};
const uid = () => Math.random().toString(36).slice(2, 10);
const fmt = s => { if (!isFinite(s)) return '00:00'; s = Math.floor(s); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
const AUDIO_RE = /\.(mp3|wav|m4a|aac|ogg|oga|opus|flac|wma|webm)$/i;
const HAS_FS = 'showOpenFilePicker' in window;
const strip = n => n.replace(/\.[^.]+$/, '');

/* ---------- Biểu tượng (SVG) ---------- */
const P = {
  prev: '<polygon points="19 20 9 12 19 4" fill="currentColor"/><line x1="5" y1="19" x2="5" y2="5"/>',
  next: '<polygon points="5 4 15 12 5 20" fill="currentColor"/><line x1="19" y1="5" x2="19" y2="19"/>',
  play: '<polygon points="7 4 20 12 7 20" fill="currentColor"/>',
  pause: '<rect x="6" y="4" width="4.5" height="16" rx="1.2" fill="currentColor"/><rect x="13.5" y="4" width="4.5" height="16" rx="1.2" fill="currentColor"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="2.5" fill="currentColor"/>',
  vol: '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19" fill="currentColor"/><path d="M15.5 8.5a5 5 0 010 7M18.5 5.5a9 9 0 010 13"/>',
  plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  file: '<path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z"/><polyline points="14 3 14 8 19 8"/>',
  folder: '<path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  loop: '<path d="M17 2l4 4-4 4M3 11V9a3 3 0 013-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 01-3 3H3"/>',
  speaker: '<rect x="6" y="2" width="12" height="20" rx="3"/><circle cx="12" cy="15" r="3.2"/><circle cx="12" cy="7" r="1"/>',
  music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  mic: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v4"/>',
  clap: '<path d="M4 11h16v9a1 1 0 01-1 1H5a1 1 0 01-1-1z"/><path d="M4 11l-.6-3.6L19.2 3.6 20 7z"/><path d="M8 7.2l1.6 3M12.5 6l1.6 3"/>',
  gift: '<rect x="3" y="8" width="18" height="4" rx="1"/><rect x="5" y="12" width="14" height="9" rx="1"/><line x1="12" y1="8" x2="12" y2="21"/><path d="M12 8C10 3.5 6 4.5 7 7.5c.5 1.5 3 1 5 .5 2 .5 4.5 1 5-.5 1-3-3-4-5 .5z"/>',
  trophy: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 01-10 0zM17 5h3v2a3 3 0 01-3 3M7 5H4v2a3 3 0 003 3"/>',
  star: '<polygon points="12 2 15 9 22 9.5 17 14.5 18.5 22 12 18 5.5 22 7 14.5 2 9.5 9 9"/>',
  dots: '<circle cx="12" cy="5" r="1.8" fill="currentColor"/><circle cx="12" cy="12" r="1.8" fill="currentColor"/><circle cx="12" cy="19" r="1.8" fill="currentColor"/>',
  list: '<line x1="9" y1="6" x2="21" y2="6"/><line x1="9" y1="12" x2="21" y2="12"/><line x1="9" y1="18" x2="21" y2="18"/><circle cx="4.5" cy="6" r="1" fill="currentColor"/><circle cx="4.5" cy="12" r="1" fill="currentColor"/><circle cx="4.5" cy="18" r="1" fill="currentColor"/>',
  gear: '<circle cx="12" cy="12" r="3.5"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
  info: '<circle cx="12" cy="12" r="9"/><line x1="12" y1="11" x2="12" y2="17"/><circle cx="12" cy="7.5" r=".8" fill="currentColor"/>',
};
const CH_ICONS = ['clap', 'mic', 'music', 'gift', 'trophy', 'star'];
const icon = (n, s = 18) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${P[n] || ''}</svg>`;
const ic = (n, s) => el('span', { className: 'ic', innerHTML: icon(n, s) });
document.querySelectorAll('i[data-ic]').forEach(i => { i.innerHTML = icon(i.dataset.ic, 18); });

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
  clear: () => idb.tx('readwrite', s => s.clear()).catch(() => {}),
};

/* ---------- Trạng thái ---------- */
const settings = { exclusive: true, fade: 2, viz: 'seek' };
let channels = [];
let selected = null;
let view = 'play';
const rt = new Map(); // id kênh -> {audio, url, coverUrl, fadeTimer, fadeMul, an, buf, src, spec, ui}

function save() {
  try {
    localStorage.setItem('event-deck', JSON.stringify({
      settings, selected,
      channels: channels.map(c => ({ id: c.id, name: c.name, icon: c.icon, volume: c.volume, mode: c.mode, sinkId: c.sinkId, sinkLabel: c.sinkLabel,
        items: c.items.map(i => ({ id: i.id, name: i.name, hasHandle: !!i.handle })) })),
    }));
  } catch {}
}
const newChannel = (name, ic = 'music') => ({ id: uid(), name, icon: ic, volume: 1, mode: 'continue', sinkId: '', sinkLabel: '', cur: -1, items: [] });
async function load() {
  let d = null;
  try { d = JSON.parse(localStorage.getItem('event-deck')); } catch {}
  if (d?.channels?.length) {
    Object.assign(settings, d.settings || {});
    if (settings.viz === 'wave') settings.viz = 'seek'; // kiểu cũ -> kiểu mới theo thanh tua
    selected = d.selected;
    channels = d.channels;
    for (const [n, c] of channels.entries()) {
      c.cur = -1; c.icon ||= CH_ICONS[n % CH_ICONS.length];
      for (const i of c.items) i.handle = i.hasHandle ? await idb.get(i.id) : null;
      c.items = c.items.filter(i => i.handle);
    }
  } else channels = [newChannel('Kênh 1', 'clap'), newChannel('Kênh 2', 'mic')];
  selected ||= channels[0].id;
}

/* ---------- Ảnh bìa (ID3v2 APIC trong file mp3) ---------- */
async function readCover(file) {
  try {
    const b = new Uint8Array(await file.slice(0, 4 << 20).arrayBuffer());
    if (b[0] !== 0x49 || b[1] !== 0x44 || b[2] !== 0x33 || b[3] < 3) return null;
    const ss = o => ((b[o] & 127) << 21) | ((b[o + 1] & 127) << 14) | ((b[o + 2] & 127) << 7) | (b[o + 3] & 127);
    const ver = b[3], end = Math.min(10 + ss(6), b.length);
    let p = 10;
    if (b[5] & 0x40) p += ver === 4 ? ss(10) : ((b[10] << 24) | (b[11] << 16) | (b[12] << 8) | b[13]) + 4;
    while (p + 10 <= end) {
      const id = String.fromCharCode(b[p], b[p + 1], b[p + 2], b[p + 3]);
      if (!/^[A-Z0-9]{4}$/.test(id)) break;
      const size = ver === 4 ? ss(p + 4) : (b[p + 4] * 2 ** 24 + (b[p + 5] << 16) + (b[p + 6] << 8) + b[p + 7]);
      const body = p + 10;
      if (id === 'APIC') {
        const enc = b[body]; let i = body + 1, mime = '';
        while (i < end && b[i] !== 0) mime += String.fromCharCode(b[i++]);
        i += 2; // hết mime + loại ảnh
        if (enc === 1 || enc === 2) { while (i + 1 < end && !(b[i] === 0 && b[i + 1] === 0)) i += 2; i += 2; }
        else { while (i < end && b[i] !== 0) i++; i++; }
        const data = b.slice(i, body + size);
        if (data.length < 100) return null;
        const png = data[0] === 0x89 && data[1] === 0x50;
        return new Blob([data], { type: png ? 'image/png' : 'image/jpeg' });
      }
      p = body + size;
    }
  } catch {}
  return null;
}

/* ---------- Phát nhạc ---------- */
function R(c) {
  let r = rt.get(c.id);
  if (!r) {
    const audio = new Audio(); audio.preload = 'auto'; audio.playbackRate = 1;
    r = { audio, url: null, coverUrl: null, fadeTimer: null, fadeMul: 1, an: null, buf: null, src: null, spec: new Float32Array(32), hist: new Float32Array(480), lastIdx: -1 };
    audio.addEventListener('ended', () => onEnded(c));
    audio.addEventListener('timeupdate', () => updateSeek(c));
    audio.addEventListener('play', () => refresh(c));
    audio.addEventListener('pause', () => refresh(c));
    audio.addEventListener('playing', () => hookAnalyser(c));
    audio.addEventListener('loadedmetadata', () => updateSeek(c));
    rt.set(c.id, r);
  }
  return r;
}
const applyVol = c => { const r = R(c); r.audio.volume = Math.min(1, Math.max(0, c.volume * r.fadeMul)); };
const isPlaying = c => { const a = rt.get(c.id)?.audio; return !!a && !a.paused && !a.ended; };

let actx = null;
function hookAnalyser(c) {
  const r = R(c);
  try {
    actx ||= new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
    const stream = r.audio.captureStream?.();
    if (!stream || !stream.getAudioTracks().length) return;
    r.src?.disconnect();
    r.src = actx.createMediaStreamSource(stream);
    if (!r.an) { r.an = actx.createAnalyser(); r.an.fftSize = 256; r.an.smoothingTimeConstant = 0.6; r.buf = new Uint8Array(r.an.frequencyBinCount); }
    r.src.connect(r.an); // không nối ra loa: chỉ để phân tích
  } catch (e) { console.warn('visualizer', e); }
}

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
    if (r.coverUrl) { URL.revokeObjectURL(r.coverUrl); r.coverUrl = null; }
    r.url = URL.createObjectURL(file);
    r.audio.src = r.url; r.audio.playbackRate = 1;
    r.hist.fill(0); r.lastIdx = -1; // bài mới: xóa sóng đã ghi
    c.cur = index; applyVol(c);
    if (c.sinkId && r.audio.setSinkId) r.audio.setSinkId(c.sinkId).catch(() => {});
    readCover(file).then(b => { if (b && c.cur === index) { r.coverUrl = URL.createObjectURL(b); refresh(c); } });
    if (autoplay) { if (settings.exclusive) fadeOthers(c); await r.audio.play(); }
  } catch (e) {
    item.missing = true; console.warn(e);
    if (autoplay && index + 1 < c.items.length) return loadTrack(c, index + 1, true);
  }
  save(); render(c);
}

function playPause(c) {
  const r = R(c);
  if (c.cur < 0 || !r.audio.src) { if (c.items.length) loadTrack(c, Math.max(0, c.cur), true); return; }
  if (r.audio.paused) { cancelFade(c); applyVol(c); if (settings.exclusive) fadeOthers(c); r.audio.play(); }
  else pauseFade(c, false);
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

/* ---------- Thêm / xóa / chuyển file ---------- */
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
async function pushItem(c, it) { it.id = uid(); c.items.push(it); if (it.handle) await idb.set(it.id, it.handle); }
function finishAdd(c) { save(); render(c); }
function detach(c, idx) { // bỏ bài khỏi danh sách (không xóa handle)
  const [it] = c.items.splice(idx, 1);
  if (idx < c.cur) c.cur--;
  else if (idx === c.cur) { stop(c); c.cur = -1; R(c).audio.removeAttribute('src'); }
  return it;
}
function removeItem(c, idx) { const it = detach(c, idx); idb.del(it.id); save(); render(c); }
function moveItem(from, idx, to) { const it = detach(from, idx); to.items.push(it); save(); render(from); render(to); }

/* ---------- Giao diện kênh ---------- */
function updateSeek(c) {
  const u = rt.get(c.id)?.ui; if (!u) return; const a = rt.get(c.id).audio;
  const pct = a.duration ? (a.currentTime / a.duration) * 100 : 0;
  if (!u.dragging) { u.seek.value = pct * 10; u.seek.style.setProperty('--p', pct + '%'); }
  u.times.textContent = `${fmt(a.currentTime)} / ${fmt(a.duration)}`;
}
function refresh(c) {
  const r = rt.get(c.id), u = r?.ui; if (!u) return;
  const p = isPlaying(c), it = c.items[c.cur];
  u.root.classList.toggle('playing', p);
  u.play.innerHTML = icon(p ? 'pause' : 'play', 26);
  u.status.textContent = p ? 'Đang phát' : (c.cur >= 0 ? 'Tạm dừng' : 'Sẵn sàng');
  u.status.classList.toggle('pause', !p && c.cur >= 0);
  u.title.textContent = it ? strip(it.name) : '— Chưa chọn bài —';
  u.sub.textContent = it ? c.name : '';
  u.cover.hidden = !it;
  u.cover.replaceChildren(ic('music', 28), ...(r.coverUrl ? [el('img', { src: r.coverUrl, alt: '' })] : []));
  document.body.classList.toggle('live', channels.some(isPlaying));
}
function render(c) { const u = rt.get(c.id)?.ui; if (u) { renderList(c, u); refresh(c); updateSeek(c); } if (view === 'list') renderLibrary(); }

function renderList(c, u) {
  u.list.replaceChildren();
  if (!c.items.length) {
    u.list.append(el('div', { className: 'empty', innerHTML: icon('music', 44) + '<b>Chưa có bài.</b><span>Bấm “+ File” hoặc “+ Thư mục” để thêm nhạc.</span>' }));
    return;
  }
  c.items.forEach((it, idx) => {
    const row = el('div', { className: 'item' + (idx === c.cur ? ' cur' : '') + (it.missing ? ' miss' : ''), draggable: true, title: it.name },
      el('span', { className: 'i', textContent: idx + 1 }),
      el('span', { className: 'mi', innerHTML: icon('music', 16) }),
      el('span', { className: 't', textContent: strip(it.name) }),
      ...(idx === c.cur ? [el('span', { className: 'eq', innerHTML: '<i></i><i></i><i></i>' })] : []),
      el('button', { className: 'x', innerHTML: '✕', title: 'Xóa khỏi danh sách', onclick: e => { e.stopPropagation(); removeItem(c, idx); } }));
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
  u.list.querySelector('.cur')?.scrollIntoView({ block: 'nearest' });
}

function select(id) {
  selected = id; save();
  channels.forEach(c => rt.get(c.id)?.ui.root.classList.toggle('sel', c.id === id));
}

/* menu ⋮ của kênh */
let menuEl = null;
function closeMenu() { menuEl?.remove(); menuEl = null; }
function openMenu(c, anchor) {
  closeMenu();
  const row = el('div', { className: 'iconrow' }, CH_ICONS.map(n => el('button', { className: 'ib' + (c.icon === n ? ' on' : ''), innerHTML: icon(n, 18), title: n,
    onclick: () => { c.icon = n; save(); rt.get(c.id).ui.chicon.innerHTML = icon(n, 22); closeMenu(); } })));
  menuEl = el('div', { className: 'menu' },
    el('div', { className: 'mlabel', textContent: 'Biểu tượng kênh' }), row,
    el('button', { className: 'mi2', innerHTML: icon('stop', 16) + ' Dừng kênh này', onclick: () => { stop(c); closeMenu(); } }),
    el('button', { className: 'mi2 danger', innerHTML: icon('trash', 16) + ' Xóa kênh', onclick: () => { closeMenu(); if (confirm(`Xóa kênh “${c.name}”?`)) removeChannel(c); } }));
  document.body.append(menuEl);
  const b = anchor.getBoundingClientRect();
  menuEl.style.left = Math.max(8, Math.min(innerWidth - menuEl.offsetWidth - 8, b.right - menuEl.offsetWidth)) + 'px';
  menuEl.style.top = b.bottom + 6 + 'px';
}
addEventListener('pointerdown', e => { if (menuEl && !menuEl.contains(e.target) && !e.target.closest('.kebab')) closeMenu(); }, true);

async function buildChannel(c, n) {
  const r = R(c);
  const num = el('span', { className: 'num', textContent: n + 1 });
  const chicon = el('span', { className: 'chicon', innerHTML: icon(c.icon, 22) });
  const name = el('input', { className: 'name', value: c.name, onchange: () => { c.name = name.value.trim() || c.name; name.value = c.name; save(); refresh(c); } });
  const status = el('span', { className: 'status' });
  const kebab = el('button', { className: 'kebab', innerHTML: icon('dots', 20), title: 'Tùy chọn kênh', onclick: () => openMenu(c, kebab) });

  const canvas = el('canvas');
  const cover = el('div', { className: 'cover' });
  const title = el('div', { className: 't' }), sub = el('div', { className: 's' }), times = el('div', { className: 'times' });
  const stage = el('div', { className: 'stage' }, canvas, cover, el('div', { className: 'meta' }, title, sub), times);

  const seek = el('input', { type: 'range', min: 0, max: 1000, value: 0 });
  const seekCv = el('canvas', { className: 'seekwave' });
  const ui = { dragging: false, seek, seekCv, sg: seekCv.getContext('2d'), times, title, sub, cover, status, chicon, canvas, g: canvas.getContext('2d') };
  seek.oninput = () => { ui.dragging = true; seek.style.setProperty('--p', seek.value / 10 + '%'); if (r.audio.duration) r.audio.currentTime = seek.value / 1000 * r.audio.duration; };
  seek.onchange = () => { ui.dragging = false; };

  const rb = (cls, ico, sz, title, fn) => el('button', { className: 'rb ' + cls, innerHTML: icon(ico, sz), title, onclick: fn });
  const play = rb('big', 'play', 26, 'Phát / Tạm dừng', () => { select(c.id); playPause(c); });
  const vol = el('input', { type: 'range', min: 0, max: 100, value: c.volume * 100,
    oninput: () => { c.volume = vol.value / 100; vol.style.setProperty('--p', vol.value + '%'); applyVol(c); save(); } });
  vol.style.setProperty('--p', c.volume * 100 + '%');

  const mode = el('select', { onchange: () => { c.mode = mode.value; save(); } },
    ...[['continue', 'Phát liên tục'], ['once', '1 bài rồi dừng'], ['loop', 'Lặp 1 bài'], ['loopall', 'Lặp cả danh sách']].map(([v, t]) => el('option', { value: v, textContent: t, selected: c.mode === v })));
  const sink = el('select', { title: 'Thiết bị phát âm thanh của kênh này', onchange: () => {
    c.sinkId = sink.value; c.sinkLabel = sink.selectedOptions[0]?.textContent || '';
    r.audio.setSinkId?.(c.sinkId).catch(e => alert('Không dùng được loa này: ' + e.message)); save();
  } });
  async function fillSinks() {
    sink.replaceChildren(el('option', { value: '', textContent: 'Loa mặc định' }));
    const seen = new Set(['', 'default']);
    try {
      for (const d of await navigator.mediaDevices.enumerateDevices())
        if (d.kind === 'audiooutput' && d.label && !seen.has(d.deviceId)) { seen.add(d.deviceId); sink.append(el('option', { value: d.deviceId, textContent: d.label })); }
    } catch {}
    if (c.sinkId && !seen.has(c.sinkId)) sink.append(el('option', { value: c.sinkId, textContent: c.sinkLabel || 'Loa đã chọn' }));
    sink.value = c.sinkId || '';
    if (seen.size > 2) deviceLabels = true;
  }
  sink.addEventListener('mousedown', e => { if (!deviceLabels) { e.preventDefault(); askDevices(); } });
  const sinkWrap = el('div', { className: 'selwrap' }, ic('speaker', 18), sink);
  if (r.audio.setSinkId) await fillSinks(); else sinkWrap.hidden = true;

  const list = el('div', { className: 'list' });
  const root = el('section', { className: 'ch' },
    el('div', { className: 'ch-head' }, num, chicon, name, status, kebab),
    stage,
    el('div', { className: 'seek' }, seekCv, seek),
    el('div', { className: 'ctrl' },
      rb('', 'prev', 20, 'Bài trước (←)', () => { select(c.id); prev(c); }), play,
      rb('', 'next', 20, 'Bài sau (→)', () => { select(c.id); next(c); }),
      rb('', 'stop', 18, 'Dừng', () => stop(c)),
      el('span', { className: 'vol', title: 'Âm lượng kênh' }, ic('vol', 20), vol)),
    el('div', { className: 'opts' }, el('div', { className: 'selwrap' }, ic('loop', 18), mode), sinkWrap),
    list,
    el('div', { className: 'add' },
      el('button', { className: 'btn', innerHTML: icon('plus', 16) + 'File', onclick: () => addFiles(c) }),
      el('button', { className: 'btn', innerHTML: icon('folder', 16) + 'Thư mục', onclick: () => addFolder(c) }),
      el('button', { className: 'btn', innerHTML: icon('trash', 16) + 'Xóa hết', onclick: () => { if (confirm('Xóa toàn bộ danh sách của kênh này?')) { stop(c); c.items.forEach(i => idb.del(i.id)); c.items = []; c.cur = -1; r.audio.removeAttribute('src'); save(); render(c); } } })));
  root.addEventListener('pointerdown', () => select(c.id), true);
  root.addEventListener('dragover', e => { if (e.dataTransfer.types.includes('Files')) e.preventDefault(); });
  root.addEventListener('drop', async e => {
    if (!e.dataTransfer.files.length) return; e.preventDefault();
    for (const f of [...e.dataTransfer.files].filter(f => AUDIO_RE.test(f.name))) await pushItem(c, { name: f.name, file: f });
    finishAdd(c);
  });
  ui.root = root; ui.list = list; ui.play = play; r.ui = ui;
  if (c.sinkId && r.audio.setSinkId) r.audio.setSinkId(c.sinkId).catch(() => {});
  renderList(c, ui); refresh(c); updateSeek(c); applyVol(c);
  return root;
}

async function buildAll() {
  const host = $('#channels'); host.replaceChildren();
  for (const [i, c] of channels.entries()) host.append(await buildChannel(c, i));
  select(channels.some(c => c.id === selected) ? selected : channels[0]?.id);
  if (view === 'list') renderLibrary();
}
function removeChannel(c) {
  stop(c); c.items.forEach(i => idb.del(i.id)); rt.delete(c.id);
  channels = channels.filter(x => x !== c); save(); buildAll();
}

/* ---------- Tab Danh sách ---------- */
function renderLibrary() {
  const q = $('#libSearch').value.trim().toLowerCase(), host = $('#libBody'); host.replaceChildren();
  channels.forEach((c, ci) => {
    const rows = c.items.map((it, idx) => ({ it, idx })).filter(x => !q || x.it.name.toLowerCase().includes(q));
    if (!rows.length) return;
    host.append(el('div', { className: 'lib-ch' }, ic(c.icon, 18), `${ci + 1}. ${c.name}`));
    rows.forEach(({ it, idx }) => {
      const mv = el('select', { title: 'Chuyển sang kênh khác', onchange: () => { if (mv.value) moveItem(c, idx, channels.find(x => x.id === mv.value)); } },
        el('option', { value: '', textContent: 'Chuyển sang…' }),
        ...channels.filter(x => x !== c).map(x => el('option', { value: x.id, textContent: x.name })));
      host.append(el('div', { className: 'lib-row' },
        el('span', { textContent: idx + 1, style: 'text-align:right;color:var(--mut)' }),
        el('span', { textContent: strip(it.name), style: 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap', title: it.name }),
        el('button', { className: 'btn', innerHTML: icon('play', 14) + 'Phát', onclick: () => { select(c.id); loadTrack(c, idx, true); } }),
        mv, el('button', { className: 'btn danger', innerHTML: icon('trash', 14), title: 'Xóa', onclick: () => removeItem(c, idx) })));
    });
  });
  if (!host.children.length) host.append(el('div', { className: 'empty', innerHTML: icon('music', 44) + '<b>Không có bài nào.</b>' }));
}

/* ---------- Quyền đọc tên thiết bị âm thanh ---------- */
let deviceLabels = false;
async function askDevices() {
  const n = $('#notice');
  try {
    const s = await navigator.mediaDevices.getUserMedia({ audio: true }); // chỉ để được đọc tên loa, không ghi âm
    s.getTracks().forEach(t => t.stop());
    n.hidden = true; await buildAll(); return true;
  } catch (e) {
    n.hidden = false;
    n.textContent = e.name === 'NotFoundError'
      ? 'Máy không có micro nên Chrome không cho đọc tên loa. Hãy dùng bản .exe, hoặc cắm tạm một micro.'
      : 'Chrome đã chặn quyền. Bấm 🔒 bên trái thanh địa chỉ → đặt “Micrô” thành Cho phép → tải lại trang (F5).';
    return false;
  }
}

/* ---------- Hiệu ứng sóng âm ---------- */
const COLORS = { blue: ['#60a5fa', '#3b82f6', '#22d3ee'], vio: ['#e879f9', '#a855f7', '#8b5cf6'] };
const dpr = Math.min(2, window.devicePixelRatio || 1);
function sizeCanvas(cv) {
  const w = cv.clientWidth, h = cv.clientHeight;
  if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
  return [w, h];
}
function updateSpec(c, r) {
  const spec = r.spec; let live = false;
  if (r.an && isPlaying(c)) {
    r.an.getByteFrequencyData(r.buf);
    const gain = 0.3 + 0.7 * Math.min(1, c.volume * r.fadeMul);
    for (let i = 0; i < 32; i++) {
      const lo = Math.floor(Math.pow(i / 32, 1.8) * 100) + 1, hi = Math.max(lo + 1, Math.floor(Math.pow((i + 1) / 32, 1.8) * 100) + 1);
      let s = 0; for (let k = lo; k < hi; k++) s += r.buf[k];
      const v = Math.min(1, (s / (hi - lo) / 255) * (0.9 + i / 32 * 0.9) * gain);
      spec[i] = v > spec[i] ? v : spec[i] * 0.88 + v * 0.12; live = true;
    }
  } else for (let i = 0; i < 32; i++) spec[i] *= 0.9;
  return live;
}
/* ghi lại mức âm theo vị trí phát: phát tới đâu có sóng tới đó */
function recordHist(c, r) {
  const a = r.audio; if (!a.duration || !isPlaying(c)) return;
  const N = r.hist.length, idx = Math.min(N - 1, Math.floor(a.currentTime / a.duration * N));
  let s = 0; for (let i = 0; i < 24; i++) s += r.spec[i]; 
  const lv = Math.min(1, Math.pow(s / 24 * 2.4, 0.85));
  const from = r.lastIdx >= 0 && idx - r.lastIdx > 0 && idx - r.lastIdx < 6 ? r.lastIdx + 1 : idx; // lấp khoảng trống nhỏ khi khung hình bị trễ
  for (let i = from; i <= idx; i++) r.hist[i] = i === idx ? Math.max(lv, r.hist[i] * 0.6) : lv;
  r.lastIdx = idx;
}
function drawSeekWave(c, r, t) {
  const u = r.ui, cv = u.seekCv; const [w, h] = sizeCanvas(cv); if (!w) return;
  const g = u.sg; g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
  if (settings.viz !== 'seek') return;
  const a = r.audio, N = r.hist.length, pad = 7.5;
  const pct = a.duration ? a.currentTime / a.duration : 0;
  const px = pad + pct * (w - 2 * pad); if (px <= pad + 1) return;
  const col = COLORS[c.id === selected ? 'vio' : 'blue'], span = w - 2 * pad;
  const val = x => { // giá trị tại x: trung bình 3 ô cho mượt
    const f = (x - pad) / span * N, i = Math.min(N - 1, Math.max(0, Math.floor(f)));
    return (r.hist[Math.max(0, i - 1)] + r.hist[i] * 2 + r.hist[Math.min(N - 1, i + 1)]) / 4;
  };
  [[1, 0.95], [0.62, 0.5]].forEach(([k, al], L) => {
    g.beginPath(); g.moveTo(pad, h);
    for (let x = pad; x <= px; x += 2) {
      const edge = Math.min(1, (px - x) / 18 + 0.25), v = val(x * (L ? 0.995 : 1));
      g.lineTo(x, h - (1.5 + v * (h - 3) * k * (0.88 + 0.12 * Math.sin(x * 0.09 + L * 2))) * edge);
    }
    g.lineTo(px, h); g.closePath();
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, col[0]); gr.addColorStop(1, col[1]);
    g.globalAlpha = al * (L ? 0.55 : 0.9); g.fillStyle = gr; g.shadowColor = col[0]; g.shadowBlur = L ? 0 : 8; g.fill(); g.shadowBlur = 0;
  });
  g.globalAlpha = 1;
}
function drawChannel(c, r, t) {
  const u = r.ui; if (!u || view !== 'play') return;
  drawSeekWave(c, r, t);
  const [w, h] = sizeCanvas(u.canvas); if (!w) return;
  const g = u.g; g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
  if (settings.viz === 'off' || settings.viz === 'seek') return;
  const col = COLORS[c.id === selected ? 'vio' : 'blue'];
  const spec = r.spec;
  const at = p => { const x = p * 31, i = Math.floor(x), f = x - i; return Math.min(1, ((spec[i] || 0) * (1 - f) + (spec[Math.min(31, i + 1)] || 0) * f) * 1.7); };
  if (settings.viz === 'bars') {
    const n = 32, bw = w / n;
    const gr = g.createLinearGradient(0, h, 0, 0); gr.addColorStop(0, col[1] + '33'); gr.addColorStop(1, col[0] + 'dd');
    g.fillStyle = gr;
    for (let i = 0; i < n; i++) { const bh = 3 + spec[i] * h * 0.85 + (isPlaying(c) ? 0 : 2 + 2 * Math.sin(t / 700 + i)); g.beginPath(); g.roundRect(i * bw + 2, h - bh, bw - 4, bh, 3); g.fill(); }
    return;
  }
  const layers = [[1, 1.6, 1.1, 2.4], [0.72, 2.5, -0.8, 1.8], [0.5, 3.4, 1.5, 1.3]];
  layers.forEach(([k, f, sp, lw], L) => {
    const base = h * 0.6, amp = h * 0.36 * k;
    g.beginPath();
    for (let x = 0; x <= w; x += 4) {
      const p = x / w, env = 0.2 + 0.08 * Math.sin(t / 900 + p * 3) + at(p), taper = 0.35 + 0.65 * Math.sin(p * Math.PI);
      const y = base - amp * env * taper * Math.sin(p * f * Math.PI * 2 + (t / 1000) * sp + L * 1.3);
      x ? g.lineTo(x, y) : g.moveTo(x, y);
    }
    g.strokeStyle = col[L]; g.lineWidth = lw; g.shadowColor = col[L]; g.shadowBlur = 14; g.globalAlpha = L ? 0.75 : 1; g.stroke();
    g.shadowBlur = 0; g.lineTo(w, h); g.lineTo(0, h); g.closePath();
    const gr = g.createLinearGradient(0, base - amp, 0, h); gr.addColorStop(0, col[L] + '44'); gr.addColorStop(1, col[L] + '00');
    g.fillStyle = gr; g.fill(); g.globalAlpha = 1;
  });
}
function drawMaster(t) {
  const cv = $('#master'); if (!cv || !cv.clientWidth) return;
  const [w, h] = sizeCanvas(cv), g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
  const n = 40, bw = w / n, gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, '#3b82f6'); gr.addColorStop(1, '#c084fc'); g.fillStyle = gr;
  for (let i = 0; i < n; i++) {
    let m = 0; for (const r of rt.values()) m = Math.max(m, r.spec[Math.floor(i * 31 / (n - 1))] || 0);
    const bh = 3 + m * (h - 6) * 1.4 * (0.6 + 0.4 * Math.sin(i * 0.5)) + (m < 0.02 ? 3 * Math.abs(Math.sin(t / 900 + i * 0.7)) : 0);
    g.beginPath(); g.roundRect(i * bw + 1, h - Math.min(h, bh), bw - 2.5, Math.min(h, bh), 2); g.fill();
  }
}
let lastFrame = 0;
function loop(t) {
  requestAnimationFrame(loop);
  if (t - lastFrame < 33) return; lastFrame = t; // ~30 khung/giây
  for (const c of channels) { const r = rt.get(c.id); if (r) { updateSpec(c, r); recordHist(c, r); drawChannel(c, r, t); } }
  drawMaster(t);
}

/* ---------- Khởi động ---------- */
function showView(v) {
  view = v;
  document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.view === v));
  ['play', 'list', 'settings'].forEach(x => { $('#view-' + x).hidden = x !== v; });
  if (v === 'list') renderLibrary();
}
(async function init() {
  await load();
  document.querySelectorAll('.tabs button').forEach(b => b.onclick = () => showView(b.dataset.view));
  $('#exclusive').checked = settings.exclusive; $('#fadeSecs').value = settings.fade; $('#vizStyle').value = settings.viz;
  $('#exclusive').onchange = e => { settings.exclusive = e.target.checked; save(); };
  $('#fadeSecs').onchange = e => { settings.fade = Math.max(0, +e.target.value || 0); save(); };
  $('#vizStyle').onchange = e => { settings.viz = e.target.value; save(); };
  $('#libSearch').oninput = renderLibrary;
  $('#addChannel').onclick = () => { channels.push(newChannel('Kênh ' + (channels.length + 1), CH_ICONS[channels.length % CH_ICONS.length])); save(); buildAll(); };
  $('#showDevices').onclick = $('#showDevices2').onclick = askDevices;
  $('#resetAll').onclick = async () => { if (confirm('Xóa toàn bộ kênh, danh sách nhạc và cài đặt?')) { try { localStorage.removeItem('event-deck'); } catch {} await idb.clear(); location.reload(); } };
  navigator.mediaDevices?.addEventListener?.('devicechange', () => buildAll());
  $('#stopAll').onclick = () => channels.forEach(c => pauseFade(c, true));
  addEventListener('keydown', e => {
    if (/INPUT|SELECT|TEXTAREA/.test(e.target.tagName) && e.target.type !== 'range') return;
    if (view !== 'play') return;
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
  requestAnimationFrame(loop);
})();
