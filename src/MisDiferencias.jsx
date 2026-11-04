// ═══════════════════════════════════════════════════════════════════════════
// MisDiferencias.jsx — Mi billetera › Mis diferencias.
//
// Todos los reclamos del tercero en una sola lista (no por semana, como en
// Movimientos): estado, quién lo tiene si sigue en curso, el resultado de cada
// línea y el historial completo (fn_portal_historial_diferencia).
// Se levantan desde Movimientos; aquí solo se siguen.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useMemo, useState } from 'react'
import { supabase } from './supabaseClient'
import { esMovil } from './ArmazonMovil'
import { HistorialDiferencia, EST_DIF } from './Movimientos'

const money = (n) => '$' + Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const dia = (v) => { if (!v) return '—'; const d = new Date(String(v).length <= 10 ? v + 'T12:00:00' : v); return `${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()}` }
const TIPO = { ruta: 'Ruta', cobro: 'Cobro', faltante: 'Ruta que falta', concepto: 'Falta' }

const enCurso = (d) => !['aceptada', 'parcial', 'rechazada', 'retirada', 'vencida'].includes(d.estado) && d.fase !== 'cerrada'

// Quién tiene el reclamo ahora
function quienLaTiene(d) {
  if (d.estado === 'retirada') return { t: 'La retiraste', c: 'var(--muted)' }
  if (!enCurso(d)) return { t: `Resuelta el ${dia(d.resuelta_at)}`, c: 'var(--muted)' }
  if (d.fase === 'supervisor') return { t: 'La tiene el supervisor del SC: valida lo que pasó en el patio. Si no responde a tiempo, pasa sola al analista.', c: 'var(--amber)' }
  return { t: 'La tiene el analista de BigTicket: está revisando cada línea para darte una respuesta.', c: '#1e40af' }
}

