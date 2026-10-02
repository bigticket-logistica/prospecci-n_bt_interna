// ═══════════════════════════════════════════════════════════════════════════
// Reclamos.jsx — Lo que todavía está en juego.
//
// Acá vive la plata que se puede perder pero que nadie ha cobrado: los PNR que
// MELI sigue revisando y los paquetes que deben volver al centro. Lo ya
// cobrado está en Descuentos; separarlos evita que el tercero sume plata que
// quizá nunca se le descuente.
//
// Cada caso dice quién tiene que mover ahora y cuánto plazo queda, porque la
// mayoría todavía se puede ganar respondiendo a tiempo.
// ═══════════════════════════════════════════════════════════════════════════
import { Fragment, useCallback, useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

const ESTADOS = {
  WAITING_RECEIPT:  { t: 'Esperando comprobante', d: 'El conductor todavía puede responder con la evidencia de entrega.' },
  TO_BILL:          { t: 'Con penalidad', d: 'MELI lo marcó con probabilidad de pasar a cobro. Todavía se puede responder.' },
  UPLOADED_RECEIPT: { t: 'Comprobante cargado', d: 'La respuesta se envió a MELI. Falta que la revise.' },
  ASSIGNED:         { t: 'Pendiente de revisión', d: 'MELI todavía no lo revisa.' },
  ON_REVIEW:        { t: 'En revisión', d: 'MELI lo está revisando.' },
}
const nombreEstado = (k) => (ESTADOS[k] || { t: k || 'Sin estado', d: '' })

const AVISO = { 'aviso inicial': 'Primer aviso', 'recordatorio': 'Recordatorio', 'alerta 3 horas': 'Últimas 3 horas' }
const ENTREGA = { entregado: 'entregado', enviado: 'enviado', fallido: 'no llegó' }

// El monto va sin decimales en la tabla y completo en el detalle.
const pesosEnteros = (n) => '$' + Math.round(Number(n || 0)).toLocaleString('es-MX')
const corto = (n) => { const p = String(n || '').trim().split(/\s+/); return p.length > 1 ? `${p[0]} ${p[1][0]}.` : (p[0] || '—') }
const pesos = (n) => '$' + Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const dia = (v) => { if (!v) return '—'; const d = new Date(String(v).length <= 10 ? v + 'T12:00:00' : v); return `${d.getDate()} ${MESES[d.getMonth()]}` }
const diaHora = (v) => { if (!v) return '—'; const d = new Date(v); return `${d.getDate()} ${MESES[d.getMonth()]} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` }

// Lo que MELI informa de cada paquete, en palabras que el tercero entienda.
// Parte viene en portugués desde el origen; se traduce acá, no en la base.
const MOTIVO = {
  'No había nadie en el domicilio': 'Nadie recibió en el domicilio',
  'Faltam dados do endereço': 'Faltaban datos de la dirección',
  'O pacote foi recusado': 'El comprador rechazó el paquete',
  'Palabra clave incorrecta.': 'La clave de entrega no coincidió',
  'El comprador cambió de dirección': 'El comprador cambió de dirección',
  'Negocio cerrado': 'El negocio estaba cerrado',
  'Está en una zona inaccesible': 'Zona inaccesible',
  'El paquete está dañado': 'El paquete venía dañado',
}
const motivoDe = (t) => MOTIVO[t] || t || 'Sin motivo informado'

export default function Reclamos({ tercero, onIr }) {
  const [casos, setCasos] = useState(null)
  const [devs, setDevs] = useState(null)
  const [diaAbierto, setDiaAbierto] = useState(null)
  const [abierto, setAbierto] = useState(null)
  const [avisos, setAvisos] = useState({})
  const [error, setError] = useState('')

  const cargar = useCallback(async () => {
    if (!tercero?.tercero_id) return
    const { data, error } = await supabase.from('vw_portal_pnr')
      .select('*').eq('resultado', 'en_curso').order('fecha_caso', { ascending: false }).limit(300)
    if (error) { setError('No pudimos cargar tus reclamos. Vuelve a intentarlo en un momento.'); setCasos([]); return }
    setCasos(data || [])
    const d = await supabase.from('vw_portal_devolucion')
      .select('*').order('dia', { ascending: false }).limit(500)
    setDevs(d.data || [])
  }, [tercero])

  useEffect(() => { cargar() }, [cargar])

  const abrir = async (c) => {
    const id = c.case_id
    setAbierto(abierto === id ? null : id)
    // Queda marcado como visto para que el número del menú deje de contarlo.
    // Se guarda en el navegador: es una señal de lectura, no un dato del caso.
    try {
      const v = JSON.parse(localStorage.getItem('bt_reclamos_vistos') || '[]')
      if (!v.includes(id)) localStorage.setItem('bt_reclamos_vistos', JSON.stringify([...v, id].slice(-300)))
    } catch { /* sin storage: el número sigue contándolo */ }
    if (abierto === id || avisos[id]) return
    const { data } = await supabase.from('vw_portal_pnr_avisos')
      .select('tipo, destino, creado_en, horas_restantes, estado_entrega')
      .eq('case_id', id).order('creado_en')
    setAvisos(p => ({ ...p, [id]: data || [] }))
  }

  const lista = casos || []
  const total = lista.reduce((t, c) => t + Number(c.monto || 0), 0)
  const tuyos = lista.filter(c => c.le_toca_a === 'tercero')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <nav className="ms-ruta">
        <a href="#" onClick={e => { e.preventDefault(); onIr && onIr('home') }}>Inicio</a>
        <span>›</span><span>Mi operación</span>
        <span>›</span><span className="on">Reclamos</span>
      </nav>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <h1 className="bt-titulo">Reclamos</h1>
        <p style={{ fontSize: 14, color: 'var(--muted)', margin: 0, maxWidth: 720, lineHeight: 1.5 }}>
          Los casos abiertos que todavía se pueden ganar. Nada de esto se te ha cobrado: lo que ya
          se descontó está en Mi billetera, en Descuentos.
        </p>
      </div>

      {error && <div className="dx-error">{error}</div>}

      {/* Indicador urgente: el mismo del inicio pero sin navegación, porque
          ya estamos en la pantalla a la que llevaría. */}
      {lista.length > 0 && (
        <div className="rc-top">
          <article className="rc-urgente">
            <header className="nt-head">
              <span className="nt-tag urgente">URGENTE</span>
              <span className="nt-resumen">{pesos(total)} Riesgo de cobro</span>
            </header>
            <div className="nt-kpi" style={{ cursor: 'default' }}>
              <span className="nt-num">{lista.length}</span>
              <span className="nt-label">{lista.length === 1 ? 'Reclamo' : 'Reclamos'}</span>
            </div>
          </article>
          <p className="rc-aviso">
            <b>Evita el descuento.</b> Gestiona sin perder el plazo.
          </p>
        </div>
      )}

      <div className="dx-origen">
        <h2>Paquetes no recibidos (PNR)</h2>
      </div>

      {casos === null ? (
        <div className="bt-vacio"><h3>Cargando…</h3></div>
      ) : lista.length === 0 ? (
        <div className="bt-vacio">
          <h3>No tienes reclamos abiertos</h3>
          <p>Cuando MELI reclame un paquete de tus rutas, lo vas a ver aquí mientras se resuelve.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {lista.map(c => {
            const e = nombreEstado(c.sub_estado)
            const open = abierto === c.case_id
            return (
              <article key={c.case_id} className="rc-caso">
                <header className="rc-caso-head">
                  <span className="rc-tipo">Post venta</span>
                  <span className="rc-caso-id">Caso: {c.case_id}</span>
                  <span className="rc-caso-estado">{e.t}</span>
                </header>

                <div className="rc-tabla-wrap">
                  <div className="rc-grid">
                    {['F. Reclamo', 'Operación', 'Patente', 'Conductor', 'Ruta', 'Paquete',
                      'Vence en', 'En riesgo', ''].map((t, i) => (
                      <div key={i} className="rc-th">{t}</div>
                    ))}

                    <div className="rc-td">{dia(c.fecha_caso)}</div>
                    <div className="rc-td">{c.sc || '—'}</div>
                    <div className="rc-td">{c.placa || '—'}</div>
                    <div className="rc-td">{corto(c.conductor)}</div>
                    <div className="rc-td">{c.ruta || c.id_ruta || '—'}</div>
                    <div className="rc-td">{c.guia || '—'}</div>
                    <div className="rc-td">
                      {c.le_toca_a === 'tercero'
                        ? <span className={`rc-plazo${c.horas_restantes > 0 ? '' : ' vencido'}`}>
                            {c.horas_restantes > 0 ? `${c.horas_restantes} H` : 'VENCIDO'}
                          </span>
                        : <span className="rc-espera">Con MELI</span>}
                    </div>
                    <div className="rc-td"><span className="rc-monto">{pesosEnteros(c.monto)}</span></div>
                    <div className="rc-td">
                      {!open && (
                        <button className="rc-ver" onClick={() => abrir(c)}>Ver detalle ▾</button>
                      )}
                    </div>
                  </div>
                </div>

                {open && (
                  <div className="rc-detalle">
                    <div className="rc-detalle-head">
                      <span>Detalle del caso</span>
                      <button className="rc-cerrar" onClick={() => setAbierto(null)} aria-label="Cerrar">▴</button>
                    </div>

                    <div className="rc-box rc-estado">
                      <span>Estado del reclamo</span>
                      <span className="rc-pill">{e.t}</span>
                    </div>

                    <div className="rc-box rc-producto">
                      <div>
                        <div className="rc-producto-t">{c.producto || `Paquete ${c.guia || '—'}`}</div>
                        <div className="rc-producto-d">
                          Guía {c.guia || '—'}
                          {c.id_seguimiento ? ` · seguimiento ${c.id_seguimiento}` : ''}
                        </div>
                        <div className="rc-producto-d">{e.d}</div>
                      </div>
                      <div className="rc-producto-v">{pesos(c.valor_compra || c.monto)}</div>
                    </div>

                    {/* Lo que alega el comprador: es contra esto que el tercero
                        tiene que responder, así que va textual. */}
                    {c.mensaje_reclamo && (
                      <div className="rc-box">
                        <div className="rc-avisos-t">Lo que dice el comprador</div>
                        <p className="rc-reclamo">{c.mensaje_reclamo}</p>
                      </div>
                    )}

                    {(c.recibio_nombre || c.estado_texto || c.entregado_en) && (
                      <div className="rc-box">
                        <div className="rc-avisos-t">Lo que registró la entrega</div>
                        <div className="dx-datos">
                          <Dato k="Quién recibió" v={c.recibio_nombre} />
                          <Dato k="En calidad de" v={c.recibio_quien} />
                          <Dato k="Estado en MELI" v={c.estado_texto} />
                          <Dato k="Entregado el" v={c.entregado_en ? diaHora(c.entregado_en) : null} />
                        </div>
                      </div>
                    )}

                    <div className="rc-box">
                      <div className="rc-avisos-t">Detalle de avisos</div>
                      {avisos[c.case_id] === undefined ? (
                        <p className="dx-vacio-txt">Cargando…</p>
                      ) : avisos[c.case_id].filter(a => a.destino === 'conductor').length === 0 ? (
                        <p className="dx-vacio-txt">No se enviaron avisos al conductor por este caso.</p>
                      ) : (
                        <div className="rc-avisos">
                          {['Descripción', 'Canal', 'Fecha', 'Hora', 'Plazo'].map(t => (
                            <div key={t} className="rc-avisos-th">{t}</div>
                          ))}
                          {avisos[c.case_id].filter(a => a.destino === 'conductor').map((a, i) => {
                            const f = new Date(a.creado_en)
                            return (
                              <Fragment key={i}>
                                <div>{AVISO[a.tipo] || a.tipo}</div>
                                <div>WhatsApp</div>
                                <div>{dia(a.creado_en)}</div>
                                <div>{String(f.getHours()).padStart(2, '0')}:{String(f.getMinutes()).padStart(2, '0')}</div>
                                <div className="rc-avisos-plazo">
                                  {a.horas_restantes != null ? `${a.horas_restantes} H` : '—'}
                                </div>
                              </Fragment>
                            )
                          })}
                        </div>
                      )}
                      {c.comprobante_en && (
                        <p className="rc-respuesta">
                          Recibimos tu respuesta el {diaHora(c.comprobante_en)}. MELI la está revisando.
                        </p>
                      )}
                    </div>

                    {c.le_toca_a === 'tercero' && <QueHacer c={c} />}
                  </div>
                )}
              </article>
            )
          })}
        </div>
      )}

      <div className="dx-origen">
        <h2>Paquetes pendientes de devolver</h2>
      </div>

      <Devoluciones filas={devs} abierto={diaAbierto} setAbierto={setDiaAbierto} />
    </div>
  )
}

