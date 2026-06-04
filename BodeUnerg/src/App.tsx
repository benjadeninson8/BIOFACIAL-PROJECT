import { useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { QRCodeSVG } from 'qrcode.react'
import {
  ShoppingCart, X, CheckCircle, Scan, CreditCard,
  Smartphone, ChevronRight, Wifi, Shield, ArrowLeft, Banknote, Package, QrCode
} from 'lucide-react'
import FacialCamera, { type BiometricUser } from './components/FacialCamera'
import ConfettiBlast from './components/ConfettiBlast'
import SpringCounter from './components/SpringCounter'
import ProductRow, { type Product } from './components/ProductRow'
import BarcodeScanner from './components/BarcodeScanner'
import CatalogQR from './components/CatalogQR'

/* ─── Data ─── */
const INITIAL: Product[] = [
  { id: 2, name: 'Whiskey Reserva', price: 45.00, qty: 1, emoji: '🥃', category: 'Licorería',    accent: '#f59e0b' },
  { id: 4, name: 'Maní Tostado',    price: 2.50,  qty: 2, emoji: '🥜', category: 'Snacks',       accent: '#10b981' },
]

const CATALOG_ITEMS: Omit<Product, 'qty'>[] = [
  { id: 1, name: 'Tabaco Premium',  price: 12.50, emoji: '🚬', category: 'Tabaquería',   accent: '#6366f1' },
  { id: 2, name: 'Whiskey Reserva', price: 45.00, emoji: '🥃', category: 'Licorería',    accent: '#f59e0b' },
  { id: 3, name: 'Hielo Artesanal', price: 3.75,  emoji: '🧊', category: 'Refrigerados', accent: '#0ea5e9' },
  { id: 4, name: 'Maní Tostado',    price: 2.50,  emoji: '🥜', category: 'Snacks',       accent: '#10b981' },
  { id: 5, name: 'Refresco Cola',   price: 1.80,  emoji: '🥤', category: 'Bebidas',      accent: '#ef4444' },
  { id: 6, name: 'Chocolate Barra', price: 2.00,  emoji: '🍫', category: 'Dulces',       accent: '#8b5cf6' },
  { id: 7, name: 'Cerveza Fría',    price: 3.50,  emoji: '🍺', category: 'Licorería',    accent: '#eab308' },
  { id: 8, name: 'Papas Fritas',    price: 3.20,  emoji: '🍟', category: 'Snacks',       accent: '#ec4899' },
]

const METHODS = [
  { id: 'mobile',  label: 'Pago Móvil',            sub: 'Transferencia interbancaria', icon: Smartphone, featured: false },
  { id: 'card',    label: 'Tarjeta Débito',         sub: 'Visa · MC · AMEX',           icon: CreditCard, featured: false },
  { id: 'facial',  label: 'Reconocimiento Facial',  sub: 'Biometría instantánea',       icon: Scan,       featured: true  },
  { id: 'cash',    label: 'Efectivo',               sub: 'Pago en caja asistida',       icon: Banknote,   featured: false },
]

const IVA = 0.16

/* ─── Live clock ─── */
function LiveClock() {
  const [time, setTime] = useState(new Date())
  useEffect(() => { const t = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(t) }, [])
  return <>{time.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</>
}

/* ─── Empty state ─── */
function EmptyCart() {
  return (
    <motion.div className="flex flex-col items-center justify-center py-16 gap-4"
      initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
      <motion.div className="w-20 h-20 rounded-3xl flex items-center justify-center"
        style={{ background: 'linear-gradient(135deg,#eff6ff,#dbeafe)', border: '1.5px dashed #93c5fd' }}
        animate={{ y: [0, -6, 0] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}>
        <Package size={36} strokeWidth={1.2} className="text-blue-400" />
      </motion.div>
      <div className="text-center">
        <p className="text-gray-500 font-semibold">Carrito vacío</p>
        <p className="text-gray-300 text-sm mt-1">Escanea un producto para comenzar</p>
      </div>
    </motion.div>
  )
}

/* ─── Types ─── */
type ModalStep = 'closed' | 'select' | 'facial' | 'success'

export default function App() {
  const [products, setProducts] = useState<Product[]>(INITIAL)
  const [modal,        setModal]        = useState<ModalStep>('closed')
  const [selected,     setSelected]     = useState<string | null>(null)
  const [paidWith,     setPaidWith]     = useState('')
  const [verifiedUser, setVerifiedUser] = useState<BiometricUser | null>(null)
  const [payRef,       setPayRef]       = useState('')
  const [confetti,     setConfetti]     = useState(false)
  const [showScanner,  setShowScanner]  = useState(false)
  const [showCatalog,  setShowCatalog]  = useState(false)
  const [showRegisterQR, setShowRegisterQR] = useState(false)
  const [mobileTab, setMobileTab] = useState<'shelf' | 'cart'>('shelf')
  const [activeCategory, setActiveCategory] = useState('Todos')
  const registerUrl = import.meta.env.VITE_REGISTER_URL || 'https://biofacial-81dbf.web.app'

  // Ping Railway backend on terminal load to prevent cold-start delay during facial payment
  useEffect(() => {
    const api = import.meta.env.VITE_API_URL || ''
    if (!api) return
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 5000)
    fetch(`${api}/api/health`, { signal: ctrl.signal })
      .then(() => console.log('[BioFacial] Backend pre-calentado (BodeUnerg).'))
      .catch(() => {}) // silent — failure is fine, just a warm-up
      .finally(() => clearTimeout(t))
  }, [])

  const updateQty = useCallback((id: number, delta: number) => {
    setProducts(prev =>
      prev.map(p => p.id === id ? { ...p, qty: Math.max(0, p.qty + delta) } : p)
          .filter(p => p.qty > 0)
    )
  }, [])

  const handleAddToCart = (item: Omit<Product, 'qty'>) => {
    setProducts(prev => {
      const existing = prev.find(p => p.id === item.id)
      if (existing) return prev.map(p => p.id === item.id ? { ...p, qty: p.qty + 1 } : p)
      return [...prev, { ...item, qty: 1 }]
    })
  }

  const subtotal  = products.reduce((s, p) => s + p.price * p.qty, 0)
  const iva       = subtotal * IVA
  const total     = subtotal + iva
  const itemCount = products.reduce((s, p) => s + p.qty, 0)

  const openPay  = () => { setSelected(null); setModal('select') }
  const closeAll = () => { setModal('closed'); setSelected(null) }

  const handleScanned = (product: Omit<Product,'qty'>) => {
    handleAddToCart(product)
    setShowScanner(false)
  }

  const triggerSuccess = (method: string, user: BiometricUser | null = null) => {
    setPaidWith(method)
    setVerifiedUser(user)
    setPayRef(`BU-${Date.now().toString(36).toUpperCase().slice(-8)}`)
    setModal('success')
    setConfetti(true)
    setTimeout(() => {
      closeAll()
      setProducts(INITIAL)
      setVerifiedUser(null)
      setPayRef('')
    }, 3800)
  }

  const confirmMethod = () => {
    if (!selected) return
    if (selected === 'facial') { setModal('facial'); return }
    triggerSuccess(METHODS.find(m => m.id === selected)?.label ?? selected)
  }

  const filteredCatalog = CATALOG_ITEMS.filter(item => {
    if (activeCategory === 'Todos') return true
    if (activeCategory === 'Otros') {
      return !['Licorería', 'Snacks', 'Bebidas'].includes(item.category)
    }
    return item.category === activeCategory
  })

  const blurBg = modal !== 'closed'

  return (
    <div className="min-h-screen md:h-screen md:overflow-hidden flex flex-col relative"
      style={{
        background: 'radial-gradient(ellipse at 20% 0%,rgba(37,99,235,0.08) 0%,transparent 55%),'
                  + 'radial-gradient(ellipse at 85% 100%,rgba(96,165,250,0.07) 0%,transparent 50%),'
                  + '#f0f4fb',
      }}>

      <ConfettiBlast trigger={confetti} />

      {/* Blobs */}
      <div className="fixed top-0 right-0 w-72 h-72 rounded-full opacity-20 blur-3xl pointer-events-none"
        style={{ background: 'radial-gradient(circle,#bfdbfe,transparent)' }} />
      <div className="fixed bottom-0 left-0 w-64 h-64 rounded-full opacity-15 blur-3xl pointer-events-none"
        style={{ background: 'radial-gradient(circle,#dbeafe,transparent)' }} />

      {/* ── Header ── */}
      <motion.header
        className="surface-strong flex-shrink-0 z-10 sticky top-0"
        style={{ borderBottom: '1px solid rgba(37,99,235,0.08)' }}
        animate={blurBg ? { filter:'blur(4px)', opacity:0.5 } : { filter:'blur(0)', opacity:1 }}
        transition={{ duration: 0.3 }}
      >
        {/* Mobile header */}
        <div className="flex md:hidden items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'linear-gradient(135deg,#2563eb,#1d4ed8)', boxShadow: '0 3px 10px rgba(37,99,235,0.3)' }}>
              <ShoppingCart size={17} className="text-white" />
            </div>
            <div>
              <p className="text-gray-400 text-[9px] tracking-widest uppercase font-medium leading-none">Sistema de Autopago</p>
              <h1 className="font-display font-bold text-lg leading-tight text-gray-900">
                BODE<span className="text-gradient-blue">UNERG</span>
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <motion.button onClick={() => setShowRegisterQR(true)}
              className="w-9 h-9 flex items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100"
              whileTap={{ scale: 0.9 }}>
              <Smartphone size={17} />
            </motion.button>
            <motion.button onClick={() => setShowScanner(true)}
              className="w-9 h-9 flex items-center justify-center rounded-xl bg-blue-50 text-blue-600 border border-blue-100"
              whileTap={{ scale: 0.9 }}>
              <Scan size={18} />
            </motion.button>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
              style={{ background: '#eff6ff', border: '1px solid #bfdbfe' }}>
              <motion.div className="w-1.5 h-1.5 rounded-full bg-blue-500"
                animate={{ scale:[1,1.4,1], opacity:[1,0.6,1] }} transition={{ duration:2, repeat:Infinity }} />
              <Wifi size={10} className="text-blue-600" />
              <span className="text-blue-700 text-[10px] font-semibold">En Línea</span>
            </div>
          </div>
        </div>

        {/* Desktop header */}
        <div className="hidden md:flex items-center justify-between px-10 py-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg,#2563eb,#1d4ed8)', boxShadow: '0 4px 16px rgba(37,99,235,0.3)' }}>
              <ShoppingCart size={22} className="text-white" />
            </div>
            <div>
              <p className="text-gray-400 text-[10px] tracking-[0.25em] uppercase font-medium">Sistema de Autopago</p>
              <h1 className="font-display font-bold text-2xl leading-tight text-gray-900">
                BODE<span className="text-gradient-blue">UNERG</span>
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex gap-2">
              <motion.button onClick={() => setShowRegisterQR(true)}
                className="px-3 py-1.5 flex items-center gap-1.5 rounded-xl text-xs font-semibold"
                style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#047857' }}
                whileTap={{ scale: 0.95 }}>
                <Smartphone size={14} /> Registrar Celular
              </motion.button>
              <motion.button onClick={() => setShowCatalog(true)}
                className="px-3 py-1.5 flex items-center gap-1.5 rounded-xl bg-white text-gray-600 border border-gray-200 text-xs font-semibold"
                whileTap={{ scale: 0.95 }}>
                <QrCode size={14} /> Catálogo
              </motion.button>
              <motion.button onClick={() => setShowScanner(true)}
                className="px-3 py-1.5 flex items-center gap-1.5 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 text-xs font-semibold"
                whileTap={{ scale: 0.95 }}>
                <Scan size={14} /> Escanear
              </motion.button>
            </div>
            <div className="text-right">
              <p className="text-gray-400 text-xs">Caja #03 · Turno Mañana</p>
              <p className="text-gray-700 font-semibold text-sm font-mono tracking-wide"><LiveClock /></p>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full"
              style={{ background: '#eff6ff', border: '1px solid #bfdbfe' }}>
              <motion.div className="w-2 h-2 rounded-full bg-blue-500"
                animate={{ scale:[1,1.4,1], opacity:[1,0.6,1] }} transition={{ duration:2, repeat:Infinity }} />
              <Wifi size={12} className="text-blue-600" />
              <span className="text-blue-700 text-xs font-semibold">En Línea</span>
            </div>
          </div>
        </div>
      </motion.header>

      {/* ── Content ── */}
      <motion.div className="flex-1 flex flex-col md:flex-row md:min-h-0 md:overflow-hidden"
        animate={blurBg ? { filter:'blur(5px)', scale:0.99, opacity:0.4 } : { filter:'blur(0)', scale:1, opacity:1 }}
        transition={{ duration: 0.35 }}>

        {/* Mobile Tab Control */}
        <div className="md:hidden flex p-2 bg-gray-150/60 backdrop-blur-md sticky top-0 z-20 border-b border-gray-200/50 flex-shrink-0">
          <div className="flex-1 grid grid-cols-2 p-1 bg-gray-200/40 rounded-xl gap-1" style={{ border: '1px solid rgba(0,0,0,0.05)' }}>
            <button
              onClick={() => setMobileTab('shelf')}
              className={`py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                mobileTab === 'shelf' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500'
              }`}
            >
              <Package size={14} /> Estante
            </button>
            <button
              onClick={() => setMobileTab('cart')}
              className={`py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 relative ${
                mobileTab === 'cart' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500'
              }`}
            >
              <ShoppingCart size={14} /> Carrito
              {itemCount > 0 && (
                <span className="bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full scale-90">
                  {itemCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* ── SECCIÓN IZQUIERDA: Estantería de Productos ── */}
        <div className={`flex-1 flex flex-col md:w-[58%] md:border-r border-gray-250 border-gray-200/60 md:min-h-0 ${mobileTab === 'shelf' ? 'flex' : 'hidden md:flex'}`}>
          {/* Categorías */}
          <div className="px-4 md:px-8 pt-5 pb-3 flex-shrink-0 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="font-display font-bold text-lg text-gray-800">Estantería Digital</h2>
              <span className="text-gray-400 text-xs font-semibold bg-white px-2.5 py-1 rounded-full border border-gray-200">
                {CATALOG_ITEMS.length} Disponibles
              </span>
            </div>
            {/* Categorías Pills */}
            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
              {['Todos', 'Licorería', 'Snacks', 'Bebidas', 'Otros'].map(cat => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all border ${
                    activeCategory === cat
                      ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                      : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Grid de Productos */}
          <div className="flex-1 overflow-y-auto px-4 md:px-8 pb-6 grid grid-cols-2 lg:grid-cols-3 gap-3 md:min-h-0">
            {filteredCatalog.map(item => {
              const qtyInCart = products.find(p => p.id === item.id)?.qty || 0;
              return (
                <motion.div
                  key={item.id}
                  className="rounded-2xl p-4 bg-white border border-gray-100 flex flex-col gap-3 relative transition-all"
                  style={{
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.02)',
                  }}
                  whileHover={{ y: -2, boxShadow: '0 8px 24px rgba(37,99,235,0.06)' }}
                >
                  {qtyInCart > 0 && (
                    <motion.span
                      className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center border-2 border-white shadow-sm"
                      initial={{ scale: 0.8 }}
                      animate={{ scale: 1 }}
                    >
                      {qtyInCart}
                    </motion.span>
                  )}

                  <div className="flex items-center justify-between">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                      style={{ background: `${item.accent}15` }}
                    >
                      {item.emoji}
                    </div>
                    <span className="text-[9px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full"
                      style={{ background: '#f3f4f6', color: '#6b7280' }}>
                      {item.category}
                    </span>
                  </div>

                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-950 text-sm leading-tight line-clamp-1">{item.name}</h3>
                    <p className="font-display font-bold text-gray-800 text-base mt-1">${item.price.toFixed(2)}</p>
                  </div>

                  <motion.button
                    onClick={() => handleAddToCart(item)}
                    className="w-full py-2 rounded-xl border border-blue-100 text-blue-600 text-xs font-bold bg-blue-50/50 hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all flex items-center justify-center gap-1"
                    whileTap={{ scale: 0.95 }}
                  >
                    <span>+ Agregar</span>
                  </motion.button>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* ── SECCIÓN DERECHA: Carrito de Compras ── */}
        <div className={`flex-1 flex flex-col md:w-[42%] md:min-h-0 ${mobileTab === 'cart' ? 'flex' : 'hidden md:flex'}`}>
          {/* Column labels — desktop only */}
          <div className="hidden md:block px-6 pt-5 pb-2 flex-shrink-0">
            <div className="grid items-center gap-3" style={{ gridTemplateColumns: '60px 1fr auto auto' }}>
              <span />
              <span className="text-gray-400 text-xs uppercase tracking-widest font-medium pl-1">Producto</span>
              <span className="text-gray-400 text-xs uppercase tracking-widest font-medium text-center w-20">Cant.</span>
              <span className="text-gray-400 text-xs uppercase tracking-widest font-medium text-right w-20">Total</span>
            </div>
          </div>

          {/* Product list */}
          <div className="flex-1 overflow-y-auto px-4 md:px-6 pb-4 flex flex-col gap-2 md:min-h-0 pt-3 md:pt-0">
            <AnimatePresence mode="popLayout">
              {products.length === 0
                ? <EmptyCart key="empty" />
                : products.map(p => <ProductRow key={p.id} p={p} onQty={updateQty} />)
              }
            </AnimatePresence>
          </div>

          {/* ── Summary + Pay — sticky on mobile, fixed footer on desktop ── */}
          <div className="sticky bottom-0 md:relative surface-strong flex-shrink-0 px-4 md:px-6 py-3"
            style={{ borderTop: '1px solid rgba(37,99,235,0.08)' }}>

            {/* Summary rows */}
            <div className="flex flex-col gap-1 mb-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-400 text-xs">Subtotal <span className="text-gray-300">({itemCount} art.)</span></span>
                <SpringCounter value={subtotal} className="text-gray-700 text-sm font-semibold tabular-nums" />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400 text-xs">IVA (16%)</span>
                <SpringCounter value={iva} className="text-gray-400 text-xs tabular-nums" />
              </div>
              <div className="h-px bg-gray-100 my-1" />
              <div className="flex justify-between items-center">
                <span className="text-gray-800 font-bold text-base">TOTAL</span>
                <SpringCounter value={total} className="font-display font-bold text-2xl text-gradient-blue tabular-nums" />
              </div>
            </div>

            <motion.button className="pay-btn" onClick={openPay} disabled={products.length === 0}
              whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}>
              <ShoppingCart size={18} /> PAGAR <ChevronRight size={17} />
            </motion.button>

            <div className="flex items-center justify-center gap-1.5 mt-2">
              <Shield size={10} className="text-gray-300" />
              <span className="text-gray-300 text-[10px]">Transacción cifrada AES-256 · UNERG Finanzas</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ══════════════ MODAL ══════════════ */}
      <AnimatePresence>
        {modal !== 'closed' && (
          <>
            <motion.div className="fixed inset-0 z-40 modal-backdrop"
              initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
              onClick={() => modal === 'select' && closeAll()} />

            <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center md:p-8 pointer-events-none">
              <motion.div
                className="pointer-events-auto relative overflow-hidden w-full md:rounded-3xl rounded-t-3xl"
                style={{
                  maxWidth: modal === 'facial' ? '500px' : '480px',
                  background: 'rgba(255,255,255,0.98)',
                  border: '1px solid rgba(37,99,235,0.12)',
                  boxShadow: '0 -8px 40px rgba(37,99,235,0.1), 0 24px 60px rgba(37,99,235,0.15)',
                  maxHeight: '92vh',
                  overflowY: 'auto',
                }}
                initial={{ opacity:0, y:60 }}
                animate={{ opacity:1, y:0 }}
                exit={{ opacity:0, y:60 }}
                transition={{ type:'spring', stiffness:300, damping:28 }}
              >
                {/* Drag handle (mobile) */}
                <div className="flex justify-center pt-3 pb-1 md:hidden">
                  <div className="w-10 h-1 rounded-full bg-gray-200" />
                </div>

                {/* Blue stripe */}
                <div className="h-1 w-full" style={{ background: 'linear-gradient(90deg,#2563eb,#60a5fa,#2563eb)' }} />

                <div className="p-5 md:p-7">
                  <AnimatePresence mode="wait">

                    {/* ── Method selection ── */}
                    {modal === 'select' && (
                      <motion.div key="select"
                        initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }} transition={{ duration:0.2 }}>

                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <p className="text-gray-400 text-[10px] uppercase tracking-[0.2em] font-semibold mb-0.5">Checkout Seguro</p>
                            <h2 className="font-display font-bold text-xl text-gray-900">Método de Pago</h2>
                            <p className="text-gray-400 text-sm mt-0.5">
                              Total: <span className="text-blue-700 font-bold">${total.toFixed(2)}</span>
                            </p>
                          </div>
                          <motion.button
                            className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 hover:text-gray-700 transition-colors"
                            style={{ background:'#f3f4f6', border:'1px solid #e5e7eb' }}
                            whileTap={{ scale:0.9 }} onClick={closeAll}>
                            <X size={15} />
                          </motion.button>
                        </div>

                        {/* 2×2 grid */}
                        <div className="grid grid-cols-2 gap-2.5 mb-4">
                          {METHODS.map((m, i) => {
                            const Icon = m.icon
                            const isSel = selected === m.id
                            return (
                              <motion.button key={m.id}
                                className={`method-tile ${m.featured ? 'featured' : 'normal'} ${isSel ? 'selected' : ''}`}
                                initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }}
                                transition={{ duration:0.22, delay:i * 0.05 }}
                                whileTap={{ scale:0.96 }} onClick={() => setSelected(m.id)}>

                                {isSel && (
                                  <motion.div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center"
                                    initial={{ scale:0 }} animate={{ scale:1 }}
                                    transition={{ type:'spring', stiffness:400, damping:20 }}>
                                    <CheckCircle size={12} className="text-white" strokeWidth={2.5} />
                                  </motion.div>
                                )}
                                {m.featured && !isSel && (
                                  <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider"
                                    style={{ background:'#dbeafe', color:'#1d4ed8' }}>Principal</div>
                                )}

                                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-0.5 transition-all duration-200"
                                  style={m.featured ? {
                                    background: isSel ? '#1d4ed8' : 'linear-gradient(135deg,#2563eb,#1d4ed8)',
                                    boxShadow: '0 4px 14px rgba(37,99,235,0.3)',
                                  } : {
                                    background: isSel ? '#2563eb' : '#f1f5ff',
                                    border: isSel ? 'none' : '1px solid #e0e7ff',
                                  }}>
                                  <Icon size={22} strokeWidth={1.6} className={m.featured || isSel ? 'text-white' : 'text-blue-500'} />
                                </div>
                                <p className={`font-semibold text-xs leading-tight ${isSel || m.featured ? 'text-blue-800' : 'text-gray-700'}`}>{m.label}</p>
                                <p className="text-gray-400 text-[10px] mt-0.5 leading-tight">{m.sub}</p>
                              </motion.button>
                            )
                          })}
                        </div>

                        <button className="confirm-btn" disabled={!selected} onClick={confirmMethod}
                          style={!selected ? { opacity:0.4, cursor:'not-allowed' } : {}}>
                          {selected === 'facial' ? <><Scan size={16}/> Iniciar Verificación Facial</> : <><CheckCircle size={16}/> Confirmar Pago</>}
                          <ChevronRight size={16} />
                        </button>
                      </motion.div>
                    )}

                    {/* ── Facial camera ── */}
                    {modal === 'facial' && (
                      <motion.div key="facial"
                        initial={{ opacity:0, x:16 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:16 }} transition={{ duration:0.22 }}>
                        <div className="flex items-center gap-3 mb-4">
                          <motion.button onClick={() => setModal('select')} whileTap={{ scale:0.9 }}
                            className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 hover:text-gray-700 transition-colors"
                            style={{ background:'#f3f4f6', border:'1px solid #e5e7eb' }}>
                            <ArrowLeft size={15} />
                          </motion.button>
                          <div className="flex-1">
                            <p className="text-gray-400 text-[10px] uppercase tracking-widest font-semibold">Pago Biométrico</p>
                            <h2 className="font-display font-bold text-lg text-gray-900">Verificación Facial</h2>
                          </div>
                          <div className="text-right">
                            <p className="text-gray-400 text-xs">Total</p>
                            <p className="text-blue-700 font-bold">${total.toFixed(2)}</p>
                          </div>
                        </div>
                        <FacialCamera
                          onVerified={(user) => triggerSuccess('Reconocimiento Facial', user)}
                          onCancel={() => setModal('select')}
                          lightTheme
                        />
                      </motion.div>
                    )}

                    {/* ── Success ── */}
                    {modal === 'success' && (
                      <motion.div key="success" className="flex flex-col items-center text-center py-4 gap-4"
                        initial={{ opacity:0, scale:0.85 }} animate={{ opacity:1, scale:1 }}
                        transition={{ type:'spring', stiffness:260, damping:20 }}>

                        <motion.div className="w-18 h-18 w-[72px] h-[72px] rounded-full flex items-center justify-center"
                          style={{ background:'linear-gradient(135deg,#059669,#10b981)', boxShadow:'0 0 32px rgba(16,185,129,0.35)' }}
                          initial={{ scale:0 }} animate={{ scale:1 }}
                          transition={{ type:'spring', stiffness:280, damping:18, delay:0.1 }}>
                          <CheckCircle size={36} className="text-white" strokeWidth={2} />
                        </motion.div>

                        <div>
                          <h3 className="font-display font-bold text-2xl text-gray-900">¡Pago Exitoso!</h3>
                          {verifiedUser ? (
                            <p className="text-gray-400 text-sm mt-1">
                              Bienvenido, <span className="text-blue-600 font-semibold">{verifiedUser.nombres} {verifiedUser.apellidos}</span>
                            </p>
                          ) : (
                            <p className="text-gray-400 text-sm mt-1">Transacción procesada de forma segura.</p>
                          )}
                        </div>

                        <div className="w-full rounded-2xl p-4 text-left" style={{ background:'#f8faff', border:'1px solid #e5edff' }}>
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-gray-400 text-xs uppercase tracking-widest font-medium">Monto</span>
                            <span className="text-gray-900 font-bold text-lg">${total.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-gray-400 text-xs uppercase tracking-widest font-medium">Método</span>
                            <span className="text-blue-700 text-sm font-semibold">{paidWith}</span>
                          </div>
                          {verifiedUser && (
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-gray-400 text-xs uppercase tracking-widest font-medium">ID Usuario</span>
                              <span className="font-mono text-gray-700 text-xs font-semibold">{verifiedUser.id}</span>
                            </div>
                          )}
                          <div className="flex justify-between items-center">
                            <span className="text-gray-400 text-xs uppercase tracking-widest font-medium">Ref.</span>
                            <span className="font-mono text-gray-500 text-xs">{payRef}</span>
                          </div>
                        </div>

                        <motion.p className="text-gray-300 text-xs"
                          animate={{ opacity:[1,0.4,1] }} transition={{ duration:1.5, repeat:Infinity }}>
                          Cerrando automáticamente...
                        </motion.p>
                      </motion.div>
                    )}

                  </AnimatePresence>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>

      {/* ── Scanners ── */}
      {showScanner && (
        <BarcodeScanner onScanned={handleScanned} onClose={() => setShowScanner(false)} />
      )}
      {showCatalog && (
        <CatalogQR onClose={() => setShowCatalog(false)} />
      )}
      {showRegisterQR && (
        <div className="fixed inset-0 z-50 flex flex-col" style={{ background: '#f0f4fb' }}>
          {/* Header */}
          <div className="surface-strong flex items-center justify-between px-4 py-3 flex-shrink-0"
            style={{ borderBottom: '1px solid rgba(37,99,235,0.08)' }}>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg,#10b981,#059669)' }}>
                <Smartphone size={15} className="text-white" />
              </div>
              <div>
                <p className="text-gray-400 text-[10px] uppercase tracking-widest font-medium">Registro Biométrico</p>
                <h2 className="font-display font-bold text-base text-gray-900">Registrar Rostro (Celular)</h2>
              </div>
            </div>
            <motion.button onClick={() => setShowRegisterQR(false)} whileTap={{ scale: 0.9 }}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-400"
              style={{ background: '#f3f4f6', border: '1px solid #e5e7eb' }}>
              <X size={15} />
            </motion.button>
          </div>

          {/* QR Container */}
          <div className="flex-1 flex flex-col items-center justify-center px-6 text-center gap-6">
            <div className="bg-white rounded-3xl p-6 shadow-xl border border-emerald-100/50 flex flex-col items-center gap-2">
              <QRCodeSVG
                value={registerUrl}
                size={220}
                bgColor="#ffffff"
                fgColor="#065f46"
                level="H"
                includeMargin
              />
              <span className="font-mono text-emerald-800 text-xs font-semibold bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
                {registerUrl}
              </span>
            </div>

            <div className="max-w-md flex flex-col gap-2">
              <h3 className="font-display font-bold text-lg text-gray-950">Escanea para iniciar el KYC</h3>
              <p className="text-gray-500 text-sm leading-relaxed">
                1. Asegúrate de que tu celular tenga acceso a Internet (datos móviles o Wi-Fi).<br />
                2. Escanea este código QR con la cámara de tu celular para abrir el portal de registro en la nube.<br />
                3. Completa tus datos y realiza la captura biométrica de tu rostro.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
