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
    icon: '/icon.png',
    badge: '/icon.png',
    data: payload.data || {}
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Custom push event handler specifically to force-show notifications on iOS.
// iOS Safari requires a synchronous/immediate call to showNotification inside event.waitUntil,
// otherwise background FCM push notifications might not display.
self.addEventListener('push', (event) => {
  console.log('[firebase-messaging-sw.js] Raw native push event received.');
  
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                (navigator.userAgent.includes('Mac') && navigator.maxTouchPoints > 1);
  
  console.log('[firebase-messaging-sw.js] Push environment:', { isIOS, userAgent: navigator.userAgent });

  if (isIOS) {
    let payload = {};
    if (event.data) {
      try {
        payload = event.data.json();
        console.log('[firebase-messaging-sw.js] iOS push JSON payload:', payload);
      } catch (e) {
        console.warn('[firebase-messaging-sw.js] iOS push payload parse warning. Using raw text:', event.data.text());
        payload = {
          notification: {
            title: "Nova mensagem!",
            body: event.data.text()
          }
        };
      }
    }

    // Standard FCM maps notifications to payload.notification or payload.data.
    // Let's resolve the title, body and other parameters.
    const title = payload.notification?.title || payload.data?.title || payload.title || "Nova mensagem!";
    const body = payload.notification?.body || payload.data?.body || payload.body || "Acesse o WhatsNicky para conferir.";
    const icon = payload.notification?.icon || payload.data?.icon || '/icon.png';
    const badge = payload.notification?.badge || payload.data?.badge || '/icon.png';
    const clickAction = payload.notification?.click_action || payload.data?.click_action || payload.data?.link || '/';

    const options = {
      body: body,
      icon: icon,
      badge: badge,
      data: {
        ...payload.data,
        link: clickAction
      }
    };

    console.log('[firebase-messaging-sw.js] iOS push forcing registration.showNotification:', title, options);
    event.waitUntil(
      self.registration.showNotification(title, options)
    );
  } else {
    console.log('[firebase-messaging-sw.js] Non-iOS device. Letting standard FCM onBackgroundMessage handle it.');
  }
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

const CACHE_NAME = 'whatsnicky-v3'; // Bumped version to force cache refresh
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.svg',
  '/icon.png'
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
