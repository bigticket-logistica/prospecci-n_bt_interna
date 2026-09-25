// ═══════════════════════════════════════════════════════════════════════════
// Armazon.jsx — Cabecera, menú lateral e Inicio, replicados de la maqueta de
// marketing (Maqueta7 - Portal Transportista).
//
// Las medidas, colores y tipografías salen tal cual del HTML de la maqueta.
// Cuando algo se aparta de ella es porque la maqueta no lo cubre:
//   · el desplegable de la campana y el de la empresa (la maqueta solo dibuja
//     los botones; acá hace falta ver los pendientes y poder cerrar sesión)
//   · el menú en teléfono, que la maqueta no diseñó
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from './supabaseClient'

const LOGO = '/logo-bigticket-blanco.png'

// ── Menú ─────────────────────────────────────────────────────────────────
// Lista de la maqueta (menuDefs). `v` es la vista del portal que abre cada
// submenú; las que no tienen pantalla todavía abren EnConstruccion.
const MENU = [
  { key: 'inicio', label: 'Inicio', v: 'home', items: [] },
  { key: 'billetera', label: 'Mi billetera', pagos: true, items: [
    { v: 'movimientos', title: 'Movimientos', desc: 'Detalle diario de rutas' },
    { v: 'descuentos', title: 'Descuentos', desc: 'Paquete no devuelto, multas, No Show' },
  ] },
  { key: 'facturacion', label: 'Facturación', pagos: true, items: [
    { v: 'facturacion', title: 'Por facturar', desc: 'Prefacturas, carga de facturas' },
    { v: 'facturado', title: 'Facturado', desc: 'Facturas cargadas en validación' },
    { v: 'pagado', title: 'Pagado', desc: 'Facturas pagadas y depósitos' },
  ] },
  { key: 'operacion', label: 'Mi operación', items: [
    { v: 'flota', title: 'Mi Flota', desc: 'Vehículos y personal activos' },
    { v: 'desempeno', title: 'Desempeño', desc: 'Indicadores de nivel de servicio' },
    { v: 'reclamos', title: 'Reclamos', desc: 'Paquetes no recibidos o con diferencia', rojo: true },
  ] },
  { key: 'certificacion', label: 'Certificación', items: [
    { v: 'certificar', title: 'Certificar vehículo y personas', desc: 'Dar de alta conductor, ayudante o vehículo' },
    { v: 'estado', title: 'Estado de certificación', desc: 'Avance de cada trámite y qué documentos faltan' },
    { v: 'firma', title: 'Firma de contrato', desc: 'Firma digitalmente' },
    { v: 'baja', title: 'Solicitar baja', desc: 'Retira un vehículo o persona que ya no opera' },
  ] },
  { key: 'empresa', label: 'Mi empresa', items: [
    { v: 'perfil', title: 'Perfil y cuenta bancaria', desc: 'Tus datos y la cuenta donde recibes los pagos' },
    { v: 'docs', title: 'Documentos', desc: 'Contratos, seguros y anexos' },
  ] },
]

// Qué grupo queda marcado según la pantalla abierta. Las vistas que no están en
// el menú (formularios de certificación, consultas, postula) marcan a su grupo.
const GRUPO_DE = {
  home: 'inicio',
  movimientos: 'billetera', descuentos: 'billetera',
  facturacion: 'facturacion', facturado: 'facturacion', pagado: 'facturacion',
  flota: 'operacion', desempeno: 'operacion', reclamos: 'operacion',
  certificar: 'certificacion', estado: 'certificacion', firma: 'certificacion', baja: 'certificacion',
  conductor: 'certificacion', ayudante: 'certificacion', vehiculo: 'certificacion',
  perfil: 'empresa', docs: 'empresa', consultas: 'empresa',
}

// Adónde lleva cada tipo de pendiente de la campana.
const DESTINO = {
  firma_contrato: 'firma', firma_anexo: 'firma',
  actualizacion_datos: 'perfil', documento_pendiente: 'docs', otro: 'consultas',
}

