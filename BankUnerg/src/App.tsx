import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  User, FileText, CheckCircle, AlertCircle,
  ChevronRight, Loader2, X, Shield, Scan,
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
        className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300 border backdrop-blur-md ${
          state === 'active' ? 'border-blue-500/50 bg-blue-500/10 text-blue-400' : state === 'done' ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400' : 'border-slate-700 bg-slate-800/50 text-slate-500'
        }`}
        animate={state === 'active' ? { scale: [1, 1.08, 1] } : { scale: 1 }}
        transition={{ repeat: state === 'active' ? Infinity : 0, duration: 2 }}
      >
        {state === 'done' ? <CheckCircle size={16} /> : n}
      </motion.div>
      <span className={`text-[11px] font-medium whitespace-nowrap ${
        state === 'active' ? 'text-blue-400' : state === 'done' ? 'text-emerald-400' : 'text-slate-500'
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
      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
        {label}
      </label>
      <div className="relative">
        <Icon
          size={16}
          className={`absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors duration-200 ${
            focused ? 'text-blue-400' : showCheck ? 'text-emerald-400' : 'text-slate-500'
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
  idle:            { text: 'Listo para iniciar',          color: 'text-slate-400',   dot: 'bg-slate-500'  },
  loading_models:  { text: 'Cargando modelos IA...',      color: 'text-blue-400',    dot: 'bg-blue-500'   },
  starting_camera: { text: 'Iniciando cámara...',         color: 'text-blue-400',    dot: 'bg-blue-500'   },
  no_face:         { text: 'Coloca tu rostro en el marco',color: 'text-amber-400',   dot: 'bg-amber-400'  },
  multiple:        { text: 'Solo un rostro por favor',    color: 'text-red-400',     dot: 'bg-red-500'    },
  detected:        { text: 'Rostro detectado...',         color: 'text-blue-300',    dot: 'bg-blue-400'   },
  verifying:       { text: 'Verificando biometría...',    color: 'text-indigo-400',  dot: 'bg-indigo-500' },
  verified:        { text: '✓ Identidad verificada',      color: 'text-emerald-400', dot: 'bg-emerald-500'},
  error:           { text: 'Error de cámara',             color: 'text-red-400',     dot: 'bg-red-500'    },
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
      <div className="camera-wrapper"
        style={{
          boxShadow: verified ? 'inset 0 0 40px rgba(16,185,129,0.2), 0 0 24px rgba(16,185,129,0.3)' : undefined,
          transition: 'all 0.4s',
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

        {/* Camera Overlay when loading */}
        <AnimatePresence>
          {(!isRunning || status === 'starting_camera' || status === 'loading_models') && !verified && !error && (
            <motion.div
              className="absolute inset-0 bg-slate-900/90 backdrop-blur-sm z-20 flex flex-col items-center justify-center gap-6"
              initial={{ opacity: 1 }} exit={{ opacity: 0 }}
            >
              <div className="relative w-24 h-24 flex items-center justify-center">
                {/* Outer rotating dashed ring */}
                <motion.div 
                  className="absolute inset-0 border-2 border-dashed border-blue-500/30 rounded-full"
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 8, ease: "linear" }}
                />
                
                {/* Inner pulsing solid ring */}
                <motion.div 
                  className="absolute inset-2 border border-blue-400/50 rounded-full"
                  animate={{ scale: [1, 1.05, 1], opacity: [0.5, 1, 0.5] }}
                  transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                />

                {/* Central Face icon */}
                <Scan size={36} className="text-blue-400 opacity-80" strokeWidth={1.5} />
                
                {/* Horizontal scanning line */}
                <motion.div 
                  className="absolute left-4 right-4 h-[2px] bg-blue-400 shadow-[0_0_8px_#60a5fa]"
                  animate={{ top: ['20%', '80%', '20%'] }}
                  transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                />
              </div>
              <span className="text-blue-400 text-sm font-semibold tracking-widest uppercase animate-pulse">
                Inicializando Sensor...
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Confidence bar (Sci-Fi Premium) */}
      {isRunning && !verified && (
        <div className="bg-slate-900/50 rounded-2xl p-5 border border-slate-700/50 backdrop-blur-md shadow-2xl relative overflow-hidden">
          {/* Telemetry Background Detail */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl pointer-events-none" />
          
          <div className="flex justify-between items-center mb-3">
            <span className="text-blue-400 font-semibold text-xs tracking-widest uppercase flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
              Análisis Biométrico
            </span>
            <span className="text-blue-300 font-mono font-bold text-sm tracking-wider">
              {confidence}%
            </span>
          </div>
          <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden relative shadow-inner">
            <div
              className="absolute top-0 left-0 h-full rounded-full transition-all duration-[400ms] ease-out"
              style={{
                width: `${Math.max(5, confidence)}%`,
                background: 'linear-gradient(90deg, #3b82f6 0%, #60a5fa 50%, #00f2fe 100%)',
                boxShadow: '0 0 10px rgba(96, 165, 250, 0.8), inset 0 0 4px rgba(255, 255, 255, 0.4)'
              }}
            />
          </div>
          <div className="flex justify-between mt-3 text-[9px] text-slate-500 font-mono uppercase tracking-widest">
            <span>Secure_Enclave: ON</span>
            <span className={confidence > 50 ? 'text-emerald-400' : 'text-slate-500'}>
              Landmarks: {confidence > 50 ? 'LOCKED' : 'SCAN'}
            </span>
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
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-red-400 transition-colors">
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

      {!isRunning && !verified && (
        <motion.button className="btn-blue mt-2" onClick={startCamera} whileTap={{ scale: 0.97 }}>
          <Scan size={18} /> Iniciar Verificación Facial
        </motion.button>
      )}
    </div>
  )
}

/* ─── Success card ─── */
function SuccessCard({ name, onReset }: { name: string; onReset: () => void }) {
  return (
    <motion.div
      className="flex flex-col items-center text-center py-6 gap-5"
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 22 }}
    >
      {/* Check */}
      <motion.div className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/30 shadow-[0_0_40px_rgba(16,185,129,0.2)]"
        initial={{ scale: 0 }} animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 280, damping: 18, delay: 0.1 }}>
        <CheckCircle size={40} className="text-emerald-400" strokeWidth={1.8} />
      </motion.div>

      <div>
        <h3 className="font-display font-bold text-2xl text-white">¡Registro Exitoso!</h3>
        <p className="text-slate-400 text-sm mt-1">
          Bienvenido, <span className="text-slate-200 font-medium">{name}</span>
        </p>
      </div>


      {/* Privacy */}
      <div className="flex items-start gap-2 bg-slate-800/50 border border-slate-700/50 rounded-xl p-3 w-full text-left">
        <Shield size={14} className="text-blue-400 mt-0.5 flex-shrink-0" />
        <p className="text-slate-300 text-xs leading-relaxed">
          Tus datos biométricos están cifrados con AES-256 y almacenados de forma segura.
        </p>
      </div>

      <button
        onClick={onReset}
        className="mt-2 w-full py-3 rounded-xl border border-slate-700 text-slate-400 text-sm font-semibold hover:border-blue-500/50 hover:text-blue-400 hover:bg-blue-500/10 transition-all"
      >
        + Registrar nueva persona
      </button>
    </motion.div>
  )
}

/* ─── Progress bar ─── */
function ProgressBar({ step }: { step: number }) {
  const pct = ((step - 1) / 2) * 100
  return (
    <div className="h-1 rounded-full bg-slate-800 overflow-hidden mb-1">
      <motion.div
        className="h-full rounded-full"
        style={{ background: 'linear-gradient(90deg,#3b82f6,#8b5cf6)' }}
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
    <div className="min-h-screen bg-[#0B1121] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Deep Space Background Blobs */}
      <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] rounded-full opacity-20 blur-[120px] bg-blue-600 pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] rounded-full opacity-10 blur-[150px] bg-indigo-600 pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Header */}
        <div className="text-center mb-8 animate-page">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-slate-800/50 border border-slate-700/50 shadow-[0_0_30px_rgba(59,130,246,0.15)] mb-4">
            <Shield size={26} className="text-blue-400" strokeWidth={1.8} />
          </div>
          <h1 className="font-display font-bold text-2xl text-white tracking-wide">
            Bank<span className="text-blue-500">UNERG</span>
          </h1>
          <p className="text-slate-400 text-sm mt-1 uppercase tracking-widest text-[10px]">KYC Biométrico</p>
        </div>

        {/* Steps + progress */}
        <div className="mb-6 animate-page delay-1">
          <ProgressBar step={step} />
          <div className="flex items-center justify-center gap-0 mt-3">
            <StepBadge n={1} label="Datos"       state={step > 1 ? 'done' : step === 1 ? 'active' : 'idle'} />
            <div className="w-12 h-px bg-slate-700/50 mx-1 mb-5" />
            <StepBadge n={2} label="Biometría"   state={step > 2 ? 'done' : step === 2 ? 'active' : 'idle'} />
            <div className="w-12 h-px bg-slate-700/50 mx-1 mb-5" />
            <StepBadge n={3} label="Check" state={step === 3 ? (submitted ? 'done' : 'active') : 'idle'} />
          </div>
        </div>

        <AnimatePresence mode="wait">
          {/* ── Step 1 ── */}
          {step === 1 && (
            <motion.div key="step1" className="card p-6 animate-page delay-2"
              initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}>
              <h2 className="font-display font-semibold text-white text-lg mb-1">Datos Personales</h2>
              <p className="text-slate-400 text-sm mb-5">Ingresa tu información tal como aparece en tu cédula.</p>

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
              <h2 className="font-display font-semibold text-white text-lg mb-1">Verificación Facial</h2>
              <p className="text-slate-400 text-sm mb-4">
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
                <button className="flex-1 py-3 rounded-xl border border-slate-700 text-slate-400 text-sm font-semibold hover:border-slate-500 hover:text-slate-200 transition-all"
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
                  <h2 className="font-display font-semibold text-white text-lg mb-1">Confirmar Registro</h2>
                  <p className="text-slate-400 text-sm mb-5">Revisa tus datos antes de enviar.</p>

                  <div className="bg-slate-800/50 rounded-2xl p-4 flex flex-col gap-3 mb-5 border border-slate-700/50">
                    {[
                      { label: 'Nombres',   value: form.nombres   },
                      { label: 'Apellidos', value: form.apellidos },
                      { label: 'Cédula',    value: form.cedula    },
                      { label: 'Biometría', value: '✓ Verificada', highlight: true },
                    ].map(({ label, value, highlight }) => (
                      <div key={label} className="flex justify-between items-center">
                        <span className="text-xs text-slate-500 font-medium uppercase tracking-wide">{label}</span>
                        <span className={`text-sm font-semibold ${highlight ? 'text-emerald-400' : 'text-slate-200'}`}>
                          {value}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-start gap-2 bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 mb-5">
                    <Shield size={15} className="text-blue-400 mt-0.5 flex-shrink-0" />
                    <p className="text-blue-200/70 text-xs leading-relaxed">
                      Tus datos biométricos son cifrados con AES-256 y almacenados conforme a la normativa de seguridad.
                    </p>
                  </div>

                  {registerError && (
                    <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-xl p-3 mb-5">
                      <AlertCircle size={16} className="text-red-400 mt-0.5 flex-shrink-0" />
                      <p className="text-red-400 text-sm">{registerError}</p>
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button className="flex-1 py-3 rounded-xl border border-slate-700 text-slate-400 text-sm font-semibold hover:border-slate-500 transition-all"
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
                <SuccessCard
                  name={form.nombres}
                  onReset={() => {
                    setStep(1)
                    setFaceVerified(false)
                    setSubmitted(false)
                    setForm({ nombres: '', apellidos: '', cedula: '' })
                    setFaceDescriptor(null)
                    setIsRegistering(false)
                    setRegisterError(null)
                  }}
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="text-center mt-8 pb-4">
          <p className="text-slate-500 text-[10px] font-semibold uppercase tracking-widest mb-1">
            Diseñado y desarrollado por PRAGMA STUDIO
          </p>
          <p className="text-slate-600 text-[9px] uppercase tracking-wide">
            &copy; {new Date().getFullYear()} PRAGMA STUDIO. Reservados los derechos de autor.
          </p>
        </div>
      </div>
    </div>
  )
}
