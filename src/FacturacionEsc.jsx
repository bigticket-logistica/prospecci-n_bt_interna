// ═══════════════════════════════════════════════════════════════════════════
// FacturacionEsc.jsx — Facturación en el computador (maqueta 8.9.9).
//
// Tres vistas del mismo ciclo, cada una con su tabla "Resumen" por site:
//   Por facturar  prefacturas sin pagar de la semana: subir factura o
//                 "En validación" si ya se subió y falta aprobarla.
//   Facturado     facturas aprobadas (conciliadas), por semana o por mes.
//   Pagado        prefacturas pagadas, con la fecha del depósito.
// En el teléfono se sigue usando la vista de Facturacion.jsx.
//
// Montos: el total es el líquido de la prefactura (lo que dice la factura) y
// se separa en subtotal + IVA 16%, que es como el tercero la emite.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useMemo, useState } from 'react'

const money = (n) => (Number(n) < 0 ? '−' : '') + '$' +
  Math.abs(Number(n || 0)).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const dia = (s) => new Date(String(s).slice(0, 10) + 'T12:00:00')
const rangoSemana = (ini, fin) => {
  if (!ini || !fin) return ''
  const a = dia(ini), b = dia(fin)
  return a.getMonth() === b.getMonth()
    ? `${a.getDate()} al ${b.getDate()} de ${MESES[b.getMonth()]}`
    : `${a.getDate()} de ${MESES[a.getMonth()]} al ${b.getDate()} de ${MESES[b.getMonth()]}`
}
const mesDe = (p) => String(p.semana_inicio || '').slice(0, 7)            // "2026-09"
const nombreMes = (k) => { const [y, m] = k.split('-'); return `${MESES[Number(m) - 1].replace(/^./, c => c.toUpperCase())} ${y}` }
const fechaDdMm = (s) => s ? dia(s).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'

// Total = líquido de la prefactura; subtotal e IVA se separan del total.
const montos = (p) => {
  const total = Number(p.liquido_pago || 0)
  const subtotal = Math.round((total / 1.16) * 100) / 100
  return { total, subtotal, iva: Math.round((total - subtotal) * 100) / 100 }
}
const aprobada = (f) => ['conciliada', 'aprobada', 'validada'].includes(String(f.estado || '').toLowerCase())
const numFactura = (f) => f?.serie_folio || (f?.uuid ? String(f.uuid).slice(-6).toUpperCase() : 'Ver')

const IcoDoc = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FF6600" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" /><path d="M14 2v4a2 2 0 0 0 2 2h4" />
  </svg>
)
const IcoCal = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#545454" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
  </svg>
)
const IcoSubir = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#002E5D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m17 8-5-5-5 5" /><path d="M12 3v12" />
  </svg>
)

// Nota de descuentos como en la maqueta: nombra los tipos que tiene la prefactura.
const notaDescuentos = (p) => {
  const desc = Math.abs(Number(p.total_cobros || 0))
  if (!desc) return 'Sin descuentos esta semana.'
  const tipos = []
  for (const l of (p.extras || []).filter(x => x.tipo === 'cobro')) {
    const c = String(l.concepto || '').toLowerCase()
    const t = /pnr/.test(c) ? 'PNR' : /perdid/.test(c) ? 'paquete perdido' : /no ?show/.test(c) ? 'no show' : 'otros cobros'
    if (!tipos.includes(t)) tipos.push(t)
  }
  const lista = tipos.length > 1 ? `${tipos.slice(0, -1).join(', ')} y ${tipos[tipos.length - 1]}` : (tipos[0] || 'otros cobros')
  return `Incluye descuentos por ${money(desc)} (${lista}). Si no estás de acuerdo, levanta la diferencia en Movimientos antes de facturar.`
}
const Flecha = ({ izq }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={izq ? 'm15 18-6-6 6-6' : 'm9 18 6-6-6-6'} />
  </svg>
)

