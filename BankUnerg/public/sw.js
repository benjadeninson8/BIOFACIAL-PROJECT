// BioFacial Service Worker — caches face-api.js model files after first download.
// On subsequent visits, models load from cache instantly (zero network round-trips).
const CACHE_NAME = 'biofacial-models-v1'

// Files to cache immediately on SW install
const MODEL_FILES = [
  '/models/tiny_face_detector_model-weights_manifest.json',
  '/models/tiny_face_detector_model-shard1',
  '/models/face_landmark_68_model-weights_manifest.json',
  '/models/face_landmark_68_model-shard1',
  '/models/face_recognition_model-weights_manifest.json',
  '/models/face_recognition_model-shard1',
  '/models/face_recognition_model-shard2',
]

// Install: pre-cache all model files
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[BioFacial SW] Pre-caching face-api.js models...')
      return cache.addAll(MODEL_FILES)
    }).then(() => {
      console.log('[BioFacial SW] All models cached. Activating immediately.')
      return self.skipWaiting()
    })
  )
})

// Activate: remove old caches from previous versions
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => {
            console.log('[BioFacial SW] Removing old cache:', key)
            return caches.delete(key)
          })
      )
    ).then(() => self.clients.claim())
  )
})

// Fetch: serve model files from cache, everything else from network
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // Only intercept requests to /models/
  if (url.pathname.startsWith('/models/')) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(event.request)
        if (cached) {
          // Serve from cache — instant!
          return cached
        }
        // Not in cache yet: fetch from network and cache for next time
        const response = await fetch(event.request)
        if (response.ok) {
          cache.put(event.request, response.clone())
        }
        return response
      })
    )
  }
  // All other requests: pass through to network normally
})
