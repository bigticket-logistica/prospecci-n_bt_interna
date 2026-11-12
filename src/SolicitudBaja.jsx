// ═══════════════════════════════════════════════════════════════════════════
// SolicitudBaja.jsx — Certificación › Solicitud de baja (maqueta 8.9.20)
// Tipo de baja (vehículo · personal · empresa) en tarjetas; selección con
// casillas; motivo, fecha efectiva y detalle; botón que se activa con al menos
// una selección y un motivo; confirmación en modal; mensaje final de 5 s y la
// tabla "Mis solicitudes". Misma lógica de antes: padrón vigente
// (flota_personal_terceros activos), bloqueo de duplicados en curso, folio
// desde solicitudes_baja y aviso al equipo por mensajes_terceros.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

const MOTIVOS = {
  vehiculo: ['Venta del vehículo', 'Siniestro / pérdida total', 'Fin de contrato con el propietario', 'Falla mecánica permanente', 'Documentación vencida sin renovación', 'Otro'],
  personal: ['Renuncia voluntaria', 'Término de la relación laboral', 'Rechazo en revalidación de antecedentes', 'Cambio de empresa transportista', 'Otro'],
  empresa: ['Término de relación comercial', 'Cierre de operaciones de la empresa', 'Incumplimiento contractual', 'Otro'],
}
// Solo dos estados (maqueta 8.9.20): En revisión → Completada (lo marca BigTicket). No existe rechazo.
const estadoTxt = (e) => e === 'completada' ? 'Completada' : 'En revisión'
const fDia = (x) => x ? new Date(x).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' }) : ''

