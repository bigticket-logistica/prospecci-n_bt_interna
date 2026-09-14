// ═══════════════════════════════════════════════════════════════════════════
// MisPagos.jsx — Lo que el tercero ve de su dinero, día por día.
//
// Lee vw_portal_pago_dia_tercero: solo días que el analista ya publicó, y solo
// de empresas con contrato firmado (portal_activo). Las rutas rechazadas se
// muestran en rojo con su motivo — nunca se ocultan: si desaparecen, el tercero
// cuenta el hueco y reclama a ciegas.
//
// El número de cada ruta es el mismo que irá en su prefactura del lunes.
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from './supabaseClient'

// Lunes de la semana de una fecha
function lunesDe(d) {
  const x = new Date(d)
  const dia = (x.getDay() + 6) % 7
  x.setDate(x.getDate() - dia)
  x.setHours(0, 0, 0, 0)
  return x
}
const iso = (d) => d.toISOString().slice(0, 10)
const sumaDias = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }

// Numeración del Brain: ISO + 1 (la semana lun 7 – dom 13 sep 2026 es la 38)
function semanaBrain(d) {
  const x = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dn = x.getUTCDay() || 7
  x.setUTCDate(x.getUTCDate() + 4 - dn)
  const iniAno = new Date(Date.UTC(x.getUTCFullYear(), 0, 1))
  return Math.ceil(((x - iniAno) / 86400000 + 1) / 7) + 1
}

const money = (n) => '$' + Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fechaLarga = (s) =>
  new Date(s + 'T00:00:00').toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })
const rangoCorto = (a, b) =>
  `${a.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })} – ${b.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}`

const ESTADOS = {
  aprobada:  { label: 'Pagada',      bg: 'var(--green-soft)', fg: 'var(--green)' },
  rechazada: { label: 'No pagada',   bg: 'var(--red-soft)',   fg: 'var(--red)' },
  pausada:   { label: 'En revisión', bg: 'var(--amber-soft)', fg: 'var(--amber)' },
  bloqueada: { label: 'En revisión', bg: 'var(--amber-soft)', fg: 'var(--amber)' },
}

