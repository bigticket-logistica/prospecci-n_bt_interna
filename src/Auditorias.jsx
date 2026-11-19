// ═══════════════════════════════════════════════════════════════════════════
// Auditorias.jsx — Auditorías del portal Chile (pedido 19-11-2026, Paso 1).
//  · Bandeja: lo que la empresa tiene que hacer (fn_portal_cl_aud_bandeja). El chofer
//    delegado ve solo las auditorías de sus camionetas; el dueño ve todas.
//  · Limpieza cada lunes (el mismo día), programada del 1 al 5, y las de evento
//    (vehículo nuevo, inicial chofer, entrada y salida de taller) con su motivo y plazo.
//  · El formulario se dibuja con el mantenedor del Brain (ca_aud_preguntas_cl):
//    bloques, preguntas, obligatorias, dependencias y cuándo se exige foto.
//    Cada «No» o «Deficiente» de estado pide la foto del ítem; los «¿Posee…?» no.
//  · Cada foto se sube apenas se toma (con hora y ubicación); las respuestas se
//    guardan solas. Si se corta la señal, al volver se retoma donde quedó.
//  · «Enviar auditoría» dice qué falta; el envío se valida de nuevo en la base.
//  · Avisos de mantención por kilometraje arriba de la lista («Entendido»).
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useRef, useState } from 'react'
import { supabaseCL } from './supabaseChile'

