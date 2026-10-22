import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
await mkdir('dist',{recursive:true});
const scripts=(await Promise.all(['core.js','foods.js','app.js'].map(f=>readFile('src/'+f,'utf8')))).join('\n');
const styles=await readFile('src/styles.css','utf8');
const shell=await readFile('src/shell.html','utf8');
const html=shell.replace('/*__STYLES__*/',styles).replace('/*__SCRIPTS__*/',scripts.replace(/<\/script/gi,'<\\/script'));
await writeFile('dist/index.html',html);
const hash=createHash('sha256').update(html).digest('hex').slice(0,12);
await writeFile('dist/sw.js',`/* Pomme: cache du programme uniquement. Les données restent dans IndexedDB. */
const CACHE='pomme-shell-${hash}';
const ASSETS=['./','./index.html','./manifest.webmanifest','./icon.svg','./icon-192.png','./icon-512.png'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('pomme-shell-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==self.location.origin)return;
 if(request.mode==='navigate'&&['./','./index.html'].some(p=>new URL(p,self.location.href).pathname===url.pathname))event.respondWith(fetch(request).then(async response=>{if(response.ok&&(response.headers.get('content-type')||'').includes('text/html')){const cache=await caches.open(CACHE);await cache.put('./index.html',response.clone());}return response;}).catch(()=>caches.match('./index.html')));
 else if(ASSETS.some(p=>new URL(p,self.location.href).pathname===url.pathname))event.respondWith(caches.match(request).then(cached=>cached||fetch(request)));
});
`);
await writeFile('dist/manifest.webmanifest',JSON.stringify({name:'Pomme — Calories & poids',short_name:'Pomme',description:'Ton carnet de calories et de pesées, sur ton appareil.',lang:'fr',id:'./',start_url:'./',scope:'./',display:'standalone',background_color:'#f6f7ef',theme_color:'#f6f7ef',icons:[{src:'./icon-192.png',sizes:'192x192',type:'image/png',purpose:'any'},{src:'./icon-512.png',sizes:'512x512',type:'image/png',purpose:'any maskable'}]},null,2));
console.log('Pomme : index.html autonome et fichiers d’installation générés. Version '+hash);
