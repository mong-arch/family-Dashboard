import { createStore, newId, hasFirebaseConfig } from "./store.js";
import { seedData } from "./seed.js";
import { listen, speak, speechSupported, ttsSupported, stopSpeaking } from "./speech.js";
import { getWeather, cachedWeather, searchPlace, codeInfo, pmGrade, outfit, DEFAULT_PLACE } from "./weather.js";
import { gcalConfigured, getToken, listCalendars, fetchEvents, preloadGoogle } from "./gcal.js";

// =============================================================
//  공통 도우미
// =============================================================
const $ = (sel, el = document) => el.querySelector(sel);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const pad = (n) => String(n).padStart(2, "0");
const DAYS = ["월", "화", "수", "목", "금", "토", "일"];
const dateKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dayIdx = (d = new Date()) => (d.getDay() + 6) % 7; // 월=0 … 일=6
const parseDate = (s) => { const [y, m, d] = String(s).split("-").map(Number); return new Date(y, (m || 1) - 1, d || 1); };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const startOfDay = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const toMin = (t) => { const [h, m] = String(t || "0:0").split(":").map(Number); return (h || 0) * 60 + (m || 0); };
const won = (n) => `${(Number(n) || 0).toLocaleString("ko-KR")}원`;
const list = (obj) => Object.entries(obj || {}).filter(([, v]) => v && typeof v === "object").map(([id, v]) => ({ id, ...v }));
const fmtMD = (d) => `${d.getMonth() + 1}월 ${d.getDate()}일`;
const timeAgo = (ts) => {
  if (!ts) return "";
  const m = Math.floor((Date.now() - ts) / 60000);
  if (m < 1) return "방금";
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
};
const iga = (w) => { const c = String(w).trim().slice(-1).charCodeAt(0); return c >= 0xAC00 && c <= 0xD7A3 && (c - 0xAC00) % 28 ? "이" : "가"; };
const clock = (ts) => { const d = new Date(ts); return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };

const ROLES = {
  mom: { label: "엄마", emoji: "👩" },
  dad: { label: "아빠", emoji: "👨" },
  kid: { label: "아이", emoji: "🧒" },
  tablet: { label: "거실 태블릿", emoji: "📱" }
};
const PEOPLE = ["엄마", "아빠", "할머니", "할아버지", "셔틀", "스스로", "기타"];
const ACADEMY_TYPES = ["학원", "방과후", "운동", "기타"];
const COLORS = [
  { value: "peach", label: "복숭아" }, { value: "mint", label: "민트" }, { value: "sky", label: "하늘" },
  { value: "lemon", label: "레몬" }, { value: "lavender", label: "라벤더" }, { value: "pink", label: "핑크" }
];
const STATUS = [
  { key: "work", emoji: "💼", label: "일하는 중" },
  { key: "meeting", emoji: "📞", label: "회의 중" },
  { key: "commute", emoji: "🚗", label: "퇴근 중" },
  { key: "shopping", emoji: "🛒", label: "장보는 중" },
  { key: "home", emoji: "🏠", label: "집" },
  { key: "exercise", emoji: "🏃", label: "운동 중" },
  { key: "rest", emoji: "☕", label: "쉬는 중" },
  { key: "sleep", emoji: "😴", label: "자는 중" }
];
const BOARD_SIZE = 30;

// =============================================================
//  기기별 설정 (이 기기에만 저장)
// =============================================================
const device = {
  get(k, d) { try { const v = localStorage.getItem(`fd:${k}`); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { localStorage.setItem(`fd:${k}`, JSON.stringify(v)); }
};
const isParent = () => device.get("parentMode", false) === true;
const myRole = () => device.get("role", "tablet");

// =============================================================
//  상태
// =============================================================
let store = null;
let data = {};
let seededCheck = false;
const drafts = { mail: "", music: "" };
const seenMail = new Set();
let firstMailLoad = true;
const pending = new Set();

// =============================================================
//  화면 출력
// =============================================================
function paint(id, html) {
  const el = document.getElementById(id);
  if (!el) return;
  const a = document.activeElement;
  if (a && el.contains(a) && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) {
    pending.add(id);
    return;
  }
  el.innerHTML = html;
}
document.addEventListener("focusout", () => {
  setTimeout(() => {
    if (pending.size && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || "")) {
      pending.clear();
      renderAll();
    }
  }, 50);
});

function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove("show"), 2200);
}

function confetti(emojis = ["⭐", "🌟", "✨", "💛"]) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const box = $("#confetti");
  for (let i = 0; i < 18; i++) {
    const s = document.createElement("span");
    s.textContent = emojis[i % emojis.length];
    s.style.left = `${Math.random() * 100}%`;
    s.style.animationDelay = `${Math.random() * 0.4}s`;
    s.style.fontSize = `${18 + Math.random() * 22}px`;
    box.appendChild(s);
    setTimeout(() => s.remove(), 2200);
  }
}

// ---------------- 계산 ----------------
function academiesOn(d) {
  const idx = dayIdx(d);
  const k = dateKey(d);
  return list(data.academies)
    .filter((a) => a.repeat === false ? a.date === k : (a.days || []).map(Number).includes(idx))
    .sort((a, b) => toMin(a.start) - toMin(b.start));
}
// 이번 주(월~일) 기준 요일 번호로 찾기
function todayAcademies(idx = dayIdx()) {
  return academiesOn(addDays(startOfDay(), idx - dayIdx()));
}
function starTotals() {
  const logs = list(data.starsLog);
  const balance = logs.reduce((s, l) => s + (Number(l.amount) || 0), 0);
  const earned = logs.filter((l) => Number(l.amount) > 0).reduce((s, l) => s + Number(l.amount), 0);
  return { balance, earned, logs: logs.sort((a, b) => (b.ts || 0) - (a.ts || 0)) };
}
function todayProgress() {
  const k = dateKey();
  const routines = list(data.routines);
  const sheets = list(data.worksheets);
  const doneR = routines.filter((r) => data.daily?.[k]?.routines?.[r.id]).length;
  const doneW = sheets.filter((w) => data.daily?.[k]?.worksheets?.[w.id]).length;
  const pieces = activePieces();
  const doneP = pieces.filter((x) => pianoCount(x.id) >= pieceTarget(x)).length;
  const total = routines.length + sheets.length + pieces.length;
  const done = doneR + doneW + doneP;
  return { total, done, pct: total ? Math.round((done / total) * 100) : 0 };
}
function nextOccurrence(ev) {
  const today = startOfDay();
  let d = parseDate(ev.date);
  if (ev.yearly) {
    d = new Date(today.getFullYear(), d.getMonth(), d.getDate());
    if (d < today) d = new Date(today.getFullYear() + 1, d.getMonth(), d.getDate());
  }
  const diff = Math.round((d - today) / 86400000);
  return { date: d, diff };
}
function upcomingEvents() {
  return list(data.events)
    .map((e) => ({ ...e, ...nextOccurrence(e) }))
    .filter((e) => e.diff >= 0)
    .sort((a, b) => a.diff - b.diff);
}
function weekendKey() {
  const sat = addDays(startOfDay(), 5 - dayIdx());
  return dateKey(sat);
}
function ddayLabel(diff) { return diff === 0 ? "D-DAY" : `D-${diff}`; }
const statusOf = (key) => STATUS.find((s) => s.key === key) || STATUS[4];

// ---------------- 상단 ----------------
function renderTop() {
  const now = new Date();
  $("#today-label").textContent = `${now.getFullYear()}년 ${fmtMD(now)} ${DAYS[dayIdx(now)]}요일`;
  const btn = $("#mode-btn");
  btn.textContent = isParent() ? "👨‍👩‍👦 부모 모드" : "🧒 아이 모드";
  btn.setAttribute("aria-label", isParent() ? "부모 모드 사용 중. 누르면 아이 모드로 바뀝니다" : "아이 모드 사용 중. 누르면 부모 모드로 바뀝니다");
  document.body.classList.toggle("parent", isParent());
}

// ---------------- 오늘 한눈에 ----------------
function renderHero() {
  const name = data.settings?.childName || "우리 아들";
  const p = todayProgress();
  const { balance } = starTotals();
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
  const next = todayAcademies().find((a) => toMin(a.end) >= nowMin);
  const ev = [...upcomingEvents(), ...monthCalendarEvents().map((c) => ({ ...c, emoji: "📆" }))].sort((a, b) => a.diff - b.diff)[0];
  const ring = `conic-gradient(var(--coral) ${p.pct * 3.6}deg, #FFFFFF 0deg)`;
  paint("sec-hero", `
    <div class="hero-main">
      <div class="ring" style="background:${ring}" role="img" aria-label="오늘 할 일 ${p.pct}% 완료">
        <div class="ring-inner"><strong>${p.pct}%</strong><span>오늘 달성</span></div>
      </div>
      <div class="hero-text">
        <h2 id="hero-title">${esc(name)}, 오늘도 반짝반짝! ✨</h2>
        <p>오늘 할 일 <b>${p.done}</b> / ${p.total} 완료 · 모은 별 <b>⭐ ${balance}</b></p>
      </div>
    </div>
    <ul class="hero-tiles">
      <li><span class="tile-label">다음 일정</span><span class="tile-value">${next ? `${esc(next.start)} ${esc(next.name)}` : "오늘 일정 끝!"}</span>
        ${next && next.place ? `<span class="tile-sub">📍 ${esc(next.place)}</span>` : ""}</li>
      ${heroWeatherTile()}
      <li><span class="tile-label">다가오는 날</span><span class="tile-value">${ev ? `${esc(ev.emoji || "📌")} ${esc(ev.title)}` : "없음"}</span>
        ${ev ? `<span class="tile-sub">${ddayLabel(ev.diff)}</span>` : ""}</li>
    </ul>`);
}

function heroWeatherTile() {
  if (!wx) wx = cachedWeather(wxPlace());
  if (!wx) return `<li><span class="tile-label">날씨</span><span class="tile-value">불러오는 중…</span></li>`;
  const [emo, label] = codeInfo(wx.now.code);
  const today = wx.days.find((d) => d.date === dateKey()) || wx.days[0];
  const g = [pmGrade("pm10", wx.pm10), pmGrade("pm25", wx.pm25)].filter(Boolean).sort((a, b) => b.level - a.level)[0];
  const sub = [
    today ? `${Math.round(today.min)}° / ${Math.round(today.max)}°` : "",
    today && today.rain >= 50 ? `☂️ 비 ${today.rain}%` : "",
    g ? `먼지 ${g.label}` : ""
  ].filter(Boolean).join(" · ");
  return `<li class="tile-link"><a href="#sec-weather" aria-label="날씨 자세히 보기"><span class="tile-label">${esc(wxPlace().name)} 날씨</span><span class="tile-value">${emo} ${Math.round(wx.now.temp)}° ${label}</span>${sub ? `<span class="tile-sub">${sub}</span>` : ""}</a></li>`;
}

