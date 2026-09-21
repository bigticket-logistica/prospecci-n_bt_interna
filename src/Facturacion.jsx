// ═══════════════════════════════════════════════════════════════════════════
// Facturacion.jsx — Las prefacturas del tercero y sus facturas.
//
// La prefactura aparece acá sola cuando el analista la envía desde el Brain:
// la vista filtra por estado 'enviada', así que el botón de enviar que ya
// existe es lo que la publica. No hay un paso extra que alguien pueda olvidar.
//
// El detalle congelado se muestra tal cual quedó en la conciliación, separando
// viajes de descuentos. El tercero ya vio cada línea día por día en Movimientos;
// acá la ve agrupada, que es como se le paga.
//
// La factura la sube él, contra una prefactura concreta. Sin ese vínculo queda
// un archivo suelto en un archivador y nadie sabe qué está facturado.
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase, BUCKET } from './supabaseClient'

const money = (n) => '$' + Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fecha = (s) => s ? new Date(s).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'
const fechaCorta = (s) => s ? new Date(s + (String(s).length <= 10 ? 'T12:00:00' : '')).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }) : '—'

export default function Facturacion({ tercero, email, onBack }) {
  const [filas, setFilas] = useState(null)
  const [abierta, setAbierta] = useState(null)
  const [subiendo, setSubiendo] = useState(null)
  const [error, setError] = useState(null)
  const [aviso, setAviso] = useState(null)

  const cargar = useCallback(async () => {
    if (!tercero?.tercero_id) return
    setError(null)
    const [pref, fact] = await Promise.all([
      supabase.from('vw_portal_prefactura').select('*')
        .eq('tercero_id', tercero.tercero_id)
        .order('semana', { ascending: false }),
      supabase.from('facturas_tercero').select('*')
        .eq('tercero_id', tercero.tercero_id),
    ])
    if (pref.error) { setError(pref.error.message); setFilas([]); return }
    const porPref = {}
    for (const f of (fact.data || [])) {
      (porPref[f.conciliacion_id] = porPref[f.conciliacion_id] || []).push(f)
    }
    setFilas((pref.data || []).map(p => ({ ...p, facturas: porPref[p.id] || [] })))
  }, [tercero])

  useEffect(() => { cargar() }, [cargar])

  // Lee el CFDI antes de guardarlo. Si el RFC o el monto no calzan, se avisa
  // acá y no tres días después cuando alguien lo revise a mano.
  const leerCfdi = async (file) => {
    if (!/\.xml$/i.test(file.name)) return null   // un PDF suelto no se puede leer
    const texto = await file.text()
    const doc = new DOMParser().parseFromString(texto, 'application/xml')
    if (doc.querySelector('parsererror')) return null
    const compro = doc.documentElement
    const busca = (etiqueta) => {
      const n = doc.getElementsByTagName('*')
      for (const el of n) if (el.localName === etiqueta) return el
      return null
    }
    const emisor = busca('Emisor')
    const receptor = busca('Receptor')
    const timbre = busca('TimbreFiscalDigital')
    return {
      uuid: timbre?.getAttribute('UUID') || null,
      rfc_emisor: emisor?.getAttribute('Rfc') || null,
      rfc_receptor: receptor?.getAttribute('Rfc') || null,
      total: Number(compro.getAttribute('Total') || 0) || null,
      fecha_emision: compro.getAttribute('Fecha') || null,
      serie_folio: [compro.getAttribute('Serie'), compro.getAttribute('Folio')].filter(Boolean).join('-') || null,
    }
  }

  const subirFactura = async (p, file) => {
    if (!file) return
    setSubiendo(p.id); setError(null); setAviso(null)
    try {
      const cfdi = await leerCfdi(file)
      const problemas = []

      if (cfdi) {
        // El RFC es lo primero: un monto distinto puede ser un error de captura,
        // un RFC distinto es una factura de otra empresa.
        if (cfdi.rfc_emisor && tercero.rfc &&
            cfdi.rfc_emisor.toUpperCase().trim() !== String(tercero.rfc).toUpperCase().trim()) {
          problemas.push(`El RFC del emisor (${cfdi.rfc_emisor}) no es el de tu empresa (${tercero.rfc}).`)
        }
        if (cfdi.total != null) {
          const dif = Number((cfdi.total - Number(p.liquido_pago || 0)).toFixed(2))
          // Tolerancia de $1: el líquido puede diferir en centavos por el
          // redondeo del IVA, y bloquear por eso sería ruido.
          if (Math.abs(dif) > 1) {
            problemas.push(`La factura es de ${money(cfdi.total)} y la prefactura de ${money(p.liquido_pago)}: ${dif > 0 ? 'sobran' : 'faltan'} ${money(Math.abs(dif))}.`)
          }
        }
      }

      if (problemas.length) {
        const seguir = window.confirm(
          `Revisa esto antes de subirla:\n\n· ${problemas.join('\n· ')}\n\n` +
          `Puedes subirla igual y un analista la revisa, o cancelar y corregirla.\n\n¿La subes igual?`
        )
        if (!seguir) { setSubiendo(null); return }
      }

      const limpio = file.name.replace(/[^\w.\-]/g, '_')
      const path = `facturas/${tercero.tercero_id}/${p.semana}_${p.service_center}_${Date.now()}_${limpio}`
      const { error: eUp } = await supabase.storage.from(BUCKET).upload(path, file)
      if (eUp) throw eUp

      const { error: eIns } = await supabase.from('facturas_tercero').insert({
        tercero_id: tercero.tercero_id, conciliacion_id: p.id,
        semana: p.semana, service_center: p.service_center,
        storage_path: path, nombre_archivo: file.name,
        monto_prefactura: p.liquido_pago, subido_por: email || tercero.nombre,
        monto_factura: cfdi?.total ?? null,
        uuid: cfdi?.uuid ?? null,
        rfc_emisor: cfdi?.rfc_emisor ?? null,
        rfc_receptor: cfdi?.rfc_receptor ?? null,
        fecha_emision: cfdi?.fecha_emision ?? null,
        serie_folio: cfdi?.serie_folio ?? null,
        diferencia: cfdi?.total != null
          ? Number((cfdi.total - Number(p.liquido_pago || 0)).toFixed(2)) : null,
        estado: problemas.length ? 'recibida' : (cfdi ? 'conciliada' : 'recibida'),
        validaciones: cfdi ? { problemas, leido: true } : { problemas: [], leido: false },
      })
      if (eIns) {
        // El folio fiscal es único: si ya está, es la misma factura otra vez.
        if (String(eIns.message || '').includes('ux_factura_uuid')) {
          throw new Error('Esa factura ya está cargada. Revisa si la subiste antes.')
        }
        throw eIns
      }

      setAviso(cfdi
        ? (problemas.length ? 'Factura subida. Un analista la va a revisar.' : 'Factura subida y conciliada con la prefactura.')
        : 'Factura subida. Sube también el XML si quieres que se concilie sola.')
      await cargar()

      // Validación contra el SAT, después de guardar y sin bloquear: si el SAT
      // está caído o la factura es muy reciente y todavía no aparece, la
      // factura ya quedó subida y el reintento del Brain la vuelve a tomar.
      if (cfdi?.uuid) {
        try {
          const { data: reciente } = await supabase.from('facturas_tercero')
            .select('id').eq('uuid', cfdi.uuid).maybeSingle()
          if (reciente?.id) {
            const r = await fetch(`https://bigticket-brain.vercel.app/api/reportes/validar-cfdi?factura_id=${reciente.id}`)
            const j = await r.json()
            const res = j?.resultados?.[0]
            if (res?.vigente) setAviso('Factura subida. El SAT la confirma como vigente.')
            else if (res?.estado) setAviso(`Factura subida. El SAT la reporta como ${res.estado.toLowerCase()}: un analista la va a revisar.`)
            await cargar()
          }
        } catch (e) { console.error('No se pudo validar con el SAT:', e) }
      }
    } catch (e) { setError('No se pudo subir la factura: ' + (e.message || e)) }
    setSubiendo(null)
  }

  const abrirArchivo = async (path) => {
    const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, 300)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
    else setError('No se pudo abrir el archivo.')
  }

  // Agrupadas por semana: una empresa puede tener una prefactura por centro,
  // y lo que le importa es cuánto cobra esa semana en total.
  const semanas = useMemo(() => {
    const m = new Map()
    for (const p of (filas || [])) {
      if (!m.has(p.semana)) m.set(p.semana, [])
      m.get(p.semana).push(p)
    }
    return [...m.entries()].map(([semana, prefs]) => ({
      semana, prefs,
      inicio: prefs[0]?.semana_inicio, fin: prefs[0]?.semana_fin,
      liquido: prefs.reduce((t, p) => t + Number(p.liquido_pago || 0), 0),
      conFactura: prefs.filter(p => p.facturas.length > 0).length,
    }))
  }, [filas])

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <button className="back-link" onClick={onBack}>← Volver</button>

      <div style={{ background: 'var(--navy)', color: '#fff', borderRadius: 14, padding: '18px 20px', marginBottom: 14 }}>
        <div style={{ fontSize: 16, fontWeight: 700 }}>Facturación</div>
        <div style={{ fontSize: 12.5, color: '#b8c6de', marginTop: 3, lineHeight: 1.5 }}>
          Tus prefacturas semanales y las facturas que subes contra cada una.
          Lo que ves acá es el mismo detalle que revisaste día por día en Movimientos.
        </div>
      </div>

      {error && <div className="form-error">{error}</div>}
      {aviso && (
        <div style={{ background: 'var(--green-soft)', color: 'var(--green)', borderRadius: 10,
          padding: '11px 14px', fontSize: 13, marginBottom: 12 }}>{aviso}</div>
      )}

      {filas === null ? (
        <div style={{ color: 'var(--muted)', fontSize: 14, padding: 24, textAlign: 'center' }}>Cargando…</div>
      ) : semanas.length === 0 ? (
        <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14, padding: 32, textAlign: 'center' }}>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Todavía no hay prefacturas</div>
          <div style={{ fontSize: 13.5, color: 'var(--muted)', maxWidth: 460, margin: '0 auto', lineHeight: 1.5 }}>
            La prefactura de cada semana se arma el lunes con los días que ya viste en Movimientos.
            Apenas se envía, aparece acá para que la revises y subas tu factura.
          </div>
        </div>
      ) : semanas.map(s => (
        <div key={s.semana} style={{ marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--navy)' }}>Semana {s.semana}</span>
            <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>
              {fechaCorta(s.inicio)} – {fechaCorta(s.fin)}
            </span>
            <span style={{ marginLeft: 'auto', fontSize: 17, fontWeight: 700 }}>{money(s.liquido)}</span>
          </div>

          {s.prefs.map(p => {
            const exp = abierta === p.id
            const lineas = Array.isArray(p.detalle) ? p.detalle : []
            const viajes = lineas.filter(d => Number(d.monto || 0) >= 0)
            const descuentos = lineas.filter(d => Number(d.monto || 0) < 0)
            return (
              <div key={p.id} style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14, marginBottom: 8, overflow: 'hidden' }}>
                <button onClick={() => setAbierta(exp ? null : p.id)}
                  style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '14px 18px', background: 'transparent', border: 'none', textAlign: 'left' }}>
                  <div>
                    <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--navy)' }}>
                      {p.service_center}
                      {p.facturas.length > 0 && (
                        <span style={{ marginLeft: 8, fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: 'var(--green-soft)', color: 'var(--green)' }}>
                          FACTURADA
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 2 }}>
                      {p.n_viajes} viaje{p.n_viajes === 1 ? '' : 's'}
                      {Number(p.total_cobros) !== 0 && ` · ${money(p.total_cobros)} en descuentos`}
                      {p.enviado_at && ` · enviada el ${fechaCorta(p.enviado_at)}`}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 16, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{money(p.liquido_pago)}</span>
                    <span style={{ color: 'var(--muted)', fontSize: 13 }}>{exp ? '▴' : '▾'}</span>
                  </div>
                </button>

                {exp && (
                  <div style={{ borderTop: '1px solid var(--line)', padding: '14px 18px' }}>
                    {/* El documento tal como se envió por correo, no una
                        regeneración: si algún día se discute qué decía la
                        prefactura, este archivo es la prueba. */}
                    {p.pdf_url && (
                      <button onClick={() => abrirArchivo(p.pdf_url)}
                        style={{ width: '100%', marginBottom: 14, padding: '11px', borderRadius: 10,
                          border: '1px solid var(--navy)', background: '#fff', color: 'var(--navy)',
                          fontSize: 13, fontWeight: 600 }}>
                        Ver prefactura
                      </button>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 14 }}>
                      <Tot k="Viajes" v={money(p.total_neto)} />
                      <Tot k="IVA 16%" v={money(p.iva_16)} />
                      <Tot k="Bruto" v={money(p.total_bruto)} />
                      <Tot k="Descuentos" v={money(p.total_cobros)} rojo />
                      <Tot k="A pagar" v={money(p.liquido_pago)} fuerte />
                    </div>

                    {descuentos.length > 0 && (
                      <>
                        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                          Descuentos ({descuentos.length})
                        </div>
                        <div style={{ background: 'var(--red-soft)', borderRadius: 10, padding: '4px 0', marginBottom: 14 }}>
                          {descuentos.map((d, i) => (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '7px 12px', fontSize: 12.5 }}>
                              <span style={{ color: 'var(--ink)' }}>
                                {d.driver_name || d.placa || 'Descuento'}
                                {d.fecha && <span style={{ color: 'var(--muted)' }}> · {fechaCorta(d.fecha)}</span>}
                              </span>
                              <b style={{ color: 'var(--red)', whiteSpace: 'nowrap' }}>{money(d.monto)}</b>
                            </div>
                          ))}
                        </div>
                      </>
                    )}

                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                      Viajes ({viajes.length})
                    </div>
                    <div style={{ maxHeight: 280, overflowY: 'auto', border: '1px solid var(--line)', borderRadius: 10 }}>
                      {viajes.map((d, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '8px 12px', fontSize: 12.5, borderBottom: '1px solid #f4f6f9' }}>
                          <span>
                            <b>{d.placa || '—'}</b>
                            <span style={{ color: 'var(--muted)' }}> · {fechaCorta(d.fecha)} · {d.driver_name || 'sin conductor'}</span>
                          </span>
                          <b style={{ whiteSpace: 'nowrap' }}>{money(d.monto)}</b>
                        </div>
                      ))}
                    </div>

                    <div style={{ marginTop: 14, borderTop: '1px solid var(--line)', paddingTop: 12 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Tu factura</div>
                      {p.facturas.length > 0 ? (
                        p.facturas.map(f => {
                          const cuadra = f.diferencia != null && Math.abs(Number(f.diferencia)) <= 1
                          const revisar = f.monto_factura != null && !cuadra
                          return (
                            <div key={f.id} style={{
                              background: revisar ? 'var(--amber-soft)' : 'var(--green-soft)',
                              borderRadius: 8, padding: '10px 12px', marginBottom: 6, fontSize: 12.5,
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <span style={{ flex: 1, color: revisar ? 'var(--amber)' : 'var(--green)' }}>
                                  {f.nombre_archivo}
                                  <span style={{ color: 'var(--muted)' }}> · subida el {fechaCorta(f.created_at)}</span>
                                </span>
                                <button onClick={() => abrirArchivo(f.storage_path)}
                                  style={{ border: `1px solid ${revisar ? 'var(--amber)' : 'var(--green)'}`, background: '#fff',
                                    color: revisar ? 'var(--amber)' : 'var(--green)', borderRadius: 6, padding: '5px 12px', fontSize: 12 }}>
                                  Ver
                                </button>
                              </div>
                              {/* Lo que se leyó del XML. Si no hay monto, es un PDF suelto
                                  y no se pudo conciliar sola. */}
                              {f.monto_factura != null && (
                                <div style={{ marginTop: 6, color: revisar ? 'var(--amber)' : 'var(--green)' }}>
                                  {money(f.monto_factura)}
                                  {cuadra
                                    ? ' · cuadra con la prefactura'
                                    : ` · la prefactura es de ${money(f.monto_prefactura)}, una diferencia de ${money(Math.abs(Number(f.diferencia)))}`}
                                </div>
                              )}
                              {f.uuid && (
                                <div style={{ marginTop: 3, color: 'var(--muted)', fontSize: 11.5 }}>
                                  Folio fiscal {f.uuid}
                                  {f.serie_folio ? ` · ${f.serie_folio}` : ''}
                                </div>
                              )}
                              {/* Lo que dice el SAT. "Vigente" es lo único que
                                  confirma la factura; cancelada o no encontrada
                                  necesitan que alguien la mire. */}
                              {f.sat_estado && (
                                <div style={{ marginTop: 5, fontSize: 11.5, fontWeight: 600,
                                  color: String(f.sat_estado).toLowerCase() === 'vigente' ? 'var(--green)' : 'var(--red)' }}>
                                  SAT: {f.sat_estado}
                                  {String(f.sat_estado).toLowerCase() !== 'vigente' && ' — un analista la va a revisar'}
                                </div>
                              )}
                              {f.monto_factura == null && (
                                <div style={{ marginTop: 5, color: 'var(--muted)' }}>
                                  Sin XML no se puede conciliar sola: un analista la revisa.
                                </div>
                              )}
                            </div>
                          )
                        })
                      ) : (
                        <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 8, lineHeight: 1.5 }}>
                          Sube tu factura contra esta prefactura. Así queda conciliada y no se pierde en el correo.
                        </div>
                      )}
                      <input type="file" accept="application/pdf,.xml"
                        disabled={subiendo === p.id}
                        onChange={e => subirFactura(p, e.target.files?.[0])}
                        style={{ fontSize: 12.5 }} />
                      {subiendo === p.id && <span style={{ fontSize: 12, color: 'var(--muted)', marginLeft: 8 }}>Subiendo…</span>}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

function Tot({ k, v, rojo, fuerte }) {
  return (
    <div>
      <div style={{ fontSize: 10.5, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em' }}>{k}</div>
      <div style={{ fontSize: fuerte ? 17 : 14, fontWeight: 700, marginTop: 2, fontVariantNumeric: 'tabular-nums', color: rojo ? 'var(--red)' : 'var(--ink)' }}>{v}</div>
    </div>
  )
}
