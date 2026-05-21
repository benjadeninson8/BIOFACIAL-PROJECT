import { useRef, useState, useEffect, useCallback } from 'react'

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

export function useFaceDetection(): UseFaceDetectionReturn {
  const videoRef   = useRef<HTMLVideoElement | null>(null)
  const canvasRef  = useRef<HTMLCanvasElement | null>(null)
  const streamRef  = useRef<MediaStream | null>(null)
  const loopRef    = useRef<number | null>(null)
  const faceApiRef = useRef<typeof import('face-api.js') | null>(null)

  // How many consecutive frames we've seen exactly 1 face
  const detectedFrames = useRef(0)
  const FRAMES_TO_VERIFY = 7    // ~0.25s for instant lock

  const [status,          setStatus]          = useState<FaceStatus>('idle')
  const [error,           setError]           = useState<string | null>(null)
  const [confidence,      setConfidence]      = useState(0)
  const [faceDescriptor,  setFaceDescriptor]  = useState<number[] | null>(null)
  const [isRunning,       setIsRunning]       = useState(false)
  const [modelsReady,     setModelsReady]     = useState(false)

  /* ── Load models once on mount ── */
  useEffect(() => {
    let mounted = true
    setStatus('loading_models')
    ;(async () => {
      try {
        const faceapi = await import('face-api.js')
        faceApiRef.current = faceapi
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ])
        if (mounted) { setModelsReady(true); setStatus('idle') }
      } catch (e) {
        console.warn('face-api models load error:', e)
        if (mounted) { setModelsReady(true); setStatus('idle') }
      }
    })()
    return () => { mounted = false }
  }, [])

  /* ── Detection loop ── */
  const runLoop = useCallback(async () => {
    const faceapi = faceApiRef.current
    const video   = videoRef.current
    const canvas  = canvasRef.current

    if (!video || video.readyState < 2) {
      loopRef.current = requestAnimationFrame(runLoop)
      return
    }

    if (faceapi && canvas) {
      try {
        const displaySize = { width: video.videoWidth, height: video.videoHeight }
        if (canvas.width !== displaySize.width || canvas.height !== displaySize.height) {
          faceapi.matchDimensions(canvas, displaySize)
        }

        const isLastStep = (detectedFrames.current + 1) >= FRAMES_TO_VERIFY
        let detections: any
        if (isLastStep) {
          detections = await faceapi
            .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.4 }))
            .withFaceLandmarks()
            .withFaceDescriptors()
        } else {
          detections = await faceapi
            .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.4 }))
            .withFaceLandmarks()
        }

        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height)
          const resized = faceapi.resizeResults(detections, displaySize) as any[]

          if (resized.length === 0) {
            // No se detectó rostro en este frame. Decaemos de 1 en 1 para no penalizar parpadeos rápidos.
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
            // Múltiples rostros. Decaemos de 2 en 2 para mantener control sin reseteo abrupto.
            detectedFrames.current = Math.max(0, detectedFrames.current - 2)
            const pct = Math.round((detectedFrames.current / FRAMES_TO_VERIFY) * 100)
            setConfidence(pct)
            if (detectedFrames.current === 0) {
              setFaceDescriptor(null)
              setStatus('multiple')
            } else {
              setStatus('multiple')
            }
          } else {
            // One face detected
            const d   = resized[0]
            const box = d.detection.box

            // Increment confidence counter
            detectedFrames.current = Math.min(detectedFrames.current + 1, FRAMES_TO_VERIFY)
            const pct = Math.round((detectedFrames.current / FRAMES_TO_VERIFY) * 100)
            setConfidence(pct)

            if (pct >= 100 && resized[0].descriptor) {
              setStatus('verified')
              const desc = Array.from(resized[0].descriptor) as number[]
              setFaceDescriptor(desc)
            } else if (pct >= 100) {
              detectedFrames.current = Math.max(0, detectedFrames.current - 1)
              setConfidence(Math.round((detectedFrames.current / FRAMES_TO_VERIFY) * 100))
            } else if (pct > 30) {
              setStatus('verifying')
            } else {
              setStatus('detected')
            }

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
            pts.forEach((p: any) => {
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

            // Corner brackets (scan frame)
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
      } catch { /* silently skip frame errors */ }
    }

    loopRef.current = requestAnimationFrame(runLoop)
  }, [])

  /* ── Start camera ── */
  const startCamera = useCallback(async () => {
    setError(null)
    setStatus('starting_camera')
    detectedFrames.current = 0
    setConfidence(0)
    setFaceDescriptor(null)

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setIsRunning(true)
      setStatus('no_face')
      loopRef.current = requestAnimationFrame(runLoop)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg.includes('NotAllowed') || msg.includes('Permission')) {
        setError('Permiso de cámara denegado. Permite el acceso en el navegador y vuelve a intentarlo.')
      } else if (msg.includes('NotFound') || msg.includes('DevicesNotFound')) {
        setError('No se encontró ninguna cámara conectada a este dispositivo.')
      } else {
        setError('No se pudo acceder a la cámara: ' + msg)
      }
      setStatus('error')
    }
  }, [runLoop])

  /* ── Stop camera ── */
  const stopCamera = useCallback(() => {
    if (loopRef.current) cancelAnimationFrame(loopRef.current)
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    const canvas = canvasRef.current
    if (canvas) canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height)
    setIsRunning(false)
    setStatus('idle')
    setConfidence(0)
    setFaceDescriptor(null)
    detectedFrames.current = 0
  }, [])

  useEffect(() => () => stopCamera(), [stopCamera])

  return { videoRef, canvasRef, status, error, confidence, faceDescriptor, startCamera, stopCamera, isRunning, modelsReady }
}
