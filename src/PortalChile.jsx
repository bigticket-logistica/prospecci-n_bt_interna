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

const LOGO = '/logo-bigticket-blanco.png'
const MENU = [
  { k: 'inicio', t: 'Inicio', d: 'Tu empresa en Bigticket' },
  { k: 'flota', t: 'Mi flota', d: 'Tus vehículos certificados' },
  { k: 'auditorias', t: 'Auditorías', d: 'Vehículo (días 1 a 5) y limpieza (lunes)', grupo: 'Cuidado de Activo' },
  { k: 'interrupciones', t: 'Interrupciones de ruta', d: 'Colación, baño, carga eléctrica', grupo: 'Cuidado de Activo' },
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
    supabaseCL.rpc('fn_portal_cl_yo').then(({ data, error }) => setYo(error ? null : data || null))
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
            <span>{yo.empresa}</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.7)" strokeWidth="2"><path d="m6 9 6 6 6-6" /></svg>
          </button>
          {panel && (<>
            <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setPanel(false)} />
            <div className="pc-desp">
              <div className="pc-desp-item"><span className="t">{yo.empresa}</span><span className="d">RUT {yo.rut}</span></div>
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
            {MENU.map((m) => {
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
          {vista === 'inicio' && <Inicio yo={yo} onIr={ir} />}
          {vista === 'flota' && <MiFlota />}
          {vista === 'auditorias' && <Pronto titulo="Auditorías" texto="Aquí vas a registrar la auditoría del vehículo (días 1 a 5 de cada mes) y la de limpieza (cada lunes), con su checklist y fotos. Reemplaza las tarjetas de Pipefy." />}
          {vista === 'interrupciones' && <Pronto titulo="Interrupciones de ruta" texto="Aquí vas a registrar cada pausa de la ruta (colación, baño, carga eléctrica) con su hora de inicio y de fin. Reemplaza las tarjetas de Pipefy." />}
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
