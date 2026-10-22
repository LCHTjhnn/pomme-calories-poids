/* Pomme: cache du programme uniquement. Les données restent dans IndexedDB. */
const CACHE='pomme-shell-6e15c9e1a874';
const ASSETS=['./','./index.html','./manifest.webmanifest','./icon.svg','./icon-192.png','./icon-512.png'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('pomme-shell-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==self.location.origin)return;
 if(request.mode==='navigate'&&['./','./index.html'].some(p=>new URL(p,self.location.href).pathname===url.pathname))event.respondWith(fetch(request).then(async response=>{if(response.ok&&(response.headers.get('content-type')||'').includes('text/html')){const cache=await caches.open(CACHE);await cache.put('./index.html',response.clone());}return response;}).catch(()=>caches.match('./index.html')));
 else if(ASSETS.some(p=>new URL(p,self.location.href).pathname===url.pathname))event.respondWith(caches.match(request).then(cached=>cached||fetch(request)));
});
