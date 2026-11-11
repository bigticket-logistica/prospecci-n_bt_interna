// ═══════════════════════════════════════════════════════════════════════════
// PortalChile.jsx — Portal Transportista para los terceros de Chile.
// Entra con RUT + clave (supabaseChile.js). Misma visual del portal de México:
// cabecera azul, franja con país y hora, menú lateral y contenido al centro.
// Por ahora: Inicio, Mi flota y Cuidado de Activo (Auditorías e Interrupciones
// de ruta, que se suman en el paso siguiente). Pagos y facturas de Chile
// llegan cuando exista el motor de pagos.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useState } from 'react'
import { supabaseCL } from './supabaseChile'
import Auditorias from './Auditorias'
import Interrupciones from './Interrupciones'

const LOGO = '/logo-bigticket-blanco.png'
// El dueño (RUT de la empresa) ve todo; el delegado (RUT personal), solo
// Cuidado de Activo: Auditorías e Interrupciones de ruta.
const MENU = [
  { k: 'inicio', t: 'Inicio', d: 'Tu empresa en Bigticket', solo: 'dueno' },
  { k: 'flota', t: 'Mi flota', d: 'Tus vehículos certificados', solo: 'dueno' },
  { k: 'auditorias', t: 'Auditorías', d: 'Vehículo (días 1 a 5) y limpieza (lunes)', grupo: 'Cuidado de Activo' },
  { k: 'interrupciones', t: 'Interrupciones de ruta', d: 'Colación, baño, carga eléctrica', grupo: 'Cuidado de Activo' },
  { k: 'equipo', t: 'Mi equipo', d: 'Personas que pueden usar el portal', grupo: 'Administración', solo: 'dueno' },
]

function hora() {
  const d = new Date()
  const f = new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'America/Santiago' }).format(d).replace(/\./g, '')
  const h = new Intl.DateTimeFormat('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Santiago' }).format(d)
  return `${f.replace(/ /g, '-')}, ${h} hrs`
}

export default function PortalChile() {
  const [yo, setYo] = useState(undefined)        // undefined = cargando · null = sin acceso
  const [vista, setVista] = useState('inicio')
  const [menu, setMenu] = useState(false)
  const [panel, setPanel] = useState(false)
  const [reloj, setReloj] = useState(hora())
  useEffect(() => { const t = setInterval(() => setReloj(hora()), 30000); return () => clearInterval(t) }, [])
  useEffect(() => {
    supabaseCL.rpc('fn_portal_cl_yo').then(({ data, error }) => {
      const r = error ? null : data || null
      setYo(r)
      if (r && r.rol === 'delegado') setVista('auditorias')
    })
  }, [])
  const salir = async () => { await supabaseCL.auth.signOut(); window.location.reload() }
  const ir = (k) => { setVista(k); setMenu(false); window.scrollTo(0, 0) }

  if (yo === undefined) return <div className="pc-cargando"><style>{CSS}</style>Cargando tu portal…</div>
  if (yo === null) return (
    <div className="pc-cargando"><style>{CSS}</style>
      <div><b>Tu acceso no está activo.</b><br />Pide a tu supervisor de Bigticket que lo revise.<br /><br />
        <button className="pc-btn" onClick={salir}>Volver al ingreso</button></div>
    </div>
  )

  let grupoAnterior = null
  const dueno = yo.rol !== 'delegado'
  const menuVisible = MENU.filter((m) => !m.solo || (m.solo === 'dueno' && dueno))
  return (
    <div className="pc-shell">
      <style>{CSS}</style>
      <header className="pc-header">
        <div className="pc-marca">
          <button className="pc-hamb" aria-label="Abrir menú" onClick={() => setMenu(true)}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
          </button>
          <img src={LOGO} alt="Bigticket" className="pc-logo" />
          <span className="pc-sep" /><span className="pc-rotulo">Portal Transportista</span>
        </div>
        <div className="pc-pos">
          <button className="pc-empresa" onClick={() => setPanel(!panel)}>
            <span>{dueno ? yo.empresa : `${yo.contacto} · ${yo.empresa}`}</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.7)" strokeWidth="2"><path d="m6 9 6 6 6-6" /></svg>
          </button>
          {panel && (<>
            <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setPanel(false)} />
            <div className="pc-desp">
              <div className="pc-desp-item"><span className="t">{dueno ? yo.empresa : yo.contacto}</span><span className="d">{dueno ? `RUT ${yo.rut} · administrador` : `RUT ${yo.rut_persona} · ${yo.empresa}`}</span></div>
              <button className="pc-desp-item" onClick={salir}><span className="t">Cerrar sesión</span></button>
            </div>
          </>)}
        </div>
      </header>
      <div className="pc-franja"><span>Chile</span><span>·</span><span>{reloj}</span></div>
      <div className="pc-cuerpo">
        {menu && <div className="pc-velo" onClick={() => setMenu(false)} />}
        <aside className={`pc-lateral${menu ? ' abierto' : ''}`}>
          <nav>
            {menuVisible.map((m) => {
              const cabecera = m.grupo && m.grupo !== grupoAnterior ? m.grupo : null
              grupoAnterior = m.grupo || null
              return (
                <div key={m.k}>
                  {cabecera && <div className="pc-grupo">{cabecera}</div>}
                  <button className={`pc-item${vista === m.k ? ' on' : ''}`} onClick={() => ir(m.k)}>
                    <span className="t">{m.t}</span><span className="d">{m.d}</span>
                  </button>
                </div>
              )
            })}
          </nav>
        </aside>
        <main className="pc-main">
          {vista === 'inicio' && dueno && <Inicio yo={yo} onIr={ir} />}
          {vista === 'flota' && dueno && <MiFlota />}
          {vista === 'equipo' && dueno && <MiEquipo />}
          {vista === 'auditorias' && <Auditorias yo={yo} />}
          {vista === 'interrupciones' && <Interrupciones />}
        </main>
      </div>
    </div>
  )
}

