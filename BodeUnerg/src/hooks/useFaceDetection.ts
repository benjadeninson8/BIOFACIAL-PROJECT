import { useRef, useState, useEffect, useCallback } from 'react'
import * as faceapi from 'face-api.js'

export type FaceStatus =
  | 'idle'
  | 'loading_models'
  | 'starting_camera'
  | 'no_face'
  | 'multiple'
  | 'detected'
  | 'verifying'
  | 'verified'
  | 'error'

export interface UseFaceDetectionReturn {
  videoRef: React.RefObject<HTMLVideoElement | null>
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  status: FaceStatus
  error: string | null
  confidence: number          // 0-100 verification progress
  faceDescriptor: number[] | null
  startCamera: () => Promise<void>
  stopCamera: () => void
  isRunning: boolean
  modelsReady: boolean
}

const MODEL_URL = '/models'
const FRAMES_TO_VERIFY = 7
// NOTE: DETECTOR_OPTIONS intentionally NOT created at module level.
// Creating faceapi objects before models are loaded can crash React silently.
// It's created lazily inside the hook as a ref.

interface DetectionResult {
  descriptor: Float32Array
  detection: {
    box: {
      x: number
      y: number
      width: number
      height: number
    }
  }
  landmarks: {
    positions: { x: number; y: number }[]
  }
}

