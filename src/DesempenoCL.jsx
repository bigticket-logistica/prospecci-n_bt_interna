// DesempenoCL.jsx — Portal del transportista (Chile) · Cuidado de Activo → Mi desempeño (pedido I-20).
// Cada tercero ve su nota Geotab diaria y del mes, y sus incumplimientos del mes con fecha. Solo sus patentes
// (la base filtra por la empresa que entró: fn_portal_cl_desempeno). Solo lectura.
import { useEffect, useState } from 'react'
import { supabaseCL } from './supabaseChile'

const FALTAS = { 1: 'No presentación del vehículo', 10: 'Visitas < 90 % de los domicilios', 12: 'Nota Geotab del mes < 90', 13: 'Auditoría no realizada', 14: 'Uso no autorizado del vehículo' }
const RIESGO = { 'Básico': '#1A7A3C', 'Leve': '#002E5D', 'Medio': '#C47A00', 'Alto': '#B42318' }
const pesos = (v) => `$${Math.round(Number(v || 0)).toLocaleString('es-CL')}`
const fecha = (v) => { const d = String(v || '').slice(0, 10).split('-'); return d.length === 3 ? `${d[2]}-${d[1]}` : '' }

export default function DesempenoCL() {
  const [mes, setMes] = useState(new Date().toLocaleDateString('en-CA', { timeZone: 'America/Santiago' }).slice(0, 7))
  const [d, setD] = useState(null)
  const [err, setErr] = useState('')
  const [abierta, setAbierta] = useState(null)
  useEffect(() => {
    setD(null); setErr('')
    supabaseCL.rpc('fn_portal_cl_desempeno', { p_mes: `${mes}-01` }).then(({ data, error }) => {
      if (error) { setErr('No se pudo cargar tu desempeño. Intenta de nuevo en un momento.'); setD({ mes: [], diario: [], faltas: [] }); return }
      setD(data || { mes: [], diario: [], faltas: [] })
    })
  }, [mes])
  const filas = d?.mes || []
  const uf = filas.reduce((t, x) => t + Number(x.uf_total || 0), 0)
  const pv = filas.reduce((t, x) => t + Number(x.pesos_visitas || 0), 0)
  return (
    <div>
      <h1 className="pc-h1">Mi desempeño</h1>
      <div className="pc-sub">Tu nota de conducción de Geotab (la del mes es el promedio de los días con actividad; bajo 90 corre multa) y los incumplimientos del mes según el Anexo III. Revísalo seguido para corregir a tiempo.</div>
      <div className="pc-card" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <label style={{ fontSize: 13, color: '#545454' }}>Mes <input type="month" value={mes} onChange={(e) => e.target.value && setMes(e.target.value)} /></label>
        {d && <span style={{ fontSize: 13 }}><b>{filas.length}</b> vehículos · multas del mes <b style={{ color: uf || pv ? '#B42318' : '#1A7A3C' }}>{uf} UF{pv ? ` + ${pesos(pv)}` : ''}</b></span>}
      </div>
      {err && <div className="pc-card" style={{ background: '#FBE3E0', color: '#C43D2F' }}>{err}</div>}
      {d === null ? <div className="pc-card">Cargando…</div> : filas.length === 0 ? <div className="pc-card">Sin datos de este mes para tus vehículos.</div> : filas.map((x) => {
        const dias = (d.diario || []).filter((r) => r.patente === x.patente)
        const faltas = (d.faltas || []).filter((f) => f.patente === x.patente)
        return (
          <div key={x.patente} className="pc-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', cursor: 'pointer' }} onClick={() => setAbierta(abierta === x.patente ? null : x.patente)}>
              <b style={{ color: '#002E5D' }}>{x.patente}</b>
              <span style={{ fontWeight: 800, color: x.nota_geotab !== null && Number(x.nota_geotab) < 90 ? '#B42318' : '#1A7A3C' }}>
                {x.nota_geotab !== null ? `Nota ${x.nota_geotab}` : 'Sin nota'}{x.riesgo && <span style={{ color: RIESGO[x.riesgo], marginLeft: 6 }}>· Riesgo {x.riesgo.toLowerCase()}</span>}
                <span style={{ color: '#888', fontWeight: 400, marginLeft: 8 }}>{abierta === x.patente ? '▲' : '▼'}</span>
              </span>
            </div>
            <div style={{ fontSize: 13, color: '#545454', marginTop: 4 }}>
              {faltas.length ? `${faltas.length} incumplimiento(s) este mes` : 'Sin incumplimientos este mes.'}
              {Number(x.uf_total) > 0 && <span style={{ color: '#B42318' }}> · {x.uf_total} UF</span>}
              {Number(x.pesos_visitas) > 0 && <span style={{ color: '#B42318' }}> · {pesos(x.pesos_visitas)}</span>}
            </div>
            {abierta === x.patente && (
              <div style={{ marginTop: 10 }}>
                {faltas.length > 0 && <>
                  <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>Incumplimientos</div>
                  {faltas.map((f, i) => (
                    <div key={i} style={{ fontSize: 13, padding: '4px 0', borderTop: '1px solid #eee' }}>
                      <b>{fecha(f.fecha)}</b> · {FALTAS[f.falta] || `Falta ${f.falta}`} · {f.detalle}
                      <span style={{ color: '#B42318', marginLeft: 6 }}>{f.uf !== null ? `${f.uf} UF` : f.monto !== null ? pesos(f.monto) : ''}</span>
                    </div>
                  ))}
                </>}
                <div style={{ fontWeight: 700, fontSize: 13, margin: '10px 0 4px' }}>Nota Geotab por día</div>
                {dias.length === 0 ? <div style={{ fontSize: 13, color: '#888' }}>Sin días con actividad.</div> : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ borderCollapse: 'collapse', fontSize: 12.5, minWidth: 460 }}>
                      <thead><tr style={{ color: '#545454', textAlign: 'left' }}>{['Día', 'Nota', 'Km', 'Aceleración', 'Frenado', 'Giro', 'Exceso > 8 %', 'Sin cinturón'].map((h) => <th key={h} style={{ padding: '3px 8px' }}>{h}</th>)}</tr></thead>
                      <tbody>{dias.map((r) => (
                        <tr key={r.fecha} style={{ borderTop: '1px solid #eee' }}>
                          <td style={{ padding: '3px 8px' }}>{fecha(r.fecha)}</td>
                          <td style={{ padding: '3px 8px', fontWeight: 700, color: Number(r.puntaje) < 90 ? '#B42318' : '#1A7A3C' }}>{r.puntaje}</td>
                          <td style={{ padding: '3px 8px' }}>{Math.round(Number(r.km || 0))}</td>
                          <td style={{ padding: '3px 8px' }}>{r.aceleracion}</td><td style={{ padding: '3px 8px' }}>{r.frenado}</td><td style={{ padding: '3px 8px' }}>{r.giro}</td>
                          <td style={{ padding: '3px 8px' }}>{r.exceso}</td><td style={{ padding: '3px 8px' }}>{r.cinturon}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
