// ═══════════════════════════════════════════════════════════════════════════
// Certificar.jsx — Certificación › Certificar › Vehículo / Conductor / Ayudante
// Maquetas 8.9.20. Un solo formulario por tipo, con:
//  · aviso de guardado automático y banner "Retomaste una carga incompleta"
//  · secciones: Centro de servicio · Datos · (Licencia) · Fotos / Documentos
//  · cajas de carga "Subir archivo" / "Quitar" y faltantes en rojo
//  · guardado automático del borrador (uno por empresa y tipo) en
//    certificacion_borradores; los archivos se suben apenas se eligen
//  · modales "Faltan datos obligatorios" y "Datos enviados correctamente"
//  · "Guardar y continuar después" → vuelve a Certificar con el mensaje
// Al enviar se crea la certificación igual que antes (certificaciones +
// certificacion_conductor / certificacion_vehiculo + documentos + evento), con
// el candado de titularidad (placa o CURP activa en otra empresa).
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useRef, useState } from 'react'
import { supabase, BUCKET } from './supabaseClient'

export const ESTADOS_MX = ['AGUASCALIENTES', 'BAJA CALIFORNIA', 'BAJA CALIFORNIA SUR', 'CAMPECHE', 'CHIAPAS', 'CHIHUAHUA',
  'CIUDAD DE MEXICO', 'COAHUILA', 'COLIMA', 'DURANGO', 'ESTADO DE MEXICO', 'GUANAJUATO', 'GUERRERO', 'HIDALGO', 'JALISCO',
  'MICHOACAN', 'MORELOS', 'NAYARIT', 'NUEVO LEON', 'OAXACA', 'PUEBLA', 'QUERETARO', 'QUINTANA ROO', 'SAN LUIS POTOSI',
  'SINALOA', 'SONORA', 'TABASCO', 'TAMAULIPAS', 'TLAXCALA', 'VERACRUZ', 'YUCATAN', 'ZACATECAS']

const CONFIG = {
  vehiculo: {
    titulo: 'Certificar vehículo', miga: 'Vehículo', desc: 'Registra los datos del vehículo que deseas sumar a tu operación.',
    vacio: { sc: '', placa: '', marca: '', modelo: '', anio: '', vin: '' },
    fotos: [['foto_frente', 'Frente'], ['foto_trasera', 'Trasera'], ['foto_lado_izq', 'Lado izquierdo'], ['foto_lado_der', 'Lado derecho']],
    docs: [['tarjeta_circulacion', 'Tarjeta de circulación'], ['poliza_seguro', 'Póliza de seguro']],
  },
  conductor: {
    titulo: 'Certificar conductor', miga: 'Conductor', desc: 'Registra los datos del conductor que deseas sumar a tu operación.',
    vacio: { sc: '', nombre: '', curp: '', rfc: '', telefono: '', email: '', licencia_numero: '', licencia_estado: '', licencia_vigencia: '' },
    fotos: [],
    docs: [['ine', 'INE (frente)'], ['ine_reverso', 'INE (reverso)'], ['curp', 'CURP (PDF)'], ['rfc', 'RFC (PDF)'], ['licencia', 'Licencia de conducir']],
  },
  ayudante: {
    titulo: 'Certificar ayudante', miga: 'Ayudante', desc: 'Registra los datos del ayudante que deseas sumar a tu operación.',
    vacio: { sc: '', nombre: '', curp: '', rfc: '', telefono: '', email: '' },
    fotos: [],
    docs: [['ine', 'INE (frente)'], ['ine_reverso', 'INE (reverso)'], ['curp', 'CURP (PDF)'], ['rfc', 'RFC (PDF)']],
  },
}
const MAX_MB = 10
const fDia = (x) => x ? new Date(x).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' }) : ''

// Borradores de la empresa (para Certificar, el menú y Estado de certificación)
export async function leerBorradores(terceroId) {
  if (!terceroId) return []
  const { data, error } = await supabase.from('certificacion_borradores').select('*').eq('tercero_id', terceroId)
  return error ? [] : (data || [])
}
export function useBorradores(tercero, refresco) {
  const [lista, setLista] = useState([])
  useEffect(() => { let c = false; leerBorradores(tercero?.tercero_id).then((d) => { if (!c) setLista(d) }); return () => { c = true } }, [tercero?.tercero_id, refresco])
  return lista
}
// Mensaje que se muestra al volver a Certificar ("Registro guardado…")
export function avisoPendiente() {
  try { const t = sessionStorage.getItem('bt_cert_toast'); if (t) sessionStorage.removeItem('bt_cert_toast'); return t || '' } catch { return '' }
}

