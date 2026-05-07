// KItchenOS Service Worker — handles Web Push notifications
self.addEventListener("push", (event) => {
  const data = event.data?.json() ?? {};
  const title = data.title || "KItchenOS";
  const options = {
    body: data.body || "",
    icon: data.icon || "/app/assets/images/icon.png",
    badge: "/app/assets/images/icon.png",
    data: { url: data.url || "/app/" },
    vibrate: [200, 100, 200],
  };
  event.waitUntil(self.registration.showNotification(title, options));
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