// Íconos de la maqueta 8.9.21 (línea naranja 0.83 sobre blanco)
const ICONOS = {
  vehiculo: <><path d="M13 6v5a1 1 0 0 0 1 1h6.102a1 1 0 0 1 .712.298l.898.91a1 1 0 0 1 .288.702V17a1 1 0 0 1-1 1h-3" /><path d="M5 18H3a1 1 0 0 1-1-1V8a2 2 0 0 1 2-2h12c1.1 0 2.1.8 2.4 1.8l1.176 4.2" /><path d="M9 18h5" /><circle cx="16" cy="18" r="2" /><circle cx="7" cy="18" r="2" /></>,
  personal: <><circle cx="12" cy="8" r="4.5" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  empresa: <><rect x="5" y="2.5" width="14" height="19" rx="1.5" /><path d="M9 7h1.5M13.5 7H15M9 11h1.5M13.5 11H15M9 15h1.5M13.5 15H15" /><path d="M10 21.5v-3h4v3" /></>,
}
const TIPOS = [['vehiculo', 'Baja de vehículo'], ['personal', 'Baja de personal'], ['empresa', 'Baja de empresa']]
const IcoCheck = ({ s = 12, c = '#fff', w = 3.2 }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>

export default function SolicitudBaja({ tercero, email, onBack }) {
  const [tipo, setTipo] = useState(null)
  const [vehiculos, setVehiculos] = useState(null)
  const [personal, setPersonal] = useState(null)
  const [sel, setSel] = useState([])
  const [chkEmpresa, setChkEmpresa] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [detalle, setDetalle] = useState('')
  const [fecha, setFecha] = useState('')
  const [rows, setRows] = useState(null)
  const [confirmar, setConfirmar] = useState(false)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState('')
  const [err, setErr] = useState('')

  const cargarSolicitudes = async () => {
    const { data } = await supabase.from('solicitudes_baja').select('*').eq('tercero_id', tercero.tercero_id).order('created_at', { ascending: false })
    setRows(data || [])
  }
  useEffect(() => { (async () => {
    // El padrón vigente: certificados y registrados por BigTicket, solo activos
    const { data } = await supabase.from('flota_personal_terceros')
      .select('id, tipo, estado, origen, service_center, placa, marca, nombre, curp, certificacion_id')
      .eq('tercero_id', tercero.tercero_id).eq('estado', 'activo')
    const all = data || []
    setVehiculos(all.filter((r) => r.tipo === 'vehiculo').map((r) => ({ id: r.id, certificacion_id: r.certificacion_id || null, placa: r.placa || 'Sin placa', marca: r.marca || '', sc: r.service_center || '—', origen: r.origen })))
    setPersonal(all.filter((r) => r.tipo !== 'vehiculo').map((r) => ({ id: r.id, certificacion_id: r.certificacion_id || null, nombre: r.nombre || 'Sin nombre', curp: r.curp || '', rol: r.tipo === 'ayudante' ? 'Ayudante' : 'Conductor', sc: r.service_center || '—', origen: r.origen })))
  })(); cargarSolicitudes() }, [tercero])   // eslint-disable-line react-hooks/exhaustive-deps

  const limpiar = () => { setSel([]); setChkEmpresa(false); setMotivo(''); setDetalle(''); setFecha('') }
  const elegirTipo = (t) => { setTipo(t); limpiar(); setErr('') }

  // Lo que ya tiene una solicitud en curso no se puede volver a pedir
  const enCurso = (rows || []).filter((r) => ['en_revision', 'en_proceso'].includes(r.estado))
  const idsEnCurso = new Set(enCurso.flatMap((r) => Array.isArray(r.seleccion) ? r.seleccion.flatMap((x) => [x.padron_id, x.certificacion_id].filter(Boolean)) : []))
  const folioDe = (id) => enCurso.find((r) => Array.isArray(r.seleccion) && r.seleccion.some((x) => x.padron_id === id || x.certificacion_id === id))?.folio
  const empresaEnCurso = enCurso.find((r) => r.tipo === 'empresa')
  const toggle = (id) => { if (idsEnCurso.has(id)) return; setSel((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]) }

  const motivoOk = motivo !== '' && (motivo !== 'Otro' || detalle.trim() !== '')
  const habilitado = tipo && motivoOk && (tipo === 'empresa' ? (chkEmpresa && !empresaEnCurso) : sel.length > 0)

  const elegidos = tipo === 'vehiculo' ? (vehiculos || []).filter((v) => sel.includes(v.id)) : tipo === 'personal' ? (personal || []).filter((p) => sel.includes(p.id)) : []
  const tituloModal = tipo === 'vehiculo' ? (elegidos.length > 1 ? '¿Confirmas la baja de los vehículos?' : '¿Confirmas la baja del vehículo?')
    : tipo === 'personal' ? '¿Confirmas la baja del personal?' : '¿Confirmas la baja de la empresa?'
  const lista = (xs) => xs.length > 1 ? `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}` : xs[0]
  const textoModal = tipo === 'vehiculo' ? `Estás a punto de solicitar la baja de ${elegidos.length > 1 ? 'las placas' : 'la placa'} ${lista(elegidos.map((v) => v.placa))}. ¿Deseas continuar?`
    : tipo === 'personal' ? `Estás a punto de solicitar la baja de ${lista(elegidos.map((p) => p.nombre.toUpperCase()))}. ¿Deseas continuar?`
    : `Estás a punto de solicitar la baja de ${tercero.nombre}, incluidos sus ${(vehiculos || []).length} vehículos y ${(personal || []).length} personas registradas. ¿Deseas continuar?`

  async function enviar() {
    if (!habilitado || busy) return
    setBusy(true); setErr('')
    try {
      let seleccion, itemsTxt
      if (tipo === 'vehiculo') { seleccion = elegidos.map((v) => ({ padron_id: v.id, certificacion_id: v.certificacion_id, placa: v.placa, sc: v.sc })); itemsTxt = elegidos.map((v) => v.placa).join(', ') }
      else if (tipo === 'personal') { seleccion = elegidos.map((p) => ({ padron_id: p.id, certificacion_id: p.certificacion_id, nombre: p.nombre, curp: p.curp, rol: p.rol, sc: p.sc })); itemsTxt = elegidos.map((p) => p.nombre).join(', ') }
      else { seleccion = { empresa: tercero.nombre, vehiculos: (vehiculos || []).length, personal: (personal || []).length }; itemsTxt = `${tercero.nombre} (incluye ${(vehiculos || []).length} vehículos y ${(personal || []).length} personas)` }
      const { data, error } = await supabase.from('solicitudes_baja').insert({
        tercero_id: tercero.tercero_id, tipo, seleccion, motivo, detalle: detalle.trim() || null, fecha_efectiva: fecha || null, enviado_por: email,
      }).select('folio').single()
      if (error) throw new Error(error.message)
      const tipoTxt = tipo === 'vehiculo' ? 'Baja de vehículo' : tipo === 'personal' ? 'Baja de personal' : 'Baja de empresa'
      await supabase.from('mensajes_terceros').insert({
        tercero_id: tercero.tercero_id, autor: 'tercero',
        mensaje: `📤 ${tipoTxt} — Folio ${data.folio}. ${itemsTxt}. Motivo: ${motivo}${detalle.trim() ? ` (${detalle.trim()})` : ''}`,
      })
      setConfirmar(false); limpiar(); cargarSolicitudes()
      setToast('Solicitud de baja registrada correctamente.'); setTimeout(() => setToast(''), 5000)
    } catch (e) { setConfirmar(false); setErr('No se pudo enviar la solicitud: ' + e.message) }
    finally { setBusy(false) }
  }

  const Fila = ({ id, titulo, meta, origen, bloqueado, folio }) => {
    const on = sel.includes(id)
    return (
      <button type="button" role="checkbox" aria-checked={on} disabled={bloqueado} className={`sb-fila${bloqueado ? ' bloqueada' : ''}`} onClick={() => toggle(id)}>
        <span className="sb-check">{on && <IcoCheck />}</span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span className="sb-placa">{titulo}</span>
          <span className="sb-meta">{bloqueado ? `Solicitud en curso (${folio})` : meta}</span>
        </span>
        <span className="sb-origen">{origen === 'certificacion' ? <><IcoCheck s={20} c="#002E5D" w={2.4} />Certificado</> : 'Registrado por BigTicket'}</span>
      </button>
    )
  }

  return (
    <div className="sb">
      <style>{CSS_SB}</style>
      <nav className="sb-ruta" aria-label="Ruta">
        <button className="sb-volver" onClick={onBack}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M11 18l-6-6 6-6" /></svg>Volver</button><span className="sb-sep" />
        <button className="sb-miga" onClick={onBack}>Inicio</button><span className="sb-gt">›</span>
        <span>Certificación</span><span className="sb-gt">›</span>
        <span aria-current="page">Solicitud de baja</span>
      </nav>
      <h1 className="sb-titulo">Solicitud de baja</h1>
      <p className="sb-desc">{tipo === 'empresa'
        ? 'Selecciona el conductor, ayudante o vehículo que desees dar de baja e indica el motivo. Tu solicitud pasará por revisión antes de aplicarse.'
        : '¿Necesitas dar de baja un conductor, ayudante o vehículo? Elige qué retirar y el motivo. Revisaremos tu caso antes de aplicar el cambio.'}</p>
      {err && <div className="sb-error">{err}</div>}

      <div className="sb-box">
        <div className="sb-etiqueta">Tipo de baja a gestionar</div>
        <div className="sb-tipos">
          {TIPOS.map(([k, t]) => (
            <button key={k} type="button" className="sb-tipo" aria-pressed={tipo === k} onClick={() => elegirTipo(k)}>
              <span className="sb-ico">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#FF6600" strokeWidth="0.83" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICONOS[k]}</svg>
                <span className="sb-menos" aria-hidden="true"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4" /><path d="M14 8l4 4-4 4" /><path d="M18 12H9" /></svg></span>
              </span>
              <span className="sb-tipo-t">{t}</span>
            </button>
          ))}
        </div>
      </div>

      {tipo && (
        <div className="sb-box">
          {tipo === 'vehiculo' && (<>
            <h2>Selecciona la(s) placa(s)</h2>
            <p className="sb-sub">Vehículos registrados en tu empresa.</p>
            <div className="sb-lista">
              {vehiculos === null ? <div className="sb-vacio">Cargando…</div>
                : vehiculos.length === 0 ? <div className="sb-vacio">No tienes vehículos activos registrados.</div>
                : vehiculos.map((v) => <Fila key={v.id} id={v.id} titulo={v.placa} meta={`${v.marca || 'Vehículo'} · ${v.sc}`} origen={v.origen} bloqueado={idsEnCurso.has(v.id)} folio={folioDe(v.id)} />)}
            </div>
          </>)}
          {tipo === 'personal' && (<>
            <h2>Selecciona el personal</h2>
            <p className="sb-sub">Conductores y ayudantes registrados en tu empresa.</p>
            <div className="sb-lista">
              {personal === null ? <div className="sb-vacio">Cargando…</div>
                : personal.length === 0 ? <div className="sb-vacio">No tienes personal activo registrado.</div>
                : personal.map((p) => <Fila key={p.id} id={p.id} titulo={p.nombre.toUpperCase()} meta={`${p.rol} · CURP ${p.curp ? '****' + p.curp.slice(-4) : '—'} · ${p.sc}`} origen={p.origen} bloqueado={idsEnCurso.has(p.id)} folio={folioDe(p.id)} />)}
            </div>
          </>)}
          {tipo === 'empresa' && (<>
            <h2 style={{ marginBottom: 16 }}>Datos de la empresa</h2>
            <div className="sb-emp">
              <span className="sb-emp-n">{tercero.nombre}</span>
              <span className="sb-emp-c">{(vehiculos || []).length} vehículos<br />{(personal || []).length} personas registradas</span>
            </div>
            <div className="sb-note">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FF6600" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></svg>
              <span><strong>Atención:</strong> la baja de empresa da de baja también <strong>todos sus vehículos y personal certificado asociados</strong>. Esta acción pasa a revisión de BigTicket antes de hacerse efectiva.</span>
            </div>
            {empresaEnCurso ? <div className="sb-aviso" style={{ marginTop: 14 }}>Ya existe una solicitud de baja de empresa en curso ({empresaEnCurso.folio}).</div> : (
              <button type="button" role="checkbox" aria-checked={chkEmpresa} className="sb-ack" onClick={() => setChkEmpresa(!chkEmpresa)}>
                <span className="sb-check">{chkEmpresa && <IcoCheck />}</span>
                Entiendo que esta solicitud incluye la baja de todos los vehículos y el personal de la empresa.
              </button>
            )}
          </>)}

          <div className="sb-motivo">
            <h2>Motivo de la baja</h2>
            <div className="sb-grid">
              <div className="sb-field"><label htmlFor="sb-mot">Motivo<span className="req"> *</span></label>
                <div className="sb-select"><select id="sb-mot" value={motivo} onChange={(e) => setMotivo(e.target.value)}>
                  <option value="">Selecciona el motivo…</option>{MOTIVOS[tipo].map((m) => <option key={m} value={m}>{m}</option>)}
                </select></div></div>
              <div className="sb-field"><label htmlFor="sb-fec">Fecha efectiva solicitada</label>
                <input id="sb-fec" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} /></div>
              <div className="sb-field full"><label htmlFor="sb-det">Detalle del motivo{motivo === 'Otro' && <span className="req"> *</span>}</label>
                <input id="sb-det" value={detalle} onChange={(e) => setDetalle(e.target.value)} placeholder={motivo === 'Otro' ? 'Describe brevemente la situación' : 'Opcional'} /></div>
            </div>
            <div className="sb-nota">Si no indicas fecha, la baja se procesa al aprobarse la solicitud.</div>
          </div>
          <div className="sb-acciones">
            <button className="sb-btn-pri" disabled={!habilitado} onClick={() => setConfirmar(true)}>Enviar solicitud de baja</button>
          </div>
        </div>
      )}

      <div className="sb-box">
        <h2 style={{ marginBottom: 16 }}>Mis solicitudes</h2>
        <div className="sb-scroll"><div className="sb-tabla">
          <div className="sb-head"><span>Folio</span><span>Tipo</span><span>Selección</span><span>Motivo</span><span>Estado</span><span>Fecha</span></div>
          {rows === null ? <div className="sb-vacio">Cargando…</div>
            : rows.length === 0 ? <div className="sb-vacio">Aún no has enviado solicitudes de baja.</div>
            : rows.map((r) => {
              const selTxt = r.tipo === 'empresa' ? (r.seleccion?.empresa || tercero.nombre) : (Array.isArray(r.seleccion) ? r.seleccion.map((s) => s.placa || s.nombre).join(', ') : '—')
              const tipoTxt = r.tipo === 'vehiculo' ? 'Vehículo' : r.tipo === 'personal' ? 'Personal' : 'Empresa'
              const mot = r.motivo + (r.detalle ? ` · ${r.detalle}` : '')
              return (
                <div key={r.id} className="sb-row">
                  <span className="sb-folio">{r.folio}</span>
                  <span className="sb-dato">{tipoTxt}</span>
                  <span className="sb-dato sb-elip" title={selTxt}>{selTxt}</span>
                  <span className="sb-dato sb-elip" title={mot}>{mot}</span>
                  <span className="sb-dato">{estadoTxt(r.estado)}</span>
                  <span className="sb-dato">{fDia(r.created_at)}</span>
                </div>
              )
            })}
        </div></div>
      </div>

      {confirmar && (
        <div className="sb-backdrop" onClick={() => !busy && setConfirmar(false)}>
          <div className="sb-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h2>{tituloModal}</h2>
            <p>{textoModal}</p>
            <div className="sb-modal-acc">
              <button className="sb-btn-sec" disabled={busy} onClick={() => setConfirmar(false)}>Cancelar</button>
              <button className="sb-btn-pri" disabled={busy} onClick={enviar}>{busy ? 'Enviando…' : 'Solicitar la baja'}</button>
            </div>
          </div>
        </div>
      )}
      {toast && <div className="sb-toast" role="status"><IcoCheck s={20} c="#002E5D" w={2.4} />{toast}</div>}
    </div>
  )
}