async function verificarTitularidad({ campo, valor, terceroId }) {
  const v = String(valor || '').toUpperCase().trim()
  if (!v) return null
  try {
    const { data, error } = await supabase.from('flota_personal_terceros').select('tercero_id, placa, curp, tipo').eq('estado', 'activo').ilike(campo, v)
    if (error || !data) return null
    const ajeno = data.find((r) => r.tercero_id && r.tercero_id !== terceroId)
    if (!ajeno) return null
    const { data: emp } = await supabase.from('terceros').select('nombre').eq('id', ajeno.tercero_id).maybeSingle()
    return { empresa: emp?.nombre || 'otra empresa' }
  } catch { return null }
}
async function insDoc(fila) {
  let r = await supabase.from('certificacion_documentos').insert(fila).select('id').single()
  if (r.error) r = await supabase.from('certificacion_documentos').insert({ certificacion_id: fila.certificacion_id, tipo_documento: fila.tipo_documento, storage_path: fila.storage_path }).select('id').single()
  return r
}

const IcoInfo = ({ s = 20 }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="#FF6600" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></svg>
const IcoHist = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#002E5D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5M12 7v5l3 2" /></svg>
const IcoCheck = ({ s = 20 }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="#002E5D" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
const IcoAlerta = () => <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#C43D2F" strokeWidth="2.2" strokeLinecap="round"><path d="M12 8v5M12 16.5h.01" /><circle cx="12" cy="12" r="10" /></svg>

export default function Certificar({ tipo, tercero, email, onBack, onEstado, onCertificar }) {
  const cfg = CONFIG[tipo]
  const [f, setF] = useState(cfg.vacio)
  const [arch, setArch] = useState({})            // tipo_documento → { path, nombre, size }
  const [subiendo, setSubiendo] = useState({})
  const [borrador, setBorrador] = useState(null)  // { actualizado_at } si se retomó uno
  const [marcar, setMarcar] = useState(false)     // faltantes en rojo
  const [modal, setModal] = useState(null)        // 'faltan' | 'ok'
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [conflicto, setConflicto] = useState(null)
  const listo = useRef(false)
  const timer = useRef(null)
  const tid = tercero.tercero_id

  // Al entrar: si hay borrador de este tipo, se retoma con los faltantes en rojo
  useEffect(() => { (async () => {
    const { data } = await supabase.from('certificacion_borradores').select('*').eq('tercero_id', tid).eq('tipo', tipo).maybeSingle()
    if (data) { setF({ ...cfg.vacio, ...(data.campos || {}) }); setArch(data.archivos || {}); setBorrador(data); setMarcar(true) }
    listo.current = true
  })() }, [tipo, tid])   // eslint-disable-line react-hooks/exhaustive-deps

  const hayDatos = (ff, aa) => Object.values(ff).some((v) => String(v || '').trim()) || Object.keys(aa).length > 0
  // Guardado automático: cada cambio guarda el borrador; vacío → se elimina
  const guardarBorrador = async (ff = f, aa = arch) => {
    if (!listo.current) return
    if (hayDatos(ff, aa)) {
      await supabase.from('certificacion_borradores').upsert({ tercero_id: tid, tipo, campos: ff, archivos: aa, actualizado_at: new Date().toISOString() })
    } else {
      await supabase.from('certificacion_borradores').delete().eq('tercero_id', tid).eq('tipo', tipo)
    }
  }
  const programar = (ff, aa) => { clearTimeout(timer.current); timer.current = setTimeout(() => guardarBorrador(ff, aa), 700) }
  useEffect(() => () => clearTimeout(timer.current), [])

  const set = (k, v) => { const ff = { ...f, [k]: v }; setF(ff); programar(ff, arch); if (k === 'placa' || k === 'curp') setConflicto(null) }

  const subir = async (doc, file) => {
    if (!file) return
    const esFoto = cfg.fotos.some(([k]) => k === doc)
    const okTipo = esFoto ? /^image\/(jpeg|png)$/.test(file.type) || /\.(jpe?g|png)$/i.test(file.name)
      : /^(image\/(jpeg|png)|application\/pdf)$/.test(file.type) || /\.(pdf|jpe?g|png)$/i.test(file.name)
    if (!okTipo) { setErr(esFoto ? 'La foto debe ser JPG o PNG.' : 'El documento debe ser PDF, JPG o PNG.'); return }
    if (file.size > MAX_MB * 1024 * 1024) { setErr(`El archivo pesa más de ${MAX_MB} MB.`); return }
    setErr(''); setSubiendo((s) => ({ ...s, [doc]: true }))
    try {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
      const path = `${tid}/borradores/${tipo}/${doc}_${Date.now()}.${ext}`
      const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true })
      if (error) throw new Error(error.message)
      const aa = { ...arch, [doc]: { path, nombre: file.name, size: file.size } }
      setArch(aa); await guardarBorrador(f, aa)
    } catch (e) { setErr('No se pudo subir el archivo: ' + e.message) }
    finally { setSubiendo((s) => ({ ...s, [doc]: false })) }
  }
  const quitar = async (doc) => { const aa = { ...arch }; delete aa[doc]; setArch(aa); await guardarBorrador(f, aa) }

  // Qué falta (para marcar en rojo y validar el envío)
  const faltaCampo = (k) => {
    const v = String(f[k] || '').trim()
    if (k === 'vin') return false
    if (k === 'anio') return !/^(19|20)\d{2}$/.test(v)
    if (k === 'curp') return v.length !== 18
    if (k === 'rfc') return v.length < 12
    if (k === 'telefono') return v.replace(/\D/g, '').length < 10
    if (k === 'email') return !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
    return !v
  }
  const camposReq = Object.keys(cfg.vacio).filter((k) => k !== 'vin')
  const docsReq = [...cfg.fotos, ...cfg.docs].map(([k]) => k)
  const faltantes = () => [...camposReq.filter(faltaCampo), ...docsReq.filter((k) => !arch[k])]

  const descartar = async () => {
    if (!window.confirm('¿Descartar lo cargado y empezar de cero?')) return
    clearTimeout(timer.current)
    await supabase.from('certificacion_borradores').delete().eq('tercero_id', tid).eq('tipo', tipo)
    setF(cfg.vacio); setArch({}); setBorrador(null); setMarcar(false); setConflicto(null)
  }
  const guardarYSalir = async () => {
    clearTimeout(timer.current); await guardarBorrador()
    try { sessionStorage.setItem('bt_cert_toast', hayDatos(f, arch) ? 'Registro guardado. Puedes continuar cuando quieras.' : '') } catch { /* sin storage */ }
    onCertificar()
  }

  const enviar = async () => {
    setErr('')
    if (faltantes().length) { setMarcar(true); setModal('faltan'); return }
    const campoTit = tipo === 'vehiculo' ? 'placa' : 'curp'
    const c = await verificarTitularidad({ campo: campoTit, valor: f[campoTit], terceroId: tid })
    if (c) { setConflicto(c); return }
    setBusy(true); clearTimeout(timer.current)
    try {
      const { data: cert, error } = await supabase.from('certificaciones')
        .insert({ tercero_id: tid, tipo, estado: 'enviado', origen: 'portal_web', enviado_por: email, service_center: f.sc, etapa_kanban: 'recepcion' })
        .select().single()
      if (error) throw error
      if (tipo === 'vehiculo') {
        const { error: e2 } = await supabase.from('certificacion_vehiculo').insert({
          certificacion_id: cert.id, placa: f.placa.trim().toUpperCase().replace(/\s/g, ''), vin: f.vin.trim().toUpperCase() || null,
          marca: f.marca.trim().toUpperCase(), modelo: f.modelo.trim().toUpperCase(), anio: Number(f.anio.trim()),
        })
        if (e2) throw e2
      } else {
        const esC = tipo === 'conductor'
        const { error: e2 } = await supabase.from('certificacion_conductor').insert({
          certificacion_id: cert.id, nombre: f.nombre.trim(), curp: f.curp.trim().toUpperCase(), rfc: f.rfc.trim().toUpperCase() || null,
          telefono: f.telefono.trim() || null, email: f.email.trim().toLowerCase(),
          licencia_numero: esC ? (f.licencia_numero.trim() || null) : null, licencia_estado: esC ? (f.licencia_estado || null) : null,
          licencia_vigencia: esC ? (f.licencia_vigencia || null) : null,
        })
        if (e2) throw e2
      }
      // Los archivos ya están en el bucket: solo se registran como documentos de la certificación
      for (const [doc, a] of Object.entries(arch)) {
        const r = await insDoc({ certificacion_id: cert.id, tipo_documento: doc, storage_path: a.path, subido_por: email || null })
        if (r.error) throw new Error(`El documento ${doc} no se registró: ${r.error.message}`)
      }
      await supabase.from('certificacion_eventos').insert({ certificacion_id: cert.id, estado_nuevo: 'enviado', nota: 'Enviado desde portal web', actor: email })
      await supabase.from('certificacion_borradores').delete().eq('tercero_id', tid).eq('tipo', tipo)
      setF(cfg.vacio); setArch({}); setBorrador(null); setMarcar(false)
      setModal('ok')
    } catch (e) { setErr('No se pudo enviar: ' + (e.message || 'error desconocido')) }
    setBusy(false)
  }

  const inp = (k, { transform, ...props } = {}) => <input id={`cf-${k}`} value={f[k]} onChange={(e) => set(k, transform ? transform(e.target.value) : e.target.value)} {...props} />
  const Caja = ([k, nombre], meta) => {
    const a = arch[k], err2 = marcar && !a
    return (
      <div key={k} className={`cf-upload${a ? ' is-loaded' : ''}${err2 ? ' is-error' : ''}`}>
        <div style={{ minWidth: 0 }}>
          <div className="cf-upload-title">{nombre}{err2 && <span className="missing"> — falta</span>}</div>
          <div className="cf-upload-meta">{a ? `${a.nombre} · Cargado` : meta}</div>
        </div>
        {a ? <button type="button" className="cf-btn-sm cf-btn-remove" onClick={() => quitar(k)}>Quitar</button>
          : <label className="cf-btn-sm cf-btn-upload">{subiendo[k] ? 'Subiendo…' : 'Subir archivo'}
              <input type="file" hidden accept={meta.startsWith('JPG') ? 'image/jpeg,image/png' : 'application/pdf,image/jpeg,image/png'}
                onChange={(e) => { subir(k, e.target.files?.[0]); e.target.value = '' }} /></label>}
      </div>
    )
  }

  return (
    <div className="cf">
      <style>{CSS_CF}</style>
      <nav className="cf-ruta" aria-label="Ruta">
        <button className="cf-volver" onClick={onCertificar}>← Volver</button><span className="cf-sep" />
        <button className="cf-miga" onClick={onBack}>Inicio</button><span className="cf-gt">›</span>
        <span>Certificación</span><span className="cf-gt">›</span>
        <button className="cf-miga" onClick={onCertificar}>Certificar</button><span className="cf-gt">›</span>
        <span aria-current="page">{cfg.miga}</span>
      </nav>
      <h1 className="cf-titulo">{cfg.titulo}</h1>
      <p className="cf-desc">{cfg.desc}</p>

      <div className="cf-note"><IcoInfo /><span>Puedes salir cuando quieras: tus datos y documentos se guardan automáticamente y podrás continuar después desde Certificar.</span></div>
      {borrador && (
        <div className="cf-resume">
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <IcoHist />
            <div><div className="cf-resume-title">Retomaste una carga incompleta</div>
              <div className="cf-resume-sub">Guardada el {fDia(borrador.actualizado_at)}. Tus datos se guardan automáticamente.</div></div>
          </div>
          <button className="cf-link" onClick={descartar}>Descartar y empezar de cero</button>
        </div>
      )}

      <div className="cf-card">
        <section className="cf-section first">
          <h2>Centro de servicio</h2>
          <div className="cf-grid dos">
            <Campo k="sc" error={marcar && faltaCampo('sc')} label="Centro de servicio (SVC)">
              <div className="cf-select"><select id="cf-sc" value={f.sc} onChange={(e) => set('sc', e.target.value)}>
                <option value="">Selecciona el centro…</option>{SC_LIST.map((s) => <option key={s} value={s}>{s}</option>)}
              </select></div>
            </Campo>
          </div>
        </section>

        {tipo === 'vehiculo' ? (
          <section className="cf-section">
            <h2>Datos del vehículo</h2>
            <div className="cf-grid">
              <Campo k="placa" error={marcar && faltaCampo('placa')} label="Placa">{inp('placa', { placeholder: 'Ej. ST2965E', onBlur: async () => setConflicto(await verificarTitularidad({ campo: 'placa', valor: f.placa, terceroId: tid })) })}</Campo>
              <Campo k="marca" error={marcar && faltaCampo('marca')} label="Marca">{inp('marca', { placeholder: 'Ej. RAM, Nissan' })}</Campo>
              <Campo k="modelo" error={marcar && faltaCampo('modelo')} label="Modelo">{inp('modelo', { placeholder: 'Ej. ProMaster City' })}</Campo>
              <Campo k="anio" error={marcar && faltaCampo('anio')} label="Año">{inp('anio', { placeholder: 'Ej. 2021', inputMode: 'numeric', transform: (v) => v.replace(/\D/g, '').slice(0, 4) })}</Campo>
              <Campo k="vin" error={marcar && faltaCampo('vin')} label="VIN / número de serie" req={false}>{inp('vin', { placeholder: 'Opcional' })}</Campo>
            </div>
          </section>
        ) : (
          <section className="cf-section">
            <h2>Datos personales</h2>
            <div className="cf-grid">
              <Campo k="nombre" error={marcar && faltaCampo('nombre')} label="Nombre completo" full>{inp('nombre', { placeholder: 'Nombre y apellidos' })}</Campo>
              <Campo k="curp" error={marcar && faltaCampo('curp')} label="CURP">{inp('curp', { placeholder: '18 caracteres', maxLength: 18, transform: (v) => v.toUpperCase(), onBlur: async () => setConflicto(await verificarTitularidad({ campo: 'curp', valor: f.curp, terceroId: tid })) })}</Campo>
              <Campo k="rfc" error={marcar && faltaCampo('rfc')} label="RFC">{inp('rfc', { placeholder: '13 caracteres', maxLength: 13, transform: (v) => v.toUpperCase() })}</Campo>
              <Campo k="telefono" error={marcar && faltaCampo('telefono')} label="Teléfono">{inp('telefono', { placeholder: '10 dígitos', type: 'tel', inputMode: 'numeric', transform: (v) => v.replace(/[^\d+ ]/g, '').slice(0, 15) })}</Campo>
              <Campo k="email" error={marcar && faltaCampo('email')} label="Correo electrónico"
                nota={<div className="cf-nota"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#545454" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></svg>A este correo llegará la invitación de MELI. Verifica que sea el del {tipo} y esté correcto.</div>}>
                {inp('email', { type: 'email', placeholder: 'correo@ejemplo.com' })}
              </Campo>
            </div>
          </section>
        )}

        {tipo === 'conductor' && (
          <section className="cf-section">
            <h2>Licencia de conducir</h2>
            <div className="cf-grid">
              <Campo k="licencia_numero" error={marcar && faltaCampo('licencia_numero')} label="Número de licencia">{inp('licencia_numero', { placeholder: 'Número de licencia' })}</Campo>
              <Campo k="licencia_estado" error={marcar && faltaCampo('licencia_estado')} label="Estado emisor">
                <div className="cf-select"><select id="cf-licencia_estado" value={f.licencia_estado} onChange={(e) => set('licencia_estado', e.target.value)}>
                  <option value="">Selecciona…</option>{ESTADOS_MX.map((s) => <option key={s} value={s}>{s}</option>)}
                </select></div>
              </Campo>
              <Campo k="licencia_vigencia" error={marcar && faltaCampo('licencia_vigencia')} label="Vigencia">{inp('licencia_vigencia', { type: 'date' })}</Campo>
            </div>
          </section>
        )}

        {cfg.fotos.length > 0 && (
          <section className="cf-section">
            <h2>Fotos del vehículo obligatorias</h2>
            <div className="cf-grid cf-uploads fotos">{cfg.fotos.map((d) => Caja(d, 'JPG o PNG · máx. 10 MB'))}</div>
          </section>
        )}
        <section className="cf-section">
          <h2>Documentos obligatorios</h2>
          <div className="cf-grid cf-uploads docs">{cfg.docs.map((d) => Caja(d, 'PDF, JPG o PNG · máx. 10 MB'))}</div>
        </section>

        {conflicto && (
          <div className="cf-conflicto">
            <b>Este {tipo === 'vehiculo' ? 'vehículo' : tipo} sigue asociado a la empresa "{conflicto.empresa}".</b>
            <span>Para certificarlo con tu empresa, esa empresa debe iniciar la solicitud de baja primero. Si crees que es un error, escríbenos en Consultas.</span>
          </div>
        )}
        {err && <div className="cf-error">{err}</div>}

        <div className="cf-actions">
          <button className="cf-btn cf-btn-ghost" onClick={onCertificar}>Cancelar</button>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className="cf-btn cf-btn-secondary" onClick={guardarYSalir} disabled={busy}>Guardar y continuar después</button>
            <button className="cf-btn cf-btn-primary" onClick={enviar} disabled={busy}>{busy ? 'Enviando…' : 'Enviar a certificar'}</button>
          </div>
        </div>
      </div>

      {modal && (
        <div className="cf-backdrop" onClick={() => modal === 'faltan' && setModal(null)}>
          <div className="cf-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            {modal === 'faltan' ? (<>
              <div className="cf-modal-ico rojo"><IcoAlerta /></div>
              <h3>Faltan datos obligatorios</h3>
              <p>Para continuar con la certificación, debes completar los campos obligatorios.</p>
              <button className="cf-btn cf-btn-navy" onClick={() => setModal(null)}>Revisar campos</button>
            </>) : (<>
              <div className="cf-modal-ico azul"><IcoCheck s={26} /></div>
              <h3>Datos enviados correctamente</h3>
              <p>La solicitud está ahora en revisión.</p>
              <div style={{ display: 'flex', gap: 10, width: '100%' }}>
                <button className="cf-btn cf-btn-secondary" style={{ flex: 1 }} onClick={onEstado}>Ver estado</button>
                <button className="cf-btn cf-btn-navy" style={{ flex: 1 }} onClick={onCertificar}>Volver a Certificar</button>
              </div>
            </>)}
          </div>
        </div>
      )}
    </div>
  )
}

