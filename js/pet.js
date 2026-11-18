// =============================================================
//  별콩이 — 별을 먹고 자라는 우리 집 오리지널 캐릭터
//  모은 별(누적)로 자라고, 쓸 수 있는 별로 아이템을 사서 꾸며요.
// =============================================================

export const PET_COLORS = [
  { id: "peach", label: "복숭아", body: "#FFC9A8", shade: "#F4A985", line: "#B86A49" },
  { id: "mint", label: "민트", body: "#AEE8CF", shade: "#86D3B2", line: "#3F8C6C" },
  { id: "sky", label: "하늘", body: "#B5D5FF", shade: "#8DB9F2", line: "#4570A8" },
  { id: "lemon", label: "레몬", body: "#FFE7A0", shade: "#F5CF6A", line: "#A07B1C" },
  { id: "lavender", label: "라벤더", body: "#D6C6FF", shade: "#B9A3F5", line: "#6A51B0" },
  { id: "pink", label: "딸기우유", body: "#FFC4DA", shade: "#F7A2C2", line: "#B04C76" }
];

export const STAGES = [
  { min: 0, name: "별콩 알", desc: "따뜻하게 품어 주면 곧 깨어나요" },
  { min: 10, name: "아기 별콩이", desc: "새싹이 쏙! 이제 막 태어났어요" },
  { min: 40, name: "꼬마 별콩이", desc: "새싹이 별꽃 봉오리가 됐어요" },
  { min: 100, name: "별콩이", desc: "별꽃이 활짝 피고 날개가 생겼어요" },
  { min: 200, name: "전설의 별콩이", desc: "반짝반짝 빛나는 전설이 됐어요" }
];

export const PET_ITEMS = [
  { id: "ribbon", name: "리본", emoji: "🎀", cost: 10, slot: "head" },
  { id: "beanie", name: "털모자", emoji: "🧶", cost: 20, slot: "head" },
  { id: "crown", name: "왕관", emoji: "👑", cost: 50, slot: "head" },
  { id: "glasses", name: "동글 안경", emoji: "👓", cost: 15, slot: "face" },
  { id: "shades", name: "선글라스", emoji: "🕶️", cost: 25, slot: "face" },
  { id: "scarf", name: "목도리", emoji: "🧣", cost: 20, slot: "neck" },
  { id: "bowtie", name: "나비넥타이", emoji: "🦋", cost: 15, slot: "neck" },
  { id: "balloon", name: "풍선", emoji: "🎈", cost: 30, slot: "hand" },
  { id: "flag", name: "깃발", emoji: "🚩", cost: 30, slot: "hand" }
];

export function stageOf(earned) {
  let i = 0;
  STAGES.forEach((s, idx) => { if (earned >= s.min) i = idx; });
  const next = STAGES[i + 1] || null;
  const base = STAGES[i].min;
  const pct = next ? Math.round(((earned - base) / (next.min - base)) * 100) : 100;
  return { index: i, ...STAGES[i], next, pct, toNext: next ? next.min - earned : 0 };
}

const colorOf = (id) => PET_COLORS.find((c) => c.id === id) || PET_COLORS[0];

