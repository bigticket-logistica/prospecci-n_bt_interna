import React, { useEffect, useState } from 'react'
import { supabase, BUCKET } from './supabaseClient'

// ⚠️ MODO PRUEBA: pega aquí el id de una empresa
//   (Supabase → Table Editor → tabla "terceros" → columna "id", p. ej. GEMINI LOGISTICS).
const TERCERO_DEMO_ID = '43725368-8b63-4498-9c60-823b887252b6'

// Centros de servicio. Por ahora fijos; más adelante se leen de la tabla que administra el Brain.
const SC_LIST = ['AMX7','ECH4','ECH5','EGD0','EGD9','EHM4','EHM5','EHP5','EHP6','ELP2','ELP3','EPB3','EQR2','ERX6','ETA4','ETG4','ETL1','ETL2','EVM2','EVR3','EZL1','SAG1','SBJ1','SCC1','SCD1','SCG1','SCH1','SCJ1','SCM1','SCN1','SCP1','SCQ1','SCT1','SCU1','SCV1','SCX1','SCY1','SDC1','SDG1','SEN1','SGD1','SGD2','SGD3','SGD4','SHM1','SHP1','SHP2','SJA1','SJD1','SLE1','SLP1','SLV1','SLW1','SLZ1','SMA1','SMD1','SML1','SMO1','SMT1','SMT2','SMT3','SMX1','SMX10','SMX2','SMX3','SMX4','SMX5','SMX6','SMX7','SMX8','SMX9','SMZ1','SNG1','SNL1','SOX1','SPB1','SPD1','SPV1','SPY1','SPZ1','SQR1','SQR2','SRX1','SSL1','STA1','STG1','STJ1','STL1','STL2','STN1','STP1','STR1','STT1','STX1','SUR1','SVH1','SVM1','SVR1','SXL1','SZC1','SZL1','SZM1','XSM11']; // 103 centros; luego se leen de la tabla del Brain

const ESTADOS_MX = [
  'AGUASCALIENTES','BAJA CALIFORNIA','BAJA CALIFORNIA SUR','CAMPECHE','CHIAPAS','CHIHUAHUA',
  'CIUDAD DE MEXICO','COAHUILA','COLIMA','DURANGO','ESTADO DE MEXICO','GUANAJUATO','GUERRERO',
  'HIDALGO','JALISCO','MICHOACAN','MORELOS','NAYARIT','NUEVO LEON','OAXACA','PUEBLA','QUERETARO',
  'QUINTANA ROO','SAN LUIS POTOSI','SINALOA','SONORA','TABASCO','TAMAULIPAS','TLAXCALA','VERACRUZ','YUCATAN','ZACATECAS',
]
const ESTADO_LABEL = { enviado:'Enviado', en_validacion:'En validación', validado:'Validado', con_alertas:'Con alertas', rechazado:'Rechazado', certificado:'Certificado' }
const TIPO_LABEL = { conductor:'Conductor', ayudante:'Ayudante', vehiculo:'Vehículo' }

export default function App() {
  const [session, setSession] = useState(null)
  const [view, setView] = useState('home') // home | estado | conductor | ayudante | vehiculo

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  if (!session) return <Login />
  if (!TERCERO_DEMO_ID) return <FaltaId />

  const tercero = { tercero_id: TERCERO_DEMO_ID, nombre: 'Empresa de prueba' }
  const email = session.user.email
  return (
    <Shell tercero={tercero} email={email}>
      {view === 'home' && <Home onPick={setView} />}
      {view === 'estado' && <Estado tercero={tercero} onBack={() => setView('home')} />}
      {(view === 'conductor' || view === 'ayudante') &&
        <FormPersona tipo={view} tercero={tercero} email={email} onBack={() => setView('home')} onDone={() => setView('estado')} />}
      {view === 'vehiculo' &&
        <FormVehiculo tercero={tercero} email={email} onBack={() => setView('home')} onDone={() => setView('estado')} />}
    </Shell>
  )
}

