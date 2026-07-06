import React, { useEffect, useState } from 'react'
import { supabase, BUCKET } from './supabaseClient'

// ── Catálogos ────────────────────────────────────────────────────────
const ESTADOS_MX = [
  'AGUASCALIENTES','BAJA CALIFORNIA','BAJA CALIFORNIA SUR','CAMPECHE','CHIAPAS',
  'CHIHUAHUA','CIUDAD DE MEXICO','COAHUILA','COLIMA','DURANGO','ESTADO DE MEXICO',
  'GUANAJUATO','GUERRERO','HIDALGO','JALISCO','MICHOACAN','MORELOS','NAYARIT',
  'NUEVO LEON','OAXACA','PUEBLA','QUERETARO','QUINTANA ROO','SAN LUIS POTOSI',
  'SINALOA','SONORA','TABASCO','TAMAULIPAS','TLAXCALA','VERACRUZ','YUCATAN','ZACATECAS',
]
const ESTADO_LABEL = {
  enviado: 'Enviado', en_validacion: 'En validación', validado: 'Validado',
  con_alertas: 'Con alertas', rechazado: 'Rechazado', certificado: 'Certificado',
}

// ── App raíz: sesión + resolución del Tercero ────────────────────────
export default function App() {
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState(null)
  const [tercero, setTercero] = useState(null)  // { tercero_id, nombre }
  const [view, setView] = useState('dashboard') // dashboard | nueva

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) { setTercero(null); setLoading(false); return }
    ;(async () => {
      setLoading(true)
      const { data } = await supabase
        .from('tercero_usuarios')
        .select('tercero_id, terceros(nombre)')
        .eq('auth_user_id', session.user.id)
        .maybeSingle()
      if (data) setTercero({ tercero_id: data.tercero_id, nombre: data.terceros?.nombre || 'Mi empresa' })
      else setTercero({ tercero_id: null, nombre: null }) // usuario sin empresa vinculada
      setLoading(false)
    })()
  }, [session])

  if (!session) return <Login />
  if (loading) return <div className="loading">Cargando…</div>
  if (!tercero?.tercero_id) return <SinVinculo email={session.user.email} />

  return (
    <Shell tercero={tercero} email={session.user.email}>
      {view === 'dashboard'
        ? <Dashboard tercero={tercero} onNueva={() => setView('nueva')} />
        : <NuevaCertificacion tercero={tercero} email={session.user.email} onDone={() => setView('dashboard')} />}
    </Shell>
  )
}

// ── Login (correo + clave) ───────────────────────────────────────────
function Login() {
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

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
          <h1>Certifica a tus conductores y vehículos antes de que entren a operar.</h1>
          <p>Portal para empresas transportistas. Envía los datos y nosotros los validamos contra las fuentes oficiales.</p>
        </div>
      </div>
      <div className="login-form-side">
        <div className="login-card">
          <h2>Entrar</h2>
          <div className="sub">Accede con el correo y la contraseña de tu empresa.</div>
          {err && <div className="form-error">{err}</div>}
          <div className="field">
            <label>Correo</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && entrar()} placeholder="empresa@correo.com" />
          </div>
          <div className="field">
            <label>Contraseña</label>
            <input type="password" value={pass} onChange={e => setPass(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && entrar()} placeholder="••••••••" />
          </div>
          <button className="btn btn-primary" style={{ width: '100%' }} onClick={entrar} disabled={busy}>
            {busy ? 'Entrando…' : 'Entrar'}
          </button>
        </div>
      </div>
    </div>
  )
}

function SinVinculo({ email }) {
  return (
    <div className="login-form-side" style={{ minHeight: '100vh' }}>
      <div className="login-card" style={{ textAlign: 'center' }}>
        <h2>Tu cuenta aún no está vinculada</h2>
        <div className="sub" style={{ marginTop: 8 }}>
          El correo <b>{email}</b> no está asociado a ninguna empresa. Contacta a tu enlace en Bigticket para activarlo.
        </div>
        <button className="btn btn-ghost" style={{ marginTop: 16 }} onClick={() => supabase.auth.signOut()}>Salir</button>
      </div>
    </div>
  )
}