// ---------------- 1. 학원·방과후 스케줄 ----------------
function academyChip(a, compact = false) {
  return `<button type="button" class="ac-chip c-${esc(a.color || "sky")}" data-action="edit-academy" data-id="${esc(a.id)}" ${isParent() ? "" : "disabled"}>
    <span class="ac-time">${esc(a.start)}${compact ? "" : `–${esc(a.end)}`}</span>
    <span class="ac-name">${esc(a.name)}${a.repeat === false ? " ·1회" : ""}</span>
  </button>`;
}
function renderSchedule() {
  const today = todayAcademies();
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
  const todayHtml = today.length ? today.map((a) => {
    const st = nowMin > toMin(a.end) ? "done" : nowMin >= toMin(a.start) ? "now" : "next";
    const badge = { done: "끝났어요", now: "지금!", next: "" }[st];
    return `<li class="today-item c-${esc(a.color || "sky")} ${st}">
      <div class="ti-time"><strong>${esc(a.start)}</strong><span>${esc(a.end)}</span></div>
      <div class="ti-body">
        <p class="ti-name">${esc(a.name)} <span class="tag">${esc(a.type || "학원")}</span>${a.repeat === false ? ` <span class="tag">1회</span>` : ""} ${badge ? `<span class="badge ${st}">${badge}</span>` : ""}</p>
        ${a.place ? `<p class="ti-place">📍 ${esc(a.place)}</p>` : ""}
      </div>
      ${isParent() ? `<button type="button" class="mini-btn" data-action="edit-academy" data-id="${esc(a.id)}" aria-label="${esc(a.name)} 수정">✏️</button>` : ""}
    </li>`;
  }).join("") : `<li class="empty">오늘은 학원이 없어요. 신나게 놀자! 🎈</li>`;

  const tIdx = dayIdx();
  const week = DAYS.map((d, i) => {
    const items = todayAcademies(i);
    return `<div class="week-col ${i === tIdx ? "is-today" : ""} ${i >= 5 ? "weekend" : ""}">
      <p class="week-day">${d}${i === tIdx ? " · 오늘" : ""}</p>
      ${items.length ? items.map((a) => academyChip(a, true)).join("") : `<p class="week-empty">-</p>`}
    </div>`;
  }).join("");

  const ym = dateKey().slice(0, 7);
  const all = list(data.academies).filter((a) => a.repeat !== false || String(a.date || "").startsWith(ym));
  const feeTotal = all.reduce((s, a) => s + (Number(a.fee) || 0), 0);
  const upcomingOnce = list(data.academies).filter((a) => a.repeat === false && a.date >= dateKey()).sort((a, b) => a.date.localeCompare(b.date));
  const feeHtml = isParent() ? `
    <div class="fee-box parent-only">
      <div class="fee-head"><h3>💰 이번 달 학원비</h3><strong>${won(feeTotal)}</strong></div>
      <ul class="fee-list">${all.sort((a, b) => (Number(b.fee) || 0) - (Number(a.fee) || 0)).map((a) => `<li><span>${esc(a.name)}${a.repeat === false ? ` (1회 · ${esc(a.date.slice(5).replace("-", "/"))})` : ""}</span><span>${won(a.fee)}</span></li>`).join("") || "<li>등록된 학원이 없어요</li>"}</ul>
    </div>` : "";

  paint("sec-schedule", `
    <div class="card-head">
      <h2 id="schedule-title">📅 학원·방과후 스케줄</h2>
      ${isParent() ? `<button type="button" class="btn small" data-action="add-academy">+ 학원·일정 추가</button>` : ""}
    </div>
    <div class="schedule-grid">
      <div>
        <h3 class="sub-title">오늘 일정</h3>
        <ul class="today-list">${todayHtml}</ul>
      </div>
      <div class="week-wrap">
        <h3 class="sub-title">이번 주 시간표</h3>
        <div class="week-scroll" tabindex="0" aria-label="주간 시간표"><div class="week">${week}</div></div>
        ${upcomingOnce.length ? `<h3 class="sub-title">다가오는 1회 일정</h3><ul class="log-list">${upcomingOnce.map((a) => { const d = parseDate(a.date); return `<li><span>${fmtMD(d)}(${DAYS[dayIdx(d)]}) ${esc(a.start)} ${esc(a.name)}</span>${isParent() ? `<button type="button" class="link-btn" data-action="edit-academy" data-id="${esc(a.id)}">수정</button>` : ""}</li>`; }).join("")}</ul>` : ""}
      </div>
    </div>
    ${feeHtml}`);
}

function academyForm(a = {}) {
  openForm({
    title: a.id ? "일정 수정" : "학원·일정 추가",
    fields: [
      { name: "name", label: "이름", type: "text", value: a.name, required: true, placeholder: "예: 피아노" },
      { name: "type", label: "종류", type: "select", value: a.type || "학원", options: ACADEMY_TYPES },
      { name: "repeat", label: "🔁 매주 반복 (체크 해제하면 한 번만 있는 일정: 보강·특강 등)", type: "checkbox", value: a.repeat !== false },
      { name: "days", label: "요일 (매주 반복일 때)", type: "days", value: (a.days || []).map(Number) },
      { name: "date", label: "날짜 (한 번만일 때)", type: "date", value: a.date || dateKey() },
      { name: "start", label: "시작", type: "time", value: a.start || "15:00", required: true, half: true },
      { name: "end", label: "끝", type: "time", value: a.end || "16:00", required: true, half: true },
      { name: "place", label: "장소", type: "text", value: a.place, placeholder: "예: OO피아노" },
      { name: "supplies", label: "준비물 (쉼표로 구분)", type: "text", value: a.supplies, placeholder: "예: 리코더, 악보 파일, 실내화" },
      { name: "fee", label: "월 학원비(원)", type: "number", value: a.fee ?? "", min: 0, step: 100, inputmode: "numeric" },
      { name: "color", label: "색깔", type: "select", value: a.color || "sky", options: COLORS }
    ],
    onSubmit: (v) => {
      if (v.repeat && !v.days.length) { toast("요일을 하나 이상 골라 주세요"); return false; }
      if (!v.repeat && !v.date) { toast("날짜를 골라 주세요"); return false; }
      const id = a.id || newId();
      const rec = { ...v, fee: Number(v.fee) || 0 };
      if (v.repeat) delete rec.date; else rec.days = [];
      store.set(`academies/${id}`, rec);
      toast("저장했어요");
    },
    onDelete: a.id ? () => { store.remove(`academies/${a.id}`); toast("삭제했어요"); } : null
  });
}

// ---------------- 2. 오늘 공부 & 학습지 ----------------
function renderStudy() {
  const k = dateKey();
  const p = todayProgress();
  const routines = list(data.routines).sort((a, b) => (a.order || 0) - (b.order || 0));
  const sheets = list(data.worksheets);
  const rHtml = routines.map((r) => {
    const done = !!data.daily?.[k]?.routines?.[r.id];
    return `<li class="check-row ${done ? "done" : ""}">
      <button type="button" class="check-btn" data-action="toggle-routine" data-id="${esc(r.id)}" aria-pressed="${done}">
        <span class="check-box" aria-hidden="true">${done ? "✓" : ""}</span>
        <span class="check-emoji" aria-hidden="true">${esc(r.emoji || "✅")}</span>
        <span class="check-label">${esc(r.title)}</span>
        <span class="check-stars">⭐${Number(r.stars) || 1}</span>
      </button>
      ${isParent() ? `<button type="button" class="mini-btn" data-action="edit-routine" data-id="${esc(r.id)}" aria-label="${esc(r.title)} 수정">✏️</button>` : ""}
    </li>`;
  }).join("") || `<li class="empty">루틴을 추가해 주세요</li>`;

  const wHtml = sheets.map((w) => {
    const done = !!data.daily?.[k]?.worksheets?.[w.id];
    const total = Number(w.total) || 0;
    const cur = Math.max(0, Math.min(Number(w.current) || 0, total || Infinity));
    const pct = total ? Math.round((cur / total) * 100) : 0;
    return `<li class="sheet ${done ? "done" : ""}">
      <div class="sheet-head">
        <p class="sheet-name">${esc(w.name)} <span class="tag">${esc(w.level || "")}</span></p>
        ${isParent() ? `<button type="button" class="mini-btn" data-action="edit-sheet" data-id="${esc(w.id)}" aria-label="${esc(w.name)} 수정">✏️</button>` : ""}
      </div>
      <div class="bar" role="img" aria-label="진도 ${cur} / ${total}${esc(w.unit || "")}"><span style="width:${pct}%"></span></div>
      <p class="sheet-meta">진도 ${cur} / ${total}${esc(w.unit || "")} (${pct}%)</p>
      <button type="button" class="check-btn sheet-check" data-action="toggle-sheet" data-id="${esc(w.id)}" aria-pressed="${done}">
        <span class="check-box" aria-hidden="true">${done ? "✓" : ""}</span>
        <span class="check-label">오늘 분량 ${Number(w.daily) || 0}${esc(w.unit || "")} ${done ? "끝!" : "하기"}</span>
        <span class="check-stars">⭐${Number(w.stars) || 2}</span>
      </button>
    </li>`;
  }).join("") || `<li class="empty">학습지를 추가해 주세요</li>`;

  paint("sec-study", `
    <div class="card-head">
      <h2 id="study-title">📚 오늘 공부할 것</h2>
      <span class="pill">${p.done}/${p.total} · ${p.pct}%</span>
    </div>
    <div class="bar big" role="img" aria-label="오늘 달성률 ${p.pct}%"><span style="width:${p.pct}%"></span></div>
    <h3 class="sub-title">오늘의 루틴 ${isParent() ? `<button type="button" class="link-btn" data-action="add-routine">+ 추가</button>` : ""}</h3>
    <ul class="check-list">${rHtml}</ul>
    <h3 class="sub-title">학습지 ${isParent() ? `<button type="button" class="link-btn" data-action="add-sheet">+ 추가</button>` : ""}</h3>
    <ul class="sheet-list">${wHtml}</ul>`);
}

async function toggleDaily(kind, id) {
  const k = dateKey();
  const item = data[kind]?.[id];
  if (!item) return;
  const done = !!data.daily?.[k]?.[kind]?.[id];
  const stars = Number(item.stars) || (kind === "worksheets" ? 2 : 1);
  const logKey = `${k}_${kind === "worksheets" ? "w" : "r"}_${id}`;
  const patch = {
    [`daily/${k}/${kind}/${id}`]: done ? null : true,
    [`starsLog/${logKey}`]: done ? null : { amount: stars, reason: item.title || item.name, date: k, ts: Date.now() }
  };
  await store.update("", patch);
  if (kind === "worksheets" && Number(item.daily)) {
    await store.inc(`worksheets/${id}/current`, done ? -Number(item.daily) : Number(item.daily));
  }
  if (!done) {
    toast(`⭐ ${stars}개 받았어요!`);
    confetti();
    const p = todayProgress();
    if (p.total && p.done === p.total) setTimeout(() => { toast("🎉 오늘 할 일 모두 끝! 최고야!"); confetti(["🎉", "🌈", "⭐", "💖"]); }, 600);
  }
}

function routineForm(r = {}) {
  openForm({
    title: r.id ? "루틴 수정" : "루틴 추가",
    fields: [
      { name: "title", label: "할 일", type: "text", value: r.title, required: true, placeholder: "예: 책 20분 읽기" },
      { name: "emoji", label: "그림(이모지)", type: "text", value: r.emoji || "✅", half: true },
      { name: "stars", label: "별 개수", type: "number", value: r.stars ?? 1, min: 1, max: 10, half: true },
      { name: "order", label: "순서", type: "number", value: r.order ?? list(data.routines).length + 1, min: 0 }
    ],
    onSubmit: (v) => { store.set(`routines/${r.id || newId()}`, { ...v, stars: Number(v.stars) || 1, order: Number(v.order) || 0 }); toast("저장했어요"); },
    onDelete: r.id ? () => store.remove(`routines/${r.id}`) : null
  });
}
function sheetForm(w = {}) {
  openForm({
    title: w.id ? "학습지 수정" : "학습지 추가",
    fields: [
      { name: "name", label: "학습지 이름", type: "text", value: w.name, required: true, placeholder: "예: 눈높이 수학" },
      { name: "level", label: "현재 단계", type: "text", value: w.level, placeholder: "예: C단계", half: true },
      { name: "unit", label: "단위", type: "text", value: w.unit || "장", half: true },
      { name: "current", label: "현재 진도", type: "number", value: w.current ?? 0, min: 0, half: true },
      { name: "total", label: "단계 전체", type: "number", value: w.total ?? 40, min: 1, half: true },
      { name: "daily", label: "하루 분량", type: "number", value: w.daily ?? 2, min: 0, half: true },
      { name: "stars", label: "완료 별 개수", type: "number", value: w.stars ?? 2, min: 1, max: 10, half: true }
    ],
    onSubmit: (v) => {
      store.set(`worksheets/${w.id || newId()}`, { ...v, current: Number(v.current) || 0, total: Number(v.total) || 1, daily: Number(v.daily) || 0, stars: Number(v.stars) || 2 });
      toast("저장했어요");
    },
    onDelete: w.id ? () => store.remove(`worksheets/${w.id}`) : null
  });
}

