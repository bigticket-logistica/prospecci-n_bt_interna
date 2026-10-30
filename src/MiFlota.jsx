// ═══════════════════════════════════════════════════════════════════════════
// MiFlota.jsx — Mi operación › Mi flota en el computador (maqueta 8.9.18).
// Un recuadro con el selector Conductores | Ayudantes | Vehículos, buscador,
// filtros de site y estado, y la tabla. En el teléfono sigue FlotaPersonal.
// Datos: flota_personal_terceros (tipo conductor | ayudante | vehiculo,
// estado activo | baja, service_center = site).
// ═══════════════════════════════════════════════════════════════════════════
import { useMemo, useState } from 'react'

const OPC = [['conductor', 'Conductores'], ['ayudante', 'Ayudantes'], ['vehiculo', 'Vehículos']]
const SIN_SITE = '__sin__'

export default function MiFlota({ rows, err, onBack }) {
  const [tipo, setTipo] = useState('conductor')
  const [q, setQ] = useState('')
  const [site, setSite] = useState('')
  const [estado, setEstado] = useState('')

  const tipoDe = (r) => (r.tipo === 'vehiculo' ? 'vehiculo' : r.tipo === 'ayudante' ? 'ayudante' : 'conductor')
  const sites = useMemo(() => [...new Set((rows || []).map(r => r.service_center).filter(Boolean))].sort(), [rows])
  const hayNulos = (rows || []).some(r => !r.service_center)

  const lista = (rows || []).filter(r => {
    if (tipoDe(r) !== tipo) return false
    if (site === SIN_SITE ? r.service_center : site && r.service_center !== site) return false
    const est = r.estado === 'baja' ? 'baja' : 'activo'
    if (estado && est !== estado) return false
    if (q.trim()) {
      const t = `${r.nombre || ''} ${r.curp || ''} ${r.placa || ''}`.toLowerCase()
      if (!t.includes(q.trim().toLowerCase())) return false
    }
    return true
  })
  const esVeh = tipo === 'vehiculo'
  const cab = esVeh ? ['Placa', 'Modelo', 'Site', 'Estado'] : [tipo === 'ayudante' ? 'Ayudante' : 'Conductor', 'CURP', 'Site', 'Estado']

  return (
    <div className="p8">
      <nav className="p8-crumbs" aria-label="Ruta">
        <button className="p8-link" onClick={onBack}>← Volver</button>
        <span className="p8-sep" />
        <button className="p8-link" onClick={onBack}>Inicio</button>
        <span className="p8-chev">›</span>
        <span>Mi operación</span>
        <span className="p8-chev">›</span>
        <span aria-current="page" className="p8-actual">Mi flota</span>
      </nav>
      <h1 className="p8-titulo">Mi flota</h1>
      <p className="p8-desc">Cada certificación realizada correctamente se incorpora automáticamente aquí, con el detalle de tu personal y flota.</p>
      {err && <div className="form-error" style={{ margin: '12px 0' }}>{err}</div>}

      <section className="fleet-box">
        <div className="fleet-top">
          <div className="fleet-seg" role="tablist">
            {OPC.map(([k, t]) => (
              <button key={k} role="tab" aria-selected={tipo === k} onClick={() => setTipo(k)}>{t}</button>
            ))}
          </div>
          <div className="fleet-filtros">
            <label className="fleet-search">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#545454" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar nombre, CURP o placa" aria-label="Buscar" />
            </label>
            <select className="fleet-filter" value={site} onChange={e => setSite(e.target.value)} aria-label="Filtrar por site">
              <option value="">Todos los sites</option>
              {sites.map(s => <option key={s} value={s}>{s}</option>)}
              {hayNulos && <option value={SIN_SITE}>Sin site asignado</option>}
            </select>
            <select className="fleet-filter" value={estado} onChange={e => setEstado(e.target.value)} aria-label="Filtrar por estado">
              <option value="">Todos los estados</option>
              <option value="activo">Activo</option>
              <option value="baja">Baja</option>
            </select>
          </div>
        </div>

        {rows === null ? <div className="fleet-vacio">Cargando…</div> : (
          <div className="fleet-scroll">
            <div className={`fleet-table${esVeh ? ' veh' : ''}`}>
              <div className="fleet-row fleet-th">{cab.map(h => <span key={h}>{h}</span>)}</div>
              {lista.length === 0 ? <div className="fleet-vacio">No encontramos resultados con esos filtros.</div>
                : lista.map(r => (
                  <div key={r.id} className={`fleet-row fleet-tr${r.estado === 'baja' ? ' is-baja' : ''}`}>
                    <span className="fleet-td-main">{esVeh ? (r.placa || '—') : (r.nombre || '—')}</span>
                    <span className="fleet-td">{esVeh ? ([r.marca, r.modelo, r.anio].filter(Boolean).join(' ') || '—') : (r.curp || '—')}</span>
                    <span className="fleet-td">{r.service_center || 'Sin site asignado'}</span>
                    <span className="fleet-td">{r.estado === 'baja' ? 'Baja' : 'Activo'}</span>
                  </div>
                ))}
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