// ── Shell (barra superior) ───────────────────────────────────────────
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

// ── Dashboard: lista de certificaciones del Tercero ──────────────────
function Dashboard({ tercero, onNueva }) {
  const [rows, setRows] = useState(null)

  useEffect(() => {
    ;(async () => {
      const { data } = await supabase
        .from('certificaciones')
        .select('id, tipo, estado, enviado_at, certificacion_conductor(nombre,curp), certificacion_vehiculo(placa,marca)')
        .eq('tercero_id', tercero.tercero_id)
        .order('enviado_at', { ascending: false })
      setRows(data || [])
    })()
  }, [tercero])

  return (
    <>
      <div className="page-head">
        <div>
          <h2>Certificaciones</h2>
          <div className="lede">Conductores y vehículos que has enviado a validar.</div>
        </div>
        <button className="btn btn-primary" onClick={onNueva}>+ Nueva certificación</button>
      </div>

      <div className="card">
        {rows === null ? (
          <div className="loading">Cargando…</div>
        ) : rows.length === 0 ? (
          <div className="empty">
            <h3>Aún no has enviado nada a certificar</h3>
            <p>Empieza enviando un conductor o un vehículo para validar sus datos.</p>
          </div>
        ) : (
          <table>
            <thead>
              <tr><th>Tipo</th><th>Quién / qué</th><th>Identificador</th><th>Estado</th><th>Enviado</th></tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const esCond = r.tipo === 'conductor'
                const c = r.certificacion_conductor, v = r.certificacion_vehiculo
                return (
                  <tr key={r.id}>
                    <td><span className="tipo-pill">{esCond ? 'Conductor' : 'Vehículo'}</span></td>
                    <td>{esCond ? (c?.nombre || '—') : (v?.marca || 'Vehículo')}</td>
                    <td>{esCond ? (c?.curp || '—') : (v?.placa || '—')}</td>
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

// ── Nueva certificación: elegir tipo → formulario ────────────────────
function NuevaCertificacion({ tercero, email, onDone }) {
  const [tipo, setTipo] = useState(null) // 'conductor' | 'vehiculo'

  if (!tipo) {
    return (
      <>
        <button className="back-link" onClick={onDone}>← Volver</button>
        <div className="page-head"><div><h2>¿Qué quieres certificar?</h2>
          <div className="lede">Elige el tipo y llena solo los datos de ese caso.</div></div></div>
        <div className="type-grid">
          <button className="type-card" onClick={() => setTipo('conductor')}>
            <div className="ic">🧍</div>
            <h3>Certificar conductor</h3>
            <p>Valida identidad (CURP, RFC, INE) y antecedentes de una persona nueva.</p>
          </button>
          <button className="type-card" onClick={() => setTipo('vehiculo')}>
            <div className="ic">🚚</div>
            <h3>Certificar vehículo</h3>
            <p>Valida la placa contra REPUVE y confirma sus datos oficiales.</p>
          </button>
        </div>
      </>
    )
  }

  return tipo === 'conductor'
    ? <FormConductor tercero={tercero} email={email} onBack={() => setTipo(null)} onDone={onDone} />
    : <FormVehiculo tercero={tercero} email={email} onBack={() => setTipo(null)} onDone={onDone} />
}

// ── Subida de un documento a Storage ─────────────────────────────────
async function subirDoc(terceroId, certId, tipoDoc, file) {
  const ext = file.name.split('.').pop()
  const path = `${terceroId}/${certId}/${tipoDoc}.${ext}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true })
  if (error) throw error
  await supabase.from('certificacion_documentos').insert({
    certificacion_id: certId, tipo_documento: tipoDoc, storage_path: path,
  })
}

function FileField({ label, tipoDoc, files, setFiles }) {
  const has = !!files[tipoDoc]
  return (
    <div className={`file-row ${has ? 'done' : ''}`}>
      <label>{label}{has && ' ✓'}</label>
      <label className="file-btn">
        {has ? 'Cambiar' : 'Subir archivo'}
        <input type="file" accept="image/*,application/pdf"
          onChange={e => setFiles({ ...files, [tipoDoc]: e.target.files[0] })} />
      </label>
    </div>
  )
}

function FormConductor({ tercero, email, onBack, onDone }) {
  const [f, setF] = useState({ nombre: '', curp: '', rfc: '', telefono: '', email: '',
    licencia_numero: '', licencia_estado: '', licencia_vigencia: '' })
  const [files, setFiles] = useState({})
  const [err, setErr] = useState(''); const [ok, setOk] = useState(''); const [busy, setBusy] = useState(false)
  const set = (k, v) => setF({ ...f, [k]: v })

  async function enviar() {
    setErr(''); setOk('')
    if (!f.nombre.trim() || !f.curp.trim()) { setErr('Nombre y CURP son obligatorios.'); return }
    setBusy(true)
    try {
      const { data: cert, error } = await supabase.from('certificaciones')
        .insert({ tercero_id: tercero.tercero_id, tipo: 'conductor', estado: 'enviado', origen: 'portal_web', enviado_por: email })
        .select().single()
      if (error) throw error
      await supabase.from('certificacion_conductor').insert({
        certificacion_id: cert.id, nombre: f.nombre.trim(), curp: f.curp.trim().toUpperCase(),
        rfc: f.rfc.trim().toUpperCase() || null, telefono: f.telefono || null, email: f.email || null,
        licencia_numero: f.licencia_numero || null, licencia_estado: f.licencia_estado || null,
        licencia_vigencia: f.licencia_vigencia || null,
      })
      for (const [tipoDoc, file] of Object.entries(files)) if (file) await subirDoc(tercero.tercero_id, cert.id, tipoDoc, file)
      await supabase.from('certificacion_eventos').insert({ certificacion_id: cert.id, estado_nuevo: 'enviado', nota: 'Enviado desde portal web', actor: email })
      setOk('Conductor enviado a certificar. Te avisaremos cuando esté validado.')
      setTimeout(onDone, 1400)
    } catch (e) { setErr('No se pudo enviar: ' + (e.message || 'error desconocido')) }
    setBusy(false)
  }

  return (
    <>
      <button className="back-link" onClick={onBack}>← Cambiar tipo</button>
      <div className="page-head"><div><h2>Certificar conductor</h2>
        <div className="lede">Datos de la persona que quieres ingresar a la operación.</div></div></div>
      <div className="form-card">
        {err && <div className="form-error">{err}</div>}
        {ok && <div className="form-ok">{ok}</div>}

        <div className="section-title">Datos personales</div>
        <div className="form-grid">
          <div className="field full"><label>Nombre completo *</label>
            <input value={f.nombre} onChange={e => set('nombre', e.target.value)} placeholder="Nombre y apellidos" /></div>
          <div className="field"><label>CURP *</label>
            <input value={f.curp} onChange={e => set('curp', e.target.value)} placeholder="18 caracteres" maxLength={18} /></div>
          <div className="field"><label>RFC</label>
            <input value={f.rfc} onChange={e => set('rfc', e.target.value)} placeholder="Opcional" maxLength={13} /></div>
          <div className="field"><label>Teléfono</label>
            <input value={f.telefono} onChange={e => set('telefono', e.target.value)} placeholder="10 dígitos" /></div>
          <div className="field"><label>Correo</label>
            <input value={f.email} onChange={e => set('email', e.target.value)} placeholder="Opcional" /></div>
        </div>

        <div className="section-title">Licencia de conducir</div>
        <div className="form-grid">
          <div className="field"><label>Número de licencia</label>
            <input value={f.licencia_numero} onChange={e => set('licencia_numero', e.target.value)} /></div>
          <div className="field"><label>Estado emisor</label>
            <select value={f.licencia_estado} onChange={e => set('licencia_estado', e.target.value)}>
              <option value="">Selecciona…</option>
              {ESTADOS_MX.map(s => <option key={s} value={s}>{s}</option>)}
            </select></div>
          <div className="field"><label>Vigencia</label>
            <input type="date" value={f.licencia_vigencia} onChange={e => set('licencia_vigencia', e.target.value)} /></div>
        </div>

        <div className="section-title">Documentos</div>
        <div className="form-grid">
          <FileField label="INE — frente" tipoDoc="ine" files={files} setFiles={setFiles} />
          <FileField label="INE — reverso" tipoDoc="ine_reverso" files={files} setFiles={setFiles} />
          <FileField label="CURP (PDF)" tipoDoc="curp" files={files} setFiles={setFiles} />
          <FileField label="Licencia" tipoDoc="licencia" files={files} setFiles={setFiles} />
        </div>

        <div className="form-actions">
          <button className="btn btn-ghost" onClick={onBack}>Cancelar</button>
          <button className="btn btn-primary" onClick={enviar} disabled={busy}>{busy ? 'Enviando…' : 'Enviar a certificar'}</button>
        </div>
      </div>
    </>
  )
}

function FormVehiculo({ tercero, email, onBack, onDone }) {
  const [f, setF] = useState({ placa: '', vin: '' })
  const [files, setFiles] = useState({})
  const [err, setErr] = useState(''); const [ok, setOk] = useState(''); const [busy, setBusy] = useState(false)
  const set = (k, v) => setF({ ...f, [k]: v })

  async function enviar() {
    setErr(''); setOk('')
    if (!f.placa.trim()) { setErr('La placa es obligatoria.'); return }
    setBusy(true)
    try {
      const { data: cert, error } = await supabase.from('certificaciones')
        .insert({ tercero_id: tercero.tercero_id, tipo: 'vehiculo', estado: 'enviado', origen: 'portal_web', enviado_por: email })
        .select().single()
      if (error) throw error
      await supabase.from('certificacion_vehiculo').insert({
        certificacion_id: cert.id, placa: f.placa.trim().toUpperCase().replace(/\s/g, ''), vin: f.vin.trim().toUpperCase() || null,
      })
      for (const [tipoDoc, file] of Object.entries(files)) if (file) await subirDoc(tercero.tercero_id, cert.id, tipoDoc, file)
      await supabase.from('certificacion_eventos').insert({ certificacion_id: cert.id, estado_nuevo: 'enviado', nota: 'Enviado desde portal web', actor: email })
      setOk('Vehículo enviado a certificar. Te avisaremos cuando esté validado.')
      setTimeout(onDone, 1400)
    } catch (e) { setErr('No se pudo enviar: ' + (e.message || 'error desconocido')) }
    setBusy(false)
  }

  return (
    <>
      <button className="back-link" onClick={onBack}>← Cambiar tipo</button>
      <div className="page-head"><div><h2>Certificar vehículo</h2>
        <div className="lede">Datos del vehículo que quieres ingresar a la operación.</div></div></div>
      <div className="form-card">
        {err && <div className="form-error">{err}</div>}
        {ok && <div className="form-ok">{ok}</div>}

        <div className="section-title">Datos del vehículo</div>
        <div className="form-grid">
          <div className="field"><label>Placa *</label>
            <input value={f.placa} onChange={e => set('placa', e.target.value)} placeholder="Ej. ST2965E" /></div>
          <div className="field"><label>VIN / número de serie</label>
            <input value={f.vin} onChange={e => set('vin', e.target.value)} placeholder="Opcional" /></div>
        </div>

        <div className="section-title">Documentos</div>
        <div className="form-grid">
          <FileField label="Tarjeta de circulación" tipoDoc="tarjeta_circulacion" files={files} setFiles={setFiles} />
        </div>

        <div className="form-actions">
          <button className="btn btn-ghost" onClick={onBack}>Cancelar</button>
          <button className="btn btn-primary" onClick={enviar} disabled={busy}>{busy ? 'Enviando…' : 'Enviar a certificar'}</button>
        </div>
      </div>
    </>
  )
}