const BUCKET = 'ca-auditorias-cl'
const fdia = (s) => s ? new Date(s).toLocaleString('es-CL', { timeZone: 'America/Santiago', weekday: 'long', day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''
const fh = (s) => s ? new Date(s).toLocaleString('es-CL', { timeZone: 'America/Santiago', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''

// Reduce la foto a 1600 px de lado mayor, en JPEG (sube rápido con poca señal)
async function comprimir(file) {
  const img = await new Promise((ok, mal) => { const i = new Image(); i.onload = () => ok(i); i.onerror = mal; i.src = URL.createObjectURL(file) })
  const k = Math.min(1, 1600 / Math.max(img.width, img.height))
  const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k)
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
  return await new Promise((ok) => c.toBlob(ok, 'image/jpeg', 0.82))
}
const ubicacion = () => new Promise((ok) => {
  if (!navigator.geolocation) return ok(null)
  navigator.geolocation.getCurrentPosition((p) => ok({ lat: p.coords.latitude, lng: p.coords.longitude }), () => ok(null), { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 })
})

function Contador({ vence, atrasada }) {
  const [ahora, setAhora] = useState(Date.now())
  useEffect(() => { const t = setInterval(() => setAhora(Date.now()), 30000); return () => clearInterval(t) }, [])
  const ms = new Date(vence).getTime() - ahora
  if (ms <= 0 || atrasada) return <span className="au-chip rojo">Venció {fh(vence)}</span>
  const h = Math.floor(ms / 3600000), d = Math.floor(h / 24), m = Math.floor((ms % 3600000) / 60000)
  const txt = d > 0 ? `Quedan ${d} día${d > 1 ? 's' : ''} ${h % 24} h` : h > 0 ? `Quedan ${h} h ${m} min` : `Quedan ${m} min`
  return <span className={`au-chip ${h < 12 ? 'naranja' : 'azul'}`}>{txt}</span>
}

const EST = { pendiente: ['Solicitada', 'azul'], devuelta: ['Devuelta · rehacer', 'rojo'], realizada: ['Realizada · en revisión', 'naranja'], aprobada: ['Aprobada', 'verde'], incumplida: ['Incumplida', 'rojo'], justificada: ['Justificada', 'azul'] }
const OPCIONES = { si_no: ['Sí', 'No'], si_no_na: ['Sí', 'No', 'No aplica'], si_no_notiene: ['Sí', 'No', 'No tiene'], optimo_deficiente: ['Óptimo', 'Deficiente'] }
const guia = (path) => supabaseCL.storage.from('ca-guia-cl').getPublicUrl(path).data.publicUrl
const visible = (p, r) => !p.depende_de || (r[p.depende_de] || '') === (p.depende_valor || '')
const pideFoto = (p, r) => p.foto === 'siempre' || (p.foto === 'si_negativo' && ['No', 'Deficiente'].includes(r[p.codigo]))

export default function Auditorias({ yo }) {
  const [filas, setFilas] = useState(null)
  const [abierta, setAbierta] = useState(null)     // fila de la bandeja (solicitud)
  const [err, setErr] = useState('')
  const [mnt, setMnt] = useState([])
  const cargar = async () => {
    const [{ data, error }, mv] = await Promise.all([supabaseCL.rpc('fn_portal_cl_aud_bandeja'), supabaseCL.rpc('fn_portal_cl_mnt_avisos')])
    setMnt(mv.data || [])
    if (error) { setErr(error.message); setFilas([]) } else setFilas(data || [])
  }
  useEffect(() => { cargar() }, [])

  if (abierta) return <HacerAuditoria s={abierta} yo={yo} onSalir={() => { setAbierta(null); cargar() }} />
  const porHacer = (filas || []).filter((f) => ['pendiente', 'devuelta'].includes(f.estado))
  const incumplidas = (filas || []).filter((f) => f.estado === 'incumplida')
  const hechas = (filas || []).filter((f) => ['realizada', 'aprobada', 'justificada'].includes(f.estado))
  const atrasada = (f) => f.vence_at && new Date(f.vence_at).getTime() < Date.now()

  return (
    <div>
      <style>{CSS_AU}</style>
      <h1 className="pc-h1">Auditorías</h1>
      <div className="pc-sub">
        La <b>limpieza</b> se hace cada lunes (el mismo día) y la <b>programada</b> del 1 al 5 de cada mes. Bigticket también te pide otras: al recibir un vehículo, al dejarlo en el taller o al retirarlo. Toma las fotos con la cámara del teléfono, junto al vehículo.
      </div>
      {err && <div className="pc-card" style={{ background: '#FBE3E0', color: '#C43D2F' }}>{err}</div>}
      {mnt.map((m) => (
        <div key={m.id} className={`au-mnt${m.visto_tercero_at ? ' visto' : ''}`}>
          <div className="au-mnt-tit">🔧 {m.patente} · Mantención de los {Number(m.pauta).toLocaleString('es-CL')} km</div>
          <div className="au-mnt-txt">{m.mensaje}</div>
          {m.taller_detalle && <div className="au-mnt-taller"><b>Taller autorizado:</b>{m.taller_detalle}</div>}
          <div className="au-mnt-pie">
            <span>Aviso del {new Date(m.creado_at).toLocaleDateString('es-CL', { timeZone: 'America/Santiago' })}</span>
            {m.visto_tercero_at
              ? <span>✓ Visto</span>
              : <button onClick={async () => { await supabaseCL.rpc('fn_portal_cl_mnt_visto', { p_id: m.id }); cargar() }}>Entendido</button>}
          </div>
        </div>
      ))}
      <div className="au-resumen">
        <div><b className="naranja">{porHacer.length}</b><span>Por hacer</span></div>
        <div><b className="rojo">{incumplidas.length}</b><span>Incumplidas</span></div>
        <div><b className="verde">{hechas.length}</b><span>Hechas</span></div>
      </div>
      {filas === null ? <div className="pc-card">Cargando…</div> : (
        <>
          {porHacer.length > 0 && <div className="au-titulo">Por hacer</div>}
          {porHacer.map((f) => (
            <div key={f.id} className={`au-fila${atrasada(f) ? ' atrasada' : ''}`}>
              <div style={{ minWidth: 0 }}>
                <div className="au-pat">{f.patente}</div>
                <div className="pc-mini">Auditoría · {f.tipo_nombre}{f.aud_estado === 'borrador' ? ' · en curso' : ''}{f.estado === 'devuelta' ? ' · hay que rehacer' : ''}</div>
                {f.motivo && <div className="pc-mini" style={{ color: '#002E5D' }}>Motivo: {f.motivo}</div>}
              </div>
              <div className="au-der">
                <Contador vence={f.vence_at} atrasada={atrasada(f)} />
                <button className="pc-btn" onClick={() => setAbierta(f)}>{f.aud_estado === 'borrador' || f.estado === 'devuelta' ? 'Continuar' : 'Hacer auditoría'}</button>
              </div>
            </div>
          ))}
          {incumplidas.length > 0 && <div className="au-titulo">Incumplidas</div>}
          {incumplidas.map((f) => (
            <div key={f.id} className="au-fila atrasada">
              <div style={{ minWidth: 0 }}>
                <div className="au-pat">{f.patente}</div>
                <div className="pc-mini">Auditoría · {f.tipo_nombre} · venció el {fh(f.vence_at)}</div>
              </div>
              <div className="au-der"><span className="au-chip rojo">Incumplida</span></div>
            </div>
          ))}
          {hechas.length > 0 && <div className="au-titulo">Hechas</div>}
          {hechas.map((f) => (
            <div key={f.id} className="au-fila">
              <div style={{ minWidth: 0 }}>
                <div className="au-pat">{f.patente}</div>
                <div className="pc-mini">Auditoría · {f.tipo_nombre}{f.hecha_por_nombre ? <> · hecha por <b>{f.hecha_por_nombre}</b></> : ''}{f.enviada_at ? ` el ${fh(f.enviada_at)}` : ''}</div>
              </div>
              <div className="au-der"><span className={`au-chip ${(EST[f.estado] || ['', 'azul'])[1]}`}>{(EST[f.estado] || [f.estado])[0]}</span></div>
            </div>
          ))}
          {filas.length === 0 && <div className="pc-card">No tienes auditorías pendientes.</div>}
        </>
      )}
    </div>
  )
}

function HacerAuditoria({ s, yo, onSalir }) {
  const [id, setId] = useState(null)
  const [d, setD] = useState(null)              // { auditoria, solicitud, preguntas, fotos, vehiculo, activo }
  const [resp, setResp] = useState({})
  const [fotos, setFotos] = useState({})        // codigo → { path, url, biggy_estado, biggy_nota }
  const [busy, setBusy] = useState(false)
  const [subiendo, setSubiendo] = useState('')
  const [err, setErr] = useState('')
  const [listo, setListo] = useState(false)
  const ubic = useRef(null)
  const guardarT = useRef(null)

  useEffect(() => { (async () => {
    const ini = await supabaseCL.rpc('fn_portal_cl_aud_iniciar', { p_solicitud: s.id })
    if (ini.error) { setErr(ini.error.message); return }
    const aid = ini.data; setId(aid)
    const { data, error } = await supabaseCL.rpc('fn_portal_cl_aud_form', { p_id: aid })
    if (error) { setErr(error.message); return }
    setD(data); setResp(data.auditoria?.respuestas || {})
    const fs = {}
    for (const f of data.fotos || []) {
      const { data: u } = await supabaseCL.storage.from(BUCKET).createSignedUrl(f.path, 3600)
      fs[f.item] = { ...f, url: u?.signedUrl }
    }
    setFotos(fs)
    ubicacion().then((u) => { ubic.current = u })
  })() }, [])   // eslint-disable-line react-hooks/exhaustive-deps

  if (err && !d) return <div><style>{CSS_AU}</style><div className="pc-card" style={{ color: '#C43D2F' }}>{err}</div><button className="pc-btn" onClick={onSalir}>Volver</button></div>
  if (!d) return <div className="pc-card">Preparando la auditoría…</div>

  const responder = (codigo, valor) => {
    const nuevo = { ...resp, [codigo]: valor }
    setResp(nuevo)
    clearTimeout(guardarT.current)
    guardarT.current = setTimeout(() => { supabaseCL.rpc('fn_portal_cl_aud_guardar', { p_id: id, p_respuestas: nuevo }).then(({ error }) => error && setErr(error.message)) }, 600)
  }
  const tomar = async (codigo, file) => {
    if (!file) return
    setSubiendo(codigo); setErr('')
    try {
      const blob = await comprimir(file)
      const path = `${yo.rut}/${id}/${codigo}_${Date.now()}.jpg`
      const up = await supabaseCL.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg', upsert: false })
      if (up.error) throw new Error('No se pudo subir la foto: ' + up.error.message)
      if (!ubic.current) ubic.current = await ubicacion()
      const { error } = await supabaseCL.rpc('fn_portal_cl_auditoria_foto', { p_id: id, p_item: codigo, p_path: path, p_lat: ubic.current?.lat ?? null, p_lng: ubic.current?.lng ?? null })
      if (error) throw new Error(error.message)
      setFotos((f) => ({ ...f, [codigo]: { path, url: URL.createObjectURL(blob) } }))
    } catch (x) { setErr(x.message || 'No se pudo guardar la foto. Revisa tu señal e inténtalo de nuevo.') }
    finally { setSubiendo('') }
  }

  const veh = d.vehiculo || {}, act = d.activo || {}
  const auto = (codigo) => ({
    tipo_auditoria: d.solicitud?.tipo_nombre || s.tipo_nombre,
    patente: d.auditoria.patente,
    tipo_vehiculo: [veh.tipo_vehiculo || veh.tipo || act.tipo, veh.marca || act.marca, veh.modelo || act.modelo].filter(Boolean).join(' · ') || '—',
    supervisor: act.supervisor || veh.supervisor || '—',
  }[codigo] ?? '—')
  const vis = d.preguntas.filter((p) => visible(p, resp))
  const faltan = []
  for (const p of vis) {
    if (p.obligatoria && !['auto', 'foto'].includes(p.tipo) && !String(resp[p.codigo] ?? '').trim()) faltan.push({ p, que: 'respuesta' })
    if (pideFoto(p, resp) && !fotos[p.codigo]) faltan.push({ p, que: 'foto' })
  }
  const nFotos = faltan.filter((x) => x.que === 'foto').length, nResp = faltan.filter((x) => x.que === 'respuesta').length
  const enviar = async () => {
    setErr(''); setBusy(true)
    clearTimeout(guardarT.current)
    const g = await supabaseCL.rpc('fn_portal_cl_aud_guardar', { p_id: id, p_respuestas: resp })
    if (g.error) { setBusy(false); return setErr(g.error.message) }
    const { error } = await supabaseCL.rpc('fn_portal_cl_aud_enviar', { p_id: id })
    setBusy(false)
    if (error) setErr(error.message); else setListo(true)
  }

  if (listo) return (
    <div>
      <style>{CSS_AU}</style>
      <div className="pc-card" style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 40 }}>✅</div>
        <div className="au-item">Auditoría enviada</div>
        <div className="au-inst">Biggy la revisa y te avisaremos si hay que rehacer alguna foto.</div>
        <button className="pc-btn" onClick={onSalir}>Volver a mis auditorías</button>
      </div>
    </div>
  )

  const bloques = [...new Set(vis.map((p) => p.bloque))]
  const FotoCampo = ({ p, etiqueta }) => {
    const f = fotos[p.codigo]
    return (
      <div className="au-fcampo">
        <div className="au-fcampo-tit">{etiqueta}{pideFoto(p, resp) && !f && <span className="rojo"> — obligatoria</span>}</div>
        {f?.url ? <img className="au-fmini" src={f.url} alt={p.texto} /> : null}
        {f?.biggy_estado === 'rehacer' && <div className="au-rehacer">Hay que repetir esta foto{f.biggy_nota ? `: ${f.biggy_nota}` : ''}</div>}
        {(p.guia_si || p.guia_no) && (
          <div className="au-ej">
            {p.guia_si && <div className="au-ej-card si"><span className="au-ej-tit">Así sí</span><img src={guia(p.guia_si)} alt="Así sí" /></div>}
            {p.guia_no && <div className="au-ej-card no"><span className="au-ej-tit">Así no</span><img src={guia(p.guia_no)} alt="Así no" /></div>}
          </div>
        )}
        <label className={`pc-btn au-fbtn${subiendo === p.codigo ? ' off' : ''}`}>
          {subiendo === p.codigo ? 'Subiendo…' : f ? 'Repetir foto' : '📷 Tomar foto'}
          <input type="file" accept="image/*" capture={/selfie|responsable/.test(p.codigo) ? 'user' : 'environment'} style={{ display: 'none' }} disabled={!!subiendo} onChange={(e) => { const x = e.target.files?.[0]; e.target.value = ''; tomar(p.codigo, x) }} />
        </label>
      </div>
    )
  }
  return (
    <div>
      <style>{CSS_AU}</style>
      <button className="au-volver" onClick={onSalir}>← Mis auditorías</button>
      <div className="au-cab">
        <div><div className="au-pat">{d.auditoria.patente}</div><div className="pc-mini">Auditoría · {d.solicitud?.tipo_nombre || s.tipo_nombre}</div></div>
        {d.solicitud?.vence_at && <Contador vence={d.solicitud.vence_at} atrasada={new Date(d.solicitud.vence_at).getTime() < Date.now()} />}
      </div>
      {d.auditoria.estado === 'rehacer' && <div className="au-rehacer">Bigticket devolvió esta auditoría{d.auditoria.revision_nota ? `: ${d.auditoria.revision_nota}` : '.'} Corrige lo indicado y vuelve a enviarla.</div>}
      {d.solicitud?.motivo && <div className="pc-mini" style={{ color: '#002E5D', marginBottom: 10 }}>Motivo: {d.solicitud.motivo}</div>}
      {bloques.map((b) => (
        <div key={b} className="au-check">
          <div className="au-check-tit">{b}</div>
          {vis.filter((p) => p.bloque === b).map((p) => (
            <div key={p.codigo} className="au-preg2">
              {p.tipo === 'auto' ? (
                <div className="au-preg"><span>{p.texto}</span><b>{auto(p.codigo)}</b></div>
              ) : p.tipo === 'foto' ? (
                <FotoCampo p={p} etiqueta={p.texto} />
              ) : (
                <>
                  <div className="au-preg">
                    <span>{p.texto}{p.obligatoria && <span className="rojo"> *</span>}</span>
                    {OPCIONES[p.tipo] || p.tipo === 'opcion' ? (
                      <div className="au-sino">
                        {(OPCIONES[p.tipo] || p.opciones || []).map((o) => (
                          <button key={o} className={resp[p.codigo] === o ? (['No', 'Deficiente'].includes(o) ? 'no' : 'si') : ''} onClick={() => responder(p.codigo, o)}>{o}</button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  {p.tipo === 'km' && <label className="au-km">Kilometraje del tablero<input inputMode="numeric" value={resp[p.codigo] || ''} onChange={(e) => responder(p.codigo, e.target.value.replace(/\D/g, ''))} placeholder="Ej: 88450" /></label>}
                  {p.tipo === 'texto' && <textarea className="au-obs" rows={3} value={resp[p.codigo] || ''} onChange={(e) => responder(p.codigo, e.target.value)} placeholder={p.ayuda || 'Escribe aquí'} />}
                  {p.tipo === 'fecha' && <input type="date" className="au-obs" value={resp[p.codigo] || ''} onChange={(e) => responder(p.codigo, e.target.value)} />}
                  {pideFoto(p, resp) && <FotoCampo p={p} etiqueta={p.tipo === 'km' ? 'Foto del odómetro' : `Fotografía de «${p.texto.replace(/[¿?]/g, '')}»`} />}
                </>
              )}
            </div>
          ))}
        </div>
      ))}
      {err && <div className="au-error">{err}</div>}
      <div className="au-botones">
        <button className="pc-btn au-grande" disabled={busy || faltan.length > 0} onClick={enviar}>
          {busy ? 'Enviando…' : faltan.length === 0 ? 'Enviar auditoría' : `Enviar auditoría — falta${faltan.length > 1 ? 'n' : ''} ${[nFotos ? `${nFotos} fotografía${nFotos > 1 ? 's' : ''}` : '', nResp ? `${nResp} respuesta${nResp > 1 ? 's' : ''}` : ''].filter(Boolean).join(' y ')}`}
        </button>
      </div>
      {faltan.length > 0 && <div className="au-ayuda-tip" style={{ marginTop: 6 }}>Falta: {faltan.slice(0, 6).map((x) => (x.que === 'foto' ? 'foto de ' : '') + '«' + x.p.texto.replace(/[¿?]/g, '') + '»').join(', ')}{faltan.length > 6 ? '…' : ''}</div>}
    </div>
  )
}

const CSS_AU = `
.au-preg2 { border-bottom:1px solid #F1F1F1; padding:4px 0; } .au-preg2:last-child { border-bottom:none; }
.au-fcampo { display:flex; flex-direction:column; gap:6px; padding:8px 0; }
.au-fcampo-tit { font-size:13.5px; color:#333; font-weight:600; }
.au-fmini { width:100%; max-width:320px; max-height:220px; object-fit:contain; border-radius:10px; background:#F4F3F3; }
.au-fbtn { align-self:flex-start; cursor:pointer; } .au-fbtn.off { opacity:.6; pointer-events:none; }
.au-resumen { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin-bottom:18px; }
.au-resumen div { background:#fff; border:1px solid #E4E3E3; border-radius:14px; padding:12px 14px; display:flex; flex-direction:column; }
.au-resumen b { font-family:Poppins,sans-serif; font-size:24px; }
.au-resumen span { font-size:12.5px; color:#545454; }
.au-check { border:1px solid #E4E3E3; border-radius:12px; padding:10px 12px; margin:12px 0; }
.au-check-tit { font-family:Poppins,sans-serif; font-weight:600; color:#002E5D; margin-bottom:6px; }
.au-preg { display:flex; align-items:center; justify-content:space-between; gap:10px; padding:8px 0; border-bottom:1px solid #F1F1F1; flex-wrap:wrap; }
.au-preg:last-child { border-bottom:none; }
.au-sino { display:flex; gap:6px; }
.au-sino button { min-width:56px; padding:8px 12px; border-radius:10px; border:1px solid #C9C9C9; background:#fff; font-weight:600; cursor:pointer; }
.au-sino button.si { background:#1A7A3C; border-color:#1A7A3C; color:#fff; }
.au-sino button.no { background:#C43D2F; border-color:#C43D2F; color:#fff; }
.au-obs { width:100%; box-sizing:border-box; margin-top:8px; padding:10px; border:1px solid #C9C9C9; border-radius:10px; font:inherit; }
.naranja { color:#FF6600; } .rojo { color:#C43D2F; } .verde { color:#1A7A3C; }
.au-titulo { font-family:Poppins,sans-serif; font-weight:700; font-size:12px; letter-spacing:.08em; text-transform:uppercase; color:#8B8B8B; margin:16px 4px 8px; }
.au-fila { background:#fff; border:1px solid #E4E3E3; border-radius:14px; padding:12px 14px; display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:8px; flex-wrap:wrap; }
.au-fila.atrasada { border-color:#F3C4BE; background:#FFF8F7; }
.au-pat { font-family:Poppins,sans-serif; font-weight:700; font-size:17px; color:#002E5D; letter-spacing:.04em; }
.au-der { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
.au-chip { font-size:12px; font-weight:700; border-radius:999px; padding:4px 10px; white-space:nowrap; }
.au-chip.azul { background:#EEF2F8; color:#002E5D; } .au-chip.naranja { background:#FFF1E6; color:#B45309; } .au-chip.rojo { background:#FBE3E0; color:#C43D2F; } .au-chip.verde { background:#E8F4EC; color:#1A7A3C; }
.au-volver { background:none; border:none; color:#002E5D; font-weight:700; cursor:pointer; padding:0; margin-bottom:12px; font-size:14px; }
.au-cab { display:flex; justify-content:space-between; align-items:center; gap:10px; margin-bottom:10px; flex-wrap:wrap; }
.au-barra { height:6px; background:#E4E3E3; border-radius:3px; overflow:hidden; margin-bottom:10px; }
.au-barra div { height:100%; background:#FF6600; transition:width .3s; }
.au-pasos { display:flex; gap:6px; flex-wrap:wrap; margin-bottom:12px; }
.au-punto { width:30px; height:30px; border-radius:50%; border:1px solid #E4E3E3; background:#fff; font-size:12px; font-weight:700; color:#8B8B8B; cursor:pointer; }
.au-punto.ok { background:#E8F4EC; border-color:#1A7A3C; color:#1A7A3C; }
.au-punto.rehacer { background:#FBE3E0; border-color:#C43D2F; color:#C43D2F; }
.au-punto.on { outline:2px solid #FF6600; outline-offset:1px; }
.au-item { font-family:Poppins,sans-serif; font-weight:700; font-size:20px; color:#002E5D; margin:2px 0 4px; }
.au-inst { color:#545454; font-size:14px; margin-bottom:12px; }
.au-ayuda { margin:-4px 0 12px; }
.au-ayuda-btn { background:none; border:none; padding:4px 0; color:#002E5D; font-weight:700; font-size:14px; cursor:pointer; font-family:inherit; }
.au-ayuda-caja { background:#F4F7FB; border:1px solid #DCE4EF; border-radius:10px; padding:10px 12px; font-size:13.5px; line-height:1.45; display:flex; flex-direction:column; gap:6px; }
.au-ayuda-ok b { color:#1A7A3C; } .au-ayuda-mal b { color:#C43D2F; }
.au-ej { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
.au-ej-card { display:flex; flex-direction:column; gap:4px; padding:6px; border-radius:10px; background:#fff; cursor:zoom-in; font-family:inherit; text-align:left; min-width:0; }
.au-ej-card.si { border:2px solid #1A7A3C; } .au-ej-card.no { border:2px solid #C43D2F; }
.au-ej-tit { font-weight:700; font-size:13px; } .au-ej-card.si .au-ej-tit { color:#1A7A3C; } .au-ej-card.no .au-ej-tit { color:#C43D2F; }
.au-ej-card img { width:100%; aspect-ratio:4/3; object-fit:contain; background:#1d2733; border-radius:6px; }
.au-ej-mas { font-size:12px; color:#002E5D; font-weight:600; }
.au-ej-modal { position:fixed; inset:0; background:rgba(0,20,40,.92); z-index:1000; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:10px; color:#fff; font-size:14px; padding:16px; }
.au-ej-modal img { max-width:100%; max-height:72vh; object-fit:contain; border-radius:10px; }
.au-ej-modal-tit { font-weight:700; }
.au-ej-modal-nav { display:flex; gap:8px; }
.au-ej-modal-nav button { background:#fff; color:#002E5D; border:none; border-radius:999px; padding:10px 16px; font-weight:700; font-family:inherit; cursor:pointer; }
.au-ayuda-tip { color:#545454; font-size:12.5px; }
.au-mnt { background:#FFF4E0; border:1px solid #F2C27A; border-left:5px solid #FF6600; border-radius:12px; padding:12px 14px; margin:10px 0; }
.au-mnt.visto { background:#fff; border-color:#E4E3E3; border-left-color:#C9C9C9; }
.au-mnt-tit { font-family:Poppins,sans-serif; font-weight:700; color:#002E5D; font-size:15px; }
.au-mnt-txt { font-size:14px; margin-top:4px; color:#333; }
.au-mnt-taller { font-size:13px; margin-top:6px; color:#545454; white-space:pre-line; }
.au-mnt-pie { display:flex; justify-content:space-between; align-items:center; margin-top:8px; font-size:12px; color:#777; gap:8px; }
.au-mnt-pie button { background:#002E5D; color:#fff; border:none; border-radius:999px; padding:8px 16px; font-weight:700; font-family:inherit; cursor:pointer; }
.au-rehacer { background:#FBE3E0; color:#C43D2F; border-radius:10px; padding:8px 12px; font-size:13px; margin-bottom:10px; }
.au-foto { width:100%; max-height:52vh; object-fit:contain; border-radius:12px; background:#F4F3F3; display:block; }
.au-vacio { height:200px; border:2px dashed #E4E3E3; border-radius:12px; display:flex; align-items:center; justify-content:center; font-size:48px; color:#C9C9C9; }
.au-error { background:#FBE3E0; color:#C43D2F; border-radius:10px; padding:8px 12px; font-size:13px; margin-top:10px; }
.au-botones { display:flex; gap:8px; margin-top:12px; flex-wrap:wrap; }
.au-grande { flex:1; padding:14px 18px; font-size:15px; min-width:180px; }
.au-sig { background:#FF6600; padding:14px 18px; font-size:15px; }
.au-km { display:flex; flex-direction:column; gap:4px; font-size:13px; color:#545454; margin:6px 0 14px; }
.au-km input { border:1px solid #E4E3E3; border-radius:10px; padding:12px; font-size:18px; font-family:inherit; }
.au-galeria { display:grid; grid-template-columns:repeat(auto-fill,minmax(96px,1fr)); gap:8px; margin-bottom:14px; }
.au-mini { border:1px solid #E4E3E3; border-radius:10px; background:#fff; padding:4px; cursor:pointer; display:flex; flex-direction:column; gap:4px; }
.au-mini img { width:100%; height:70px; object-fit:cover; border-radius:6px; }
.au-mini span { height:70px; display:flex; align-items:center; justify-content:center; background:#FBE3E0; color:#C43D2F; border-radius:6px; font-size:12px; font-weight:700; }
.au-mini small { font-size:10.5px; color:#545454; text-align:center; line-height:1.2; }
`
