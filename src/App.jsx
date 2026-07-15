import React, { useEffect, useState } from 'react'
import { supabase, BUCKET } from './supabaseClient'

// Ambiente del widget de firma MIFIEL. ⚠️ Cambiar a 'production' al salir del sandbox.
const MIFIEL_ENV = 'sandbox'

// Centros de servicio. Por ahora fijos; más adelante se leen de la tabla que administra el Brain.
const SC_LIST = ['AMX7','ECH4','ECH5','EGD0','EGD9','EHM4','EHM5','EHP5','EHP6','ELP2','ELP3','EPB3','EQR2','ERX6','ETA4','ETG4','ETL1','ETL2','EVM2','EVR3','EZL1','SAG1','SBJ1','SCC1','SCD1','SCG1','SCH1','SCJ1','SCM1','SCN1','SCP1','SCQ1','SCT1','SCU1','SCV1','SCX1','SCY1','SDC1','SDG1','SEN1','SGD1','SGD2','SGD3','SGD4','SHM1','SHP1','SHP2','SJA1','SJD1','SLE1','SLP1','SLV1','SLW1','SLZ1','SMA1','SMD1','SML1','SMO1','SMT1','SMT2','SMT3','SMX1','SMX10','SMX2','SMX3','SMX4','SMX5','SMX6','SMX7','SMX8','SMX9','SMZ1','SNG1','SNL1','SOX1','SPB1','SPD1','SPV1','SPY1','SPZ1','SQR1','SQR2','SRX1','SSL1','STA1','STG1','STJ1','STL1','STL2','STN1','STP1','STR1','STT1','STX1','SUR1','SVH1','SVM1','SVR1','SXL1','SZC1','SZL1','SZM1','XSM11']; // 103 centros; luego se leen de la tabla del Brain

const ESTADOS_MX = [
  'AGUASCALIENTES','BAJA CALIFORNIA','BAJA CALIFORNIA SUR','CAMPECHE','CHIAPAS','CHIHUAHUA',
  'CIUDAD DE MEXICO','COAHUILA','COLIMA','DURANGO','ESTADO DE MEXICO','GUANAJUATO','GUERRERO',
  'HIDALGO','JALISCO','MICHOACAN','MORELOS','NAYARIT','NUEVO LEON','OAXACA','PUEBLA','QUERETARO',
  'QUINTANA ROO','SAN LUIS POTOSI','SINALOA','SONORA','TABASCO','TAMAULIPAS','TLAXCALA','VERACRUZ','YUCATAN','ZACATECAS',
]
const ESTADO_LABEL = { enviado:'Enviado', en_validacion:'En validación', validado:'Validado', con_alertas:'Con alertas', rechazado:'Rechazado', certificado:'Certificado' }
// Etapa del proceso (Kanban del Brain) → etiqueta y color para la empresa
const ETAPA_PORTAL = {
  recepcion:           { t: 'Recibido',                 c: '#1a3a6b', bg: '#eef2f7' },
  prevalidacion_biggy: { t: 'En pre-validación',        c: '#F47B20', bg: '#fff4ec' },
  validacion_meli:     { t: 'Validación MELI',          c: '#1a3a6b', bg: '#eef2f7' },
  validacion_nubarium: { t: 'Validación oficial',       c: '#1a3a6b', bg: '#eef2f7' },
  firma_contrato:      { t: 'Firma de contrato',        c: '#7c3aed', bg: '#f5f0fe' },
  aceptado:            { t: 'Certificado ✓',            c: '#166534', bg: '#e8f5ec' },
  rechazado:           { t: 'Rechazado',                c: '#c0392b', bg: '#fbeaea' },
}
const TIPO_LABEL = { conductor:'Conductor', ayudante:'Ayudante', vehiculo:'Vehículo' }

