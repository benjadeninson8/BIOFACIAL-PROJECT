import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { QRCodeSVG } from 'qrcode.react'
import {
  User, FileText, Camera, CheckCircle, AlertCircle,
  ChevronRight, Loader2, X, Shield, Scan, Copy, Check,
} from 'lucide-react'
import { useFaceDetection, type FaceStatus } from './hooks/useFaceDetection'

/* ─── Helpers ─── */
const generateUserId = () =>
  'UNERG-' + Math.random().toString(36).substring(2, 10).toUpperCase()

/* ─── Step badge ─── */
function StepBadge({ n, label, state }: { n: number; label: string; state: 'active' | 'done' | 'idle' }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <motion.div
        className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300 ${
          state === 'active' ? 'step-active' : state === 'done' ? 'step-done' : 'step-idle'
        }`}
        animate={state === 'active' ? { scale: [1, 1.08, 1] } : { scale: 1 }}
        transition={{ repeat: state === 'active' ? Infinity : 0, duration: 2 }}
      >
        {state === 'done' ? <CheckCircle size={16} /> : n}
      </motion.div>
      <span className={`text-[11px] font-medium whitespace-nowrap ${
        state === 'active' ? 'text-unerg-700' : state === 'done' ? 'text-unerg-500' : 'text-gray-400'
      }`}>{label}</span>
    </div>
  )
}

/* ─── Validated input ─── */
interface FieldProps {
  id: string
  label: string
  placeholder: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  value: string
  onChange: (v: string) => void
  validate: (v: string) => boolean
}

function ValidatedInput({ label, placeholder, icon: Icon, value, onChange, validate }: FieldProps) {
  const [focused, setFocused] = useState(false)
  const [touched, setTouched] = useState(false)

  const isValid   = validate(value)
  const showCheck = touched && isValid
  const showError = touched && !isValid && value.length > 0

  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
        {label}
      </label>
      <div className="relative">
        <Icon
          size={16}
          className={`absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors duration-200 ${
            focused ? 'text-unerg-600' : showCheck ? 'text-emerald-500' : 'text-gray-300'
          }`}
        />
        <input
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={e => { onChange(e.target.value); setTouched(true) }}
          onFocus={() => setFocused(true)}
          onBlur={() => { setFocused(false); setTouched(true) }}
          className="input-field"
          style={{
            borderColor: showCheck
              ? '#10b981'
              : showError
                ? '#f87171'
                : focused
                  ? '#2563eb'
                  : '#e5e7eb',
            boxShadow: showCheck
              ? '0 0 0 3px rgba(16,185,129,0.1)'
              : showError
                ? '0 0 0 3px rgba(248,113,113,0.1)'
                : focused
                  ? '0 0 0 3px rgba(37,99,235,0.12)'
                  : 'none',
          }}
        />
        {/* Status icon on the right */}
        <AnimatePresence>
          {showCheck && (
            <motion.div
              className="absolute right-3.5 top-1/2 -translate-y-1/2"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 20 }}
            >
              <CheckCircle size={16} className="text-emerald-500" />
            </motion.div>
          )}
          {showError && (
            <motion.div
              className="absolute right-3.5 top-1/2 -translate-y-1/2"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
            >
              <AlertCircle size={16} className="text-red-400" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

/* ─── Camera panel ─── */
const STATUS_LABELS: Record<FaceStatus, { text: string; color: string; dot: string }> = {
  idle:            { text: 'Listo para iniciar',          color: 'text-gray-500',    dot: 'bg-gray-400'   },
  loading_models:  { text: 'Cargando modelos IA...',      color: 'text-unerg-600',   dot: 'bg-unerg-500'  },
  starting_camera: { text: 'Iniciando cámara...',         color: 'text-unerg-600',   dot: 'bg-unerg-500'  },
  no_face:         { text: 'Coloca tu rostro en el marco',color: 'text-amber-600',   dot: 'bg-amber-400'  },
  multiple:        { text: 'Solo un rostro por favor',    color: 'text-red-500',     dot: 'bg-red-400'    },
  detected:        { text: 'Rostro detectado...',         color: 'text-unerg-600',   dot: 'bg-unerg-500'  },
  verifying:       { text: 'Verificando biometría...',    color: 'text-unerg-700',   dot: 'bg-unerg-600'  },
  verified:        { text: '✓ Identidad verificada',      color: 'text-emerald-600', dot: 'bg-emerald-400'},
  error:           { text: 'Error de cámara',             color: 'text-red-500',     dot: 'bg-red-400'    },
}

function CameraPanel({ onVerified }: { onVerified: (descriptor: number[]) => void }) {
  const { videoRef, canvasRef, status, error, confidence, faceDescriptor, startCamera, stopCamera, isRunning } = useFaceDetection()
  const [verified, setVerified] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (status === 'verified' && !verified && faceDescriptor) {
      const desc = faceDescriptor
      timerRef.current = setTimeout(() => {
        setVerified(true)
        onVerified(desc)
      }, 800)
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [status, verified, faceDescriptor, onVerified])

  const effectiveStatus: FaceStatus = verified ? 'verified' : status
  const info = STATUS_LABELS[effectiveStatus]

  return (
    <div className="flex flex-col gap-3">
      {/* Viewport */}
      <div className="camera-wrapper shadow-card"
        style={{
          border: verified
            ? '2px solid #10b981'
            : status === 'error'
              ? '2px solid #fca5a5'
              : '1.5px solid #e5e7eb',
          boxShadow: verified ? '0 0 24px rgba(16,185,129,0.2)' : undefined,
          transition: 'border-color 0.4s, box-shadow 0.4s',
        }}>
        <video ref={videoRef} className="camera-video" autoPlay playsInline muted />
        <canvas ref={canvasRef} className="camera-canvas" />

        {/* Brackets */}
        {isRunning && !verified && (
          <>
            <div className="face-bracket tl" />
            <div className="face-bracket tr" />
            <div className="face-bracket bl" />
            <div className="face-bracket br" />
            {status === 'detected' && <div className="scan-beam" />}
          </>
        )}

        {/* Idle */}
        {!isRunning && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-900">
            <div className="w-16 h-16 rounded-full bg-unerg-900/40 flex items-center justify-center">
              <Camera size={32} className="text-unerg-300" strokeWidth={1.5} />
            </div>
            <p className="text-white/60 text-sm font-medium">Cámara desactivada</p>
          </div>
        )}

        {/* Loading */}
        <AnimatePresence>
          {(status === 'loading_models' || status === 'starting_camera') && (
            <motion.div className="absolute inset-0 bg-slate-900/80 flex items-center justify-center"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Loader2 size={32} className="text-unerg-400 animate-spin" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Verified overlay */}
        <AnimatePresence>
          {verified && (
            <motion.div className="absolute inset-0 flex flex-col items-center justify-center gap-3"
              style={{ background: 'rgba(16,185,129,0.12)', backdropFilter: 'blur(2px)' }}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <motion.div className="w-16 h-16 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg"
                initial={{ scale: 0 }} animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 260, damping: 18 }}>
                <CheckCircle size={36} className="text-white" strokeWidth={2} />
              </motion.div>
              <span className="text-white font-semibold text-sm bg-emerald-600/80 px-3 py-1 rounded-full">
                Identidad Verificada
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Confidence bar (Rediseñado Premium) */}
      {isRunning && !verified && (
        <div className="relative p-4 rounded-2xl bg-slate-50 border border-slate-100 shadow-sm overflow-hidden flex flex-col gap-2.5">
          <div className="flex justify-between items-center relative z-10">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
              </span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Escaneo de Seguridad
              </span>
            </div>
            <span className="text-blue-600 text-xs font-bold font-mono tracking-wider tabular-nums">
              {confidence}%
            </span>
          </div>

          <div className="h-2.5 w-full bg-slate-200/50 rounded-full p-0.5 border border-slate-200/20 overflow-hidden relative z-10 shadow-inner">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-blue-600 to-indigo-500 relative overflow-hidden shadow-[0_0_8px_rgba(37,99,235,0.3)]"
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
              <div className="absolute top-0 right-0 h-full w-1.5 bg-white rounded-full shadow-[0_0_6px_#fff]" />
            </motion.div>
          </div>

          {/* Telemetry metadata */}
          <div className="flex justify-between items-center text-[9px] font-mono text-slate-400 leading-none">
            <span>SECURE_ENCLAVE: ON</span>
            <span>LANDMARKS: OK</span>
          </div>
        </div>
      )}

      {/* Status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`status-dot ${info.dot}`} />
          <span className={`text-sm font-medium ${info.color}`}>{info.text}</span>
        </div>
        {isRunning && !verified && (
          <button onClick={stopCamera}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 transition-colors">
            <X size={12} /> Detener
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-xl p-3">
          <AlertCircle size={16} className="text-red-400 mt-0.5 flex-shrink-0" />
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      {/* Start */}
      {!isRunning && !verified && (
        <motion.button className="btn-blue" onClick={startCamera} whileTap={{ scale: 0.97 }}>
          <Scan size={18} /> Iniciar Verificación Facial
        </motion.button>
      )}
    </div>
  )
}

/* ─── QR Success card ─── */
function SuccessCard({ userId, name }: { userId: string; name: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(userId).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <motion.div
      className="flex flex-col items-center text-center py-6 gap-5"
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 22 }}
    >
      {/* Check */}
      <motion.div className="w-20 h-20 rounded-full bg-unerg-600 flex items-center justify-center shadow-blue-lg"
        initial={{ scale: 0 }} animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 280, damping: 18, delay: 0.1 }}>
        <CheckCircle size={40} className="text-white" strokeWidth={1.8} />
      </motion.div>

      <div>
        <h3 className="font-display font-bold text-2xl text-gray-900">¡Registro Exitoso!</h3>
        <p className="text-gray-400 text-sm mt-1">
          Bienvenido, <span className="text-gray-700 font-medium">{name}</span>
        </p>
      </div>

      {/* QR card */}
      <motion.div
        className="w-full bg-gradient-to-br from-unerg-900 to-unerg-950 rounded-2xl p-5 flex items-center gap-5"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        {/* QR code */}
        <div className="bg-white rounded-xl p-2 flex-shrink-0">
          <QRCodeSVG
            value={`bank-unerg://user/${userId}`}
            size={80}
            bgColor="#ffffff"
            fgColor="#1e3a8a"
            level="M"
          />
        </div>

        {/* Info */}
        <div className="flex-1 text-left">
          <p className="text-white/40 text-[10px] uppercase tracking-widest font-medium mb-1">ID de Usuario</p>
          <p className="font-mono text-white font-semibold text-sm tracking-wide">{userId}</p>
          <button
            onClick={handleCopy}
            className="mt-2 flex items-center gap-1.5 text-xs font-medium transition-colors"
            style={{ color: copied ? '#10b981' : 'rgba(147,197,253,0.8)' }}
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
            {copied ? 'Copiado' : 'Copiar ID'}
          </button>
          <p className="text-white/30 text-[10px] mt-2">Presenta este QR en cualquier punto UNERG</p>
        </div>
      </motion.div>

      {/* Privacy */}
      <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-xl p-3 w-full text-left">
        <Shield size={14} className="text-unerg-500 mt-0.5 flex-shrink-0" />
        <p className="text-unerg-700 text-xs leading-relaxed">
          Tus datos biométricos están cifrados con AES-256 y almacenados conforme a la normativa UNERG.
        </p>
      </div>
    </motion.div>
  )
}

