// QBank's service worker. The app's own files load fast and a clear page shows when the
// computer running QBank cannot be reached. Nothing under /api is ever cached: your questions,
// answers and settings stay on that computer only.
const worker = globalThis;
const CACHE = 'qbank-app-v1';

const OFFLINE = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>QBank</title></head>
<body>
<h1>تعذّر الوصول إلى QBank</h1>
<p>الجهاز الذي يشغّل QBank مطفأ، أو أنك على شبكة أخرى. شغّله ثم أعد المحاولة.</p>
<p lang="en" dir="ltr">QBank cannot be reached: the computer running it is off, or you are on
another network. Start it, then try again.</p></body></html>`;

worker.addEventListener('install', () => worker.skipWaiting());

worker.addEventListener('activate', (event) => {
  const old = worker.caches
    .keys()
    .then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE).map((key) => worker.caches.delete(key))),
    );
  event.waitUntil(old.then(() => worker.clients.claim()));
});

/** Built files have hashed names, so a cached copy is never stale. */
async function fromCacheFirst(request) {
  const hit = await worker.caches.match(request);
  if (hit) return hit;
  const response = await worker.fetch(request);
  if (response.ok) {
    const copy = response.clone();
    void worker.caches.open(CACHE).then((cache) => cache.put(request, copy));
  }
  return response;
}

const offlinePage = () =>
  new worker.Response(OFFLINE, { headers: { 'content-type': 'text/html; charset=utf-8' } });

worker.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new worker.URL(request.url);
  if (request.method !== 'GET' || url.origin !== worker.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;
  if (request.mode === 'navigate') event.respondWith(worker.fetch(request).catch(offlinePage));
  else if (url.pathname.startsWith('/assets/')) event.respondWith(fromCacheFirst(request));
});