// ---------------- 2-2. 별 스티커판 ----------------
function renderStars() {
  const { balance, earned, logs } = starTotals();
  const boards = Math.floor(earned / BOARD_SIZE);
  const filled = earned % BOARD_SIZE;
  const slots = Array.from({ length: BOARD_SIZE }, (_, i) => `<span class="slot ${i < filled ? "on" : ""}" aria-hidden="true">${i < filled ? "⭐" : i + 1}</span>`).join("");
  const recent = logs.slice(0, 5).map((l) => `<li><span>${esc(l.reason || "")}</span><span class="${Number(l.amount) < 0 ? "minus" : "plus"}">${Number(l.amount) > 0 ? "+" : ""}${Number(l.amount)}</span></li>`).join("");
  paint("sec-stars", `
    <div class="card-head">
      <h2 id="stars-title">🌟 별 스티커판</h2>
      ${isParent() ? `<button type="button" class="btn small" data-action="bonus-star">+ 칭찬 별</button>` : ""}
    </div>
    <div class="star-summary">
      <div><span class="tile-label">지금 쓸 수 있는 별</span><strong class="star-big">⭐ ${balance}</strong></div>
      <div><span class="tile-label">완성한 스티커판</span><strong class="star-mid">${boards}장</strong></div>
    </div>
    <div class="board" role="img" aria-label="스티커판 ${BOARD_SIZE}칸 중 ${filled}칸 채움">${slots}</div>
    <p class="hint">${BOARD_SIZE - filled}개만 더 모으면 스티커판 완성!</p>
    ${recent ? `<h3 class="sub-title">최근 기록</h3><ul class="log-list">${recent}</ul>` : ""}`);
}

// ---------------- 2-3. 보상 상점 ----------------
function renderShop() {
  const { balance } = starTotals();
  const rewards = list(data.rewards).sort((a, b) => (Number(a.cost) || 0) - (Number(b.cost) || 0));
  const items = rewards.map((r) => {
    const can = balance >= (Number(r.cost) || 0);
    return `<li class="reward ${can ? "can" : ""}">
      <span class="reward-emoji" aria-hidden="true">${esc(r.emoji || "🎁")}</span>
      <p class="reward-title">${esc(r.title)}</p>
      <p class="reward-cost">⭐ ${Number(r.cost) || 0}</p>
      <button type="button" class="btn small ${can ? "primary" : ""}" data-action="redeem" data-id="${esc(r.id)}" ${can ? "" : "disabled"}>${can ? "교환하기" : `${(Number(r.cost) || 0) - balance}개 더`}</button>
      ${isParent() ? `<button type="button" class="mini-btn corner" data-action="edit-reward" data-id="${esc(r.id)}" aria-label="${esc(r.title)} 수정">✏️</button>` : ""}
    </li>`;
  }).join("") || `<li class="empty">보상을 추가해 주세요</li>`;
  const used = list(data.starsLog).filter((l) => Number(l.amount) < 0).sort((a, b) => b.ts - a.ts).slice(0, 4);
  paint("sec-shop", `
    <div class="card-head">
      <h2 id="shop-title">🎁 보상 상점</h2>
      ${isParent() ? `<button type="button" class="btn small" data-action="add-reward">+ 보상 추가</button>` : ""}
    </div>
    <p class="hint">내 별: <b>⭐ ${balance}</b> · 교환할 때 엄마·아빠 확인이 필요해요</p>
    <ul class="reward-grid">${items}</ul>
    ${used.length ? `<h3 class="sub-title">사용 기록</h3><ul class="log-list">${used.map((l) => `<li><span>${esc(l.reason)} · ${esc(l.date)}</span><span class="minus">${l.amount}</span></li>`).join("")}</ul>` : ""}`);
}
function rewardForm(r = {}) {
  openForm({
    title: r.id ? "보상 수정" : "보상 추가",
    fields: [
      { name: "title", label: "보상 이름", type: "text", value: r.title, required: true, placeholder: "예: 보드게임 한 판" },
      { name: "emoji", label: "그림(이모지)", type: "text", value: r.emoji || "🎁", half: true },
      { name: "cost", label: "필요한 별", type: "number", value: r.cost ?? 10, min: 1, half: true }
    ],
    onSubmit: (v) => { store.set(`rewards/${r.id || newId()}`, { ...v, cost: Number(v.cost) || 1 }); toast("저장했어요"); },
    onDelete: r.id ? () => store.remove(`rewards/${r.id}`) : null
  });
}
async function redeem(id) {
  const r = data.rewards?.[id];
  if (!r) return;
  const cost = Number(r.cost) || 0;
  const doIt = () => {
    if (starTotals().balance < cost) { toast("별이 모자라요"); return; }
    store.set(`starsLog/${newId()}`, { amount: -cost, reason: `${r.emoji || "🎁"} ${r.title}`, date: dateKey(), ts: Date.now() });
    toast(`${r.title} 교환 완료! 🎉`);
    confetti(["🎁", "🎉", "💖", "⭐"]);
  };
  if (isParent()) { doIt(); return; }
  askPin(`"${r.title}"(⭐${cost}) 교환을 확인해 주세요`, doIt);
}

// ---------------- 3. 가족 행사 & D-Day ----------------
function monthCalendarEvents() {
  const today = startOfDay();
  const ym = dateKey(today).slice(0, 7);
  return list(data.calendar?.events)
    .filter((c) => String(c.date).startsWith(ym))
    .map((c) => ({ ...c, kind: "gcal", date: parseDate(c.date), diff: Math.round((parseDate(c.date) - today) / 86400000) }))
    .filter((c) => c.diff >= 0);
}
function renderDday() {
  const fam = upcomingEvents().map((e) => ({ ...e, kind: "family" }));
  const cal = monthCalendarEvents();
  const all = [...fam, ...cal].sort((a, b) => a.diff - b.diff || String(a.time || "").localeCompare(String(b.time || "")));
  const past = list(data.events).filter((e) => !e.yearly && nextOccurrence(e).diff < 0);
  const synced = data.calendar?.syncedAt;
  const now = new Date();
  paint("sec-dday", `
    <div class="card-head">
      <h2 id="dday-title">🎂 가족 행사 & ${now.getMonth() + 1}월 일정</h2>
      ${isParent() ? `<button type="button" class="btn small" data-action="add-event">+ 행사 추가</button>` : ""}
    </div>
    <ul class="dday-list">
      ${all.map((e) => e.kind === "gcal" ? `<li class="dday gcal ${e.diff === 0 ? "today" : e.diff <= 7 ? "soon" : ""}">
        <span class="dday-emoji" aria-hidden="true">📆</span>
        <div class="dday-body"><p class="dday-title">${esc(e.title)}</p><p class="dday-date">${fmtMD(e.date)} (${DAYS[dayIdx(e.date)]})${e.time ? ` ${esc(e.time)}` : " · 하루 종일"}${e.place ? ` · ${esc(e.place)}` : ""} <span class="tag">구글 캘린더</span></p></div>
        <strong class="dday-count">${ddayLabel(e.diff)}</strong>
      </li>` : `<li class="dday ${e.diff === 0 ? "today" : e.diff <= 7 ? "soon" : ""}">
        <span class="dday-emoji" aria-hidden="true">${esc(e.emoji || "📌")}</span>
        <div class="dday-body"><p class="dday-title">${esc(e.title)}</p><p class="dday-date">${e.date.getFullYear()}. ${fmtMD(e.date)} (${DAYS[dayIdx(e.date)]})${e.yearly ? " · 매년" : ""}</p></div>
        <strong class="dday-count">${ddayLabel(e.diff)}</strong>
        ${isParent() ? `<button type="button" class="mini-btn" data-action="edit-event" data-id="${esc(e.id)}" aria-label="${esc(e.title)} 수정">✏️</button>` : ""}
      </li>`).join("") || `<li class="empty">다가오는 행사가 없어요</li>`}
    </ul>
    ${isParent() ? `<div class="gcal-bar">
      <button type="button" class="btn small" data-action="gcal-sync">📆 ${synced ? "구글 캘린더 다시 가져오기" : "구글 캘린더 가져오기"}</button>
      ${data.settings?.gcal?.calendars?.length ? `<button type="button" class="link-btn" data-action="gcal-pick">캘린더 고르기</button>` : ""}
      ${synced ? `<span class="hint">마지막: ${timeAgo(synced)}${data.calendar?.by ? ` · ${esc(ROLES[data.calendar.by]?.label || "")}` : ""}</span>` : ""}
    </div>` : ""}
    ${isParent() && past.length ? `<p class="hint">지난 행사 ${past.length}개는 숨겨져 있어요. <button type="button" class="link-btn" data-action="clean-events">정리하기</button></p>` : ""}`);
}
let gcalBusy = false;
async function pickCalendars() {
  const cals = await listCalendars();
  const cur = data.settings?.gcal || {};
  return new Promise((resolve) => {
    let done = false;
    const finish = (v) => { if (!done) { done = true; resolve(v); } };
    setTimeout(() => $("#form-dialog").addEventListener("close", () => finish(null), { once: true }), 0);
    openForm({
      title: "📆 가져올 캘린더 고르기",
      fields: [
        { name: "calendars", label: "캘린더", type: "multi", value: cur.calendars?.map((c) => c.id) || cals.filter((c) => c.primary).map((c) => c.id), options: cals.map((c) => ({ value: c.id, label: `${c.name}${c.primary ? " (기본)" : ""}` })) },
        { name: "filter", label: "어떤 일정을 가져올까요?", type: "select", value: cur.filter || "all", options: [
          { value: "all", label: "고른 캘린더의 모든 일정" },
          { value: "allday", label: "하루 종일 일정만" },
          { value: "keyword", label: "제목에 아래 단어가 들어간 일정만" }
        ] },
        { name: "keyword", label: "단어 (여러 개는 쉼표로)", type: "text", value: cur.keyword || "", placeholder: "예: 공연, 예매, 가족, 학교" }
      ],
      note: "가져온 일정 제목은 가족 코드를 아는 모든 기기(아이 화면 포함)에 보여요. 회사 일정이 섞인 캘린더는 빼거나 단어 필터를 써 주세요.",
      submitLabel: "이걸로 가져오기",
      onSubmit: (v) => {
        if (!v.calendars.length) { toast("캘린더를 하나 이상 골라 주세요"); return false; }
        const chosen = cals.filter((c) => v.calendars.includes(c.id)).map((c) => ({ id: c.id, name: c.name }));
        const setting = { calendars: chosen, filter: v.filter, keyword: v.keyword };
        store.set("settings/gcal", setting);
        finish(setting);
      }
    });
  });
}
async function syncCalendar(forcePick = false) {
  if (!gcalConfigured()) {
    toast("먼저 README의 '구글 캘린더 연결' 설정이 필요해요");
    return;
  }
  if (gcalBusy) return;
  gcalBusy = true;
  try {
    await getToken();
    let setting = data.settings?.gcal;
    if (forcePick || !setting?.calendars?.length) setting = await pickCalendars();
    if (!setting) return;
    toast("구글 캘린더에서 가져오는 중…");
    const from = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const to = new Date(from.getFullYear(), from.getMonth() + 2, 1);
    let evs = await fetchEvents(setting.calendars, from, to);
    if (setting.filter === "allday") evs = evs.filter((e) => e.allDay);
    if (setting.filter === "keyword") {
      const words = String(setting.keyword || "").split(",").map((w) => w.trim()).filter(Boolean);
      if (words.length) evs = evs.filter((e) => words.some((w) => e.title.includes(w)));
    }
    const events = {};
    evs.forEach((e) => { const { key, ...rest } = e; events[key] = rest; });
    await store.set("calendar", { events, syncedAt: Date.now(), by: myRole() });
    toast(`📆 일정 ${evs.length}개를 가져왔어요`);
  } catch (err) {
    console.error(err);
    const msg = String(err?.message || err);
    toast(/popup/.test(msg) ? "팝업이 막혔어요. 팝업을 허용하고 다시 눌러 주세요" : /access_denied/.test(msg) ? "구글 권한을 허용해야 가져올 수 있어요" : msg);
  } finally {
    gcalBusy = false;
  }
}
function eventForm(e = {}) {
  openForm({
    title: e.id ? "행사 수정" : "행사 추가",
    fields: [
      { name: "title", label: "행사 이름", type: "text", value: e.title, required: true, placeholder: "예: 할머니 생신" },
      { name: "date", label: "날짜", type: "date", value: e.date || dateKey(), required: true, half: true },
      { name: "emoji", label: "그림(이모지)", type: "text", value: e.emoji || "🎉", half: true },
      { name: "yearly", label: "매년 반복 (생일·기념일)", type: "checkbox", value: e.yearly ?? true }
    ],
    note: "음력 생신은 매년 양력 날짜가 바뀌니, '매년 반복'을 끄고 그해 양력 날짜로 넣어 주세요.",
    onSubmit: (v) => { store.set(`events/${e.id || newId()}`, v); toast("저장했어요"); },
    onDelete: e.id ? () => store.remove(`events/${e.id}`) : null
  });
}