// ── Login ────────────────────────────────────────────────────────────
function Login() {
  const [email, setEmail] = useState(''); const [pass, setPass] = useState('')
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false)
  async function entrar() {
    setErr(''); setBusy(true)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pass })
    if (error) setErr('Correo o contraseña incorrectos. Revisa e inténtalo de nuevo.')
    setBusy(false)
  }
  return (
    <div className="login-wrap">
      <div className="login-brand">
        <div className="mark"><span className="dot" /><span>Bigticket</span></div>
        <div>
          <h1>Certifica a tus conductores, ayudantes y vehículos antes de que entren a operar.</h1>
          <p>Portal para empresas transportistas. Envía los datos y nosotros los validamos contra las fuentes oficiales.</p>
        </div>
      </div>
      <div className="login-form-side">
        <div className="login-card">
          <h2>Entrar</h2>
          <div className="sub">Accede con el correo y la contraseña de tu empresa.</div>
          {err && <div className="form-error">{err}</div>}
          <div className="field"><label>Correo</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && entrar()} placeholder="empresa@correo.com" /></div>
          <div className="field"><label>Contraseña</label>
            <input type="password" value={pass} onChange={e => setPass(e.target.value)} onKeyDown={e => e.key === 'Enter' && entrar()} placeholder="••••••••" /></div>
          <button className="btn btn-primary" style={{ width: '100%' }} onClick={entrar} disabled={busy}>{busy ? 'Entrando…' : 'Entrar'}</button>
        </div>
      </div>
    </div>
  )
}

function FaltaId() {
  return (
    <div className="login-form-side" style={{ minHeight: '100vh' }}>
      <div className="login-card" style={{ textAlign: 'center' }}>
        <h2>Falta el id de la empresa de prueba</h2>
        <div className="sub" style={{ marginTop: 8 }}>
          Abre <b>src/App.jsx</b> y pega el <b>id</b> de una empresa en <b>TERCERO_DEMO_ID</b>
          (lo copias de Supabase → Table Editor → terceros). Luego vuelve a desplegar.
        </div>
      </div>
    </div>
  )
}

// ── Shell ────────────────────────────────────────────────────────────
function Shell({ tercero, email, children }) {
  return (
    <>
      <div className="topbar">
        <div className="mark"><span className="dot" /><b>Bigticket · Certificación</b></div>
        <div className="who">
          <span><span className="name">{tercero.nombre}</span> · {email}</span>
          <button className="logout" onClick={() => supabase.auth.signOut()}>Salir</button>
        </div>
      </div>
      <div className="container">{children}</div>
    </>
  )
}

// ── Home: 4 tarjetas ─────────────────────────────────────────────────
function Home({ onPick }) {
  return (
    <>
      <div className="page-head"><div><h2>¿Qué quieres hacer?</h2>
        <div className="lede">Elige el tipo de certificación o revisa el estado de lo enviado.</div></div></div>
      <div className="type-grid">
        <button className="type-card" onClick={() => onPick('conductor')}>
          <div className="ic">🧍</div><h3>Certificar conductor</h3><p>Valida identidad (CURP, RFC, INE), antecedentes y licencia.</p></button>
        <button className="type-card" onClick={() => onPick('ayudante')}>
          <div className="ic">🧑‍🤝‍🧑</div><h3>Certificar ayudante</h3><p>Valida identidad (CURP, RFC, INE) y antecedentes de un ayudante.</p></button>
        <button className="type-card" onClick={() => onPick('vehiculo')}>
          <div className="ic">🚚</div><h3>Certificar vehículo</h3><p>Valida la placa contra REPUVE y confirma sus datos oficiales.</p></button>
        <button className="type-card estado" onClick={() => onPick('estado')}>
          <div className="ic">📋</div><h3>Estado de certificación</h3><p>Revisa todo lo que has enviado y en qué estado va.</p></button>
      </div>
    </>
  )
}

