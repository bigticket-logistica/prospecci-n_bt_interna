// ═══════════════════════════════════════════════════════════════════════════
// Perfil.jsx — Mi empresa › Perfil y cuenta bancaria (maqueta 8.9.22)
// 8.9.22: aviso de borrador y rojo solo tras "Guardar y continuar después";
// sin autocompletado; con el perfil completo se muestran 3 fichas de solo
// lectura (Editar contacto: correo y teléfono; la cuenta bancaria se cambia
// solo con "Solicitar cambio", que revisa administración).
// Formulario en blanco la primera vez; 18 campos obligatorios + comprobante
// bancario ("Nombre del banco" solo si Banco = Otros). Guardado automático
// como borrador (con fecha) en este dispositivo; "Guardar y continuar después"
// guarda sin validar; "Guardar perfil" valida todo y guarda en perfiles_empresa.
// Mismas columnas de siempre en perfiles_empresa (el Brain lee lo mismo).
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useRef, useState } from 'react'
import { supabase } from './supabaseClient'
import { CSS_MK } from './Desempeno'

const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const fechaLarga = (d) => { if (!d) return '—'; const [y, m, dd] = String(d).slice(0, 10).split('-'); return `${Number(dd)} ${MES[Number(m) - 1]} ${y}` }
const fmtClabe = (c) => { const x = String(c || '').replace(/\D/g, ''); return [x.slice(0, 3), x.slice(3, 6), x.slice(6, 10), x.slice(10, 14), x.slice(14)].join(' ').trim() }
const okCorreo = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || '').trim())
const okTel = (v) => String(v || '').replace(/\D/g, '').length === 10
const v_ = (x) => (String(x || '').trim() ? x : '—')
const IcoLapiz = () => <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
const IcoReloj = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FF6600" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>

const BUCKET_PF = 'archivador_empresas'
export const BANCOS = ['Banamex (Banco Nacional de México)', 'Banco Azteca', 'Banco Santander', 'Banorte', 'BBVA', 'Inbursa', 'Scotiabank', 'Otros']
const TIPOS_CUENTA = ['Cheques', 'Débito', 'Cuenta CLABE / concentradora']
// Columnas de perfiles_empresa (las mismas que lee el Brain)
const CAMPOS = ['razon_social', 'figura_juridica', 'rfc_razon_social', 'fecha_ingreso_operacion', 'regimen_fiscal', 'codigo_sat', 'direccion',
  'representante_legal', 'rfc_representante', 'curp_representante', 'correo_contacto', 'fono_contacto',
  'banco', 'tipo_cuenta', 'titular_cuenta', 'rfc_titular', 'cuenta_clabe']
const VACIO = Object.fromEntries([...CAMPOS, 'banco_sel', 'evidencia_cuenta_path', 'evidencia_nombre'].map((k) => [k, '']))
const dmy = (d) => { const x = new Date(d); return `${String(x.getDate()).padStart(2, '0')}/${String(x.getMonth() + 1).padStart(2, '0')}/${x.getFullYear()}` }

// ¿Perfil completo? (lo usa también el aviso de Inicio)
export function perfilCompletoMK(p) {
  if (!p) return false
  for (const k of CAMPOS) if (!String(p[k] || '').trim()) return false
  if (String(p.cuenta_clabe || '').replace(/\D/g, '').length !== 18) return false
  return !!p.evidencia_cuenta_path
}

