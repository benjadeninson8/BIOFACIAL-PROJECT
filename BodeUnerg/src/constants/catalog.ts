import type { Product } from '../components/ProductRow'

export const CATALOG: Record<string, Omit<Product, 'qty'>> = {
  'UNERG-001': { id: 1, name: 'Tabaco Premium',     price: 12.50, emoji: '🚬', category: 'Tabaquería',   accent: '#6366f1' },
  'UNERG-002': { id: 2, name: 'Whiskey Reserva',    price: 45.00, emoji: '🥃', category: 'Licorería',    accent: '#f59e0b' },
  'UNERG-003': { id: 3, name: 'Hielo Artesanal',    price: 3.75,  emoji: '🧊', category: 'Refrigerados', accent: '#0ea5e9' },
  'UNERG-004': { id: 4, name: 'Maní Tostado',       price: 2.50,  emoji: '🥜', category: 'Snacks',       accent: '#10b981' },
  'UNERG-005': { id: 5, name: 'Cerveza Artesanal',  price: 8.00,  emoji: '🍺', category: 'Licorería',    accent: '#f59e0b' },
  'UNERG-006': { id: 6, name: 'Agua Mineral 1L',    price: 1.50,  emoji: '💧', category: 'Bebidas',      accent: '#0ea5e9' },
  'UNERG-007': { id: 7, name: 'Café Expreso',        price: 4.00,  emoji: '☕', category: 'Bebidas',      accent: '#92400e' },
  'UNERG-008': { id: 8, name: 'Chocolates Surtidos', price: 6.50,  emoji: '🍫', category: 'Snacks',       accent: '#10b981' },
}
