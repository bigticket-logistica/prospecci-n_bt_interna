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
import { esMovil } from './ArmazonMovil'

// En el teléfono la fecha va corta, como en cualquier bandeja: "Hoy, 09:12",
// "Ayer, 18:40" o "30 sep, 09:12".
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
function cuandoCorto(v) {
  if (!v) return ''
  const d = new Date(v), hoy = new Date()
  const h = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  const mismo = (a, b) => a.toDateString() === b.toDateString()
  const ayer = new Date(hoy); ayer.setDate(hoy.getDate() - 1)
  if (mismo(d, hoy)) return `Hoy, ${h}`
  if (mismo(d, ayer)) return `Ayer, ${h}`
  return `${d.getDate()} ${MESES[d.getMonth()]}, ${h}`
}

// A qué pantalla lleva cada mensaje, con el verbo de su categoría.
// Maqueta 8.9.6: "Ver reclamo", "Ver facturación", "Ver certificación".
const BOTON = {
  reclamos: 'Ver reclamo',
  descuentos: 'Ver reclamo', movimientos: 'Ver movimiento', facturacion: 'Ver facturación',
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

// Fecha corta estilo Outlook (Maqueta 8.9.6): hoy solo la hora ("9:12"), en
// los últimos 7 días el día abreviado y la hora ("Mar 16:35"), y antes la
// fecha ("29/09/2026"). La fecha completa va en el tooltip.
const DIAS_CORTOS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
export function fechaOutlook(v) {
  if (!v) return ''
  const d = new Date(v), hoy = new Date()
  const hh = `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
  const dia = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const dias = Math.floor((dia(hoy) - dia(d)) / 864e5)
  if (dias === 0) return hh
  if (dias < 7) return `${DIAS_CORTOS[d.getDay()]} ${hh}`
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

// Fecha completa del tooltip (Maqueta 8.9.8): "miércoles 30/09/2026 09:12 a. m.".
const DIAS_LARGOS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
export function fechaCompleta(v) {
  if (!v) return ''
  const d = new Date(v), dos = (x) => String(x).padStart(2, '0')
  const h12 = d.getHours() % 12 || 12
  return `${DIAS_LARGOS[d.getDay()]} ${dos(d.getDate())}/${dos(d.getMonth() + 1)}/${d.getFullYear()} ${dos(h12)}:${dos(d.getMinutes())} ${d.getHours() < 12 ? 'a. m.' : 'p. m.'}`
}

// El monto del mensaje va destacado: "$1,600" en 800 y 17 px.
export function conMonto(texto) {
  const t = String(texto || '')
  const m = t.match(/\$\s?[\d.,]+/)
  if (!m) return t
  return <>{t.slice(0, m.index)}<strong className="msg-amount">{m[0]}</strong>{t.slice(m.index + m[0].length)}</>
}

const CATEGORIAS = ['Mi billetera', 'Facturación', 'Mi operación', 'Certificación']

const SobreCerrado = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3.5 6.5 8.5 6.5 8.5-6.5" />
  </svg>
)
const SobreAbierto = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 10v9a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-9" /><path d="M3 10l9-7 9 7" /><path d="m3 10 9 6 9-6" />
  </svg>
)

export default function Mensajes({ tercero, onIr }) {
  const [filas, setFilas] = useState(null)
  const [solapa, setSolapa] = useState('todos')
  const [categoria, setCategoria] = useState('todas')
  const [error, setError] = useState('')
  const [trabajando, setTrabajando] = useState(false)

  const cargar = useCallback(async () => {
    if (!tercero?.tercero_id) return
    const { data, error } = await supabase.from('notificaciones_tercero')
      .select('id, tipo, clase, categoria, titulo, detalle, estilo, etiqueta, destino, ref_id, evento_at, vence_at, urgente_desde, leida_at')
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
  const movil = esMovil()

  const abrir = (n) => {
    if (!n.leida_at) {
      marcarLeida(n.id)
      setFilas(p => (p || []).map(x => x.id === n.id ? { ...x, leida_at: new Date().toISOString() } : x))
    }
    // El mensaje lleva su fecha: si habla de la jornada del 24, Movimientos
    // tiene que abrirse en esa semana y no en la actual.
    if (onIr && n.destino) onIr(n.destino, n.ref_id || null)
  }

  // El sobre alterna leído / no leído sin abrir el mensaje.
  const alternar = async (e, n) => {
    e.stopPropagation()
    if (!n.leida_at) {
      marcarLeida(n.id)
      setFilas(p => (p || []).map(x => x.id === n.id ? { ...x, leida_at: new Date().toISOString() } : x))
    } else {
      setFilas(p => (p || []).map(x => x.id === n.id ? { ...x, leida_at: null } : x))
      supabase.rpc('fn_portal_marcar_no_leida', { p_id: n.id }).then(() => {}, () => {})
    }
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
        {!movil && (
          <>
            <button className="rc-volver" onClick={() => window.dispatchEvent(new Event('bt:atras'))}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
                strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
              Volver
            </button>
            <span className="rc-sep" aria-hidden="true" />
          </>
        )}
        <a href="#" onClick={e => { e.preventDefault(); onIr && onIr('home') }}>Inicio</a>
        {movil ? <span>›</span> : <svg className="ms-chev" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>}
        <span className="on" aria-current="page">Mis mensajes</span>
      </nav>

      <h1 className="bt-titulo">Mis mensajes</h1>

      {error && <div className="dx-error">{error}</div>}

      <div className={`ms-filtros${movil ? ' movil' : ''}`}>
        <div className="ms-solapas">
          {[['todos', 'Todos'], ['nuevos', movil && sinLeer ? `No leídos (${sinLeer})` : 'No leídos']].map(([k, l]) => (
            <button key={k} className={solapa === k ? 'on' : ''} onClick={() => setSolapa(k)}>{l}</button>
          ))}
        </div>

        <span className="ms-cat-caja">
          <select className="ms-cat" value={categoria} onChange={e => setCategoria(e.target.value)}>
            <option value="todas">Todas las categorías</option>
            {(movil ? categorias : CATEGORIAS).map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          {!movil && (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#002E5D" strokeWidth="3"
              strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 9l7 7 7-7" /></svg>
          )}
        </span>

        {movil && sinLeer > 0 && (
          <button className="ms-todo" onClick={marcarTodo} disabled={trabajando}>
            {trabajando ? 'Marcando…' : 'Marcar todo como leído'}
          </button>
        )}
      </div>

      {filas === null ? (
        <div className="bt-vacio"><h3>Cargando…</h3></div>
      ) : visibles.length === 0 ? (
        <div className="bt-vacio">
          <h3>{solapa === 'nuevos' ? 'No tienes mensajes sin leer.' : 'Todavía no tienes mensajes'}</h3>
          <p>
            Aquí llegan los avisos sobre tus pagos, tus facturas, tus descuentos y tus
            certificaciones.
          </p>
        </div>
      ) : (
        <div className={movil ? '' : 'msg-list'} style={movil ? { display: 'flex', flexDirection: 'column', gap: 10 } : undefined}>
          {movil ? visibles.map(n => (
            <button key={n.id} className={`ms-tarjeta ${n.leida_at ? 'leido' : 'sin-leer'}`} onClick={() => abrir(n)}>
              <span className={`ms-marca e-${n.pastilla.estilo}`} aria-hidden="true" />
              <span className="ms-cuerpo">
                <span className="ms-arriba">
                  <span className="ms-cat-t">{n.categoria || 'Mis mensajes'}</span>
                  <span className="ms-cuando">{cuandoCorto(n.evento_at)}</span>
                </span>
                <span className="ms-texto">{n.titulo}</span>
                {n.detalle && <span className="ms-detalle">{n.detalle}</span>}
                <span className="ms-ir">{BOTON[n.destino] || 'Ver'} ›</span>
              </span>
            </button>
          )) : visibles.map(n => {
            const sin = !n.leida_at
            return (
              <div key={n.id} className={`msg ${sin ? 'is-unread' : 'is-read'}`}>
                <span className="dot" aria-hidden="true" />
                <div className="msg-cuerpo">
                  <span className="msg-category">{n.categoria || 'Mis mensajes'}</span>
                  <div className="msg-row">
                    <span className="msg-text">{conMonto(n.titulo)}</span>
                    {/* Maqueta 8.9.8: el sobre va sobre la fecha y se ve siempre. */}
                    <span className="msg-date-caja">
                      <button className="msg-env" onClick={e => alternar(e, n)}
                        aria-label={sin ? 'Marcar como leído' : 'Marcar como no leído'} title={sin ? 'Marcar como leído' : 'Marcar como no leído'}>
                        {sin ? <SobreCerrado /> : <SobreAbierto />}
                      </button>
                      <span className="msg-date" title={fechaCompleta(n.evento_at)}>{fechaOutlook(n.evento_at)}</span>
                    </span>
                  </div>
                  {n.detalle && <span className="msg-body">{n.detalle}</span>}
                </div>
                <button className="msg-cta" onClick={() => abrir(n)}>{BOTON[n.destino] || 'Ver'}</button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