const CSS_SB = `
.sb { font-family:"Open Sans",system-ui,sans-serif; display:flex; flex-direction:column; gap:20px; }
.sb-ruta { display:flex; align-items:center; gap:10px; font:400 13px "Open Sans",sans-serif; color:#545454; flex-wrap:wrap; margin-bottom:-6px; }
.sb-ruta button { background:none; border:none; padding:0; font:inherit; color:#545454; cursor:pointer; display:inline-flex; align-items:center; gap:6px; }
.sb-ruta button:hover { color:#002E5D; text-decoration:underline; }
.sb-sep { width:1px; height:14px; background:#D9D9D9; }
.sb-gt { color:#9AA3AE; }
.sb-ruta [aria-current] { color:#002E5D; font-weight:600; }
.sb-titulo { font:700 28px Poppins,sans-serif; color:#002E5D; margin:0 0 -14px; }
.sb-desc { font:400 14px/1.5 "Open Sans",sans-serif; color:#545454; margin:0; }
.sb-error { background:#FDF1F0; color:#C43D2F; border-radius:10px; padding:10px 12px; font-size:13.5px; }
.sb-box { background:#fff; border:1px solid #E4E3E3; border-radius:18px; padding:22px 24px; box-shadow:0 1px 3px rgba(0,46,93,.05); }
.sb-box h2 { font:600 20px Poppins,sans-serif; color:#002E5D; margin:0; }
.sb-sub { font:400 14px "Open Sans",sans-serif; color:#545454; margin:6px 0 16px; }
.sb-etiqueta { font:700 13.5px Poppins,sans-serif; text-transform:uppercase; color:#002E5D; letter-spacing:.04em; margin-bottom:14px; }
.sb-tipos { display:grid; gap:14px; grid-template-columns:repeat(auto-fit,minmax(min(100%,200px),1fr)); }
.sb-tipo { background:#fff; border:1px solid #E4E3E3; border-radius:14px; padding:22px 16px; display:flex; flex-direction:column; align-items:center; gap:12px; cursor:pointer; transition:box-shadow .2s, transform .2s, border-color .2s; }
.sb-tipo:hover, .sb-tipo[aria-pressed="true"] { box-shadow:0 12px 28px rgba(0,46,93,.14); transform:translateY(-2px); }
.sb-tipo[aria-pressed="true"] { border-color:#FFB98A; }
.sb-ico { position:relative; width:48px; height:48px; border-radius:12px; box-sizing:border-box; background:#fff; border:1px solid #FFC7A3; box-shadow:0 2px 8px rgba(255,102,0,.16); display:flex; align-items:center; justify-content:center; flex-shrink:0; transition:border-color .18s ease-out, box-shadow .18s ease-out, transform .18s ease-out; }
.sb-tipo:hover .sb-ico, .sb-tipo[aria-pressed="true"] .sb-ico { border-color:#FF6600; transform:translateY(-2px) scale(1.08); box-shadow:0 6px 14px rgba(255,102,0,.22); }
.sb-menos { position:absolute; right:-7px; bottom:-7px; width:22px; height:22px; border-radius:50%; background:#FF6600; border:2px solid #fff; display:flex; align-items:center; justify-content:center; box-sizing:border-box; }
.sb-tipo-t { font:700 15px Poppins,sans-serif; color:#002E5D; }
.sb-lista { display:flex; flex-direction:column; gap:10px; }
.sb-fila { display:flex; align-items:center; gap:14px; width:100%; padding:14px 18px; background:#fff; border:1px solid #E4E3E3; border-radius:12px; cursor:pointer; text-align:left; box-shadow:0 1px 3px rgba(0,46,93,.05); transition:box-shadow .2s, transform .2s, border-color .2s, background .15s; font:inherit; }
.sb-fila:hover:not(:disabled) { box-shadow:0 12px 28px rgba(0,46,93,.14); transform:translateY(-2px); border-color:#B8C4D3; }
.sb-fila[aria-checked="true"] { border-color:#002E5D; background:#F4F6F9; }
.sb-fila.bloqueada { opacity:.55; cursor:not-allowed; }
.sb-check { width:20px; height:20px; border-radius:5px; flex:none; border:1.5px solid #C9CDD2; background:#fff; display:flex; align-items:center; justify-content:center; box-sizing:border-box; transition:background .15s, border-color .15s; }
[aria-checked="true"] .sb-check { background:#002E5D; border-color:#002E5D; }
.sb-placa { display:block; font:700 15px Poppins,sans-serif; color:#002E5D; }
.sb-meta { display:block; font:400 12.5px "Open Sans",sans-serif; color:#545454; margin-top:2px; }
.sb-origen { display:flex; align-items:center; gap:6px; font:400 14px "Open Sans",sans-serif; color:#545454; white-space:nowrap; }
.sb-emp { display:flex; justify-content:space-between; align-items:center; gap:14px; flex-wrap:wrap; padding:14px 18px; background:#fff; border:1px solid #E4E3E3; border-radius:12px; box-shadow:0 1px 3px rgba(0,46,93,.05); }
.sb-emp-n { font:700 15px Poppins,sans-serif; color:#002E5D; }
.sb-emp-c { font:400 12.5px "Open Sans",sans-serif; color:#545454; text-align:right; }
.sb-note { display:flex; gap:12px; padding:14px 18px; background:#fff; border:1px solid #E4E3E3; border-radius:12px; font:400 14px/1.5 "Open Sans",sans-serif; color:#545454; margin-top:14px; }
.sb-note svg { flex:none; }
.sb-note strong { font-family:Poppins,sans-serif; font-weight:700; color:#002E5D; }
.sb-ack { display:flex; align-items:center; gap:12px; padding:0; border:none; background:none; cursor:pointer; text-align:left; font:400 14px/1.4 "Open Sans",sans-serif; color:#545454; margin-top:16px; }
.sb-aviso { background:#FFF4EC; border:1px solid #FBD9C0; border-radius:12px; padding:12px 14px; font-size:13.5px; color:#7c3a12; margin-bottom:12px; }
.sb-motivo { margin-top:22px; padding-top:22px; border-top:1px solid #E4E3E3; display:flex; flex-direction:column; gap:18px; }
.sb-grid { display:grid; gap:18px 20px; grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr)); }
.sb-field { display:flex; flex-direction:column; gap:8px; min-width:0; }
.sb-field.full { grid-column:1 / -1; }
.sb-field label { font:700 14px Poppins,sans-serif; color:#002E5D; }
.sb-field .req { color:#FF6600; }
.sb-field input, .sb-field select { height:46px; padding:0 14px; width:100%; box-sizing:border-box; border:1px solid #C9CDD2; border-radius:10px; background:#fff; font:400 14px "Open Sans",sans-serif; color:#545454; }
.sb-select { position:relative; }
.sb-select::after { content:''; position:absolute; right:16px; top:50%; width:12px; height:12px; transform:translateY(-50%); pointer-events:none;
  background:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23002E5D' stroke-width='2.5' stroke-linecap='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E") center/12px no-repeat; }
.sb-field select { appearance:none; -webkit-appearance:none; padding-right:40px; }
.sb-nota { font:400 12.5px "Open Sans",sans-serif; color:#545454; margin-top:-6px; }
.sb-acciones { display:flex; justify-content:flex-end; padding-top:16px; border-top:1px solid #E4E3E3; margin-top:18px; }
.sb-btn-pri { height:44px; padding:0 22px; border:none; border-radius:10px; background:#FF6600; color:#fff; font:700 14px Poppins,sans-serif; cursor:pointer; }
.sb-btn-pri:disabled { background:#F7BE95; cursor:not-allowed; }
.sb-btn-sec { height:44px; padding:0 22px; border:1.5px solid #002E5D; border-radius:10px; background:#fff; color:#002E5D; font:700 14px Poppins,sans-serif; cursor:pointer; }
.sb-scroll { overflow-x:auto; }
.sb-tabla { min-width:980px; }
.sb-head, .sb-row { display:grid; gap:10px; align-items:center; padding:14px 16px;
  grid-template-columns:minmax(180px,1fr) minmax(90px,.6fr) minmax(220px,1.3fr) minmax(220px,1.3fr) minmax(120px,.7fr) minmax(100px,.6fr); }
.sb-head { background:#002E5D; border-radius:12px; margin-bottom:6px; }
.sb-head span { font:700 15px Poppins,sans-serif; letter-spacing:.06em; text-transform:uppercase; color:#fff; white-space:nowrap; }
.sb-row { border-top:1px solid #EFEDED; }
.sb-row:hover { background:#FAFBFD; }
.sb-folio { font:700 15px Poppins,sans-serif; color:#002E5D; white-space:nowrap; }
.sb-dato { font:400 14px "Open Sans",sans-serif; color:#545454; }
.sb-dato.rojo { color:#C43D2F; }
.sb-elip { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.sb-vacio { padding:18px 16px; color:#545454; font-size:14px; }
.sb-backdrop { position:fixed; inset:0; z-index:200; background:rgba(0,30,61,.42); display:flex; align-items:center; justify-content:center; padding:20px; }
.sb-modal { max-width:460px; width:100%; background:#fff; border-radius:16px; padding:28px; box-shadow:0 24px 60px rgba(0,30,61,.28); box-sizing:border-box; }
.sb-modal h2 { font:700 20px Poppins,sans-serif; color:#002E5D; margin:0; }
.sb-modal p { font:400 14px/1.5 "Open Sans",sans-serif; color:#545454; }
.sb-modal-acc { display:flex; justify-content:flex-end; gap:12px; margin-top:12px; flex-wrap:wrap; }
.sb-toast { position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); z-index:300; display:flex; align-items:center; gap:12px; padding:20px 28px; background:#fff; border:1px solid #E4E3E3; border-radius:14px; box-shadow:0 24px 60px rgba(0,30,61,.22); font:700 14px Poppins,sans-serif; color:#002E5D; }
`