// ---------------- 4. 저녁 메뉴 ----------------
function renderMeal() {
  const today = startOfDay();
  const days = [0, -1].map((n) => addDays(today, n));
  const hist = Array.from({ length: 5 }, (_, i) => addDays(today, -(i + 2)))
    .map((d) => ({ d, m: data.meals?.[dateKey(d)] }))
    .filter((x) => x.m);
  paint("sec-meal", `
    <div class="card-head"><h2 id="meal-title">🍚 저녁 메뉴</h2></div>
    <div class="meal-inputs">
      ${days.map((d, i) => `<label class="meal-field">
        <span>${i === 0 ? "오늘" : "어제"} 저녁 <small>${fmtMD(d)}</small></span>
        <input type="text" data-meal="${dateKey(d)}" value="${esc(data.meals?.[dateKey(d)] || "")}" placeholder="${i === 0 ? "예: 김치찌개, 계란말이" : "어제 뭐 먹었지?"}" enterkeyhint="done">
      </label>`).join("")}
    </div>
    ${hist.length ? `<h3 class="sub-title">지난 저녁</h3><ul class="log-list">${hist.map((x) => `<li><span>${fmtMD(x.d)} (${DAYS[dayIdx(x.d)]})</span><span>${esc(x.m)}</span></li>`).join("")}</ul>` : `<p class="hint">입력하면 모든 기기에 바로 보여요.</p>`}`);
}

// ---------------- 4-2. 주말 계획 ----------------
function renderWeekend() {
  const wk = weekendKey();
  const sat = parseDate(wk);
  const sun = addDays(sat, 1);
  const items = list(data.weekend?.[wk]).sort((a, b) => (a.ts || 0) - (b.ts || 0));
  paint("sec-weekend", `
    <div class="card-head">
      <h2 id="weekend-title">🧺 이번 주말 계획</h2>
      <button type="button" class="btn small" data-action="add-weekend">+ 계획 추가</button>
    </div>
    <p class="hint">${fmtMD(sat)}(토) ~ ${fmtMD(sun)}(일)</p>
    <ul class="plan-grid">
      ${items.map((p) => `<li class="plan ${p.done ? "done" : ""}">
        <button type="button" class="check-btn" data-action="toggle-weekend" data-id="${esc(p.id)}" aria-pressed="${!!p.done}">
          <span class="check-box" aria-hidden="true">${p.done ? "✓" : ""}</span>
          <span class="plan-body"><span class="plan-when">${esc(p.when || "주말")}</span><span class="check-label">${esc(p.title)}</span>${p.note ? `<span class="plan-note">${esc(p.note)}</span>` : ""}</span>
        </button>
        <button type="button" class="mini-btn" data-action="edit-weekend" data-id="${esc(p.id)}" aria-label="${esc(p.title)} 수정">✏️</button>
      </li>`).join("") || `<li class="empty">이번 주말엔 뭐 할까? 계획을 추가해 봐요 🌳</li>`}
    </ul>`);
}
function weekendForm(p = {}) {
  const wk = weekendKey();
  openForm({
    title: p.id ? "주말 계획 수정" : "주말 계획 추가",
    fields: [
      { name: "title", label: "무엇을 할까요?", type: "text", value: p.title, required: true, placeholder: "예: 동물원 나들이" },
      { name: "when", label: "언제", type: "select", value: p.when || "토요일", options: ["토요일", "일요일", "주말"], half: true },
      { name: "note", label: "메모", type: "text", value: p.note, placeholder: "예: 도시락 챙기기", half: true }
    ],
    onSubmit: (v) => { store.set(`weekend/${wk}/${p.id || newId()}`, { ...v, done: !!p.done, ts: p.ts || Date.now() }); toast("저장했어요"); },
    onDelete: p.id ? () => store.remove(`weekend/${wk}/${p.id}`) : null
  });
}

// ---------------- 5. 부모 현재 상태 ----------------
function renderStatus() {
  const people = [{ key: "mom", ...ROLES.mom }, { key: "dad", ...ROLES.dad }];
  paint("sec-status", `
    <div class="card-head"><h2 id="status-title">🙋 엄마·아빠 지금은?</h2></div>
    <div class="status-grid">
      ${people.map((p) => {
        const s = data.status?.[p.key] || {};
        const st = statusOf(s.state);
        const canEdit = isParent();
        return `<div class="status-card">
          <button type="button" class="status-face" data-action="poke" data-who="${p.key}" aria-label="${p.label}: ${st.label}. 누르면 인사해요">
            <span class="face" aria-hidden="true">${p.emoji}</span>
            <span class="status-emoji" aria-hidden="true">${st.emoji}</span>
          </button>
          <p class="status-name">${p.label}</p>
          <p class="status-label">${st.label}</p>
          <p class="status-time">${s.ts ? timeAgo(s.ts) : ""}</p>
          ${canEdit ? `<div class="status-chips" role="group" aria-label="${p.label} 상태 바꾸기">
            ${STATUS.map((o) => `<button type="button" class="chip ${o.key === s.state ? "on" : ""}" data-action="set-status" data-who="${p.key}" data-state="${o.key}" aria-pressed="${o.key === s.state}">${o.emoji} ${o.label}</button>`).join("")}
          </div>` : ""}
        </div>`;
      }).join("")}
    </div>
    ${isParent() ? "" : `<p class="hint">얼굴을 눌러 보세요!</p>`}`);
}
function poke(btn) {
  if (!btn) return;
  btn.classList.remove("wiggle");
  void btn.offsetWidth;
  btn.classList.add("wiggle");
  const hearts = ["💖", "💛", "💚", "💙", "💜"];
  for (let i = 0; i < 6; i++) {
    const h = document.createElement("span");
    h.className = "float-heart";
    h.textContent = hearts[i % hearts.length];
    h.style.left = `${20 + Math.random() * 60}%`;
    h.style.animationDelay = `${i * 0.08}s`;
    btn.appendChild(h);
    setTimeout(() => h.remove(), 1500);
  }
}

// ---------------- 5-2. 가족 우체통 ----------------
function renderMail() {
  const msgs = list(data.mailbox).sort((a, b) => (b.ts || 0) - (a.ts || 0)).slice(0, 30);
  const me = myRole();
  paint("sec-mail", `
    <div class="card-head">
      <h2 id="mail-title">💌 가족 우체통</h2>
      ${ttsSupported() && msgs.length ? `<button type="button" class="btn small" data-action="read-all">🔊 최근 메모 읽기</button>` : ""}
    </div>
    <div class="mail-compose">
      <label for="mail-text" class="visually-hidden">메모 내용</label>
      <textarea id="mail-text" rows="2" placeholder="${ROLES[me].emoji} ${ROLES[me].label}(으)로 메모 남기기…">${esc(drafts.mail)}</textarea>
      <div class="compose-actions">
        ${speechSupported() ? `<button type="button" class="btn mic" data-action="mic-mail" aria-label="말로 메모하기">🎤 말하기</button>` : ""}
        <button type="button" class="btn primary" data-action="send-mail">보내기</button>
      </div>
    </div>
    <ul class="mail-list">
      ${msgs.map((m) => {
        const r = ROLES[m.from] || ROLES.tablet;
        const mine = m.from === me;
        return `<li class="mail ${m.from}">
          <span class="mail-from" aria-hidden="true">${r.emoji}</span>
          <div class="mail-body">
            <p class="mail-meta"><b>${r.label}</b> · ${clock(m.ts)}</p>
            <p class="mail-text">${esc(m.text)}</p>
          </div>
          <div class="mail-actions">
            ${ttsSupported() ? `<button type="button" class="mini-btn" data-action="speak-mail" data-id="${esc(m.id)}" aria-label="읽어주기">🔊</button>` : ""}
            ${mine || isParent() ? `<button type="button" class="mini-btn" data-action="del-mail" data-id="${esc(m.id)}" aria-label="메모 지우기">🗑️</button>` : ""}
          </div>
        </li>`;
      }).join("") || `<li class="empty">아직 메모가 없어요</li>`}
    </ul>
    ${speechSupported() ? "" : `<p class="hint">이 브라우저는 음성 입력을 지원하지 않아요. (안드로이드 크롬, PC 크롬에서 잘 돼요)</p>`}`);
}
function mailSpeechText(m) {
  const r = ROLES[m.from] || ROLES.tablet;
  return `${r.label}의 메모. ${m.text}`;
}
function checkNewMail() {
  const msgs = list(data.mailbox);
  const fresh = msgs.filter((m) => !seenMail.has(m.id));
  msgs.forEach((m) => seenMail.add(m.id));
  if (firstMailLoad) { firstMailLoad = false; return; }
  const incoming = fresh.filter((m) => m.from !== myRole()).sort((a, b) => a.ts - b.ts);
  if (!incoming.length) return;
  toast(`💌 새 메모 ${incoming.length}개`);
  if (device.get("autoRead", myRole() === "tablet") && ttsSupported()) {
    speak(incoming.map(mailSpeechText).join(" "));
  }
}

// ---------------- 6. 음악 ----------------
const melonUrl = (q) => `https://www.melon.com/search/total/index.htm?q=${encodeURIComponent(q)}`;
const IS_ANDROID = /Android/i.test(navigator.userAgent);
const MELON_PKG = "com.iloen.melon";
const melonAppIntent = (q) => `intent:#Intent;action=android.intent.action.MAIN;category=android.intent.category.LAUNCHER;package=${MELON_PKG};S.browser_fallback_url=${encodeURIComponent(melonUrl(q))};end`;
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* 아래 방식으로 */ }
  try {
    const t = document.createElement("textarea");
    t.value = text; t.setAttribute("readonly", ""); t.style.position = "fixed"; t.style.opacity = "0";
    document.body.appendChild(t); t.select();
    const ok = document.execCommand("copy");
    t.remove();
    return ok;
  } catch { return false; }
}
async function openMelonApp(q) {
  const copied = await copyText(q);
  toast(copied ? `"${q}" 복사했어요 · 멜론 검색창에 붙여넣기 하세요` : "멜론 앱을 열어요");
  setTimeout(() => { location.href = melonAppIntent(q); }, copied ? 400 : 0);
}
const ytmUrl = (q) => `https://music.youtube.com/search?q=${encodeURIComponent(q)}`;
function renderMusic() {
  const favs = list(data.music?.favorites).sort((a, b) => (a.ts || 0) - (b.ts || 0));
  const q = drafts.music.trim();
  paint("sec-music", `
    <div class="card-head"><h2 id="music-title">🎵 음악 듣기</h2></div>
    <div class="music-search">
      <label for="music-q" class="visually-hidden">노래 제목이나 가수</label>
      <input id="music-q" type="search" value="${esc(drafts.music)}" placeholder="노래 제목이나 가수를 말하거나 적어요" enterkeyhint="search">
      ${speechSupported() ? `<button type="button" class="btn mic" data-action="mic-music" aria-label="말로 검색어 입력">🎤</button>` : ""}
    </div>
    <div class="music-actions">
      <a class="btn melon ${q ? "" : "is-disabled"}" ${q ? `href="${melonUrl(q)}"` : `aria-disabled="true"`} target="_blank" rel="noopener" data-music-link="melon" data-melon-q="${esc(q)}">🍈 ${IS_ANDROID ? "멜론 앱에서 찾기" : "멜론에서 찾기"}</a>
      <a class="btn ytm ${q ? "" : "is-disabled"}" ${q ? `href="${ytmUrl(q)}"` : `aria-disabled="true"`} target="_blank" rel="noopener" data-music-link="ytm">▶️ 유튜브 뮤직</a>
      <button type="button" class="btn small" data-action="fav-add" ${q ? "" : "disabled"}>☆ 즐겨찾기</button>
    </div>
    <h3 class="sub-title">자주 듣는 노래</h3>
    <ul class="fav-list">
      ${favs.map((f) => {
        const term = [f.title, f.artist].filter(Boolean).join(" ");
        return `<li class="fav">
          <div class="fav-body"><p class="fav-title">${esc(f.title)}</p>${f.artist ? `<p class="fav-artist">${esc(f.artist)}</p>` : ""}</div>
          <a class="mini-btn melon" href="${melonUrl(term)}" target="_blank" rel="noopener" data-melon-q="${esc(term)}" aria-label="${esc(term)} 멜론에서 찾기">🍈</a>
          <a class="mini-btn ytm" href="${ytmUrl(term)}" target="_blank" rel="noopener" aria-label="${esc(term)} 유튜브 뮤직에서 찾기">▶️</a>
          <button type="button" class="mini-btn" data-action="fav-edit" data-id="${esc(f.id)}" aria-label="${esc(f.title)} 수정">✏️</button>
        </li>`;
      }).join("") || `<li class="empty">좋아하는 노래를 즐겨찾기 해 봐요</li>`}
    </ul>`);
}
function favForm(f = {}) {
  const guess = drafts.music.trim();
  openForm({
    title: f.id ? "즐겨찾기 수정" : "즐겨찾기 추가",
    fields: [
      { name: "title", label: "노래 제목", type: "text", value: f.title ?? guess, required: true },
      { name: "artist", label: "가수", type: "text", value: f.artist }
    ],
    onSubmit: (v) => { store.set(`music/favorites/${f.id || newId()}`, { ...v, ts: f.ts || Date.now() }); toast("즐겨찾기에 넣었어요"); },
    onDelete: f.id ? () => store.remove(`music/favorites/${f.id}`) : null
  });
}

