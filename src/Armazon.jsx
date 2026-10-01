// ═══════════════════════════════════════════════════════════════════════════
// Armazon.jsx — Cabecera, menú lateral e Inicio, replicados de la maqueta de
// marketing (Maqueta7 - Portal Transportista).
//
// Las medidas, colores y tipografías salen tal cual del HTML de la maqueta.
// Cuando algo se aparta de ella es porque la maqueta no lo cubre:
//   · el desplegable de la campana y el de la empresa (la maqueta solo dibuja
//     los botones; aquí hace falta ver los pendientes y poder cerrar sesión)
//   · el menú en teléfono, que la maqueta no diseñó
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from './supabaseClient'
import { cargarNotificaciones, marcarLeida, cuentaCampana } from './notificaciones'

const LOGO = '/logo-bigticket-blanco.png'

// ── Menú ─────────────────────────────────────────────────────────────────
// Lista de la maqueta (menuDefs). `v` es la vista del portal que abre cada
// submenú; las que no tienen pantalla todavía abren EnConstruccion.
const MENU = [
  { key: 'inicio', label: 'Inicio', v: 'home', items: [] },
  { key: 'mensajes', label: 'Mis mensajes', v: 'mensajes', naranja: true, items: [] },
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
    { v: 'reclamos', title: 'Reclamos', desc: 'Lo que todavía está en juego', rojo: true },
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
  mensajes: 'mensajes', consultas: 'mensajes',
  movimientos: 'billetera', descuentos: 'billetera',
  facturacion: 'facturacion', facturado: 'facturacion', pagado: 'facturacion',
  flota: 'operacion', desempeno: 'operacion', reclamos: 'operacion',
  certificar: 'certificacion', estado: 'certificacion', firma: 'certificacion', baja: 'certificacion',
  conductor: 'certificacion', ayudante: 'certificacion', vehiculo: 'certificacion',
  perfil: 'empresa', docs: 'empresa',
}


