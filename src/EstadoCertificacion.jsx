// ═══════════════════════════════════════════════════════════════════════════
// EstadoCertificacion.jsx — Certificación › Estado de certificación
// Maqueta 8.9.20. Tabla con Tipo · Nombre/Placa · (Cargar) · Site · F. envío ·
// Estado · Documentos; detalle de documentos por fila (una abierta a la vez),
// modal "Cargar documento", visor "Ver" y mensaje "Documento cargado
// exitosamente." (5 s). Datos: certificaciones + certificacion_documentos +
// notificaciones_terceros (observaciones del equipo).
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useRef, useState } from 'react'
import { supabase, BUCKET } from './supabaseClient'

const TIPO_LABEL = { conductor: 'Conductor', ayudante: 'Ayudante', vehiculo: 'Vehículo' }
// Documentos que pide cada certificación (mismos tipos que usan los formularios, el Brain y Biggy)
const DOCS_POR_TIPO = {
  conductor: ['ine', 'ine_reverso', 'curp', 'rfc', 'licencia'],
  ayudante: ['ine', 'ine_reverso', 'curp', 'rfc'],
  vehiculo: ['foto_frente', 'foto_trasera', 'foto_lado_izq', 'foto_lado_der', 'tarjeta_circulacion', 'poliza_seguro'],
}
const DOC_LABEL = {
  ine: 'INE frente', ine_reverso: 'INE reverso', curp: 'CURP', rfc: 'RFC', licencia: 'Licencia',
  foto_frente: 'Foto frente', foto_trasera: 'Foto trasera', foto_lado_izq: 'Foto lado izquierdo', foto_lado_der: 'Foto lado derecho',
  tarjeta_circulacion: 'Tarjeta de circulación', poliza_seguro: 'Póliza de seguro', otro: 'Otro documento',
}
// Palabras para ubicar una observación del equipo en su documento
const DOC_CLAVES = {
  ine: ['ine frente', 'ine (frente)', 'ine — frente', 'credencial'], ine_reverso: ['reverso'], curp: ['curp'], rfc: ['rfc'], licencia: ['licencia'],
  foto_frente: ['foto frente', 'frontal', 'foto — frente'], foto_trasera: ['trasera', 'posterior'], foto_lado_izq: ['lado izquierdo', 'izquierd'], foto_lado_der: ['lado derecho', 'derech'],
  tarjeta_circulacion: ['tarjeta', 'circulación', 'circulacion'], poliza_seguro: ['póliza', 'poliza', 'seguro'],
}
const tipoLimpio = (t) => String(t || '').replace(/_\d{10,}$/, '')
const fDia = (x) => x ? new Date(x).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'
const norm = (x) => Array.isArray(x) ? x[0] : x
const AVISO = {
  aceptado_con_observacion: 'Rechazado por MELI. Riesgo de bloqueo.',
  certificacion_incompleta: 'Faltan datos o documentos. Haz clic para continuar solicitud.',
}

// Estado de la maqueta a partir de la etapa del Kanban y las observaciones
function estadoDe(c, obs, faltan) {
  const etapa = c.etapa_kanban || ({ enviado: 'recepcion', en_validacion: 'validacion_meli', validado: 'aceptado', con_alertas: 'aceptado', certificado: 'aceptado', rechazado: 'rechazado' }[c.estado]) || 'recepcion'
  if (c.estado === 'borrador') return 'certificacion_incompleta'
  if (etapa === 'rechazado') return 'rechazado'
  if (etapa === 'aceptado') return c.estado === 'con_alertas' ? 'aceptado_con_observacion' : 'aceptado'
  if (faltan > 0 || (obs && obs.length)) return 'certificacion_incompleta'
  return 'en_validacion'
}
const ESTADO_TXT = { aceptado: 'Aceptado', aceptado_con_observacion: 'Aceptado con observación', rechazado: 'Rechazado', certificacion_incompleta: 'Certificación incompleta', en_validacion: 'En validación' }