// Campo con etiqueta, asterisco y marca de error (fuera del componente para no perder el foco al escribir)
function Campo({ k, label, req = true, full, error, children, nota }) {
  return (
    <div className={`cf-field${full ? ' full' : ''}${req && error ? ' is-error' : ''}`}>
      <label htmlFor={`cf-${k}`}>{label}{req && <span className="req"> *</span>}</label>
      {children}
      {nota}
    </div>
  )
}

// Lista de centros (la misma del portal)
const SC_LIST = ['AMX7','ECH4','ECH5','EGD0','EGD9','EHM4','EHM5','EHP5','EHP6','ELP2','ELP3','EPB3','EQR2','ERX6','ETA4','ETG4','ETL1','ETL2','EVM2','EVR3','EZL1','SAG1','SBJ1','SCC1','SCD1','SCG1','SCH1','SCJ1','SCM1','SCN1','SCP1','SCQ1','SCT1','SCU1','SCV1','SCX1','SCY1','SDC1','SDG1','SEN1','SGD1','SGD2','SGD3','SGD4','SHM1','SHP1','SHP2','SJA1','SJD1','SLE1','SLP1','SLV1','SLW1','SLZ1','SMA1','SMD1','SML1','SMO1','SMT1','SMT2','SMT3','SMX1','SMX10','SMX2','SMX3','SMX4','SMX5','SMX6','SMX7','SMX8','SMX9','SMZ1','SNG1','SNL1','SOX1','SPB1','SPD1','SPV1','SPY1','SPZ1','SQR1','SQR2','SRX1','SSL1','STA1','STG1','STJ1','STL1','STL2','STN1','STP1','STR1','STT1','STX1','SUR1','SVH1','SVM1','SVR1','SXL1','SZC1','SZL1','SZM1','XSM11']

