// ═══════════════════════════════════════════════════════════════════════════
// Movimientos.jsx — El dinero del tercero, día por día: lo que se le paga y
// lo que se le cobra.
//
// Lee vw_portal_movimiento_dia. Los pagos vienen de días que el analista ya
// publicó; los cobros (PNR) aparecen el día que MELI los factura, con la fecha
// de la ruta que los originó en el detalle — sin eso, un descuento aparece en
// un día donde no pasó nada y el tercero no entiende de dónde sale.
//
// Desde acá se levanta una diferencia: se marcan las líneas, se comenta cada
// una y se adjuntan fotos. Eso abre un caso con folio en el Brain y una tarea
// para el supervisor del centro.
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase, BUCKET } from './supabaseClient'

function lunesDe(d) {
  const x = new Date(d)
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7))
  x.setHours(0, 0, 0, 0)
  return x
}
const iso = (d) => d.toISOString().slice(0, 10)
const sumaDias = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }

// Numeración del Brain: ISO + 1
function semanaBrain(d) {
  const x = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dn = x.getUTCDay() || 7
  x.setUTCDate(x.getUTCDate() + 4 - dn)
  const ini = new Date(Date.UTC(x.getUTCFullYear(), 0, 1))
  return Math.ceil(((x - ini) / 86400000 + 1) / 7) + 1
}

