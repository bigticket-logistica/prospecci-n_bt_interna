// Interrupciones.jsx — Portal Transportista Chile · Cuidado de Activo · Interrupciones de ruta.
// El conductor o la empresa registra cada pausa de la ruta (colación, baño, carga eléctrica) con la hora
// y la ubicación del teléfono, al empezar y al terminar. Reemplaza las tarjetas de Pipefy.
// Brain las cruza con las paradas de Geotab: dentro de los máximos (editables) la parada queda justificada.
// Funciones: fn_portal_cl_interr_patentes / _lista / _iniciar / _terminar (Supabase Chile).
import { useEffect, useState } from 'react'
import { supabaseCL } from './supabaseChile'

const TIPOS = {
  colacion: { t: 'Colación', i: '🍽️', d: 'Hasta 45 min, después de 4 h de ruta o al terminar' },
  bano: { t: 'Baño', i: '🚻', d: 'Hasta 15 min cada vez' },
  carga: { t: 'Carga eléctrica', i: '🔌', d: 'Hasta 45 min, en una estación de carga' },
  aviso: { t: 'Otra detención (avisar)', i: '📝', d: 'Cualquier otra parada fuera de ruta: elige el motivo y explica' },
  desvio: { t: 'Desvío de ruta autorizado', i: '↪️', d: 'Con la captura del WhatsApp donde tu supervisor lo autoriza' },
}
const EST_AVISO = { pendiente: ['Por revisar del supervisor', '#C47A00'], aceptado: ['Aceptado', '#1A7A3C'], rechazado: ['Rechazado', '#B42318'] }
const ubicacion = () => new Promise((ok) => {
  if (!navigator.geolocation) return ok(null)
  navigator.geolocation.getCurrentPosition((p) => ok({ lat: p.coords.latitude, lng: p.coords.longitude }), () => ok(null), { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 })
})
const hora = (s) => s ? new Date(s).toLocaleTimeString('es-CL', { timeZone: 'America/Santiago', hour: '2-digit', minute: '2-digit' }) : '—'
const minutos = (a, b) => Math.max(0, Math.round(((b ? new Date(b) : new Date()) - new Date(a)) / 60000))