// ---------------- 날씨 ----------------
let wx = null;
let wxErr = "";
const wxPlace = () => data.settings?.weather?.lat ? data.settings.weather : DEFAULT_PLACE;
async function loadWeather(force = false) {
  try {
    wx = await getWeather(wxPlace(), { force });
    wxErr = "";
  } catch (e) {
    wxErr = e.message || "날씨를 불러오지 못했어요";
  }
  renderWeather();
  renderPrep();
  renderHero();
}
function renderWeather() {
  const place = wxPlace();
  if (!wx) wx = cachedWeather(place);
  const parent = isParent();
  if (!wx) {
    paint("sec-weather", `<div class="card-head"><h2 id="weather-title">🌤️ 날씨</h2></div>
      <p class="hint">${wxErr ? esc(wxErr) : "날씨를 불러오는 중…"}</p>
      ${wxErr ? `<button type="button" class="btn small" data-action="wx-refresh">다시 시도</button>` : ""}`);
    return;
  }
  const [emo, label] = codeInfo(wx.now.code);
  const today = wx.days.find((d) => d.date === dateKey()) || wx.days[0];
  const tmr = wx.days.find((d) => d.date === dateKey(addDays(startOfDay(), 1)));
  const g10 = pmGrade("pm10", wx.pm10);
  const g25 = pmGrade("pm25", wx.pm25);
  const tips = [];
  if (today && today.rain >= 50) tips.push(`☂️ 오늘 비 올 확률 ${today.rain}% · 우산 챙기기`);
  if ((g10 && g10.level >= 2) || (g25 && g25.level >= 2)) tips.push("😷 미세먼지 나쁨 · 마스크 쓰고 바깥놀이 줄이기");
  if (today && today.uv >= 6) tips.push("🧴 자외선 강함 · 선크림·모자");
  const pm = (name, v, g) => g ? `<li class="pm pm-${g.level}"><span class="tile-label">${name}</span><strong>${g.emoji} ${g.label}</strong><span class="tile-sub">${Math.round(v)}㎍/㎥</span></li>` : "";
  paint("sec-weather", `
    <div class="card-head">
      <h2 id="weather-title">🌤️ ${esc(place.name)} 날씨</h2>
      <button type="button" class="mini-btn" data-action="wx-refresh" aria-label="날씨 새로고침">🔄</button>
    </div>
    <div class="wx-now">
      <span class="wx-emoji" aria-hidden="true">${emo}</span>
      <div>
        <p class="wx-temp">${Math.round(wx.now.temp)}°</p>
        <p class="wx-label">${label} · 체감 ${Math.round(wx.now.feels)}°</p>
      </div>
      ${today ? `<div class="wx-range"><span>최고 <b>${Math.round(today.max)}°</b></span><span>최저 <b>${Math.round(today.min)}°</b></span>${today.rain != null ? `<span>☔ ${today.rain}%</span>` : ""}</div>` : ""}
    </div>
    ${today ? `<p class="wx-outfit">👕 오늘 옷차림: <b>${outfit(today.min, today.max)}</b></p>` : ""}
    <ul class="pm-row">${pm("미세먼지", wx.pm10, g10)}${pm("초미세먼지", wx.pm25, g25)}</ul>
    ${tips.length ? `<ul class="wx-tips">${tips.map((t) => `<li>${t}</li>`).join("")}</ul>` : ""}
    ${tmr ? `<p class="hint">내일 ${codeInfo(tmr.code)[0]} ${codeInfo(tmr.code)[1]} · ${Math.round(tmr.min)}° / ${Math.round(tmr.max)}°${tmr.rain != null ? ` · 비 ${tmr.rain}%` : ""}</p>` : ""}
    <p class="hint">${timeAgo(wx.at)} 업데이트${parent ? ` · <button type="button" class="link-btn" data-action="wx-place">지역 바꾸기</button>` : ""}</p>`);
}
function weatherPrepItems(d) {
  if (!wx) return [];
  const k = dateKey(d);
  const day = wx.days.find((x) => x.date === k);
  const out = [];
  if (day && day.rain >= 50) out.push({ key: "w_umbrella", title: `우산 (비 올 확률 ${day.rain}%)`, emoji: "☂️", tag: "날씨" });
  if (k === dateKey()) {
    const bad = (pmGrade("pm10", wx.pm10)?.level ?? 0) >= 2 || (pmGrade("pm25", wx.pm25)?.level ?? 0) >= 2;
    if (bad) out.push({ key: "w_mask", title: "마스크 (미세먼지 나쁨)", emoji: "😷", tag: "날씨" });
  }
  return out;
}
function placeForm() {
  openForm({
    title: "📍 날씨 지역 바꾸기",
    fields: [{ name: "q", label: "동네·도시 이름", type: "text", value: "", required: true, placeholder: "예: 성남, 수원, 분당, Seoul" }],
    note: "이름으로 못 찾으면 '지금 위치로' 버튼을 눌러 주세요. 지역은 모든 기기에 함께 적용돼요.",
    submitLabel: "찾기",
    onSubmit: async (v) => {
      let res = [];
      try { res = await searchPlace(v.q); } catch (e) { toast(e.message); return false; }
      if (!res.length) { toast("못 찾았어요. 다른 이름이나 영어로 해 볼까요?"); return false; }
      setTimeout(() => openForm({
        title: "📍 지역 고르기",
        fields: [{ name: "i", label: "검색 결과", type: "select", value: "0", options: res.map((r, i) => ({ value: String(i), label: `${r.name} · ${r.detail}` })) },
          { name: "label", label: "화면에 보일 이름", type: "text", value: res[0].name }],
        onSubmit: (w) => {
          const r = res[Number(w.i)];
          store.set("settings/weather", { name: w.label || r.name, lat: r.lat, lon: r.lon });
          wx = null;
          setTimeout(() => loadWeather(true), 300);
          toast("날씨 지역을 바꿨어요");
        }
      }), 50);
    }
  });
  if ("geolocation" in navigator) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "btn small full";
    b.textContent = "📍 지금 위치로";
    b.addEventListener("click", () => {
      navigator.geolocation.getCurrentPosition((pos) => {
        store.set("settings/weather", { name: "우리 동네", lat: Math.round(pos.coords.latitude * 100) / 100, lon: Math.round(pos.coords.longitude * 100) / 100 });
        $("#form-dialog").close();
        wx = null;
        setTimeout(() => loadWeather(true), 300);
        toast("지금 위치로 맞췄어요");
      }, () => toast("위치 권한을 허용해 주세요"), { timeout: 10000 });
    });
    $("#form-dialog-fields").appendChild(b);
  }
}

// ---------------- 준비물 챙기기 ----------------
let prepView = null; // "today" | "tomorrow"
const prepDayOf = () => {
  if (prepView) return prepView;
  return new Date().getHours() >= 15 ? "tomorrow" : "today";
};
function prepItemsFor(d) {
  const k = dateKey(d);
  const idx = dayIdx(d);
  const groups = [];
  const school = [];
  list(data.prep?.regular).forEach((r) => {
    const days = (r.days || []).map(Number);
    const on = days.length ? days.includes(idx) : idx < 5;
    if (on) school.push({ key: `r_${r.id}`, title: r.title, emoji: r.emoji || "🎒", tag: days.length ? `매주 ${days.map((x) => DAYS[x]).join("·")}` : "평일마다", edit: { kind: "regular", id: r.id } });
  });
  list(data.prep?.once).filter((o) => o.date === k).forEach((o) => {
    school.push({ key: `o_${o.id}`, title: o.title, emoji: o.emoji || "📌", tag: "이날만", edit: { kind: "once", id: o.id } });
  });
  if (school.length) groups.push({ name: "🏫 학교·공통", items: school });
  const wxItems = weatherPrepItems(d);
  if (wxItems.length) groups.unshift({ name: "🌦️ 날씨 때문에", items: wxItems });
  academiesOn(d).forEach((a) => {
    const sup = String(a.supplies || "").split(",").map((x) => x.trim()).filter(Boolean);
    if (sup.length) groups.push({ name: `${a.type === "방과후" ? "🧪" : "🎵"} ${a.name} (${a.start})`, items: sup.map((t, i) => ({ key: `a_${a.id}_${i}`, title: t, emoji: "🧩", tag: a.type || "학원", academy: a.id })) });
  });
  return groups;
}
function renderPrep() {
  const view = prepDayOf();
  const d = view === "today" ? startOfDay() : addDays(startOfDay(), 1);
  const k = dateKey(d);
  const groups = prepItemsFor(d);
  const all = groups.flatMap((g) => g.items);
  const checked = data.daily?.[k]?.prep?.items || {};
  const n = all.filter((it) => checked[it.key]).length;
  const doneRec = data.daily?.[k]?.prep?.done;
  const okRec = data.daily?.[k]?.prep?.ok;
  const allChecked = all.length > 0 && n === all.length;
  const parent = isParent();
  const who = (r) => (ROLES[r?.by]?.label || "") ;
  const kid = data.settings?.childName || "아이";
  paint("sec-prep", `
    <div class="card-head">
      <h2 id="prep-title">🎒 챙겨야 할 것</h2>
      ${ttsSupported() && all.length ? `<button type="button" class="btn small" data-action="prep-speak">🔊 읽어주기</button>` : ""}
    </div>
    <div class="seg" role="group" aria-label="날짜 고르기">
      <button type="button" class="seg-btn ${view === "today" ? "on" : ""}" data-action="prep-view" data-view="today" aria-pressed="${view === "today"}">오늘 ${fmtMD(startOfDay())}(${DAYS[dayIdx()]})</button>
      <button type="button" class="seg-btn ${view === "tomorrow" ? "on" : ""}" data-action="prep-view" data-view="tomorrow" aria-pressed="${view === "tomorrow"}">내일 ${fmtMD(addDays(startOfDay(), 1))}(${DAYS[dayIdx(addDays(startOfDay(), 1))]})</button>
    </div>
    ${all.length ? `<div class="bar" role="img" aria-label="${all.length}개 중 ${n}개 챙김"><span style="width:${Math.round(n / all.length * 100)}%"></span></div>
      <p class="hint">${n} / ${all.length} 챙겼어요</p>` : ""}
    ${groups.map((g) => `<h3 class="sub-title">${esc(g.name)}</h3>
      <ul class="check-list">${g.items.map((it) => {
        const on = !!checked[it.key];
        return `<li class="check-row ${on ? "done" : ""}">
          <button type="button" class="check-btn" data-action="prep-toggle" data-key="${esc(it.key)}" data-day="${k}" aria-pressed="${on}">
            <span class="check-box" aria-hidden="true">${on ? "✓" : ""}</span>
            <span class="check-emoji" aria-hidden="true">${esc(it.emoji)}</span>
            <span class="check-label">${esc(it.title)}</span>
            <span class="tag">${esc(it.tag)}</span>
          </button>
          ${parent && it.edit ? `<button type="button" class="mini-btn" data-action="prep-edit" data-kind="${it.edit.kind}" data-id="${esc(it.edit.id)}" aria-label="${esc(it.title)} 수정">✏️</button>` : ""}
          ${parent && it.academy ? `<button type="button" class="mini-btn" data-action="edit-academy" data-id="${esc(it.academy)}" aria-label="학원 준비물 수정">✏️</button>` : ""}
        </li>`;
      }).join("")}</ul>`).join("") || `<p class="empty">${view === "today" ? "오늘" : "내일"}은 챙길 게 없어요 🎈</p>`}
    ${all.length ? `<div class="prep-confirm ${doneRec ? "is-done" : ""}">
      ${doneRec
        ? `<p class="confirm-line">✅ <b>${esc(kid)}</b>${iga(kid)} ${clock(doneRec.ts)}에 <b>다 챙겼다고</b> 했어요${doneRec.by && doneRec.by !== "kid" && doneRec.by !== "tablet" ? ` (${esc(who(doneRec))} 폰에서)` : ""}</p>
           ${okRec ? `<p class="confirm-line ok">👍 ${esc(who(okRec))}${iga(who(okRec))} ${clock(okRec.ts)}에 확인했어요</p>`
             : parent ? `<button type="button" class="btn primary" data-action="prep-ok" data-day="${k}">👍 확인했어요</button>` : `<p class="hint">엄마·아빠가 확인하면 여기에 표시돼요</p>`}
           <button type="button" class="link-btn" data-action="prep-undo" data-day="${k}">확인 취소</button>`
        : `<button type="button" class="btn ${allChecked ? "primary" : ""} prep-done-btn" data-action="prep-done" data-day="${k}" ${allChecked ? "" : "disabled"}>${allChecked ? "🙌 다 챙겼어요!" : `${all.length - n}개 더 챙기면 확인할 수 있어요`}</button>`}
    </div>` : ""}
    <div class="gcal-bar">
      <button type="button" class="btn small" data-action="prep-add-once" data-day="${k}">+ 이날만 챙길 것</button>
      ${parent ? `<button type="button" class="btn small" data-action="prep-add-regular">+ 매주 챙길 것</button>` : ""}
    </div>
    ${parent ? `<p class="hint">학원·방과후 준비물은 스케줄 카드에서 학원을 눌러 '준비물' 칸에 적으면 수업 있는 날 자동으로 나와요.</p>` : ""}`);
}
function prepRegularForm(r = {}) {
  openForm({
    title: r.id ? "매주 챙길 것 수정" : "매주 챙길 것 추가",
    fields: [
      { name: "title", label: "준비물", type: "text", value: r.title, required: true, placeholder: "예: 체육복, 실내화 가방" },
      { name: "emoji", label: "그림(이모지)", type: "text", value: r.emoji || "🎒" },
      { name: "days", label: "요일 (아무것도 안 고르면 평일마다)", type: "days", value: (r.days || []).map(Number) }
    ],
    onSubmit: (v) => { store.set(`prep/regular/${r.id || newId()}`, v); toast("저장했어요"); },
    onDelete: r.id ? () => store.remove(`prep/regular/${r.id}`) : null
  });
}
function prepOnceForm(o = {}, day) {
  openForm({
    title: o.id ? "이날만 챙길 것 수정" : "이날만 챙길 것 추가",
    fields: [
      { name: "title", label: "준비물", type: "text", value: o.title, required: true, placeholder: "예: 현장학습 도시락, 가정통신문 회신" },
      { name: "date", label: "날짜", type: "date", value: o.date || day || dateKey(), required: true, half: true },
      { name: "emoji", label: "그림(이모지)", type: "text", value: o.emoji || "📌", half: true }
    ],
    onSubmit: (v) => { store.set(`prep/once/${o.id || newId()}`, v); toast("저장했어요"); },
    onDelete: o.id ? () => store.remove(`prep/once/${o.id}`) : null
  });
}

