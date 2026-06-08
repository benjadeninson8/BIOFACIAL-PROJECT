import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Users, Shield, Server, RefreshCw } from 'lucide-react'

interface UserData {
  id: string
  nombres: string
  apellidos: string
  cedula: string
  registeredAt: string
}

export default function AdminDashboard() {
  const [users, setUsers] = useState<UserData[]>([])
  const [loading, setLoading] = useState(true)

  const fetchUsers = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/users`)
      const data = await res.json()
      if (data.success) {
        // Sort newest first
        const sorted = data.users.sort((a: any, b: any) => new Date(b.registeredAt).getTime() - new Date(a.registeredAt).getTime())
        setUsers(sorted)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
    // Auto-refresh every 2 seconds for real-time feel
    const interval = setInterval(fetchUsers, 2000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="min-h-screen bg-[#0B1121] text-slate-200 p-8 font-sans">
      <div className="max-w-6xl mx-auto">
        <header className="flex items-center justify-between mb-10 border-b border-slate-800 pb-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
              <Server size={24} className="text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">SPCD Admin Monitor</h1>
              <p className="text-sm text-slate-400">Live Database Overview</p>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/20 px-4 py-2 rounded-full">
            <RefreshCw size={14} className="text-emerald-400 animate-spin-slow" />
            <span className="text-emerald-400 text-sm font-semibold tracking-wide">LIVE SYNC</span>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-6 flex flex-col justify-center">
            <div className="flex items-center gap-3 text-slate-400 mb-2">
              <Users size={18} />
              <span className="text-sm font-semibold uppercase tracking-wider">Total Registros</span>
            </div>
            <span className="text-4xl font-bold text-white">{users.length}</span>
          </div>
          <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-6 flex flex-col justify-center">
            <div className="flex items-center gap-3 text-slate-400 mb-2">
              <Shield size={18} />
              <span className="text-sm font-semibold uppercase tracking-wider">Seguridad Biométrica</span>
            </div>
            <span className="text-xl font-bold text-emerald-400">AES-256 Activo</span>
          </div>
        </div>

        <div className="bg-slate-800/40 border border-slate-700/50 rounded-3xl overflow-hidden shadow-2xl">
          <div className="px-6 py-4 border-b border-slate-700/50 bg-slate-800/80">
            <h2 className="font-semibold text-white">Últimos Usuarios Registrados</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-900/50 text-slate-400 text-xs uppercase tracking-wider">
                  <th className="px-6 py-4 font-semibold">Cliente</th>
                  <th className="px-6 py-4 font-semibold">Cédula</th>
                  <th className="px-6 py-4 font-semibold">ID Sistema</th>
                  <th className="px-6 py-4 font-semibold">Fecha de Registro</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {users.map(u => (
                  <motion.tr 
                    key={u.id} 
                    initial={{ opacity: 0, y: -10 }} 
                    animate={{ opacity: 1, y: 0 }}
                    className="hover:bg-slate-700/20 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-xs">
                          {u.nombres[0]}{u.apellidos[0]}
                        </div>
                        <span className="font-medium text-white">{u.nombres} {u.apellidos}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-300 font-mono">{u.cedula}</td>
                    <td className="px-6 py-4 text-slate-400 text-sm">{u.id}</td>
                    <td className="px-6 py-4 text-slate-400 text-sm">
                      {new Date(u.registeredAt).toLocaleString()}
                    </td>
                  </motion.tr>
                ))}
                {users.length === 0 && !loading && (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                      No hay usuarios registrados aún en la base de datos.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
