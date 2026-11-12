// ═══════════════════════════════════════════════════════════════════════════
// MisDiferencias.jsx — Mi billetera › Mis diferencias (maqueta 8.9.24)
// Todas las diferencias del transportista (pagos y descuentos), de la más
// reciente a la más antigua. Filtros Todas / En curso / Resueltas con contador
// fijo. Tarjeta: "Diferencia #N" + site + estado con punto; detalle desplegado
// con Líneas reclamadas, Historial y Respuesta (Ajuste a tu favor).
// Se levantan desde Movimientos; aquí solo se siguen.
// Estados: Recibida (supervisor) → En revisión (analista) → Aprobada /
// Aprobada en parte / Rechazada. Datos: diferencias + diferencias_lineas.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useMemo, useState } from 'react'
import { supabase } from './supabaseClient'
import { CSS_MK } from './Desempeno'

const money = (n) => '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const fecha = (v) => (v ? new Date(String(v).length <= 10 ? v + 'T12:00:00' : v) : null)
const dLarga = (v) => { const d = fecha(v); return d ? `${String(d.getDate()).padStart(2, '0')} ${MESES[d.getMonth()]} ${d.getFullYear()}` : '—' }
const dHist = (v) => { const d = fecha(v); return d ? `${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()}` : '' }
const dCorta = (v) => { const d = fecha(v); return d ? `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}` : '—' }

// Estado de la maqueta a partir de estado y fase de la diferencia
function estadoDe(d) {
  if (d.estado === 'aceptada') return 'aprobada'
  if (d.estado === 'parcial') return 'parcial'
  if (d.estado === 'rechazada' || d.estado === 'vencida') return 'rechazada'
  if (d.estado === 'retirada') return 'retirada'
  if (d.fase === 'supervisor') return 'recibida'
  return 'revision'
}
const EST = {
  recibida: { t: 'Recibida', dot: '#FF6600', curso: true, msg: () => 'La tiene el supervisor del SC: valida lo que pasó en el patio. Si no responde a tiempo, pasa sola al analista.' },
  revision: { t: 'En revisión', dot: '#545454', curso: true, msg: () => 'La tiene el analista de BigTicket: está revisando cada línea para darte una respuesta.' },
  aprobada: { t: 'Aprobada', dot: '#002E5D', msg: () => 'Aprobada: el ajuste se suma a tu próximo pago.' },
  parcial: { t: 'Aprobada en parte', dot: '#002E5D', msg: () => 'Aprobada en parte: se ajustan solo las líneas aprobadas en tu próximo pago.' },
  rechazada: { t: 'Rechazada', dot: '#C43D2F', rojo: true, msg: (d) => `Rechazada: ${d.resolucion ? String(d.resolucion).replace(/\.?\s*$/, '. ') : ''}Revisa el motivo en el detalle.` },
  retirada: { t: 'Retirada', dot: '#B4BBC4', msg: () => 'La retiraste.' },
}
const TIPO = { ruta: 'Ruta', cobro: 'Cobro', faltante: 'Ruta que falta', concepto: 'Falta' }
const conceptoDe = (l) => [l.tipo === 'concepto' ? (l.concepto || 'Concepto') : (TIPO[l.tipo] || 'Línea'), l.id_ruta ? `ruta ${l.id_ruta}` : (l.placa || '')].filter(Boolean).join(' · ')
const Chev = ({ arriba }) => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ transform: arriba ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}><path d="m6 9 6 6 6-6" /></svg>

