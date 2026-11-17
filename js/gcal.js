// 구글 캘린더 읽기 (브라우저에서 직접, 읽기 전용 권한)
import { GOOGLE_CLIENT_ID } from "./google-config.js";

const SCOPE = "https://www.googleapis.com/auth/calendar.readonly";
const API = "https://www.googleapis.com/calendar/v3";
let gisPromise = null;
let tokenClient = null;
let token = null;
let tokenExp = 0;

export const gcalConfigured = () => Boolean(GOOGLE_CLIENT_ID);

function loadGIS() {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (gisPromise) return gisPromise;
  gisPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => { gisPromise = null; reject(new Error("구글 로그인 스크립트를 불러오지 못했어요")); };
    document.head.appendChild(s);
  });
  return gisPromise;
}

export const preloadGoogle = () => loadGIS().catch(() => {});

// 버튼을 누른 직후에 불러야 팝업이 막히지 않아요.
export async function getToken() {
  if (token && Date.now() < tokenExp - 60000) return token;
  await loadGIS();
  return new Promise((resolve, reject) => {
    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: SCOPE,
      callback: (res) => {
        if (res.error) { reject(new Error(res.error)); return; }
        token = res.access_token;
        tokenExp = Date.now() + (Number(res.expires_in) || 3600) * 1000;
        resolve(token);
      },
      error_callback: (err) => reject(new Error(err?.type || "popup_failed"))
    });
    tokenClient.requestAccessToken({ prompt: token ? "" : "consent" });
  });
}

async function api(path, params = {}) {
  const t = await getToken();
  const url = new URL(API + path);
  Object.entries(params).forEach(([k, v]) => v !== undefined && url.searchParams.set(k, v));
  const res = await fetch(url, { headers: { Authorization: `Bearer ${t}` } });
  if (res.status === 401) { token = null; throw new Error("로그인이 만료됐어요. 다시 시도해 주세요"); }
  if (!res.ok) throw new Error(`구글 캘린더 오류 (${res.status})`);
  return res.json();
}

export async function listCalendars() {
  const out = await api("/users/me/calendarList", { minAccessRole: "reader", maxResults: 100 });
  return (out.items || []).map((c) => ({ id: c.id, name: c.summaryOverride || c.summary, primary: !!c.primary }));
}

const pad = (n) => String(n).padStart(2, "0");
const keyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export async function fetchEvents(calendars, timeMin, timeMax) {
  const all = [];
  for (const cal of calendars) {
    let pageToken;
    do {
      const out = await api(`/calendars/${encodeURIComponent(cal.id)}/events`, {
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        singleEvents: "true",
        orderBy: "startTime",
        maxResults: 250,
        pageToken
      });
      for (const ev of out.items || []) {
        if (ev.status === "cancelled" || !ev.start) continue;
        const allDay = Boolean(ev.start.date);
        let date, time = "";
        if (allDay) {
          date = ev.start.date;
        } else {
          const d = new Date(ev.start.dateTime);
          date = keyOf(d);
          time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
        }
        all.push({
          key: `${cal.id}_${ev.id}`.replace(/[.#$[\]/@]/g, "_").slice(0, 700),
          title: ev.summary || "(제목 없음)",
          date, time, allDay,
          place: ev.location || "",
          cal: cal.name || ""
        });
      }
      pageToken = out.nextPageToken;
    } while (pageToken);
  }
  return all;
}