export function useFaceDetection(): UseFaceDetectionReturn {
  const videoRef   = useRef<HTMLVideoElement | null>(null)
  const canvasRef  = useRef<HTMLCanvasElement | null>(null)
  const streamRef  = useRef<MediaStream | null>(null)
  const loopRef    = useRef<number | null>(null)
  const detectedFrames = useRef(0)
  const hasVerifiedRef = useRef(false)
  const isStartingRef = useRef(false)
  // Lazy detector options — created once after face-api is ready
  const detectorOptionsRef = useRef<faceapi.TinyFaceDetectorOptions | null>(null)
  // Guard: prevents overlapping async detection calls
  const isDetectingRef = useRef(false)
  // Throttle: tracks last frame timestamp for ~15fps cap during detection
  const lastFrameTimeRef = useRef(0)

  const [status,          setStatus]          = useState<FaceStatus>('loading_models')
  const [error,           setError]           = useState<string | null>(null)
  const [confidence,      setConfidence]      = useState(0)
  const [faceDescriptor,  setFaceDescriptor]  = useState<number[] | null>(null)
  const [isRunning,       setIsRunning]       = useState(false)
  const [modelsReady,     setModelsReady]     = useState(false)
  const heavyModelsReadyRef = useRef(false)

  /* ── Load models once on mount ── */
  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        // Optimize TF.js environment to prevent memory leaks and WebGL crashes on Apple devices
        // Optimize TF.js environment to prevent memory leaks and WebGL crashes
        if (faceapi.tf) {
          const env = typeof faceapi.tf.env === 'function' ? faceapi.tf.env() : (faceapi.tf as any).ENV;
          if (env) {
            const setSafe = (flag: string, value: any) => {
              try {
                if (env.flags && flag in env.flags) {
                  env.set(flag, value);
                } else if (typeof env.registerFlag === 'function') {
                  env.registerFlag(flag, () => value);
                }
              } catch (e) {
                console.warn(`[BioFacial] No se pudo configurar la flag ${flag}:`, e);
              }
            };
            // Aplicar optimizaciones WebGL para TODOS los dispositivos
            setSafe('WEBGL_DELETE_TEXTURE_THRESHOLD', 0);
            setSafe('WEBGL_FORCE_F16_TEXTURES', true);
            setSafe('WEBGL_PACK', false); // Previene congelamiento en Windows
            console.log('[BioFacial] Optimizaciones extremas de WebGL aplicadas.');
          }
        }

        // ── PHASE 1: tiny detector only (193 KB) ── camera ready fast
        await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL)

        const isAppleDevice = /Mac|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
                              (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
        const inputSize = isAppleDevice ? 128 : 160
        detectorOptionsRef.current = new faceapi.TinyFaceDetectorOptions({ inputSize, scoreThreshold: 0.4 })

        if (mounted) {
          setModelsReady(true)
          setStatus('idle')
          setError(null)
          console.log(`[BioFacial] Detector listo (${inputSize}px). Cargando modelos pesados en segundo plano...`)
        }

        // ── PHASE 2: heavy models in background (landmark 357KB + recognition 6.4MB) ──
        ;(async () => {
          try {
            await Promise.all([
              faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
              faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
            ])
            heavyModelsReadyRef.current = true
            console.log('[BioFacial] Modelos de reconocimiento listos. Verificación completa activada (BodeUnerg).')
            try {
              const dummy = document.createElement('canvas')
              dummy.width = inputSize
              dummy.height = Math.round(inputSize * 0.75)
              await faceapi.detectAllFaces(dummy, new faceapi.TinyFaceDetectorOptions({ inputSize }))
                .withFaceLandmarks().withFaceDescriptors()
            } catch { /* non-critical */ }
          } catch (err) {
            console.warn('[BioFacial] Error cargando modelos pesados:', err)
          }
        })()
      } catch (err) {
        console.error('[BioFacial] Error al cargar los modelos de face-api (BodeUnerg):', err)
        if (mounted) {
          setModelsReady(false)
          setError('Error al cargar los modelos de reconocimiento facial. Revisa la consola.')
          setStatus('error')
        }
      }
    })()
    return () => { mounted = false }
  }, [])

  const runLoopRef = useRef<() => void>(() => {})

  /* ── Detection loop ── */
  const runLoop = useCallback(async () => {
    if (hasVerifiedRef.current || !streamRef.current) return

    // Schedule next frame immediately so we don't skip frames
    if (streamRef.current && !hasVerifiedRef.current) {
      loopRef.current = requestAnimationFrame(() => { runLoopRef.current(); })
    }

    // Throttle detection to ~15fps to avoid GPU saturation
    const now = performance.now()
    if (now - lastFrameTimeRef.current < 66) return  // ~15fps = 66ms interval
    lastFrameTimeRef.current = now

    // Skip if a detection is already in flight
    if (isDetectingRef.current) return

    const video   = videoRef.current
    const canvas  = canvasRef.current

    if (!video || video.readyState < 2) return
    if (!detectorOptionsRef.current) return

    if (canvas) {
      isDetectingRef.current = true
      try {
        const displaySize = { width: video.videoWidth, height: video.videoHeight }
        if (canvas.width !== displaySize.width || canvas.height !== displaySize.height) {
          faceapi.matchDimensions(canvas, displaySize)
          canvas.style.removeProperty('width')
          canvas.style.removeProperty('height')
        }

        // Full pipeline only when heavy models are ready, otherwise detect-only
        let detections
        if (heavyModelsReadyRef.current) {
          detections = await faceapi
            .detectAllFaces(video, detectorOptionsRef.current)
            .withFaceLandmarks()
            .withFaceDescriptors()
        } else {
          const rawDetections = await faceapi.detectAllFaces(video, detectorOptionsRef.current)
          detections = rawDetections.map(d => ({ detection: d, landmarks: { positions: [] }, descriptor: null }))
        }

        // Check if camera was stopped during the await
        if (!streamRef.current) return

        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height)
          const resized = faceapi.resizeResults(detections, displaySize) as unknown as DetectionResult[]

          if (resized.length === 0) {
            detectedFrames.current = Math.max(0, detectedFrames.current - 1)
            const pct = Math.round((detectedFrames.current / FRAMES_TO_VERIFY) * 100)
            setConfidence(pct)
            if (detectedFrames.current === 0) {
              setFaceDescriptor(null)
              setStatus('no_face')
            } else {
              setStatus('verifying')
            }
          } else if (resized.length > 1) {
            detectedFrames.current = Math.max(0, detectedFrames.current - 2)
            const pct = Math.round((detectedFrames.current / FRAMES_TO_VERIFY) * 100)
            setConfidence(pct)
            setStatus('multiple')
          } else {
            // Exactly one face detected
            detectedFrames.current = Math.min(detectedFrames.current + 1, FRAMES_TO_VERIFY)
            const pct = Math.round((detectedFrames.current / FRAMES_TO_VERIFY) * 100)
            setConfidence(pct)

            const d = resized[0]
            const hasDescriptor = d.descriptor && d.descriptor.length === 128

            if (pct >= 100 && hasDescriptor) {
              hasVerifiedRef.current = true
              setStatus('verified')
              const desc = Array.from(d.descriptor) as number[]
              setFaceDescriptor(desc)
            } else if (pct >= 100) {
              // Reached 100% but descriptor is missing - step back
              detectedFrames.current = Math.max(0, detectedFrames.current - 1)
              setConfidence(Math.round((detectedFrames.current / FRAMES_TO_VERIFY) * 100))
            } else if (pct > 30) {
              setStatus('verifying')
            } else {
              setStatus('detected')
            }

            const box = d.detection.box

            /* ── Draw overlay ── */

            // Premium Face ID Bounding Box
            const boxColor = pct >= 100 ? '#00ffcc' : '#3b82f6'
            
            // Corner brackets (Sleek)
            const bLen = 24
            ctx.strokeStyle = boxColor
            ctx.lineWidth   = 3
            ctx.lineCap = 'round'
            ctx.lineJoin = 'round'
            ctx.shadowColor = boxColor
            ctx.shadowBlur  = pct >= 100 ? 15 : 8
            
            const corner = (x: number, y: number, dx: number, dy: number) => {
              ctx.beginPath()
              ctx.moveTo(x + dx * bLen, y); ctx.lineTo(x, y); ctx.lineTo(x, y + dy * bLen)
              ctx.stroke()
            }
            corner(box.x,             box.y,              1,  1)
            corner(box.x + box.width, box.y,             -1,  1)
            corner(box.x,             box.y + box.height, 1, -1)
            corner(box.x + box.width, box.y + box.height,-1, -1)
            ctx.shadowBlur = 0

            // Animated Scanner Line
            if (pct < 100) {
              const time = performance.now() / 1000
              // Oscillates between 0 and 1
              const sweepY = (Math.sin(time * 3) + 1) / 2
              const lineY = box.y + (box.height * sweepY)
              
              ctx.beginPath()
              ctx.moveTo(box.x, lineY)
              ctx.lineTo(box.x + box.width, lineY)
              ctx.strokeStyle = 'rgba(59, 130, 246, 0.8)'
              ctx.lineWidth = 2
              ctx.shadowColor = '#3b82f6'
              ctx.shadowBlur = 10
              ctx.stroke()
              ctx.shadowBlur = 0
            }

            // Subtle glow around the face center instead of dots
            ctx.beginPath()
            ctx.arc(box.x + box.width / 2, box.y + box.height / 2, box.width * 0.35, 0, Math.PI * 2)
            ctx.fillStyle = pct >= 100 ? 'rgba(0, 255, 204, 0.1)' : 'rgba(59, 130, 246, 0.05)'
            ctx.fill()


          }
        }
      } catch (err) {
        console.error('[BioFacial] Error en frame de detección (BodeUnerg):', err)
      } finally {
        isDetectingRef.current = false
      }
    }
  }, [])

  useEffect(() => {
    runLoopRef.current = runLoop
  }, [runLoop])

  /* ── Start camera ── */
  const startCamera = useCallback(async () => {
    if (isStartingRef.current || streamRef.current) {
      console.warn('[BioFacial] El inicio de la cámara ya está en progreso o ya está activo (BodeUnerg).')
      return
    }
    isStartingRef.current = true
    setError(null)
    setStatus('starting_camera')
    detectedFrames.current = 0
    setConfidence(0)
    setFaceDescriptor(null)
    hasVerifiedRef.current = false

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      })

      if (!isStartingRef.current) {
        stream.getTracks().forEach(t => t.stop())
        return
      }

      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        try {
          await videoRef.current.play()
        } catch (playErr) {
          console.error('[BioFacial] Play error on user camera:', playErr)
        }
      } else {
        stream.getTracks().forEach(t => t.stop())
        return
      }
      setIsRunning(true)
      setStatus('no_face')
      loopRef.current = requestAnimationFrame(() => { runLoop(); })
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error('[BioFacial] Error al iniciar cámara (BodeUnerg):', e)
      if (msg.includes('NotAllowed') || msg.includes('Permission')) {
        setError('Permiso de cámara denegado. Permite el acceso en el navegador y vuelve a intentarlo.')
      } else if (msg.includes('NotFound') || msg.includes('DevicesNotFound')) {
        setError('No se encontró ninguna cámara conectada a este dispositivo.')
      } else {
        setError('No se pudo acceder a la cámara: ' + msg)
      }
      setStatus('error')
    } finally {
      isStartingRef.current = false
    }
  }, [runLoop])

  /* ── Stop camera ── */
  const stopCamera = useCallback(() => {
    isStartingRef.current = false
    if (loopRef.current) {
      cancelAnimationFrame(loopRef.current)
      loopRef.current = null
    }
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    const canvas = canvasRef.current
    if (canvas) canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height)
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setIsRunning(false)
    setStatus('idle')
    setConfidence(0)
    setFaceDescriptor(null)
    detectedFrames.current = 0
    hasVerifiedRef.current = false
  }, [])

  useEffect(() => () => stopCamera(), [stopCamera])

  return { videoRef, canvasRef, status, error, confidence, faceDescriptor, startCamera, stopCamera, isRunning, modelsReady }
}