export default function FacturacionEsc({ vista, filas, onBack, onIr, subirArchivos, abrirArchivo, urlArchivo }) {
  const TIT = { facturacion: 'Por facturar', facturado: 'Facturado', pagado: 'Pagado' }
  const titulo = TIT[vista] || TIT.facturacion

  // Qué prefacturas entran en cada vista
  const lista = useMemo(() => (filas || []).filter(p => {
    const facts = p.facturas || []
    if (vista === 'pagado') return !!p.pagado_at
    if (vista === 'facturado') return !p.pagado_at && facts.some(aprobada)
    return !p.pagado_at && !facts.some(aprobada)          // por facturar (incluye "En validación")
  }), [filas, vista])

  // Período: semanal siempre en Por facturar; Facturado y Pagado eligen cada uno el suyo.
  const claveModo = `fx_modo_${vista}`
  const [modo, setModo] = useState(() => (vista === 'facturacion' ? 'semanal' : (localStorage.getItem(claveModo) || 'semanal')))
  const cambiarModo = (m) => { setModo(m); try { localStorage.setItem(claveModo, m) } catch { /* sin almacenamiento */ } }
  const periodos = useMemo(() => {
    const ks = new Set(lista.map(p => (modo === 'mensual' ? mesDe(p) : String(p.semana))))
    return [...ks].filter(Boolean).sort((a, b) => (modo === 'mensual' ? a.localeCompare(b) : Number(a) - Number(b)))
  }, [lista, modo])
  const [idx, setIdx] = useState(null)
  useEffect(() => { setIdx(periodos.length ? periodos.length - 1 : null) }, [periodos.join(','), modo])  // eslint-disable-line react-hooks/exhaustive-deps
  const per = idx != null ? periodos[idx] : null
  const filasPer = lista.filter(p => (modo === 'mensual' ? mesDe(p) : String(p.semana)) === per)
    .sort((a, b) => (Number(a.semana) - Number(b.semana)) || (Number(b.liquido_pago || 0) - Number(a.liquido_pago || 0)))
  const ref = filasPer[0]
  const etiquetaPer = !per ? '—' : modo === 'mensual' ? nombreMes(per) : `Semana ${per} · ${rangoSemana(ref?.semana_inicio, ref?.semana_fin)}`

  // Recuadro ATENCIÓN (Por facturar): lo que falta subir, de todas las semanas
  const porSubir = (filas || []).filter(p => !p.pagado_at && (p.facturas || []).length === 0)
  const montoPorSubir = porSubir.reduce((t, p) => t + Number(p.liquido_pago || 0), 0)

  const [cargaAbierta, setCargaAbierta] = useState(null)   // id de la prefactura con la carga abierta
  const [archivos, setArchivos] = useState([])
  const [enviando, setEnviando] = useState(false)
  const [recibido, setRecibido] = useState(null)           // prefactura enviada → modal
  const [visor, setVisor] = useState(null)                 // { titulo, url, path }

  const abrirCarga = (p) => { setCargaAbierta(cargaAbierta === p.id ? null : p.id); setArchivos([]) }
  const enviar = async (p) => {
    if (!archivos.length) return
    setEnviando(true)
    const ok = await subirArchivos(p, archivos)
    setEnviando(false)
    if (ok) { setCargaAbierta(null); setArchivos([]); setRecibido(p) }
  }
  const abrirVisor = async (p, f) => {
    const url = await urlArchivo(f.storage_path)
    if (url) setVisor({ titulo: `Factura ${numFactura(f)} · ${p.service_center}`, url, path: f.storage_path, xml: /\.xml$/i.test(f.storage_path) })
  }

  const totales = filasPer.reduce((t, p) => {
    const m = montos(p)
    return { rutas: t.rutas + Number(p.n_viajes || 0), subtotal: t.subtotal + m.subtotal, iva: t.iva + m.iva, total: t.total + m.total }
  }, { rutas: 0, subtotal: 0, iva: 0, total: 0 })
  const cabUltima = vista === 'pagado' ? 'Fecha depósito' : 'Estado'
  const cabFactura = vista === 'facturacion' ? 'Factura' : 'N° factura'

  return (
    <div className="fx8">
      <nav className="fx8-crumbs" aria-label="Ruta">
        <button className="fx8-back" onClick={onBack}>← Volver</button>
        <span className="fx8-sep" />
        <button className="fx8-link" onClick={onBack}>Inicio</button>
        <span className="fx8-chev">›</span>
        {vista === 'facturacion' ? <span>Facturación</span> : <button className="fx8-link" onClick={() => onIr('facturacion')}>Facturación</button>}
        <span className="fx8-chev">›</span>
        <span aria-current="page" className="fx8-actual">{titulo}</span>
      </nav>
      <h1 className="fx8-titulo">{titulo}</h1>

      {vista === 'facturacion' && porSubir.length > 0 && (
        <div className="fx8-attn">
          <div className="fx8-attn-top">
            <span className="fx8-attn-tag"><span className="fx8-pulso" />ATENCIÓN</span>
            <span className="fx8-attn-monto">{money(montoPorSubir)} por facturar</span>
          </div>
          <div className="fx8-attn-row"><b>{porSubir.length}</b><span>{porSubir.length === 1 ? 'Factura por subir' : 'Facturas por subir'}</span></div>
        </div>
      )}

      <div className="fx8-periodo">
        {vista !== 'facturacion' && (
          <div className="fx8-toggle" role="group" aria-label="Período">
            {[['semanal', 'Semanal'], ['mensual', 'Mensual']].map(([k, t]) => (
              <button key={k} aria-pressed={modo === k} onClick={() => cambiarModo(k)}>{t}</button>
            ))}
          </div>
        )}
        <div className={`fx8-nav${vista !== 'facturacion' ? ' chico' : ''}`}>
          <button className="fx8-arrow" aria-label="Período anterior" disabled={!idx} onClick={() => setIdx(i => i - 1)}><Flecha izq /></button>
          <span className="fx8-label">{vista === 'facturacion' && <IcoCal />}{etiquetaPer}</span>
          <button className="fx8-arrow" aria-label="Período siguiente" disabled={idx == null || idx >= periodos.length - 1} onClick={() => setIdx(i => i + 1)}><Flecha /></button>
        </div>
      </div>

      <section className="fx8-card">
        <h2 className="fx8-res-titulo">Resumen · {modo === 'mensual' ? (per ? nombreMes(per) : '—') : `semana ${per || '—'}`}</h2>
        {filasPer.length === 0 ? (
          <div className="fx8-vacio">{vista === 'facturacion' ? 'Estás al día: no tienes prefacturas por facturar.' : vista === 'facturado' ? 'No hay facturas aprobadas en este período.' : 'Todavía no hay pagos en este período.'}</div>
        ) : (
          <div className="fx8-scroll">
            <div className="fx8-grid fx8-head">
              {['Site', 'Rutas', 'Subtotal', 'IVA 16%', 'Total', 'Prefactura', cabFactura, cabUltima].map(h => <span key={h} className={h === cabUltima ? 'fx8-ultima' : ''}>{h}</span>)}
            </div>
            {filasPer.map(p => {
              const m = montos(p)
              const f = (p.facturas || []).find(aprobada) || (p.facturas || [])[0]
              const estado = vista === 'pagado' ? fechaDdMm(p.pagado_at)
                : vista === 'facturado' ? 'Facturado'
                : (p.facturas || []).length ? 'En validación' : 'Subir factura'
              const abierta = cargaAbierta === p.id
              return (
                <div key={p.id}>
                  <div className="fx8-grid fx8-row">
                    <span className="fx8-site">{p.service_center}{modo === 'mensual' && <small>Semana {p.semana}</small>}</span>
                    <span className="fx8-dato">{p.n_viajes}</span>
                    <span className="fx8-dato">{money(m.subtotal)}</span>
                    <span className="fx8-dato">{money(m.iva)}</span>
                    <span className="fx8-dato">{money(m.total)}</span>
                    <span>{p.pdf_url ? <button className="fx8-doc" onClick={() => abrirArchivo(p.pdf_url)}><IcoDoc />Ver</button> : <span className="fx8-dato">—</span>}</span>
                    <span>
                      {vista === 'facturacion' ? (
                        <button className="fx8-subir" aria-expanded={abierta} onClick={() => abrirCarga(p)}>
                          Subir factura <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m6 9 6 6 6-6" /></svg>
                        </button>
                      ) : f ? <button className="fx8-doc" onClick={() => abrirVisor(p, f)}><IcoDoc />{numFactura(f)}</button> : <span className="fx8-dato">—</span>}
                    </span>
                    <span className="fx8-dato fx8-ultima">{estado}</span>
                  </div>
                  <div className="fx8-meta">{cabUltima}: {estado}</div>
                  {abierta && (
                    <div className="fx8-panel">
                      <div className="fx8-panel-top">
                        <span className="fx8-lead">Tu factura debe decir exactamente:</span>
                        <button className="fx8-x" aria-label="Cerrar" onClick={() => setCargaAbierta(null)}>✕</button>
                      </div>
                      <div className="fx8-cajas">
                        <div className="fx8-caja"><span>Subtotal</span><b>{money(m.subtotal)}</b></div>
                        <div className="fx8-caja"><span>IVA 16%</span><b>{money(m.iva)}</b></div>
                        <div className="fx8-caja total"><span>Total</span><b>{money(m.total)}</b></div>
                      </div>
                      <div className="fx8-nota">{notaDescuentos(p)}</div>
                      <label className="fx8-drop">
                        <input type="file" accept=".xml,.pdf,application/pdf" multiple hidden
                          onChange={e => { setArchivos(a => [...a, ...[...(e.target.files || [])].filter(x => /\.(xml|pdf)$/i.test(x.name))]); e.target.value = '' }} />
                        <IcoSubir />Archivo XML o archivo pdf de tu factura
                      </label>
                      {archivos.map((x, i) => (
                        <div key={i} className="fx8-ok"><span>{x.name}</span><em>Listo para enviar</em>
                          <button className="fx8-x" aria-label="Quitar" onClick={() => setArchivos(a => a.filter((_, j) => j !== i))}>✕</button></div>
                      ))}
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}><button className="fx8-enviar" disabled={!archivos.length || enviando} onClick={() => enviar(p)}>{enviando ? 'Enviando…' : 'Enviar factura'}</button></div>
                    </div>
                  )}
                </div>
              )
            })}
            {!cargaAbierta && (
              <div className="fx8-grid fx8-total">
                <span>Total</span><span>{totales.rutas}</span><span>{money(totales.subtotal)}</span><span>{money(totales.iva)}</span><span>{money(totales.total)}</span><span /><span /><span className="fx8-ultima" />
              </div>
            )}
          </div>
        )}
      </section>

      {recibido && (
        <div className="fx8-overlay" onClick={() => setRecibido(null)}>
          <div className="fx8-modal" onClick={e => e.stopPropagation()}>
            <div className="fx8-modal-ico">✓</div>
            <div className="fx8-modal-tit">Recibimos tu factura</div>
            <div className="fx8-modal-txt">Estamos revisando la factura. Una vez aprobada, aparecerá en la sección Facturado.</div>
            <div className="fx8-modal-res">
              <div><span>Site</span><b>{recibido.service_center}</b></div>
              <div><span>Total</span><b>{money(recibido.liquido_pago)}</b></div>
              <div><span>Estado</span><b>En validación</b></div>
            </div>
            <div className="fx8-modal-acc">
              <button className="fx8-btn-out" onClick={() => { setRecibido(null); onIr('facturado') }}>Ver en Facturado</button>
              <button className="fx8-btn-pri" onClick={() => setRecibido(null)}>Volver a Por facturar</button>
            </div>
          </div>
        </div>
      )}

      {visor && (
        <div className="fx8-overlay" onClick={() => setVisor(null)}>
          <div className="fx8-visor" onClick={e => e.stopPropagation()}>
            <div className="fx8-visor-head">
              <b>{visor.titulo}</b>
              <div style={{ display: 'flex', gap: 8 }}>
                <a className="fx8-btn-pri fx8-desc" href={visor.url} target="_blank" rel="noreferrer">{visor.xml ? 'Descargar XML' : 'Descargar PDF'}</a>
                <button className="fx8-x" aria-label="Cerrar" onClick={() => setVisor(null)}>✕</button>
              </div>
            </div>
            {visor.xml ? <div className="fx8-vacio">Esta factura se subió en XML. Descárgala para verla.</div>
              : <iframe title={visor.titulo} src={visor.url} className="fx8-iframe" />}
          </div>
        </div>
      )}
    </div>
  )
}
