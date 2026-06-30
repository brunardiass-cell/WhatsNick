importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyA85vTJa3CQwpr6KWiw_6Orf5fjqytLlYU",
  authDomain: "gen-lang-client-0181012822.firebaseapp.com",
  projectId: "gen-lang-client-0181012822",
  storageBucket: "gen-lang-client-0181012822.firebasestorage.app",
  messagingSenderId: "670160197824",
  appId: "1:670160197824:web:75b66d7a9624e6741e3525"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification?.title || payload.data?.title || "Nova mensagem!";
  const notificationOptions = {
    body: payload.notification?.body || payload.data?.body || "Acesse o WhatsNicky para conferir.",
    icon: '/icon.svg',
    badge: '/icon.svg',
    data: payload.data || {}
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  // Get the click action link, fallback to self.location.origin
  let urlToOpen = '/';
  if (event.notification.data && (event.notification.data.link || event.notification.data.click_action)) {
    urlToOpen = event.notification.data.link || event.notification.data.click_action;
  } else {
    urlToOpen = self.location.origin;
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        // Check if there is already a window tab open with our origin
        for (let i = 0; i < windowClients.length; i++) {
          const client = windowClients[i];
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            return client.focus();
          }
        }
        // If no window is open, open a new tab
        if (self.clients.openWindow) {
          return self.clients.openWindow(urlToOpen);
        }
      })
  );
});

const CACHE_NAME = 'whatsnicky-v2'; // Bumped version to force cache refresh
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.svg'
];

self.addEventListener('install', (e) => {
  self.skipWaiting(); // Force active immediately
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    }).catch(err => console.error("SW cache open error:", err))
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    Promise.all([
      self.clients.claim(), // Claim all clients immediately
      // Delete old caches
      caches.keys().then((keys) => {
        return Promise.all(
          keys.map((key) => {
            if (key !== CACHE_NAME) {
              return caches.delete(key);
            }
          })
        );
      })
    ])
  );
});

self.addEventListener('fetch', (e) => {
  if (
    e.request.url.includes('firebase') || 
    e.request.url.includes('googleapis') || 
    e.request.url.includes('/api/') ||
    e.request.method !== 'GET'
  ) {
    return;
  }
  
  // Check if request is for HTML/navigation (root or index.html)
  const isHtml = e.request.mode === 'navigate' || 
                 e.request.url.endsWith('/') || 
                 e.request.url.includes('/index.html') ||
                 !e.request.url.includes('.'); // paths without file extensions

  if (isHtml) {
    // Network-First strategy for HTML to prevent caching stale main bundle hashes
    e.respondWith(
      fetch(e.request)
        .then((response) => {
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(e.request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          return caches.match(e.request);
        })
    );
    return;
  }

  // Cache-First strategy for static assets
  e.respondWith(
    caches.match(e.request).then((response) => {
      return response || fetch(e.request);
    }).catch(() => fetch(e.request))
  );
});
