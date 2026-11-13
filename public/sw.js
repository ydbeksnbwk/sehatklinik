// public/sw.js
// Service Worker untuk Web Push Notification - Sistem Informasi Klinik Kesehatan
// Membaca payload JSON dari worker dan menangani klik notifikasi dengan sanitasi path relatif

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Sanitasi path: hanya izinkan path relatif internal aplikasi klinik (PRD §7.5 & Butir 3.2)
function sanitizeRelativePath(input) {
  if (!input || typeof input !== "string") return "/pasien";
  const trimmed = input.trim();
  // Wajib diawali '/' dan dilarang '//' (mencegah protocol-relative URL)
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return "/pasien";
  }
  try {
    const parsed = new URL(trimmed, self.location.origin);
    if (parsed.origin !== self.location.origin) {
      return "/pasien";
    }
    return parsed.pathname + parsed.search + parsed.hash;
  } catch {
    return "/pasien";
  }
}

self.addEventListener("push", (event) => {
  let title = "Klinik Tim 7";
  let body = "Pemberitahuan antrean baru";
  let targetUrl = "/pasien";
  let icon = "/icons/icon-192x192.png";
  let badge = "/icons/badge-72x72.png";
  let tag = "sehatklinik-push";

  if (event.data) {
    try {
      const json = event.data.json();
      // Mendukung format Bahasa Indonesia (judul, pesan, tautan) dan format standar (title, body, url)
      title = json.judul || json.title || title;
      body = json.pesan || json.body || body;
      targetUrl = json.tautan || json.url || targetUrl;
      if (json.icon) icon = json.icon;
      if (json.badge) badge = json.badge;
      if (json.tag) tag = json.tag;
    } catch {
      body = event.data.text() || body;
    }
  }

  const safePath = sanitizeRelativePath(targetUrl);

  const options = {
    body,
    icon,
    badge,
    data: {
      url: safePath,
    },
    vibrate: [120, 60, 120],
    tag,
    renotify: true,
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const rawPath = event.notification.data && event.notification.data.url;
  const safePath = sanitizeRelativePath(rawPath);
  const targetUrl = new URL(safePath, self.location.origin).href;

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // Cari tab atau window yang sudah membuka URL yang persis sama
        for (const client of clientList) {
          if (client.url === targetUrl && "focus" in client) {
            return client.focus();
          }
        }
        // Jika ada tab terbuka pada origin klinik tetapi di rute lain, arahkan dan fokuskan
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