// Paquetes que salieron a ruta, no se entregaron y todavía no vuelven al
// centro. Van agrupados por día y placa: una empresa grande puede tener cien,
// y una lista plana de cien guías no se lee.
function Devoluciones({ filas, abierto, setAbierto }) {
  if (filas === null) return <div className="bt-vacio"><h3>Cargando…</h3></div>

  // Solo se listan los que el tercero puede resolver. Los que MELI dejó de
  // dejarnos consultar van aparte, en una línea: son plata incierta que no
  // depende de él, y mezclarlos sepultaba los que sí puede devolver.
  const pendientes = filas.filter(f => f.estado === 'pendiente' || f.estado === 'sleepover')
  const sinAcceso = filas.filter(f => f.estado === 'sin_acceso')

  if (!pendientes.length) {
    return (
      <>
        <div className="bt-vacio">
          <h3>No tienes paquetes pendientes</h3>
          <p>Todo lo que salió a ruta en los últimos tres días volvió al centro o se entregó.</p>
        </div>
        <SinAcceso n={sinAcceso.length} />
      </>
    )
  }

  const porDia = {}
  for (const f of pendientes) {
    if (!porDia[f.dia]) porDia[f.dia] = {}
    const k = `${f.placa || 'sin placa'}|${f.sc || ''}|${f.conductor || ''}`
    ;(porDia[f.dia][k] = porDia[f.dia][k] || []).push(f)
  }
  const dias = Object.keys(porDia).sort().reverse()

  return (
    <>
      <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>
        {pendientes.length} {pendientes.length === 1 ? 'paquete' : 'paquetes'} de los últimos tres
        días. Si no vuelven al centro, MELI puede cobrarlos como paquete perdido.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {dias.map(d => {
          const grupos = porDia[d]
          const n = Object.values(grupos).reduce((t, g) => t + g.length, 0)
          const open = abierto === d
          return (
            <div key={d} className="dx-card" style={{ borderLeftColor: 'var(--amber)' }}>
              <button className="dx-head" onClick={() => setAbierto(open ? null : d)}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="dx-titulo">Ruta del {dia(d)}</div>
                  <div className="dx-sub">
                    {n} {n === 1 ? 'paquete' : 'paquetes'} en {Object.keys(grupos).length}{' '}
                    {Object.keys(grupos).length === 1 ? 'unidad' : 'unidades'}
                  </div>
                </div>
                <span className="dx-chev">{open ? '▲' : '▼'}</span>
              </button>

              {open && (
                <div className="dx-detalle">
                  {Object.entries(grupos).map(([k, items]) => {
                    const [placa, sc, conductor] = k.split('|')
                    return (
                      <div key={k} className="rc-unidad">
                        <div className="rc-unidad-t">
                          {placa} · {sc}
                          {conductor ? <span className="rc-cond"> · {conductor}</span> : null}
                          <span className="rc-n">{items.length}</span>
                        </div>
                        <ul className="rc-guias">
                          {items.map(f => (
                            <li key={f.id}>
                              <span className="rc-guia">{f.guia}</span>
                              <span className="rc-motivo">{motivoDe(f.incidente)}</span>
                              {f.estado === 'sleepover' && (
                                <span className="dx-pill amber">Sleepover</span>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )
                  })}

                  <p className="dx-nota">
                    Si alguno de estos paquetes ya volvió al centro, va a desaparecer de esta lista
                    cuando MELI lo registre. Si no lo tienes, avísale al supervisor de tu centro.
                  </p>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <SinAcceso n={sinAcceso.length} />
    </>
  )
}

// Paquetes que MELI ya no nos deja consultar. No se listan uno por uno porque
// no hay nada que el tercero pueda hacer con la guía: lo único útil es que
// sepa que existen y a quién preguntarle.
function SinAcceso({ n }) {
  if (!n) return null
  return (
    <p className="dx-nota" style={{ marginTop: 4 }}>
      Hay {n} {n === 1 ? 'paquete' : 'paquetes'} de tus rutas que MELI ya no nos deja consultar.
      Conversa con tu supervisor para ver el estado de esos paquetes. Si alguno te genera un cobro,
      lo vas a ver en Descuentos y vas a poder reclamarlo.
    </p>
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

// Lo que el tercero puede hacer mientras el caso siga abierto. Sin esto la
// pantalla solo informa: el tercero ve que van a cobrarle y no sabe que
// todavía puede evitarlo ni a quién recurrir.
function QueHacer({ c }) {
  const vencido = !(c.horas_restantes > 0)
  return (
    <div className={`dx-hacer${vencido ? ' vencido' : ''}`}>
      <div className="dx-hacer-t">
        {vencido
          ? 'El plazo venció, pero todavía vale la pena responder'
          : `Puedes evitar este cobro de ${pesos(c.monto)}`}
      </div>
      <ol className="dx-hacer-pasos">
        <li>
          Contacta a {c.conductor || 'tu conductor'}
          {c.placa ? ` (${c.placa})` : ''} y pídele la evidencia de que entregó la
          guía {c.guia || ''}: foto de la entrega, firma de quien recibió, o la captura de
          Logistic con el estado del paquete.
        </li>
        <li>
          Si le llegó el mensaje de Biggy por WhatsApp, puede responder ahí mismo con la foto.
          Es la vía más rápida.
        </li>
        <li>
          Si no le llegó o ya no lo tiene, envíale la evidencia al supervisor de {c.sc || 'tu centro'},
          que es quien la carga a MELI.
        </li>
      </ol>
      <p className="dx-hacer-nota">
        {vencido
          ? 'Si el caso todavía no está cerrado, el supervisor puede cargar la evidencia igual. Una vez que MELI lo pasa a facturación ya no hay vuelta.'
          : 'Si nadie responde antes de que venza el plazo, el paquete se cobra completo y el cargo ya no admite reclamo.'}
      </p>
    </div>
  )
}