const Chevron = ({ size = 13, color = 'currentColor', w = 2.5, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={w}
    strokeLinecap="round" strokeLinejoin="round" style={style}><path d="M6 9l6 6 6-6" /></svg>
)

// ── Shell ────────────────────────────────────────────────────────────────
export function Shell({ tercero, email, vista, onNavegar, contadores = {}, children }) {
  const hoyMx = () => {
    const d = new Date()
    const f = new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'short', year: 'numeric',
      timeZone: 'America/Mexico_City' }).format(d).replace(/\./g, '')
    const h = new Intl.DateTimeFormat('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false,
      timeZone: 'America/Mexico_City' }).format(d)
    return `${f.replace(/ /g, '-')}, ${h} hrs`
  }
  const [abierto, setAbierto] = useState(null)       // grupo desplegado en el menú
  const [panel, setPanel] = useState(null)           // 'campana' | 'empresa' | null
  const [menuMovil, setMenuMovil] = useState(false)
  const [avisos, setAvisos] = useState(null)       // notificaciones del portal
  const [sinLeer, setSinLeer] = useState(0)          // mensajes de Consultas

  useEffect(() => {
    if (!tercero?.tercero_id) return
    const leer = async () => {
      const [lista, c] = await Promise.all([
        cargarNotificaciones(tercero.tercero_id),
        supabase.from('vw_campana_tercero').select('mensajes_sin_leer').eq('tercero_id', tercero.tercero_id).maybeSingle(),
      ])
      setAvisos(lista)
      setSinLeer(c.data?.mensajes_sin_leer || 0)
    }
    leer()
    const t = setInterval(() => { if (!document.hidden) leer() }, 60000)
    return () => clearInterval(t)
  }, [tercero])

  // En el teléfono el desplegable queda apretado: la campana lleva directo a
  // la bandeja, como pide la maqueta.
  const abrirCampana = () => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) { ir('mensajes'); return }
    setPanel(panel === 'campana' ? null : 'campana')
  }

  const abrirAviso = (n) => {
    if (!n.leida_at) {
      marcarLeida(n.id)
      setAvisos(prev => (prev || []).map(x => x.id === n.id ? { ...x, leida_at: new Date().toISOString() } : x))
    }
    ir(n.destino)
  }

  // Igual que la maqueta: navegar cierra cualquier grupo abierto.
  const ir = (v) => {
    setAbierto(null); setPanel(null); setMenuMovil(false)
    onNavegar(v)
    window.scrollTo(0, 0)
  }

  const activo = GRUPO_DE[vista] || 'inicio'
  const grupos = MENU.filter(g => !g.pagos || tercero?.pagosHabilitados)
  const total = cuentaCampana(avisos || []) + (sinLeer > 0 ? 1 : 0)

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
                <div className="bt-desp-titulo">Notificaciones</div>
                <div className="bt-desp-lista">
                  {sinLeer > 0 && (
                    <button className="bt-desp-item" onClick={() => ir('mensajes')}>
                      <span className="t">{sinLeer} {sinLeer === 1 ? 'mensaje' : 'mensajes'} de Bigticket sin leer</span>
                      <span className="d">Léelos y respóndelos en Consultas</span>
                    </button>
                  )}
                  {avisos === null
                    ? <div className="bt-desp-vacio">Cargando…</div>
                    : avisos.map(n => (
                      <button key={n.id} className={`bt-desp-item e-${n.pastilla.estilo}${n.leida_at && n.clase !== 'pendiente' ? ' leida' : ''}`}
                        onClick={() => abrirAviso(n)}>
                        <span className="t">{n.titulo}</span>
                        <span className="d">{n.pastilla.etiqueta}{n.detalle ? ` · ${n.detalle}` : ''}</span>
                      </button>
                    ))}
                  {avisos !== null && avisos.length === 0 && sinLeer === 0 && (
                    <div className="bt-desp-vacio">Estás al día. No tienes pendientes ni novedades.</div>
                  )}
                </div>
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

      {/* País y hora de México: el tercero y el analista pueden estar en husos
          distintos, así que la hora de referencia va siempre a la vista. */}
      <div className="bt-franja">
        <span>México</span><span>·</span><span>{hoyMx()}</span>
      </div>

      <div className="bt-cuerpo">
        {menuMovil && <div className="bt-velo" onClick={() => setMenuMovil(false)} />}
        <aside className={`bt-lateral${menuMovil ? ' abierto' : ''}`}>
          <nav className="bt-nav">
            {grupos.map(g => {
              const on = activo === g.key
              const open = abierto === g.key
              const conSub = g.items.length > 0
              const nGrupo = g.key === 'mensajes' ? sinLeer
                : g.items.reduce((s, i) => s + (contadores[i.v] || 0), 0)
              return (
                <div key={g.key} className="bt-grupo">
                  <button
                    className={`bt-grupo-btn${on ? ' on' : ''}${open ? ' open' : ''}`}
                    onClick={() => conSub ? setAbierto(open ? null : g.key) : ir(g.v)}>
                    <span className="bt-grupo-izq">
                      <span className="bt-barra" />
                      <span className="bt-grupo-label">{g.label}</span>
                      {nGrupo > 0 && (
                        <span className="bt-contador" style={{ background: g.naranja ? 'var(--orange)' : '#C43D2F' }}>
                          {nGrupo}
                        </span>
                      )}
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

// Hito cero del portal: nada anterior se muestra.
const HITO = '2026-09-14'
const isoDe = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

// La semana del Brain es la ISO + 1: la 39 va del lunes 14 al domingo 20 de
// septiembre de 2026. El rango sale del número de semana, no de las fechas que
// trae la vista, que son el primer y el último día con movimientos.
function limitesSemana(semana, referencia) {
  const anio = referencia ? Number(String(referencia).slice(0, 4)) : new Date().getFullYear()
  const cuatroEnero = new Date(anio, 0, 4)
  const lunesSemana1 = new Date(anio, 0, 4 - ((cuatroEnero.getDay() + 6) % 7))
  const lunes = new Date(lunesSemana1)
  lunes.setDate(lunes.getDate() + (Number(semana) - 2) * 7)
  const domingo = new Date(lunes)
  domingo.setDate(domingo.getDate() + 6)
  return { desde: isoDe(lunes), hasta: isoDe(domingo) }
}
function limitesMes(periodo) {
  const [y, m] = String(periodo).split('-').map(Number)
  return { desde: isoDe(new Date(y, m - 1, 1)), hasta: isoDe(new Date(y, m, 0)) }
}

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
  const [sinLeer, setSinLeer] = useState(0)
  const [riesgo, setRiesgo] = useState(null)   // PNR en curso: casos y monto
  const [descuentos, setDescuentos] = useState(null)  // cobros ya aplicados
  const [fallas, setFallas] = useState([])     // consultas que no respondieron
  // El inicio aparece de una vez. Mostrarlo por partes hacía que la pantalla
  // saltara: primero un aviso suelto y después, de golpe, todo lo demás.
  const [listo, setListo] = useState(false)

  const cargar = useCallback(async () => {
    if (!tercero?.tercero_id) return
    const id = tercero.tercero_id
    // Supabase no lanza excepciones: devuelve { data, error }. Por eso una
    // vista sin permisos o con una columna mal escrita dejaba el inicio vacío
    // sin que nadie se enterara. Acá se recoge cada error y se muestra.
    const fallas = []
    const ok = async (nombre, fn, sino) => {
      try {
        const r = await fn()
        if (r && r.error) { fallas.push(`${nombre}: ${r.error.message || r.error}`); return sino }
        return r
      } catch (e) { fallas.push(`${nombre}: ${e.message || e}`); return sino }
    }
    const [d, p, lista, c, pnr, otros] = await Promise.all([
      ok('resumen del día', () => supabase.from('vw_portal_resumen_dia').select('*').eq('tercero_id', id)
        .order('fecha', { ascending: false }).limit(1), { data: [] }),
      ok('resumen por período', () => supabase.from('vw_portal_resumen_periodo').select('*').eq('tercero_id', id), { data: [] }),
      ok('notificaciones', () => cargarNotificaciones(id), []),
      ok('mensajes', () => supabase.from('vw_campana_tercero').select('mensajes_sin_leer').eq('tercero_id', id).maybeSingle(), { data: null }),
      // Los PNR que todavía se pueden ganar: es plata en riesgo, no un cargo.
      ok('reclamos', () => supabase.from('vw_portal_pnr').select('monto, le_toca_a, resultado'), { data: [] }),
      ok('descuentos', () => supabase.from('vw_portal_mis_descuentos').select('monto'), { data: [] }),
    ])
    setFallas(fallas)
    if (fallas.length) console.error('[portal] inicio:', fallas)
    setDia(((d && d.data) || [])[0] || null)
    setPeriodos((p && p.data) || [])
    // En el Inicio van las pendientes y las novedades que todavía no abre.
    // Las jornadas publicadas quedan solo en Mis mensajes: el inicio ya muestra
    // la ganancia del día en su tarjeta, así que repetirla como aviso sobra.
    setAvisos((lista || []).filter(n =>
      n.tipo !== 'jornada_publicada' &&
      n.tipo !== 'nuevo_descuento' && n.tipo !== 'descuento_pnr' &&
      (n.clase === 'pendiente' || !n.leida_at)))
    setSinLeer(c?.data?.mensajes_sin_leer || 0)
    const casos = (pnr && pnr.data) || []
    const enCurso = casos.filter(x => x.resultado === 'en_curso')
    setRiesgo(enCurso.length
      ? { n: enCurso.length,
          monto: enCurso.reduce((t, x) => t + Number(x.monto || 0), 0),
          urgente: enCurso.some(x => x.le_toca_a === 'tercero') }
      : null)
    // Los descuentos ya aplicados van en una sola línea: uno por cobro llenaba
    // el inicio de avisos que el tercero no puede accionar.
    const cobrados = [
      ...casos.filter(x => x.resultado === 'se_cobra'),
      ...((otros && otros.data) || []),
    ]
    setDescuentos(cobrados.length
      ? { n: cobrados.length, monto: cobrados.reduce((t, x) => t + Number(x.monto || 0), 0) }
      : null)
    setListo(true)
  }, [tercero])

  useEffect(() => { cargar() }, [cargar])

  // Sin la cuenta de pago no se le paga: va primero y en rojo.
  const notificaciones = useMemo(() => [
    ...(perfilOk === false ? [{
      id: 'perfil', destino: 'perfil', pastilla: { estilo: 'rojo', etiqueta: 'Urgente' },
      titulo: 'Tu perfil de empresa está incompleto',
      detalle: 'Sin la cuenta de pago (banco, CLABE y su comprobante) no se realizan pagos a tu empresa',
    }] : []),
    // Una sola línea por los reclamos abiertos, con la plata en juego: dos
    // docenas de tarjetas sueltas no le dicen al tercero cuánto arriesga.
    ...(riesgo ? [{
      id: 'reclamos', destino: 'reclamos',
      pastilla: riesgo.urgente ? { estilo: 'rojo', etiqueta: 'Urgente' } : { estilo: 'naranja', etiqueta: 'Importante' },
      titulo: `Tienes ${riesgo.n} ${riesgo.n === 1 ? 'reclamo' : 'reclamos'}`,
      monto: pesos(riesgo.monto),
      cola: 'en riesgo de cobro',
      detalle: riesgo.urgente
        ? 'Hay casos esperando tu respuesta. Responde antes de que venza el plazo.'
        : 'MELI los está revisando. Te avisamos cuando los resuelva.',
    }] : []),
    ...(descuentos ? [{
      id: 'descuentos', destino: 'descuentos', plano: true,
      pastilla: { estilo: 'naranja', etiqueta: 'Informativo' },
      titulo: `${descuentos.n} ${descuentos.n === 1 ? 'descuento aplicado' : 'descuentos aplicados'}`,
      monto: pesos(Math.abs(descuentos.monto)),
      cola: 'en total',
      detalle: 'Revisa el detalle de cada uno en Descuentos.',
    }] : []),
    ...avisos,
    ...(sinLeer > 0 ? [{
      id: 'mensajes', destino: 'mensajes', pastilla: { estilo: 'azul', etiqueta: 'Nuevo' },
      titulo: `${sinLeer} ${sinLeer === 1 ? 'mensaje' : 'mensajes'} de Bigticket sin leer`,
      detalle: 'Léelos y respóndelos en Consultas',
    }] : []),
  ], [perfilOk, avisos, sinLeer, riesgo, descuentos])

  const abrir = (n) => {
    if (typeof n.id === 'number' && !n.leida_at) marcarLeida(n.id)
    onPick(n.destino)
  }

  // Solo desde el hito cero (semana 39), más reciente primero. Las semanas se
  // ordenan por número: el `desde` de la vista es el primer día con algo
  // publicado, no el lunes, y ordenar por él desordenaba la lista.
  const lista = useMemo(() => periodos
    .filter(p => p.tipo === vista)
    .map(p => vista === 'semana'
      ? { ...p, ...limitesSemana(p.periodo, p.desde) }
      : { ...p, ...limitesMes(p.periodo) })
    .filter(p => p.hasta >= HITO)
    .sort((a, b) => b.desde.localeCompare(a.desde)), [periodos, vista])
  useEffect(() => { setIdx(0) }, [vista])
  const actual = lista[idx] || null
  const hayAnterior = idx < lista.length - 1
  const haySiguiente = idx > 0

  return (
    <>
      <h1 className="bt-hola">Hola, {tercero.nombre}</h1>

      {fallas.length > 0 && (
        <div className="dx-error" style={{ marginBottom: 20 }}>
          <b>No pudimos cargar parte de tu información.</b> Puedes seguir usando el portal; esto lo
          revisamos nosotros.
          <ul style={{ margin: '8px 0 0', paddingLeft: 20, fontSize: 12.5 }}>
            {fallas.map((f, i) => <li key={i}>{f}</li>)}
          </ul>
        </div>
      )}

      {!listo && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div className="bt-skel" style={{ height: 70 }} />
          <div className="bt-tarjetas">
            <div className="bt-skel" style={{ height: 196 }} />
            <div className="bt-skel" style={{ height: 196 }} />
          </div>
        </div>
      )}

      {listo && notificaciones.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <span className="bt-eyebrow">Notificaciones</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {notificaciones.map(n => (
              <button key={n.id} className={`bt-aviso e-${n.pastilla.estilo}${n.plano ? ' plano' : ''}`} onClick={() => abrir(n)}>
                <div style={{ minWidth: 0 }}>
                  <h3>
                    {n.titulo}
                    {n.monto && <>{' · '}<span className="bt-aviso-monto">{n.monto}</span>{' '}{n.cola}</>}
                  </h3>
                  <p>{n.detalle}</p>
                </div>
                <span className="bt-pill">{n.pastilla.etiqueta}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {listo && tercero.pagosHabilitados && (
        <>
        <span className="bt-eyebrow">Movimientos</span>
        <div className="bt-tarjetas">
          <div className="bt-card bt-card-click" onClick={() => onPick('movimientos')}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '0 0 4px' }}>
              <h3 className="bt-card-t" style={{ margin: 0 }}>Diario</h3>
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
              [pct(nsDomicilioDe(dia), 1), 'Visitado'],
            ]} />
          </div>

          <div className="bt-card">
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, margin: '0 0 16px' }}>
              <div>
                <h3 className="bt-card-t">{vista === 'semana' ? 'Semanal' : 'Mensual'}</h3>
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
                  <button key={k} className={`bt-per${vista === k ? ' on' : ''}`} onClick={() => setVista(k)}>{l}</button>
                ))}
              </div>
            </div>
            <Cifras monto={actual?.ganancia} rutas={rutasDe(actual)} datos={[
              [entero(actual?.entregas), 'Entregas'],
              [entero(devolucionesDe(actual)), 'Devoluciones'],
              [pct(actual?.ns, 0), 'Nivel servicio'],
              [pct(nsDomicilioDe(actual), 0), 'Visitado'],
            ]} />
          </div>
        </div>
        </>
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
        <div className="bt-monto"><span className="bt-flota">{pesos(monto)}</span></div>
        <div className="bt-rutas">
          <span className="n"><span className="bt-flota">{entero(rutas)}</span></span>
          <span className="l">Rutas</span>
        </div>
      </div>
      <div className="bt-datos">
        {datos.map(([v, l]) => (
          <div key={l}>
            <div className="v"><span className="bt-flota">{v}</span></div>
            <div className="l">{l}</div>
          </div>
        ))}
      </div>
    </>
  )
}

// ── Pantallas que marketing puso en el menú pero todavía no existen ─────────
const PENDIENTES = {
  desempeno: { grupo: 'Mi operación', titulo: 'Desempeño', texto: 'Aquí vas a ver el nivel de servicio, las entregas y las devoluciones de tus rutas, semana a semana.' },
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