export default function MisDiferencias({ tercero, onBack, onIr }) {
  const [lista, setLista] = useState(null)
  const [error, setError] = useState(null)
  const [filtro, setFiltro] = useState('todas')
  const [abierta, setAbierta] = useState(null)

  useEffect(() => {
    if (!tercero?.tercero_id) return
    supabase.from('diferencias').select('*, diferencias_lineas(*)').eq('tercero_id', tercero.tercero_id)
      .order('folio', { ascending: false })
      .then(({ data, error: e }) => { if (e) setError('No pudimos cargar tus diferencias: ' + e.message); setLista(data || []) })
  }, [tercero])

  const cuenta = useMemo(() => {
    const l = lista || []
    const curso = l.filter((d) => EST[estadoDe(d)].curso).length
    return { todas: l.length, curso, resueltas: l.length - curso }
  }, [lista])
  const visibles = (lista || []).filter((d) => filtro === 'todas' ? true : filtro === 'curso' ? EST[estadoDe(d)].curso : !EST[estadoDe(d)].curso)
  const cambiarFiltro = (f) => { setFiltro(f); setAbierta(null) }

  return (
    <div className="md">
      <style>{CSS_MD}</style>
      <nav className="mk-ruta" aria-label="Ruta">
        <button onClick={onBack}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M11 18l-6-6 6-6" /></svg>Volver</button>
        <span className="sep" />
        <button onClick={onBack}>Inicio</button><span className="gt">›</span>
        <span>Mi billetera</span><span className="gt">›</span>
        <span aria-current="page">Mis diferencias</span>
      </nav>
      <div>
        <h1 className="mk-titulo">Mis diferencias</h1>
        <p className="mk-desc">Consulta el estatus y el historial de tus reclamos por pagos o descuentos. Para abrir un nuevo caso, ve a{' '}
          <button className="md-link" onClick={() => onIr && onIr('movimientos')}>Movimientos</button> y selecciona la ruta o cobro con el que no estés de acuerdo.</p>
      </div>
      {error && <div className="md-error">{error}</div>}

      <div className="segmented" role="tablist">
        {[['todas', 'Todas', cuenta.todas], ['curso', 'En curso', cuenta.curso], ['resueltas', 'Resueltas', cuenta.resueltas]].map(([k, t, n]) => (
          <button key={k} role="tab" aria-selected={filtro === k} onClick={() => cambiarFiltro(k)}>{t} · {n}</button>
        ))}
      </div>

      {lista === null ? <div className="md-vacio">Cargando…</div>
        : visibles.length === 0 ? <div className="md-vacio">No tienes diferencias en este estado.</div>
        : visibles.map((d) => {
          const k = estadoDe(d), e = EST[k]
          const lineas = d.diferencias_lineas || []
          const reclamado = Number(d.monto_reclamado || 0) || lineas.reduce((s, l) => s + Number(l.monto_ref || 0), 0)
          const ab = abierta === d.id
          const aprobado = lineas.reduce((s, l) => s + Number(l.monto_reconocido || 0), 0) || Number(d.monto_reconocido || 0)
          // Historial con las fechas que guarda la diferencia
          const hist = [{ t: 'Levantaste la diferencia', f: d.creada_at }]
          if (d.service_center || d.fase) hist.push({ t: 'Recibida por el supervisor del SC', f: d.creada_at })
          if (k !== 'recibida' && k !== 'retirada') hist.push({ t: 'Pasó al analista de BigTicket', f: d.supervisor_at || d.sla_supervisor_at || d.creada_at })
          if (!e.curso) hist.push({ t: e.t, f: d.resuelta_at, rojo: e.rojo })
          return (
            <article key={d.id} className={`md-card${ab ? ' is-open' : ''}`}>
              <div className="md-top">
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="md-titulo">
                    <span className="t">Diferencia #{d.folio}</span>
                    {d.service_center && <span className="chip">{d.service_center}</span>}
                    <span className="chip"><span className="dot" style={{ background: e.dot }} /><span style={e.rojo ? { color: '#C43D2F' } : undefined}>{e.t}</span></span>
                  </div>
                  <div className="md-meta">{lineas.length} {lineas.length === 1 ? 'línea' : 'líneas'} · {money(reclamado)} reclamado · levantada el {dLarga(d.creada_at)}</div>
                  <div className="md-msg">{e.msg(d)}</div>
                </div>
                <button className={`md-ver${ab ? ' on' : ''}`} aria-expanded={ab} onClick={() => setAbierta(ab ? null : d.id)}>
                  <span>{ab ? 'Ocultar detalle' : 'Ver detalle'}</span><Chev arriba={ab} />
                </button>
              </div>

              {ab && (
                <div className="md-det">
                  <div className="md-det-head">
                    <span>Detalle de la diferencia</span>
                    <button className="md-x" aria-label="Ocultar detalle" onClick={() => setAbierta(null)}><Chev arriba /></button>
                  </div>
                  <div className="md-panel">
                    <div className="md-box">
                      <span className="md-sub">Líneas reclamadas</span>
                      <div className="md-scroll"><div className="md-tabla">
                        <div className="md-th"><span>Fecha</span><span>Concepto</span><span className="r">Reclamado</span><span className="r">Aprobado</span><span className="c">Resultado</span></div>
                        {lineas.map((l) => {
                          const res = l.estado === 'aceptada' ? 'Aprobada' : l.estado === 'rechazada' ? 'Rechazada' : 'Pendiente'
                          return (
                            <div key={l.id} className="md-tr">
                              <span>{dCorta(l.fecha)}</span>
                              <span className="elip" title={conceptoDe(l)}>{conceptoDe(l)}</span>
                              <span className="r b">{l.monto_ref != null ? money(l.monto_ref) : '—'}</span>
                              <span className="r">{res === 'Pendiente' ? '—' : money(l.monto_reconocido || 0)}</span>
                              <span className="c" style={res === 'Rechazada' ? { color: '#C43D2F' } : undefined}>{res}</span>
                            </div>
                          )
                        })}
                      </div></div>
                    </div>
                    <div className="md-dos">
                      <div className="md-box">
                        <span className="md-sub">Historial</span>
                        <ul className="md-hist">
                          {hist.map((h, i) => (
                            <li key={i}><span className="dot" /><span><span className="t" style={h.rojo ? { color: '#C43D2F' } : undefined}>{h.t}</span><span className="f">{dHist(h.f)}</span></span></li>
                          ))}
                        </ul>
                      </div>
                      <div className="md-box">
                        <span className="md-sub">Respuesta</span>
                        <p className="md-resp">{e.curso
                          ? (k === 'recibida' ? 'Aún sin respuesta. El supervisor del SC la revisa primero; si no responde a tiempo, pasa sola al analista.' : 'Aún sin respuesta. El analista responde dentro de 5 días hábiles.')
                          : (d.resolucion || (k === 'aprobada' ? 'Se aprobó lo reclamado.' : k === 'parcial' ? 'Se aprobaron solo algunas líneas.' : k === 'retirada' ? 'Retiraste la diferencia.' : 'No procede.'))}</p>
                        <div className="md-ajuste"><span>Ajuste a tu favor</span><span>{e.curso ? 'Por definir' : money(aprobado)}</span></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </article>
          )
        })}
    </div>
  )
}

const CSS_MD = CSS_MK + `
.md { display:flex; flex-direction:column; gap:16px; font-family:"Open Sans",sans-serif; }
.md-link { border:none; background:none; padding:0; font:inherit; color:#545454; text-decoration:underline; text-underline-offset:3px; cursor:pointer; }
.md-link:hover { color:#002E5D; }
.md-error { background:#FDF1F0; color:#C43D2F; border-radius:10px; padding:10px 12px; font-size:13.5px; }
.segmented { display:flex; gap:4px; padding:4px; background:#fff; border:1px solid #E4E3E3; border-radius:10px; align-self:flex-start; flex-wrap:wrap; }
.segmented button { height:30px; padding:0 14px; border-radius:7px; border:none; font:700 13px Poppins,sans-serif; background:#fff; color:#002E5D; cursor:pointer; }
.segmented [aria-selected="true"] { background:#002E5D; color:#fff; }
.md-vacio { background:#fff; border:1px solid #E4E3E3; border-radius:14px; padding:22px 20px; font-size:14px; color:#545454; box-shadow:0 1px 3px rgba(0,46,93,.05); }
.md-card { background:#fff; border:1px solid #E4E3E3; border-radius:14px; box-shadow:0 1px 3px rgba(0,46,93,.05); transition:box-shadow .2s, transform .2s, border-color .2s; }
.md-card:hover, .md-card.is-open { box-shadow:0 12px 28px rgba(0,46,93,.14); border-color:#B8C4D3; }
.md-card:hover { transform:translateY(-2px); }
.md-top { display:flex; gap:16px; align-items:flex-start; padding:18px 20px; }
.md-titulo { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
.md-titulo .t { font:700 16px Poppins,sans-serif; color:#002E5D; margin-right:2px; }
.md .chip { display:inline-flex; align-items:center; gap:6px; padding:2px 8px; border-radius:6px; background:#F4F5F7; border:1px solid #E4E3E3; font:600 12px Poppins,sans-serif; color:#545454; }
.md .chip .dot { width:7px; height:7px; border-radius:50%; }
.md-meta { font:400 12.5px "Open Sans",sans-serif; color:#545454; margin-top:6px; }
.md-msg { font:400 14px/1.5 "Open Sans",sans-serif; color:#545454; margin-top:4px; }
.md-ver { display:inline-flex; align-items:center; gap:6px; border:none; background:none; padding:4px 0; cursor:pointer; font:400 14px "Open Sans",sans-serif; color:#545454; white-space:nowrap; flex:none; }
.md-ver span { text-decoration:underline; text-underline-offset:3px; }
.md-ver:hover, .md-ver.on { color:#002E5D; }
.md-det { padding:0 20px 20px; }
.md-det-head { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:12px; }
.md-det-head > span { font:700 16px Poppins,sans-serif; color:#002E5D; }
.md-x { width:34px; height:34px; border-radius:50%; border:1px solid #D3DAE3; background:#fff; color:#002E5D; cursor:pointer; display:flex; align-items:center; justify-content:center; }
.md-panel { background:#F4F5F7; border-radius:10px; padding:14px 16px 16px; display:flex; flex-direction:column; gap:12px; }
.md-box { background:#fff; border:1px solid #E4E3E3; border-radius:8px; padding:14px 16px; display:flex; flex-direction:column; gap:10px; min-width:0; }
.md-sub { font:700 12.5px Poppins,sans-serif; letter-spacing:.06em; text-transform:uppercase; color:#545454; }
.md-scroll { overflow-x:auto; }
.md-tabla { min-width:520px; }
.md-th, .md-tr { display:grid; grid-template-columns:110px minmax(0,2.2fr) minmax(90px,.8fr) minmax(90px,.8fr) minmax(100px,.8fr); gap:12px; align-items:center; }
.md-th span { font:700 12.5px Poppins,sans-serif; letter-spacing:.06em; text-transform:uppercase; color:#545454; }
.md-tr { padding:8px 0; border-top:1px solid #EFEDED; font:400 14px "Open Sans",sans-serif; color:#545454; }
.md-th { padding-bottom:4px; }
.md-tr .b { font-weight:700; color:#002E5D; }
.md .r { text-align:right; } .md .c { text-align:center; }
.md .elip { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.md-dos { display:grid; gap:12px; grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr)); }
.md-hist { list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:12px; }
.md-hist li { display:flex; gap:10px; align-items:flex-start; }
.md-hist .dot { width:7px; height:7px; border-radius:50%; background:#002E5D; margin-top:7px; flex:none; }
.md-hist .t { display:block; font:400 14px "Open Sans",sans-serif; color:#545454; }
.md-hist .f { display:block; font:400 12.5px "Open Sans",sans-serif; color:#545454; margin-top:2px; }
.md-resp { margin:0; font:400 14px/1.5 "Open Sans",sans-serif; color:#545454; }
.md-ajuste { display:flex; justify-content:space-between; gap:12px; padding-top:12px; border-top:1px solid #E4E3E3; font:700 14px Poppins,sans-serif; color:#002E5D; }
@media (max-width: 640px) { .md-top { flex-direction:column; gap:8px; } .md-det { padding:0 14px 16px; } }
`
