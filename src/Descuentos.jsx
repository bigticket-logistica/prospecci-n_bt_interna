// ═══════════════════════════════════════════════════════════════════════════
// Descuentos.jsx — Todo lo que se le descuenta al tercero, con su detalle.
//
// Empieza por los PNR, que nacen en la Torre de Posventa. Un PNR no es un
// descuento hasta que MELI lo resuelve: se muestran los tres momentos por
// separado para que el tercero no sume plata que quizá nunca se le cobre.
//
//   · En curso   — todavía se puede ganar. Es plata en riesgo, no un cargo.
//   · Se cobra   — MELI lo resolvió en contra. Entra o entró a su prefactura.
//   · No se cobra— MELI lo anuló. No le cuesta nada.
//
// Cada caso abre su historial de avisos al conductor y al supervisor, el mismo
// que ve la Torre: así el tercero puede ver por sí mismo si se le avisó a
// tiempo, en vez de preguntarlo.
//
// Mermas, robos y No show se suman después; por eso la pantalla ya viene
// dividida por origen del descuento.
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from './supabaseClient'
import { esMovil } from './ArmazonMovil'

// Los ocho estados de MELI, con el nombre que usa la Torre y lo que significan
// para el tercero. Si MELI inventa uno nuevo, cae en el último caso y se
// muestra tal cual en vez de desaparecer.
const ESTADOS = {
  WAITING_RECEIPT:  { t: 'Esperando comprobante', d: 'El conductor todavía puede responder con la evidencia de entrega.' },
  TO_BILL:          { t: 'Con penalidad', d: 'MELI lo marcó con probabilidad de pasar a cobro. Todavía se puede responder.' },
  UPLOADED_RECEIPT: { t: 'Comprobante cargado', d: 'La respuesta se envió a MELI. Falta que la revise.' },
  ASSIGNED:         { t: 'Pendiente de revisión', d: 'MELI todavía no lo revisa.' },
  ON_REVIEW:        { t: 'En revisión', d: 'MELI lo está revisando.' },
  WITHOUT_RECEIPT:  { t: 'Sin comprobante', d: 'Nadie respondió dentro del plazo, así que el paquete se cobra.' },
  NOT_BILLED:       { t: 'Anulado', d: 'MELI cerró el reclamo. No se te cobra.' },
  BILLED:           { t: 'Enviado a facturación', d: 'MELI lo pasó a cobro. Se descuenta en tu prefactura.' },
}
const nombreEstado = (k) => (ESTADOS[k] || { t: k || 'Sin estado', d: '' })

// Acá solo va lo que ya se cobró. Lo que todavía está en juego vive en
// Reclamos, dentro de Mi operación: mezclarlos hacía que el tercero sumara
// plata que quizá nunca se le descuente.
const COLOR_COBRO = 'var(--red)'

const AVISO = {
  'aviso inicial': 'Primer aviso',
  'recordatorio': 'Recordatorio',
  'alerta 3 horas': 'Últimas 3 horas',
}
const ENTREGA = { entregado: 'entregado', enviado: 'enviado', fallido: 'no llegó' }

const pesos = (n) => '$' + Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const dia = (v) => { if (!v) return '—'; const d = new Date(String(v).length <= 10 ? v + 'T12:00:00' : v); return `${d.getDate()} ${MESES[d.getMonth()]}` }
const diaHora = (v) => { if (!v) return '—'; const d = new Date(v); return `${d.getDate()} ${MESES[d.getMonth()]} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` }