// ── Estado: listado ──────────────────────────────────────────────────
function Estado({ tercero, onBack }) {
  const [rows, setRows] = useState(null)
  useEffect(() => {
    ;(async () => {
      const { data } = await supabase
        .from('certificaciones')
        .select('id, tipo, estado, enviado_at, service_center, certificacion_conductor(nombre,curp), certificacion_vehiculo(placa,marca)')
        .eq('tercero_id', tercero.tercero_id)
        .order('enviado_at', { ascending: false })
      setRows(data || [])
    })()
  }, [tercero])
  return (
    <>
      <button className="back-link" onClick={onBack}>← Volver</button>
      <div className="page-head"><div><h2>Estado de certificación</h2>
        <div className="lede">Conductores, ayudantes y vehículos que has enviado a validar.</div></div></div>
      <div className="card">
        {rows === null ? <div className="loading">Cargando…</div>
        : rows.length === 0 ? <div className="empty"><h3>Aún no has enviado nada</h3><p>Empieza certificando un conductor, ayudante o vehículo.</p></div>
        : (
          <table>
            <thead><tr><th>Tipo</th><th>Quién / qué</th><th>Identificador</th><th>Centro (SC)</th><th>Estado</th><th>Enviado</th></tr></thead>
            <tbody>
              {rows.map(r => {
                const persona = r.tipo !== 'vehiculo'
                const c = r.certificacion_conductor, v = r.certificacion_vehiculo
                return (
                  <tr key={r.id}>
                    <td><span className="tipo-pill">{TIPO_LABEL[r.tipo] || r.tipo}</span></td>
                    <td>{persona ? (c?.nombre || '—') : (v?.marca || 'Vehículo')}</td>
                    <td>{persona ? (c?.curp || '—') : (v?.placa || '—')}</td>
                    <td>{r.service_center || '—'}</td>
                    <td><span className={`badge ${r.estado}`}>{ESTADO_LABEL[r.estado] || r.estado}</span></td>
                    <td>{r.enviado_at ? new Date(r.enviado_at).toLocaleDateString('es-MX') : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────
function SCSelect({ value, onChange, invalid }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} style={invalid ? { borderColor: '#dc2626', background: '#fff5f5' } : undefined}>
      <option value="">Selecciona el centro…</option>
      {SC_LIST.map(s => <option key={s} value={s}>{s}</option>)}
    </select>
  )
}
function FileField({ label, tipoDoc, files, setFiles, missing }) {
  const has = !!files[tipoDoc]
  const showMiss = missing && !has
  return (
    <div className={`file-row ${has ? 'done' : ''}`} style={showMiss ? { borderColor: '#dc2626', background: '#fff5f5' } : undefined}>
      <label>{label}{has ? ' ✓' : (showMiss ? <span style={{ color: '#dc2626' }}> — falta</span> : '')}</label>
      <label className="file-btn">{has ? 'Cambiar' : 'Subir archivo'}
        <input type="file" accept="image/*,application/pdf" onChange={e => setFiles({ ...files, [tipoDoc]: e.target.files[0] })} /></label>
    </div>
  )
}
async function subirDoc(terceroId, certId, tipoDoc, file) {
  const ext = file.name.split('.').pop()
  const path = `${terceroId}/${certId}/${tipoDoc}.${ext}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true })
  if (error) throw error
  await supabase.from('certificacion_documentos').insert({ certificacion_id: certId, tipo_documento: tipoDoc, storage_path: path })
}

// ── Formulario de persona (conductor o ayudante) ─────────────────────
function FormPersona({ tipo, tercero, email, onBack, onDone }) {
  const esConductor = tipo === 'conductor'
  const [sc, setSc] = useState('')
  const [f, setF] = useState({ nombre: '', curp: '', rfc: '', telefono: '', licencia_numero: '', licencia_estado: '', licencia_vigencia: '' })
  const [files, setFiles] = useState({})
  const [err, setErr] = useState(''); const [ok, setOk] = useState(''); const [busy, setBusy] = useState(false)
  const [intentado, setIntentado] = useState(false); const [faltan, setFaltan] = useState([])
  const miss = (vacio) => (intentado && vacio ? { borderColor: '#dc2626', background: '#fff5f5' } : undefined)
  const set = (k, v) => setF({ ...f, [k]: v })

  async function enviar() {
    setErr(''); setOk('')
    const falta = []
    if (!sc) falta.push('Centro de servicio (SC)')
    if (!f.nombre.trim()) falta.push('Nombre completo')
    if (!f.curp.trim()) falta.push('CURP')
    if (!f.rfc.trim()) falta.push('RFC')
    if (!f.telefono.trim()) falta.push('Teléfono')
    if (esConductor) {
      if (!f.licencia_numero.trim()) falta.push('Número de licencia')
      if (!f.licencia_estado) falta.push('Estado emisor de la licencia')
      if (!f.licencia_vigencia) falta.push('Vigencia de la licencia')
    }
    if (!files.ine) falta.push('Documento: INE — frente')
    if (!files.ine_reverso) falta.push('Documento: INE — reverso')
    if (!files.curp) falta.push('Documento: CURP (PDF)')
    if (esConductor && !files.licencia) falta.push('Documento: Licencia')
    if (falta.length) { setIntentado(true); setFaltan(falta); return }
    setFaltan([]); setBusy(true)
    try {
      const { data: cert, error } = await supabase.from('certificaciones')
        .insert({ tercero_id: tercero.tercero_id, tipo, estado: 'enviado', origen: 'portal_web', enviado_por: email, service_center: sc })
        .select().single()
      if (error) throw error
      await supabase.from('certificacion_conductor').insert({
        certificacion_id: cert.id, nombre: f.nombre.trim(), curp: f.curp.trim().toUpperCase(),
        rfc: f.rfc.trim().toUpperCase() || null, telefono: f.telefono || null,
        licencia_numero: esConductor ? (f.licencia_numero || null) : null,
        licencia_estado: esConductor ? (f.licencia_estado || null) : null,
        licencia_vigencia: esConductor ? (f.licencia_vigencia || null) : null,
      })
      for (const [t, file] of Object.entries(files)) if (file) await subirDoc(tercero.tercero_id, cert.id, t, file)
      await supabase.from('certificacion_eventos').insert({ certificacion_id: cert.id, estado_nuevo: 'enviado', nota: 'Enviado desde portal web', actor: email })
      setOk(`${TIPO_LABEL[tipo]} enviado a certificar. Te avisaremos cuando esté validado.`)
      setTimeout(onDone, 1400)
    } catch (e) { setErr('No se pudo enviar: ' + (e.message || 'error desconocido')) }
    setBusy(false)
  }

  return (
    <>
      <button className="back-link" onClick={onBack}>← Volver</button>
      <div className="page-head"><div><h2>Certificar {esConductor ? 'conductor' : 'ayudante'}</h2>
        <div className="lede">Datos de la persona que quieres ingresar a la operación.</div></div></div>
      <div className="form-card">
        {faltan.length > 0 && (
          <div className="form-error">
            <b>Faltan datos obligatorios:</b>
            <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>{faltan.map(x => <li key={x}>{x}</li>)}</ul>
          </div>
        )}
        {err && <div className="form-error">{err}</div>}
        {ok && <div className="form-ok">{ok}</div>}

        <div className="section-title" style={{ marginTop: 0, paddingTop: 0, borderTop: 'none' }}>Centro de servicio</div>
        <div className="form-grid"><div className="field"><label>Centro de servicio (SC) *</label><SCSelect value={sc} onChange={setSc} invalid={intentado && !sc} /></div></div>

        <div className="section-title">Datos personales</div>
        <div className="form-grid">
          <div className="field full"><label>Nombre completo *</label><input value={f.nombre} onChange={e => set('nombre', e.target.value)} placeholder="Nombre y apellidos" style={miss(!f.nombre.trim())} /></div>
          <div className="field"><label>CURP *</label><input value={f.curp} onChange={e => set('curp', e.target.value)} placeholder="18 caracteres" maxLength={18} style={miss(!f.curp.trim())} /></div>
          <div className="field"><label>RFC *</label><input value={f.rfc} onChange={e => set('rfc', e.target.value)} placeholder="13 caracteres" maxLength={13} style={miss(!f.rfc.trim())} /></div>
          <div className="field"><label>Teléfono *</label><input value={f.telefono} onChange={e => set('telefono', e.target.value)} placeholder="10 dígitos" style={miss(!f.telefono.trim())} /></div>
        </div>

        {esConductor && (
          <>
            <div className="section-title">Licencia de conducir</div>
            <div className="form-grid">
              <div className="field"><label>Número de licencia *</label><input value={f.licencia_numero} onChange={e => set('licencia_numero', e.target.value)} style={miss(!f.licencia_numero.trim())} /></div>
              <div className="field"><label>Estado emisor *</label>
                <select value={f.licencia_estado} onChange={e => set('licencia_estado', e.target.value)} style={miss(!f.licencia_estado)}>
                  <option value="">Selecciona…</option>{ESTADOS_MX.map(s => <option key={s} value={s}>{s}</option>)}
                </select></div>
              <div className="field"><label>Vigencia *</label><input type="date" value={f.licencia_vigencia} onChange={e => set('licencia_vigencia', e.target.value)} style={miss(!f.licencia_vigencia)} /></div>
            </div>
          </>
        )}

        <div className="section-title">Documentos (obligatorios)</div>
        <div className="form-grid">
          <FileField label="INE — frente" tipoDoc="ine" files={files} setFiles={setFiles} missing={intentado} />
          <FileField label="INE — reverso" tipoDoc="ine_reverso" files={files} setFiles={setFiles} missing={intentado} />
          <FileField label="CURP (PDF)" tipoDoc="curp" files={files} setFiles={setFiles} missing={intentado} />
          {esConductor && <FileField label="Licencia" tipoDoc="licencia" files={files} setFiles={setFiles} missing={intentado} />}
        </div>

        <div className="form-actions">
          <button className="btn btn-ghost" onClick={onBack}>Cancelar</button>
          <button className="btn btn-primary" onClick={enviar} disabled={busy}>{busy ? 'Enviando…' : 'Enviar a certificar'}</button>
        </div>
      </div>
    </>
  )
}

// ── Formulario de vehículo ───────────────────────────────────────────
function FormVehiculo({ tercero, email, onBack, onDone }) {
  const [sc, setSc] = useState('')
  const [f, setF] = useState({ placa: '', vin: '' })
  const [files, setFiles] = useState({})
  const [err, setErr] = useState(''); const [ok, setOk] = useState(''); const [busy, setBusy] = useState(false)
  const [intentado, setIntentado] = useState(false); const [faltan, setFaltan] = useState([])
  const miss = (vacio) => (intentado && vacio ? { borderColor: '#dc2626', background: '#fff5f5' } : undefined)
  const set = (k, v) => setF({ ...f, [k]: v })

  async function enviar() {
    setErr(''); setOk('')
    const falta = []
    if (!sc) falta.push('Centro de servicio (SC)')
    if (!f.placa.trim()) falta.push('Placa')
    if (!files.foto_frente) falta.push('Foto: Frente')
    if (!files.foto_trasera) falta.push('Foto: Trasera')
    if (!files.foto_lado_izq) falta.push('Foto: Lado izquierdo')
    if (!files.foto_lado_der) falta.push('Foto: Lado derecho')
    if (!files.tarjeta_circulacion) falta.push('Documento: Tarjeta de circulación')
    if (falta.length) { setIntentado(true); setFaltan(falta); return }
    setFaltan([]); setBusy(true)
    try {
      const { data: cert, error } = await supabase.from('certificaciones')
        .insert({ tercero_id: tercero.tercero_id, tipo: 'vehiculo', estado: 'enviado', origen: 'portal_web', enviado_por: email, service_center: sc })
        .select().single()
      if (error) throw error
      await supabase.from('certificacion_vehiculo').insert({
        certificacion_id: cert.id, placa: f.placa.trim().toUpperCase().replace(/\s/g, ''), vin: f.vin.trim().toUpperCase() || null,
      })
      for (const [t, file] of Object.entries(files)) if (file) await subirDoc(tercero.tercero_id, cert.id, t, file)
      await supabase.from('certificacion_eventos').insert({ certificacion_id: cert.id, estado_nuevo: 'enviado', nota: 'Enviado desde portal web', actor: email })
      setOk('Vehículo enviado a certificar. Te avisaremos cuando esté validado.')
      setTimeout(onDone, 1400)
    } catch (e) { setErr('No se pudo enviar: ' + (e.message || 'error desconocido')) }
    setBusy(false)
  }

  return (
    <>
      <button className="back-link" onClick={onBack}>← Volver</button>
      <div className="page-head"><div><h2>Certificar vehículo</h2>
        <div className="lede">Datos del vehículo que quieres ingresar a la operación.</div></div></div>
      <div className="form-card">
        {faltan.length > 0 && (
          <div className="form-error">
            <b>Faltan datos obligatorios:</b>
            <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>{faltan.map(x => <li key={x}>{x}</li>)}</ul>
          </div>
        )}
        {err && <div className="form-error">{err}</div>}
        {ok && <div className="form-ok">{ok}</div>}

        <div className="section-title" style={{ marginTop: 0, paddingTop: 0, borderTop: 'none' }}>Centro de servicio</div>
        <div className="form-grid"><div className="field"><label>Centro de servicio (SC) *</label><SCSelect value={sc} onChange={setSc} invalid={intentado && !sc} /></div></div>

        <div className="section-title">Datos del vehículo</div>
        <div className="form-grid">
          <div className="field"><label>Placa *</label><input value={f.placa} onChange={e => set('placa', e.target.value)} placeholder="Ej. ST2965E" style={miss(!f.placa.trim())} /></div>
          <div className="field"><label>VIN / número de serie</label><input value={f.vin} onChange={e => set('vin', e.target.value)} placeholder="Opcional" /></div>
        </div>

        <div className="section-title">Fotos del vehículo (obligatorias)</div>
        <div className="form-grid">
          <FileField label="Frente" tipoDoc="foto_frente" files={files} setFiles={setFiles} missing={intentado} />
          <FileField label="Trasera" tipoDoc="foto_trasera" files={files} setFiles={setFiles} missing={intentado} />
          <FileField label="Lado izquierdo" tipoDoc="foto_lado_izq" files={files} setFiles={setFiles} missing={intentado} />
          <FileField label="Lado derecho" tipoDoc="foto_lado_der" files={files} setFiles={setFiles} missing={intentado} />
        </div>

        <div className="section-title">Documentos (obligatorios)</div>
        <div className="form-grid"><FileField label="Tarjeta de circulación" tipoDoc="tarjeta_circulacion" files={files} setFiles={setFiles} missing={intentado} /></div>

        <div className="form-actions">
          <button className="btn btn-ghost" onClick={onBack}>Cancelar</button>
          <button className="btn btn-primary" onClick={enviar} disabled={busy}>{busy ? 'Enviando…' : 'Enviar a certificar'}</button>
        </div>
      </div>
    </>
  )
}
