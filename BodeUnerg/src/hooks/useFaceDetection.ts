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
const DETECTOR_OPTIONS = new faceapi.TinyFaceDetectorOptions({ inputSize: 160, scoreThreshold: 0.4 })

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

  const [status,          setStatus]          = useState<FaceStatus>('loading_models')
  const [error,           setError]           = useState<string | null>(null)
  const [confidence,      setConfidence]      = useState(0)
  const [faceDescriptor,  setFaceDescriptor]  = useState<number[] | null>(null)
  const [isRunning,       setIsRunning]       = useState(false)
  const [modelsReady,     setModelsReady]     = useState(false)

  /* ── Load models once on mount ── */
  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        // Optimize TF.js environment to prevent memory leaks and WebGL crashes on Apple devices
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
            const isApple = /Mac|iPhone|iPad|iPod/i.test(navigator.userAgent) || 
                            (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
            if (isApple) {
              setSafe('WEBGL_DELETE_TEXTURE_THRESHOLD', 0);
              setSafe('WEBGL_FORCE_F16_TEXTURES', true);
              console.log('[BioFacial] Dispositivo Apple detectado. Optimizaciones de memoria WebGL aplicadas.');
            } else {
              console.log('[BioFacial] Dispositivo no Apple. Utilizando configuración WebGL predeterminada.');
            }
          }
          console.log('[BioFacial] Entorno de TensorFlow.js verificado (BodeUnerg).')
        }

        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ])
        
        try {
          // Warm up face-api backend on a dummy canvas to prevent main thread blocking on first scan
          const dummy = document.createElement('canvas')
          dummy.width = 160
          dummy.height = 120
          await faceapi.detectAllFaces(dummy, new faceapi.TinyFaceDetectorOptions({ inputSize: 160 }))
          console.log('[BioFacial] Backend de face-api pre-calentado con éxito (BodeUnerg).')
        } catch (warmupErr) {
          console.warn('[BioFacial] No se pudo pre-calentar face-api (no crítico):', warmupErr)
        }

        if (mounted) {
          setModelsReady(true)
          setStatus('idle')
          setError(null)
          console.log('[BioFacial] Modelos de face-api cargados con éxito (BodeUnerg).')
        }
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
    const video   = videoRef.current
    const canvas  = canvasRef.current

    if (!video || video.readyState < 2) {
      if (streamRef.current && !hasVerifiedRef.current) {
        loopRef.current = requestAnimationFrame(() => { runLoopRef.current(); })
      }
      return
    }



    if (canvas) {
      if (faceapi.tf) faceapi.tf.engine().startScope()
      try {
        const displaySize = { width: video.videoWidth, height: video.videoHeight }
        if (canvas.width !== displaySize.width || canvas.height !== displaySize.height) {
          faceapi.matchDimensions(canvas, displaySize)
          canvas.style.removeProperty('width')
          canvas.style.removeProperty('height')
        }

        // Run full face detection pipeline
        const detections = await faceapi
          .detectAllFaces(video, DETECTOR_OPTIONS)
          .withFaceLandmarks()
          .withFaceDescriptors()

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

            // Bounding box glow
            const glowColor = pct >= 100 ? '#00e5ff' : '#2563eb'
            ctx.shadowColor = glowColor
            ctx.shadowBlur  = 16
            ctx.strokeStyle = glowColor
            ctx.lineWidth   = 2.5
            ctx.strokeRect(box.x, box.y, box.width, box.height)
            ctx.shadowBlur  = 0

            // Landmark dots
            const pts = d.landmarks.positions
            pts.forEach((p) => {
              ctx.beginPath()
              ctx.arc(p.x, p.y, 2, 0, Math.PI * 2)
              ctx.fillStyle = pct >= 100 ? 'rgba(0,229,255,0.9)' : 'rgba(37,99,235,0.85)'
              ctx.fill()
            })

            // Confidence arc on top of bounding box
            if (pct < 100) {
              const cx = box.x + box.width / 2
              const cy = box.y - 14
              const r  = 10
              ctx.strokeStyle = 'rgba(255,255,255,0.15)'
              ctx.lineWidth   = 3
              ctx.beginPath()
              ctx.arc(cx, cy, r, -Math.PI / 2, Math.PI * 1.5)
              ctx.stroke()

              ctx.strokeStyle = '#00e5ff'
              ctx.shadowColor = '#00e5ff'
              ctx.shadowBlur  = 6
              ctx.beginPath()
              ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * pct) / 100)
              ctx.stroke()
              ctx.shadowBlur = 0
            }

            // Corner brackets
            const bLen = 20
            ctx.strokeStyle = pct >= 100 ? '#00e5ff' : 'rgba(37,99,235,0.8)'
            ctx.lineWidth   = 3
            ctx.shadowColor = pct >= 100 ? '#00e5ff' : '#2563eb'
            ctx.shadowBlur  = pct >= 100 ? 12 : 6
            const drawCorner = (x: number, y: number, dx: number, dy: number) => {
              ctx.beginPath()
              ctx.moveTo(x + dx * bLen, y)
              ctx.lineTo(x, y)
              ctx.lineTo(x, y + dy * bLen)
              ctx.stroke()
            }
            drawCorner(box.x,              box.y,              1,  1)
            drawCorner(box.x + box.width,  box.y,             -1,  1)
            drawCorner(box.x,              box.y + box.height, 1, -1)
            drawCorner(box.x + box.width,  box.y + box.height,-1, -1)
            ctx.shadowBlur = 0
          }
        }
      } catch (err) {
        console.error('[BioFacial] Error en frame de detección (BodeUnerg):', err)
      } finally {
        if (faceapi.tf) faceapi.tf.engine().endScope()
      }
    }

    if (streamRef.current && !hasVerifiedRef.current) {
      loopRef.current = requestAnimationFrame(() => { runLoopRef.current(); })
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
