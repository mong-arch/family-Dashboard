// =============================================================
//  데이터 저장소
//  - Firebase 설정이 있으면: Realtime Database + 익명 로그인으로 실시간 동기화
//  - 없으면: 데모 모드 (localStorage + 같은 브라우저의 다른 탭끼리만 동기화)
//  모든 데이터는 families/{가족코드}/ 아래에 저장됩니다.
// =============================================================
import { firebaseConfig } from "./firebase-config.js";

export const FB_VERSION = "12.18.0";
export const FB_BASE = `https://www.gstatic.com/firebasejs/${FB_VERSION}`;
let firebaseAppInstance = null;
export const getFirebaseApp = () => firebaseAppInstance;

export function hasFirebaseConfig() {
  return Boolean(firebaseConfig && firebaseConfig.apiKey && firebaseConfig.databaseURL);
}

function splitPath(path) {
  return String(path).split("/").filter(Boolean);
}

function getAt(obj, parts) {
  return parts.reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

function setAt(obj, parts, value) {
  if (!parts.length) return value;
  const [head, ...rest] = parts;
  const base = obj && typeof obj === "object" ? { ...obj } : {};
  const next = setAt(base[head], rest, value);
  if (next === null || next === undefined) delete base[head];
  else base[head] = next;
  return base;
}

export function newId() {
  const t = Date.now().toString(36);
  const r = Math.random().toString(36).slice(2, 8);
  return `${t}${r}`;
}

// ---------------- 데모(로컬) 저장소 ----------------
class LocalStore {
  constructor(familyId) {
    this.key = `family-dashboard:${familyId}`;
    this.listeners = new Set();
    this.channel = "BroadcastChannel" in window ? new BroadcastChannel(this.key) : null;
    this.mode = "local";
  }
  async connect(onStatus) {
    onStatus?.("demo");
    if (this.channel) {
      this.channel.onmessage = () => this.emit();
    }
    window.addEventListener("storage", (e) => {
      if (e.key === this.key) this.emit();
    });
    return this;
  }
  read() {
    try {
      return JSON.parse(localStorage.getItem(this.key) || "null");
    } catch {
      return null;
    }
  }
  write(data) {
    localStorage.setItem(this.key, JSON.stringify(data ?? null));
    this.channel?.postMessage("changed");
    this.emit();
  }
  emit() {
    const data = this.read();
    this.listeners.forEach((fn) => fn(data));
  }
  subscribe(fn) {
    this.listeners.add(fn);
    fn(this.read());
    return () => this.listeners.delete(fn);
  }
  async set(path, value) {
    this.write(setAt(this.read() || {}, splitPath(path), value));
  }
  async update(path, patch) {
    let data = this.read() || {};
    for (const [k, v] of Object.entries(patch)) {
      data = setAt(data, [...splitPath(path), ...splitPath(k)], v);
    }
    this.write(data);
  }
  async remove(path) {
    this.write(setAt(this.read() || {}, splitPath(path), null));
  }
  async inc(path, n) {
    const parts = splitPath(path);
    const cur = Number(getAt(this.read() || {}, parts)) || 0;
    this.write(setAt(this.read() || {}, parts, cur + n));
  }
}

// ---------------- Firebase 저장소 ----------------
class FirebaseStore {
  constructor(familyId) {
    this.familyId = familyId;
    this.mode = "firebase";
  }
  async connect(onStatus) {
    onStatus?.("connecting");
    const [{ initializeApp }, db, auth] = await Promise.all([
      import(`${FB_BASE}/firebase-app.js`),
      import(`${FB_BASE}/firebase-database.js`),
      import(`${FB_BASE}/firebase-auth.js`)
    ]);
    this.db = db;
    const app = initializeApp(firebaseConfig);
    firebaseAppInstance = app;
    const a = auth.getAuth(app);
    await auth.signInAnonymously(a);
    this.database = db.getDatabase(app);
    this.root = db.ref(this.database, `families/${this.familyId}`);
    db.onValue(db.ref(this.database, ".info/connected"), (snap) => {
      onStatus?.(snap.val() ? "online" : "offline");
    });
    return this;
  }
  ref(path) {
    const p = String(path || "").replace(/^\/+|\/+$/g, "");
    return p ? this.db.child(this.root, p) : this.root;
  }
  subscribe(fn) {
    return this.db.onValue(this.root, (snap) => fn(snap.val()));
  }
  async set(path, value) {
    return this.db.set(this.ref(path), value ?? null);
  }
  async update(path, patch) {
    const target = path ? this.ref(path) : this.root;
    return this.db.update(target, patch);
  }
  async remove(path) {
    return this.db.remove(this.ref(path));
  }
  async inc(path, n) {
    return this.db.set(this.ref(path), this.db.increment(n));
  }
}

export async function createStore(familyId, onStatus) {
  if (hasFirebaseConfig()) {
    try {
      const store = new FirebaseStore(familyId);
      await store.connect(onStatus);
      return store;
    } catch (err) {
      console.error("Firebase 연결 실패, 데모 모드로 전환합니다.", err);
      onStatus?.("error", err);
    }
  }
  const local = new LocalStore(familyId);
  await local.connect(onStatus);
  return local;
}
