// 처음 실행할 때 넣는 예시 데이터입니다. 부모 모드에서 모두 수정·삭제할 수 있어요.
function pad(n) { return String(n).padStart(2, "0"); }
function keyOf(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

export function seedData(childName = "우리 아들") {
  const today = new Date();
  const year = today.getFullYear();
  const plus = (n) => { const d = new Date(today); d.setDate(d.getDate() + n); return keyOf(d); };

  return {
    settings: { childName, createdAt: Date.now() },
    academies: {
      a1: { name: "태권도", type: "학원", days: [0, 2, 4], start: "14:00", end: "15:00", fee: 150000, place: "OO태권도", color: "peach" },
      a2: { name: "피아노", type: "학원", days: [1, 3], start: "15:30", end: "16:20", fee: 130000, place: "OO피아노", color: "lavender" },
      a3: { name: "방과후 로봇과학", type: "방과후", days: [1], start: "13:10", end: "14:30", fee: 45000, place: "학교 과학실", color: "mint" },
      a4: { name: "수영", type: "운동", days: [5], start: "10:00", end: "11:00", fee: 90000, place: "구민체육센터", color: "sky" }
    },
    routines: {
      r1: { title: "책 20분 읽기", emoji: "📖", stars: 1, order: 1 },
      r2: { title: "받아쓰기 연습", emoji: "✏️", stars: 1, order: 2 },
      r3: { title: "가방 챙기기", emoji: "🎒", stars: 1, order: 3 },
      r4: { title: "양치하고 정리하기", emoji: "🪥", stars: 1, order: 4 }
    },
    worksheets: {
      w1: { name: "눈높이 수학", level: "C단계", current: 12, total: 40, daily: 3, unit: "장", stars: 2 },
      w2: { name: "눈높이 국어", level: "B단계", current: 20, total: 40, daily: 2, unit: "장", stars: 2 }
    },
    rewards: {
      p1: { title: "좋아하는 간식", emoji: "🍪", cost: 10 },
      p2: { title: "보드게임 한 판", emoji: "🎲", cost: 15 },
      p3: { title: "게임 30분", emoji: "🎮", cost: 20 },
      p4: { title: "주말 나들이 장소 고르기", emoji: "🎡", cost: 40 }
    },
    events: {
      e1: { title: "할머니 생신", date: `${year}-12-05`, yearly: true, emoji: "🎂" },
      e2: { title: "엄마 생일", date: `${year}-07-22`, yearly: true, emoji: "💐" },
      e3: { title: "아빠 생일", date: `${year}-03-14`, yearly: true, emoji: "🎉" },
      e4: { title: "학교 학예회", date: plus(20), yearly: false, emoji: "🏫" }
    },
    status: {
      mom: { state: "work", ts: Date.now() },
      dad: { state: "work", ts: Date.now() }
    },
    music: {
      favorites: {
        m1: { title: "상어가족", artist: "핑크퐁" }
      }
    },
    mailbox: {
      welcome: { from: "mom", text: "우리 가족 대시보드에 오신 걸 환영해요! 여기에 서로 메모를 남겨요.", ts: Date.now() }
    }
  };
}
