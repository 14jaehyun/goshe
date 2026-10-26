/* Goshé. service worker — 네트워크 우선, 오프라인이면 캐시 */
const C='goshe-1.8.6';
const SHELL=['./','index.html','style.css?v=1.8.6','app.js?v=1.8.6','manifest.webmanifest','icon-180.png','icon-192.png','sfx/peek.wav?v=1.8.6','sfx/wrong.wav?v=1.8.6','sfx/perfect.wav?v=1.8.6','sfx/swap.wav?v=1.8.6','sfx/logo.wav?v=1.8.6'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(SHELL)).catch(()=>{}));self.skipWaiting();});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==C).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==location.origin)return;
  e.respondWith(fetch(e.request.url,{cache:'no-cache',credentials:'same-origin'}).then(r=>{const cp=r.clone();caches.open(C).then(c=>c.put(e.request,cp)).catch(()=>{});return r;}).catch(()=>caches.match(e.request).then(r=>r||caches.match('index.html'))));});
