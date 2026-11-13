// Devoluciones.jsx — Portal Transportista Chile · Cuidado de Activo · Devolver vehículo.
// La empresa avisa que deja una camioneta de Bigticket (motivo, fecha y detalle). Llega al ejecutivo en el Brain y
// por correo, y al supervisor del CECO como tarea en su bitácora. Después se pide la auditoría de entrega en el portal.
// Funciones: fn_portal_cl_interr_patentes (sus vehículos), fn_portal_cl_devolver, fn_portal_cl_devoluciones (Supabase Chile).
import { useEffect, useState } from 'react'
import { supabaseCL } from './supabaseChile'

const MOTIVOS = ['Término del contrato', 'Ya no necesito el vehículo', 'Falla mecánica', 'Siniestro', 'Cambio a otro vehículo', 'Otro']
const ESTADO = { solicitada: ['En revisión', '#FF6600'], en_traspaso: ['Traspaso en curso', '#002E5D'], completada: ['Completada', '#1f7a5c'], rechazada: ['Rechazada', '#C43D2F'] }
const fecha = (s) => s ? new Date(s + (String(s).length === 10 ? 'T12:00:00' : '')).toLocaleDateString('es-CL') : '—'

export default function Devoluciones() {
  const [patentes, setPatentes] = useState(null)
  const [lista, setLista] = useState([])
  const [d, setD] = useState({ patente: '', motivo: '', fecha: '', detalle: '' })
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const cargar = async () => {
    const [p, l] = await Promise.all([supabaseCL.rpc('fn_portal_cl_interr_patentes'), supabaseCL.rpc('fn_portal_cl_devoluciones')])
    if (p.error || l.error) { setErr((p.error || l.error).message); return }
    setPatentes((p.data || []).map((x) => x.patente)); setLista(l.data || [])
  }
  useEffect(() => { cargar() }, [])
  const enviar = async () => {
    setErr(''); setMsg('')
    if (!d.patente || !d.motivo) return setErr('Elige el vehículo y el motivo.')
    setBusy(true)
    const { data, error } = await supabaseCL.rpc('fn_portal_cl_devolver', { p_patente: d.patente, p_motivo: d.motivo, p_fecha: d.fecha || null, p_detalle: d.detalle || null })
    setBusy(false)
    if (error) return setErr(error.message)
    setMsg(`Listo: solicitud ${data} enviada. Bigticket y tu supervisor ya están avisados; te pediremos la auditoría de entrega aquí en el portal.`)
    setD({ patente: '', motivo: '', fecha: '', detalle: '' }); cargar()
  }
  const abiertas = new Set(lista.filter((x) => ['solicitada', 'en_traspaso'].includes(x.estado)).map((x) => x.patente))
  return (
    <div>
      <style>{CSS}</style>
      <h1 className="pc-h1">Devolver vehículo</h1>
      <div className="pc-sub">Si vas a dejar una camioneta de Bigticket, avísanos aquí. Le llega al equipo de Cuidado de Activo y a tu supervisor, y después haces la auditoría de entrega en la pestaña Auditorías.</div>
      {err && <div className="pc-card" style={{ background: '#FBE3E0', color: '#C43D2F' }}>{err}</div>}
      {msg && <div className="pc-card" style={{ background: '#E6F4EA', color: '#1f7a5c' }}>{msg}</div>}
      {patentes === null ? <div className="pc-card">Cargando…</div> : patentes.length === 0 ? <div className="pc-card">No tienes vehículos activos asignados.</div> : (
        <div className="pc-card dv-form">
          <label>Vehículo
            <select value={d.patente} onChange={(e) => setD({ ...d, patente: e.target.value })}>
              <option value="">Elige la patente…</option>
              {patentes.map((p) => <option key={p} value={p} disabled={abiertas.has(p)}>{p}{abiertas.has(p) ? ' · devolución en curso' : ''}</option>)}
            </select>
          </label>
          <label>Motivo
            <select value={d.motivo} onChange={(e) => setD({ ...d, motivo: e.target.value })}>
              <option value="">Elige el motivo…</option>{MOTIVOS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </label>
          <label>¿Qué día lo entregas? <input type="date" value={d.fecha} onChange={(e) => setD({ ...d, fecha: e.target.value })} /></label>
          <label>Detalle (opcional) <textarea rows={3} value={d.detalle} onChange={(e) => setD({ ...d, detalle: e.target.value })} placeholder="Dónde lo dejas, quién lo entrega, etc." /></label>
          <button className="dv-btn" disabled={busy} onClick={enviar}>{busy ? 'Enviando…' : 'Avisar la devolución'}</button>
        </div>
      )}
      <div className="pc-mini" style={{ margin: '14px 0 6px', fontWeight: 700, color: '#002E5D' }}>Mis devoluciones</div>
      {lista.length === 0 ? <div className="pc-card" style={{ color: '#777' }}>Todavía no hay devoluciones.</div> : lista.map((x) => (
        <div key={x.id} className="dv-fila">
          <span><b>{x.patente}</b> · {x.folio} · {x.motivo}<br /><small>Avisada el {fecha(x.solicitado_at)}{x.fecha_entrega ? ` · entrega ${fecha(x.fecha_entrega)}` : ''}{x.destino_empresa ? ` · pasa a ${x.destino_empresa}` : ''}{x.estado === 'rechazada' && x.nota ? ` · ${x.nota}` : ''}</small></span>
          <span style={{ color: (ESTADO[x.estado] || [])[1], fontWeight: 700 }}>{(ESTADO[x.estado] || [x.estado])[0]}</span>
        </div>
      ))}
    </div>
  )
}

const CSS = `
.dv-form label { display:block; font-size:13px; color:#545454; margin-bottom:10px; }
.dv-form select, .dv-form input, .dv-form textarea { display:block; width:100%; margin-top:5px; padding:10px; border:1px solid #C9C9C9; border-radius:10px; font:inherit; box-sizing:border-box; }
.dv-btn { width:100%; padding:13px; border:none; border-radius:999px; background:#002E5D; color:#fff; font-weight:700; font-size:15px; cursor:pointer; }
.dv-btn:disabled { opacity:.6; }
.dv-fila { display:flex; justify-content:space-between; gap:10px; background:#fff; border:1px solid #E4E3E3; border-radius:10px; padding:10px 12px; margin-bottom:6px; font-size:13.5px; }
.dv-fila small { color:#777; }
`
