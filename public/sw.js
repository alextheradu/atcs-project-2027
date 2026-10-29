/* Service worker. It does two things only: show push notifications, and keep the static app shell
 * (built scripts, styles, fonts and icons) so the app starts fast. It never caches pages, API responses
 * or anything tied to a student. Every other request goes straight to the network. */
const CACHE = "shell-v1";
const STATIC = /^\/(_next\/static\/|icons\/)/;

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // Only same-origin static assets. Pages, /api, server actions and everything else are left alone.
  if (url.origin !== self.location.origin || !STATIC.test(url.pathname)) return;
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const hit = await cache.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok && res.type === "basic") cache.put(req, res.clone());
      return res;
    }),
  );
});

self.addEventListener("push", (event) => {
  let data = { title: "Course Planner", body: "", url: "/dashboard" };
  try {
    data = { ...data, ...event.data.json() };
  } catch {}
  event.waitUntil(
    self.registration.showNotification(String(data.title).slice(0, 80), {
      body: String(data.body).slice(0, 140),
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: String(data.url).startsWith("/") ? data.url : "/dashboard" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/dashboard";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      const open = wins.find((w) => new URL(w.url).origin === self.location.origin);
      if (open) return open.focus().then(() => open.navigate(url));
      return self.clients.openWindow(url);
    }),
  );
});
