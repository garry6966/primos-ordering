// Service Worker for Primo's Kitchen Push Notifications
self.addEventListener("push", (event) => {
  let data = { title: "New Order!", body: "A new order has arrived.", orderNumber: "" };
  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch (e) {
    // Use defaults
  }

  const options = {
    body: data.body,
    icon: "/favicon.ico",
    badge: "/favicon.ico",
    vibrate: [300, 100, 300, 100, 300],
    tag: "new-order-" + (data.orderNumber || Date.now()),
    requireInteraction: true,
    actions: [
      { action: "open", title: "Open Kitchen" },
    ],
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // Focus existing kitchen tab if open
      for (const client of clientList) {
        if (client.url.includes("/kitchen") && "focus" in client) {
          return client.focus();
        }
      }
      // Otherwise open a new tab
      if (clients.openWindow) {
        return clients.openWindow("/kitchen");
      }
    })
  );
});
