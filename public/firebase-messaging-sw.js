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
  const notificationTitle = payload.notification?.title || "Nova mensagem!";
  const notificationOptions = {
    body: payload.notification?.body || "Acesse o WhatsNicky para conferir.",
    icon: '/icon.svg',
    badge: '/icon.svg',
    data: payload.data
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

const CACHE_NAME = 'whatsnicky-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.svg'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    }).catch(err => console.error("SW cache open error:", err))
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
  
  e.respondWith(
    caches.match(e.request).then((response) => {
      return response || fetch(e.request);
    }).catch(() => fetch(e.request))
  );
});