const Chevron = ({ size = 13, color = 'currentColor', w = 2.5, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={w}
    strokeLinecap="round" strokeLinejoin="round" style={style}><path d="M6 9l6 6 6-6" /></svg>
)

// ── Shell ────────────────────────────────────────────────────────────────
export function Shell({ tercero, email, vista, onNavegar, contadores = {}, children }) {
  const [abierto, setAbierto] = useState(null)       // grupo desplegado en el menú
  const [panel, setPanel] = useState(null)           // 'campana' | 'empresa' | null
  const [menuMovil, setMenuMovil] = useState(false)
  const [campana, setCampana] = useState(null)
  const [pendientes, setPendientes] = useState(null)

  useEffect(() => {
    if (!tercero?.tercero_id) return
    const leer = async () => {
      const { data } = await supabase.from('vw_campana_tercero')
        .select('mensajes_sin_leer, solicitudes_pendientes, total')
        .eq('tercero_id', tercero.tercero_id).maybeSingle()
      setCampana(data || null)
    }
    leer()
    const t = setInterval(() => { if (!document.hidden) leer() }, 60000)
    return () => clearInterval(t)
  }, [tercero])

  const abrirCampana = async () => {
    if (panel === 'campana') { setPanel(null); return }
    setPanel('campana')
    const { data } = await supabase.from('solicitudes_tercero')
      .select('id, tipo, titulo, estado, solicitado_at')
      .eq('tercero_id', tercero.tercero_id)
      .in('estado', ['pendiente', 'avisado', 'escalado'])
      .order('solicitado_at', { ascending: true })
    setPendientes(data || [])
  }

  // Igual que la maqueta: navegar cierra cualquier grupo abierto.
  const ir = (v) => {
    setAbierto(null); setPanel(null); setMenuMovil(false)
    onNavegar(v)
    window.scrollTo(0, 0)
  }

  const activo = GRUPO_DE[vista] || 'inicio'
  const grupos = MENU.filter(g => !g.pagos || tercero?.pagosHabilitados)
  const total = campana?.total || 0

  return (
    <div className="bt-shell">
      <header className="bt-header">
        <div className="bt-marca">
          <button className="bt-hamburguesa" aria-label="Abrir menú" onClick={() => setMenuMovil(true)}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
              <path d="M4 7h16M4 12h16M4 17h16" /></svg>
          </button>
          <img src={LOGO} alt="Bigticket" className="bt-logo" />
          <span className="bt-sep" />
          <span className="bt-rotulo">Portal Transportista</span>
        </div>

        <div className="bt-acciones">
          <div className="bt-pos">
            <button className="bt-campana" aria-label="Notificaciones" onClick={abrirCampana}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F4F3F3" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              {total > 0 && <span className="bt-campana-n">{total > 99 ? '99+' : total}</span>}
            </button>
            {panel === 'campana' && (
              <Desplegable onCerrar={() => setPanel(null)} ancho={330}>
                <div className="bt-desp-titulo">Tus pendientes</div>
                {campana?.mensajes_sin_leer > 0 && (
                  <button className="bt-desp-item" onClick={() => ir('consultas')}>
                    <span className="t">{campana.mensajes_sin_leer} {campana.mensajes_sin_leer === 1 ? 'mensaje' : 'mensajes'} de Bigticket sin leer</span>
                    <span className="d">Léelos y respóndelos en Consultas</span>
                  </button>
                )}
                {pendientes === null
                  ? <div className="bt-desp-vacio">Cargando…</div>
                  : pendientes.map(p => (
                    <button key={p.id} className={`bt-desp-item${p.estado === 'escalado' ? ' urgente' : ''}`}
                      onClick={() => ir(DESTINO[p.tipo] || 'consultas')}>
                      <span className="t">{p.titulo}</span>
                      <span className="d">{p.estado === 'escalado' ? 'Urgente: afecta el pago de tus servicios'
                        : p.estado === 'avisado' ? 'Te enviamos un recordatorio' : 'Pendiente de tu parte'}</span>
                    </button>
                  ))}
                {pendientes !== null && pendientes.length === 0 && !(campana?.mensajes_sin_leer > 0) && (
                  <div className="bt-desp-vacio">Estás al día. No tienes mensajes ni pendientes.</div>
                )}
              </Desplegable>
            )}
          </div>

          <div className="bt-pos">
            <button className="bt-empresa" title={email}
              onClick={() => setPanel(panel === 'empresa' ? null : 'empresa')}>
              <span>{tercero.nombre}</span>
              <Chevron size={14} color="rgba(255,255,255,.7)" />
            </button>
            {panel === 'empresa' && (
              <Desplegable onCerrar={() => setPanel(null)} ancho={240}>
                <button className="bt-desp-item" onClick={() => ir('perfil')}>
                  <span className="t">Perfil y cuenta bancaria</span>
                  <span className="d">{email}</span>
                </button>
                <button className="bt-desp-item" onClick={() => supabase.auth.signOut()}>
                  <span className="t">Cerrar sesión</span>
                </button>
              </Desplegable>
            )}
          </div>
        </div>
      </header>

      <div className="bt-cuerpo">
        {menuMovil && <div className="bt-velo" onClick={() => setMenuMovil(false)} />}
        <aside className={`bt-lateral${menuMovil ? ' abierto' : ''}`}>
          <nav className="bt-nav">
            {grupos.map(g => {
              const on = activo === g.key
              const open = abierto === g.key
              const conSub = g.items.length > 0
              const nGrupo = g.items.reduce((s, i) => s + (contadores[i.v] || 0), 0)
              return (
                <div key={g.key} className="bt-grupo">
                  <button
                    className={`bt-grupo-btn${on ? ' on' : ''}${open ? ' open' : ''}`}
                    onClick={() => conSub ? setAbierto(open ? null : g.key) : ir(g.v)}>
                    <span className="bt-grupo-izq">
                      <span className="bt-barra" />
                      <span className="bt-grupo-label">{g.label}</span>
                      {nGrupo > 0 && <span className="bt-contador">{nGrupo}</span>}
                    </span>
                    {conSub && <Chevron style={{ flexShrink: 0, transition: 'transform .15s ease',
                      transform: `rotate(${open ? '180deg' : '0deg'})` }} />}
                  </button>
                  {open && (
                    <div className="bt-sub">
                      {g.items.map(i => {
                        const n = contadores[i.v] || 0
                        return (
                          <button key={i.v} className="bt-sub-btn" onClick={() => ir(i.v)}>
                            <div style={{ minWidth: 0 }}>
                              <div className="bt-sub-t">{i.title}</div>
                              <div className="bt-sub-d">{i.desc}</div>
                            </div>
                            {n > 0 && <span className="bt-sub-n" style={{ background: i.rojo ? '#C43D2F' : 'var(--navy)' }}>{n}</span>}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </nav>
        </aside>

        <main className="bt-main">{children}</main>
      </div>
    </div>
  )
}

function Desplegable({ onCerrar, ancho, children }) {
  return (
    <>
      <div onClick={onCerrar} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
      <div className="bt-desp" style={{ width: ancho }}>{children}</div>
    </>
  )
}

// ── Inicio ───────────────────────────────────────────────────────────────
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
  'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

const pesos = (n) => n === null || n === undefined ? '—'
  : (Number(n) < 0 ? '−$' : '$') + Math.abs(Number(n)).toLocaleString('es-MX', { maximumFractionDigits: 0 })
const entero = (n) => n === null || n === undefined ? '—' : Number(n).toLocaleString('es-MX', { maximumFractionDigits: 0 })
const pct = (n, dec) => n === null || n === undefined ? '—' : `${Number(n).toFixed(dec)}%`
const fechaDia = (iso) => { const d = new Date(iso + 'T12:00:00'); return `${d.getDate()} de ${MESES[d.getMonth()]}` }
const corta = (iso) => { const d = new Date(iso + 'T12:00:00'); return `${d.getDate()} ${MESES[d.getMonth()].slice(0, 3)}` }
const rango = (a, b) => a ? `${corta(a)} – ${corta(b || a)}` : ''
const mesLargo = (p) => { const [y, m] = String(p).split('-'); const t = MESES[Number(m) - 1]; return `${t.charAt(0).toUpperCase()}${t.slice(1)} ${y}` }

// Las vistas de resumen no tienen todavía rutas, devoluciones ni NS a
// domicilio con esos nombres; se toman si existen y si no se muestra "—".
const rutasDe = (r) => r?.rutas ?? r?.jornadas ?? null
const devolucionesDe = (r) => r?.devoluciones ?? null
const nsDomicilioDe = (r) => r?.ns_domicilio ?? null

export function Inicio({ tercero, perfilOk, onPick }) {
  const [dia, setDia] = useState(null)
  const [periodos, setPeriodos] = useState([])
  const [vista, setVista] = useState('semana')
  const [idx, setIdx] = useState(0)          // 0 = el período más reciente
  const [avisos, setAvisos] = useState([])

  const cargar = useCallback(async () => {
    if (!tercero?.tercero_id) return
    const id = tercero.tercero_id
    const [d, p, s, c] = await Promise.all([
      supabase.from('vw_portal_resumen_dia').select('*').eq('tercero_id', id)
        .order('fecha', { ascending: false }).limit(1),
      supabase.from('vw_portal_resumen_periodo').select('*').eq('tercero_id', id),
      supabase.from('solicitudes_tercero').select('id, tipo, titulo, estado, solicitado_at')
        .eq('tercero_id', id).in('estado', ['pendiente', 'avisado', 'escalado'])
        .order('solicitado_at', { ascending: true }),
      supabase.from('vw_campana_tercero').select('mensajes_sin_leer').eq('tercero_id', id).maybeSingle(),
    ])
    setDia((d.data || [])[0] || null)
    setPeriodos(p.data || [])
    const lista = (s.data || []).map(x => ({
      id: x.id,
      titulo: x.titulo,
      detalle: x.estado === 'escalado' ? 'Afecta el pago de tus servicios'
        : x.estado === 'avisado' ? 'Te enviamos un recordatorio' : 'Pendiente de tu parte',
      urgente: x.estado === 'escalado',
      etiqueta: x.estado === 'escalado' ? 'Urgente' : 'Pendiente',
      v: DESTINO[x.tipo] || 'consultas',
    }))
    const sinLeer = c.data?.mensajes_sin_leer || 0
    if (sinLeer > 0) lista.push({
      id: 'mensajes', v: 'consultas', urgente: false, etiqueta: 'Nuevo',
      titulo: `${sinLeer} ${sinLeer === 1 ? 'mensaje' : 'mensajes'} de Bigticket sin leer`,
      detalle: 'Léelos y respóndelos en Consultas',
    })
    setAvisos(lista)
  }, [tercero])

  useEffect(() => { cargar() }, [cargar])

  // Sin la cuenta de pago no se le paga: va primero y en rojo.
  const notificaciones = useMemo(() => [
    ...(perfilOk === false ? [{
      id: 'perfil', v: 'perfil', urgente: true, etiqueta: 'Urgente',
      titulo: 'Tu perfil de empresa está incompleto',
      detalle: 'Sin la cuenta de pago (banco, CLABE y su comprobante) no se realizan pagos a tu empresa',
    }] : []),
    ...avisos,
  ], [perfilOk, avisos])

  // Más reciente primero. Las semanas se ordenan como número: como texto, la 9
  // quedaría después de la 39.
  const lista = useMemo(() => periodos.filter(p => p.tipo === vista)
    .sort((a, b) => vista === 'semana'
      ? String(b.desde).localeCompare(String(a.desde))
      : String(b.periodo).localeCompare(String(a.periodo))), [periodos, vista])
  useEffect(() => { setIdx(0) }, [vista])
  const actual = lista[idx] || null
  const hayAnterior = idx < lista.length - 1
  const haySiguiente = idx > 0

  return (
    <>
      <h1 className="bt-hola">Hola, {tercero.nombre}</h1>

      {notificaciones.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <span className="bt-eyebrow">Notificaciones</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {notificaciones.map(n => (
              <button key={n.id} className={`bt-aviso${n.urgente ? ' urgente' : ''}`} onClick={() => onPick(n.v)}>
                <div style={{ minWidth: 0 }}>
                  <h3>{n.titulo}</h3>
                  <p>{n.detalle}</p>
                </div>
                <span className="bt-pill">{n.etiqueta}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {tercero.pagosHabilitados && (
        <div className="bt-tarjetas">
          <div className="bt-card bt-card-click" onClick={() => onPick('movimientos')}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '0 0 4px' }}>
              <h3 className="bt-card-t" style={{ margin: 0 }}>Movimiento diario</h3>
              <span className="bt-info">
                <span className="bt-info-i">i</span>
                <span className="bt-info-tip">Información actualizada al cierre del día anterior</span>
              </span>
            </div>
            <p className="bt-card-f">{dia ? fechaDia(dia.fecha) : 'Aún no hay jornadas publicadas'}</p>
            <Cifras monto={dia?.ganancia} rutas={rutasDe(dia)} datos={[
              [entero(dia?.entregas), 'Entregas'],
              [entero(devolucionesDe(dia)), 'Devoluciones'],
              [pct(dia?.ns, 1), 'Nivel servicio'],
              [pct(nsDomicilioDe(dia), 1), 'NS domicilio'],
            ]} />
          </div>

          <div className="bt-card">
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, margin: '0 0 16px' }}>
              <div>
                <h3 className="bt-card-t">{vista === 'semana' ? 'Movimiento semanal' : 'Movimiento mensual'}</h3>
                <div className="bt-periodo">
                  <button className="bt-flecha" aria-label={vista === 'semana' ? 'Semana anterior' : 'Mes anterior'}
                    disabled={!hayAnterior} onClick={() => setIdx(i => i + 1)}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6"
                      strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
                  </button>
                  <p className="bt-card-f" style={{ margin: 0, display: 'flex', gap: 10 }}>
                    {actual ? (
                      <>
                        <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{vista === 'semana' ? `Semana ${actual.periodo}` : mesLargo(actual.periodo)}</span>
                        <span style={{ whiteSpace: 'nowrap' }}>{rango(actual.desde, actual.hasta)}</span>
                      </>
                    ) : <span>Todavía no hay datos de este período</span>}
                  </p>
                  <button className="bt-flecha" aria-label={vista === 'semana' ? 'Semana siguiente' : 'Mes siguiente'}
                    disabled={!haySiguiente} onClick={() => setIdx(i => i - 1)}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6"
                      strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
                  </button>
                </div>
              </div>
              <div className="bt-toggle">
                {[['semana', 'Semana'], ['mes', 'Mes']].map(([k, l]) => (
                  <button key={k} className={vista === k ? 'on' : ''} onClick={() => setVista(k)}>{l}</button>
                ))}
              </div>
            </div>
            <Cifras monto={actual?.ganancia} rutas={rutasDe(actual)} datos={[
              [entero(actual?.entregas), 'Entregas'],
              [entero(devolucionesDe(actual)), 'Devoluciones'],
              [pct(actual?.ns, 0), 'Nivel servicio'],
              [pct(nsDomicilioDe(actual), 0), 'NS domicilio'],
            ]} />
          </div>
        </div>
      )}

      <div className="bt-cta">
        <div style={{ maxWidth: 520 }}>
          <h3>¿Tienes unidad disponible? Súmate al peak</h3>
          <p>Postula tu vehículo y toma rutas adicionales durante la temporada alta.</p>
        </div>
        <button onClick={() => onPick('postula')}>Postular mi unidad</button>
      </div>
    </>
  )
}

function Cifras({ monto, rutas, datos }) {
  return (
    <>
      <div className="bt-cifras">
        <div className="bt-monto">{pesos(monto)}</div>
        <div className="bt-rutas">
          <span className="n">{entero(rutas)}</span><span className="l">Rutas</span>
        </div>
      </div>
      <div style={{ overflow: 'hidden' }}>
        <div className="bt-datos">
          {datos.map(([v, l]) => (
            <div key={l}><div className="v">{v}</div><div className="l">{l}</div></div>
          ))}
        </div>
      </div>
    </>
  )
}

// ── Pantallas que marketing puso en el menú pero todavía no existen ─────────
const PENDIENTES = {
  desempeno: { grupo: 'Mi operación', titulo: 'Desempeño', texto: 'Aquí vas a ver el nivel de servicio, las entregas y las devoluciones de tus rutas, semana a semana.' },
  reclamos: { grupo: 'Mi operación', titulo: 'Reclamos', texto: 'Aquí vas a responder los paquetes no recibidos o con diferencia antes de que venza el plazo. Mientras tanto, levanta la diferencia desde Movimientos.' },
}

export function EnConstruccion({ vista, onBack }) {
  const p = PENDIENTES[vista] || { grupo: '', titulo: 'Próximamente', texto: '' }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <a href="#" className="bt-volver" onClick={e => { e.preventDefault(); onBack() }}>← Volver</a>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 13, color: 'var(--muted)' }}>{p.grupo}</span>
        <h1 className="bt-titulo">{p.titulo}</h1>
      </div>
      <div className="bt-vacio">
        <h3>Esta sección está en construcción</h3>
        <p>{p.texto}</p>
      </div>
    </div>
  )
}
