// Service Worker — File Engagement PWA
const CACHE = 'file-engagement-v1';
const ASSETS = [
    './',
    './index.html',
    './saisie.html',
    './dashboard.html',
    './config.js',
    './manifest.json'
];

self.addEventListener('install', e => {
    e.waitUntil(
        caches.open(CACHE).then(c => c.addAll(ASSETS))
    );
});

self.addEventListener('fetch', e => {
    e.respondWith(
        fetch(e.request).catch(() =>
            caches.match(e.request)
        )
    );
});
