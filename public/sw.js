// public/sw.js
// Service Worker untuk Web Push Notification - Sistem Informasi Klinik Kesehatan

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {
    title: "Klinik Sehat Sentosa",
    body: "Pemberitahuan antrean baru",
    icon: "/favicon.ico",
    badge: "/favicon.ico",
    url: "/pasien",
  };

  if (event.data) {
    try {
      const json = event.data.json();
      data = { ...data, ...json };
    } catch {
      data.body = event.data.text() || data.body;
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || "/favicon.ico",
    badge: data.badge || "/favicon.ico",
    data: {
      url: data.url || "/",
    },
    vibrate: [120, 60, 120],
    tag: data.tag || "sehatklinik-push",
    renotify: true,
  };

  event.waitUntil(
    self.registration.showNotification(data.title || "Klinik Sehat Sentosa", options)
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const rawUrl = (event.notification.data && event.notification.data.url) || "/pasien";
  const targetUrl = new URL(rawUrl, self.location.origin).href;

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // Cari tab atau window yang berasal dari origin yang sama
        for (const client of clientList) {
          if (client.url === targetUrl && "focus" in client) {
            return client.focus();
          }
        }
        // Jika ada tab terbuka pada origin klinik tetapi di URL lain, navigasikan dan fokus
        for (const client of clientList) {
          if ("focus" in client) {
            if ("navigate" in client) {
              client.navigate(targetUrl);
            }
            return client.focus();
          }
        }
        // Jika belum ada window/tab yang terbuka, buka window baru
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      })
  );
});