// ---------------- 피아노 연습곡 ----------------
const activePieces = () => list(data.piano).filter((x) => x.status !== "passed").sort((a, b) => (a.startedAt || 0) - (b.startedAt || 0));
const pieceTarget = (x) => Math.max(1, Number(x.target) || 5);
const pianoCount = (id) => Number(data.daily?.[dateKey()]?.piano?.[id]) || 0;
const ytUrl = (q) => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
function renderPiano() {
  const pieces = activePieces();
  const passed = list(data.piano).filter((x) => x.status === "passed").sort((a, b) => (b.passedAt || 0) - (a.passedAt || 0));
  const parent = isParent();
  const items = pieces.map((x) => {
    const cnt = pianoCount(x.id);
    const tgt = pieceTarget(x);
    const done = cnt >= tgt;
    const notes = Array.from({ length: tgt }, (_, i) => `<span class="note ${i < cnt ? "on" : ""}" aria-hidden="true">${i < cnt ? "🎵" : "·"}</span>`).join("");
    const days = x.startedAt ? Math.max(1, Math.round((startOfDay() - startOfDay(new Date(x.startedAt))) / 86400000) + 1) : null;
    return `<li class="piece ${done ? "done" : ""}">
      <div class="piece-head">
        <div class="piece-title-wrap">
          <p class="piece-title">${esc(x.title)}</p>
          <p class="piece-meta">${x.book ? `<span class="tag">${esc(x.book)}</span> ` : ""}${days ? `연습 ${days}일째` : ""}</p>
        </div>
        <a class="mini-btn ytm" href="${ytUrl(`${x.title} 피아노`)}" target="_blank" rel="noopener" aria-label="${esc(x.title)} 유튜브에서 듣기">🎧</a>
        ${parent ? `<button type="button" class="mini-btn" data-action="edit-piece" data-id="${esc(x.id)}" aria-label="${esc(x.title)} 수정">✏️</button>` : ""}
      </div>
      ${x.note ? `<p class="piece-note">📝 ${esc(x.note)}</p>` : ""}
      <div class="notes" role="img" aria-label="오늘 ${tgt}번 중 ${cnt}번 연습">${notes}</div>
      <div class="piece-actions">
        <button type="button" class="btn ${done ? "" : "primary"} piece-tap" data-action="piano-plus" data-id="${esc(x.id)}">${done ? `🎉 오늘 목표 끝! (${cnt}번)` : `🎹 한 번 쳤어요! ${cnt}/${tgt}`}</button>
        <button type="button" class="mini-btn" data-action="piano-minus" data-id="${esc(x.id)}" ${cnt ? "" : "disabled"} aria-label="한 번 빼기">−1</button>
      </div>
      ${parent ? `<button type="button" class="link-btn" data-action="pass-piece" data-id="${esc(x.id)}">🏅 선생님께 통과했어요</button>` : ""}
    </li>`;
  }).join("") || `<li class="empty">지금 연습 중인 곡이 없어요${parent ? ". 새 곡을 추가해 주세요 🎼" : ""}</li>`;
  paint("sec-piano", `
    <div class="card-head">
      <h2 id="piano-title">🎹 피아노 연습곡</h2>
      ${parent ? `<button type="button" class="btn small" data-action="add-piece">+ 연습곡 추가</button>` : ""}
    </div>
    <p class="hint">칠 때마다 버튼을 눌러요. 오늘 목표를 채우면 ⭐을 받아요!</p>
    <ul class="piece-list">${items}</ul>
    ${passed.length ? `<details class="passed">
      <summary>🏅 통과한 곡 ${passed.length}곡</summary>
      <ul class="log-list">${passed.map((x) => `<li><span>${esc(x.title)}${x.book ? ` · ${esc(x.book)}` : ""}</span><span>${x.passedAt ? fmtMD(new Date(x.passedAt)) : ""}${parent ? ` <button type="button" class="link-btn" data-action="edit-piece" data-id="${esc(x.id)}">수정</button>` : ""}</span></li>`).join("")}</ul>
    </details>` : ""}`);
}
async function pianoStep(id, delta) {
  const x = data.piano?.[id];
  if (!x) return;
  const k = dateKey();
  const before = pianoCount(id);
  const after = Math.max(0, before + delta);
  const tgt = pieceTarget(x);
  const stars = Number(x.stars) || 2;
  const patch = { [`daily/${k}/piano/${id}`]: after || null };
  if (before < tgt && after >= tgt) patch[`starsLog/${k}_p_${id}`] = { amount: stars, reason: `🎹 ${x.title}`, date: k, ts: Date.now() };
  if (before >= tgt && after < tgt) patch[`starsLog/${k}_p_${id}`] = null;
  await store.update("", patch);
  if (before < tgt && after >= tgt) {
    toast(`🎹 오늘 연습 끝! ⭐ ${stars}개`);
    confetti(["🎵", "🎶", "⭐", "🎹"]);
  }
}
function pieceForm(x = {}) {
  openForm({
    title: x.id ? "연습곡 수정" : "새 연습곡",
    fields: [
      { name: "title", label: "곡 이름", type: "text", value: x.title, required: true, placeholder: "예: 엘리제를 위하여" },
      { name: "book", label: "교재", type: "text", value: x.book, placeholder: "예: 체르니 100 / 바이엘 3", half: true },
      { name: "target", label: "하루 목표(번)", type: "number", value: x.target ?? 5, min: 1, max: 30, half: true },
      { name: "stars", label: "목표 달성 별", type: "number", value: x.stars ?? 2, min: 1, max: 10, half: true },
      { name: "status", label: "상태", type: "select", value: x.status || "practice", options: [{ value: "practice", label: "연습 중" }, { value: "passed", label: "통과" }], half: true },
      { name: "note", label: "선생님 메모", type: "text", value: x.note, placeholder: "예: 왼손 천천히, 셋째 줄 박자 주의" }
    ],
    onSubmit: (v) => {
      const id = x.id || newId();
      const rec = { ...v, target: Number(v.target) || 5, stars: Number(v.stars) || 2, startedAt: x.startedAt || Date.now() };
      if (v.status === "passed") rec.passedAt = x.passedAt || Date.now();
      store.set(`piano/${id}`, rec);
      toast("저장했어요");
    },
    onDelete: x.id ? () => store.remove(`piano/${x.id}`) : null
  });
}

// =============================================================
//  전체 그리기
// =============================================================
function renderAll() {
  applyLayout();
  renderTop();
  renderHero();
  renderSchedule();
  renderWeather();
  renderPrep();
  renderStudy();
  renderPiano();
  renderStars();
  renderShop();
  renderDday();
  renderMeal();
  renderWeekend();
  renderStatus();
  renderMail();
  renderMusic();
}

// =============================================================
//  입력 폼 다이얼로그
// =============================================================
function fieldHtml(f) {
  const id = `f-${f.name}`;
  const common = `id="${id}" name="${esc(f.name)}" ${f.required ? "required" : ""}`;
  let input;
  if (f.type === "select") {
    input = `<select ${common}>${f.options.map((o) => {
      const v = typeof o === "object" ? o.value : o;
      const l = typeof o === "object" ? o.label : o;
      return `<option value="${esc(v)}" ${String(v) === String(f.value) ? "selected" : ""}>${esc(l)}</option>`;
    }).join("")}</select>`;
  } else if (f.type === "multi") {
    return `<fieldset class="field full"><legend>${esc(f.label)}</legend><div class="multi-picks">${f.options.map((o) => `
      <label class="check-field"><input type="checkbox" name="${esc(f.name)}" value="${esc(o.value)}" ${(f.value || []).includes(o.value) ? "checked" : ""}> <span>${esc(o.label)}</span></label>`).join("")}</div></fieldset>`;
  } else if (f.type === "days") {
    return `<fieldset class="field full"><legend>${esc(f.label)}</legend><div class="day-picks">${DAYS.map((d, i) => `
      <label class="day-pick"><input type="checkbox" name="${esc(f.name)}" value="${i}" ${(f.value || []).includes(i) ? "checked" : ""}><span>${d}</span></label>`).join("")}</div></fieldset>`;
  } else if (f.type === "checkbox") {
    return `<label class="field full check-field"><input type="checkbox" ${common} ${f.value ? "checked" : ""}> <span>${esc(f.label)}</span></label>`;
  } else if (f.type === "textarea") {
    input = `<textarea ${common} rows="3">${esc(f.value || "")}</textarea>`;
  } else {
    const extra = ["min", "max", "step", "placeholder", "inputmode", "autocomplete"].filter((k) => f[k] !== undefined).map((k) => `${k}="${esc(f[k])}"`).join(" ");
    input = `<input type="${f.type}" ${common} value="${esc(f.value ?? "")}" ${extra}>`;
  }
  return `<label class="field ${f.half ? "half" : "full"}" for="${id}"><span>${esc(f.label)}</span>${input}</label>`;
}

