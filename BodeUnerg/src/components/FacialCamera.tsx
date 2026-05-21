import { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Scan, Loader2, X, CheckCircle, AlertCircle } from 'lucide-react'
import { useFaceDetection, type FaceStatus } from '../hooks/useFaceDetection'

const STATUS_INFO: Record<FaceStatus, { text: string; color: string; dot: string }> = {
  idle:            { text: 'Listo',                           color: 'text-gray-500',   dot: 'bg-gray-400'   },
  loading_models:  { text: 'Cargando modelos IA...',          color: 'text-blue-600',   dot: 'bg-blue-500'   },
  starting_camera: { text: 'Iniciando cámara...',             color: 'text-blue-600',   dot: 'bg-blue-500'   },
  no_face:         { text: 'Coloca tu rostro en el marco',    color: 'text-amber-600',  dot: 'bg-amber-500'  },
  multiple:        { text: 'Solo un rostro por favor',        color: 'text-red-500',    dot: 'bg-red-500'    },
  detected:        { text: 'Rostro detectado — analizando',   color: 'text-blue-600',   dot: 'bg-blue-500'   },
  verifying:       { text: 'Verificando biometría...',        color: 'text-blue-700',   dot: 'bg-blue-600'   },
  verified:        { text: '✓ Identidad verificada',          color: 'text-emerald-600',dot: 'bg-emerald-500'},
  error:           { text: 'Error de cámara',                 color: 'text-red-500',    dot: 'bg-red-500'    },
}

interface Props {
  onVerified: (user: any) => void
  onCancel: () => void
  lightTheme?: boolean
}

