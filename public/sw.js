// ═══════════════════════════════════════════════════════════════════════════
// sw.js — Service worker del portal.
//
// No guarda datos del tercero en caché: sus montos, sus reclamos y sus plazos
// cambian durante el día, y mostrarle una versión vieja sería peor que no
// mostrar nada. Solo guarda el armazón de la aplicación para que abra rápido
// y para que, sin señal, vea una pantalla propia en vez del error del
// navegador.
// ═══════════════════════════════════════════════════════════════════════════
const VERSION = 'bt-v1';
const BASICOS = ['/', '/index.html', '/icon-192.png', '/icon-512.png', '/bt_white.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(BASICOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // Todo lo que venga de Supabase va siempre a la red: son los datos del
  // tercero y tienen que estar al día.
  if (e.request.method !== 'GET' || url.hostname.endsWith('supabase.co')) return;

  // La navegación intenta la red primero; si no hay, entrega lo guardado.
  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request).catch(() => caches.match('/index.html')));
    return;
  }

  // Los archivos de la aplicación llevan huella en el nombre, así que lo
  // guardado siempre corresponde a la versión que pide el navegador.
  e.respondWith(
    caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
      if (res.ok && url.origin === location.origin) {
        const copia = res.clone();
        caches.open(VERSION).then((c) => c.put(e.request, copia));
      }
      return res;
    }))
  );
});