let formState = null;
function openForm({ title, fields, onSubmit, onDelete = null, submitLabel = "저장", note = "", locked = false }) {
  const dlg = $("#form-dialog");
  formState = { fields, onSubmit, onDelete, locked };
  $("#form-dialog-title").textContent = title;
  $("#form-dialog-fields").onclick = null;
  $("#form-dialog-fields").onchange = null;
  $("#form-dialog-fields").innerHTML = fields.map(fieldHtml).join("") + (note ? `<p class="hint full">${esc(note)}</p>` : "");
  $("#form-dialog-submit").textContent = submitLabel;
  const del = $("#form-dialog-delete");
  del.hidden = !onDelete;
  del.textContent = "삭제";
  del.dataset.armed = "";
  dlg.querySelector("[data-dialog-cancel]").hidden = locked;
  dlg.showModal();
  const first = dlg.querySelector("input:not([type=checkbox]), select, textarea");
  first?.focus();
}
function readForm() {
  const form = $("#form-dialog-form");
  const out = {};
  for (const f of formState.fields) {
    if (f.type === "days") out[f.name] = [...form.querySelectorAll(`input[name="${f.name}"]:checked`)].map((x) => Number(x.value));
    else if (f.type === "multi") out[f.name] = [...form.querySelectorAll(`input[name="${f.name}"]:checked`)].map((x) => x.value);
    else if (f.type === "checkbox") out[f.name] = form.querySelector(`[name="${f.name}"]`).checked;
    else out[f.name] = form.querySelector(`[name="${f.name}"]`).value.trim();
  }
  return out;
}
function setupDialog() {
  const dlg = $("#form-dialog");
  const form = $("#form-dialog-form");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!form.reportValidity()) return;
    const res = await formState.onSubmit(readForm());
    if (res !== false) dlg.close();
  });
  dlg.querySelector("[data-dialog-cancel]").addEventListener("click", () => dlg.close());
  $("#form-dialog-delete").addEventListener("click", (e) => {
    const b = e.currentTarget;
    if (!b.dataset.armed) { b.dataset.armed = "1"; b.textContent = "정말 삭제할까요?"; return; }
    formState.onDelete?.();
    dlg.close();
  });
  dlg.addEventListener("cancel", (e) => { if (formState?.locked) e.preventDefault(); });
}

// =============================================================
//  부모 PIN
// =============================================================
async function hashPin(pin) {
  const fid = device.get("familyId", "demo");
  const text = `${fid}:${pin}`;
  if (window.crypto?.subtle) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  let h = 5381;
  for (const c of text) h = ((h << 5) + h + c.charCodeAt(0)) >>> 0;
  return `f${h.toString(16)}`;
}
async function checkPin(pin) {
  const stored = data.settings?.pinHash;
  if (!stored) return pin === "0000";
  return (await hashPin(pin)) === stored;
}
function askPin(message, onOk) {
  openForm({
    title: "🔒 엄마·아빠 확인",
    fields: [{ name: "pin", label: "부모 PIN (숫자 4자리 이상)", type: "password", required: true, inputmode: "numeric", autocomplete: "off" }],
    note: `${message}${data.settings?.pinHash ? "" : " · 처음 PIN은 0000이에요. 설정에서 꼭 바꿔 주세요."}`,
    submitLabel: "확인",
    onSubmit: async (v) => {
      if (await checkPin(v.pin)) { onOk(); return true; }
      toast("PIN이 맞지 않아요");
      return false;
    }
  });
}
function toggleMode() {
  if (isParent()) {
    device.set("parentMode", false);
    renderAll();
    toast("아이 모드로 바꿨어요");
    return;
  }
  askPin("부모 모드로 바꿀게요.", () => {
    device.set("parentMode", true);
    renderAll();
    toast("부모 모드로 바꿨어요");
  });
}

// =============================================================
//  설정
// =============================================================
function openSettings() {
  const fid = device.get("familyId", "");
  const fields = [
    { name: "role", label: "이 기기는 누가 쓰나요?", type: "select", value: myRole(), options: Object.entries(ROLES).map(([value, r]) => ({ value, label: `${r.emoji} ${r.label}` })) },
    { name: "autoRead", label: "새 메모가 오면 소리로 읽어주기 (이 기기)", type: "checkbox", value: device.get("autoRead", myRole() === "tablet") }
  ];
  if (isParent()) {
    fields.push(
      { name: "childName", label: "아이 이름(호칭)", type: "text", value: data.settings?.childName || "" },
      { name: "newPin", label: "새 부모 PIN (바꿀 때만 입력)", type: "password", inputmode: "numeric", autocomplete: "new-password", placeholder: "숫자 4자리 이상" }
    );
  }
  const modeNote = hasFirebaseConfig()
    ? `가족 코드: ${fid} — 다른 기기에서도 같은 코드를 넣으면 함께 동기화돼요.`
    : "지금은 데모 모드예요. firebase-config.js에 값을 넣으면 모든 기기가 실시간으로 동기화돼요.";
  openForm({
    title: "⚙️ 설정",
    fields,
    note: modeNote,
    onSubmit: async (v) => {
      device.set("role", v.role);
      device.set("autoRead", v.autoRead);
      if (isParent()) {
        const patch = {};
        if (v.childName) patch["settings/childName"] = v.childName;
        if (v.newPin) {
          if (!/^\d{4,8}$/.test(v.newPin)) { toast("PIN은 숫자 4~8자리로 해 주세요"); return false; }
          patch["settings/pinHash"] = await hashPin(v.newPin);
        }
        if (Object.keys(patch).length) await store.update("", patch);
      }
      if (v.autoRead && ttsSupported()) speak("메모 읽어주기를 켰어요");
      renderAll();
      toast("설정을 저장했어요");
    }
  });
  if (hasFirebaseConfig()) {
    const extra = document.createElement("button");
    extra.type = "button";
    extra.className = "link-btn full";
    extra.textContent = "가족 코드 바꾸기";
    extra.addEventListener("click", () => { $("#form-dialog").close(); setupFamily(true); });
    $("#form-dialog-fields").appendChild(extra);
  }
  if (isParent()) {
    const lay = document.createElement("button");
    lay.type = "button";
    lay.className = "btn small full";
    lay.textContent = "🧩 화면 카드 순서·숨기기";
    lay.addEventListener("click", () => { $("#form-dialog").close(); openLayoutEditor(); });
    $("#form-dialog-fields").prepend(lay);
  }
}

// =============================================================
//  화면 꾸미기 (카드 순서·숨기기, 이 기기에만 저장)
// =============================================================
const CARDS = [
  { id: "sec-weather", label: "🌤️ 날씨" },
  { id: "sec-prep", label: "🎒 챙겨야 할 것" },
  { id: "sec-study", label: "📚 오늘 공부할 것" },
  { id: "sec-piano", label: "🎹 피아노 연습곡" },
  { id: "sec-stars", label: "🌟 별 스티커판" },
  { id: "sec-shop", label: "🎁 보상 상점" },
  { id: "sec-dday", label: "🎂 가족 행사 & 이번 달 일정" },
  { id: "sec-meal", label: "🍚 저녁 메뉴" },
  { id: "sec-weekend", label: "🧺 주말 계획" },
  { id: "sec-status", label: "🙋 엄마·아빠 상태" },
  { id: "sec-mail", label: "💌 가족 우체통" },
  { id: "sec-music", label: "🎵 음악 듣기" },
  { id: "sec-schedule", label: "📅 학원·방과후 스케줄" }
];
const NAV_OF = { "sec-meal": ["sec-meal"], "sec-weekend": ["sec-meal"] };
function getLayout() {
  const saved = device.get("layout", null) || {};
  const ids = CARDS.map((c) => c.id);
  const order = (saved.order || []).filter((id) => ids.includes(id));
  ids.forEach((id) => { if (!order.includes(id)) order.push(id); });
  return { order, hidden: (saved.hidden || []).filter((id) => ids.includes(id)) };
}
function applyLayout() {
  const { order, hidden } = getLayout();
  order.forEach((id, i) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.order = String(i + 1);
    el.hidden = hidden.includes(id);
  });
  const hero = document.getElementById("sec-hero");
  if (hero) hero.style.order = "0";
  document.querySelectorAll(".section-nav a").forEach((a) => {
    const target = a.getAttribute("href").slice(1);
    const idx = order.indexOf(target);
    a.style.order = String(idx < 0 ? 99 : idx);
    const shown = order.some((id) => !hidden.includes(id) && (NAV_OF[id] || [id]).includes(target));
    a.hidden = !shown;
  });
}
function openLayoutEditor() {
  let { order, hidden } = getLayout();
  const label = (id) => CARDS.find((c) => c.id === id)?.label || id;
  const draw = () => {
    $("#form-dialog-fields").innerHTML = `
      <p class="hint full">↑↓로 순서를 바꾸고, 안 쓰는 카드는 '보이기'를 끄세요. 이 기기에만 적용돼요. (맨 위 '오늘 한눈에'는 항상 처음에 보여요)</p>
      <ol class="layout-list full">
        ${order.map((id, i) => `<li class="layout-row ${hidden.includes(id) ? "off" : ""}">
          <span class="layout-num">${i + 1}</span>
          <span class="layout-label">${esc(label(id))}</span>
          <label class="layout-show"><input type="checkbox" data-lay-show="${id}" ${hidden.includes(id) ? "" : "checked"}> 보이기</label>
          <button type="button" class="mini-btn" data-lay-move="up" data-lay-id="${id}" ${i === 0 ? "disabled" : ""} aria-label="${esc(label(id))} 위로">↑</button>
          <button type="button" class="mini-btn" data-lay-move="down" data-lay-id="${id}" ${i === order.length - 1 ? "disabled" : ""} aria-label="${esc(label(id))} 아래로">↓</button>
        </li>`).join("")}
      </ol>
      <button type="button" class="link-btn full" data-lay-reset>처음 순서로 되돌리기</button>`;
  };
  openForm({
    title: "🧩 화면 꾸미기",
    fields: [],
    onSubmit: () => {
      device.set("layout", { order, hidden });
      applyLayout();
      toast("화면 배치를 저장했어요");
    }
  });
  draw();
  const box = $("#form-dialog-fields");
  const handler = (e) => {
    const mv = e.target.closest("[data-lay-move]");
    if (mv) {
      const i = order.indexOf(mv.dataset.layId);
      const j = mv.dataset.layMove === "up" ? i - 1 : i + 1;
      if (j < 0 || j >= order.length) return;
      [order[i], order[j]] = [order[j], order[i]];
      draw();
      box.querySelector(`[data-lay-id="${mv.dataset.layId}"][data-lay-move="${mv.dataset.layMove}"]`)?.focus();
      return;
    }
    if (e.target.closest("[data-lay-reset]")) {
      order = CARDS.map((c) => c.id);
      hidden = [];
      draw();
    }
  };
  const changer = (e) => {
    const id = e.target.dataset?.layShow;
    if (!id) return;
    hidden = e.target.checked ? hidden.filter((x) => x !== id) : [...hidden, id];
    draw();
  };
  box.onclick = handler;
  box.onchange = changer;
}

function suggestCode() {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  let s = "";
  const rnd = new Uint32Array(12);
  crypto.getRandomValues(rnd);
  rnd.forEach((n) => { s += chars[n % chars.length]; });
  return `family-${s}`;
}
function setupFamily(changing = false) {
  return new Promise((resolve) => {
    const fb = hasFirebaseConfig();
    const fields = [];
    if (fb) fields.push({ name: "familyId", label: "가족 코드", type: "text", value: device.get("familyId", "") || suggestCode(), required: true, autocomplete: "off" });
    fields.push({ name: "role", label: "이 기기는 누가 쓰나요?", type: "select", value: myRole(), options: Object.entries(ROLES).map(([value, r]) => ({ value, label: `${r.emoji} ${r.label}` })) });
    openForm({
      title: changing ? "가족 코드 바꾸기" : "👋 처음 설정",
      fields,
      locked: !changing,
      submitLabel: "시작하기",
      note: fb
        ? "처음 쓰는 기기라면 이 코드를 그대로 쓰고, 다른 가족 기기에서는 같은 코드를 입력하세요. 코드는 가족끼리만 공유해 주세요."
        : "데모 모드예요. 이 브라우저에만 저장돼요.",
      onSubmit: (v) => {
        if (fb) {
          if (!/^[A-Za-z0-9_-]{8,60}$/.test(v.familyId)) { toast("가족 코드는 영문·숫자·-·_ 8자 이상이에요"); return false; }
          device.set("familyId", v.familyId);
        } else {
          device.set("familyId", "demo");
        }
        device.set("role", v.role);
        device.set("autoRead", v.role === "tablet");
        device.set("setupDone", true);
        if (changing) location.reload();
        resolve();
      }
    });
  });
}