const IcoInfo = () => <svg className="ec-ico" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></svg>
const IcoFlecha = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="m6 9 6 6 6-6" /></svg>
const IcoSubir = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" /></svg>
const IcoCheck = ({ s = 22 }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="#002E5D" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>

export default function EstadoCertificacion({ tercero, email, onBack, onIr }) {
  const [rows, setRows] = useState(null)
  const [docsPor, setDocsPor] = useState({})
  const [obsPor, setObsPor] = useState({})
  const [abierta, setAbierta] = useState(null)
  const [fijado, setFijado] = useState(null)        // tooltip fijado con clic
  const [modal, setModal] = useState(null)          // { cert, tipo, doc }
  const [visor, setVisor] = useState(null)          // { titulo, archivo, url, esPdf }
  const [toast, setToast] = useState('')
  const [err, setErr] = useState('')

  const cargar = async () => {
    setErr('')
    let { data, error } = await supabase.from('certificaciones')
      .select('id, tipo, estado, etapa_kanban, service_center, created_at, cambios_prospecto, certificacion_conductor(nombre,curp), certificacion_vehiculo(placa,marca,modelo)')
      .eq('tercero_id', tercero.tercero_id).order('created_at', { ascending: false })
    if (error) {
      ({ data, error } = await supabase.from('certificaciones')
        .select('id, tipo, estado, etapa_kanban, service_center, created_at, certificacion_conductor(nombre,curp), certificacion_vehiculo(placa,marca,modelo)')
        .eq('tercero_id', tercero.tercero_id).order('created_at', { ascending: false }))
    }
    if (error) { setErr('No se pudieron cargar tus certificaciones: ' + error.message); setRows([]); return }
    const ids = (data || []).map((r) => r.id)
    const docs = {}, obs = {}
    if (ids.length) {
      const [d, o] = await Promise.all([
        supabase.from('certificacion_documentos').select('*').in('certificacion_id', ids),
        supabase.from('notificaciones_terceros').select('registro_id, items, created_at').eq('fuente', 'certificaciones').in('registro_id', ids).order('created_at', { ascending: false }),
      ])
      for (const x of d.data || []) (docs[x.certificacion_id] = docs[x.certificacion_id] || []).push(x)
      for (const x of o.data || []) if (!obs[x.registro_id]) obs[x.registro_id] = (Array.isArray(x.items) ? x.items : []).map(String)
    }
    setDocsPor(docs); setObsPor(obs)
    // Borradores primero (Certificación incompleta con la fecha de guardado)
    const { data: bor } = await supabase.from('certificacion_borradores').select('*').eq('tercero_id', tercero.tercero_id)
    const borr = (bor || []).map((b) => ({
      id: `borrador-${b.tipo}`, tipo: b.tipo, estado: 'borrador', borrador: true, service_center: b.campos?.sc || null, created_at: b.actualizado_at,
      certificacion_conductor: [{ nombre: b.campos?.nombre || 'Sin nombre' }],
      certificacion_vehiculo: [{ placa: b.campos?.placa || 'Vehículo', marca: b.campos?.marca || '', modelo: b.campos?.modelo || '' }],
    }))
    const lista = [...borr, ...(data || []).map((r) => ({ ...r, borrador: r.estado === 'borrador' }))]
    lista.sort((a, b) => (b.borrador - a.borrador) || (new Date(b.created_at) - new Date(a.created_at)))
    setRows(lista)
  }
  useEffect(() => { cargar() }, [tercero])   // eslint-disable-line react-hooks/exhaustive-deps

  // Documentos de una solicitud: los que pide su tipo + los extra que tenga
  const docsDe = (c) => {
    const subidos = docsPor[c.id] || []
    const obs = obsPor[c.id] || []
    const pide = DOCS_POR_TIPO[c.tipo] || []
    const extra = [...new Set(subidos.map((d) => tipoLimpio(d.tipo_documento)).filter((t) => !pide.includes(t)))]
    return [...pide, ...extra].map((t) => {
      const doc = [...subidos].filter((d) => tipoLimpio(d.tipo_documento) === t).sort((a, b) => new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0))[0] || null
      const claves = DOC_CLAVES[t] || []
      const ob = obs.find((x) => claves.some((k) => x.toLowerCase().includes(k)))
      // Al cargar o reemplazar el documento, su observación se borra de la pantalla
      return { tipo: t, doc, obs: doc?._limpio ? null : ob || null }
    })
  }

  const registrarCambio = async (cert, entrada) => {
    const log = [...(cert.cambios_prospecto || []), { ...entrada, at: new Date().toISOString(), por: email || '' }]
    await supabase.from('certificaciones').update({ cambios_prospecto: log, cambios_pendientes: true }).eq('id', cert.id)
    setRows((rs) => rs.map((r) => (r.id === cert.id ? { ...r, cambios_prospecto: log } : r)))
  }

  const subir = async (file) => {
    const { cert, tipo, doc } = modal
    const ext = (file.name.split('.').pop() || 'pdf').toLowerCase()
    const path = `${tercero.tercero_id}/${cert.id}/${tipo}_${Date.now()}.${ext}`
    const up = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true })
    if (up.error) throw new Error(up.error.message)
    if (doc) {
      let { error } = await supabase.from('certificacion_documentos').update({ storage_path: path, updated_at: new Date().toISOString(), subido_por: email || null }).eq('id', doc.id)
      if (error) ({ error } = await supabase.from('certificacion_documentos').update({ storage_path: path }).eq('id', doc.id))
      if (error) throw new Error('El archivo subió pero no se registró: ' + error.message)
      await registrarCambio(cert, { tipo: 'documento', campo: tipo, accion: 'reemplazado', doc_id: doc.id, storage_path: path })
    } else {
      let r = await supabase.from('certificacion_documentos').insert({ certificacion_id: cert.id, tipo_documento: tipo, storage_path: path, subido_por: email || null }).select('*').single()
      if (r.error) r = await supabase.from('certificacion_documentos').insert({ certificacion_id: cert.id, tipo_documento: tipo, storage_path: path }).select('*').single()
      if (r.error) throw new Error('El archivo subió pero no se registró: ' + r.error.message)
      await registrarCambio(cert, { tipo: 'documento', campo: tipo, accion: 'cargado', doc_id: r.data?.id || null, storage_path: path })
    }
    // Recarga los documentos de esa solicitud y borra su observación en pantalla
    const { data } = await supabase.from('certificacion_documentos').select('*').eq('certificacion_id', cert.id)
    setDocsPor((p) => ({ ...p, [cert.id]: (data || []).map((d) => (tipoLimpio(d.tipo_documento) === tipo ? { ...d, _limpio: true } : d)) }))
    setModal(null)
    setToast('Documento cargado exitosamente.')
    setTimeout(() => setToast(''), 5000)
  }

  const ver = async (titulo, doc) => {
    if (!doc) { setVisor({ titulo, archivo: '', url: null }); return }
    const { data } = await supabase.storage.from(BUCKET).createSignedUrl(doc.storage_path, 600)
    const archivo = String(doc.storage_path).split('/').pop()
    const ext = archivo.split('.').pop().toLowerCase()
    setVisor({ titulo, archivo, url: data?.signedUrl || null, esPdf: ext === 'pdf', esImg: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic'].includes(ext) })
  }

  const irCertificar = (c) => onIr && onIr(c.tipo)
  const hayAbierta = rows && rows.some((r) => r.id === abierta)

  return (
    <div className="ec">
      <style>{CSS_EC}</style>
      <nav className="ec-ruta" aria-label="Ruta">
        <button className="ec-volver" onClick={onBack}>← Volver</button>
        <span className="ec-sep" />
        <button className="ec-miga" onClick={onBack}>Inicio</button><span className="ec-gt">›</span>
        <span>Certificación</span><span className="ec-gt">›</span>
        <span aria-current="page">Estado de certificación</span>
      </nav>
      <h1 className="ec-titulo">Estado de certificación</h1>
      <p className="ec-desc">Revisa el estatus de los conductores, ayudantes y vehículos en proceso de validación.</p>
      {err && <div className="ec-error">{err}</div>}

      <div className="ec-box">
        <div className="ec-scroll">
          <div className={`ec-tabla${hayAbierta ? ' has-open' : ''}`} role="table">
            <div className="ec-head" role="row">
              <span>Tipo</span><span>Nombre / Placa</span>{hayAbierta && <span className="c">Cargar</span>}
              <span className="c">Site</span><span className="c">F. envío</span><span>Estado</span><span className="c">Documentos</span>
            </div>
            {rows === null ? <div className="ec-vacio">Cargando…</div>
              : rows.length === 0 ? <div className="ec-vacio">Todavía no tienes certificaciones. Empieza en Certificación › Certificar.</div>
              : rows.map((c) => {
                const v = norm(c.certificacion_vehiculo), p = norm(c.certificacion_conductor)
                const nombre = c.tipo === 'vehiculo' ? [v?.placa || 'Vehículo', [v?.marca, v?.modelo].filter(Boolean).join(' ')].filter(Boolean).join(' · ') : (p?.nombre || 'Sin nombre')
                const docs = docsDe(c)
                const faltan = docs.filter((d) => !d.doc).length
                const est = estadoDe(c, obsPor[c.id], faltan)
                const abierto = abierta === c.id
                const conIco = est === 'aceptado_con_observacion' || est === 'certificacion_incompleta'
                return (
                  <div key={c.id}>
                    <div className={`ec-fila${abierto ? ' is-open' : ''}`} role="row">
                      <span className="ec-tipo">{TIPO_LABEL[c.tipo] || c.tipo}</span>
                      <span className="ec-dato ec-nombre" title={nombre}>{nombre}</span>
                      {hayAbierta && <span />}
                      <span className="ec-dato c">{c.service_center || '—'}</span>
                      <span className="ec-dato c">{fDia(c.created_at)}</span>
                      <span className="ec-estado-celda">
                        {conIco ? (
                          <span className="ec-tip-wrap">
                            <button className="ec-estado-btn" aria-describedby={`tip-${c.id}`}
                              onClick={() => est === 'certificacion_incompleta' ? irCertificar(c) : setFijado(fijado === c.id ? null : c.id)}>
                              <span className="txt">{ESTADO_TXT[est]}</span><IcoInfo />
                            </button>
                            <span id={`tip-${c.id}`} role="tooltip" className={`ec-tip${fijado === c.id ? ' fijo' : ''}`}>
                              {est === 'aceptado_con_observacion' && obsPor[c.id]?.length ? obsPor[c.id][0] : AVISO[est]}
                            </span>
                          </span>
                        ) : <span className={`ec-estado${est === 'rechazado' ? ' is-rej' : ''}`}>{ESTADO_TXT[est]}</span>}
                      </span>
                      <span className="c">
                        {c.borrador
                          ? <button className="ec-link" onClick={() => irCertificar(c)}>Continuar solicitud <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="m9 6 6 6-6 6" /></svg></button>
                          : <button className="ec-link" aria-expanded={abierto} onClick={() => setAbierta(abierto ? null : c.id)}>{abierto ? 'Cerrar' : 'Ver documentos'} <IcoFlecha /></button>}
                      </span>
                    </div>
                    {abierto && (
                      <div className="ec-docs">
                        {docs.map((d) => (
                          <div key={d.tipo} className="ec-doc">
                            <span className="ec-doc-nombre">{DOC_LABEL[d.tipo] || d.tipo.replace(/_/g, ' ')}
                              {d.obs && <span className="ec-obs">{d.obs}</span>}
                            </span>
                            <span className="c">
                              {d.doc && !d.obs ? <span className="ec-cargado" title="Cargado"><IcoCheck /></span>
                                : <button className="ec-btn-cargar" aria-label={`Cargar ${DOC_LABEL[d.tipo]}`} onClick={() => setModal({ cert: c, tipo: d.tipo, doc: d.doc })}><IcoSubir /></button>}
                            </span>
                            <span /><span /><span />
                            <span className="c ec-acciones">
                              <button className="ec-link-acc" onClick={() => ver(DOC_LABEL[d.tipo] || d.tipo, d.doc)}>Ver</button>
                              {d.doc && <button className="ec-link-acc" onClick={() => setModal({ cert: c, tipo: d.tipo, doc: d.doc })}>Reemplazar</button>}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
          </div>
        </div>
      </div>

      {modal && <ModalCargar titulo={DOC_LABEL[modal.tipo] || modal.tipo} onCerrar={() => setModal(null)} onCargar={subir} />}
      {visor && <Visor v={visor} onCerrar={() => setVisor(null)} />}
      {toast && <div className="ec-toast" role="status"><IcoCheck s={20} />{toast}</div>}
    </div>
  )
}

function ModalCargar({ titulo, onCerrar, onCargar }) {
  const [file, setFile] = useState(null)
  const [drag, setDrag] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const input = useRef(null)
  const elegir = (f) => { if (!f) return; const ok = /\.(pdf|jpe?g|png)$/i.test(f.name) || /^(image\/(jpeg|png)|application\/pdf)$/.test(f.type); if (!ok) { setErr('El archivo debe ser PDF, JPG o PNG.'); return } setErr(''); setFile(f) }
  const cargar = async () => { setBusy(true); setErr(''); try { await onCargar(file) } catch (e) { setErr(e.message || 'No se pudo cargar el documento.') } finally { setBusy(false) } }
  return (
    <div className="ec-overlay" onClick={onCerrar}>
      <div className="ec-modal-up" role="dialog" aria-modal="true" aria-labelledby="ec-up-t" onClick={(e) => e.stopPropagation()}>
        <div className="ec-modal-cab">
          <div><h2 id="ec-up-t">Cargar documento</h2><div className="ec-modal-sub">{titulo}</div></div>
          <button className="ec-x" aria-label="Cerrar" onClick={onCerrar}>✕</button>
        </div>
        <div className={`ec-drop${drag ? ' is-drag' : ''}`} role="button" tabIndex={0}
          onClick={() => input.current?.click()} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && input.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDrag(true) }} onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); elegir(e.dataTransfer.files?.[0]) }}>
          {file ? (<><b>{file.name}</b><span>{(file.size / 1024 / 1024).toFixed(2)} MB</span></>)
            : (<><b>Buscar archivo en tu equipo</b><span>o arrástralo aquí</span><small>PDF, JPG o PNG</small></>)}
          <input ref={input} type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" hidden onChange={(e) => { elegir(e.target.files?.[0]); e.target.value = '' }} />
        </div>
        {err && <div className="ec-error" style={{ marginTop: 12 }}>{err}</div>}
        <div className="ec-modal-pie">
          <button className="ec-btn-sec" onClick={onCerrar}>Cancelar</button>
          <button className="ec-btn-pri" disabled={!file || busy} onClick={cargar}>{busy ? 'Cargando…' : 'Cargar documento'}</button>
        </div>
      </div>
    </div>
  )
}

function Visor({ v, onCerrar }) {
  return (
    <div className="ec-overlay" onClick={onCerrar}>
      <div className="ec-modal-doc" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <header>
          <div><h2>{v.titulo}</h2>{v.archivo && <div className="ec-modal-sub" style={{ fontSize: 12.5 }}>{v.archivo}</div>}</div>
          <button className="ec-x" aria-label="Cerrar" onClick={onCerrar}>✕</button>
        </header>
        <div className="body">
          {!v.url ? <div className="ec-visor-msg">Este documento todavía no está cargado. Cárgalo desde la columna Cargar para verlo aquí.</div>
            : v.esImg ? <img src={v.url} alt={v.titulo} />
            : v.esPdf ? <iframe src={v.url} title={v.titulo} />
            : <div className="ec-visor-msg">Vista previa no disponible para este formato.</div>}
        </div>
      </div>
    </div>
  )
}

const CSS_EC = `
.ec { font-family:"Open Sans",system-ui,sans-serif; }
.ec-ruta { display:flex; align-items:center; gap:10px; font:400 13px "Open Sans",sans-serif; color:#545454; margin-bottom:14px; flex-wrap:wrap; }
.ec-ruta button { background:none; border:none; padding:0; font:inherit; color:#545454; cursor:pointer; }
.ec-volver { font-weight:600 !important; color:#002E5D !important; }
.ec-miga { text-decoration:underline; text-underline-offset:3px; }
.ec-sep { width:1px; height:14px; background:#D9D9D9; }
.ec-gt { color:#9AA3AE; }
.ec-ruta [aria-current] { color:#002E5D; font-weight:600; }
.ec-titulo { font:700 28px Poppins,sans-serif; color:#002E5D; margin:0; }
.ec-desc { font:400 14px/1.5 "Open Sans",sans-serif; color:#545454; margin:6px 0 20px; }
.ec-error { background:#FBE3E0; color:#C43D2F; border-radius:10px; padding:10px 12px; font-size:13.5px; margin-bottom:12px; }
.ec-box { background:#fff; border:1px solid #E4E3E3; border-radius:16px; padding:18px 22px; box-shadow:0 1px 3px rgba(0,46,93,.05); transition:box-shadow .2s, border-color .2s; }
.ec-box:hover { box-shadow:0 12px 28px rgba(0,46,93,.14); border-color:#B8C4D3; }
.ec-scroll { overflow-x:auto; padding-bottom:64px; margin-bottom:-64px; }
.ec-tabla { min-width:900px; }
.ec-head, .ec-fila, .ec-doc { display:grid; gap:16px; align-items:center; padding:14px 16px;
  grid-template-columns:minmax(90px,.6fr) minmax(180px,1.2fr) minmax(50px,.35fr) minmax(96px,.6fr) minmax(200px,1fr) minmax(150px,.9fr); }
.ec-tabla.has-open .ec-head, .ec-tabla.has-open .ec-fila, .ec-tabla.has-open .ec-doc {
  grid-template-columns:minmax(90px,.6fr) minmax(160px,1.1fr) minmax(64px,.4fr) minmax(50px,.35fr) minmax(96px,.6fr) minmax(200px,1fr) minmax(170px,.9fr); }
.ec-head { background:#002E5D; border-radius:12px; margin-bottom:14px; }
.ec-head span { font:700 15px Poppins,sans-serif; letter-spacing:.06em; text-transform:uppercase; color:#fff; white-space:nowrap; }
.c { text-align:center; justify-self:center; }
.ec-fila { border-top:1px solid #EFEDED; transition:background .15s; }
.ec-fila:hover { background:#F4F6F9; }
.ec-fila.is-open { background:#F4F6F9; box-shadow:inset 3px 0 0 #002E5D; border-radius:10px 10px 0 0; }
.ec-tipo { font:700 15px Poppins,sans-serif; color:#002E5D; }
.ec-dato { font:400 14px "Open Sans",sans-serif; color:#545454; white-space:nowrap; }
.ec-nombre { overflow:hidden; text-overflow:ellipsis; }
.ec-estado { font:400 14px/1.3 "Open Sans",sans-serif; color:#545454; white-space:nowrap; }
.ec-estado.is-rej { color:#C43D2F; }
.ec-tip-wrap { position:relative; display:inline-flex; }
.ec-estado-btn { display:inline-flex; align-items:center; gap:7px; padding:0; border:none; background:none; cursor:pointer; color:#545454; font:400 14px/1.3 "Open Sans",sans-serif; }
.ec-estado-btn:hover { color:#002E5D; }
.ec-estado-btn .txt { width:172px; text-align:left; white-space:nowrap; }
.ec-ico { width:16px; height:16px; stroke:#FF6600; flex-shrink:0; }
.ec-tip { display:none; position:absolute; top:calc(100% + 8px); left:50%; transform:translateX(-50%); z-index:20; width:max-content; max-width:240px;
  background:#fff; border:1px solid #E4E3E3; border-radius:10px; box-shadow:0 12px 28px rgba(0,46,93,.14); padding:10px 14px;
  font:400 14px "Open Sans",sans-serif; color:#545454; text-align:center; white-space:normal; }
.ec-tip-wrap:hover .ec-tip, .ec-estado-btn:focus-visible + .ec-tip, .ec-tip.fijo { display:block; }
.ec-link { height:32px; padding:0 4px; border:none; background:none; display:inline-flex; align-items:center; gap:6px; cursor:pointer;
  font:400 14px "Open Sans",sans-serif; color:#545454; text-decoration:underline; text-underline-offset:3px; }
.ec-link:hover { color:#002E5D; }
.ec-link svg { transition:transform .2s; }
.ec-link[aria-expanded="true"] svg { transform:rotate(180deg); }
.ec-docs { margin:0 0 14px; background:#fff; border:1px solid #E4E3E3; border-radius:12px; padding:6px 15px 18px; box-shadow:0 1px 3px rgba(0,46,93,.05); }
.ec-doc { padding:12px 0; border-bottom:1px solid #EFEDED; }
.ec-doc:last-child { border-bottom:none; }
.ec-doc-nombre { grid-column:1 / 3; font:700 15px Poppins,sans-serif; color:#002E5D; display:flex; flex-direction:column; gap:2px; }
.ec-obs { font:400 12.5px "Open Sans",sans-serif; color:#C43D2F; }
.ec-btn-cargar { width:36px; height:36px; border:1px dashed #B8C4D3; border-radius:10px; background:#fff; color:#002E5D; cursor:pointer; display:inline-flex; align-items:center; justify-content:center; }
.ec-btn-cargar:hover { border-color:#002E5D; background:#F4F6F9; }
.ec-cargado { width:36px; height:36px; display:inline-flex; align-items:center; justify-content:center; }
.ec-acciones { display:flex; gap:14px; justify-content:center; }
.ec-link-acc { border:none; background:none; padding:0; cursor:pointer; font:400 14px "Open Sans",sans-serif; color:#545454; text-decoration:underline; text-underline-offset:3px; }
.ec-link-acc:hover { color:#002E5D; }
.ec-vacio { padding:22px 16px; color:#545454; font-size:14px; }
.ec-overlay { position:fixed; inset:0; background:rgba(0,46,93,.45); z-index:200; display:flex; align-items:center; justify-content:center; padding:24px; }
.ec-modal-up { width:min(520px,100%); background:#fff; border-radius:16px; box-shadow:0 12px 28px rgba(0,46,93,.14); padding:22px; }
.ec-modal-cab { display:flex; justify-content:space-between; align-items:flex-start; gap:12px; margin-bottom:16px; }
.ec-modal-cab h2, .ec-modal-doc h2 { font:600 20px Poppins,sans-serif; color:#002E5D; margin:0; }
.ec-modal-sub { font:400 14px "Open Sans",sans-serif; color:#545454; margin-top:2px; }
.ec-x { border:none; background:none; font-size:18px; color:#545454; cursor:pointer; line-height:1; }
.ec-drop { border:1.5px dashed #B8C4D3; border-radius:12px; padding:32px 20px; text-align:center; cursor:pointer; display:flex; flex-direction:column; gap:4px; align-items:center; }
.ec-drop.is-drag, .ec-drop:hover { border-color:#002E5D; background:#F4F6F9; }
.ec-drop b { font:700 15px Poppins,sans-serif; color:#002E5D; }
.ec-drop span { font-size:14px; color:#545454; }
.ec-drop small { font-size:12.5px; color:#8B8B8B; margin-top:4px; }
.ec-modal-pie { display:flex; justify-content:flex-end; gap:10px; margin-top:18px; }
.ec-btn-sec { border:1px solid #C9CDD2; background:#fff; color:#002E5D; border-radius:999px; padding:10px 20px; font:600 14px Poppins,sans-serif; cursor:pointer; }
.ec-btn-pri { border:none; background:#FF6600; color:#fff; border-radius:999px; padding:10px 20px; font:600 14px Poppins,sans-serif; cursor:pointer; }
.ec-btn-pri:disabled { opacity:.45; cursor:not-allowed; }
.ec-modal-doc { width:min(860px,100%); max-height:calc(100vh - 48px); background:#fff; border-radius:16px; display:flex; flex-direction:column; overflow:hidden; }
.ec-modal-doc header { padding:18px 22px; border-bottom:1px solid #E4E3E3; display:flex; justify-content:space-between; align-items:flex-start; gap:12px; }
.ec-modal-doc .body { background:#F7F8FA; padding:16px; overflow:auto; display:flex; justify-content:center; }
.ec-modal-doc img, .ec-modal-doc iframe { max-width:100%; height:70vh; border-radius:8px; border:0; }
.ec-modal-doc iframe { width:100%; }
.ec-visor-msg { padding:40px 20px; color:#545454; font-size:14px; text-align:center; }
.ec-toast { position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); z-index:300; display:flex; align-items:center; gap:12px; padding:20px 28px;
  background:#fff; border:1px solid #E4E3E3; border-radius:14px; box-shadow:0 24px 60px rgba(0,30,61,.22); font:700 14px Poppins,sans-serif; color:#002E5D; }
`
