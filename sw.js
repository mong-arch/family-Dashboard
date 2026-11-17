// 서비스 워커: 앱 화면 파일을 저장해 두고, 인터넷이 느리거나 끊겨도 열리게 합니다.
// 파일을 고친 뒤 배포할 때는 아래 VERSION 숫자를 올려 주세요.
const VERSION = "v3";
const CACHE = `family-dashboard-${VERSION}`;
const SHELL = [
  "./",
  "./index.html",
  "./css/style.css",
  "./js/app.js",
  "./js/store.js",
  "./js/seed.js",
  "./js/speech.js",
  "./js/firebase-config.js",
  "./manifest.webmanifest",
  "./icons/icon.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("family-dashboard-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // 같은 사이트 파일: 네트워크 먼저(최신 반영), 실패하면 저장본
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match("./index.html")))
    );
    return;
  }

  // 글꼴·Firebase SDK: 저장본 먼저 (실시간 데이터 통신은 건드리지 않음)
  if (/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname) || url.hostname === "www.gstatic.com") {
    event.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      }))
    );
  }
});
