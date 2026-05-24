import { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { motion } from 'framer-motion'
import { X, QrCode } from 'lucide-react'
import { CATALOG } from '../constants/catalog'

interface Props { onClose: () => void }

export default function CatalogQR({ onClose }: Props) {
  const [selected, setSelected] = useState<string | null>(null)
  const products = Object.entries(CATALOG)

  return (
    <div className="fixed inset-0 z-50 flex flex-col"
      style={{ background: '#f0f4fb' }}>

      {/* Header */}
      <div className="surface-strong flex items-center justify-between px-4 py-3 flex-shrink-0"
        style={{ borderBottom: '1px solid rgba(37,99,235,0.08)' }}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg,#2563eb,#1d4ed8)' }}>
            <QrCode size={15} className="text-white" />
          </div>
          <div>
            <p className="text-gray-400 text-[10px] uppercase tracking-widest font-medium">Para pruebas</p>
            <h2 className="font-display font-bold text-base text-gray-900">Catálogo QR</h2>
          </div>
        </div>
        <motion.button onClick={onClose} whileTap={{ scale: 0.9 }}
          className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-400"
          style={{ background: '#f3f4f6', border: '1px solid #e5e7eb' }}>
          <X size={15} />
        </motion.button>
      </div>

      <p className="px-4 py-3 text-gray-400 text-xs text-center">
        Toca un producto para ver su QR. Escanéalo con el lector para agregarlo al carrito.
      </p>

      {/* Product grid */}
      <div className="flex-1 overflow-y-auto px-4 pb-6">
        <div className="grid grid-cols-2 gap-3">
          {products.map(([code, prod]) => (
            <motion.button key={code}
              className="rounded-2xl p-3 text-left flex flex-col gap-2"
              style={{ background: 'rgba(255,255,255,0.9)', border: `1px solid ${prod.accent}25`, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}
              whileTap={{ scale: 0.97 }}
              onClick={() => setSelected(selected === code ? null : code)}>

              <div className="flex items-center gap-2">
                <span className="text-xl">{prod.emoji}</span>
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 text-xs leading-tight truncate">{prod.name}</p>
                  <p className="font-bold text-sm" style={{ color: prod.accent }}>${prod.price.toFixed(2)}</p>
                </div>
              </div>

              {selected === code && (
                <motion.div className="flex flex-col items-center gap-1.5 pt-1"
                  initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                  <div className="bg-white rounded-xl p-2">
                    <QRCodeSVG value={code} size={100} bgColor="#ffffff" fgColor="#1e3a8a" level="M" />
                  </div>
                  <span className="font-mono text-gray-400 text-[9px]">{code}</span>
                </motion.div>
              )}

              {selected !== code && (
                <div className="flex items-center gap-1 text-gray-400">
                  <QrCode size={11} />
                  <span className="text-[10px]">Ver QR</span>
                </div>
              )}
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  )
}