export default function MisPagos({ tercero }) {
  const [lunes, setLunes] = useState(() => lunesDe(new Date()))
  const [filas, setFilas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [abierto, setAbierto] = useState({})   // fecha -> expandida

  const domingo = useMemo(() => sumaDias(lunes, 6), [lunes])

  const cargar = useCallback(async () => {
    if (!tercero?.tercero_id) return
    setCargando(true); setError(null)
    const { data, error } = await supabase
      .from('vw_portal_pago_dia_tercero')
      .select('*')
      .eq('tercero_id', tercero.tercero_id)
      .gte('fecha', iso(lunes))
      .lte('fecha', iso(domingo))
      .order('fecha', { ascending: false })
      .order('placa')
    if (error) { setError(error.message); setFilas([]) } else { setFilas(data || []) }
    setCargando(false)
  }, [tercero, lunes, domingo])

  useEffect(() => { cargar() }, [cargar])

  // Agrupa por día; dentro de cada día quedan las rutas
  const dias = useMemo(() => {
    const m = new Map()
    for (const f of filas) {
      if (!m.has(f.fecha)) m.set(f.fecha, [])
      m.get(f.fecha).push(f)
    }
    return [...m.entries()].map(([fecha, rutas]) => ({
      fecha,
      rutas,
      pagado: rutas.filter(r => r.estado === 'aprobada').reduce((s, r) => s + Number(r.pago_neto || 0), 0),
      enRevision: rutas.filter(r => r.estado === 'pausada' || r.estado === 'bloqueada').length,
      noPagadas: rutas.filter(r => r.estado === 'rechazada').length,
    }))
  }, [filas])

  const totalSemana = dias.reduce((s, d) => s + d.pagado, 0)
  const rutasSemana = filas.length

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>

      {/* Cabecera: semana y total */}
      <div style={{
        background: 'var(--navy)', color: '#fff', borderRadius: 14,
        padding: '18px 20px', marginBottom: 18,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={() => setLunes(sumaDias(lunes, -7))} style={navBtn}>‹</button>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Semana {semanaBrain(lunes)}</div>
              <div style={{ fontSize: 12.5, color: '#b8c6de' }}>{rangoCorto(lunes, domingo)}</div>
            </div>
            <button onClick={() => setLunes(sumaDias(lunes, 7))} style={navBtn}>›</button>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11.5, color: '#b8c6de', textTransform: 'uppercase', letterSpacing: '.08em' }}>
              Aprobado esta semana
            </div>
            <div style={{ fontSize: 26, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
              {money(totalSemana)}
            </div>
            <div style={{ fontSize: 12, color: '#b8c6de' }}>
              {rutasSemana} {rutasSemana === 1 ? 'ruta' : 'rutas'}
            </div>
          </div>
        </div>
      </div>

      {error && <div className="form-error">No se pudieron cargar tus pagos: {error}</div>}

      {cargando ? (
        <div style={{ color: 'var(--muted)', fontSize: 14, padding: 24, textAlign: 'center' }}>
          Cargando tus pagos…
        </div>
      ) : dias.length === 0 ? (
        <div style={{
          background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14,
          padding: 32, textAlign: 'center',
        }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', marginBottom: 6 }}>
            Todavía no hay días publicados de esta semana
          </div>
          <div style={{ fontSize: 13.5, color: 'var(--muted)', maxWidth: 460, margin: '0 auto' }}>
            Cada día se revisa y se publica al día siguiente. Si operaste un día que
            no aparece acá y ya pasó más de un día, levanta un reclamo.
          </div>
        </div>
      ) : dias.map(d => {
        const exp = abierto[d.fecha] !== false   // abierto por defecto
        return (
          <div key={d.fecha} style={{
            background: 'var(--card)', border: '1px solid var(--line)',
            borderRadius: 14, marginBottom: 12, overflow: 'hidden',
          }}>
            {/* Encabezado del día */}
            <button
              onClick={() => setAbierto(p => ({ ...p, [d.fecha]: !exp }))}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                gap: 12, padding: '14px 18px', background: 'transparent', border: 'none', textAlign: 'left',
              }}>
              <div>
                <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--navy)', textTransform: 'capitalize' }}>
                  {fechaLarga(d.fecha)}
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 2 }}>
                  {d.rutas.length} {d.rutas.length === 1 ? 'ruta' : 'rutas'}
                  {d.noPagadas > 0 && <span style={{ color: 'var(--red)' }}> · {d.noPagadas} no pagada{d.noPagadas > 1 ? 's' : ''}</span>}
                  {d.enRevision > 0 && <span style={{ color: 'var(--amber)' }}> · {d.enRevision} en revisión</span>}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>
                  {money(d.pagado)}
                </span>
                <span style={{ color: 'var(--muted)', fontSize: 13 }}>{exp ? '▴' : '▾'}</span>
              </div>
            </button>

            {/* Rutas del día */}
            {exp && (
              <div style={{ borderTop: '1px solid var(--line)' }}>
                {d.rutas.map(r => {
                  const est = ESTADOS[r.estado] || ESTADOS.aprobada
                  return (
                    <div key={r.id_ruta} style={{
                      padding: '13px 18px', borderBottom: '1px solid #f1f4f8',
                      display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'start',
                    }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{r.placa}</span>
                          <span style={{
                            fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                            background: est.bg, color: est.fg, textTransform: 'uppercase', letterSpacing: '.04em',
                          }}>{est.label}</span>
                          <span style={{ fontSize: 12, color: 'var(--muted)' }}>Ruta {r.id_ruta}</span>
                        </div>

                        <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 3 }}>
                          {r.driver_name || 'Sin conductor registrado'}
                          {r.service_center_id ? ` · ${r.service_center_id}` : ''}
                        </div>

                        {/* Desglose: lo que responde el "¿por qué me pagaron esto?" */}
                        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 8 }}>
                          <Dato label="NS" valor={r.ns_pct != null ? `${Number(r.ns_pct).toFixed(1)}%` : '—'} />
                          <Dato label="Visitado" valor={r.pct_visitado != null ? `${Number(r.pct_visitado).toFixed(1)}%` : '—'} />
                          {r.tiene_auxiliar && <Dato label="Ayudante" valor={money(r.monto_auxiliar)} />}
                        </div>

                        {r.estado === 'rechazada' && (
                          <div style={{
                            marginTop: 8, background: 'var(--red-soft)', color: 'var(--red)',
                            borderRadius: 8, padding: '8px 10px', fontSize: 12.5,
                          }}>
                            <b>No se pagó:</b> {r.motivo_rechazo || 'sin motivo registrado'}
                          </div>
                        )}
                        {(r.estado === 'pausada' || r.estado === 'bloqueada') && (
                          <div style={{
                            marginTop: 8, background: 'var(--amber-soft)', color: 'var(--amber)',
                            borderRadius: 8, padding: '8px 10px', fontSize: 12.5,
                          }}>
                            <b>En revisión:</b> {r.motivo_rechazo || 'pendiente de resolución'}
                          </div>
                        )}
                      </div>

                      <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <div style={{
                          fontSize: 15.5, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
                          color: r.estado === 'aprobada' ? 'var(--ink)' : 'var(--muted)',
                          textDecoration: r.estado === 'rechazada' ? 'line-through' : 'none',
                        }}>
                          {money(r.pago_neto)}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}

      {dias.length > 0 && (
        <div style={{ fontSize: 12.5, color: 'var(--muted)', textAlign: 'center', padding: '8px 0 24px' }}>
          Estos montos son los que irán en tu prefactura. Si algo no cuadra, levanta un reclamo.
        </div>
      )}
    </div>
  )
}

function Dato({ label, valor }) {
  return (
    <span style={{ fontSize: 12 }}>
      <span style={{ color: 'var(--muted)' }}>{label} </span>
      <b style={{ color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{valor}</b>
    </span>
  )
}

const navBtn = {
  background: 'var(--navy-line)', color: '#fff', border: 'none',
  borderRadius: 8, width: 30, height: 30, fontSize: 16, lineHeight: 1,
}