const IcoInfo = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FF6600" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></svg>
const IcoCheck = ({ s = 20 }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="#002E5D" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
const IcoHist = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#002E5D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5M12 7v5l3 2" /></svg>

// Campo con etiqueta y marca roja (fuera del componente: así no se pierde el foco al escribir)
function Campo({ id, label, falta, full, children, hint }) {
  return (
    <div className={`field${full ? ' full' : ''}${falta ? ' is-missing' : ''}`}>
      <label htmlFor={id}>{label}<span className="req"> *</span></label>
      {children}
      {hint}
    </div>
  )
}

export default function Perfil({ tercero, email, onBack, onGuardado }) {
  const tid = tercero.tercero_id
  const claveBorrador = `bt_perfil_borrador_${tid}`
  const [p, setP] = useState(null)
  const [guardadoBD, setGuardadoBD] = useState(false)    // hay un perfil guardado en la base
  const [borrador, setBorrador] = useState(null)         // { guardadoEn } si se retomó uno
  const [marcar, setMarcar] = useState(false)
  const [modal, setModal] = useState(null)               // 'faltan' | 'ejemplo' | 'ver'
  const [ejemplo, setEjemplo] = useState(0)
  const [verUrl, setVerUrl] = useState(null)
  const [toast, setToast] = useState('')
  const [busy, setBusy] = useState(false)
  const [subiendo, setSubiendo] = useState(false)
  const fileRef = useRef(null)
  const [modo, setModo] = useState('form')              // form | fichas
  const paraDespues = useRef(false)                     // el borrador viene de "Guardar y continuar después"
  const [solicitud, setSolicitud] = useState(null)      // solicitud de cambio de cuenta pendiente
  const [ec, setEc] = useState(null)                    // edición de contacto { correo, tel, marcar }
  const [cambio, setCambio] = useState(null)            // modal "Solicitar cambio"
  const cambioFile = useRef(null)

  useEffect(() => { (async () => {
    const { data } = await supabase.from('perfiles_empresa').select('*').eq('tercero_id', tid).maybeSingle()
    let b = null
    try { b = JSON.parse(localStorage.getItem(claveBorrador) || 'null') } catch { /* ilegible */ }
    const base = { ...VACIO }
    if (data) for (const k of Object.keys(VACIO)) if (data[k] != null) base[k] = String(data[k])
    // Banco guardado que no está en la lista → "Otros" con su nombre
    if (base.banco) base.banco_sel = BANCOS.includes(base.banco) ? base.banco : 'Otros'
    // Un borrador viejo (versión anterior) trae solo los datos; el nuevo, { datos, guardadoEn }
    const datosB = b && (b.datos || b)
    const completoBD = !!data && perfilCompletoMK(data)
    paraDespues.current = !!(b && b.paraDespues)
    if (datosB && paraDespues.current && !completoBD) {
      // Volvió después de "Guardar y continuar después": aviso y faltantes en rojo
      const m = { ...base, ...datosB }
      if (m.banco && !m.banco_sel) m.banco_sel = BANCOS.includes(m.banco) ? m.banco : 'Otros'
      setP(m); setBorrador({ guardadoEn: b.guardadoEn || new Date().toISOString() }); setMarcar(true)
    } else if (completoBD) {
      setP(base); setModo('fichas')
    } else if (datosB) {
      // Primera carga en curso: se retoma lo escrito, sin aviso ni rojo
      const m = { ...base, ...datosB }
      if (m.banco && !m.banco_sel) m.banco_sel = BANCOS.includes(m.banco) ? m.banco : 'Otros'
      setP(m)
    } else setP(base)
    setGuardadoBD(!!data)
    const { data: sol } = await supabase.from('solicitudes_cambio_cuenta').select('*').eq('tercero_id', tid).eq('estado', 'pendiente').maybeSingle()
    setSolicitud(sol || null)
  })() }, [tid])   // eslint-disable-line react-hooks/exhaustive-deps

  const aviso = (t) => { setToast(t); setTimeout(() => setToast(''), 5000) }
  const guardarBorrador = (n) => { try { localStorage.setItem(claveBorrador, JSON.stringify({ datos: n, guardadoEn: new Date().toISOString(), paraDespues: paraDespues.current })) } catch { /* sin almacenamiento */ } }
  const set = (k, v) => setP((prev) => { const n = { ...prev, [k]: v }; guardarBorrador(n); return n })
  const elegirBanco = (v) => setP((prev) => {
    const n = { ...prev, banco_sel: v, banco: v === 'Otros' ? (BANCOS.includes(prev.banco) ? '' : prev.banco) : v }
    guardarBorrador(n); return n
  })

  if (!p) return <div className="pf"><style>{CSS_PF}</style><div className="notice">Cargando tu perfil…</div></div>

  const esOtros = p.banco_sel === 'Otros'
  const falta = (k) => marcar && !String(p[k] || '').trim()
  const faltaClabe = marcar && String(p.cuenta_clabe || '').replace(/\D/g, '').length !== 18
  const nClabe = String(p.cuenta_clabe || '').replace(/\D/g, '').length
  const completo = perfilCompletoMK(p)

  const subir = async (e) => {
    const file = e.target.files?.[0]; e.target.value = ''
    if (!file) return
    setSubiendo(true)
    try {
      const path = `${tid}/perfil/evidencia_cuenta_${Date.now()}.${(file.name.split('.').pop() || 'jpg').toLowerCase()}`
      const { error } = await supabase.storage.from(BUCKET_PF).upload(path, file, { upsert: true })
      if (error) throw new Error(error.message)
      setP((prev) => { const n = { ...prev, evidencia_cuenta_path: path, evidencia_nombre: file.name }; guardarBorrador(n); return n })
    } catch (x) { alert('No se pudo subir el archivo: ' + x.message) }
    finally { setSubiendo(false) }
  }
  const quitar = () => setP((prev) => { const n = { ...prev, evidencia_cuenta_path: '', evidencia_nombre: '' }; guardarBorrador(n); return n })
  const verComprobante = async () => {
    const { data } = await supabase.storage.from(BUCKET_PF).createSignedUrl(p.evidencia_cuenta_path, 600)
    setVerUrl(data?.signedUrl || null); setModal('ver')
  }
  const descartar = () => {
    try { localStorage.removeItem(claveBorrador) } catch { /* nada */ }
    paraDespues.current = false
    setP({ ...VACIO }); setBorrador(null); setMarcar(false)
  }
  // Guarda sin validar ni marcar en rojo; el aviso y el rojo aparecen al volver a entrar
  const guardarDespues = () => { paraDespues.current = true; guardarBorrador(p); aviso('Registro guardado. Puedes continuar cuando quieras.') }
  const guardarPerfil = async () => {
    if (!completo) { setMarcar(true); setModal('faltan'); return }
    setBusy(true)
    try {
      const fila = { tercero_id: tid, actualizado_por: email || '', updated_at: new Date().toISOString(), evidencia_cuenta_path: p.evidencia_cuenta_path }
      for (const k of CAMPOS) fila[k] = String(p[k] || '').trim()
      fila.cuenta_clabe = fila.cuenta_clabe.replace(/\D/g, '')
      for (const k of ['rfc_razon_social', 'rfc_representante', 'curp_representante', 'rfc_titular']) fila[k] = fila[k].toUpperCase()
      const { error } = await supabase.from('perfiles_empresa').upsert(fila, { onConflict: 'tercero_id' })
      if (error) throw new Error(error.message)
      try { localStorage.removeItem(claveBorrador) } catch { /* nada */ }
      paraDespues.current = false
      setBorrador(null); setGuardadoBD(true); setMarcar(false)
      setModo('fichas'); window.scrollTo({ top: 0, behavior: 'smooth' })
      aviso('Perfil guardado correctamente.')
      if (onGuardado) onGuardado()
    } catch (x) { alert('No se pudo guardar: ' + x.message) }
    finally { setBusy(false) }
  }

  // ── Fichas: editar contacto, copiar CLABE y solicitar cambio de cuenta
  const guardarContacto = async () => {
    if (!okCorreo(ec.correo) || !okTel(ec.tel)) { setEc({ ...ec, marcar: true }); return }
    setBusy(true)
    const { error } = await supabase.from('perfiles_empresa').update({ correo_contacto: ec.correo.trim(), fono_contacto: ec.tel.trim(), actualizado_por: email || '', updated_at: new Date().toISOString() }).eq('tercero_id', tid)
    setBusy(false)
    if (error) { alert('No se pudo guardar: ' + error.message); return }
    setP((prev) => ({ ...prev, correo_contacto: ec.correo.trim(), fono_contacto: ec.tel.trim() })); setEc(null)
    aviso('Datos de contacto actualizados.')
  }
  const copiarClabe = async () => {
    try { await navigator.clipboard.writeText(String(p.cuenta_clabe || '').replace(/\D/g, '')); aviso('CLABE copiada.') } catch { /* sin portapapeles */ }
  }
  const abrirCambio = () => setCambio({ banco_sel: '', banco: '', tipo_cuenta: '', titular_cuenta: '', rfc_titular: '', cuenta_clabe: '', path: '', nombre: '', marcar: false, subiendo: false })
  const subirComprobanteCambio = async (e) => {
    const file = e.target.files?.[0]; e.target.value = ''
    if (!file) return
    setCambio((c) => ({ ...c, subiendo: true }))
    const path = `${tid}/perfil/cambio_cuenta_${Date.now()}.${(file.name.split('.').pop() || 'jpg').toLowerCase()}`
    const { error } = await supabase.storage.from(BUCKET_PF).upload(path, file, { upsert: true })
    setCambio((c) => ({ ...c, subiendo: false, ...(error ? {} : { path, nombre: file.name }) }))
    if (error) alert('No se pudo subir el archivo: ' + error.message)
  }
  const enviarCambio = async () => {
    const c = cambio
    const banco = c.banco_sel === 'Otros' ? c.banco.trim() : c.banco_sel
    const completo = banco && c.tipo_cuenta && c.titular_cuenta.trim() && c.rfc_titular.trim() && c.cuenta_clabe.replace(/\D/g, '').length === 18 && c.path
    if (!completo) { setCambio({ ...c, marcar: true }); return }
    setBusy(true)
    const { data, error } = await supabase.from('solicitudes_cambio_cuenta').insert({
      tercero_id: tid, banco, tipo_cuenta: c.tipo_cuenta, titular_cuenta: c.titular_cuenta.trim(), rfc_titular: c.rfc_titular.trim().toUpperCase(),
      cuenta_clabe: c.cuenta_clabe.replace(/\D/g, ''), comprobante_path: c.path, enviada_por: email || '',
    }).select('*').single()
    setBusy(false)
    if (error) { alert(error.message.includes('una_pendiente') ? 'Ya tienes una solicitud en revisión.' : 'No se pudo enviar: ' + error.message); return }
    setSolicitud(data); setCambio(null)
    aviso('Solicitud enviada. Administración revisará los datos de la nueva cuenta.')
  }
  const cancelarSolicitud = async () => {
    if (!solicitud || !window.confirm('¿Cancelar la solicitud de cambio de cuenta?')) return
    const { error } = await supabase.from('solicitudes_cambio_cuenta').update({ estado: 'cancelada' }).eq('id', solicitud.id)
    if (error) { alert('No se pudo cancelar: ' + error.message); return }
    setSolicitud(null)
  }

  const inp = (k, { up, ...props } = {}) => <input id={`pf-${k}`} autoComplete="off" value={p[k] || ''} onChange={(e) => set(k, up ? e.target.value.toUpperCase() : e.target.value)} {...props} />

  return (
    <div className="pf">
      <style>{CSS_PF}</style>
      <nav className="mk-ruta" aria-label="Ruta">
        <button onClick={onBack}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M11 18l-6-6 6-6" /></svg>Volver</button>
        <span className="sep" />
        <button onClick={onBack}>Inicio</button><span className="gt">›</span>
        <span>Mi empresa</span><span className="gt">›</span>
        <span aria-current="page">Perfil y cuenta bancaria</span>
      </nav>
      <div>
        <h1 className="mk-titulo">Perfil y cuenta bancaria</h1>
        <p className="mk-desc">Confirma que los datos de tu perfil (especialmente la cuenta bancaria) sean correctos. BigTicket usará esta cuenta para transferir tus pagos de forma segura.</p>
      </div>

      {modo === 'fichas' ? (
        <div className="notice notice--ok"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#002E5D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }} aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="m8 12 3 3 5-6" /></svg>Perfil completo: tus datos de pago están listos.</div>
      ) : borrador ? (
        <div className="notice" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <span style={{ display: 'flex', gap: 12, alignItems: 'center' }}><IcoHist />
            <span><b className="notice-t">Retomaste una carga incompleta</b><br />Guardada el {dmy(borrador.guardadoEn)}. Los campos en rojo están pendientes.</span></span>
          <button className="link" onClick={descartar}>Descartar y empezar de cero</button>
        </div>
      ) : guardadoBD && completo && !borrador ? (
        <div className="notice notice--ok"><IcoCheck />Perfil completo: tus datos de pago están listos.</div>
      ) : (
        <div className="notice"><IcoInfo />Todos los campos son obligatorios. Puedes salir cuando quieras: tus datos se guardan automáticamente y podrás continuar después.</div>
      )}

      {modo === 'form' && (<>
      <section className="pf-card">
        <h2>Datos de la empresa</h2>
        <div className="pf-grid">
          <Campo id="pf-razon_social" label="Razón social" falta={falta('razon_social')} full>{inp('razon_social', { placeholder: 'Nombre o razón social' })}</Campo>
          <Campo id="pf-figura_juridica" label="Figura jurídica" falta={falta('figura_juridica')}>
            <div className="sel"><select autoComplete="off" id="pf-figura_juridica" value={p.figura_juridica} onChange={(e) => set('figura_juridica', e.target.value)}>
              <option value="">Selecciona…</option><option value="fisica">Persona física</option><option value="moral">Persona moral</option>
            </select></div>
          </Campo>
          <Campo id="pf-rfc_razon_social" label="RFC" falta={falta('rfc_razon_social')}>{inp('rfc_razon_social', { maxLength: 13, placeholder: '12 o 13 caracteres', up: true })}</Campo>
          <Campo id="pf-fecha_ingreso_operacion" label="Inicio de operación" falta={falta('fecha_ingreso_operacion')}>{inp('fecha_ingreso_operacion', { type: 'date' })}</Campo>
          <Campo id="pf-regimen_fiscal" label="Régimen fiscal" falta={falta('regimen_fiscal')}>{inp('regimen_fiscal', { placeholder: 'Ej. Autotransporte de carga' })}</Campo>
          <Campo id="pf-codigo_sat" label="Código SAT" falta={falta('codigo_sat')}>{inp('codigo_sat')}</Campo>
          <Campo id="pf-direccion" label="Dirección" falta={falta('direccion')} full>{inp('direccion', { placeholder: 'Calle, número, colonia, municipio' })}</Campo>
        </div>
      </section>

      <section className="pf-card">
        <h2>Representante legal y contacto</h2>
        <div className="pf-grid">
          <Campo id="pf-representante_legal" label="Nombre" falta={falta('representante_legal')} full>{inp('representante_legal', { placeholder: 'Nombre y apellidos' })}</Campo>
          <Campo id="pf-rfc_representante" label="RFC" falta={falta('rfc_representante')}>{inp('rfc_representante', { maxLength: 13, up: true })}</Campo>
          <Campo id="pf-curp_representante" label="CURP" falta={falta('curp_representante')}>{inp('curp_representante', { maxLength: 18, up: true })}</Campo>
          <Campo id="pf-correo_contacto" label="Correo" falta={falta('correo_contacto')}>{inp('correo_contacto', { type: 'email', placeholder: 'correo@ejemplo.com' })}</Campo>
          <Campo id="pf-fono_contacto" label="Teléfono" falta={falta('fono_contacto')}>{inp('fono_contacto', { type: 'tel', inputMode: 'tel', placeholder: '10 dígitos' })}</Campo>
        </div>
      </section>

      <section className="pf-card">
        <div><h2>Cuenta bancaria</h2><p className="pf-sub">La cuenta bancaria debe estar a nombre de la empresa o del Representante Legal.</p></div>
        <div className="pf-grid">
          <Campo id="pf-banco_sel" label="Banco" falta={marcar && !p.banco_sel}>
            <div className="sel"><select autoComplete="off" id="pf-banco_sel" value={p.banco_sel} onChange={(e) => elegirBanco(e.target.value)}>
              <option value="">Selecciona tu banco…</option>{BANCOS.map((b) => <option key={b} value={b}>{b}</option>)}
            </select></div>
          </Campo>
          {esOtros && <Campo id="pf-banco" label="Nombre del banco" falta={falta('banco')}>{inp('banco', { placeholder: 'Ingresa el nombre de tu banco' })}</Campo>}
          <Campo id="pf-tipo_cuenta" label="Tipo de cuenta" falta={falta('tipo_cuenta')}>
            <div className="sel"><select autoComplete="off" id="pf-tipo_cuenta" value={p.tipo_cuenta} onChange={(e) => set('tipo_cuenta', e.target.value)}>
              <option value="">— Selecciona —</option>{TIPOS_CUENTA.map((t) => <option key={t} value={t}>{t}</option>)}
            </select></div>
          </Campo>
          <Campo id="pf-titular_cuenta" label="Titular de la cuenta" falta={falta('titular_cuenta')}>{inp('titular_cuenta')}</Campo>
          <Campo id="pf-rfc_titular" label="RFC del titular" falta={falta('rfc_titular')}>{inp('rfc_titular', { maxLength: 13, up: true })}</Campo>
          <Campo id="pf-cuenta_clabe" label="Cuenta CLABE" falta={faltaClabe} hint={<span className="hint">{nClabe} de 18 dígitos</span>}>
            <input id="pf-cuenta_clabe" autoComplete="off" value={p.cuenta_clabe || ''} inputMode="numeric" onChange={(e) => set('cuenta_clabe', e.target.value.replace(/\D/g, '').slice(0, 18))} />
          </Campo>
        </div>
        <div className={`upload${p.evidencia_cuenta_path ? ' is-loaded' : ''}${marcar && !p.evidencia_cuenta_path ? ' is-missing' : ''}`}>
          <div style={{ minWidth: 0 }}>
            <div className="up-t">Comprobante bancario<span className="req"> *</span>{marcar && !p.evidencia_cuenta_path && <span className="missing"> — falta</span>}</div>
            <div className="up-m">
              {p.evidencia_cuenta_path ? <>{p.evidencia_nombre || String(p.evidencia_cuenta_path).split('/').pop()} · Cargado</>
                : <>Captura de tu app o estado de cuenta donde se vean el banco y la CLABE. <button className="link-action sm" onClick={() => setModal('ejemplo')}>Ver ejemplo</button></>}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input ref={fileRef} type="file" accept="image/*,.pdf" hidden onChange={subir} />
            {p.evidencia_cuenta_path ? (<>
              <button className="link-action" onClick={verComprobante}>Ver</button>
              <button className="btn-sm btn-sm--secondary" onClick={quitar}>Quitar</button>
            </>) : <button className="btn-sm btn-sm--primary" disabled={subiendo} onClick={() => fileRef.current?.click()}>{subiendo ? 'Subiendo…' : 'Subir archivo'}</button>}
          </div>
        </div>
      </section>

      <div className="pf-actions">
        <button className="btn-outline" onClick={guardarDespues}>Guardar y continuar después</button>
        <button className="btn-primary" disabled={busy} onClick={guardarPerfil}>{busy ? 'Guardando…' : 'Guardar perfil'}</button>
      </div>
      </>)}

      {modo === 'fichas' && (<>
        <section className="pf-card">
          <h2>Datos de la empresa</h2>
          <dl className="pf-dl">
            <div className="full"><dt>Razón social</dt><dd>{v_(p.razon_social)}</dd></div>
            <div><dt>Figura jurídica</dt><dd>{p.figura_juridica === 'moral' ? 'Persona moral' : p.figura_juridica === 'fisica' ? 'Persona física' : '—'}</dd></div>
            <div><dt>RFC</dt><dd>{v_(p.rfc_razon_social)}</dd></div>
            <div><dt>Inicio de operación</dt><dd>{fechaLarga(p.fecha_ingreso_operacion)}</dd></div>
            <div><dt>Régimen fiscal</dt><dd>{v_(p.regimen_fiscal)}</dd></div>
            <div className="full"><dt>Código SAT</dt><dd>{v_(p.codigo_sat)}</dd></div>
            <div className="full"><dt>Dirección</dt><dd>{v_(p.direccion)}</dd></div>
          </dl>
        </section>

        <section className="pf-card">
          <div className="pf-card-head">
            <h2>Representante legal y contacto</h2>
            {!ec && <button className="link-edit" onClick={() => setEc({ correo: p.correo_contacto || '', tel: p.fono_contacto || '', marcar: false })}><IcoLapiz />Editar contacto</button>}
          </div>
          <dl className="pf-dl">
            <div className="full"><dt>Nombre</dt><dd>{v_(p.representante_legal)}</dd></div>
            <div><dt>RFC</dt><dd>{v_(p.rfc_representante)}</dd></div>
            <div><dt>CURP</dt><dd>{v_(p.curp_representante)}</dd></div>
            {ec ? (<>
              <div className={`field${ec.marcar && !okCorreo(ec.correo) ? ' is-missing' : ''}`}><label htmlFor="ec-correo">Correo<span className="req"> *</span></label>
                <input id="ec-correo" type="email" autoComplete="off" value={ec.correo} onChange={(e) => setEc({ ...ec, correo: e.target.value })} /></div>
              <div className={`field${ec.marcar && !okTel(ec.tel) ? ' is-missing' : ''}`}><label htmlFor="ec-tel">Teléfono<span className="req"> *</span></label>
                <input id="ec-tel" type="tel" inputMode="tel" autoComplete="off" value={ec.tel} onChange={(e) => setEc({ ...ec, tel: e.target.value })} /></div>
            </>) : (<>
              <div><dt>Correo</dt><dd>{v_(p.correo_contacto)}</dd></div>
              <div><dt>Teléfono</dt><dd>{v_(p.fono_contacto)}</dd></div>
            </>)}
          </dl>
          {ec && (
            <div className="pf-edit-actions">
              <button className="btn-outline" onClick={() => setEc(null)}>Cancelar</button>
              <button className="btn-primary" disabled={busy} onClick={guardarContacto}>Guardar cambios</button>
            </div>
          )}
        </section>

        <section className="pf-card">
          <div className="pf-card-head">
            <div><h2>Cuenta bancaria</h2><p className="pf-sub">Aquí recibes tus pagos semanales.</p></div>
            {!solicitud && <button className="link-edit" onClick={abrirCambio}><IcoLapiz />Solicitar cambio</button>}
          </div>
          {solicitud && (
            <div className="req-pending">
              <span style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}><IcoReloj />
                <span><span className="t">Solicitud de cambio en revisión por administración</span><br />
                  <span className="d">Enviada el {dmy(solicitud.enviada_at)}. Nueva cuenta: {solicitud.banco} · CLABE terminación {String(solicitud.cuenta_clabe).slice(-4)}. Mientras administración valida los datos, tus pagos se siguen depositando en la cuenta actual.</span></span></span>
              <button className="link-action" onClick={cancelarSolicitud}>Cancelar solicitud</button>
            </div>
          )}
          <div className="clabe-box">
            <div><div className="label">Cuenta CLABE · {v_(p.banco)}</div><div className="num">{fmtClabe(p.cuenta_clabe) || '—'}</div></div>
            <button className="copy" aria-label="Copiar CLABE" title="Copiar CLABE" onClick={copiarClabe}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
            </button>
          </div>
          <div>
            <div className="sheet-row"><span className="k">Titular</span><span className="v">{v_(p.titular_cuenta)}</span></div>
            <div className="sheet-row"><span className="k">RFC del titular</span><span className="v">{v_(p.rfc_titular)}</span></div>
            <div className="sheet-row"><span className="k">Tipo de cuenta</span><span className="v">{v_(p.tipo_cuenta)}</span></div>
            <div className="sheet-row">
              <span><span className="k" style={{ display: 'block' }}>Comprobante bancario</span>
                <span style={{ display: 'block', font: '400 12.5px "Open Sans", sans-serif', color: '#545454', marginTop: 2 }}>Captura con banco y CLABE</span></span>
              <span className="v">{p.evidencia_cuenta_path ? <button className="link-action" onClick={verComprobante}>Ver</button> : '—'}</span></div>
          </div>
        </section>
      </>)}

      {modal === 'faltan' && (
        <div className="viewer-backdrop" onClick={() => setModal(null)}>
          <div className="alert-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#C43D2F" strokeWidth="2.4" strokeLinecap="round"><path d="M12 7v6M12 16.5h.01" /></svg></div>
            <h3>Faltan datos obligatorios</h3>
            <p>Para guardar tu perfil, completa todos los campos marcados en rojo y sube el comprobante bancario.</p>
            <button className="btn-navy" onClick={() => setModal(null)}>Revisar campos</button>
          </div>
        </div>
      )}
      {(modal === 'ejemplo' || modal === 'ver') && (
        <div className="viewer-backdrop" onClick={() => setModal(null)}>
          <div className="viewer" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="viewer-head">
              <div>
                <h2>{modal === 'ejemplo' ? 'Ejemplo de comprobante bancario' : 'Comprobante bancario'}</h2>
                <p>{modal === 'ejemplo' ? 'Sube una captura similar donde se vean el nombre del banco, el titular y la CLABE. Datos personales ocultos en este ejemplo.' : (p.evidencia_nombre || String(p.evidencia_cuenta_path).split('/').pop())}</p>
              </div>
              <button className="viewer-x" aria-label="Cerrar" onClick={() => setModal(null)}>✕</button>
            </div>
            {modal === 'ejemplo' ? (<>
              <div className="segmented" role="tablist">
                {['Ejemplo 1', 'Banco Azteca', 'BBVA'].map((t, i) => <button key={t} role="tab" aria-selected={ejemplo === i} onClick={() => setEjemplo(i)}>{t}</button>)}
              </div>
              <Ejemplo i={ejemplo} />
            </>) : verUrl ? (/\.pdf($|\?)/i.test(p.evidencia_cuenta_path) ? <iframe src={verUrl} title="Comprobante" className="viewer-pdf" /> : <img src={verUrl} alt="Comprobante bancario" />)
              : <p>No se pudo abrir el archivo.</p>}
          </div>
        </div>
      )}
      {cambio && (() => {
        const c = cambio, falta = (ok) => c.marcar && !ok
        const setC = (k, v) => setCambio({ ...c, [k]: v })
        const nCl = c.cuenta_clabe.replace(/\D/g, '').length
        return (
          <div className="viewer-backdrop" onClick={() => setCambio(null)}>
            <div className="req-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
              <div className="viewer-head">
                <div><h2>Solicitar cambio de cuenta bancaria</h2>
                  <p style={{ fontSize: 14 }}>Ingresa los datos de la nueva cuenta. Administración revisará la solicitud antes de aplicar el cambio. La cuenta bancaria debe estar a nombre de la empresa o del Representante Legal.</p></div>
                <button className="viewer-x" aria-label="Cerrar" onClick={() => setCambio(null)}>✕</button>
              </div>
              <div className="pf-grid">
                <div className={`field${falta(c.banco_sel) ? ' is-missing' : ''}`}><label htmlFor="cc-banco">Banco<span className="req"> *</span></label>
                  <div className="sel"><select id="cc-banco" autoComplete="off" value={c.banco_sel} onChange={(e) => setC('banco_sel', e.target.value)}>
                    <option value="">Selecciona tu banco…</option>{BANCOS.map((b) => <option key={b} value={b}>{b}</option>)}</select></div></div>
                {c.banco_sel === 'Otros' && <div className={`field${falta(c.banco.trim()) ? ' is-missing' : ''}`}><label htmlFor="cc-bn">Nombre del banco<span className="req"> *</span></label>
                  <input id="cc-bn" autoComplete="off" value={c.banco} onChange={(e) => setC('banco', e.target.value)} placeholder="Ingresa el nombre de tu banco" /></div>}
                <div className={`field${falta(c.tipo_cuenta) ? ' is-missing' : ''}`}><label htmlFor="cc-tipo">Tipo de cuenta<span className="req"> *</span></label>
                  <div className="sel"><select id="cc-tipo" autoComplete="off" value={c.tipo_cuenta} onChange={(e) => setC('tipo_cuenta', e.target.value)}>
                    <option value="">— Selecciona —</option>{TIPOS_CUENTA.map((t) => <option key={t} value={t}>{t}</option>)}</select></div></div>
                <div className={`field${falta(c.titular_cuenta.trim()) ? ' is-missing' : ''}`}><label htmlFor="cc-tit">Titular de la cuenta<span className="req"> *</span></label>
                  <input id="cc-tit" autoComplete="off" value={c.titular_cuenta} onChange={(e) => setC('titular_cuenta', e.target.value)} /></div>
                <div className={`field${falta(c.rfc_titular.trim()) ? ' is-missing' : ''}`}><label htmlFor="cc-rfc">RFC del titular<span className="req"> *</span></label>
                  <input id="cc-rfc" autoComplete="off" maxLength={13} value={c.rfc_titular} onChange={(e) => setC('rfc_titular', e.target.value.toUpperCase())} /></div>
                <div className={`field${falta(nCl === 18) ? ' is-missing' : ''}`}><label htmlFor="cc-clabe">Cuenta CLABE<span className="req"> *</span></label>
                  <input id="cc-clabe" autoComplete="off" inputMode="numeric" value={c.cuenta_clabe} onChange={(e) => setC('cuenta_clabe', e.target.value.replace(/\D/g, '').slice(0, 18))} />
                  <span className="hint">{nCl} de 18 dígitos</span></div>
              </div>
              <div className={`upload${c.path ? ' is-loaded' : ''}${falta(c.path) ? ' is-missing' : ''}`}>
                <div style={{ minWidth: 0 }}><div className="up-t">Comprobante de la nueva cuenta<span className="req"> *</span>{falta(c.path) && <span className="missing"> — falta</span>}</div>
                  <div className="up-m">{c.path ? `${c.nombre} · Cargado` : 'Captura de tu app o estado de cuenta donde se vean el banco y la CLABE.'}</div></div>
                <input ref={cambioFile} type="file" accept="image/*,.pdf" hidden onChange={subirComprobanteCambio} />
                {c.path ? <button className="btn-sm btn-sm--secondary" onClick={() => setCambio({ ...c, path: '', nombre: '' })}>Quitar</button>
                  : <button className="btn-sm btn-sm--primary" disabled={c.subiendo} onClick={() => cambioFile.current?.click()}>{c.subiendo ? 'Subiendo…' : 'Subir archivo'}</button>}
              </div>
              {c.marcar && <div className="req-error">Completa todos los campos marcados en rojo y sube el comprobante de la nueva cuenta.</div>}
              <div className="pf-actions">
                <button className="btn-outline" onClick={() => setCambio(null)}>Cancelar</button>
                <button className="btn-primary" disabled={busy} onClick={enviarCambio}>{busy ? 'Enviando…' : 'Enviar solicitud'}</button>
              </div>
            </div>
          </div>
        )
      })()}
      {toast && <div className="toast" role="status"><IcoCheck />{toast}</div>}
    </div>
  )
}