/* ─── Progress bar ─── */
function ProgressBar({ step }: { step: number }) {
  const pct = ((step - 1) / 2) * 100
  return (
    <div className="h-1 rounded-full bg-gray-100 overflow-hidden mb-1">
      <motion.div
        className="h-full rounded-full"
        style={{ background: 'linear-gradient(90deg,#2563eb,#60a5fa)' }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      />
    </div>
  )
}

/* ─── Main App ─── */
type Step = 1 | 2 | 3

export default function App() {
  const [step,         setStep]         = useState<Step>(1)
  const [faceVerified, setFaceVerified] = useState(false)
  const [submitted,    setSubmitted]    = useState(false)
  const [userId]                        = useState(generateUserId)

  const [form, setForm] = useState({ nombres: '', apellidos: '', cedula: '' })
  const [faceDescriptor, setFaceDescriptor] = useState<number[] | null>(null)
  const [isRegistering, setIsRegistering] = useState(false)
  const [registerError, setRegisterError] = useState<string | null>(null)

  // Ping Railway backend on page load to prevent cold-start delay when user reaches camera step
  useEffect(() => {
    const api = import.meta.env.VITE_API_URL || ''
    if (!api) return
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 5000)
    fetch(`${api}/api/health`, { signal: ctrl.signal })
      .then(() => console.log('[BioFacial] Backend pre-calentado.'))
      .catch(() => {}) // silent — failure is fine, just a warm-up
      .finally(() => clearTimeout(t))
  }, [])

  const handleRegister = async () => {
    if (!faceDescriptor) {
      setRegisterError('No se ha detectado el descriptor facial.')
      return
    }
    setIsRegistering(true)
    setRegisterError(null)
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/users/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: userId,
          nombres: form.nombres,
          apellidos: form.apellidos,
          cedula: form.cedula,
          descriptor: faceDescriptor,
        }),
      })
      const result = await response.json()
      if (result.success) {
        setSubmitted(true)
      } else {
        setRegisterError(result.message || 'Error al registrar el usuario.')
      }
    } catch {
      setRegisterError('No se pudo conectar con el servidor backend.')
    } finally {
      setIsRegistering(false)
    }
  }

  const validators = {
    nombres:   (v: string) => v.trim().length >= 2,
    apellidos: (v: string) => v.trim().length >= 2,
    cedula:    (v: string) => /^[VEve]-?\d{5,9}$/.test(v.trim()),
  }

  const step1Valid = validators.nombres(form.nombres) &&
                     validators.apellidos(form.apellidos) &&
                     validators.cedula(form.cedula)

  const fields = [
    { id: 'nombres',   label: 'Nombres',            placeholder: 'Juan Carlos',    icon: User,     validate: validators.nombres   },
    { id: 'apellidos', label: 'Apellidos',           placeholder: 'Pérez González', icon: User,     validate: validators.apellidos },
    { id: 'cedula',    label: 'Cédula de Identidad', placeholder: 'V-12345678',     icon: FileText, validate: validators.cedula    },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 flex items-center justify-center p-4">
      {/* Blobs */}
      <div className="fixed top-0 right-0 w-96 h-96 rounded-full opacity-[0.04] blur-3xl bg-blue-500 pointer-events-none" />
      <div className="fixed bottom-0 left-0 w-80 h-80 rounded-full opacity-[0.04] blur-3xl bg-blue-600 pointer-events-none" />

      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8 animate-page">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-unerg-600 shadow-blue-md mb-4">
            <Shield size={26} className="text-white" strokeWidth={1.8} />
          </div>
          <h1 className="font-display font-bold text-2xl text-gray-900">
            Bank <span className="text-unerg-600">UNERG</span>
          </h1>
          <p className="text-gray-400 text-sm mt-1">Sistema de Registro KYC Biométrico</p>
        </div>

        {/* Steps + progress */}
        <div className="mb-6 animate-page delay-1">
          <ProgressBar step={step} />
          <div className="flex items-center justify-center gap-0 mt-3">
            <StepBadge n={1} label="Datos"       state={step > 1 ? 'done' : step === 1 ? 'active' : 'idle'} />
            <div className="w-12 h-px bg-gray-200 mx-1 mb-5" />
            <StepBadge n={2} label="Biometría"   state={step > 2 ? 'done' : step === 2 ? 'active' : 'idle'} />
            <div className="w-12 h-px bg-gray-200 mx-1 mb-5" />
            <StepBadge n={3} label="Confirmación" state={step === 3 ? (submitted ? 'done' : 'active') : 'idle'} />
          </div>
        </div>

        <AnimatePresence mode="wait">
          {/* ── Step 1 ── */}
          {step === 1 && (
            <motion.div key="step1" className="card p-6 animate-page delay-2"
              initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}>
              <h2 className="font-display font-semibold text-gray-900 text-lg mb-1">Datos Personales</h2>
              <p className="text-gray-400 text-sm mb-5">Ingresa tu información tal como aparece en tu cédula.</p>

              <div className="flex flex-col gap-4">
                {fields.map(f => (
                  <ValidatedInput
                    key={f.id}
                    id={f.id}
                    label={f.label}
                    placeholder={f.placeholder}
                    icon={f.icon}
                    value={form[f.id as keyof typeof form]}
                    onChange={v => setForm(p => ({ ...p, [f.id]: v }))}
                    validate={f.validate}
                  />
                ))}
              </div>

              <div className="mt-6">
                <motion.button className="btn-blue" disabled={!step1Valid}
                  whileTap={step1Valid ? { scale: 0.97 } : {}} onClick={() => setStep(2)}>
                  Continuar a Verificación <ChevronRight size={18} />
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* ── Step 2 ── */}
          {step === 2 && (
            <motion.div key="step2" className="card p-6"
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}>
              <h2 className="font-display font-semibold text-gray-900 text-lg mb-1">Verificación Facial</h2>
              <p className="text-gray-400 text-sm mb-4">
                Inicia la cámara y coloca tu rostro dentro del marco. La detección es automática.
              </p>

              <CameraPanel
                onVerified={(desc) => {
                  setFaceVerified(true)
                  setFaceDescriptor(desc)
                  // Auto-advance step after verification animation completes
                  setTimeout(() => {
                    setStep(3)
                  }, 1500)
                }}
              />

              <div className="mt-5 flex gap-3">
                <button className="flex-1 py-3 rounded-xl border-2 border-gray-100 text-gray-500 text-sm font-semibold hover:border-gray-200 hover:text-gray-700 transition-all"
                  onClick={() => setStep(1)}>
                  ← Volver
                </button>
                <motion.button className="flex-[2] btn-blue" disabled={!faceVerified}
                  whileTap={faceVerified ? { scale: 0.97 } : {}} onClick={() => setStep(3)}>
                  <CheckCircle size={16} />
                  {faceVerified ? 'Continuar' : 'Esperando verificación...'}
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* ── Step 3 ── */}
          {step === 3 && (
            <motion.div key="step3" className="card p-6"
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}>
              {!submitted ? (
                <>
                  <h2 className="font-display font-semibold text-gray-900 text-lg mb-1">Confirmar Registro</h2>
                  <p className="text-gray-400 text-sm mb-5">Revisa tus datos antes de enviar.</p>

                  <div className="bg-slate-50 rounded-2xl p-4 flex flex-col gap-3 mb-5 border border-slate-100">
                    {[
                      { label: 'Nombres',   value: form.nombres   },
                      { label: 'Apellidos', value: form.apellidos },
                      { label: 'Cédula',    value: form.cedula    },
                      { label: 'Biometría', value: '✓ Verificada', highlight: true },
                    ].map(({ label, value, highlight }) => (
                      <div key={label} className="flex justify-between items-center">
                        <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">{label}</span>
                        <span className={`text-sm font-semibold ${highlight ? 'text-emerald-600' : 'text-gray-800'}`}>
                          {value}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-xl p-3 mb-5">
                    <Shield size={15} className="text-unerg-500 mt-0.5 flex-shrink-0" />
                    <p className="text-unerg-700 text-xs leading-relaxed">
                      Tus datos biométricos son cifrados con AES-256 y almacenados conforme a la normativa UNERG.
                    </p>
                  </div>

                  {registerError && (
                    <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-xl p-3 mb-5">
                      <AlertCircle size={16} className="text-red-400 mt-0.5 flex-shrink-0" />
                      <p className="text-red-600 text-sm">{registerError}</p>
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button className="flex-1 py-3 rounded-xl border-2 border-gray-100 text-gray-500 text-sm font-semibold hover:border-gray-200 transition-all"
                      disabled={isRegistering}
                      onClick={() => setStep(2)}>
                      ← Volver
                    </button>
                    <motion.button className="flex-[2] btn-blue" whileTap={{ scale: 0.97 }}
                      disabled={isRegistering}
                      onClick={handleRegister}>
                      {isRegistering ? (
                        <>
                          <Loader2 size={16} className="animate-spin-fast mr-2" /> Registrando...
                        </>
                      ) : (
                        <>
                          Completar Registro <ChevronRight size={18} />
                        </>
                      )}
                    </motion.button>
                  </div>
                </>
              ) : (
                <SuccessCard userId={userId} name={form.nombres} />
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="text-center mt-8 pb-4">
          <p className="text-gray-300 text-xs font-semibold uppercase tracking-wider mb-1">
            Diseñado y desarrollado por PRAGMA STUDIO
          </p>
          <p className="text-gray-400 text-[10px]">
            &copy; {new Date().getFullYear()} PRAGMA STUDIO. Se reserva el derecho de autor. Todos los derechos reservados.
          </p>
        </div>
      </div>
    </div>
  )
}
