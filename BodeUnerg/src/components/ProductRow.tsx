import { useState } from 'react'
import { motion } from 'framer-motion'
import { Plus, Minus } from 'lucide-react'
import SpringCounter from './SpringCounter'

export interface Product {
  id: number; name: string; price: number; qty: number; emoji: string
  category: string; accent: string
}

interface Props { p: Product; onQty: (id: number, d: number) => void }

export default function ProductRow({ p, onQty }: Props) {
  const [hovered, setHovered] = useState(false)

  return (
    <motion.div
      className="product-row"
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0 }}
      transition={{ duration: 0.22 }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      style={{
        borderColor: hovered ? `${p.accent}30` : 'rgba(37,99,235,0.07)',
        boxShadow: hovered ? `0 4px 20px ${p.accent}18` : '0 1px 4px rgba(0,0,0,0.04)',
      }}
    >
      {/* Category accent bar */}
      <div className="absolute left-0 top-3 bottom-3 w-1 rounded-r-full"
        style={{ background: p.accent, opacity: hovered ? 0.9 : 0.45, transition: 'opacity 0.2s' }} />

      {/* ── TOP ROW (mobile) / all cols (desktop) ── */}
      <div className="row-top">
        {/* Emoji */}
        <div className="w-[60px] h-[60px] md:w-[60px] md:h-[60px] rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
          style={{ background: `linear-gradient(135deg,${p.accent}18,${p.accent}08)`, border: `1px solid ${p.accent}25` }}>
          {p.emoji}
        </div>

        {/* Name + category + price (desktop also shows price here via SpringCounter below) */}
        <div className="min-w-0 flex-1 pl-1">
          <p className="font-semibold text-gray-900 text-sm md:text-base truncate">{p.name}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: p.accent }} />
            <p className="text-gray-400 text-xs">{p.category}</p>
          </div>
          <p className="text-xs mt-0.5 font-semibold" style={{ color: p.accent }}>
            ${p.price.toFixed(2)} <span className="text-gray-400 font-normal">/ u</span>
          </p>
        </div>

        {/* Subtotal — desktop only (hidden on mobile via row-bottom) */}
        <SpringCounter
          value={p.price * p.qty}
          className="font-bold text-lg tabular-nums text-right w-20 flex-shrink-0 text-gray-900 hidden md:block"
        />
      </div>

      {/* ── BOTTOM ROW (mobile) — qty + subtotal ── */}
      <div className="row-bottom">
        {/* Qty controls */}
        <div className="flex items-center gap-2">
          <motion.button className="qty-btn" whileTap={{ scale: 0.88 }} onClick={() => onQty(p.id, -1)}>
            <Minus size={13} />
          </motion.button>
          <motion.span
            key={p.qty}
            className="font-bold text-base w-7 text-center tabular-nums text-gray-900"
            initial={{ scale: 1.35, color: p.accent }}
            animate={{ scale: 1, color: '#111827' }}
            transition={{ duration: 0.2 }}
          >
            {p.qty}
          </motion.span>
          <motion.button className="qty-btn" whileTap={{ scale: 0.88 }} onClick={() => onQty(p.id, 1)}>
            <Plus size={13} />
          </motion.button>
        </div>

        {/* Subtotal — shows on BOTH mobile (in row-bottom) and desktop (hidden duplicate) */}
        <SpringCounter
          value={p.price * p.qty}
          className="font-bold text-lg tabular-nums text-right text-gray-900 md:hidden"
        />
      </div>
    </motion.div>
  )
}