export default function App() {
  const [session, setSession] = useState(null)
  const [view, setView] = useState('home') // home | estado | conductor | ayudante | vehiculo | firma
  const [tercero, setTercero] = useState(undefined) // undefined = cargando · null = sin empresa asociada

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  // Resuelve la empresa del usuario que inició sesión (usuarios_terceros → terceros)
  useEffect(() => {
    if (!session) { setTercero(undefined); return }
    let cancel = false
    ;(async () => {
      const { data } = await supabase
        .from('usuarios_terceros')
        .select('tercero_id, terceros(nombre)')
        .eq('auth_email', session.user.email.toLowerCase())
        .maybeSingle()
      if (cancel) return
      if (!data) { setTercero(null); return }
      const t = Array.isArray(data.terceros) ? data.terceros[0] : data.terceros
      setTercero({ tercero_id: data.tercero_id, nombre: t?.nombre || 'Mi empresa' })
    })()
    return () => { cancel = true }
  }, [session])

  if (!session) return <Login />
  if (tercero === undefined) return <PantallaCentro titulo="Cargando…" texto="Buscando tu empresa." />
  if (tercero === null) return (
    <PantallaCentro titulo="Cuenta sin empresa asociada"
      texto={`El correo ${session.user.email} no está vinculado a ninguna empresa. Escríbenos para activarlo.`}
      accion={<button className="btn btn-ghost" onClick={() => supabase.auth.signOut()}>Salir</button>} />
  )

  const email = session.user.email
  return (
    <Shell tercero={tercero} email={email}>
      {view === 'home' && <Home onPick={setView} />}
      {view === 'estado' && <Estado tercero={tercero} onBack={() => setView('home')} />}
      {view === 'firma' && <Firma tercero={tercero} onBack={() => setView('home')} />}
      {view === 'baja' && <BajaVehiculo tercero={tercero} email={email} onBack={() => setView('home')} />}
      {view === 'consultas' && <Consultas tercero={tercero} onBack={() => setView('home')} />}
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
        <img src="/bt_logo_naranjo.png" alt="Bigticket" style={{ height: 34, width: 'auto', alignSelf: 'flex-start' }} />
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

function PantallaCentro({ titulo, texto, accion }) {
  return (
    <div className="login-form-side" style={{ minHeight: '100vh' }}>
      <div className="login-card" style={{ textAlign: 'center' }}>
        <h2>{titulo}</h2>
        <div className="sub" style={{ marginTop: 8 }}>{texto}</div>
        {accion && <div style={{ marginTop: 14 }}>{accion}</div>}
      </div>
    </div>
  )
}

// ── Shell ────────────────────────────────────────────────────────────
function Shell({ tercero, email, children }) {
  return (
    <>
      <div className="topbar">
        <div className="mark" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src="/bt_logo_naranjo.png" alt="Bigticket" style={{ height: 24, width: 'auto', display: 'block' }} />
          <b style={{ opacity: .9 }}>· Certificación</b>
        </div>
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
        <button className="type-card" onClick={() => onPick('firma')}>
          <div className="ic">✍️</div><h3>Firma de contrato</h3><p>Firma digitalmente los contratos de tu personal certificado.</p></button>
        <button className="type-card" onClick={() => onPick('baja')}>
          <div className="ic">📤</div><h3>Baja de vehículo</h3><p>Solicita dar de baja un vehículo de tu flota operativa.</p></button>
        <button className="type-card" onClick={() => onPick('consultas')}>
          <div className="ic">💬</div><h3>Consultas</h3><p>Escríbenos cualquier duda y te respondemos por aquí.</p></button>
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
        .select('id, tipo, estado, etapa_kanban, enviado_at, service_center, contrato_firmado_at, certificacion_conductor(nombre,curp), certificacion_vehiculo(placa,marca)')
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
                const c = Array.isArray(r.certificacion_conductor) ? r.certificacion_conductor[0] : r.certificacion_conductor
                const v = Array.isArray(r.certificacion_vehiculo) ? r.certificacion_vehiculo[0] : r.certificacion_vehiculo
                const et = ETAPA_PORTAL[r.etapa_kanban]
                return (
                  <tr key={r.id}>
                    <td><span className="tipo-pill">{TIPO_LABEL[r.tipo] || r.tipo}</span></td>
                    <td>{persona ? (c?.nombre || '—') : (v?.marca || 'Vehículo')}</td>
                    <td>{persona ? (c?.curp || '—') : (v?.placa || '—')}</td>
                    <td>{r.service_center || '—'}</td>
                    <td>{et
                      ? <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 20, color: et.c, background: et.bg, border: `1px solid ${et.c}22` }}>{et.t}</span>
                      : <span className={`badge ${r.estado}`}>{ESTADO_LABEL[r.estado] || r.estado}</span>}
                    </td>
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

// ── Firma de contrato (MIFIEL embebido) ─────────────────────────────
function Firma({ tercero, onBack }) {
  const [rows, setRows] = useState(null)
  const [docsGestion, setDocsGestion] = useState(null)
  const [abierto, setAbierto] = useState(null) // id (cert o doc) con el widget abierto

  // Carga el script del widget de MIFIEL una sola vez
  useEffect(() => {
    if (document.querySelector('script[data-mifiel-widget]')) return
    const s = document.createElement('script')
    s.type = 'module'
    s.src = 'https://app.mifiel.com/widget-component/index.js'
    s.setAttribute('data-mifiel-widget', '1')
    document.head.appendChild(s)
  }, [])

  async function cargar() {
    const { data } = await supabase
      .from('certificaciones')
      .select('id, tipo, etapa_kanban, contrato_enviado_at, contrato_firmado_at, mifiel_documento_id, mifiel_widget_conductor, mifiel_firmado_conductor, mifiel_firmado_bigticket, certificacion_conductor(nombre,curp)')
      .eq('tercero_id', tercero.tercero_id)
      .not('mifiel_documento_id', 'is', null)
      .order('contrato_enviado_at', { ascending: false })
    setRows(data || [])
    // Documentos del Gestionador (anexos, bajas, contratos sueltos) enviados desde el Brain
    const { data: dg } = await supabase
      .from('contratos_gestion')
      .select('id, titulo, tipo, descripcion, estado, enviado_at, firmado_at, mifiel_widget_tercero, firmado_tercero, firmado_bigticket')
      .eq('tercero_id', tercero.tercero_id)
      .in('estado', ['enviado', 'firmado'])
      .order('enviado_at', { ascending: false })
    setDocsGestion(dg || [])
  }
  useEffect(() => { cargar() }, [tercero])

  const ChipFirma = ({ label, listo }) => (
    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
      background: listo ? '#e8f5ec' : '#fff', color: listo ? '#166534' : '#7c3aed',
      border: `1px solid ${listo ? '#b7e0c2' : '#ddd0f7'}` }}>
      {listo ? '✓' : '⏳'} {label}
    </span>
  )

  async function firmaExitosa(cert) {
    // Feedback inmediato; la confirmación oficial llega por el webhook de MIFIEL al Brain
    await supabase.from('certificaciones').update({ mifiel_firmado_conductor: true }).eq('id', cert.id)
    setAbierto(null)
    cargar()
  }

  async function firmaGestionExitosa(doc) {
    await supabase.from('contratos_gestion').update({ firmado_tercero: true }).eq('id', doc.id)
    setAbierto(null)
    cargar()
  }

  const TIPO_DOC = { contrato: 'Contrato', anexo: 'Anexo', baja_vehiculo: 'Baja de vehículo', otro: 'Documento' }

  return (
    <>
      <button className="back-link" onClick={onBack}>← Volver</button>
      <div className="page-head"><div><h2>Firma de contrato</h2>
        <div className="lede">Contratos enviados a firma digital. Firma aquí mismo con tu e.firma (SAT), sin salir del portal.</div></div></div>
      <div className="card">
        {rows === null || docsGestion === null ? <div className="loading">Cargando…</div>
        : rows.length === 0 && docsGestion.length === 0 ? (
          <div className="empty"><h3>No tienes documentos por firmar</h3>
            <p>Cuando tu personal esté validado, o Bigticket te envíe un contrato, anexo o baja, aparecerá aquí para firmarlo digitalmente.</p></div>
        ) : (
        <>
        {rows.map(r => {
          const c = Array.isArray(r.certificacion_conductor) ? r.certificacion_conductor[0] : r.certificacion_conductor
          const firmado = !!r.contrato_firmado_at
          const puedeFirmar = !firmado && !r.mifiel_firmado_conductor && r.mifiel_widget_conductor
          return (
            <div key={r.id} style={{ border: '1px solid #e4e7ec', borderRadius: 12, padding: '14px 16px', marginBottom: 12, background: firmado ? '#f6fdf8' : '#fff' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{c?.nombre || 'Sin nombre'}</div>
                  <div style={{ fontSize: 12, color: '#777' }}>{TIPO_LABEL[r.tipo] || r.tipo} · {c?.curp || '—'}
                    {r.contrato_enviado_at ? ` · enviado ${new Date(r.contrato_enviado_at).toLocaleDateString('es-MX')}` : ''}</div>
                </div>
                <ChipFirma label="Tu firma" listo={!!r.mifiel_firmado_conductor || firmado} />
                <ChipFirma label="Bigticket" listo={!!r.mifiel_firmado_bigticket || firmado} />
                {firmado && <span style={{ fontSize: 12, fontWeight: 700, color: '#166534' }}>✅ Contrato firmado</span>}
                {puedeFirmar && (
                  <button className="btn btn-primary" onClick={() => setAbierto(abierto === r.id ? null : r.id)}>
                    {abierto === r.id ? 'Cerrar' : '✍️ Firmar ahora'}
                  </button>
                )}
                {!firmado && r.mifiel_firmado_conductor && !r.mifiel_firmado_bigticket && (
                  <span style={{ fontSize: 12, color: '#7c3aed', fontWeight: 600 }}>Esperando la firma de Bigticket</span>
                )}
              </div>
              {abierto === r.id && puedeFirmar && (
                <div style={{ marginTop: 12, border: '1px solid #ddd0f7', borderRadius: 10, padding: 8, minHeight: 620, background: '#fff' }}>
                  <FirmaWidget widgetId={r.mifiel_widget_conductor} onSuccess={() => firmaExitosa(r)} />
                </div>
              )}
            </div>
          )
        })}

        {docsGestion.length > 0 && (
          <div style={{ fontSize: 12, fontWeight: 700, color: '#1a3a6b', margin: '18px 0 10px', textTransform: 'uppercase', letterSpacing: '.4px' }}>
            📑 Otros documentos (anexos, bajas y más)
          </div>
        )}
        {docsGestion.map(d => {
          const firmado = d.estado === 'firmado'
          const puedeFirmar = !firmado && !d.firmado_tercero && d.mifiel_widget_tercero
          const key = `g-${d.id}`
          return (
            <div key={key} style={{ border: '1px solid #e4e7ec', borderRadius: 12, padding: '14px 16px', marginBottom: 12, background: firmado ? '#f6fdf8' : '#fff' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{d.titulo}</div>
                  <div style={{ fontSize: 12, color: '#777' }}>{TIPO_DOC[d.tipo] || 'Documento'}
                    {d.descripcion ? ` · ${d.descripcion}` : ''}
                    {d.enviado_at ? ` · enviado ${new Date(d.enviado_at).toLocaleDateString('es-MX')}` : ''}</div>
                </div>
                <ChipFirma label="Tu firma" listo={!!d.firmado_tercero || firmado} />
                <ChipFirma label="Bigticket" listo={!!d.firmado_bigticket || firmado} />
                {firmado && <span style={{ fontSize: 12, fontWeight: 700, color: '#166534' }}>✅ Firmado</span>}
                {puedeFirmar && (
                  <button className="btn btn-primary" onClick={() => setAbierto(abierto === key ? null : key)}>
                    {abierto === key ? 'Cerrar' : '✍️ Firmar ahora'}
                  </button>
                )}
                {!firmado && d.firmado_tercero && !d.firmado_bigticket && (
                  <span style={{ fontSize: 12, color: '#7c3aed', fontWeight: 600 }}>Esperando la firma de Bigticket</span>
                )}
              </div>
              {abierto === key && puedeFirmar && (
                <div style={{ marginTop: 12, border: '1px solid #ddd0f7', borderRadius: 10, padding: 8, minHeight: 620, background: '#fff' }}>
                  <FirmaWidget widgetId={d.mifiel_widget_tercero} onSuccess={() => firmaGestionExitosa(d)} />
                </div>
              )}
            </div>
          )
        })}
        </>
        )}
      </div>
    </>
  )
}

function FirmaWidget({ widgetId, onSuccess }) {
  const ref = React.useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ok = () => onSuccess && onSuccess()
    el.addEventListener('signSuccess', ok)
    return () => el.removeEventListener('signSuccess', ok)
  }, [widgetId])
  return <mifiel-widget ref={ref} id={widgetId} environment={MIFIEL_ENV}></mifiel-widget>
}

// ── Consultas (chat con Bigticket) ───────────────────────────────────
function Consultas({ tercero, onBack }) {
  const [msgs, setMsgs] = useState(null)
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function cargar() {
    const { data } = await supabase
      .from('mensajes_terceros')
      .select('*')
      .eq('tercero_id', tercero.tercero_id)
      .order('created_at', { ascending: true })
    setMsgs(data || [])
  }
  useEffect(() => { cargar() }, [tercero])

  async function enviar() {
    const t = texto.trim()
    if (!t || enviando) return
    setEnviando(true)
    setTexto('')
    const { data, error } = await supabase
      .from('mensajes_terceros')
      .insert({ tercero_id: tercero.tercero_id, autor: 'tercero', mensaje: t })
      .select('*').single()
    if (error) { alert('No se pudo enviar: ' + error.message); setTexto(t) }
    else setMsgs(prev => [...(prev || []), data])
    setEnviando(false)
  }

  return (
    <>
      <button className="back-link" onClick={onBack}>← Volver</button>
      <div className="page-head"><div><h2>Consultas</h2>
        <div className="lede">Escríbenos cualquier duda sobre tus certificaciones, pagos o documentos. El equipo de Bigticket te responde por aquí.</div></div></div>
      <div className="card" style={{ display: 'flex', flexDirection: 'column', minHeight: 420 }}>
        <div style={{ flex: 1, overflowY: 'auto', maxHeight: 460, paddingBottom: 8 }}>
          {msgs === null ? <div className="loading">Cargando…</div>
          : msgs.length === 0 ? (
            <div className="empty"><h3>Sin mensajes</h3><p>Escribe tu primera consulta abajo y te responderemos a la brevedad.</p></div>
          ) : msgs.map(m => (
            <div key={m.id} style={{ display: 'flex', justifyContent: m.autor === 'tercero' ? 'flex-end' : 'flex-start', marginBottom: 8 }}>
              <div style={{ maxWidth: '75%', padding: '9px 13px', borderRadius: 12, fontSize: 13, lineHeight: 1.5,
                background: m.autor === 'tercero' ? '#0b2b55' : '#f0f2f5',
                color: m.autor === 'tercero' ? '#fff' : '#222',
                borderBottomRightRadius: m.autor === 'tercero' ? 4 : 12,
                borderBottomLeftRadius: m.autor === 'tercero' ? 12 : 4 }}>
                {m.autor !== 'tercero' && <div style={{ fontSize: 10, fontWeight: 700, color: '#FF6600', marginBottom: 2 }}>Bigticket</div>}
                {m.mensaje}
                <div style={{ fontSize: 9, opacity: .6, marginTop: 4, textAlign: 'right' }}>
                  {new Date(m.created_at).toLocaleString('es-MX', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, paddingTop: 10, borderTop: '1px solid #e4e7ec' }}>
          <input value={texto} onChange={e => setTexto(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar() } }}
            placeholder="Escribe tu consulta…"
            style={{ flex: 1, background: '#f8f9fa', border: '1px solid #d0d5dd', borderRadius: 10, padding: '11px 12px', fontSize: 14 }} />
          <button className="btn btn-primary" onClick={enviar} disabled={!texto.trim() || enviando}>
            {enviando ? 'Enviando…' : 'Enviar'}
          </button>
        </div>
      </div>
    </>
  )
}

// ── Baja de vehículo ─────────────────────────────────────────────────
const ESTADO_BAJA = {
  solicitada: { t: 'Solicitada',  c: '#F47B20', bg: '#fff4ec' },
  en_proceso: { t: 'En proceso',  c: '#1a3a6b', bg: '#eef2f7' },
  completada: { t: 'Completada ✓', c: '#166534', bg: '#e8f5ec' },
  rechazada:  { t: 'Rechazada',   c: '#c0392b', bg: '#fbeaea' },
}

function BajaVehiculo({ tercero, email, onBack }) {
  const [placa, setPlaca] = useState('')
  const [motivo, setMotivo] = useState('')
  const [busy, setBusy] = useState(false)
  const [ok, setOk] = useState('')
  const [err, setErr] = useState('')
  const [intentado, setIntentado] = useState(false)
  const [rows, setRows] = useState(null)

  async function cargar() {
    const { data } = await supabase
      .from('bajas_vehiculos')
      .select('*')
      .eq('tercero_id', tercero.tercero_id)
      .order('created_at', { ascending: false })
    setRows(data || [])
  }
  useEffect(() => { cargar() }, [tercero])

  async function enviar() {
    setErr(''); setOk('')
    if (!placa.trim() || !motivo.trim()) { setIntentado(true); return }
    setBusy(true)
    try {
      const { error } = await supabase.from('bajas_vehiculos')
        .insert({ tercero_id: tercero.tercero_id, placa: placa.trim().toUpperCase(), motivo: motivo.trim(), enviado_por: email })
      if (error) throw new Error(error.message)
      // Aviso automático al equipo por el canal de consultas
      await supabase.from('mensajes_terceros').insert({
        tercero_id: tercero.tercero_id, autor: 'tercero',
        mensaje: `📤 Solicitud de baja de vehículo — Placa ${placa.trim().toUpperCase()}. Motivo: ${motivo.trim()}`,
      })
      setOk('Solicitud enviada. Te contactaremos y, si corresponde, recibirás el documento de baja para firmar en "Firma de contrato".')
      setPlaca(''); setMotivo(''); setIntentado(false)
      cargar()
    } catch (e) { setErr('No se pudo enviar: ' + e.message) }
    finally { setBusy(false) }
  }

  const miss = (vacio) => (intentado && vacio ? { borderColor: '#dc2626', background: '#fff5f5' } : undefined)

  return (
    <>
      <button className="back-link" onClick={onBack}>← Volver</button>
      <div className="page-head"><div><h2>Baja de vehículo</h2>
        <div className="lede">Solicita retirar un vehículo de tu flota operativa. El equipo revisará la solicitud y te enviará el documento de baja para firma digital.</div></div></div>

      <div className="form-card">
        {err && <div className="form-error">{err}</div>}
        {ok && <div className="form-ok">{ok}</div>}
        {intentado && (!placa.trim() || !motivo.trim()) && (
          <div className="form-error"><b>Faltan datos obligatorios:</b> {!placa.trim() ? 'Placa' : ''}{!placa.trim() && !motivo.trim() ? ' y ' : ''}{!motivo.trim() ? 'Motivo' : ''}</div>
        )}
        <div className="form-grid">
          <div className="field"><label>Placa del vehículo *</label>
            <input value={placa} onChange={e => setPlaca(e.target.value)} placeholder="Ej. ST2965E" style={miss(!placa.trim())} /></div>
          <div className="field full"><label>Motivo de la baja *</label>
            <input value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Ej. venta del vehículo, término de vida útil, siniestro…" style={miss(!motivo.trim())} /></div>
        </div>
        <div className="form-actions">
          <button className="btn btn-primary" onClick={enviar} disabled={busy}>{busy ? 'Enviando…' : 'Solicitar baja'}</button>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#1a3a6b', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '.4px' }}>Mis solicitudes</div>
        {rows === null ? <div className="loading">Cargando…</div>
        : rows.length === 0 ? <div style={{ fontSize: 13, color: '#888' }}>Aún no has solicitado ninguna baja.</div>
        : (
          <table>
            <thead><tr><th>Placa</th><th>Motivo</th><th>Estado</th><th>Fecha</th></tr></thead>
            <tbody>
              {rows.map(r => {
                const e = ESTADO_BAJA[r.estado] || ESTADO_BAJA.solicitada
                return (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 600 }}>{r.placa}</td>
                    <td>{r.motivo}</td>
                    <td><span style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 20, color: e.c, background: e.bg, border: `1px solid ${e.c}22` }}>{e.t}</span></td>
                    <td>{new Date(r.created_at).toLocaleDateString('es-MX')}</td>
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
    if (!files.rfc) falta.push('Documento: RFC')
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
          <FileField label="RFC (PDF)" tipoDoc="rfc" files={files} setFiles={setFiles} missing={intentado} />
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