export default function Interrupciones() {
  const [patentes, setPatentes] = useState(null)
  const [patente, setPatente] = useState('')
  const [lista, setLista] = useState([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [, setTic] = useState(0)
  const [justifs, setJustifs] = useState([])
  const [aviso, setAviso] = useState(null)   // { justificacion, comentario } mientras se llena el formulario
  const [desvio, setDesvio] = useState(null) // { comentario, archivo } mientras se llena el desvío
  const cargar = async () => {
    const [p, l] = await Promise.all([supabaseCL.rpc('fn_portal_cl_interr_patentes'), supabaseCL.rpc('fn_portal_cl_interr_lista')])
    if (p.error || l.error) { setErr((p.error || l.error).message); return }
    const ps = (p.data || []).map((x) => x.patente)
    setPatentes(ps); setLista(l.data || [])
    setPatente((x) => x || (ps.length === 1 ? ps[0] : ''))
  }
  useEffect(() => {
    cargar()
    supabaseCL.from('ca_justificaciones_cl').select('codigo,nombre').eq('activo', true).neq('codigo', 'SIN_RESPUESTA').order('orden').then(({ data }) => setJustifs(data || []))
    const i = setInterval(() => setTic((t) => t + 1), 30000); return () => clearInterval(i)
  }, [])
  const abierta = lista.find((x) => !x.fin && (!patente || x.patente === patente))
  const avisar = async () => {
    if (!patente) return setErr('Elige primero el vehículo.')
    if (!aviso?.justificacion) return setErr('Elige el motivo.')
    if (!aviso?.comentario?.trim()) return setErr('Escribe un comentario: qué pasó y dónde.')
    setBusy(true); setErr('')
    const u = await ubicacion()
    const { error } = await supabaseCL.rpc('fn_portal_cl_interr_avisar', { p_patente: patente, p_justificacion: aviso.justificacion, p_comentario: aviso.comentario, p_lat: u?.lat ?? null, p_lng: u?.lng ?? null })
    if (error) setErr(error.message); else { setAviso(null); await cargar() }
    setBusy(false)
  }
  const avisarDesvio = async () => {
    if (!patente) return setErr('Elige primero el vehículo.')
    if (!desvio?.archivo) return setErr('Adjunta la captura del WhatsApp donde el supervisor autoriza el desvío.')
    setBusy(true); setErr('')
    try {
      const ext = (desvio.archivo.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
      const path = `desvios/${patente}/${Date.now()}.${ext}`
      const { error: eUp } = await supabaseCL.storage.from('ca-auditorias-cl').upload(path, desvio.archivo, { contentType: desvio.archivo.type || 'image/jpeg', upsert: false })
      if (eUp) throw new Error('No se pudo subir la captura: ' + eUp.message)
      const u = await ubicacion()
      const { error } = await supabaseCL.rpc('fn_portal_cl_interr_desvio', { p_patente: patente, p_comentario: desvio.comentario || null, p_path: path, p_lat: u?.lat ?? null, p_lng: u?.lng ?? null })
      if (error) throw new Error(error.message)
      setDesvio(null); await cargar()
    } catch (e) { setErr(e.message) }
    setBusy(false)
  }
  const iniciar = async (tipo) => {
    if (tipo === 'aviso') { setAviso({ justificacion: '', comentario: '' }); return }
    if (tipo === 'desvio') { setDesvio({ comentario: '', archivo: null }); return }
    if (!patente) return setErr('Elige primero el vehículo.')
    setBusy(true); setErr('')
    const u = await ubicacion()
    const { error } = await supabaseCL.rpc('fn_portal_cl_interr_iniciar', { p_patente: patente, p_tipo: tipo, p_lat: u?.lat ?? null, p_lng: u?.lng ?? null })
    if (error) setErr(error.message); else await cargar()
    setBusy(false)
  }
  const terminar = async (id) => {
    setBusy(true); setErr('')
    const u = await ubicacion()
    const { error } = await supabaseCL.rpc('fn_portal_cl_interr_terminar', { p_id: id, p_lat: u?.lat ?? null, p_lng: u?.lng ?? null })
    if (error) setErr(error.message); else await cargar()
    setBusy(false)
  }
  if (patentes === null) return <div><h1 className="pc-h1">Interrupciones de ruta</h1><div className="pc-card">{err || 'Cargando…'}</div></div>
  return (
    <div>
      <style>{CSS}</style>
      <h1 className="pc-h1">Interrupciones de ruta</h1>
      <div className="pc-sub">Registra cada pausa de la ruta: al empezar pulsa el tipo de pausa y al volver pulsa <b>Terminé</b>. Se guarda la hora y la ubicación del teléfono. Con esto, Bigticket no te pide explicar esas detenciones.</div>
      {err && <div className="pc-card" style={{ background: '#FBE3E0', color: '#C43D2F' }}>{err}</div>}
      {patentes.length === 0 ? <div className="pc-card">No tienes vehículos activos asignados.</div> : (
        <>
          {patentes.length > 1 && (
            <div className="pc-card">
              <label style={{ fontSize: 13, color: '#545454' }}>Vehículo
                <select className="in-sel" value={patente} onChange={(e) => setPatente(e.target.value)}>
                  <option value="">Elige la patente…</option>{patentes.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </label>
            </div>
          )}
          {abierta ? (
            <div className="in-abierta">
              <div className="in-ab-tit">{TIPOS[abierta.tipo]?.i} {TIPOS[abierta.tipo]?.t} en curso · {abierta.patente}</div>
              <div className="in-ab-tiempo">{minutos(abierta.inicio)} min</div>
              <div style={{ fontSize: 13, color: '#545454' }}>Desde las {hora(abierta.inicio)}</div>
              <button className="in-fin" disabled={busy} onClick={() => terminar(abierta.id)}>{busy ? 'Guardando…' : 'Terminé'}</button>
            </div>
          ) : desvio ? (
            <div className="pc-card">
              <div style={{ fontWeight: 700, color: '#002E5D', marginBottom: 8 }}>↪️ Desvío de ruta autorizado</div>
              <label style={{ fontSize: 13, color: '#545454', display: 'block' }}>Captura del WhatsApp del supervisor (obligatoria)
                <input type="file" accept="image/*" style={{ display: 'block', marginTop: 6 }} onChange={(e) => setDesvio({ ...desvio, archivo: e.target.files?.[0] || null })} />
              </label>
              <label style={{ fontSize: 13, color: '#545454', display: 'block', marginTop: 8 }}>Comentario (opcional)
                <textarea className="in-sel" rows={2} value={desvio.comentario} onChange={(e) => setDesvio({ ...desvio, comentario: e.target.value })} placeholder="Adónde vas y por qué" />
              </label>
              <div style={{ fontSize: 12, color: '#777', margin: '6px 0' }}>Se guarda la hora y la ubicación. Tu supervisor lo confirma. Al volver a la ruta pulsa «Terminé».</div>
              <button className="in-fin" disabled={busy || !desvio.archivo} onClick={avisarDesvio}>{busy ? 'Enviando…' : 'Registrar desvío'}</button>
              <button className="in-fin" style={{ background: '#fff', color: '#002E5D', border: '1px solid #002E5D', marginLeft: 8 }} disabled={busy} onClick={() => setDesvio(null)}>Cancelar</button>
            </div>
          ) : aviso ? (
            <div className="pc-card">
              <div style={{ fontWeight: 700, color: '#002E5D', marginBottom: 8 }}>📝 Avisar otra detención</div>
              <label style={{ fontSize: 13, color: '#545454' }}>Motivo
                <select className="in-sel" value={aviso.justificacion} onChange={(e) => setAviso({ ...aviso, justificacion: e.target.value })}>
                  <option value="">Elige el motivo…</option>{justifs.map((j) => <option key={j.codigo} value={j.codigo}>{j.nombre}</option>)}
                </select>
              </label>
              <label style={{ fontSize: 13, color: '#545454', display: 'block', marginTop: 8 }}>Comentario
                <textarea className="in-sel" rows={3} value={aviso.comentario} onChange={(e) => setAviso({ ...aviso, comentario: e.target.value })} placeholder="Qué pasó y dónde" />
              </label>
              <div style={{ fontSize: 12, color: '#777', margin: '6px 0' }}>Se guarda la hora y la ubicación. Tu supervisor lo acepta o lo rechaza. Al volver a la ruta pulsa «Terminé».</div>
              <button className="in-fin" disabled={busy} onClick={avisar}>{busy ? 'Enviando…' : 'Avisar y empezar'}</button>
              <button className="in-fin" style={{ background: '#fff', color: '#002E5D', border: '1px solid #002E5D', marginLeft: 8 }} disabled={busy} onClick={() => setAviso(null)}>Cancelar</button>
            </div>
          ) : (
            <div className="in-botones">
              {Object.entries(TIPOS).map(([k, v]) => (
                <button key={k} className="in-btn" disabled={busy || !patente} onClick={() => iniciar(k)}>
                  <span className="in-ico">{v.i}</span><span className="in-t">{v.t}</span><span className="in-d">{v.d}</span>
                </button>
              ))}
            </div>
          )}
          <div className="pc-mini" style={{ margin: '14px 0 6px', fontWeight: 700, color: '#002E5D' }}>Hoy</div>
          {lista.filter((x) => x.fin).length === 0 ? <div className="pc-card" style={{ color: '#777' }}>Todavía no hay pausas registradas hoy.</div> :
            lista.filter((x) => x.fin).map((x) => (
              <div key={x.id} className="in-fila">
                <span>{TIPOS[x.tipo]?.i} <b>{TIPOS[x.tipo]?.t}</b> · {x.patente}
                  {(x.tipo === 'aviso' || x.tipo === 'desvio') && <><br /><small style={{ color: (EST_AVISO[x.estado_sup] || [])[1] }}>{(EST_AVISO[x.estado_sup] || ['Por revisar'])[0]}{x.nota_sup ? ` · ${x.nota_sup}` : ''}</small></>}</span>
                <span>{hora(x.inicio)} – {hora(x.fin)} · {minutos(x.inicio, x.fin)} min</span>
              </div>
            ))}
        </>
      )}
    </div>
  )
}

const CSS = `
.in-sel { display:block; width:100%; margin-top:6px; padding:10px; border:1px solid #C9C9C9; border-radius:10px; font:inherit; }
.in-botones { display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:10px; margin:12px 0; }
.in-btn { display:flex; flex-direction:column; align-items:center; gap:4px; padding:18px 12px; background:#fff; border:2px solid #002E5D; border-radius:14px; cursor:pointer; }
.in-btn:disabled { opacity:.5; cursor:default; }
.in-ico { font-size:30px; } .in-t { font-family:Poppins,sans-serif; font-weight:700; color:#002E5D; font-size:17px; } .in-d { font-size:12px; color:#545454; text-align:center; }
.in-abierta { background:#FFF4E0; border:2px solid #FF6600; border-radius:14px; padding:18px; text-align:center; margin:12px 0; }
.in-ab-tit { font-family:Poppins,sans-serif; font-weight:700; color:#002E5D; font-size:16px; }
.in-ab-tiempo { font-family:Poppins,sans-serif; font-weight:700; font-size:40px; color:#FF6600; margin:6px 0; }
.in-fin { margin-top:12px; width:100%; max-width:320px; padding:14px; border:none; border-radius:999px; background:#002E5D; color:#fff; font-weight:700; font-size:16px; cursor:pointer; }
.in-fila { display:flex; justify-content:space-between; gap:10px; flex-wrap:wrap; background:#fff; border:1px solid #E4E3E3; border-radius:10px; padding:10px 12px; margin-bottom:6px; font-size:13.5px; }
`