export default function Descuentos({ tercero, onBack, onIr }) {
  const [casos, setCasos] = useState(null)
  const [abierto, setAbierto] = useState(null)
  const [avisos, setAvisos] = useState({})
  const [otros, setOtros] = useState(null)      // mermas, robos y No show
  const [abiertoOtro, setAbiertoOtro] = useState(null)
  const [error, setError] = useState('')

  const cargar = useCallback(async () => {
    if (!tercero?.tercero_id) return
    const { data, error } = await supabase.from('vw_portal_pnr')
      .select('*').eq('resultado', 'se_cobra').order('fecha_caso', { ascending: false }).limit(500)
    if (error) { setError('No se pudieron cargar tus descuentos. Vuelve a intentarlo en un momento.'); setCasos([]); return }
    setCasos(data || [])
    const { data: o } = await supabase.from('vw_portal_mis_descuentos')
      .select('*').order('fecha', { ascending: false }).limit(500)
    setOtros(o || [])
  }, [tercero])

  useEffect(() => { cargar() }, [cargar])

  const abrir = async (c) => {
    const id = c.case_id
    setAbierto(abierto === id ? null : id)
    if (abierto === id || avisos[id]) return
    const { data } = await supabase.from('vw_portal_pnr_avisos')
      .select('tipo, destino, creado_en, horas_restantes, estado_entrega')
      .eq('case_id', id).order('creado_en')
    setAvisos(p => ({ ...p, [id]: data || [] }))
  }

  // Lo que se le descontó, por origen. En el teléfono va arriba como una sola
  // cifra grande; en el computador cada bloque ya trae su propio total.
  const suma = (xs) => (xs || []).reduce((t, x) => t + Number(x.monto || 0), 0)
  const deOrigen = (o) => (otros || []).filter(f => f.origen === o && !f.devuelto)
  const tPnr = suma(casos), tMerma = suma(deOrigen('merma')), tNoshow = suma(deOrigen('noshow'))
  const movil = esMovil()

  return (
    <div className="dx-pantalla" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <a href="#" className="bt-volver" onClick={e => { e.preventDefault(); onBack() }}>← Volver</a>

      <div className="bm-solo-escritorio" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <h1 className="bt-titulo">Descuentos</h1>
        <p style={{ fontSize: 14, color: 'var(--muted)', margin: 0, maxWidth: 720, lineHeight: 1.5 }}>
          Todo lo que se te descuenta, con su detalle y su estado. Cada tipo de descuento tiene su
          propio origen y sus propias reglas.
        </p>
      </div>

      {error && <div className="dx-error">{error}</div>}

      {movil && casos !== null && otros !== null && (
        <div className="bm-hero">
          <div className="bm-rotulo">TOTAL DESCONTADO</div>
          <div className="bm-monto">{pesos(tPnr + tMerma + tNoshow)}</div>
          <div className="bm-fecha">Lo que ya entró a tus prefacturas. Lo que sigue en juego está en Reclamos.</div>
          <div className="bm-celdas tres">
            <div><b>{pesos(tPnr)}</b><span>PNR · {(casos || []).length}</span></div>
            <div><b>{pesos(tMerma)}</b><span>Perdidos · {deOrigen('merma').length}</span></div>
            <div><b>{pesos(tNoshow)}</b><span>No show · {deOrigen('noshow').length}</span></div>
          </div>
        </div>
      )}

      {/* Un bloque por origen del descuento. Hoy solo PNR; mermas, robos y
          No show se suman como bloques nuevos, cada uno con su explicación. */}
      <div className="dx-origen">
        <h2>Paquetes no recibidos (PNR)</h2>
      </div>

      {casos === null ? (
        <div className="bt-vacio"><h3>Cargando…</h3></div>
      ) : casos.length === 0 ? (
        <div className="bt-vacio">
          <h3>Sin descuentos por PNR</h3>
          <p>No tienes paquetes cobrados en este período.</p>
        </div>
      ) : (
        <>
          <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>
            {casos.length} {casos.length === 1 ? 'descuento' : 'descuentos'} ·{' '}
            {pesos(casos.reduce((t, c) => t + Number(c.monto || 0), 0))} en total
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {casos.map(c => {
              const e = nombreEstado(c.sub_estado)
              const open = abierto === c.case_id
              return (
                <div key={c.case_id} className="dx-card" style={{ borderLeftColor: COLOR_COBRO }}>
                  <button className="dx-head" onClick={() => abrir(c)}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div className="dx-titulo">
                        {e.t}
                        {c.cobro_id && <span className="dx-pill rojo">Cobrado semana {c.semana_cobro}</span>}
                      </div>
                      <div className="dx-sub">
                        Guía {c.guia || '—'} · {c.sc} · ruta {c.ruta || c.id_ruta || '—'} del {dia(c.fecha_ruta)}
                        {c.placa ? ` · ${c.placa}` : ''}
                      </div>
                    </div>
                    <div className="dx-monto">{pesos(c.monto)}</div>
                    <span className="dx-chev">{open ? '▲' : '▼'}</span>
                  </button>

                  {open && (
                    <div className="dx-detalle">
                      <p className="dx-que-pasa">{e.d}</p>
                      <div className="dx-datos">
                        <Dato k="Caso" v={c.case_id} />
                        <Dato k="Guía" v={c.guia} />
                        <Dato k="Conductor" v={c.conductor} />
                        <Dato k="Placa" v={c.placa} />
                        <Dato k="Centro" v={c.sc} />
                        <Dato k="Ruta" v={c.ruta || c.id_ruta} />
                        <Dato k="Fecha de la ruta" v={dia(c.fecha_ruta)} />
                        <Dato k="Reclamo abierto" v={diaHora(c.fecha_caso)} />
                        <Dato k="Valor del paquete" v={pesos(c.monto)} />
                        {c.comprobante_en && <Dato k="Comprobante cargado" v={diaHora(c.comprobante_en)} />}
                        {c.cobro_id && <Dato k="Se te cobró en" v={`semana ${c.semana_cobro}`} />}
                      </div>

                      <div className="dx-avisos">
                        <div className="dx-avisos-t">
                          Avisos enviados {c.n_avisos > 0 ? `(${c.n_avisos})` : ''}
                        </div>
                        {avisos[c.case_id] === undefined ? (
                          <p className="dx-vacio-txt">Cargando…</p>
                        ) : avisos[c.case_id].length === 0 ? (
                          <p className="dx-vacio-txt">
                            No se enviaron avisos por este caso. Si crees que debió avisarse, escríbenos.
                          </p>
                        ) : (
                          <ul className="dx-linea">
                            {avisos[c.case_id].map((a, i) => (
                              <li key={i}>
                                <span className="dx-linea-f">{diaHora(a.creado_en)}</span>
                                <span className="dx-linea-t">
                                  {AVISO[a.tipo] || a.tipo} al {a.destino === 'conductor' ? 'conductor' : 'supervisor'}
                                  {a.horas_restantes != null ? ` · quedaban ${a.horas_restantes} h` : ''}
                                </span>
                                <span className={`dx-linea-e${a.estado_entrega === 'fallido' ? ' malo' : ''}`}>
                                  {ENTREGA[a.estado_entrega] || a.estado_entrega || ''}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      <p className="dx-nota">
                        Los cobros por PNR no admiten reclamo: MELI rechaza los respaldos una vez que
                        el caso pasó a facturación.
                      </p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}

      <Otros titulo="Paquetes perdidos y robos" origen="merma" filas={otros}
        abierto={abiertoOtro} setAbierto={setAbiertoOtro} onIr={onIr}
        vacio="No tienes paquetes perdidos ni robos cobrados en este período." />

      <Otros titulo="No show" origen="noshow" filas={otros}
        abierto={abiertoOtro} setAbierto={setAbiertoOtro} onIr={onIr}
        vacio="No tienes No show cobrados en este período." />
    </div>
  )
}

// Mermas, robos y No show. No tienen estados intermedios: nacen ya cobrados,
// así que van como lista simple, sin las pestañas de los PNR. A diferencia de
// los PNR, estos sí se pueden reclamar.
function Otros({ titulo, origen, filas, abierto, setAbierto, onIr, vacio }) {
  const lista = (filas || []).filter(f => f.origen === origen)
  const total = lista.reduce((t, f) => t + Number(f.monto || 0), 0)
  const clave = (f) => `${f.origen}:${f.id}`
  return (
    <>
      <div className="dx-origen">
        <h2>{titulo}</h2>
      </div>

      {filas === null ? (
        <div className="bt-vacio"><h3>Cargando…</h3></div>
      ) : lista.length === 0 ? (
        <div className="bt-vacio"><h3>Sin descuentos</h3><p>{vacio}</p></div>
      ) : (
        <>
          <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>
            {lista.length} {lista.length === 1 ? 'descuento' : 'descuentos'} · {pesos(total)} en total
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {lista.map(f => {
              const open = abierto === clave(f)
              return (
                <div key={clave(f)} className="dx-card"
                  style={{ borderLeftColor: f.devuelto ? 'var(--green)' : 'var(--red)' }}>
                  <button className="dx-head" onClick={() => setAbierto(open ? null : clave(f))}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div className="dx-titulo">
                        {origen === 'noshow' ? 'No show' : (f.motivo || 'Paquete perdido')}
                        {f.devuelto && <span className="dx-pill verde">Devuelto</span>}
                        {f.semana && <span className="dx-pill gris">Semana {f.semana}</span>}
                      </div>
                      <div className="dx-sub">
                        {f.guia ? `Guía ${f.guia} · ` : ''}{f.sc || '—'}
                        {f.placa ? ` · ${f.placa}` : ''} · {dia(f.fecha)}
                      </div>
                    </div>
                    <div className="dx-monto" style={{ color: f.devuelto ? 'var(--green)' : 'var(--ink)' }}>
                      {pesos(f.monto)}
                    </div>
                    <span className="dx-chev">{open ? '▲' : '▼'}</span>
                  </button>

                  {open && (
                    <div className="dx-detalle">
                      <div className="dx-datos">
                        <Dato k={origen === 'noshow' ? 'Día' : 'Fecha del hecho'} v={dia(f.fecha)} />
                        <Dato k="Guía" v={f.guia} />
                        <Dato k="Ruta" v={f.id_ruta} />
                        <Dato k="Placa" v={f.placa} />
                        <Dato k="Conductor" v={f.conductor} />
                        <Dato k="Centro" v={f.sc} />
                        <Dato k="Motivo" v={f.motivo} />
                        <Dato k="Justificación" v={f.justificacion} />
                        <Dato k="Monto" v={pesos(f.monto)} />
                        <Dato k="Cobrado en" v={f.semana ? `semana ${f.semana}` : null} />
                        <Dato k="Fecha de cobro" v={f.fecha_cobro ? dia(f.fecha_cobro) : null} />
                        <Dato k="Cargado por" v={f.asignado_por} />
                      </div>

                      {f.devuelto ? (
                        <p className="dx-nota">
                          Este cobro se te devolvió. Búscalo en Movimientos, en la semana en que
                          aparece el abono.
                        </p>
                      ) : (
                        <div className="dx-hacer">
                          <div className="dx-hacer-t">¿No estás de acuerdo con este descuento?</div>
                          <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.5 }}>
                            A diferencia de los PNR, este cobro sí se puede reclamar. Ve a Movimientos,
                            marca la línea de este descuento y cuéntanos qué pasó. Tienes dos semanas
                            desde que apareció en tu portal.
                          </p>
                          {onIr && (
                            <button className="dx-btn" onClick={() => onIr('movimientos')}>
                              Ir a Movimientos
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </>
  )
}

function Dato({ k, v }) {
  if (v === null || v === undefined || v === '') return null
  return (
    <div className="dx-dato">
      <span className="dx-dato-k">{k}</span>
      <span className="dx-dato-v">{v}</span>
    </div>
  )
}