function eggSvg(c, earned) {
  const crack = earned >= 5;
  return `
    <ellipse cx="100" cy="182" rx="46" ry="8" fill="#000" opacity=".08"/>
    <g class="pet-wobble">
      <path d="M100 38 C 140 38 156 100 156 128 C 156 162 132 180 100 180 C 68 180 44 162 44 128 C 44 100 60 38 100 38 Z" fill="#FFF8EE" stroke="${c.line}" stroke-width="3"/>
      <circle cx="78" cy="100" r="9" fill="${c.body}"/>
      <circle cx="122" cy="84" r="6" fill="${c.body}"/>
      <circle cx="118" cy="138" r="11" fill="${c.body}"/>
      <circle cx="74" cy="148" r="6" fill="${c.body}"/>
      <path d="M96 62 l3 7 7 1 -5 5 1 7 -6 -3 -6 3 1 -7 -5 -5 7 -1 z" fill="#FFD75E" stroke="#E0A92B" stroke-width="1.5"/>
      ${crack ? `<path d="M62 118 l12 -8 10 10 12 -12 12 10 12 -8 14 8" fill="none" stroke="${c.line}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>` : ""}
    </g>`;
}

function headDeco(stage, c) {
  if (stage === 1) {
    return `<path d="M100 58 C 100 46 100 40 100 34" stroke="#5CAF6F" stroke-width="4" stroke-linecap="round"/>
      <path d="M100 40 C 88 30 78 34 76 42 C 86 46 96 44 100 40 Z" fill="#7DCB8A"/>
      <path d="M100 38 C 112 26 124 30 126 38 C 116 44 106 42 100 38 Z" fill="#7DCB8A"/>`;
  }
  if (stage === 2) {
    return `<path d="M100 58 C 100 46 100 40 100 30" stroke="#5CAF6F" stroke-width="4" stroke-linecap="round"/>
      <path d="M100 46 C 88 38 80 42 78 48 C 88 52 96 50 100 46 Z" fill="#7DCB8A"/>
      <circle cx="100" cy="26" r="9" fill="#FFE08A" stroke="#E0A92B" stroke-width="2"/>
      <path d="M100 18 v-4 M108 21 l3 -3 M92 21 l-3 -3" stroke="#E0A92B" stroke-width="2" stroke-linecap="round"/>`;
  }
  // 3, 4: 활짝 핀 별꽃
  return `<path d="M100 58 C 100 46 100 40 100 34" stroke="#5CAF6F" stroke-width="4" stroke-linecap="round"/>
    <path d="M100 48 C 88 40 80 44 78 50 C 88 54 96 52 100 48 Z" fill="#7DCB8A"/>
    <path d="M100 6 l6 13 14 2 -10 10 2 14 -12 -7 -12 7 2 -14 -10 -10 14 -2 z" fill="#FFD75E" stroke="#E0A92B" stroke-width="2" stroke-linejoin="round"/>
    <circle cx="100" cy="25" r="4" fill="#FFF4C2"/>`;
}

function wings(stage, c) {
  if (stage < 3) return "";
  const wing = (flip) => `<g transform="${flip ? "translate(200 0) scale(-1 1)" : ""}">
      <path d="M58 104 C 40 84 18 84 12 100 C 18 100 22 102 22 106 C 14 108 12 116 18 120 C 22 118 28 118 28 122 C 22 126 24 134 32 134 C 42 134 52 126 58 118 Z" fill="#FFFFFF" stroke="${c.shade}" stroke-width="3" stroke-linejoin="round"/>
      <path d="M50 104 C 40 98 30 98 24 102 M48 114 C 40 112 34 114 30 118" stroke="${c.shade}" stroke-width="2" fill="none" stroke-linecap="round"/>
    </g>`;
  return `<g class="pet-wing">${wing(false)}${wing(true)}</g>`;
}

function itemSvg(id, stage) {
  const top = stage >= 3 ? 52 : 58; // 머리 위치
  switch (id) {
    case "ribbon": return `<g><path d="M128 ${top + 4} l-14 -10 v20 z M128 ${top + 4} l14 -10 v20 z" fill="#FF7FA8" stroke="#C94C77" stroke-width="2" stroke-linejoin="round"/><circle cx="128" cy="${top + 4}" r="5" fill="#FF9DBD" stroke="#C94C77" stroke-width="2"/></g>`;
    case "beanie": return `<g><path d="M66 ${top + 16} C 66 ${top - 14} 134 ${top - 14} 134 ${top + 16} Z" fill="#7FA8FF" stroke="#4A6FC4" stroke-width="2.5"/><rect x="62" y="${top + 10}" width="76" height="12" rx="6" fill="#A9C4FF" stroke="#4A6FC4" stroke-width="2.5"/><circle cx="100" cy="${top - 10}" r="8" fill="#FFFFFF" stroke="#4A6FC4" stroke-width="2.5"/></g>`;
    case "crown": return `<g><path d="M74 ${top + 12} l4 -24 12 14 10 -20 10 20 12 -14 4 24 z" fill="#FFD75E" stroke="#C9941F" stroke-width="2.5" stroke-linejoin="round"/><circle cx="100" cy="${top + 2}" r="3.5" fill="#FF6F91"/><circle cx="84" cy="${top + 6}" r="3" fill="#6FC3FF"/><circle cx="116" cy="${top + 6}" r="3" fill="#6FC3FF"/></g>`;
    case "glasses": return `<g fill="none" stroke="#5A4A42" stroke-width="3"><circle cx="82" cy="108" r="13"/><circle cx="118" cy="108" r="13"/><path d="M95 108 h10"/></g>`;
    case "shades": return `<g><path d="M66 100 h30 v8 c0 9 -6 13 -15 13 c-9 0 -15 -4 -15 -13 z M104 100 h30 v8 c0 9 -6 13 -15 13 c-9 0 -15 -4 -15 -13 z" fill="#2E2A33"/><path d="M96 103 h8" stroke="#2E2A33" stroke-width="3"/><path d="M72 104 l8 0" stroke="#fff" stroke-width="2" opacity=".6"/></g>`;
    case "scarf": return `<g><path d="M60 140 C 80 152 120 152 140 140 L 140 152 C 120 164 80 164 60 152 Z" fill="#FF8C6B" stroke="#C45A3D" stroke-width="2.5"/><path d="M122 152 l4 24 12 -4 -6 -22 z" fill="#FF8C6B" stroke="#C45A3D" stroke-width="2.5" stroke-linejoin="round"/><path d="M70 146 v8 M84 150 v8 M98 151 v8 M112 150 v8" stroke="#FFD2C2" stroke-width="2.5"/></g>`;
    case "bowtie": return `<g><path d="M100 150 l-16 -9 v18 z M100 150 l16 -9 v18 z" fill="#5B6CFF" stroke="#3343B8" stroke-width="2" stroke-linejoin="round"/><circle cx="100" cy="150" r="4.5" fill="#8A97FF" stroke="#3343B8" stroke-width="2"/></g>`;
    case "balloon": return `<g class="pet-float"><path d="M166 126 C 168 100 172 80 176 64" stroke="#8C7E76" stroke-width="2" fill="none"/><ellipse cx="178" cy="48" rx="16" ry="19" fill="#FF7F9E" stroke="#C94C6E" stroke-width="2.5"/><path d="M172 40 c2 -5 6 -7 9 -7" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".7"/><path d="M178 67 l-4 5 h8 z" fill="#C94C6E"/></g>`;
    case "flag": return `<g><path d="M164 132 V 66" stroke="#8C6A52" stroke-width="4" stroke-linecap="round"/><path d="M164 68 L 194 78 L 164 90 Z" fill="#FFB347" stroke="#C47A1C" stroke-width="2.5" stroke-linejoin="round"/><path d="M174 77 l2 4 4 .5 -3 3 .7 4 -3.7 -2 -3.7 2 .7 -4 -3 -3 4 -.5 z" fill="#FFF4C2"/></g>`;
    default: return "";
  }
}

export function petSvg({ earned = 0, color = "peach", wearing = {}, mood = "happy", label = "별콩이" } = {}) {
  const c = colorOf(color);
  const st = stageOf(earned).index;
  const title = `<title>${label}</title>`;
  if (st === 0) {
    return `<svg viewBox="0 0 200 200" class="pet-svg" role="img" aria-label="${label} (알)">${title}${eggSvg(c, earned)}</svg>`;
  }
  const scale = [0, 0.82, 0.92, 1, 1][st];
  const eyes = mood === "sleepy"
    ? `<path d="M74 108 q8 6 16 0 M110 108 q8 6 16 0" stroke="#3B302B" stroke-width="3.5" fill="none" stroke-linecap="round"/>`
    : `<g class="pet-eyes"><ellipse cx="82" cy="108" rx="7.5" ry="9" fill="#3B302B"/><ellipse cx="118" cy="108" rx="7.5" ry="9" fill="#3B302B"/><circle cx="85" cy="104" r="3" fill="#fff"/><circle cx="121" cy="104" r="3" fill="#fff"/></g>`;
  const mouth = mood === "wow"
    ? `<ellipse cx="100" cy="128" rx="6" ry="7" fill="#7A3B3B"/>`
    : `<path d="M92 124 q8 9 16 0" stroke="#3B302B" stroke-width="3.5" fill="none" stroke-linecap="round"/>`;
  const aura = st === 4 ? `<circle cx="100" cy="110" r="88" fill="url(#petGlow)"/>
      <g class="pet-sparkle"><path d="M30 50 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3 z" fill="#FFE27A"/><path d="M168 150 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2 z" fill="#FFE27A"/><path d="M176 40 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2 z" fill="#FFFFFF"/></g>` : "";
  const arms = st >= 2
    ? `<path d="M54 132 q-12 4 -10 16" stroke="${c.line}" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M146 132 q12 4 10 16" stroke="${c.line}" stroke-width="3" fill="none" stroke-linecap="round"/>`
    : "";
  const wear = (slot) => (wearing[slot] ? itemSvg(wearing[slot], st) : "");
  return `<svg viewBox="0 0 200 200" class="pet-svg" role="img" aria-label="${label}">${title}
    <defs><radialGradient id="petGlow"><stop offset="0" stop-color="#FFF3B0" stop-opacity=".9"/><stop offset="1" stop-color="#FFF3B0" stop-opacity="0"/></radialGradient></defs>
    ${aura}
    <ellipse cx="100" cy="184" rx="${44 * scale}" ry="8" fill="#000" opacity=".08"/>
    <g class="pet-bob" transform="translate(${100 - 100 * scale} ${200 - 200 * scale}) scale(${scale})">
      ${wings(st, c)}
      ${headDeco(st, c)}
      <path d="M100 56 C 146 56 160 100 158 132 C 156 166 130 180 100 180 C 70 180 44 166 42 132 C 40 100 54 56 100 56 Z" fill="${c.body}" stroke="${c.line}" stroke-width="3.5"/>
      <path d="M62 148 C 70 168 130 168 138 148 C 128 160 72 160 62 148 Z" fill="${c.shade}" opacity=".6"/>
      <ellipse cx="74" cy="80" rx="12" ry="7" fill="#fff" opacity=".45" transform="rotate(-25 74 80)"/>
      ${eyes}
      <ellipse cx="68" cy="124" rx="9" ry="6" fill="#FF8FA3" opacity=".55"/>
      <ellipse cx="132" cy="124" rx="9" ry="6" fill="#FF8FA3" opacity=".55"/>
      ${mouth}
      ${arms}
      <ellipse cx="80" cy="180" rx="11" ry="6" fill="${c.shade}" stroke="${c.line}" stroke-width="3"/>
      <ellipse cx="120" cy="180" rx="11" ry="6" fill="${c.shade}" stroke="${c.line}" stroke-width="3"/>
      ${wear("neck")}${wear("face")}${wear("head")}${wear("hand")}
    </g>
  </svg>`;
}

export function petLine({ name, stage, p, prepLeft, earnedToday }) {
  const lines = [];
  if (stage === 0) return ["따뜻해… 별을 조금만 더 주면 깨어날 것 같아!", "콩닥콩닥… 안에서 뭔가 움직여요!", "⭐을 모으면 내가 나올 수 있어!"];
  if (prepLeft > 0) lines.push(`준비물 ${prepLeft}개 남았어! 같이 챙기자 🎒`);
  if (p.total && p.done === p.total) lines.push("오늘 할 일 다 했네! 최고야 💖", "와! 나도 덩달아 쑥쑥 자라는 기분이야!");
  else if (p.total) lines.push(`오늘 할 일 ${p.total - p.done}개 남았어. 하나만 더 해 볼까?`);
  if (earnedToday > 0) lines.push(`오늘 별을 ${earnedToday}개나 줬네! 냠냠 맛있다 ⭐`);
  lines.push(`나는 ${name}! 오늘도 반가워 👋`, "간질간질~ 히히", "책 읽어 줄래? 나 이야기 좋아해 📖", "물 마셨어? 나도 한 모금 💧", "엄마 아빠한테 사랑한다고 말해 볼까? 💌");
  return lines;
}