// Ejemplos de comprobante (marketing, datos ficticios u ocultos): public/ejemplos-comprobante/
const EJEMPLOS = [
  ['/ejemplos-comprobante/ejemplo-1.jpg', 'Ejemplo 1: estado de cuenta con datos ocultos'],
  ['/ejemplos-comprobante/banco-azteca.jpg', 'Ejemplo Banco Azteca'],
  ['/ejemplos-comprobante/bbva.jpg', 'Ejemplo BBVA: estado de cuenta'],
]
function Ejemplo({ i }) {
  const [src, alt] = EJEMPLOS[i] || EJEMPLOS[0]
  return <img src={src} alt={alt} />
}

const CSS_PF = CSS_MK + `
.pf { display:flex; flex-direction:column; gap:20px; font-family:"Open Sans",sans-serif; }
.notice { display:flex; align-items:center; gap:12px; padding:14px 18px; background:#fff; border:1px solid #E4E3E3; border-radius:12px; box-shadow:0 1px 3px rgba(0,46,93,.05); font:400 14px/1.5 "Open Sans",sans-serif; color:#545454; }
.notice svg { flex:none; }
.notice--ok { font:700 14px Poppins,sans-serif; color:#002E5D; }
.notice-t { font:700 14px Poppins,sans-serif; color:#002E5D; }
.notice .link { border:none; background:none; padding:0; cursor:pointer; font:400 14px "Open Sans",sans-serif; color:#545454; text-decoration:underline; text-underline-offset:3px; }
.notice .link:hover { color:#002E5D; }
.pf-card { background:#fff; border:1px solid #E4E3E3; border-radius:16px; padding:22px 24px; display:flex; flex-direction:column; gap:18px; box-shadow:0 1px 3px rgba(0,46,93,.05); transition:box-shadow .2s, transform .2s, border-color .2s; }
.pf-card:hover { box-shadow:0 12px 28px rgba(0,46,93,.14); transform:translateY(-2px); border-color:#B8C4D3; }
.pf-card h2 { font:600 20px Poppins,sans-serif; color:#002E5D; margin:0; }
.pf-sub { font:400 14px "Open Sans",sans-serif; color:#545454; margin:6px 0 0; }
.pf-grid { display:grid; gap:18px 20px; grid-template-columns:repeat(auto-fill,minmax(min(100%,220px),1fr)); }
.pf-grid .full { grid-column:1 / -1; }
.field { display:flex; flex-direction:column; gap:8px; min-width:0; }
.field label { font:700 14px Poppins,sans-serif; color:#002E5D; }
.req { color:#FF6600; }
.field input, .field select { height:46px; padding:0 14px; width:100%; box-sizing:border-box; border:1px solid #C9CDD2; border-radius:10px; background:#fff; font:400 14px "Open Sans",sans-serif; color:#545454; transition:background .15s, border-color .15s; }
.field select { appearance:none; -webkit-appearance:none; padding-right:40px; cursor:pointer; }
.sel { position:relative; }
.sel::after { content:''; position:absolute; right:16px; top:50%; width:12px; height:12px; transform:translateY(-50%); pointer-events:none;
  background:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23002E5D' stroke-width='2.5' stroke-linecap='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E") center/12px no-repeat; }
.field.is-missing input, .field.is-missing select { border-color:#C43D2F; background:#FDF1F0; }
.field .hint { font:400 12.5px "Open Sans",sans-serif; color:#545454; }
.upload { display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; min-height:60px; padding:10px 12px 10px 16px; border:1.5px dashed #C9CDD2; border-radius:12px; background:#fff; }
.upload.is-loaded { border-color:#002E5D; background:rgba(0,46,93,.04); }
.upload.is-missing { border-color:#C43D2F; background:#FDF1F0; }
.up-t { font:700 15px Poppins,sans-serif; color:#002E5D; }
.up-m { font:400 12.5px "Open Sans",sans-serif; color:#545454; }
.upload .missing { color:#C43D2F; font:400 15px "Open Sans",sans-serif; }
.btn-sm { height:32px; padding:0 14px; border-radius:8px; font:700 12.5px Poppins,sans-serif; cursor:pointer; }
.btn-sm--primary { background:#002E5D; color:#fff; border:none; }
.btn-sm--secondary { background:#fff; color:#002E5D; border:1px solid #C9CDD2; }
.link-action { border:none; background:none; padding:0 4px; font:400 14px "Open Sans",sans-serif; color:#545454; cursor:pointer; text-decoration:underline; text-underline-offset:3px; }
.link-action.sm { font-size:12.5px; padding:0; }
.link-action:hover { color:#002E5D; }
.pf-actions { display:flex; justify-content:flex-end; gap:10px; flex-wrap:wrap; }
.btn-outline { height:44px; padding:0 22px; border-radius:10px; border:1.5px solid #002E5D; background:#fff; color:#002E5D; font:700 14px Poppins,sans-serif; cursor:pointer; }
.btn-outline:hover { background:#F4F6F9; }
.btn-primary { height:44px; padding:0 22px; border-radius:10px; border:none; background:#FF6600; color:#fff; font:700 14px Poppins,sans-serif; cursor:pointer; }
.btn-primary:hover { filter:brightness(.94); }
.btn-primary:disabled { opacity:.6; }
.btn-navy { width:100%; height:44px; border:none; border-radius:10px; background:#002E5D; color:#fff; font:700 14px Poppins,sans-serif; cursor:pointer; }
.viewer-backdrop { position:fixed; inset:0; z-index:250; padding:24px; background:rgba(0,30,61,.55); display:flex; align-items:center; justify-content:center; }
.viewer { max-width:920px; width:100%; max-height:calc(100vh - 48px); overflow:auto; background:#fff; border-radius:16px; padding:20px 24px 24px; display:flex; flex-direction:column; gap:14px; box-shadow:0 24px 60px rgba(0,30,61,.28); box-sizing:border-box; }
.viewer-head { display:flex; justify-content:space-between; align-items:flex-start; gap:12px; }
.viewer-head h2 { font:600 20px Poppins,sans-serif; color:#002E5D; margin:0; }
.viewer-head p { font:400 12.5px "Open Sans",sans-serif; color:#545454; margin:4px 0 0; }
.viewer-x { width:36px; height:36px; border-radius:50%; border:1px solid #E4E3E3; background:#fff; color:#545454; cursor:pointer; flex:none; }
.segmented { display:flex; gap:4px; padding:4px; background:#fff; border:1px solid #E4E3E3; border-radius:10px; align-self:flex-start; }
.segmented button { height:30px; padding:0 14px; border-radius:7px; border:none; font:700 13px Poppins,sans-serif; background:#fff; color:#002E5D; cursor:pointer; }
.segmented [aria-selected="true"] { background:#002E5D; color:#fff; }
.viewer img { width:100%; border:1px solid #E4E3E3; border-radius:10px; }
.viewer-pdf { width:100%; height:70vh; border:1px solid #E4E3E3; border-radius:10px; }
.alert-modal { max-width:380px; width:100%; background:#fff; border-radius:18px; padding:28px 24px 24px; text-align:center; display:flex; flex-direction:column; align-items:center; gap:14px; box-shadow:0 24px 60px rgba(0,30,60,.25); box-sizing:border-box; }
.alert-modal .icon { width:44px; height:44px; border-radius:50%; background:#FDECEA; display:flex; align-items:center; justify-content:center; }
.alert-modal h3 { font:700 19px Poppins,sans-serif; color:#002E5D; margin:0; }
.alert-modal p { font:400 14px/1.5 "Open Sans",sans-serif; color:#545454; margin:0; }
.toast { position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); z-index:300; display:flex; align-items:center; gap:12px; padding:20px 28px; background:#fff; border:1px solid #E4E3E3; border-radius:14px; box-shadow:0 24px 60px rgba(0,30,61,.22); font:700 14px Poppins,sans-serif; color:#002E5D; }
.pf-card-head { display:flex; justify-content:space-between; align-items:flex-start; gap:12px; flex-wrap:wrap; }
.pf-dl { margin:0; display:grid; gap:16px 20px; grid-template-columns:repeat(auto-fill,minmax(min(100%,200px),1fr)); }
.pf-dl .full { grid-column:1 / -1; }
.pf-dl dt { font:700 14px Poppins,sans-serif; color:#002E5D; }
.pf-dl dd { margin:4px 0 0; font:400 14px/1.5 "Open Sans",sans-serif; color:#545454; word-break:break-word; }
.link-edit { display:inline-flex; align-items:center; gap:6px; padding:0; border:none; background:transparent; font:400 14px "Open Sans",sans-serif; color:#545454; text-decoration:underline; text-underline-offset:3px; cursor:pointer; transition:color .15s; }
.link-edit:hover { color:#002E5D; }
.link-edit svg { width:16px; height:16px; stroke:currentColor; }
.pf-edit-actions { display:flex; justify-content:flex-end; gap:10px; flex-wrap:wrap; padding-top:16px; border-top:1px solid #E4E3E3; }
.clabe-box { display:flex; align-items:center; justify-content:space-between; gap:12px; background:#F4F5F7; border-radius:12px; padding:16px 18px; }
.clabe-box .label { font:700 13px Poppins,sans-serif; color:#002E5D; }
.clabe-box .num { font:600 20px Poppins,sans-serif; letter-spacing:.04em; color:#002E5D; margin-top:2px; }
.clabe-box .copy { width:36px; height:36px; border-radius:10px; border:none; background:transparent; color:#545454; cursor:pointer; display:flex; align-items:center; justify-content:center; flex:none; }
.clabe-box .copy:hover { background:#fff; color:#002E5D; }
.sheet-row { display:flex; align-items:center; justify-content:space-between; gap:8px 16px; flex-wrap:wrap; padding:12px 0; border-bottom:1px solid #E4E3E3; }
.sheet-row:last-child { border-bottom:none; }
.sheet-row .k { font:700 14px Poppins,sans-serif; color:#002E5D; }
.sheet-row .v { font:600 14px "Open Sans",sans-serif; color:#545454; text-align:right; }
.req-pending { display:flex; align-items:flex-start; justify-content:space-between; gap:10px 16px; flex-wrap:wrap; background:#fff; border:1px solid #FFC7A3; border-radius:12px; padding:14px 16px; }
.req-pending .t { font:700 14px Poppins,sans-serif; color:#002E5D; }
.req-pending .d { font:400 14px/1.5 "Open Sans",sans-serif; color:#545454; }
.req-modal { max-width:680px; width:100%; max-height:calc(100vh - 48px); overflow:auto; background:#fff; border-radius:16px; padding:22px 24px 24px; display:flex; flex-direction:column; gap:18px; box-shadow:0 24px 60px rgba(0,30,61,.28); box-sizing:border-box; }
.req-error { background:#FDF1F0; color:#C43D2F; border-radius:10px; padding:10px 12px; font-size:13.5px; }
@media (max-width: 640px) { .pf-actions { flex-direction:column-reverse; } .pf-actions button { width:100%; } }
`