// Mensaje "Registro guardado…" al volver a Certificar
export function ToastCertificar() {
  const [t, setT] = useState(() => avisoPendiente())
  useEffect(() => { if (!t) return; const x = setTimeout(() => setT(''), 5000); return () => clearTimeout(x) }, [t])
  if (!t) return null
  return <div className="cf-toast" role="status"><style>{CSS_CF}</style><IcoCheck />{t}</div>
}

const CSS_CF = `
.cf { font-family:"Open Sans",system-ui,sans-serif; }
.cf-ruta { display:flex; align-items:center; gap:10px; font:400 13px "Open Sans",sans-serif; color:#545454; margin-bottom:14px; flex-wrap:wrap; }
.cf-ruta button { background:none; border:none; padding:0; font:inherit; color:#545454; cursor:pointer; }
.cf-ruta .cf-miga:hover { color:#002E5D; text-decoration:underline; }
.cf-volver { font-weight:600 !important; color:#002E5D !important; }
.cf-sep { width:1px; height:14px; background:#D9D9D9; }
.cf-gt { color:#9AA3AE; }
.cf-ruta [aria-current] { color:#002E5D; font-weight:600; }
.cf-titulo { font:700 28px Poppins,sans-serif; color:#002E5D; margin:0; }
.cf-desc { font:400 14px "Open Sans",sans-serif; color:#545454; margin:6px 0 18px; }
.cf-note { display:flex; align-items:flex-start; gap:12px; padding:14px 18px; background:#fff; border:1px solid #E4E3E3; border-radius:12px; box-shadow:0 1px 3px rgba(0,46,93,.05); font:400 14px/1.5 "Open Sans",sans-serif; color:#545454; margin-bottom:14px; }
.cf-note svg { flex:none; }
.cf-resume { display:flex; justify-content:space-between; align-items:center; gap:12px 20px; flex-wrap:wrap; padding:14px 18px; background:#fff; border:1px solid #E4E3E3; border-radius:12px; box-shadow:0 1px 3px rgba(0,46,93,.05); margin-bottom:14px; }
.cf-resume-title { font:700 14px Poppins,sans-serif; color:#002E5D; }
.cf-resume-sub { font:400 14px "Open Sans",sans-serif; color:#545454; margin-top:2px; }
.cf-link { border:none; background:none; padding:0; cursor:pointer; font:400 14px "Open Sans",sans-serif; color:#545454; text-decoration:underline; text-underline-offset:3px; }
.cf-link:hover { color:#002E5D; }
.cf-card { background:#fff; border:1px solid #E4E3E3; border-radius:16px; padding:4px 28px 28px; box-shadow:0 1px 3px rgba(0,46,93,.05); transition:box-shadow .2s, transform .2s, border-color .2s; }
.cf-card:hover { box-shadow:0 12px 28px rgba(0,46,93,.14); transform:translateY(-2px); border-color:#B8C4D3; }
.cf-section { padding:24px 0; border-top:1px solid #E4E3E3; display:flex; flex-direction:column; gap:18px; }
.cf-section.first { border-top:none; }
.cf-section h2 { font:600 20px Poppins,sans-serif; color:#002E5D; margin:0; }
.cf-grid { display:grid; gap:18px 20px; grid-template-columns:repeat(3,minmax(0,1fr)); }
.cf-grid.dos, .cf-uploads.docs { grid-template-columns:repeat(2,minmax(0,1fr)); }
.cf-uploads.fotos { grid-template-columns:repeat(3,minmax(0,1fr)); }
@media (max-width: 900px) { .cf-grid, .cf-uploads.fotos { grid-template-columns:repeat(2,minmax(0,1fr)); } }
@media (max-width: 600px) { .cf-grid, .cf-grid.dos, .cf-uploads.fotos, .cf-uploads.docs { grid-template-columns:1fr; } }
.cf-field { display:flex; flex-direction:column; gap:8px; min-width:0; }
.cf-field.full { grid-column:1 / -1; }
.cf-field label { font:700 14px Poppins,sans-serif; color:#002E5D; }
.cf-field .req { color:#FF6600; }
.cf-field input, .cf-field select { height:46px; padding:0 14px; width:100%; box-sizing:border-box; border:1px solid #C9CDD2; border-radius:10px; background:#fff; font:400 14px "Open Sans",sans-serif; color:#545454; transition:background .15s, border-color .15s; }
.cf-field input:focus, .cf-field select:focus { outline:none; border-color:#002E5D; }
.cf-select { position:relative; }
.cf-select::after { content:''; position:absolute; right:16px; top:50%; width:12px; height:12px; transform:translateY(-50%); pointer-events:none;
  background:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23002E5D' stroke-width='2.5' stroke-linecap='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E") center/12px no-repeat; }
.cf-field select { appearance:none; -webkit-appearance:none; padding-right:40px; }
.cf-field.is-error input, .cf-field.is-error select { border-color:#C43D2F; background:#FDF1F0; }
.cf-nota { display:flex; gap:6px; align-items:flex-start; font:400 12.5px/1.45 "Open Sans",sans-serif; color:#545454; }
.cf-nota svg { flex:none; margin-top:1px; }
.cf-upload { display:flex; justify-content:space-between; align-items:center; gap:12px; min-height:60px; padding:10px 12px 10px 16px; border:1.5px dashed #C9CDD2; border-radius:12px; background:#fff; box-sizing:border-box; }
.cf-upload-title { font:700 15px Poppins,sans-serif; color:#002E5D; }
.cf-upload-meta { font:400 12.5px "Open Sans",sans-serif; color:#545454; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.cf-upload.is-loaded { border-color:#002E5D; background:rgba(0,46,93,.04); }
.cf-upload.is-error { border-color:#C43D2F; background:#FDF1F0; }
.cf-upload.is-error .missing { color:#C43D2F; font:400 15px "Open Sans",sans-serif; }
.cf-btn-sm { height:32px; padding:0 14px; border-radius:8px; font:700 12.5px Poppins,sans-serif; cursor:pointer; display:inline-flex; align-items:center; flex:none; white-space:nowrap; }
.cf-btn-upload { background:#002E5D; border:1px solid #002E5D; color:#fff; }
.cf-btn-remove { background:#fff; border:1px solid #C9CDD2; color:#002E5D; }
.cf-conflicto { margin-top:18px; display:flex; flex-direction:column; gap:4px; background:#FFF4EC; border:1.5px solid #FF6600; border-radius:12px; padding:12px 14px; font-size:13.5px; color:#7c3a12; }
.cf-conflicto b { color:#B45309; }
.cf-error { margin-top:18px; background:#FDF1F0; color:#C43D2F; border-radius:10px; padding:10px 12px; font-size:13.5px; }
.cf-actions { display:flex; justify-content:space-between; gap:10px; flex-wrap:wrap; padding-top:24px; border-top:1px solid #E4E3E3; margin-top:8px; }
.cf-btn { height:44px; padding:0 22px; border-radius:10px; font:700 14px Poppins,sans-serif; cursor:pointer; }
.cf-btn:disabled { opacity:.6; cursor:not-allowed; }
.cf-btn-ghost { border:1px solid #C9CDD2; background:#fff; color:#002E5D; }
.cf-btn-secondary { border:1.5px solid #002E5D; background:#fff; color:#002E5D; }
.cf-btn-secondary:hover { background:#F4F6F9; }
.cf-btn-primary { border:none; background:#FF6600; color:#fff; }
.cf-btn-primary:hover { filter:brightness(.94); }
.cf-btn-navy { border:none; background:#002E5D; color:#fff; }
.cf-backdrop { position:fixed; inset:0; background:rgba(0,30,60,.45); display:flex; align-items:center; justify-content:center; padding:20px; z-index:200; }
.cf-modal { max-width:380px; width:100%; border-radius:18px; background:#fff; padding:28px 24px 24px; text-align:center; display:flex; flex-direction:column; align-items:center; gap:14px; box-shadow:0 24px 60px rgba(0,30,60,.25); }
.cf-modal h3 { font:700 19px Poppins,sans-serif; color:#002E5D; margin:0; }
.cf-modal p { font:400 14px/1.55 "Open Sans",sans-serif; color:#545454; margin:0; }
.cf-modal .cf-btn { width:100%; }
.cf-modal-ico { width:56px; height:56px; border-radius:50%; display:flex; align-items:center; justify-content:center; }
.cf-modal-ico.rojo { background:#FDECEA; } .cf-modal-ico.azul { background:rgba(0,46,93,.08); }
.cf-toast { position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); z-index:300; display:flex; align-items:center; gap:12px; padding:20px 28px; background:#fff; border:1px solid #E4E3E3; border-radius:14px; box-shadow:0 24px 60px rgba(0,30,61,.22); font:700 14px Poppins,sans-serif; color:#002E5D; }
@media (max-width: 640px) { .cf-card { padding:4px 18px 22px; } .cf-actions { flex-direction:column-reverse; } .cf-actions > div { flex-direction:column; } .cf-actions .cf-btn { width:100%; } }
`