export default function MisDiferencias({ tercero, onBack }) {
  const movil = esMovil()
  const [lista, setLista] = useState(null)
  const [error, setError] = useState(null)
  const [filtro, setFiltro] = useState('todas')
  const [abierta, setAbierta] = useState(null)

  useEffect(() => {
    if (!tercero?.tercero_id) return
    supabase.from('diferencias').select('*, diferencias_lineas(*)').eq('tercero_id', tercero.tercero_id)
      .order('creada_at', { ascending: false })
      .then(({ data, error: e }) => { if (e) setError('No pudimos cargar tus diferencias: ' + e.message); setLista(data || []) })
  }, [tercero])

  const cuenta = useMemo(() => {
    const l = lista || []
    return {
      todas: l.length,
      curso: l.filter(enCurso).length,
      cerradas: l.filter(d => !enCurso(d)).length,
      reconocido: l.reduce((t, d) => t + Number(d.monto_reconocido || 0), 0),
    }
  }, [lista])
  const visibles = (lista || []).filter(d => filtro === 'todas' ? true : filtro === 'curso' ? enCurso(d) : !enCurso(d))

  const chip = (k, t, n) => (
    <button key={k} onClick={() => setFiltro(k)} aria-pressed={filtro === k}
      style={{ border: `1px solid ${filtro === k ? 'var(--navy)' : 'var(--line)'}`, background: filtro === k ? 'var(--navy)' : 'var(--card)',
        color: filtro === k ? '#fff' : 'var(--muted)', borderRadius: 20, padding: '7px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
      {t} · {n}
    </button>
  )

  return (
    <div className="dx-pantalla" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <a href="#" className="bt-volver" onClick={e => { e.preventDefault(); onBack() }}>← Volver</a>

      <div className="bm-solo-escritorio" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <h1 className="bt-titulo">Mis diferencias</h1>
        <p style={{ fontSize: 14, color: 'var(--muted)', margin: 0, maxWidth: 720, lineHeight: 1.5 }}>
          Todos tus reclamos de pagos y descuentos, en qué van y todo lo que pasó con cada uno. Para levantar uno
          nuevo, entra a Movimientos y toca la ruta o el cobro que no te cuadra.
        </p>
      </div>

      {error && <div className="dx-error">{error}</div>}

      {movil && lista !== null && (
        <div className="bm-hero">
          <div className="bm-rotulo">MIS DIFERENCIAS</div>
          <div className="bm-monto">{money(cuenta.reconocido)}</div>
          <div className="bm-fecha">Reconocido a tu favor en tus reclamos.</div>
          <div className="bm-celdas tres">
            <div><b>{cuenta.todas}</b><span>Levantadas</span></div>
            <div><b>{cuenta.curso}</b><span>En curso</span></div>
            <div><b>{cuenta.cerradas}</b><span>Resueltas</span></div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {chip('todas', 'Todas', cuenta.todas)}
        {chip('curso', 'En curso', cuenta.curso)}
        {chip('cerradas', 'Resueltas', cuenta.cerradas)}
      </div>

      {lista === null ? (
        <div className="bt-vacio"><h3>Cargando…</h3></div>
      ) : visibles.length === 0 ? (
        <div className="bt-vacio">
          <h3>{filtro === 'curso' ? 'No tienes reclamos en curso' : 'Todavía no tienes diferencias'}</h3>
          <p>Si algo de un pago o un descuento no te cuadra, levántalo desde Movimientos.</p>
        </div>
      ) : (
        <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14, overflow: 'hidden' }}>
          {visibles.map(d => {
            const e = EST_DIF[d.estado] || EST_DIF.abierta
            const q = quienLaTiene(d)
            const ab = abierta === d.id
            const lineas = d.diferencias_lineas || []
            return (
              <div key={d.id} style={{ borderBottom: '1px solid #f1f4f8' }}>
                <button onClick={() => setAbierta(ab ? null : d.id)}
                  style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', padding: '14px 18px', cursor: 'pointer', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, color: 'var(--navy)', fontSize: 14.5 }}>Diferencia #{d.folio}</span>
                      {d.service_center && <span style={{ fontSize: 12, color: 'var(--muted)' }}>· {d.service_center}</span>}
                      <span style={{ background: e.bg, color: e.fg, borderRadius: 999, padding: '2px 9px', fontSize: 11, fontWeight: 700 }}>{e.l.toUpperCase()}</span>
                    </div>
                    <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 3 }}>
                      {lineas.length} línea(s) · levantada el {dia(d.creada_at)}
                      {Number(d.monto_reconocido) ? ` · ${money(d.monto_reconocido)} reconocido` : ''}
                    </div>
                    <div style={{ fontSize: 12.5, color: q.c, marginTop: 4, fontWeight: 600 }}>{q.t}</div>
                  </div>
                  <span style={{ color: 'var(--muted)', fontSize: 13 }}>{ab ? '▴' : '▾'}</span>
                </button>

                {ab && (
                  <div style={{ padding: '0 18px 14px' }}>
                    {lineas.map(l => (
                      <div key={l.id} style={{ background: 'var(--page)', borderRadius: 8, padding: '10px 12px', marginBottom: 6, fontSize: 12.5 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 600 }}>
                            {TIPO[l.tipo] || 'Línea'}{l.tipo === 'concepto' && l.concepto ? `: ${l.concepto}` : ''}{l.placa ? ` · ${l.placa}` : ''}{l.id_ruta ? ` · ${l.id_ruta}` : ''}{l.tipo === 'concepto' && l.monto_ref ? ` · ${money(l.monto_ref)}` : ''}
                          </span>
                          <span style={{ color: 'var(--muted)' }}>{l.fecha || ''}</span>
                        </div>
                        {l.comentario && <div style={{ color: 'var(--muted)', marginTop: 4 }}>Reclamaste: {l.comentario}</div>}
                        {l.estado && l.estado !== 'pendiente' ? (
                          <div style={{ marginTop: 6, color: l.estado === 'aceptada' ? 'var(--green)' : 'var(--red)' }}>
                            <b>{l.estado === 'aceptada' ? 'Aceptada' : 'Rechazada'}{l.monto_reconocido ? ` · ${money(l.monto_reconocido)}` : ''}:</b> {l.resolucion}
                          </div>
                        ) : <div style={{ marginTop: 6, color: 'var(--amber)' }}>Todavía sin respuesta.</div>}
                      </div>
                    ))}
                    <HistorialDiferencia difId={d.id} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
