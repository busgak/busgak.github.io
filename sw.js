/* 버스 출발 알리미 서비스워커 - 앱 껍데기는 캐시, API는 항상 네트워크 */
const CACHE = "bus-alarm-v45";
const SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", e => {
  // HTTP 캐시를 우회해 서버에서 직접 최신 파일을 받아 캐시에 담는다 (구버전 재활용 방지)
  e.waitUntil(
    caches.open(CACHE).then(c =>
      Promise.all(SHELL.map(u =>
        fetch(new Request(u, { cache: "reload" })).then(res => {
          if (!res.ok) throw new Error("shell fetch " + res.status);
          return c.put(u, res);
        })
      ))
    ).then(() => self.skipWaiting())
  );
});
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
/* 서버 푸시 수신 → 시스템 알림 표시 */
self.addEventListener("push", e => {
  let d = {};
  try { d = e.data.json(); } catch (err) { d = { title: "버스각", body: e.data ? e.data.text() : "" }; }
  e.waitUntil(self.registration.showNotification(d.title || "버스각", {
    body: d.body || "", tag: d.tag || "busgak", icon: "icon-192.png", badge: "icon-192.png",
    vibrate: [200, 100, 200], renotify: true
  }));
});
self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
    for (const c of list) { if ("focus" in c) return c.focus(); }
    return clients.openWindow("./");
  }));
});
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  // 같은 출처의 앱 파일만 캐시 우선, 나머지(버스 API 등)는 네트워크 직행
  if (url.origin === location.origin) {
    e.respondWith(
      caches.match(e.request).then(hit =>
        hit || fetch(e.request).then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
          return res;
        })
      )
    );
  }
});
