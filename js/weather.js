// 날씨·미세먼지 (Open-Meteo, 무료·키 필요 없음 · 비상업 용도)
const WX = "https://api.open-meteo.com/v1/forecast";
const AQ = "https://air-quality-api.open-meteo.com/v1/air-quality";
const GEO = "https://geocoding-api.open-meteo.com/v1/search";

export const DEFAULT_PLACE = { name: "서울", lat: 37.5665, lon: 126.978 };

const CODES = {
  0: ["☀️", "맑음"], 1: ["🌤️", "대체로 맑음"], 2: ["⛅", "구름 조금"], 3: ["☁️", "흐림"],
  45: ["🌫️", "안개"], 48: ["🌫️", "안개"],
  51: ["🌦️", "약한 이슬비"], 53: ["🌦️", "이슬비"], 55: ["🌧️", "강한 이슬비"],
  56: ["🌧️", "어는 이슬비"], 57: ["🌧️", "어는 이슬비"],
  61: ["🌧️", "약한 비"], 63: ["🌧️", "비"], 65: ["🌧️", "강한 비"],
  66: ["🌧️", "어는 비"], 67: ["🌧️", "어는 비"],
  71: ["🌨️", "약한 눈"], 73: ["🌨️", "눈"], 75: ["❄️", "많은 눈"], 77: ["🌨️", "싸락눈"],
  80: ["🌦️", "소나기"], 81: ["🌧️", "소나기"], 82: ["⛈️", "강한 소나기"],
  85: ["🌨️", "눈 소나기"], 86: ["❄️", "강한 눈 소나기"],
  95: ["⛈️", "뇌우"], 96: ["⛈️", "뇌우·우박"], 99: ["⛈️", "뇌우·우박"]
};
export const codeInfo = (c) => CODES[c] || ["🌡️", "날씨"];

// 한국 환경부 통합 기준
export function pmGrade(kind, v) {
  if (v == null || Number.isNaN(v)) return null;
  const cuts = kind === "pm25" ? [15, 35, 75] : [30, 80, 150];
  if (v <= cuts[0]) return { level: 0, label: "좋음", emoji: "😊" };
  if (v <= cuts[1]) return { level: 1, label: "보통", emoji: "🙂" };
  if (v <= cuts[2]) return { level: 2, label: "나쁨", emoji: "😷" };
  return { level: 3, label: "매우 나쁨", emoji: "🤢" };
}

export function outfit(minT, maxT) {
  const t = (Number(minT) + Number(maxT)) / 2;
  if (t <= 0) return "두꺼운 패딩 + 목도리·장갑 🧤";
  if (t <= 5) return "패딩이나 두꺼운 코트 🧥";
  if (t <= 11) return "도톰한 외투 + 긴팔 🧥";
  if (t <= 16) return "가벼운 겉옷(점퍼·가디건) 🧶";
  if (t <= 22) return "긴팔 티셔츠 👕";
  return "반팔 + 물 자주 마시기 🩳";
}

let cache = null;
const KEY = "fd:weather-cache";

export async function getWeather(place, { force = false } = {}) {
  const sig = `${place.lat},${place.lon}`;
  if (!cache) { try { cache = JSON.parse(localStorage.getItem(KEY) || "null"); } catch { cache = null; } }
  if (!force && cache && cache.sig === sig && Date.now() - cache.at < 30 * 60 * 1000) return cache.data;
  const wxUrl = new URL(WX);
  Object.entries({
    latitude: place.lat, longitude: place.lon, timezone: "Asia/Seoul", forecast_days: 3,
    current: "temperature_2m,apparent_temperature,weather_code,precipitation",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max"
  }).forEach(([k, v]) => wxUrl.searchParams.set(k, v));
  const aqUrl = new URL(AQ);
  Object.entries({ latitude: place.lat, longitude: place.lon, timezone: "Asia/Seoul", current: "pm10,pm2_5" })
    .forEach(([k, v]) => aqUrl.searchParams.set(k, v));
  const [wx, aq] = await Promise.all([
    fetch(wxUrl).then((r) => { if (!r.ok) throw new Error("날씨를 불러오지 못했어요"); return r.json(); }),
    fetch(aqUrl).then((r) => (r.ok ? r.json() : null)).catch(() => null)
  ]);
  const days = (wx.daily?.time || []).map((date, i) => ({
    date,
    code: wx.daily.weather_code[i],
    max: wx.daily.temperature_2m_max[i],
    min: wx.daily.temperature_2m_min[i],
    rain: wx.daily.precipitation_probability_max?.[i] ?? null,
    uv: wx.daily.uv_index_max?.[i] ?? null
  }));
  const data = {
    now: {
      temp: wx.current?.temperature_2m,
      feels: wx.current?.apparent_temperature,
      code: wx.current?.weather_code
    },
    days,
    pm10: aq?.current?.pm10 ?? null,
    pm25: aq?.current?.pm2_5 ?? null,
    at: Date.now()
  };
  cache = { sig, at: Date.now(), data };
  try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch { /* 저장 공간 없음 */ }
  return data;
}

export function cachedWeather(place) {
  if (!cache) { try { cache = JSON.parse(localStorage.getItem(KEY) || "null"); } catch { cache = null; } }
  return cache && cache.sig === `${place.lat},${place.lon}` ? cache.data : null;
}

export async function searchPlace(name) {
  const url = new URL(GEO);
  Object.entries({ name, count: 8, language: "ko", format: "json" }).forEach(([k, v]) => url.searchParams.set(k, v));
  const r = await fetch(url);
  if (!r.ok) throw new Error("지역을 찾지 못했어요");
  const j = await r.json();
  return (j.results || []).map((p) => ({
    name: p.name,
    detail: [p.admin1, p.admin2, p.country].filter(Boolean).join(" "),
    lat: p.latitude,
    lon: p.longitude
  }));
}