function Inicio({ yo, onIr }) {
  return (
    <div>
      <h1 className="pc-h1">Hola{yo.contacto ? `, ${String(yo.contacto).split(' ')[0]}` : ''} 👋</h1>
      <div className="pc-sub">Este es el portal de {yo.empresa} en Bigticket.</div>
      <div className="pc-card">
        <div className="pc-fila"><span>Empresa</span><b>{yo.empresa}</b></div>
        <div className="pc-fila"><span>RUT</span><b>{yo.rut}</b></div>
        <div className="pc-fila"><span>Operación</span><b>{(yo.cecos || []).join(', ') || '—'}</b></div>
        <div className="pc-fila"><span>Contacto</span><b>{yo.contacto || '—'}{yo.telefono ? ` · ${yo.telefono}` : ''}</b></div>
        <div className="pc-fila"><span>Correo</span><b>{(yo.correos || []).join(', ') || '—'}</b></div>
      </div>
      <div className="pc-accesos">
        <button className="pc-acceso" onClick={() => onIr('flota')}><b>Mi flota</b><span>Tus vehículos certificados</span></button>
        <button className="pc-acceso" onClick={() => onIr('auditorias')}><b>Auditorías</b><span>Vehículo y limpieza</span></button>
        <button className="pc-acceso" onClick={() => onIr('interrupciones')}><b>Interrupciones de ruta</b><span>Colación, baño, carga</span></button>
      </div>
    </div>
  )
}

