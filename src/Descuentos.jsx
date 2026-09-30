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

const GRUPOS = [
  { id: 'en_curso', t: 'En curso', d: 'Todavía se puede ganar. No se te ha cobrado nada.', color: 'var(--amber)' },
  { id: 'se_cobra', t: 'Se cobra', d: 'MELI los resolvió en contra. Se descuentan de tu prefactura.', color: 'var(--red)' },
  { id: 'no_se_cobra', t: 'No se cobra', d: 'MELI los anuló. No te cuestan nada.', color: 'var(--green)' },
]

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

export default function Descuentos({ tercero, onBack }) {
  const [casos, setCasos] = useState(null)
  const [abierto, setAbierto] = useState(null)
  const [avisos, setAvisos] = useState({})
  const [grupo, setGrupo] = useState('en_curso')
  const [error, setError] = useState('')

  const cargar = useCallback(async () => {
    if (!tercero?.tercero_id) return
    const { data, error } = await supabase.from('vw_portal_pnr')
      .select('*').order('fecha_caso', { ascending: false }).limit(500)
    if (error) { setError('No se pudieron cargar tus descuentos. Vuelve a intentarlo en un momento.'); setCasos([]); return }
    setCasos(data || [])
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

  const porGrupo = useMemo(() => {
    const r = { en_curso: [], se_cobra: [], no_se_cobra: [] }
    for (const c of (casos || [])) (r[c.resultado] || r.en_curso).push(c)
    return r
  }, [casos])

  const lista = porGrupo[grupo] || []
  const total = (g) => (porGrupo[g] || []).reduce((t, c) => t + Number(c.monto || 0), 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <a href="#" className="bt-volver" onClick={e => { e.preventDefault(); onBack() }}>← Volver</a>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <h1 className="bt-titulo">Descuentos</h1>
        <p style={{ fontSize: 14, color: 'var(--muted)', margin: 0, maxWidth: 720, lineHeight: 1.5 }}>
          Todo lo que se te descuenta, con su detalle y su estado. Cada tipo de descuento tiene su
          propio origen y sus propias reglas.
        </p>
      </div>

      {error && <div className="dx-error">{error}</div>}

      {/* Un bloque por origen del descuento. Hoy solo PNR; mermas, robos y
          No show se suman como bloques nuevos, cada uno con su explicación. */}
      <div className="dx-origen">
        <h2>Paquetes no recibidos (PNR)</h2>
        <p>
          Los paquetes que Mercado Libre reclama porque el comprador dice que no los recibió. Un
          caso solo se convierte en descuento cuando MELI lo resuelve en contra: mientras está en
          curso, todavía se puede ganar respondiendo con la evidencia de entrega.
        </p>
      </div>

      <div className="dx-tabs">
        {GRUPOS.map(g => {
          const n = (porGrupo[g.id] || []).length
          return (
            <button key={g.id} className={`dx-tab${grupo === g.id ? ' on' : ''}`} onClick={() => setGrupo(g.id)}>
              <span className="dx-tab-t">{g.t}</span>
              <span className="dx-tab-n" style={{ color: g.color }}>{n}</span>
              <span className="dx-tab-m">{pesos(total(g.id))}</span>
            </button>
          )
        })}
      </div>

      <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>
        {(GRUPOS.find(g => g.id === grupo) || {}).d}
      </p>

      {casos === null ? (
        <div className="bt-vacio"><h3>Cargando…</h3></div>
      ) : lista.length === 0 ? (
        <div className="bt-vacio">
          <h3>No hay casos aquí</h3>
          <p>{grupo === 'se_cobra'
            ? 'No tienes paquetes cobrados en este período.'
            : grupo === 'en_curso'
              ? 'No tienes casos esperando respuesta.'
              : 'Todavía no hay casos anulados en este período.'}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {lista.map(c => {
            const e = nombreEstado(c.sub_estado)
            const open = abierto === c.case_id
            const g = GRUPOS.find(x => x.id === c.resultado) || GRUPOS[0]
            return (
              <div key={c.case_id} className="dx-card" style={{ borderLeftColor: g.color }}>
                <button className="dx-head" onClick={() => abrir(c)}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="dx-titulo">
                      {e.t}
                      {c.le_toca_a === 'tercero' && <span className="dx-pill amber">Te toca responder</span>}
                      {c.le_toca_a === 'meli' && <span className="dx-pill gris">Esperando a MELI</span>}
                      {c.cobro_id && <span className="dx-pill rojo">Cobrado semana {c.semana_cobro}</span>}
                    </div>
                    <div className="dx-sub">
                      Guía {c.guia || '—'} · {c.sc} · ruta {c.ruta || c.id_ruta || '—'} del {dia(c.fecha_ruta)}
                      {c.placa ? ` · ${c.placa}` : ''}
                      {c.le_toca_a === 'tercero' && (
                        <span className={c.horas_restantes > 0 ? 'dx-plazo' : 'dx-plazo malo'}>
                          {c.horas_restantes > 0 ? ` · quedan ${c.horas_restantes} h para responder` : ' · el plazo venció'}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="dx-monto" style={{ color: c.resultado === 'no_se_cobra' ? 'var(--green)' : 'var(--ink)' }}>
                    {pesos(c.monto)}
                  </div>
                  <span className="dx-chev">{open ? '▲' : '▼'}</span>
                </button>

                {open && (
                  <div className="dx-detalle">
                    <p className="dx-que-pasa">{e.d}</p>

                    {c.le_toca_a === 'tercero' && <QueHacer c={c} />}

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
                      {c.cerrado_en && <Dato k="Cerrado" v={diaHora(c.cerrado_en)} />}
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
                          No se enviaron avisos por este caso. Si crees que debió avisarse, escríbenos en Consultas.
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

                    {c.resultado === 'se_cobra' && (
                      <p className="dx-nota">
                        Los cobros por PNR no admiten reclamo: MELI rechaza los respaldos una vez que
                        el caso pasó a facturación.
                      </p>
                    )}
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
// pantalla solo informaba: el tercero veía que iban a cobrarle y no sabía que
// todavía podía evitarlo ni a quién recurrir.
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
          {c.placa ? ` (${c.placa})` : ''} y pídele la evidencia de que entregó
          la guía {c.guia || ''}: foto de la entrega, firma de quien recibió, o la captura de
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
          : `Si nadie responde antes de que venza el plazo, el paquete se cobra completo y el cargo ya no admite reclamo.`}
      </p>
    </div>
  )
}
