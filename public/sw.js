self.addEventListener("install", () => {
  console.log("Service Worker installed");
});

self.addEventListener("activate", () => {
  console.log("Service Worker activated");
});

self.addEventListener("fetch", () => {
  // A minimal fetch handler is enough to pass the PWA installability requirements.
});
