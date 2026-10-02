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

// Los cobros por PNR no se reclaman: MELI ya rechazó el respaldo y el cargo
// pasó a facturación, así que no tiene reverso. Se marcan como inapelables en
// vez de dejar que el tercero levante una diferencia que nace rechazada.
const esInapelable = (m) => m.tipo === 'cobro'
  && (String(m.tipo_cobro || '').toLowerCase().includes('pnr')
    || /^pnr\b/i.test(String(m.concepto || '')))

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

export default function Movimientos({ tercero, email, onBack, fecha }) {
  // Si se llega desde un mensaje de una jornada concreta, se abre esa semana.
  const [lunes, setLunes] = useState(() =>
    lunesDe(/^\d{4}-\d{2}-\d{2}$/.test(fecha || '') ? new Date(fecha + 'T12:00:00') : new Date()))
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

  // Un reclamo se muestra en la semana de lo que reclama. En las semanas
  // siguientes ya no tiene contexto: el tercero veía el rechazo de una línea
  // que no aparece en pantalla.
  const difSemana = useMemo(() => {
    const vistas = new Set()
    for (const f of filas) {
      if (f.tipo === 'cobro' && f.cobro_id != null) vistas.add(`cobro|${f.cobro_id}`)
      else if (f.tipo === 'pago') vistas.add(`pago|${f.fecha}|${f.ref}`)
    }
    const desde = iso(lunes), hasta = iso(domingo)
    const enSemana = (f) => f && String(f) >= desde && String(f) <= hasta
    return misDif.filter(d => {
      const ls = d.diferencias_lineas || []
      // Por la línea reclamada, cuando ese movimiento está en el listado.
      if (ls.some(l => (l.cobro_id != null && vistas.has(`cobro|${l.cobro_id}`))
        || (l.id_ruta && vistas.has(`pago|${l.fecha}|${l.id_ruta}`)))) return true
      // Una ruta que falta no tiene movimiento: manda su propia fecha.
      if (ls.some(l => !l.cobro_id && !l.id_ruta && enSemana(l.fecha))) return true
      return ls.length === 0 && enSemana(String(d.creada_at).slice(0, 10))
    })
  }, [misDif, filas, lunes, domingo])

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

  // Detalle del resumen: qué compone los ajustes y qué los descuentos. Un
  // total sin su desglose obliga al tercero a reconstruirlo línea por línea.
  const lineasAjuste = useMemo(() =>
    extrasSC.filter(e => Number(e.monto || 0) > 0)
      .map(e => ({ concepto: `${e.concepto || 'Ajuste'}${e.service_center ? ` · ${e.service_center}` : ''}`,
                   monto: Number(e.monto || 0) })), [extrasSC])

  const lineasCobro = useMemo(() => [
    ...filasSC.filter(f => f.tipo === 'cobro').map(f => ({
      concepto: [f.concepto || 'Cobro', f.shipment_id ? `guía ${f.shipment_id}` : null, f.sc]
        .filter(Boolean).join(' · '),
      monto: Number(f.monto || 0),
    })),
    ...extrasSC.filter(e => Number(e.monto || 0) < 0).map(e => ({
      concepto: `${e.concepto || 'Cargo'}${e.service_center ? ` · ${e.service_center}` : ''}`,
      monto: Number(e.monto || 0),
    })),
  ], [filasSC, extrasSC])

  // El PDF se arma con una ventana de impresión: sin librerías nuevas, el
  // tercero elige "Guardar como PDF" y obtiene el mismo documento en cualquier
  // navegador, con el logo y los totales de la semana.
  const descargarPdf = () => {
    const esc = (t) => String(t ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))
    // Se recorre la misma lista que ve el tercero en pantalla, con su saldo
    // corrido: el PDF y la pantalla no pueden decir cosas distintas.
    let filasHtml = ''
    for (const l of lineas.filas) {
      if (l._sep) {
        const d = dias.find(x => x.fecha === l.fecha)
        filasHtml += `<tr class="dia"><td colspan="4">${esc(fechaLarga(l.fecha))}</td>` +
          `<td style="display:none"></td></tr>`
        continue
      }
      const m = l.m, n = Number(m.monto || 0)
      const detalle = m.tipo === 'cobro'
        ? [m.placa, m.concepto || 'Cobro', m.sc].filter(Boolean).join(' · ')
        : [m.placa, `Ruta ${m.ref || ''}`, m.sc, m.driver_name].filter(Boolean).join(' · ')
      filasHtml += `<tr>
        <td>${esc(detalle)}</td>
        <td class="n">${n > 0 && l.cuenta ? money(n) : ''}</td>
        <td class="n rojo">${n < 0 ? money(Math.abs(n)) : ''}</td>
        <td class="n">${l.cuenta ? money(l.saldo) : '—'}</td></tr>`
    }
    for (const { e, saldo } of lineasExtra) {
      filasHtml += `<tr>
        <td>${esc(e.concepto || 'Ajuste')}${e.service_center ? ` · ${esc(e.service_center)}` : ''}</td>
        <td class="n">${Number(e.monto) > 0 ? money(e.monto) : ''}</td>
        <td class="n rojo">${Number(e.monto) < 0 ? money(Math.abs(e.monto)) : ''}</td>
        <td class="n">${money(saldo)}</td></tr>`
    }

    const w = window.open('', '_blank')
    if (!w) { alert('Tu navegador bloqueó la ventana. Permite las ventanas emergentes y vuelve a intentarlo.'); return }
    w.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">
      <title>Movimientos semana ${semanaBrain(lunes)} · ${esc(tercero.nombre)}</title>
      <style>
        @page { size: A4; margin: 14mm }
        body { font-family: 'Open Sans', Arial, sans-serif; color: #1A1A1A; font-size: 11px; margin: 0 }
        .cab { display: flex; justify-content: space-between; align-items: flex-start;
               border-bottom: 3px solid #FF6600; padding-bottom: 10px; margin-bottom: 16px }
        .cab img { height: 30px }
        .cab .t { text-align: right }
        h1 { font-size: 17px; color: #002E5D; margin: 0 0 2px }
        .muted { color: #545454; font-size: 10.5px }
        table { width: 100%; border-collapse: collapse; margin-top: 10px }
        th { background: #002E5D; color: #fff; text-align: left; padding: 7px 9px; font-size: 10px;
             text-transform: uppercase; letter-spacing: .05em }
        td { padding: 6px 9px; border-bottom: 1px solid #E4E3E3 }
        td.n { text-align: right; white-space: nowrap }
        td.rojo { color: #D92D20 }
        tr.dia td { background: #F4F3F3; font-weight: 700; color: #002E5D }
        tr.tot td { font-weight: 700 }
        .res { width: 320px; margin-left: auto; margin-top: 14px }
        .res div { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #E4E3E3 }
        .res .final { border-bottom: none; border-top: 2px solid #002E5D; font-weight: 700;
                      font-size: 13px; color: #002E5D; margin-top: 4px; padding-top: 8px }
        .pie { margin-top: 22px; font-size: 9.5px; color: #545454; text-align: center }
      </style></head><body>
      <div class="cab">
        <img src="${window.location.origin}/bt_logo_color.png" alt="Bigticket">
        <div class="t">
          <h1>Movimientos · Semana ${semanaBrain(lunes)}</h1>
          <div class="muted">${esc(rango(lunes, domingo))}</div>
          <div class="muted">${esc(tercero.nombre)}${scSel !== 'todos' ? ` · ${esc(scSel)}` : ''}</div>
        </div>
      </div>
      <table>
        <tr><th>Ruta / detalle</th><th style="text-align:right">Abono</th>
            <th style="text-align:right">Cargo</th><th style="text-align:right">Saldo</th></tr>
        ${filasHtml}
      </table>
      <div class="res">
        <div><span>Tus rutas</span><span>${money(totalPagos)}</span></div>
        ${totalAjustes ? `<div><span>Ajustes a tu favor</span><span>${money(totalAjustes)}</span></div>` : ''}
        ${totalCobros ? `<div><span>Descuentos</span><span>−${money(Math.abs(totalCobros))}</span></div>` : ''}
        <div><span>Neto</span><span>${money(totalNeto)}</span></div>
        ${hayPrefactura ? `<div><span>IVA 16%</span><span>${money(iva)}</span></div>` : ''}
        <div class="final"><span>${pagada ? 'Pagado' : 'Total'}</span><span>${hayPrefactura ? money(totalBruto) : '—'}</span></div>
      </div>
      <p class="pie">Documento generado desde el Portal Transportista de Bigticket · ${new Date().toLocaleDateString('es-MX')}</p>
      </body></html>`)
    w.document.close()
    // Se espera al logo: si se imprime antes, el PDF sale sin él.
    w.onload = () => { w.focus(); w.print() }
  }

  const nSel = Object.keys(sel).length + faltantes.length
  const hayInapelables = useMemo(() => filas.some(esInapelable), [filas])

  const toggleSel = (m) => {
    if (esInapelable(m)) return
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
      const lineasSel = Object.entries(sel).filter(([k]) => !esInapelable(porClave[k] || {})).map(([k, comentario]) => {
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
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <nav className="ms-ruta" style={{ marginBottom: 14 }}>
        <a href="#" onClick={e => { e.preventDefault(); onBack() }}>Inicio</a>
        <span>›</span><span>Mi billetera</span>
        <span>›</span><span className="on">Movimientos</span>
      </nav>

      <div className="mv-cab">
        <h1 className="bt-titulo">Movimientos</h1>
        <button className="mv-descargar" onClick={() => descargarPdf()}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
          </svg>
          Descargar movimientos
        </button>
      </div>

      <div className="mv-barra">
        <div className="mv-semana">
          <button onClick={() => setLunes(sumaDias(lunes, -7))}
            disabled={iso(lunes) <= INICIO_PORTAL}
            title={iso(lunes) <= INICIO_PORTAL ? 'Es la primera semana disponible' : ''}>‹</button>
          <span className="mv-semana-t">
            <b>Semana {semanaBrain(lunes)}</b> · {rango(lunes, domingo)}
          </span>
          <button onClick={() => setLunes(sumaDias(lunes, 7))}>›</button>
        </div>

        {centros.length > 1 && (
          <div className="mv-centros">
            <span>Centro:</span>
            {['todos', ...centros].map(c => (
              <button key={c} onClick={() => setScSel(c)} className={scSel === c ? 'on' : ''}>
                {c === 'todos' ? 'Todos SVC' : c}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Resumen de la semana: primero lo que suma, después lo que resta, y el
          detalle de cada parte a la vista para que el total no sea un misterio. */}
      <div className="mv-resumen">
        <div className="mv-fila">
          <span>Tus rutas</span><b className="pos">+ {money(totalPagos)}</b>
        </div>

        {totalAjustes !== 0 && (
          <>
            <div className="mv-fila">
              <span>Ajustes a tu favor</span><b className="pos">+ {money(totalAjustes)}</b>
            </div>
            {lineasAjuste.map((l, i) => (
              <div key={i} className="mv-sub"><span>{l.concepto}</span><span>{money(l.monto)}</span></div>
            ))}
          </>
        )}

        {totalCobros !== 0 && (
          <>
            <div className="mv-fila">
              <span>Descuentos</span><b className="neg">− {money(Math.abs(totalCobros))}</b>
            </div>
            {lineasCobro.map((l, i) => (
              <div key={i} className="mv-sub"><span>{l.concepto}</span><span>{money(l.monto)}</span></div>
            ))}
          </>
        )}

        <div className="mv-fila fuerte"><span>Neto</span><b>{money(totalNeto)}</b></div>
        {hayPrefactura && <div className="mv-fila"><span>IVA 16%</span><b>+ {money(iva)}</b></div>}
        <div className="mv-fila total">
          <span>{pagada ? 'Pagado' : 'Total'}</span>
          <b>{hayPrefactura ? money(totalBruto) : '—'}</b>
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
              {hayInapelables && <span style={{ color: 'var(--muted)' }}> Los cobros por PNR no se pueden marcar: MELI rechaza sus respaldos y ya pasaron a facturación.</span>}
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
      {difSemana.length > 0 && !reclamando && (
        <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14, marginBottom: 14, overflow: 'hidden' }}>
          <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--line)', fontSize: 14, fontWeight: 600, color: 'var(--navy)' }}>
            Mis diferencias
          </div>
          {difSemana.map(d => {
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
        <>
        <h2 className="mv-detalle-t">Detalle de movimientos por día</h2>
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
                const inapelable = esInapelable(m)
                const monto = Number(m.monto || 0)
                const rec = esCobro ? reclamadas[`cobro|${m.cobro_id}`] : reclamadas[`pago|${m.fecha}|${m.ref}`]
                return (
                  <tr key={k} style={{ background: marcado ? 'var(--orange-soft)' : 'transparent' }}>
                    {reclamando && (
                      <td style={{ ...tdC, width: 34 }}>
                        <input type="checkbox" checked={marcado} disabled={inapelable}
                          onChange={() => toggleSel(m)}
                          title={inapelable ? 'Los cobros por PNR no admiten reclamo' : ''}
                          style={{ width: 16, height: 16, accentColor: 'var(--orange)',
                            cursor: inapelable ? 'not-allowed' : 'pointer', opacity: inapelable ? 0.3 : 1 }} />
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
                        {inapelable && (
                          <span title="MELI rechaza los respaldos de un PNR facturado, así que este cobro no se puede reclamar"
                            style={{ fontSize: 9.5, fontWeight: 700, padding: '1px 7px', borderRadius: 20, background: '#EFEFEF', color: 'var(--muted)' }}>
                            INAPELABLE
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
        </>
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
