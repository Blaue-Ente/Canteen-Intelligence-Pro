// KItchenOS Service Worker — handles Web Push notifications + Kios bridge
self.addEventListener("push", (event) => {
  const data = event.data?.json() ?? {};
  const title = data.title || "KItchenOS";
  const body  = data.body  || "";
  const icon  = data.icon  || "/app/kitchenos-logo.png";
  const url   = data.url   || "/app/";

  // Notify any open app window so Kios can speak the alert
  const notifyClients = self.clients
    .matchAll({ type: "window", includeUncontrolled: true })
    .then((wins) => {
      wins.forEach((w) =>
        w.postMessage({ type: "KIOS_PUSH_ALERT", title, body, url })
      );
    });

  // Always show the OS banner (required by the Push API)
  const showBanner = self.registration.showNotification(title, {
    body,
    icon,
    badge: "/app/kitchenos-logo.png",
    data: { url },
    vibrate: [200, 100, 200],
  });

  event.waitUntil(Promise.all([notifyClients, showBanner]));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/app/";
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((wins) => {
        for (const w of wins) {
          if (w.url.includes("/app/") && "focus" in w) return w.focus();
        }
        if (clients.openWindow) return clients.openWindow(url);
      })
  );
});