function MiFlota() {
  const [filas, setFilas] = useState(null)
  useEffect(() => { supabaseCL.rpc('fn_portal_cl_mi_flota').then(({ data }) => setFilas(data || [])) }, [])
  return (
    <div>
      <h1 className="pc-h1">Mi flota</h1>
      <div className="pc-sub">Tus vehículos según el maestro de certificación de Bigticket.</div>
      {filas === null ? <div className="pc-card">Cargando…</div> : filas.length === 0 ? <div className="pc-card">No hay vehículos registrados para tu empresa.</div> : (
        <div className="pc-card" style={{ padding: 0, overflowX: 'auto' }}>
          <table className="pc-tabla">
            <thead><tr><th>Patente</th><th>Vehículo</th><th>Energía</th><th>Operación</th><th>Estado</th></tr></thead>
            <tbody>{filas.map((v) => (
              <tr key={v.patente}>
                <td><b>{v.patente}</b></td>
                <td>{[v.marca, v.modelo, v.anio].filter(Boolean).join(' ')}{v.tipo_vehiculo ? <div className="pc-mini">{v.tipo_vehiculo}</div> : null}</td>
                <td>{v.energia || '—'}</td>
                <td>{v.ceco || '—'}</td>
                <td><span className={`pc-chip ${v.estado === 'ACTIVA' ? 'ok' : ''}`}>{v.estado === 'ACTIVA' ? 'Activo' : 'Inactivo'}</span></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Mi equipo (solo el dueño) ──────────────────────────────────────────────
function MiEquipo() {
  const [lista, setLista] = useState(null)
  const [flota, setFlota] = useState([])
  const [form, setForm] = useState(null)        // null = cerrado · { rut, nombre, telefono, patentes, editando }
  const [res, setRes] = useState(null)          // { rut, nombre, clave }
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const cargar = async () => {
    const [a, b] = await Promise.all([supabaseCL.rpc('fn_portal_cl_equipo'), supabaseCL.rpc('fn_portal_cl_mi_flota')])
    setLista(a.data || []); setFlota((b.data || []).filter((v) => v.estado === 'ACTIVA'))
  }
  useEffect(() => { cargar() }, [])
  const guardar = async (datos) => {
    setErr(''); setBusy(true)
    const { data, error } = await supabaseCL.rpc('fn_portal_cl_equipo_guardar', { p_rut: datos.rut, p_nombre: datos.nombre, p_telefono: datos.telefono || null, p_patentes: datos.patentes || [] })
    setBusy(false)
    if (error) { setErr(error.message); return }
    setRes(data); setForm(null); cargar()
  }
  const activar = async (d, activo) => {
    if (!activo && !window.confirm(`¿Bloquear a ${d.nombre}? No podrá entrar al portal hasta que lo reactives.`)) return
    const { error } = await supabaseCL.rpc('fn_portal_cl_equipo_activo', { p_rut: d.rut, p_activo: activo })
    if (error) setErr(error.message); else cargar()
  }
  const textoClave = res ? `Portal Transportista Bigticket\nhttps://app.fleetbiggy.com\nElige Chile e ingresa con:\nRUT: ${res.rut}\nClave: ${res.clave}` : ''
  return (
    <div>
      <h1 className="pc-h1">Mi equipo</h1>
      <div className="pc-sub">Personas que pueden entrar al portal con su RUT para hacer las <b>auditorías</b> y avisar las <b>interrupciones de ruta</b>. No ven nada más de tu empresa.</div>
      {res && (
        <div className="pc-card" style={{ borderColor: '#1A7A3C', background: '#F1F8F3' }}>
          <div style={{ fontWeight: 700, color: '#1A7A3C' }}>Acceso listo para {res.nombre}</div>
          <div style={{ marginTop: 8 }}>RUT: <b>{res.rut}</b> · Clave: <b style={{ fontFamily: 'monospace', fontSize: 18 }}>{res.clave}</b></div>
          <div className="pc-mini" style={{ marginTop: 4 }}>Pásasela ahora: esta clave no se vuelve a mostrar.</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            <button className="pc-btn" onClick={() => navigator.clipboard?.writeText(textoClave)}>Copiar</button>
            <a className="pc-btn" style={{ background: '#25D366', textDecoration: 'none' }} href={`https://wa.me/?text=${encodeURIComponent(textoClave)}`} target="_blank" rel="noreferrer">Enviar por WhatsApp</a>
            <button className="pc-btn" style={{ background: '#fff', color: '#002E5D', border: '1px solid #E4E3E3' }} onClick={() => setRes(null)}>Listo</button>
          </div>
        </div>
      )}
      {err && <div className="pc-card" style={{ background: '#FBE3E0', color: '#C43D2F', borderColor: '#F3C4BE' }}>{err}</div>}
      {form ? <FormPersona inicial={form} flota={flota} busy={busy} onGuardar={guardar} onCancelar={() => { setForm(null); setErr('') }} />
        : <button className="pc-btn" style={{ marginBottom: 16 }} onClick={() => { setRes(null); setForm({ rut: '', nombre: '', telefono: '', patentes: [] }) }}>+ Agregar persona</button>}
      {lista === null ? <div className="pc-card">Cargando…</div> : lista.length === 0 ? <div className="pc-card">Todavía no agregas a nadie. Si tú mismo haces las auditorías, no necesitas agregar a nadie.</div> : (
        <div className="pc-card" style={{ padding: 0, overflowX: 'auto' }}>
          <table className="pc-tabla">
            <thead><tr><th>Persona</th><th>Patentes</th><th>Último ingreso</th><th></th></tr></thead>
            <tbody>{lista.map((d) => (
              <tr key={d.rut} style={{ opacity: d.activo ? 1 : 0.55 }}>
                <td><b>{d.nombre}</b><div className="pc-mini">RUT {d.rut}{d.telefono ? ` · ${d.telefono}` : ''}</div></td>
                <td>{(d.patentes || []).length ? d.patentes.join(', ') : <span className="pc-mini">Todas</span>}</td>
                <td className="pc-mini">{d.ultimo_ingreso_at ? new Date(d.ultimo_ingreso_at).toLocaleString('es-CL', { timeZone: 'America/Santiago', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'Nunca'}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  {d.activo ? <>
                    <button className="pc-btn-sec" onClick={() => { setRes(null); setForm({ ...d, editando: true }) }}>Editar</button>
                    <button className="pc-btn-sec" onClick={() => { if (window.confirm(`¿Darle una clave nueva a ${d.nombre}? La anterior deja de funcionar.`)) guardar(d) }}>Clave nueva</button>
                    <button className="pc-btn-sec" style={{ color: '#C43D2F' }} onClick={() => activar(d, false)}>Bloquear</button>
                  </> : <button className="pc-btn-sec" onClick={() => activar(d, true)}>Reactivar</button>}
                </td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function FormPersona({ inicial, flota, busy, onGuardar, onCancelar }) {
  const [d, setD] = useState({ ...inicial, patentes: inicial.patentes || [] })
  const marcar = (p) => setD({ ...d, patentes: d.patentes.includes(p) ? d.patentes.filter((x) => x !== p) : [...d.patentes, p] })
  return (
    <div className="pc-card">
      <div style={{ fontFamily: 'Poppins,sans-serif', fontWeight: 700, color: '#002E5D', marginBottom: 10 }}>{d.editando ? `Editar a ${inicial.nombre}` : 'Agregar persona'}</div>
      <div className="pc-form">
        <label>Nombre completo<input value={d.nombre} onChange={(e) => setD({ ...d, nombre: e.target.value })} placeholder="Juan Pérez" /></label>
        <label>RUT personal<input value={d.rut} disabled={d.editando} onChange={(e) => setD({ ...d, rut: e.target.value })} placeholder="12.345.678-9" /></label>
        <label>Teléfono (opcional)<input value={d.telefono || ''} onChange={(e) => setD({ ...d, telefono: e.target.value })} placeholder="+56 9 1234 5678" /></label>
      </div>
      <div style={{ marginTop: 12, fontSize: 13, color: '#545454' }}>Patentes que puede usar <span className="pc-mini">(si no marcas ninguna, puede usar todas)</span></div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
        {flota.map((v) => (
          <button key={v.patente} type="button" className={`pc-pat${d.patentes.includes(v.patente) ? ' on' : ''}`} onClick={() => marcar(v.patente)}>{v.patente}</button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <button className="pc-btn" disabled={busy} onClick={() => onGuardar(d)}>{busy ? 'Guardando…' : d.editando ? 'Guardar y dar clave nueva' : 'Agregar y crear clave'}</button>
        <button className="pc-btn" style={{ background: '#fff', color: '#002E5D', border: '1px solid #E4E3E3' }} onClick={onCancelar}>Cancelar</button>
      </div>
    </div>
  )
}

function Pronto({ titulo, texto }) {
  return (
    <div>
      <h1 className="pc-h1">{titulo}</h1>
      <div className="pc-card"><div style={{ color: '#545454' }}>{texto}</div><div style={{ marginTop: 10, fontWeight: 700, color: '#FF6600' }}>Próximamente</div></div>
    </div>
  )
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&family=Open+Sans:wght@400;600;700&display=swap');
.pc-shell { --navy:#002E5D; --orange:#FF6600; --page:#F4F3F3; --line:#E4E3E3; --muted:#545454; min-height:100vh; background:var(--page); font-family:"Open Sans",system-ui,sans-serif; color:#000; }
.pc-shell button { font-family:inherit; }
.pc-cargando { min-height:100vh; display:flex; align-items:center; justify-content:center; text-align:center; font-family:"Open Sans",sans-serif; color:#002E5D; background:#F4F3F3; padding:20px; }
.pc-btn { background:#002E5D; color:#fff; border:none; border-radius:999px; padding:10px 22px; font-weight:700; cursor:pointer; }
.pc-header { background:var(--navy); height:64px; display:flex; align-items:center; justify-content:space-between; padding:0 28px; gap:20px; position:sticky; top:0; z-index:30; }
.pc-marca { display:flex; align-items:center; gap:16px; min-width:0; }
.pc-logo { height:20px; display:block; }
.pc-sep { width:1px; height:20px; background:rgba(255,255,255,.22); }
.pc-rotulo { font-family:Poppins,sans-serif; font-weight:600; font-size:13px; letter-spacing:.08em; text-transform:uppercase; color:#F4F3F3; white-space:nowrap; }
.pc-hamb { display:none; background:none; border:none; padding:4px; cursor:pointer; }
.pc-pos { position:relative; }
.pc-empresa { display:flex; align-items:center; gap:10px; background:rgba(255,255,255,.08); border:1px solid rgba(255,255,255,.15); border-radius:999px; padding:6px 14px; cursor:pointer; }
.pc-empresa span { font-family:Poppins,sans-serif; font-weight:600; font-size:13.5px; color:#fff; white-space:nowrap; max-width:280px; overflow:hidden; text-overflow:ellipsis; }
.pc-desp { position:absolute; right:0; top:calc(100% + 10px); z-index:41; width:260px; background:#fff; border:1px solid var(--line); border-radius:12px; overflow:hidden; box-shadow:0 10px 28px rgba(0,46,93,.14); }
.pc-desp-item { display:block; width:100%; text-align:left; background:#fff; border:none; border-bottom:1px solid #EFEDED; padding:11px 16px; cursor:pointer; }
.pc-desp-item:last-child { border-bottom:none; }
.pc-desp-item .t { display:block; font-family:Poppins,sans-serif; font-weight:700; font-size:13px; color:var(--navy); }
.pc-desp-item .d { display:block; font-size:12px; color:var(--muted); margin-top:2px; }
.pc-franja { display:flex; justify-content:flex-end; gap:8px; padding:8px 28px; border-bottom:1px solid var(--line); background:#fff; font-size:12px; color:#4A5058; position:sticky; top:64px; z-index:19; }
.pc-cuerpo { display:flex; align-items:flex-start; }
.pc-lateral { width:268px; flex-shrink:0; position:sticky; top:97px; height:calc(100vh - 97px); overflow-y:auto; background:#fff; border-right:1px solid var(--line); padding:20px 14px 40px; }
.pc-grupo { font-family:Poppins,sans-serif; font-weight:700; font-size:11px; letter-spacing:.08em; text-transform:uppercase; color:#8B8B8B; margin:16px 14px 6px; }
.pc-item { width:100%; border:none; background:transparent; border-radius:10px; padding:11px 14px; text-align:left; cursor:pointer; display:flex; flex-direction:column; margin-bottom:2px; }
.pc-item .t { font-weight:600; font-size:14.5px; color:#8B8B8B; }
.pc-item .d { font-size:11.5px; color:var(--muted); margin-top:2px; }
.pc-item:hover { background:#F4F3F3; }
.pc-item.on { background:rgba(0,46,93,.06); box-shadow:inset 3px 0 0 var(--orange); }
.pc-item.on .t { color:var(--navy); font-weight:700; }
.pc-velo { display:none; }
.pc-main { flex:1; min-width:0; max-width:1100px; margin:0 auto; padding:32px 28px 80px; }
.pc-h1 { font-family:Poppins,sans-serif; font-weight:700; font-size:28px; color:var(--navy); margin:0; }
.pc-sub { color:var(--muted); margin:6px 0 20px; font-size:14.5px; }
.pc-card { background:#fff; border:1px solid var(--line); border-radius:16px; padding:20px 22px; margin-bottom:16px; }
.pc-fila { display:flex; justify-content:space-between; gap:16px; padding:9px 0; border-bottom:1px solid #F0EFEF; font-size:14px; }
.pc-fila:last-child { border-bottom:none; }
.pc-fila span { color:var(--muted); }
.pc-fila b { color:var(--navy); text-align:right; }
.pc-accesos { display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:12px; }
.pc-acceso { background:#fff; border:1px solid var(--line); border-radius:14px; padding:16px 18px; text-align:left; cursor:pointer; display:flex; flex-direction:column; gap:4px; }
.pc-acceso:hover { border-color:var(--orange); }
.pc-acceso b { font-family:Poppins,sans-serif; color:var(--navy); font-size:15px; }
.pc-acceso span { color:var(--muted); font-size:12.5px; }
.pc-tabla { width:100%; border-collapse:collapse; font-size:13.5px; }
.pc-tabla th { text-align:left; background:#F4F3F3; color:var(--muted); font-size:12px; padding:10px 14px; font-weight:700; }
.pc-tabla td { padding:10px 14px; border-top:1px solid #F0EFEF; color:#1f2937; }
.pc-tabla td b { color:var(--navy); }
.pc-mini { font-size:11.5px; color:var(--muted); }
.pc-chip { font-size:11.5px; font-weight:700; border-radius:999px; padding:3px 10px; background:#EFEDED; color:var(--muted); }
.pc-chip.ok { background:#E8F4EC; color:#1A7A3C; }
.pc-btn-sec { background:#fff; color:#002E5D; border:1px solid #E4E3E3; border-radius:999px; padding:6px 12px; font-size:12.5px; font-weight:700; cursor:pointer; margin-left:6px; }
.pc-form { display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:12px; }
.pc-form label { display:flex; flex-direction:column; gap:4px; font-size:12.5px; color:#545454; }
.pc-form input { border:1px solid #E4E3E3; border-radius:10px; padding:10px 12px; font-size:14px; font-family:inherit; }
.pc-form input:disabled { background:#F4F3F3; }
.pc-pat { border:1px solid #E4E3E3; background:#fff; border-radius:999px; padding:6px 12px; font-size:12.5px; font-weight:700; color:#545454; cursor:pointer; }
.pc-pat.on { background:#002E5D; border-color:#002E5D; color:#fff; }
a.pc-btn { display:inline-block; }
@media (max-width: 860px) {
  .pc-header { padding:0 16px; }
  .pc-hamb { display:flex; }
  .pc-rotulo, .pc-sep { display:none; }
  .pc-empresa span { max-width:150px; }
  .pc-cuerpo { display:block; }
  .pc-lateral { position:fixed; top:95px; left:0; bottom:0; height:auto; z-index:25; transform:translateX(-100%); transition:transform .2s ease; }
  .pc-lateral.abierto { transform:none; box-shadow:0 10px 28px rgba(0,46,93,.2); }
  .pc-velo { display:block; position:fixed; inset:95px 0 0 0; background:rgba(0,46,93,.35); z-index:24; }
  .pc-main { padding:20px 16px 96px; }
  .pc-h1 { font-size:24px; }
}
`;