// =============================================================
//  클릭 처리
// =============================================================
let stopListening = null;
function micInto(target, btn) {
  if (stopListening) { stopListening(); return; }
  stopSpeaking();
  btn.classList.add("listening");
  btn.textContent = "👂 듣는 중…";
  stopListening = listen({
    onResult: (text, final) => {
      drafts[target] = text;
      const el = target === "mail" ? $("#mail-text") : $("#music-q");
      if (el) el.value = text;
      if (final && target === "music") renderMusic();
    },
    onEnd: (err) => {
      stopListening = null;
      if (err) toast(err === "not-allowed" ? "마이크 권한을 허용해 주세요" : "잘 못 들었어요. 다시 해 볼까요?");
      renderMail();
      renderMusic();
    }
  });
}

const actions = {
  "add-academy": () => academyForm(),
  "edit-academy": (el) => isParent() && academyForm({ id: el.dataset.id, ...data.academies?.[el.dataset.id] }),
  "toggle-routine": (el) => toggleDaily("routines", el.dataset.id),
  "toggle-sheet": (el) => toggleDaily("worksheets", el.dataset.id),
  "add-routine": () => routineForm(),
  "edit-routine": (el) => routineForm({ id: el.dataset.id, ...data.routines?.[el.dataset.id] }),
  "add-sheet": () => sheetForm(),
  "edit-sheet": (el) => sheetForm({ id: el.dataset.id, ...data.worksheets?.[el.dataset.id] }),
  "bonus-star": () => openForm({
    title: "🌟 칭찬 별 주기",
    fields: [
      { name: "amount", label: "별 개수", type: "number", value: 1, min: 1, max: 20, required: true, half: true },
      { name: "reason", label: "칭찬 이유", type: "text", value: "", placeholder: "예: 동생 도와줬어요", half: true }
    ],
    onSubmit: (v) => {
      store.set(`starsLog/${newId()}`, { amount: Number(v.amount) || 1, reason: `💝 ${v.reason || "칭찬"}`, date: dateKey(), ts: Date.now() });
      toast("칭찬 별을 줬어요!");
      confetti();
    }
  }),
  "add-reward": () => rewardForm(),
  "edit-reward": (el) => rewardForm({ id: el.dataset.id, ...data.rewards?.[el.dataset.id] }),
  redeem: (el) => redeem(el.dataset.id),
  "add-event": () => eventForm(),
  "edit-event": (el) => eventForm({ id: el.dataset.id, ...data.events?.[el.dataset.id] }),
  "clean-events": () => {
    const patch = {};
    list(data.events).filter((e) => !e.yearly && nextOccurrence(e).diff < 0).forEach((e) => { patch[`events/${e.id}`] = null; });
    store.update("", patch);
    toast("지난 행사를 정리했어요");
  },
  "add-weekend": () => weekendForm(),
  "edit-weekend": (el) => weekendForm({ id: el.dataset.id, ...data.weekend?.[weekendKey()]?.[el.dataset.id] }),
  "toggle-weekend": (el) => {
    const wk = weekendKey();
    const cur = !!data.weekend?.[wk]?.[el.dataset.id]?.done;
    store.set(`weekend/${wk}/${el.dataset.id}/done`, !cur);
    if (!cur) confetti(["🌳", "🎈", "✨"]);
  },
  poke: (el) => poke(el),
  "set-status": (el) => {
    store.set(`status/${el.dataset.who}`, { state: el.dataset.state, ts: Date.now() });
    setTimeout(() => poke(document.querySelector(`[data-action="poke"][data-who="${el.dataset.who}"]`)), 120);
  },
  "send-mail": () => {
    const text = ($("#mail-text")?.value || "").trim();
    if (!text) { toast("메모를 적어 주세요"); return; }
    const id = newId();
    seenMail.add(id);
    store.set(`mailbox/${id}`, { from: myRole(), text, ts: Date.now() });
    drafts.mail = "";
    $("#mail-text").value = "";
    toast("메모를 보냈어요 💌");
  },
  "mic-mail": (el) => micInto("mail", el),
  "speak-mail": (el) => { const m = data.mailbox?.[el.dataset.id]; if (m) speak(mailSpeechText(m)); },
  "read-all": () => {
    const msgs = list(data.mailbox).sort((a, b) => b.ts - a.ts).slice(0, 3).reverse();
    speak(msgs.map(mailSpeechText).join(" "));
  },
  "del-mail": (el) => { store.remove(`mailbox/${el.dataset.id}`); toast("메모를 지웠어요"); },
  "mic-music": (el) => micInto("music", el),
  "fav-add": () => favForm(),
  "fav-edit": (el) => favForm({ id: el.dataset.id, ...data.music?.favorites?.[el.dataset.id] }),
  "wx-refresh": () => { toast("날씨를 새로 불러와요"); loadWeather(true); },
  "wx-place": () => placeForm(),
  "prep-view": (el) => { prepView = el.dataset.view; renderPrep(); },
  "prep-toggle": (el) => {
    const k = el.dataset.day;
    const on = !!data.daily?.[k]?.prep?.items?.[el.dataset.key];
    const patch = { [`daily/${k}/prep/items/${el.dataset.key}`]: on ? null : true };
    if (on && data.daily?.[k]?.prep?.done) {
      patch[`daily/${k}/prep/done`] = null;
      patch[`daily/${k}/prep/ok`] = null;
      patch[`starsLog/${k}_prep`] = null;
    }
    store.update("", patch);
  },
  "prep-done": (el) => {
    const k = el.dataset.day;
    store.update("", {
      [`daily/${k}/prep/done`]: { by: myRole(), ts: Date.now() },
      [`starsLog/${k}_prep`]: { amount: 1, reason: "🎒 준비물 다 챙김", date: k, ts: Date.now() }
    });
    toast("🙌 다 챙겼어요! ⭐ 1개");
    confetti(["🎒", "✨", "⭐", "👍"]);
  },
  "prep-ok": (el) => {
    store.set(`daily/${el.dataset.day}/prep/ok`, { by: myRole(), ts: Date.now() });
    toast("👍 확인했어요");
  },
  "prep-undo": (el) => {
    const k = el.dataset.day;
    store.update("", { [`daily/${k}/prep/done`]: null, [`daily/${k}/prep/ok`]: null, [`starsLog/${k}_prep`]: null });
  },
  "prep-add-once": (el) => prepOnceForm({}, el.dataset.day),
  "prep-add-regular": () => prepRegularForm(),
  "prep-edit": (el) => {
    const kind = el.dataset.kind, id = el.dataset.id;
    const rec = data.prep?.[kind]?.[id];
    if (!rec) return;
    if (kind === "regular") prepRegularForm({ id, ...rec });
    else prepOnceForm({ id, ...rec });
  },
  "prep-speak": () => {
    const view = prepDayOf();
    const d = view === "today" ? startOfDay() : addDays(startOfDay(), 1);
    const k = dateKey(d);
    const checked = data.daily?.[k]?.prep?.items || {};
    const left = prepItemsFor(d).flatMap((g) => g.items).filter((it) => !checked[it.key]).map((it) => it.title);
    speak(left.length ? `${view === "today" ? "오늘" : "내일"} 챙길 것. ${left.join(", ")}. 모두 ${left.length}개예요.` : "다 챙겼어요. 잘했어요!");
  },
  "gcal-sync": () => syncCalendar(false),
  "gcal-pick": () => syncCalendar(true),
  "add-piece": () => pieceForm(),
  "edit-piece": (el) => pieceForm({ id: el.dataset.id, ...data.piano?.[el.dataset.id] }),
  "piano-plus": (el) => pianoStep(el.dataset.id, 1),
  "piano-minus": (el) => pianoStep(el.dataset.id, -1),
  "pass-piece": (el) => {
    const x = data.piano?.[el.dataset.id];
    if (!x) return;
    store.update(`piano/${el.dataset.id}`, { status: "passed", passedAt: Date.now() });
    toast(`🏅 ${x.title} 통과 축하해요!`);
    confetti(["🏅", "🎉", "🎹", "⭐"]);
  }
};

function setupEvents() {
  document.addEventListener("click", (e) => {
    const link = e.target.closest("a.is-disabled");
    if (link) { e.preventDefault(); toast("먼저 노래 제목이나 가수를 입력해 주세요"); return; }
    const melon = e.target.closest("a[data-melon-q]");
    if (melon && IS_ANDROID && melon.dataset.melonQ) {
      e.preventDefault();
      openMelonApp(melon.dataset.melonQ);
      return;
    }
    const el = e.target.closest("[data-action]");
    if (!el || el.disabled) return;
    const fn = actions[el.dataset.action];
    if (fn) fn(el);
  });
  document.addEventListener("input", (e) => {
    if (e.target.id === "mail-text") drafts.mail = e.target.value;
    if (e.target.id === "music-q") {
      drafts.music = e.target.value;
      updateMusicLinks();
    }
  });
  document.addEventListener("change", (e) => {
    const k = e.target.dataset?.meal;
    if (k) {
      const v = e.target.value.trim();
      store.set(`meals/${k}`, v || null);
      toast(v ? "저녁 메뉴를 저장했어요 🍚" : "지웠어요");
    }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.dataset?.meal) e.target.blur();
    if (e.key === "Enter" && e.target.id === "music-q") { e.preventDefault(); e.target.blur(); renderMusic(); }
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && e.target.id === "mail-text") actions["send-mail"]();
  });
  $("#mode-btn").addEventListener("click", toggleMode);
  $("#settings-btn").addEventListener("click", openSettings);
}
function updateMusicLinks() {
  const q = drafts.music.trim();
  document.querySelectorAll("[data-music-link]").forEach((a) => {
    if (q) {
      a.href = a.dataset.musicLink === "melon" ? melonUrl(q) : ytmUrl(q);
      if (a.dataset.musicLink === "melon") a.dataset.melonQ = q;
      a.classList.remove("is-disabled");
      a.removeAttribute("aria-disabled");
    } else {
      a.removeAttribute("href");
      a.classList.add("is-disabled");
      a.setAttribute("aria-disabled", "true");
    }
  });
  const fav = document.querySelector('[data-action="fav-add"]');
  if (fav) fav.disabled = !q;
}

// =============================================================
//  동기화 상태 표시
// =============================================================
function setSync(state) {
  const b = $("#sync-badge");
  const map = {
    demo: ["🧪 데모 모드", "demo"],
    connecting: ["연결 중…", "wait"],
    online: ["🟢 실시간 동기화", "ok"],
    offline: ["🟠 오프라인", "warn"],
    error: ["⚠️ 연결 실패 · 데모 모드", "warn"]
  };
  const [text, cls] = map[state] || map.connecting;
  b.textContent = text;
  b.className = `sync-badge ${cls}`;
}

// =============================================================
//  시작
// =============================================================
async function start() {
  setupDialog();
  setupEvents();
  renderTop();
  const savedFid = device.get("familyId", "");
  if (hasFirebaseConfig() && !/^[A-Za-z0-9_-]{8,60}$/.test(savedFid)) {
    device.set("familyId", "");
    device.set("setupDone", false);
  }
  if (!device.get("setupDone", false)) {
    await setupFamily(false);
  }
  const fid = hasFirebaseConfig() ? device.get("familyId", "") : "demo";
  store = await createStore(fid, setSync);
  store.subscribe((val) => {
    if (!val && !seededCheck) {
      seededCheck = true;
      store.set("", seedData());
      return;
    }
    seededCheck = true;
    data = val || {};
    renderAll();
    checkNewMail();
  });
  if (gcalConfigured()) preloadGoogle();
  setTimeout(() => loadWeather(false), 800);
  setInterval(() => loadWeather(false), 30 * 60 * 1000);
  setInterval(() => { renderTop(); renderHero(); renderSchedule(); renderDday(); renderStatus(); }, 60000);

  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    navigator.serviceWorker.register("./sw.js").catch((err) => console.warn("서비스 워커 등록 실패", err));
  }
}

start();