const money = (n) => (Number(n) < 0 ? '−' : '') + '$' +
  Math.abs(Number(n || 0)).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fechaLarga = (s) => {
  const t = new Date(s + 'T00:00:00').toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })
  return t.charAt(0).toUpperCase() + t.slice(1)
}
const fechaCorta = (s) => s ? new Date(s + 'T00:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }) : '—'
const rango = (a, b) => `${a.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })} – ${b.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}`

// "Pagada" era falso: la ruta se aprueba el día siguiente, entra en la
// prefactura del lunes y se paga el viernes. Hasta entonces es "Por pagar".
// El verde queda reservado para cuando exista el registro del pago efectivo.
// "Por cobrar" se leía como si el tercero fuera a cobrar, cuando es plata que
// se le descuenta. Los estados pasan a pagado o descontado cuando el analista
// marca la prefactura de esa semana como pagada.
const ESTADOS = {
  aprobada:  { label: 'Por pagar',     bg: 'var(--amber-soft)', fg: 'var(--amber)' },
  no_pagada: { label: 'No se paga',    bg: 'var(--red-soft)',   fg: 'var(--red)' },
  pausada:   { label: 'En revisión',   bg: '#e8eefb',           fg: 'var(--navy)' },
  cobrado:   { label: 'Por descontar', bg: '#fdeaea',           fg: '#c0392b' },
}
const ESTADOS_PAGADOS = {
  aprobada:  { label: 'Pagado',      bg: 'var(--green-soft)', fg: 'var(--green)' },
  no_pagada: { label: 'No se paga',  bg: 'var(--red-soft)',   fg: 'var(--red)' },
  pausada:   { label: 'En revisión', bg: '#e8eefb',           fg: 'var(--navy)' },
  cobrado:   { label: 'Descontado',  bg: 'var(--green-soft)', fg: 'var(--green)' },
}

// Numeración del Brain: ISO + 1. Tiene que coincidir con la de la prefactura
// o los extras de la semana no se encontrarían.
function semanaDe(d) {
  const x = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dn = x.getUTCDay() || 7
  x.setUTCDate(x.getUTCDate() + 4 - dn)
  const ini = new Date(Date.UTC(x.getUTCFullYear(), 0, 1))
  return Math.ceil(((x - ini) / 86400000 + 1) / 7) + 1
}

const thC = { padding: '9px 12px', fontSize: 10, fontWeight: 600, color: 'var(--muted)', letterSpacing: '.05em', textAlign: 'right' }
const tdC = { padding: '9px 12px', fontSize: 12, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }

const claveDe = (m) => `${m.tipo}|${m.fecha}|${m.ref}`

// El portal arranca el 14 de septiembre de 2026: antes de esa fecha no hay
// publicaciones, así que retroceder solo mostraría semanas vacías.
const INICIO_PORTAL = '2026-09-14'

const EST_DIF = {
  abierta:     { l: 'Recibida',    bg: 'var(--amber-soft)', fg: 'var(--amber)', ayuda: 'La recibimos. Un analista la va a revisar.' },
  en_revision: { l: 'En revisión', bg: '#dbeafe',           fg: '#1e40af',      ayuda: 'Un analista la está revisando.' },
  aceptada:    { l: 'Aceptada',    bg: 'var(--green-soft)', fg: 'var(--green)', ayuda: 'Se te reconoce lo reclamado. Entra en tu prefactura.' },
  parcial:     { l: 'Parcial',     bg: '#e0e7ff',           fg: '#3730a3',      ayuda: 'Se aceptó una parte. Mira el detalle de cada línea.' },
  rechazada:   { l: 'Rechazada',   bg: 'var(--red-soft)',   fg: 'var(--red)',   ayuda: 'No procede. La razón está en cada línea.' },
  retirada:    { l: 'Retirada',    bg: '#f1f5f9',           fg: 'var(--muted)', ayuda: 'La retiraste.' },
  vencida:     { l: 'Vencida',     bg: '#f1f5f9',           fg: 'var(--muted)', ayuda: 'Se cerró por plazo.' },
}

export default function Movimientos({ tercero, email, onBack }) {
  const [lunes, setLunes] = useState(() => lunesDe(new Date()))
  const [scSel, setScSel] = useState('todos')
  const [extras, setExtras] = useState([])
  const [prefs, setPrefs] = useState([])   // la prefactura de la semana, para el IVA y el total
  const [filas, setFilas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [cerrados, setCerrados] = useState({})

  // Modo reclamo
  const [reclamando, setReclamando] = useState(false)
  const [sel, setSel] = useState({})          // clave -> comentario
  const [faltantes, setFaltantes] = useState([])
  const [fotos, setFotos] = useState([])
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(null) // folio
  const [misDif, setMisDif] = useState([])     // reclamos del tercero, con sus líneas
  const [difAbierta, setDifAbierta] = useState(null)

  const domingo = useMemo(() => sumaDias(lunes, 6), [lunes])

  const cargar = useCallback(async () => {
    if (!tercero?.tercero_id) return
    setCargando(true); setError(null)
    const { data, error } = await supabase
      .from('vw_portal_movimiento_dia')
      .select('*')
      .eq('tercero_id', tercero.tercero_id)
      .gte('fecha', iso(lunes)).lte('fecha', iso(domingo))
      .order('fecha', { ascending: false })
    if (error) { setError(error.message); setFilas([]) } else { setFilas(data || []) }

    // Cobros y ajustes que el analista agregó a la prefactura. No van en un día
    // porque no pertenecen a uno: un saldo de la semana 37 o un paquete perdido
    // cargado a mano no tienen fecha de operación. Van al final, aparte.
    const sem = semanaDe(lunes)
    const { data: ex } = await supabase
      .from('vw_portal_linea_prefactura')
      .select('*')
      .eq('tercero_id', tercero.tercero_id)
      .eq('semana', sem)
    setExtras(ex || [])

    // El IVA y el total salen de la prefactura, no de un cálculo propio: son la
    // misma plata que Facturación y tienen que dar el mismo número.
    const { data: pf } = await supabase
      .from('vw_portal_prefactura')
      .select('service_center, total_neto, iva_16, total_bruto, liquido_pago, pagado_at, pago_referencia')
      .eq('tercero_id', tercero.tercero_id)
      .eq('semana', sem)
    setPrefs(pf || [])

    setCargando(false)
  }, [tercero, lunes, domingo])

  useEffect(() => { cargar() }, [cargar])

  // Los reclamos del tercero, con sus líneas y la respuesta del analista.
  // Sin esto, levantar una diferencia es gritar a un pozo.
  const cargarDif = useCallback(async () => {
    if (!tercero?.tercero_id) return
    const { data } = await supabase
      .from('diferencias')
      .select('*, diferencias_lineas(*)')
      .eq('tercero_id', tercero.tercero_id)
      .order('creada_at', { ascending: false })
    setMisDif(data || [])
  }, [tercero])

  useEffect(() => { cargarDif() }, [cargarDif, enviado])

  // Qué líneas del listado ya están reclamadas, para marcarlas
  const reclamadas = useMemo(() => {
    const m = {}
    for (const d of misDif) {
      if (d.estado === 'retirada') continue
      for (const l of (d.diferencias_lineas || [])) {
        if (l.id_ruta) m[`pago|${l.fecha}|${l.id_ruta}`] = { folio: d.folio, estado: d.estado, linea: l }
        if (l.cobro_id) m[`cobro|${l.cobro_id}`] = { folio: d.folio, estado: d.estado, linea: l }
      }
    }
    return m
  }, [misDif])

  const retirar = async (d) => {
    if (!confirm(`¿Retirar la diferencia #${d.folio}?\n\nDeja de estar en revisión y no se vuelve a abrir.`)) return
    const { error } = await supabase.from('diferencias').update({ estado: 'retirada' }).eq('id', d.id)
    if (error) { alert('No se pudo retirar: ' + error.message); return }
    await supabase.from('diferencias_eventos').insert({
      diferencia_id: d.id, tipo: 'retirada', actor: email || tercero.nombre,
      detalle: 'El tercero retiró el reclamo',
    })
    cargarDif()
  }

  const dias = useMemo(() => {
    const m = new Map()
    for (const f of filas) {
      if (scSel !== 'todos' && f.sc !== scSel) continue
      if (!m.has(f.fecha)) m.set(f.fecha, [])
      m.get(f.fecha).push(f)
    }
    // Se ordena de más antiguo a más nuevo: un saldo corrido solo se entiende
    // si avanza hacia adelante, como una cartola.
    return [...m.entries()]
      .sort((a, b) => String(a[0]).localeCompare(String(b[0])))
      .map(([fecha, movs]) => ({
        fecha,
        movs: movs.sort((a, b) => a.tipo.localeCompare(b.tipo) || String(a.placa).localeCompare(String(b.placa))),
        neto: movs.reduce((s, r) => s + (r.estado === 'aprobada' || r.tipo === 'cobro' ? Number(r.monto || 0) : 0), 0),
        enRevision: movs.filter(r => r.estado === 'pausada').length,
        noPagadas: movs.filter(r => r.estado === 'no_pagada').length,
      }))
  }, [filas, scSel])

  // Cada línea con su saldo acumulado, que es lo que hace legible una cartola:
  // se puede seguir el hilo sin sumar de cabeza.
  const lineas = useMemo(() => {
    let saldo = 0
    const out = []
    for (const d of dias) {
      out.push({ _sep: true, fecha: d.fecha })
      for (const m of d.movs) {
        const cuenta = m.estado === 'aprobada' || m.tipo === 'cobro'
        if (cuenta) saldo += Number(m.monto || 0)
        out.push({ m, saldo, cuenta })
      }
    }
    return { filas: out, saldoDias: saldo }
  }, [dias])

  // Los centros donde operó esta semana. Cada uno es una prefactura distinta,
  // así que quien trabaja en varios necesita poder mirarlos de a uno.
  const centros = useMemo(() => {
    const cs = new Set([...filas.map(f => f.sc), ...extras.map(e => e.service_center)].filter(Boolean))
    return [...cs].sort()
  }, [filas, extras])

  const extrasSC = useMemo(() =>
    scSel === 'todos' ? extras : extras.filter(e => e.service_center === scSel),
  [extras, scSel])

  // El saldo de los agregados continúa desde donde quedaron los días: va
  // después de extrasSC porque depende de él.
  const lineasExtra = useMemo(() => {
    let saldo = lineas.saldoDias
    return extrasSC.map(e => { saldo += Number(e.monto || 0); return { e, saldo } })
  }, [extrasSC, lineas.saldoDias])


  // Todos los totales respetan el centro elegido. Antes los cobros no lo hacían
  // y el número no cambiaba al filtrar, que es peor que no tener el filtro.
  const filasSC = useMemo(() =>
    scSel === 'todos' ? filas : filas.filter(f => f.sc === scSel), [filas, scSel])

  const totalPagos = filasSC.filter(f => f.tipo === 'pago' && f.estado === 'aprobada')
    .reduce((s, f) => s + Number(f.monto || 0), 0)
  const totalCobros = filasSC.filter(f => f.tipo === 'cobro').reduce((s, f) => s + Number(f.monto || 0), 0)
    + extrasSC.reduce((s, e) => s + Math.min(Number(e.monto || 0), 0), 0)
  const totalAjustes = extrasSC.reduce((s, e) => s + Math.max(Number(e.monto || 0), 0), 0)
  const totalNeto = totalPagos + totalAjustes + totalCobros

  // IVA y total de la prefactura del centro elegido. Si todavía no se generó,
  // se muestra solo hasta el neto en vez de inventar un impuesto.
  const prefSC = useMemo(() =>
    scSel === 'todos' ? prefs : prefs.filter(p => p.service_center === scSel), [prefs, scSel])
  const iva = prefSC.reduce((s, p) => s + Number(p.iva_16 || 0), 0)
  const totalBruto = prefSC.reduce((s, p) => s + Number(p.total_bruto || 0), 0)
  const hayPrefactura = prefSC.length > 0
  // La semana está pagada cuando todas sus prefacturas lo están: el pago es uno
  // por centro, así que con varios hay que esperar a que salgan todos.
  const pagada = hayPrefactura && prefSC.every(p => p.pagado_at)
  const pagadoAt = pagada ? prefSC.map(p => p.pagado_at).sort()[0] : null

  const nSel = Object.keys(sel).length + faltantes.length

  const toggleSel = (m) => {
    const k = claveDe(m)
    setSel(p => {
      const n = { ...p }
      if (k in n) delete n[k]; else n[k] = ''
      return n
    })
  }

  const enviarDiferencia = async () => {
    const sinComentario = Object.entries(sel).filter(([, c]) => !c.trim())
    if (sinComentario.length) { alert('Escribe qué reclamas en cada línea marcada.'); return }
    if (faltantes.some(f => !f.placa.trim() || !f.comentario.trim())) {
      alert('En lo que falta, indica al menos la placa y qué ocurrió.'); return
    }
    setEnviando(true)
    try {
      const porClave = {}
      for (const f of filas) porClave[claveDe(f)] = f
      const lineasSel = Object.entries(sel).map(([k, comentario]) => {
        const m = porClave[k]
        return {
          tipo: m.tipo === 'cobro' ? 'cobro' : 'ruta',
          fecha: m.tipo === 'cobro' ? (m.fecha_hecho || m.fecha) : m.fecha,
          id_ruta: m.tipo === 'pago' ? m.ref : null,
          cobro_id: m.tipo === 'cobro' ? m.cobro_id : null,
          // El id del cobro solo no dice de qué tabla es (PNR, no show o
          // merma): se guarda el origen y el concepto tal como lo vio el tercero.
          cobro_origen: m.tipo === 'cobro' ? (m.tipo_cobro || null) : null,
          concepto: m.tipo === 'cobro'
            ? [m.concepto || 'Cobro', m.shipment_id ? `guía ${m.shipment_id}` : null, m.motivo].filter(Boolean).join(' · ')
            : null,
          placa: m.placa, monto_ref: Math.abs(Number(m.monto || 0)),
          comentario: comentario.trim(),
        }
      })
      const lineasFalt = faltantes.map(f => ({
        tipo: 'faltante', fecha: f.fecha || null, id_ruta: f.id_ruta?.trim() || null,
        cobro_id: null, cobro_origen: null, concepto: null,
        placa: f.placa.trim(), monto_ref: null, comentario: f.comentario.trim(),
      }))
      const lineas = [...lineasSel, ...lineasFalt]
      const scs = [...new Set(Object.keys(sel).map(k => porClave[k]?.sc).filter(Boolean))]

      const { data: dif, error: eDif } = await supabase.from('diferencias').insert({
        tercero_id: tercero.tercero_id,
        service_center: scs.length === 1 ? scs[0] : null,
        monto_reclamado: lineas.reduce((s, l) => s + Number(l.monto_ref || 0), 0),
        creada_por: email || tercero.nombre,
      }).select('id, folio').single()
      if (eDif) throw eDif

      const { error: eLin } = await supabase.from('diferencias_lineas')
        .insert(lineas.map(l => ({ ...l, diferencia_id: dif.id })))
      if (eLin) throw eLin

      for (const file of fotos) {
        const path = `diferencias/${dif.id}/${Date.now()}_${file.name.replace(/[^\w.\-]/g, '_')}`
        const { error: eUp } = await supabase.storage.from(BUCKET).upload(path, file)
        if (!eUp) {
          await supabase.from('diferencias_adjuntos').insert({
            diferencia_id: dif.id, storage_path: path, nombre: file.name,
            subido_por: email || tercero.nombre,
          })
        }
      }

      await supabase.from('diferencias_eventos').insert({
        diferencia_id: dif.id, tipo: 'creada', actor: email || tercero.nombre,
        detalle: `${lineas.length} línea(s) reclamada(s)${fotos.length ? ` · ${fotos.length} adjunto(s)` : ''}`,
      })

      // Abre el caso: calcula el SLA de 48 h y genera la tarea al supervisor
      // de cada centro involucrado. Si esto falla, el reclamo igual quedó
      // guardado — pero nadie se entera, así que hay que decirlo.
      const { error: eAbrir } = await supabase.rpc('fn_abrir_diferencia', { p_dif: dif.id })
      if (eAbrir) {
        alert(`Tu diferencia #${dif.folio} quedó registrada, pero no se pudo avisar al supervisor.\n\nAvísanos por el chat de consultas citando ese número.`)
      }

      // Correo al supervisor del centro, con copia a análisis. El envío no
      // bloquea: si el correo falla, la tarea ya está creada y el caso vive
      // igual en la bitácora del supervisor.
      try {
        const { data: payload } = await supabase.rpc('fn_payload_aviso_diferencia', { p_dif: dif.id })
        if (payload) {
          await fetch('https://bigticket2026.app.n8n.cloud/webhook/diferencia-notificar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        }
      } catch (e) { console.error('No se pudo enviar el aviso por correo:', e) }

      setEnviado(dif.folio)
      setSel({}); setFaltantes([]); setFotos([]); setReclamando(false)
    } catch (e) {
      alert('No se pudo enviar la diferencia:\n\n' + (e.message || e))
    }
    setEnviando(false)
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <button className="back-link" onClick={onBack}>← Volver</button>

      {/* Cabecera: semana y totales */}
      <div style={{ background: 'var(--navy)', color: '#fff', borderRadius: 14, padding: '18px 20px', marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={() => setLunes(sumaDias(lunes, -7))}
              disabled={iso(lunes) <= INICIO_PORTAL}
              title={iso(lunes) <= INICIO_PORTAL ? 'Es la primera semana disponible' : ''}
              style={{ ...navBtn, opacity: iso(lunes) <= INICIO_PORTAL ? 0.35 : 1,
                cursor: iso(lunes) <= INICIO_PORTAL ? 'not-allowed' : 'pointer' }}>‹</button>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Semana {semanaBrain(lunes)}</div>
              <div style={{ fontSize: 12.5, color: '#b8c6de' }}>{rango(lunes, domingo)}</div>
            </div>
            <button onClick={() => setLunes(sumaDias(lunes, 7))} style={navBtn}>›</button>
          </div>
          <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap' }}>
            <Tot label="Viajes" valor={money(totalPagos)} />
            {totalAjustes !== 0 && <Tot label="Ajustes" valor={money(totalAjustes)} />}
            {totalCobros !== 0 && <Tot label="Cobros" valor={money(totalCobros)} rojo />}
            <Tot label="Neto" valor={money(totalNeto)} />
            {hayPrefactura && <Tot label="IVA 16%" valor={money(iva)} />}
            {hayPrefactura
              ? <Tot label={pagada ? 'Pagado' : 'Total'} valor={money(totalBruto)} grande />
              : <Tot label="Sin prefactura" valor="—" tenue />}
          </div>

          {centros.length > 1 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
              {['todos', ...centros].map(c => (
                <button key={c} onClick={() => setScSel(c)}
                  style={{
                    padding: '5px 13px', borderRadius: 14, fontSize: 12, fontWeight: 600,
                    border: `1px solid ${scSel === c ? '#fff' : 'rgba(255,255,255,.28)'}`,
                    background: scSel === c ? '#fff' : 'transparent',
                    color: scSel === c ? 'var(--navy)' : 'rgba(255,255,255,.85)',
                  }}>
                  {c === 'todos' ? 'Todos los centros' : c}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {enviado && (
        <div style={{ background: 'var(--green-soft)', color: 'var(--green)', borderRadius: 12, padding: '14px 16px', marginBottom: 12, fontSize: 13.5 }}>
          <b>Diferencia #{enviado} enviada.</b> La revisa un analista y te responde acá mismo.
          Vas a ver el avance en esta misma pantalla.
        </div>
      )}

      {/* Barra de reclamo */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10,
        flexWrap: 'wrap', marginBottom: 12,
      }}>
        {!reclamando ? (
          <>
            <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>
              ¿Algo no cuadra? Marca las líneas y cuéntanos qué pasó.
            </span>
            <button onClick={() => { setReclamando(true); setEnviado(null) }}
              style={{ background: 'var(--orange)', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 600 }}>
              Levantar diferencia
            </button>
          </>
        ) : (
          <>
            <span style={{ fontSize: 12.5, color: 'var(--ink)' }}>
              <b>{nSel}</b> línea(s) marcada(s). Escribe qué reclamas en cada una.
            </span>
            <span style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { setReclamando(false); setSel({}); setFaltantes([]); setFotos([]) }}
                style={{ background: '#fff', color: 'var(--muted)', border: '1px solid var(--line)', borderRadius: 8, padding: '9px 14px', fontSize: 13 }}>
                Cancelar
              </button>
              <button onClick={enviarDiferencia} disabled={nSel === 0 || enviando}
                style={{ background: nSel === 0 || enviando ? '#c8ced8' : 'var(--orange)', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 600 }}>
                {enviando ? 'Enviando…' : `Enviar diferencia (${nSel})`}
              </button>
            </span>
          </>
        )}
      </div>

      {/* Mis diferencias: en qué va cada reclamo */}
      {misDif.length > 0 && !reclamando && (
        <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14, marginBottom: 14, overflow: 'hidden' }}>
          <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--line)', fontSize: 14, fontWeight: 600, color: 'var(--navy)' }}>
            Mis diferencias
          </div>
          {misDif.map(d => {
            const e = EST_DIF[d.estado] || EST_DIF.abierta
            const abierta = difAbierta === d.id
            const puedeRetirar = d.estado === 'abierta'
            return (
              <div key={d.id} style={{ borderBottom: '1px solid #f1f4f8' }}>
                <button onClick={() => setDifAbierta(abierta ? null : d.id)}
                  style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '12px 18px', background: 'transparent', border: 'none', textAlign: 'left' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 13.5, fontWeight: 600 }}>Diferencia #{d.folio}</span>
                      <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: e.bg, color: e.fg, letterSpacing: '.04em' }}>
                        {e.l.toUpperCase()}
                      </span>
                    </div>
                    <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 2 }}>
                      {(d.diferencias_lineas || []).length} línea(s) · {new Date(d.creada_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })} · {e.ayuda}
                    </div>
                  </div>
                  <span style={{ color: 'var(--muted)', fontSize: 13 }}>{abierta ? '▴' : '▾'}</span>
                </button>

                {abierta && (
                  <div style={{ padding: '0 18px 14px' }}>
                    {(d.diferencias_lineas || []).map(l => (
                      <div key={l.id} style={{ background: 'var(--page)', borderRadius: 8, padding: '10px 12px', marginBottom: 6, fontSize: 12.5 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 600 }}>
                            {l.tipo === 'cobro' ? 'Cobro' : l.tipo === 'faltante' ? 'Ruta que falta' : 'Ruta'}
                            {l.placa ? ` · ${l.placa}` : ''}{l.id_ruta ? ` · ${l.id_ruta}` : ''}
                          </span>
                          <span style={{ color: 'var(--muted)' }}>{l.fecha || ''}</span>
                        </div>
                        <div style={{ color: 'var(--muted)', marginTop: 4 }}>Reclamaste: {l.comentario}</div>
                        {l.estado !== 'pendiente' && (
                          <div style={{ marginTop: 6, color: l.estado === 'aceptada' ? 'var(--green)' : 'var(--red)' }}>
                            <b>{l.estado === 'aceptada' ? 'Aceptada' : 'Rechazada'}
                              {l.monto_reconocido ? ` · ${money(l.monto_reconocido)}` : ''}:</b> {l.resolucion}
                          </div>
                        )}
                      </div>
                    ))}
                    {puedeRetirar && (
                      <button onClick={() => retirar(d)}
                        style={{ background: '#fff', color: 'var(--muted)', border: '1px solid var(--line)', borderRadius: 8, padding: '7px 14px', fontSize: 12.5 }}>
                        Retirar este reclamo
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {error && <div className="form-error">No se pudieron cargar tus movimientos: {error}</div>}

      {cargando ? (
        <div style={{ color: 'var(--muted)', fontSize: 14, padding: 24, textAlign: 'center' }}>Cargando…</div>
      ) : dias.length === 0 ? (
        <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14, padding: 32, textAlign: 'center' }}>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Todavía no hay movimientos de esta semana</div>
          <div style={{ fontSize: 13.5, color: 'var(--muted)', maxWidth: 460, margin: '0 auto' }}>
            Cada día se revisa y se publica al día siguiente. Si operaste un día que no aparece, levanta una diferencia.
          </div>
        </div>
      ) : (
        /* Estado de cuenta: cada línea suma o resta y el saldo va corriendo,
           como una cartola bancaria. Los días quedan como separadores para no
           perder la lectura por jornada. */
        <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14, overflow: 'auto', marginBottom: 14 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 620 }}>
            <thead>
              <tr style={{ background: 'rgba(26,58,107,.05)' }}>
                {reclamando && <th style={thC} />}
                <th style={{ ...thC, textAlign: 'left', width: 78 }}>FECHA</th>
                <th style={{ ...thC, textAlign: 'left' }}>DETALLE</th>
                <th style={thC}>ABONO</th>
                <th style={thC}>CARGO</th>
                <th style={thC}>SALDO</th>
              </tr>
            </thead>
            <tbody>
              {lineas.filas.map((ln, i) => {
                if (ln._sep) return (
                  <tr key={'s' + ln.fecha}>
                    <td colSpan={reclamando ? 6 : 5} style={{
                      padding: '7px 12px', background: 'rgba(26,58,107,.03)',
                      fontSize: 11.5, fontWeight: 600, color: 'var(--navy)',
                    }}>{fechaLarga(ln.fecha)}</td>
                  </tr>
                )
                const m = ln.m
                const k = claveDe(m)
                const marcado = k in sel
                const tabla = pagada ? ESTADOS_PAGADOS : ESTADOS
                const est = tabla[m.estado] || tabla.aprobada
                const esCobro = m.tipo === 'cobro'
                const monto = Number(m.monto || 0)
                const rec = esCobro ? reclamadas[`cobro|${m.cobro_id}`] : reclamadas[`pago|${m.fecha}|${m.ref}`]
                return (
                  <tr key={k} style={{ background: marcado ? 'var(--orange-soft)' : 'transparent' }}>
                    {reclamando && (
                      <td style={{ ...tdC, width: 34 }}>
                        <input type="checkbox" checked={marcado} onChange={() => toggleSel(m)}
                          style={{ width: 16, height: 16, accentColor: 'var(--orange)' }} />
                      </td>
                    )}
                    <td style={{ ...tdC, textAlign: 'left', color: 'var(--muted)', fontSize: 11.5 }}>
                      {fechaCorta(m.fecha)}
                    </td>
                    <td style={{ ...tdC, textAlign: 'left' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                        <b style={{ fontSize: 12.5 }}>{m.placa || '—'}</b>
                        <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                          {esCobro ? (m.ref ? `· ${m.concepto || 'Cobro'}` : m.concepto) : `· Ruta ${m.ref}`}
                        </span>
                        {m.sc && <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>· {m.sc}</span>}
                        {m.estado !== 'aprobada' && (
                          <span style={{ fontSize: 9.5, fontWeight: 700, padding: '1px 7px', borderRadius: 20, background: est.bg, color: est.fg }}>
                            {est.label.toUpperCase()}
                          </span>
                        )}
                        {rec && (() => {
                          const e = EST_DIF[rec.estado] || EST_DIF.abierta
                          return (
                            <span title={e.ayuda} style={{ fontSize: 9.5, fontWeight: 700, padding: '1px 7px', borderRadius: 20, background: e.bg, color: e.fg }}>
                              DIF #{rec.folio}
                            </span>
                          )
                        })()}
                      </div>
                      <div style={{ fontSize: 10.5, color: 'var(--muted)', marginTop: 2 }}>
                        {esCobro
                          ? <>{m.shipment_id ? `guía ${m.shipment_id}` : ''}{m.fecha_hecho ? `${m.shipment_id ? ' · ' : ''}${m.tipo_cobro === 'noshow' ? 'del día' : 'ruta del'} ${fechaCorta(m.fecha_hecho)}` : ''}</>
                          : <>{m.driver_name || 'sin conductor'}
                              {m.ns_pct != null && ` · NS ${Number(m.ns_pct).toFixed(1)}%`}
                              {m.pct_visitado != null && ` · visitado ${Number(m.pct_visitado).toFixed(1)}%`}
                              {m.tiene_auxiliar && m.monto_auxiliar ? ` · ayudante ${money(m.monto_auxiliar)}` : ''}</>}
                        {m.motivo && <span style={{ color: 'var(--red)' }}> · {m.motivo}</span>}
                      </div>
                    </td>
                    <td style={tdC}>{monto > 0 && ln.cuenta ? monto.toLocaleString('es-MX', { minimumFractionDigits: 2 }) : ''}</td>
                    <td style={{ ...tdC, color: 'var(--red)' }}>
                      {monto < 0 && ln.cuenta ? Math.abs(monto).toLocaleString('es-MX', { minimumFractionDigits: 2 }) : ''}
                    </td>
                    <td style={{ ...tdC, fontWeight: 700 }}>
                      {ln.cuenta ? ln.saldo.toLocaleString('es-MX', { minimumFractionDigits: 2 }) : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr style={{ background: 'rgba(26,58,107,.04)' }}>
                <td colSpan={reclamando ? 4 : 3} style={{ ...tdC, textAlign: 'left', fontSize: 11.5, color: 'var(--muted)' }}>
                  Subtotal de los días
                </td>
                <td style={tdC} />
                <td style={{ ...tdC, fontWeight: 700, fontSize: 13 }}>
                  {lineas.saldoDias.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}


      {/* Lo que falta: no hay línea que marcar */}
      {reclamando && (
        <div style={{ background: 'var(--card)', border: '1px dashed var(--orange)', borderRadius: 14, padding: 16, marginBottom: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>¿Falta algo que operaste?</div>
          <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 10 }}>
            Si una ruta que hiciste no aparece arriba, decláralas acá con su placa y fecha.
          </div>
          {faltantes.map((f, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
              <input value={f.placa} onChange={e => setFaltantes(p => p.map((x, j) => j === i ? { ...x, placa: e.target.value } : x))}
                placeholder="Placa" style={{ ...inp, width: 110 }} />
              <input type="date" value={f.fecha} onChange={e => setFaltantes(p => p.map((x, j) => j === i ? { ...x, fecha: e.target.value } : x))}
                style={{ ...inp, width: 150 }} />
              <input value={f.id_ruta} onChange={e => setFaltantes(p => p.map((x, j) => j === i ? { ...x, id_ruta: e.target.value } : x))}
                placeholder="Id de ruta (si lo tienes)" style={{ ...inp, width: 180 }} />
              <input value={f.comentario} onChange={e => setFaltantes(p => p.map((x, j) => j === i ? { ...x, comentario: e.target.value } : x))}
                placeholder="¿Qué ocurrió?" style={{ ...inp, flex: 1, minWidth: 180 }} />
              <button onClick={() => setFaltantes(p => p.filter((_, j) => j !== i))}
                style={{ border: '1px solid var(--line)', background: '#fff', color: 'var(--muted)', borderRadius: 6, padding: '0 12px' }}>×</button>
            </div>
          ))}
          <button onClick={() => setFaltantes(p => [...p, { placa: '', fecha: iso(lunes), id_ruta: '', comentario: '' }])}
            style={{ border: '1px solid var(--orange)', background: '#fff', color: 'var(--orange)', borderRadius: 8, padding: '7px 14px', fontSize: 12.5, fontWeight: 600 }}>
            + Agregar una ruta que falta
          </button>

          <div style={{ marginTop: 14, borderTop: '1px solid var(--line)', paddingTop: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Evidencia (opcional)</div>
            <input type="file" multiple accept="image/*,application/pdf"
              onChange={e => setFotos([...e.target.files])} style={{ fontSize: 12.5 }} />
            {fotos.length > 0 && (
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>{fotos.length} archivo(s) listo(s)</div>
            )}
          </div>
        </div>
      )}

      {/* Cobros y ajustes que no pertenecen a un día: saldos de semanas
          anteriores, paquetes perdidos cargados a mano, reliquidaciones. Van al
          final y no dentro de un día, porque meterlos en uno sería inventarles
          una fecha que no tienen. */}
      {/* Cuándo se pagó. Sin esto el tercero tiene que preguntar, que es la
          mitad de las llamadas que recibe el analista. */}
      {pagada && !reclamando && (
        <div style={{ background: 'var(--green-soft)', color: 'var(--green)', borderRadius: 12,
          padding: '11px 16px', marginTop: 12, fontSize: 13, fontWeight: 600 }}>
          Esta semana ya se pagó{pagadoAt ? ` el ${fechaCorta(pagadoAt)}` : ''}.
          {prefSC[0]?.pago_referencia && (
            <span style={{ fontWeight: 400 }}> Referencia: {prefSC[0].pago_referencia}.</span>
          )}
        </div>
      )}

      {extrasSC.length > 0 && !reclamando && (
        <div style={{ background: '#f6f1ea', border: '1px solid #e0d3c2', borderRadius: 14, overflow: 'auto', marginBottom: 14 }}>
          <div style={{ padding: '12px 16px' }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: '#6b4f2a' }}>Agregados de la semana</div>
            <div style={{ fontSize: 11.5, color: '#8a7355', marginTop: 2, lineHeight: 1.5 }}>
              No pertenecen a un día: saldos anteriores, paquetes perdidos y reliquidaciones que el analista cargó a tu prefactura.
            </div>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 620 }}>
            <tbody>
              {lineasExtra.map(({ e, saldo }, i) => {
                const monto = Number(e.monto || 0)
                return (
                  <tr key={i}>
                    <td style={{ ...tdC, textAlign: 'left', width: 78, color: '#a08a6c', fontSize: 11.5, borderTop: '1px solid #e0d3c2' }}>
                      {e.fecha ? fechaCorta(e.fecha) : '—'}
                    </td>
                    <td style={{ ...tdC, textAlign: 'left', color: '#6b4f2a', borderTop: '1px solid #e0d3c2' }}>
                      {e.concepto}
                      {e.service_center && <div style={{ fontSize: 10.5, color: '#a08a6c' }}>{e.service_center}</div>}
                    </td>
                    <td style={{ ...tdC, color: 'var(--green)', borderTop: '1px solid #e0d3c2' }}>
                      {monto > 0 ? monto.toLocaleString('es-MX', { minimumFractionDigits: 2 }) : ''}
                    </td>
                    <td style={{ ...tdC, color: 'var(--red)', borderTop: '1px solid #e0d3c2' }}>
                      {monto < 0 ? Math.abs(monto).toLocaleString('es-MX', { minimumFractionDigits: 2 }) : ''}
                    </td>
                    <td style={{ ...tdC, fontWeight: 700, color: '#6b4f2a', borderTop: '1px solid #e0d3c2' }}>
                      {saldo.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* El cierre: de los totales al monto que efectivamente se transfiere. */}
      {!reclamando && dias.length > 0 && (
        <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              <tr>
                <td style={{ padding: '10px 16px', fontSize: 12.5, color: 'var(--muted)' }}>Abonos</td>
                <td style={{ padding: '10px 16px', fontSize: 13, textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{money(totalPagos + totalAjustes)}</td>
              </tr>
              <tr>
                <td style={{ padding: '10px 16px', fontSize: 12.5, color: 'var(--muted)', borderTop: '1px solid var(--line)' }}>Cargos</td>
                <td style={{ padding: '10px 16px', fontSize: 13, textAlign: 'right', fontWeight: 700, color: 'var(--red)', fontVariantNumeric: 'tabular-nums', borderTop: '1px solid var(--line)' }}>{money(totalCobros)}</td>
              </tr>
              <tr>
                <td style={{ padding: '10px 16px', fontSize: 13, fontWeight: 600, borderTop: '1px solid var(--line)' }}>Neto</td>
                <td style={{ padding: '10px 16px', fontSize: 14, textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums', borderTop: '1px solid var(--line)' }}>{money(totalNeto)}</td>
              </tr>
              {hayPrefactura && (
                <tr>
                  <td style={{ padding: '10px 16px', fontSize: 12.5, color: 'var(--muted)', borderTop: '1px solid var(--line)' }}>IVA 16%</td>
                  <td style={{ padding: '10px 16px', fontSize: 13, textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums', borderTop: '1px solid var(--line)' }}>{money(iva)}</td>
                </tr>
              )}
            </tbody>
            {hayPrefactura && (
              <tfoot>
                <tr style={{ background: 'var(--navy)' }}>
                  <td style={{ padding: '14px 16px', fontSize: 14, color: '#fff', fontWeight: 600 }}>
                    {pagada ? 'Pagado' : 'Total a pagar'}
                  </td>
                  <td style={{ padding: '14px 16px', fontSize: 19, color: '#fff', textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                    {money(totalBruto)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
          {!hayPrefactura && (
            <div style={{ padding: '10px 16px', fontSize: 11.5, color: 'var(--muted)', borderTop: '1px solid var(--line)' }}>
              La prefactura de esta semana todavía no se genera: el IVA y el total se calculan el lunes.
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Tot({ label, valor, grande, tenue, rojo }) {
  return (
    <div style={{ textAlign: 'right', minWidth: grande ? 118 : 88 }}>
      <div style={{ color: '#8fa6c9', fontSize: 10, letterSpacing: '.06em' }}>{label.toUpperCase()}</div>
      <div style={{
        color: rojo ? '#e8a87c' : tenue ? '#e4b9a0' : '#fff',
        fontSize: grande ? 22 : 15, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
        marginTop: 1,
      }}>{valor}</div>
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

function Nota({ color, bg, titulo, children }) {
  return (
    <div style={{ marginTop: 8, background: bg, color, borderRadius: 8, padding: '8px 10px', fontSize: 12.5 }}>
      <b>{titulo}:</b> {children}
    </div>
  )
}

const navBtn = { background: 'var(--navy-line)', color: '#fff', border: 'none', borderRadius: 8, width: 30, height: 30, fontSize: 16, lineHeight: 1 }
const inp = { border: '1px solid var(--line)', borderRadius: 6, padding: '7px 10px', fontSize: 12.5 }
