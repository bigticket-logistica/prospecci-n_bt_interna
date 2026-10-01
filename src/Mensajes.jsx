// ═══════════════════════════════════════════════════════════════════════════
// Mensajes.jsx — La bandeja del tercero.
//
// Son las mismas notificaciones que aparecen en el Inicio, pero con su
// historial completo: el Inicio muestra lo que importa hoy y esto guarda lo
// que ya pasó. Cada mensaje lleva su categoría, su fecha y el botón que abre
// la pantalla donde se resuelve.
//
// No es Consultas: acá no se escribe. Las preguntas las responde Biggy.
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from './supabaseClient'
import { pastillaDe, marcarLeida } from './notificaciones'

// A qué pantalla lleva cada mensaje, con el verbo de su categoría.
const BOTON = {
  descuentos: 'Ver reclamo', movimientos: 'Ver movimiento', facturacion: 'Ver prefactura',
  facturado: 'Ver factura', pagado: 'Ver pago', estado: 'Ver certificación',
  firma: 'Ver contrato', docs: 'Ver documentos', perfil: 'Ver perfil',
  flota: 'Ver flota', consultas: 'Ver mensaje', postula: 'Ver campañas',
}

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const MESES2 = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12']

// "miércoles 30/09/2026 09:12 a. m."
function cuando(v) {
  if (!v) return ''
  const d = new Date(v)
  const h = d.getHours() % 12 || 12
  const ap = d.getHours() < 12 ? 'a. m.' : 'p. m.'
  return `${DIAS[d.getDay()]} ${String(d.getDate()).padStart(2, '0')}/${MESES2[d.getMonth()]}/${d.getFullYear()} ` +
    `${String(h).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} ${ap}`
}

export default function Mensajes({ tercero, onIr }) {
  const [filas, setFilas] = useState(null)
  const [solapa, setSolapa] = useState('todos')
  const [categoria, setCategoria] = useState('todas')
  const [error, setError] = useState('')
  const [trabajando, setTrabajando] = useState(false)

  const cargar = useCallback(async () => {
    if (!tercero?.tercero_id) return
    const { data, error } = await supabase.from('notificaciones_tercero')
      .select('id, tipo, clase, categoria, titulo, detalle, estilo, etiqueta, destino, evento_at, vence_at, urgente_desde, leida_at')
      .eq('tercero_id', tercero.tercero_id)
      .order('evento_at', { ascending: false })
      .limit(200)
    if (error) { setError('No pudimos cargar tus mensajes. Vuelve a intentarlo en un momento.'); setFilas([]); return }
    setFilas((data || []).map(n => ({ ...n, pastilla: pastillaDe(n) })))
  }, [tercero])

  useEffect(() => { cargar() }, [cargar])

  const categorias = useMemo(() => {
    const c = new Set((filas || []).map(f => f.categoria).filter(Boolean))
    return [...c].sort()
  }, [filas])

  const visibles = useMemo(() => (filas || []).filter(f =>
    (solapa === 'todos' || !f.leida_at) &&
    (categoria === 'todas' || f.categoria === categoria)), [filas, solapa, categoria])

  const sinLeer = (filas || []).filter(f => !f.leida_at).length

  const abrir = (n) => {
    if (!n.leida_at) {
      marcarLeida(n.id)
      setFilas(p => (p || []).map(x => x.id === n.id ? { ...x, leida_at: new Date().toISOString() } : x))
    }
    if (onIr && n.destino) onIr(n.destino)
  }

  const marcarTodo = async () => {
    const pendientes = (filas || []).filter(f => !f.leida_at)
    if (!pendientes.length) return
    setTrabajando(true)
    const ahora = new Date().toISOString()
    // Una por una con la misma función que usa el resto del portal: así nadie
    // puede marcar como leído lo que no es suyo.
    await Promise.all(pendientes.map(n => supabase.rpc('fn_portal_marcar_leida', { p_id: n.id })))
    setFilas(p => (p || []).map(x => x.leida_at ? x : { ...x, leida_at: ahora }))
    setTrabajando(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <nav className="ms-ruta">
        <a href="#" onClick={e => { e.preventDefault(); onIr && onIr('home') }}>Inicio</a>
        <span>›</span>
        <span className="on">Mis mensajes</span>
      </nav>

      <h1 className="bt-titulo">Mis mensajes</h1>

      {error && <div className="dx-error">{error}</div>}

      <div className="ms-filtros">
        <div className="ms-solapas">
          {[['todos', 'Todos'], ['nuevos', `No leídos${sinLeer ? ` (${sinLeer})` : ''}`]].map(([k, l]) => (
            <button key={k} className={solapa === k ? 'on' : ''} onClick={() => setSolapa(k)}>{l}</button>
          ))}
        </div>

        <select className="ms-cat" value={categoria} onChange={e => setCategoria(e.target.value)}>
          <option value="todas">Todas las categorías</option>
          {categorias.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        {sinLeer > 0 && (
          <button className="ms-todo" onClick={marcarTodo} disabled={trabajando}>
            {trabajando ? 'Marcando…' : 'Marcar todo como leído'}
          </button>
        )}
      </div>

      {filas === null ? (
        <div className="bt-vacio"><h3>Cargando…</h3></div>
      ) : visibles.length === 0 ? (
        <div className="bt-vacio">
          <h3>{solapa === 'nuevos' ? 'No tienes mensajes sin leer' : 'Todavía no tienes mensajes'}</h3>
          <p>
            Aquí llegan los avisos sobre tus pagos, tus facturas, tus descuentos y tus
            certificaciones.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {visibles.map(n => (
            <div key={n.id} className={`ms-item${n.leida_at ? ' leido' : ''}`}>
              <span className={`ms-punto e-${n.pastilla.estilo}`} aria-hidden="true" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="ms-cat-t">{n.categoria || 'Mis mensajes'}</div>
                <div className="ms-titulo">{n.titulo}</div>
                {n.detalle && <div className="ms-detalle">{n.detalle}</div>}
              </div>
              <div className="ms-fecha">{cuando(n.evento_at)}</div>
              <button className="ms-ver" onClick={() => abrir(n)}>
                {BOTON[n.destino] || 'Ver'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