export default function FacialCamera({ onVerified, onCancel, lightTheme = false }: Props) {
  const {
    videoRef, canvasRef,
    status, error, confidence, faceDescriptor,
    startCamera, stopCamera, isRunning, modelsReady,
  } = useFaceDetection()

  const [verifyingBackend, setVerifyingBackend] = useState(false)
  const [verifyError, setVerifyError] = useState<string | null>(null)
  const [backendVerified, setBackendVerified] = useState(false)

  // Auto-start once models ready
  useEffect(() => {
    if (modelsReady) startCamera()
    return () => stopCamera()
  }, [modelsReady]) // eslint-disable-line

  const onVerifiedRef = useRef(onVerified)
  useEffect(() => {
    onVerifiedRef.current = onVerified
  }, [onVerified])

  const faceDescriptorRef = useRef<number[] | null>(null)
  if (faceDescriptor) {
    faceDescriptorRef.current = faceDescriptor
  }

  // Trigger parent when verified by comparing face descriptor on backend
  useEffect(() => {
    if (status === 'verified' && faceDescriptorRef.current && !verifyingBackend && !verifyError) {
      setVerifyingBackend(true)
      setVerifyError(null)
      const desc = faceDescriptorRef.current
      ;(async () => {
        try {
          const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/users/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ descriptor: desc }),
          })
          const result = await response.json()
          if (result.success && result.match) {
            setBackendVerified(true)
            // Wait to let verified animation show
            setTimeout(() => {
              stopCamera()
              onVerifiedRef.current(result.user)
            }, 1200)
          } else {
            stopCamera()
            setVerifyError(result.message || 'Rostro no coincide con ningún usuario registrado.')
          }
        } catch (e) {
          stopCamera()
          setVerifyError('Error al conectar con el servidor de biometría.')
        } finally {
          setVerifyingBackend(false)
        }
      })()
    }
  }, [status, verifyingBackend, verifyError])

  const handleRetry = () => {
    setVerifyError(null)
    setVerifyingBackend(false)
    setBackendVerified(false)
    startCamera()
  }

  const info = STATUS_INFO[status]

  const camBg      = lightTheme ? '#1e293b' : '#0a0f1e'
  const labelBg    = lightTheme ? 'rgba(15,23,42,0.72)' : 'rgba(2,8,24,0.75)'
  const cancelBg   = lightTheme ? '#f1f5ff' : 'rgba(255,255,255,0.04)'
  const cancelBdr  = lightTheme ? '#e0e7ff' : 'rgba(255,255,255,0.08)'
  const cancelClr  = lightTheme ? '#6b7280' : 'rgba(255,255,255,0.5)'

  return (
    <div className="flex flex-col gap-4">

      {/* ── Camera viewport ── */}
      <div
        className="relative overflow-hidden rounded-2xl"
        style={{
          aspectRatio: '4/3',
          background: camBg,
          border: status === 'verified'
            ? '2px solid #10b981'
            : status === 'error'
              ? '2px solid rgba(239,68,68,0.5)'
              : lightTheme
                ? '1.5px solid #dbeafe'
                : '1px solid rgba(255,255,255,0.1)',
          boxShadow: status === 'verified'
            ? '0 0 32px rgba(16,185,129,0.25)'
            : lightTheme
              ? '0 4px 20px rgba(37,99,235,0.12)'
              : 'none',
          transition: 'border-color 0.4s, box-shadow 0.4s',
        }}
      >
        {/* Video */}
        <video
          ref={videoRef}
          autoPlay playsInline muted
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            minWidth: '100%',
            minHeight: '100%',
            width: 'auto',
            height: 'auto',
            transform: 'translate(-50%, -50%) scaleX(-1)',
            display: isRunning ? 'block' : 'none',
          }}
        />

        {/* Canvas overlay */}
        <canvas
          ref={canvasRef}
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            minWidth: '100%',
            minHeight: '100%',
            width: 'auto',
            height: 'auto',
            transform: 'translate(-50%, -50%) scaleX(-1)',
            pointerEvents: 'none',
          }}
        />

        {/* Idle / loading */}
        {!isRunning && status !== 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            {status === 'loading_models' || status === 'starting_camera'
              ? <Loader2 size={36} className="text-blue-400 animate-spin" />
              : <Scan size={36} className="text-white/30" strokeWidth={1.5} />
            }
            <p className="text-white/40 text-sm">{info.text}</p>
          </div>
        )}

        {/* Error */}
        {status === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6">
            <AlertCircle size={36} className="text-red-400" />
            <p className="text-red-300 text-sm text-center">{error}</p>
            <button
              onClick={startCamera}
              className="mt-1 px-4 py-2 rounded-xl text-sm font-semibold text-white"
              style={{ background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.4)' }}
            >
              Reintentar
            </button>
          </div>
        )}

        {/* Verified overlay */}
        <AnimatePresence>
          {backendVerified && (
            <motion.div
              className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10"
              style={{ background: 'rgba(16,185,129,0.12)', backdropFilter: 'blur(2px)' }}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            >
              <motion.div
                className="w-20 h-20 rounded-full flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg,#059669,#10b981)', boxShadow: '0 0 40px rgba(16,185,129,0.5)' }}
                initial={{ scale: 0 }} animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 280, damping: 18 }}
              >
                <CheckCircle size={44} className="text-white" strokeWidth={2} />
              </motion.div>
              <span className="text-white font-semibold text-sm bg-emerald-600/75 px-4 py-1.5 rounded-full">
                Identidad Verificada
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Verifying Backend overlay */}
        <AnimatePresence>
          {verifyingBackend && (
            <motion.div
              className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white z-10"
              style={{ background: 'rgba(15,23,42,0.85)', backdropFilter: 'blur(4px)' }}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            >
              <Loader2 size={36} className="text-blue-400 animate-spin" />
              <p className="text-blue-300 text-sm font-medium">Buscando en base de datos...</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Verification Error */}
        <AnimatePresence>
          {verifyError && (
            <motion.div
              className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-white z-10"
              style={{ background: 'rgba(15,23,42,0.92)', backdropFilter: 'blur(4px)' }}
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
            >
              <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center border border-red-500/40">
                <AlertCircle size={32} className="text-red-400" />
              </div>
              <p className="text-red-200 text-sm text-center font-medium leading-relaxed">{verifyError}</p>
              <button
                onClick={handleRetry}
                className="mt-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-500 transition-colors shadow-lg"
                style={{ border: '1px solid rgba(255,255,255,0.1)' }}
              >
                Reintentar Detección
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Status pill inside viewport */}
        {isRunning && status !== 'verified' && status !== 'error' && (
          <div
            className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-1.5 rounded-full whitespace-nowrap"
            style={{ background: labelBg, backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            <span className={`w-2 h-2 rounded-full animate-pulse ${info.dot}`} />
            <span className="text-white text-xs font-medium">{info.text}</span>
          </div>
        )}
      </div>

      {/* ── Confidence bar ── */}
      {isRunning && status !== 'verified' && status !== 'error' && (
        <div className="relative p-4 rounded-2xl bg-slate-900/60 border border-white/10 backdrop-blur-md shadow-lg overflow-hidden flex flex-col gap-3">
          {/* High-tech Grid Background */}
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[linear-gradient(to_right,#808080_1px,transparent_1px),linear-gradient(to_bottom,#808080_1px,transparent_1px)] bg-[size:14px_24px]" />
          
          <div className="flex justify-between items-center relative z-10">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-400"></span>
              </span>
              <span className={`text-[11px] font-bold uppercase tracking-wider ${lightTheme ? 'text-gray-400' : 'text-slate-400'}`}>
                Escaneo Biométrico
              </span>
            </div>
            <span className="text-cyan-400 text-xs font-bold font-mono tracking-widest tabular-nums drop-shadow-[0_0_8px_rgba(34,211,238,0.3)]">
              {confidence}%
            </span>
          </div>

          <div className="h-3 w-full bg-slate-950/80 rounded-full p-0.5 border border-white/10 overflow-hidden relative z-10 shadow-inner">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-blue-600 via-cyan-400 to-emerald-400 relative overflow-hidden shadow-[0_0_12px_rgba(34,211,238,0.4)]"
              animate={{ width: `${confidence}%` }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
            >
              {/* Shimmer sweep effect */}
              <motion.div
                className="absolute inset-0 w-1/2 h-full bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.4),transparent)]"
                animate={{ x: ['-100%', '200%'] }}
                transition={{ repeat: Infinity, duration: 1.8, ease: 'linear' }}
              />
              {/* Glowing tip */}
              <div className="absolute top-0 right-0 h-full w-2 bg-white rounded-full shadow-[0_0_8px_#fff]" />
            </motion.div>
          </div>

          {/* Telemetry metadata */}
          <div className="flex justify-between items-center text-[9px] font-mono text-slate-500 relative z-10 leading-none">
            <span>SYS.DETECT: ACTIVE</span>
            <span>LANDMARKS: 68_PTS</span>
            <span>SPEED: ~15ms</span>
          </div>
        </div>
      )}

      {/* ── Cancel button ── */}
      <button
        onClick={() => { stopCamera(); onCancel() }}
        className="flex items-center justify-center gap-2 w-full py-3 rounded-xl transition-colors text-sm font-medium"
        style={{ background: cancelBg, border: `1px solid ${cancelBdr}`, color: cancelClr }}
      >
        <X size={14} />
        Cancelar verificación
      </button>
    </div>
  )
}
