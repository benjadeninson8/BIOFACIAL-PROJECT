import { useEffect, useRef, useState, useCallback } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Flashlight, FlashlightOff, CheckCircle } from 'lucide-react'
import type { Product } from './ProductRow'
import { CATALOG } from '../constants/catalog'

interface Props {
  onScanned: (product: Omit<Product, 'qty'>) => void
  onClose: () => void
}

type ScanState = 'scanning' | 'found' | 'unknown'

export default function BarcodeScanner({ onScanned, onClose }: Props) {
  const videoRef    = useRef<HTMLVideoElement>(null)
  const readerRef   = useRef<BrowserMultiFormatReader | null>(null)
  const controlsRef = useRef<{ stop: () => void } | null>(null)

  const [scanState,  setScanState]  = useState<ScanState>('scanning')
  const [lastResult, setLastResult] = useState<string>('')
  const [foundProd,  setFoundProd]  = useState<Omit<Product,'qty'> | null>(null)
  const [torch,      setTorch]      = useState(false)
  const [torchAvail, setTorchAvail] = useState(false)
  const streamRef = useRef<MediaStream | null>(null)

  /* Start scanner */
  useEffect(() => {
    const reader = new BrowserMultiFormatReader()
    readerRef.current = reader

    ;(async () => {
      try {
        // Get rear camera stream
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } },
        })
        streamRef.current = stream

        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }

        // Check torch support
        const track = stream.getVideoTracks()[0]
        const caps = track.getCapabilities?.() as Record<string, unknown> | undefined
        if (caps && 'torch' in caps) setTorchAvail(true)

        // Start decoding
        const controls = await reader.decodeFromStream(stream, videoRef.current!, (result, err) => {
          if (result) {
            const code = result.getText()
            setLastResult(code)
            const product = CATALOG[code]
            if (product) {
              setFoundProd(product)
              setScanState('found')
            } else {
              setFoundProd(null)
              setScanState('unknown')
              // Reset after 1.5s
              setTimeout(() => setScanState('scanning'), 1500)
            }
          } else if (err && err.name !== 'NotFoundException') {
            // ignore NotFoundException (no code in frame)
          }
        })
        controlsRef.current = controls
      } catch (e) {
        console.error('Scanner error:', e)
      }
    })()

    return () => {
      controlsRef.current?.stop()
      streamRef.current?.getTracks().forEach(t => t.stop())
    }
  }, [])

  /* Toggle torch */
  const toggleTorch = useCallback(async () => {
    const track = streamRef.current?.getVideoTracks()[0]
    if (!track) return
    try {
      await (track as MediaStreamTrack & { applyConstraints: (c: object) => Promise<void> })
        .applyConstraints({ advanced: [{ torch: !torch } as object] })
      setTorch(t => !t)
    } catch { /* torch not supported */ }
  }, [torch])

  /* Confirm add */
  const confirmAdd = () => {
    if (foundProd) {
      onScanned(foundProd)
      setScanState('scanning')
      setFoundProd(null)
      setLastResult('')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: '#000' }}>

      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-3"
        style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.7), transparent)' }}>
        <div>
          <p className="text-white/60 text-[10px] uppercase tracking-widest font-medium">Lector de Productos</p>
          <h2 className="text-white font-bold text-lg font-display">Escanear Código</h2>
        </div>
        <div className="flex items-center gap-2">
          {torchAvail && (
            <motion.button
              onClick={toggleTorch}
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: torch ? '#facc15' : 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)' }}
              whileTap={{ scale: 0.9 }}>
              {torch
                ? <Flashlight size={16} className="text-gray-900" />
                : <FlashlightOff size={16} className="text-white" />}
            </motion.button>
          )}
          <motion.button
            onClick={onClose}
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)' }}
            whileTap={{ scale: 0.9 }}>
            <X size={16} className="text-white" />
          </motion.button>
        </div>
      </div>

      {/* Video */}
      <video
        ref={videoRef}
        className="w-full h-full object-cover"
        autoPlay playsInline muted
      />

      {/* Scan frame overlay */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        {/* Dim corners */}
        <div className="absolute inset-0" style={{
          background: 'radial-gradient(ellipse 260px 200px at center, transparent 45%, rgba(0,0,0,0.55) 75%)',
        }} />

        {/* Scan box */}
        <div className="relative" style={{ width: 260, height: 200 }}>
          {/* Animated scan line */}
          <motion.div
            className="absolute left-0 right-0 h-0.5 rounded-full"
            style={{
              background: scanState === 'found'
                ? 'linear-gradient(90deg,transparent,#10b981,transparent)'
                : 'linear-gradient(90deg,transparent,#2563eb,transparent)',
              boxShadow: scanState === 'found' ? '0 0 12px #10b981' : '0 0 12px #3b82f6',
            }}
            animate={{ top: ['10%', '85%', '10%'] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
          />

          {/* Corner brackets */}
          {(['tl','tr','bl','br'] as const).map(pos => (
            <div key={pos} className="absolute w-8 h-8" style={{
              ...(pos.includes('t') ? { top: 0 } : { bottom: 0 }),
              ...(pos.includes('l') ? { left: 0 } : { right: 0 }),
              borderColor: scanState === 'found' ? '#10b981' : scanState === 'unknown' ? '#ef4444' : '#2563eb',
              borderStyle: 'solid',
              borderTopWidth:    pos.includes('t') ? 3 : 0,
              borderBottomWidth: pos.includes('b') ? 3 : 0,
              borderLeftWidth:   pos.includes('l') ? 3 : 0,
              borderRightWidth:  pos.includes('r') ? 3 : 0,
              borderTopLeftRadius:     pos === 'tl' ? 6 : 0,
              borderTopRightRadius:    pos === 'tr' ? 6 : 0,
              borderBottomLeftRadius:  pos === 'bl' ? 6 : 0,
              borderBottomRightRadius: pos === 'br' ? 6 : 0,
              transition: 'border-color 0.3s',
            }} />
          ))}
        </div>
      </div>

      {/* Status hint */}
      <div className="absolute bottom-28 left-0 right-0 flex justify-center pointer-events-none">
        <div className="px-4 py-2 rounded-full text-sm font-medium"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', color: 'rgba(255,255,255,0.7)' }}>
          {scanState === 'scanning' && 'Apunta al código de barras o QR del producto'}
          {scanState === 'unknown'  && <span className="text-red-400">Código no encontrado en catálogo</span>}
        </div>
      </div>

      {/* Last raw result (debug, small) */}
      {lastResult && scanState === 'unknown' && (
        <div className="absolute bottom-20 left-0 right-0 flex justify-center pointer-events-none">
          <span className="font-mono text-white/30 text-xs">{lastResult}</span>
        </div>
      )}

      {/* ── Found product sheet ── */}
      <AnimatePresence>
        {scanState === 'found' && foundProd && (
          <motion.div
            className="absolute bottom-0 left-0 right-0 rounded-t-3xl p-5"
            style={{
              background: 'rgba(255,255,255,0.97)',
              boxShadow: '0 -8px 40px rgba(0,0,0,0.3)',
            }}
            initial={{ y: 200, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 200, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
          >
            {/* Handle */}
            <div className="flex justify-center mb-4">
              <div className="w-10 h-1 rounded-full bg-gray-200" />
            </div>

            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0"
                style={{ background: `linear-gradient(135deg,${foundProd.accent}20,${foundProd.accent}08)`, border: `1px solid ${foundProd.accent}30` }}>
                {foundProd.emoji}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <CheckCircle size={14} className="text-emerald-500 flex-shrink-0" />
                  <span className="text-emerald-600 text-xs font-semibold">Producto encontrado</span>
                </div>
                <p className="font-bold text-gray-900 text-lg leading-tight truncate">{foundProd.name}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: foundProd.accent }} />
                  <span className="text-gray-400 text-xs">{foundProd.category}</span>
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-gray-400 text-xs mb-0.5">Precio</p>
                <p className="font-bold text-2xl" style={{ color: foundProd.accent }}>
                  ${foundProd.price.toFixed(2)}
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => { setScanState('scanning'); setFoundProd(null) }}
                className="flex-1 py-3 rounded-xl border-2 border-gray-100 text-gray-500 font-semibold text-sm hover:border-gray-200 transition-all"
              >
                Seguir escaneando
              </button>
              <motion.button
                onClick={confirmAdd}
                className="flex-[2] py-3 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2"
                style={{ background: 'linear-gradient(135deg,#2563eb,#1d4ed8)', boxShadow: '0 4px 16px rgba(37,99,235,0.3)' }}
                whileTap={{ scale: 0.97 }}
              >
                <CheckCircle size={16} /> Agregar al Carrito
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
