// Offline support for the checklist.
// - Pages (HTML) are fetched network-first and always bypass the HTTP/CDN cache (GitHub Pages caches ~10 min),
//   so a new version reaches users on the next online visit.
// - Everything else (icons, manifest, web fonts) is served cache-first and filled in as it is used.
// Bump CACHE_NAME when you want to force every client to drop its old cache.
const CACHE_NAME = "bousai-list-1.26.1";
const PRECACHE = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icons/icon-180.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", function(event){
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache){ return cache.addAll(PRECACHE); })
  );
  self.skipWaiting();
});

self.addEventListener("activate", function(event){
  event.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(
        keys.filter(function(k){ return k !== CACHE_NAME; })
            .map(function(k){ return caches.delete(k); })
      );
    }).then(function(){ return self.clients.claim(); })
  );
});

function putInCache(request, response){
  // Cache good same-origin responses and opaque cross-origin ones (web fonts).
  if(response && (response.ok || response.type === "opaque")){
    var copy = response.clone();
    caches.open(CACHE_NAME).then(function(cache){ cache.put(request, copy); });
  }
}

self.addEventListener("fetch", function(event){
  var request = event.request;
  if(request.method !== "GET") return;
  if(request.cache === "no-store") return;   // the app's own "is there a newer version?" check: go straight to the network

  var isPage = request.mode === "navigate" ||
    (request.headers.get("accept") || "").indexOf("text/html") !== -1;

  if(isPage){
    event.respondWith(
      fetch(request.url + (request.url.indexOf("?") < 0 ? "?" : "&") + "_=" + Date.now(), { cache:"no-store" }).then(function(response){
        putInCache(request, response);
        return response;
      }).catch(function(){
        return caches.match(request).then(function(hit){
          return hit || caches.match("./index.html");
        });
      })
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(function(hit){
      if(hit) return hit;
      return fetch(request).then(function(response){
        putInCache(request, response);
        return response;
      });
    })
  );
});
