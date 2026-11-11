// ═══════════════════════════════════════════════════════════════════════════
// Descuentos.jsx — Mi billetera › Descuentos (maqueta 8.9.21)
// Solo lectura. Selector "Fecha de pago" (la más reciente por defecto),
// resumen fijo Paquete Perdido · PNR · No Show + "Te descontamos", tabla
// "Detalle de descuentos" con flecha "Ver detalle" (una fila abierta a la vez)
// y fila Total. Fuentes (las de siempre):
//   · vw_portal_pnr (resultado = se_cobra)       → PNR (con su reclamo de origen)
//   · vw_portal_mis_descuentos (merma · noshow)   → Paquete perdido · No Show
// La fecha de pago sale de la semana de cobro (numeración del Brain, ISO + 1):
// el viernes de esa semana, o el día real de pago si la prefactura ya se pagó.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useMemo, useState } from 'react'
import { supabase } from './supabaseClient'
import { CSS_MK } from './Desempeno'

const TIPOS = [['paquete_perdido', 'Paquete Perdido'], ['pnr', 'PNR'], ['no_show', 'No Show']]
const TIPO_FILA = { paquete_perdido: 'Paquete perdido', pnr: 'PNR', no_show: 'No Show' }
const fmt = (n) => '− $' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtTotal = (n) => (Number(n) > 0 ? fmt(n) : '$0.00')
const dmy = (d) => { if (!d) return '—'; const x = new Date(String(d).length <= 10 ? d + 'T12:00:00' : d); return `${String(x.getDate()).padStart(2, '0')}/${String(x.getMonth() + 1).padStart(2, '0')}/${x.getFullYear()}` }
const isoDia = (x) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`

// Viernes de la semana del Brain N (ISO N−1) del año dado
function viernesSemanaBrain(n, anio) {
  const w = Number(n) - 1
  const ene4 = new Date(anio, 0, 4)
  const lunesW1 = new Date(ene4); lunesW1.setDate(ene4.getDate() - ((ene4.getDay() || 7) - 1))
  const v = new Date(lunesW1); v.setDate(lunesW1.getDate() + (w - 1) * 7 + 4)
  return v
}
// Fecha de pago de un descuento: semana de cobro → su viernes (en el año que corresponde a la ruta)
function fechaPagoDe(semana, fechaRef) {
  const ref = fechaRef ? new Date(String(fechaRef).slice(0, 10) + 'T12:00:00') : new Date()
  const n = parseInt(String(semana || '').replace(/\D/g, '').slice(-2), 10)
  if (!n) {   // todavía sin semana: se descuenta en el próximo pago (viernes)
    const h = new Date(); const d = (5 - h.getDay() + 7) % 7; h.setDate(h.getDate() + d); return isoDia(h)
  }
  let v = viernesSemanaBrain(n, ref.getFullYear())
  if (v < new Date(ref.getTime() - 10 * 864e5)) v = viernesSemanaBrain(n, ref.getFullYear() + 1)
  return isoDia(v)
}
const Chev = ({ s = 12 }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>

export default function Descuentos({ tercero, onBack, onIr }) {
  const [items, setItems] = useState(null)
  const [fecha, setFecha] = useState('')
  const [abierto, setAbierto] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => { (async () => {
    if (!tercero?.tercero_id) return
    const [pnr, otros] = await Promise.all([
      supabase.from('vw_portal_pnr').select('*').eq('resultado', 'se_cobra').order('fecha_caso', { ascending: false }).limit(1000),
      supabase.from('vw_portal_mis_descuentos').select('*').order('fecha', { ascending: false }).limit(1000),
    ])
    if (pnr.error && otros.error) { setError('No se pudieron cargar tus descuentos. Vuelve a intentarlo en un momento.'); setItems([]); return }
    const lista = []
    for (const c of pnr.data || []) lista.push({
      id: `pnr-${c.case_id}`, tipo: 'pnr', caso: c.case_id, site: c.sc, placa: c.placa, conductor: c.conductor,
      fechaRuta: c.fecha_ruta, monto: Number(c.monto || 0), paquete: c.guia || null, ruta: c.ruta || c.id_ruta || null,
      fechaPago: fechaPagoDe(c.semana_cobro, c.fecha_ruta), reclamoId: c.case_id,
      nota: 'Este descuento viene de un reclamo de Post venta que no se respondió a tiempo con el comprobante de entrega.',
    })
    for (const f of otros.data || []) {
      if (f.devuelto) continue   // devuelto: no es un descuento vigente
      const tipo = f.origen === 'noshow' ? 'no_show' : 'paquete_perdido'
      lista.push({
        id: `${f.origen}-${f.id}`, tipo, caso: f.guia || f.id_ruta || f.id, site: f.sc, placa: f.placa, conductor: f.conductor,
        fechaRuta: f.fecha, monto: Number(f.monto || 0), paquete: tipo === 'paquete_perdido' ? (f.guia || null) : null, ruta: f.id_ruta || null,
        fechaPago: f.fecha_cobro ? String(f.fecha_cobro).slice(0, 10) : fechaPagoDe(f.semana, f.fecha),
        nota: tipo === 'no_show' ? 'Descuento por una ruta asignada que no se presentó, cargado por administración BigTicket con su veredicto.'
          : (f.motivo ? `${f.motivo}. ` : '') + 'Descuento cargado por administración BigTicket con su veredicto.',
      })
    }
    setItems(lista)
  })() }, [tercero])

  // Fechas de pago, de la más reciente a la más antigua
  const fechas = useMemo(() => [...new Set((items || []).map((i) => i.fechaPago))].sort().reverse(), [items])
  useEffect(() => { if (!fecha && fechas.length) setFecha(fechas[0]) }, [fechas, fecha])
  const filas = (items || []).filter((i) => i.fechaPago === fecha).sort((a, b) => String(a.fechaRuta).localeCompare(String(b.fechaRuta)))
  const suma = (t) => filas.filter((f) => !t || f.tipo === t).reduce((s, f) => s + f.monto, 0)
  const total = suma()

  return (
    <div className="ds">
      <style>{CSS_DS}</style>
      <nav className="mk-ruta" aria-label="Ruta">
        <button onClick={onBack}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M11 18l-6-6 6-6" /></svg>Volver</button>
        <span className="sep" />
        <button onClick={onBack}>Inicio</button><span className="gt">›</span>
        <span>Mi billetera</span><span className="gt">›</span>
        <span aria-current="page">Descuentos</span>
      </nav>
      <h1 className="mk-titulo">Descuentos</h1>
      {error && <div className="ds-error">{error}</div>}

      <div className="pay-date">
        <span className="prefix">Fecha de pago:</span>
        <select value={fecha} onChange={(e) => { setFecha(e.target.value); setAbierto(null) }} aria-label="Fecha de pago">
          {fechas.length === 0 && <option value="">—</option>}
          {fechas.map((f) => <option key={f} value={f}>{dmy(f)}</option>)}
        </select>
        <span className="chev"><Chev /></span>
      </div>

      <div className="ds-summary">
        <div className="ds-cats">
          {TIPOS.map(([k, t]) => {
            const m = suma(k)
            return <div key={k} className="ds-cat"><span className="label">{t}</span><span className={`amt${m > 0 ? '' : ' is-zero'}`}>{m > 0 ? fmt(m) : '$0.00'}</span></div>
          })}
        </div>
        <div className="ds-total"><span className="label">Te descontamos</span><span className="amt">{fmtTotal(total)}</span></div>
      </div>

      <div className="ds-box">
        <h2 className="ds-h2">Detalle de descuentos</h2>
        <div className="ds-scroll"><div className="ds-tabla">
          <div className="ds-head"><span>Tipo</span><span className="c">Caso</span><span className="c">Site</span><span className="c">Placa</span><span>Conductor</span><span className="c">F. ruta</span><span className="r">Descuento</span><span /></div>
          {items === null ? <div className="ds-vacio">Cargando…</div>
            : filas.length === 0 ? <div className="ds-vacio">No tienes descuentos en esta fecha de pago.</div>
            : filas.map((d) => {
              const open = abierto === d.id
              return (
                <div key={d.id}>
                  <div className="ds-row">
                    <span className="tipo">{TIPO_FILA[d.tipo]}</span>
                    <span className="dato c">{d.caso || '—'}</span>
                    <span className="dato c">{d.site || '—'}</span>
                    <span className="dato c">{d.placa || '—'}</span>
                    <span className="dato elip" title={d.conductor || ''}>{d.conductor || '—'}</span>
                    <span className="dato c">{dmy(d.fechaRuta)}</span>
                    <span className="monto">{fmt(d.monto)}</span>
                    <button className="ds-toggle" aria-expanded={open} aria-label={open ? 'Ocultar detalle' : 'Ver detalle'} onClick={() => setAbierto(open ? null : d.id)}>
                      <span className="ds-tooltip">{open ? 'Ocultar detalle' : 'Ver detalle'}</span><Chev s={14} />
                    </button>
                  </div>
                  {open && (
                    <div className="det">
                      <div className="det-head"><h3>Detalle del descuento</h3>
                        <button className="det-close" aria-label="Cerrar" onClick={() => setAbierto(null)}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6" /></svg></button>
                      </div>
                      <div className="det-panel">
                        <div className="det-facts">
                          <div className="det-fact"><span className="l">Tipo de descuento</span><span className="v">{TIPO_FILA[d.tipo]}</span></div>
                          {d.paquete && <div className="det-fact"><span className="l">N° de paquete</span><span className="v">{d.paquete}</span></div>}
                          <div className="det-fact"><span className="l">Fecha de ruta</span><span className="v">{dmy(d.fechaRuta)}</span></div>
                          <div className="det-fact"><span className="l">Descontado en el pago</span><span className="v">{dmy(d.fechaPago)}</span></div>
                        </div>
                        <div className="det-foot">
                          <p className="det-nota">{d.nota}</p>
                          {d.tipo === 'pnr' && onIr && <button className="det-btn" onClick={() => onIr('reclamos')}>Ver reclamo</button>}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          <div className="ds-total-row"><span className="label">Total</span><span /><span /><span /><span /><span className="amt">{fmtTotal(total)}</span><span /></div>
        </div></div>
      </div>
    </div>
  )
}

const CSS_DS = CSS_MK + `
.ds { display:flex; flex-direction:column; gap:18px; font-family:"Open Sans",sans-serif; }
.ds-error { background:#FDF1F0; color:#C43D2F; border-radius:10px; padding:10px 12px; font-size:13.5px; }
.pay-date { position:relative; display:flex; align-items:center; align-self:flex-start; }
.pay-date .prefix { position:absolute; left:16px; pointer-events:none; font:700 15px Poppins,sans-serif; color:#002E5D; }
.pay-date select { height:46px; min-width:290px; padding:0 44px 0 136px; border:1px solid #C9CDD2; border-radius:10px; background:#fff; font:700 15px Poppins,sans-serif; color:#002E5D; appearance:none; -webkit-appearance:none; cursor:pointer; }
.pay-date .chev { position:absolute; right:16px; width:12px; pointer-events:none; color:#002E5D; display:flex; }
.ds-summary { display:flex; flex-wrap:wrap; align-items:center; gap:20px; padding:22px 24px; background:#fff; border:1px solid #E4E3E3; border-radius:16px; box-shadow:0 1px 3px rgba(0,46,93,.05); transition:box-shadow .2s, transform .2s, border-color .2s; }
.ds-summary:hover { box-shadow:0 12px 28px rgba(0,46,93,.14); transform:translateY(-2px); border-color:#B8C4D3; }
.ds-cats { flex:3 1 520px; display:grid; gap:12px; grid-template-columns:repeat(auto-fit,minmax(170px,1fr)); }
.ds-cat { border:1px solid #E4E3E3; border-radius:12px; padding:14px 16px; display:flex; flex-direction:column; gap:4px; }
.ds-cat .label { font:700 14px Poppins,sans-serif; color:#002E5D; }
.ds-cat .amt { font:700 20px Poppins,sans-serif; color:#545454; white-space:nowrap; }
.ds-cat .amt.is-zero { color:#B5B9BF; }
.ds-total { flex:1 1 200px; align-self:stretch; display:flex; flex-direction:column; justify-content:center; align-items:flex-end; gap:6px; text-align:right; border:1px solid #E4E3E3; border-radius:12px; padding:14px 16px; }
.ds-total .label { font:700 12.5px Poppins,sans-serif; letter-spacing:.06em; text-transform:uppercase; color:#545454; }
.ds-total .amt { font:700 32px/1.1 Poppins,sans-serif; color:#002E5D; }
.ds-box { background:#fff; border:1px solid #E4E3E3; border-radius:16px; padding:22px 24px; box-shadow:0 1px 3px rgba(0,46,93,.05); }
.ds-h2 { font:600 20px Poppins,sans-serif; color:#002E5D; margin:0 0 16px; }
.ds-scroll { overflow-x:auto; padding-top:30px; margin-top:-30px; }
.ds-tabla { min-width:980px; }
.ds-head, .ds-row, .ds-total-row { display:grid; gap:16px; align-items:center;
  grid-template-columns:minmax(170px,1.4fr) minmax(100px,1fr) minmax(60px,.6fr) minmax(90px,1.1fr) minmax(130px,.7fr) minmax(90px,.7fr) minmax(120px,.9fr) 28px; }
.ds-head { padding:14px 18px 14px 10px; background:#002E5D; border-radius:12px; }
.ds-head span { font:700 15px Poppins,sans-serif; letter-spacing:.06em; text-transform:uppercase; color:#fff; white-space:nowrap; }
.ds-row { padding:12px 18px 12px 10px; border-top:1px solid #EFEDED; }
.ds-row .tipo { font:700 15px Poppins,sans-serif; color:#002E5D; text-align:left; }
.ds-row .dato { font:400 14px "Open Sans",sans-serif; color:#545454; }
.ds-row .monto { font:600 14px "Open Sans",sans-serif; color:#545454; text-align:right; white-space:nowrap; }
.c { text-align:center; } .r { text-align:right; }
.elip { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.ds-toggle { position:relative; width:28px; height:28px; padding:0; border:none; border-radius:50%; background:transparent; color:#9AA1A9; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:color .15s, background .15s; }
.ds-toggle:hover, .ds-toggle:focus-visible { color:#002E5D; background:#F4F5F7; }
.ds-toggle svg { transition:transform .2s; }
.ds-toggle[aria-expanded="true"] svg { transform:rotate(180deg); }
.ds-tooltip { display:none; position:absolute; bottom:calc(100% + 2px); right:0; white-space:nowrap; background:#fff; border:1px solid #E4E3E3; border-radius:6px; padding:4px 8px; box-shadow:0 4px 12px rgba(0,46,93,.12); font:400 12.5px "Open Sans",sans-serif; color:#545454; }
.ds-toggle:hover .ds-tooltip, .ds-toggle:focus-visible .ds-tooltip { display:block; }
.det { padding-top:6px; }
.det-head { display:flex; align-items:center; justify-content:space-between; gap:12px; margin:0 10px 10px; }
.det-head h3 { font:700 16px Poppins,sans-serif; color:#002E5D; margin:0; }
.det-close { width:34px; height:34px; border-radius:50%; border:1px solid #D3DAE3; background:#fff; color:#002E5D; cursor:pointer; display:flex; align-items:center; justify-content:center; }
.det-panel { margin:0 10px 20px; background:#F4F5F7; border-radius:10px; padding:14px 16px 16px; display:flex; flex-direction:column; gap:12px; }
.det-facts { display:grid; gap:12px; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); }
.det-fact { background:#fff; border:1px solid #E4E3E3; border-radius:8px; padding:14px 16px; display:grid; gap:8px; }
.det-fact .l { font:700 12.5px Poppins,sans-serif; letter-spacing:.06em; text-transform:uppercase; color:#545454; }
.det-fact .v { font:400 14px/1.45 "Open Sans",sans-serif; color:#545454; }
.det-foot { display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap; }
.det-nota { font:400 14px/1.5 "Open Sans",sans-serif; color:#545454; margin:0; flex:1; min-width:220px; }
.det-btn { height:44px; padding:0 22px; border-radius:10px; border:1.5px solid #002E5D; background:#fff; color:#002E5D; font:700 14px Poppins,sans-serif; cursor:pointer; }
.det-btn:hover { background:#F4F6F9; }
.ds-total-row { padding:16px 19px 4px 10px; border-top:2px solid #002E5D; }
.ds-total-row .label { font:700 17px Poppins,sans-serif; color:#002E5D; }
.ds-total-row .amt { grid-column:span 2; text-align:right; font:700 20px Poppins,sans-serif; color:#002E5D; white-space:nowrap; }
.ds-vacio { padding:18px 10px; color:#545454; font-size:14px; }
@media (max-width: 640px) { .pay-date, .pay-date select { width:100%; min-width:0; } }
`
