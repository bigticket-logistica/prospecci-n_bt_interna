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
import { esMovil } from './ArmazonMovil'
import { guardarPdf } from './archivos'

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
  const [conFactura, setConFactura] = useState(new Set())  // prefacturas que ya tienen factura
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
  // En el teléfono la cartola no cabe como tabla: cinco columnas en 390px
  // obligan a desplazarse de lado. Se dibuja como lista, con los mismos datos.
  const movil = esMovil()

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
      .select('id, service_center, total_neto, iva_16, total_bruto, liquido_pago, pagado_at, pago_referencia')
      .eq('tercero_id', tercero.tercero_id)
      .eq('semana', sem)
    setPrefs(pf || [])
    // Qué prefacturas ya tienen factura: si falta, la web muestra la franja
    // "Falta tu factura" (Maqueta 8.9.8). Es la misma regla de "Por facturar".
    const ids = (pf || []).map(x => x.id).filter(Boolean)
    if (ids.length) {
      const { data: fx } = await supabase.from('facturas_tercero').select('conciliacion_id').in('conciliacion_id', ids)
      setConFactura(new Set((fx || []).map(x => x.conciliacion_id)))
    } else setConFactura(new Set())

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

  // El PDF se genera acá mismo con jsPDF y se descarga como archivo. Antes se
  // abría una ventana para imprimir, que en la aplicación de Android no hacía
  // nada: el WebView no abre ventanas ni imprime. En la app se abre el menú de
  // compartir, para guardarlo o mandarlo.
  const [armandoPdf, setArmandoPdf] = useState(false)
  const descargarPdf = async () => {
    if (armandoPdf) return
    setArmandoPdf(true)
    try {
      const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
      // Las fuentes estándar de un PDF no traen el signo menos tipográfico ni
      // las rayas largas: se cambian por el guion común para que no salgan
      // como cuadros.
      const t = (x) => String(x ?? '').replace(/[−–—]/g, '-').replace(/[^\x00-\xFF]/g, '')
      const pm = (n) => (Number(n) < 0 ? '-' : '') + '$' +
        Math.abs(Number(n || 0)).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      const NAVY = [0, 46, 93], NARANJA = [255, 102, 0], ROJO = [217, 45, 32], GRIS = [84, 84, 84]

      const doc = new jsPDF({ unit: 'mm', format: 'a4' })
      const W = doc.internal.pageSize.getWidth()
      const M = 14

      // Logo: se dibuja en un lienzo para obtener su tamaño real y no deformarlo.
      try {
        const img = await new Promise((ok, mal) => {
          const i = new Image(); i.onload = () => ok(i); i.onerror = mal; i.src = '/bt_logo_color.png'
        })
        const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight
        c.getContext('2d').drawImage(img, 0, 0)
        const alto = 9, ancho = alto * img.naturalWidth / img.naturalHeight
        doc.addImage(c.toDataURL('image/png'), 'PNG', M, 12, ancho, alto)
      } catch { /* sin logo, el documento sirve igual */ }

      const sem = semanaBrain(lunes)
      doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor(...NAVY)
      doc.text(t(`Movimientos · Semana ${sem}`), W - M, 15, { align: 'right' })
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(...GRIS)
      doc.text(t(rango(lunes, domingo)), W - M, 20.5, { align: 'right' })
      doc.text(t(`${tercero.nombre}${scSel !== 'todos' ? ` · ${scSel}` : ''}`), W - M, 25, { align: 'right' })
      doc.setDrawColor(...NARANJA); doc.setLineWidth(0.9); doc.line(M, 29, W - M, 29)

      // Las mismas líneas que ve el tercero en pantalla, con su saldo corrido:
      // el PDF y la pantalla no pueden decir cosas distintas.
      const cuerpo = []
      for (const l of lineas.filas) {
        if (l._sep) {
          cuerpo.push([{ content: t(fechaLarga(l.fecha)), colSpan: 4,
            styles: { fillColor: [244, 243, 243], fontStyle: 'bold', textColor: NAVY } }])
          continue
        }
        const m = l.m, n = Number(m.monto || 0)
        const detalle = m.tipo === 'cobro'
          ? [m.placa, m.concepto || 'Cobro', m.sc].filter(Boolean).join(' · ')
          : [m.placa, `Ruta ${m.ref || ''}`, m.sc, m.driver_name].filter(Boolean).join(' · ')
        cuerpo.push([
          t(detalle) + (l.cuenta ? '' : ' (pendiente)'),
          n > 0 && l.cuenta ? pm(n) : '',
          { content: n < 0 ? pm(Math.abs(n)) : '', styles: { textColor: ROJO } },
          l.cuenta ? pm(l.saldo) : '-',
        ])
      }
      if (lineasExtra.length) {
        cuerpo.push([{ content: 'Agregados de la semana', colSpan: 4,
          styles: { fillColor: [246, 241, 234], fontStyle: 'bold', textColor: [107, 79, 42] } }])
        for (const { e, saldo } of lineasExtra) {
          const n = Number(e.monto || 0)
          cuerpo.push([
            t(`${e.concepto || 'Ajuste'}${e.service_center ? ` · ${e.service_center}` : ''}`),
            n > 0 ? pm(n) : '',
            { content: n < 0 ? pm(Math.abs(n)) : '', styles: { textColor: ROJO } },
            pm(saldo),
          ])
        }
      }

      autoTable(doc, {
        startY: 34, margin: { left: M, right: M },
        head: [['Ruta / detalle', 'Abono', 'Cargo', 'Saldo']],
        body: cuerpo.length ? cuerpo : [[{ content: 'Sin movimientos esta semana.', colSpan: 4 }]],
        styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 2.2, textColor: [26, 26, 26], lineColor: [228, 227, 227], lineWidth: { bottom: 0.2 } },
        headStyles: { fillColor: NAVY, textColor: 255, fontStyle: 'bold', fontSize: 8 },
        columnStyles: { 1: { halign: 'right', cellWidth: 26 }, 2: { halign: 'right', cellWidth: 26 }, 3: { halign: 'right', cellWidth: 28 } },
        didParseCell: (d) => { if (d.section === 'head' && d.column.index > 0) d.cell.styles.halign = 'right' },
      })

      // El resumen, alineado a la derecha como en la versión anterior.
      const res = [
        ['Tus rutas', pm(totalPagos)],
        ...(totalAjustes ? [['Ajustes a tu favor', pm(totalAjustes)]] : []),
        ...(totalCobros ? [['Descuentos', pm(totalCobros)]] : []),
        ['Neto', pm(totalNeto)],
        ...(hayPrefactura ? [['IVA 16%', pm(iva)]] : []),
      ]
      autoTable(doc, {
        startY: doc.lastAutoTable.finalY + 6, margin: { left: W - M - 80, right: M }, tableWidth: 80,
        body: res,
        foot: [[pagada ? 'Pagado' : 'Total', hayPrefactura ? pm(totalBruto) : 'Se calcula el lunes']],
        styles: { font: 'helvetica', fontSize: 9, cellPadding: 1.8, textColor: [26, 26, 26], lineColor: [228, 227, 227], lineWidth: { bottom: 0.2 } },
        footStyles: { fillColor: 255, textColor: NAVY, fontStyle: 'bold', fontSize: 10.5, lineColor: NAVY, lineWidth: { top: 0.6 } },
        columnStyles: { 1: { halign: 'right' } },
        didParseCell: (d) => { if (d.section === 'foot' && d.column.index === 1) d.cell.styles.halign = 'right' },
      })

      doc.setFontSize(8); doc.setTextColor(...GRIS)
      doc.text(t(`Documento generado desde el Portal Transportista de Bigticket · ${new Date().toLocaleDateString('es-MX')}`),
        W / 2, doc.lastAutoTable.finalY + 12, { align: 'center' })

      const limpio = (x) => String(x || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w]+/g, '_').replace(/^_|_$/g, '')
      await guardarPdf(doc, `movimientos_semana_${sem}_${limpio(tercero.nombre)}.pdf`)
    } catch (e) {
      console.error('No se pudo armar el PDF:', e)
      alert('No se pudo generar el PDF. Vuelve a intentarlo en un momento.')
    }
    setArmandoPdf(false)
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

  // Lo que el tercero escribe en cada línea marcada. Sin este campo el envío
  // siempre se frenaba en "Escribe qué reclamas", porque no había dónde.
  const comentar = (k, v) => setSel(p => (k in p ? { ...p, [k]: v } : p))

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

  if (!movil) return (
    <MovimientosWeb
      tercero={tercero} email={email} lunes={lunes} setLunes={setLunes} domingo={domingo}
      cargando={cargando} error={error} filasSC={filasSC} extrasSC={extrasSC} centros={centros}
      scSel={scSel} setScSel={setScSel} totalPagos={totalPagos} totalCobros={totalCobros}
      totalAjustes={totalAjustes} totalNeto={totalNeto} iva={iva} totalBruto={totalBruto}
      hayPrefactura={hayPrefactura} pagada={pagada} pagadoAt={pagadoAt}
      faltaFactura={hayPrefactura && !pagada && prefSC.some(x => !x.pagado_at && !conFactura.has(x.id))}
      lineasAjuste={lineasAjuste} descargarPdf={descargarPdf} armandoPdf={armandoPdf}
      reclamadas={reclamadas} alEnviar={cargarDif} />
  )

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <nav className="ms-ruta" style={{ marginBottom: 14 }}>
        <a href="#" onClick={e => { e.preventDefault(); onBack() }}>Inicio</a>
        <span>›</span><span>Mi billetera</span>
        <span>›</span><span className="on">Movimientos</span>
      </nav>

      <div className="mv-cab bm-solo-escritorio">
        <h1 className="bt-titulo">Movimientos</h1>
        <button className="mv-descargar" onClick={() => descargarPdf()}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
          </svg>
          {armandoPdf ? 'Generando PDF…' : 'Descargar movimientos'}
        </button>
      </div>

      <div className="mv-barra">
        <div className="mv-semana">
          <button onClick={() => setLunes(sumaDias(lunes, -7))}
            disabled={iso(lunes) <= INICIO_PORTAL}
            title={iso(lunes) <= INICIO_PORTAL ? 'Es la primera semana disponible' : ''}>‹</button>
          <span className="mv-semana-t">
            <b>Semana {semanaBrain(lunes)}</b><span className="bm-sep"> · </span><span className="bm-rango">{rango(lunes, domingo)}</span>
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
      {movil ? (
        <div className="bm-hero">
          <div className="bm-rotulo">
            {pagada ? 'PAGADO' : hayPrefactura ? 'TOTAL A PAGAR' : 'NETO DE LA SEMANA'}
          </div>
          <div className="bm-monto">{money(hayPrefactura ? totalBruto : totalNeto)}</div>
          <div className="bm-fecha">
            {pagada
              ? `Se pagó el ${fechaCorta(pagadoAt)}${prefSC[0]?.pago_referencia ? ` · ref. ${prefSC[0].pago_referencia}` : ''}`
              : hayPrefactura ? 'Con IVA incluido' : 'Sin IVA: el total se calcula el lunes'}
          </div>
          <div className="bm-celdas">
            <div><b className="pos">{money(totalPagos)}</b><span>Tus rutas</span></div>
            <div><b className={totalCobros ? 'neg' : ''}>{totalCobros ? money(totalCobros) : '—'}</b><span>Descuentos</span></div>
            <div><b className="pos">{totalAjustes ? money(totalAjustes) : '—'}</b><span>Ajustes a tu favor</span></div>
            <div><b>{hayPrefactura ? money(iva) : '—'}</b><span>IVA 16%</span></div>
          </div>
        </div>
      ) : (
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
      )}

      {enviado && (
        <div style={{ background: 'var(--green-soft)', color: 'var(--green)', borderRadius: 12, padding: '14px 16px', marginBottom: 12, fontSize: 13.5 }}>
          <b>Diferencia #{enviado} enviada.</b> La revisa un analista y te responde acá mismo.
          Vas a ver el avance en esta misma pantalla.
        </div>
      )}

      {/* Barra de reclamo */}
      <div className="bm-reclamo" style={{
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
        <h2 className="mv-detalle-t">{movil ? 'Movimientos por día' : 'Detalle de movimientos por día'}</h2>
        {movil ? (
          <ListaMovil lineas={lineas} reclamando={reclamando} sel={sel} toggleSel={toggleSel}
            pagada={pagada} reclamadas={reclamadas} esInapelable={esInapelable} comentar={comentar} />
        ) : (
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
                      {marcado && (
                        <input value={sel[k]} onChange={e => comentar(k, e.target.value)} autoFocus
                          placeholder="¿Qué reclamas en esta línea?"
                          style={{ ...inp, width: '100%', marginTop: 8, background: '#fff' }} />
                      )}
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
                placeholder="Placa" className="bm-campo" style={{ ...inp, width: 110 }} />
              <input type="date" value={f.fecha} onChange={e => setFaltantes(p => p.map((x, j) => j === i ? { ...x, fecha: e.target.value } : x))}
                className="bm-campo" style={{ ...inp, width: 150 }} />
              <input value={f.id_ruta} onChange={e => setFaltantes(p => p.map((x, j) => j === i ? { ...x, id_ruta: e.target.value } : x))}
                placeholder="Id de ruta (si lo tienes)" className="bm-campo" style={{ ...inp, width: 180 }} />
              <input value={f.comentario} onChange={e => setFaltantes(p => p.map((x, j) => j === i ? { ...x, comentario: e.target.value } : x))}
                placeholder="¿Qué ocurrió?" className="bm-campo" style={{ ...inp, flex: 1, minWidth: 180 }} />
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
      {pagada && !reclamando && !movil && (
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
          {movil ? (
            <div>
              {lineasExtra.map(({ e }, i) => {
                const monto = Number(e.monto || 0)
                return (
                  <div key={i} className="bm-extra">
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div className="bm-extra-t">{e.concepto}</div>
                      <div className="bm-extra-s">{e.fecha ? fechaCorta(e.fecha) : 'Sin fecha'}{e.service_center ? ` · ${e.service_center}` : ''}</div>
                    </div>
                    <b className={monto < 0 ? 'neg' : 'pos'}>{monto < 0 ? '− ' : '+ '}{money(Math.abs(monto))}</b>
                  </div>
                )
              })}
            </div>
          ) : (
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
          )}
        </div>
      )}

      {/* El cierre: de los totales al monto que efectivamente se transfiere. */}
      {!reclamando && dias.length > 0 && !movil && (
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

      {movil && !reclamando && (
        <button className="bm-accion bm-secundaria" onClick={() => descargarPdf()}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
          </svg>
          {armandoPdf ? 'Generando PDF…' : 'Descargar movimientos en PDF'}
        </button>
      )}
    </div>
  )
}

// ── La cartola en el teléfono ───────────────────────────────────────────────
// Un bloque por día. Cada línea muestra a la izquierda qué fue y a la derecha
// cuánto sumó o restó, con el saldo corrido debajo en gris. El detalle fino
// (conductor, NS, guía) va en una segunda línea, igual que en la tabla.
function ListaMovil({ lineas, reclamando, sel, toggleSel, pagada, reclamadas, esInapelable, comentar }) {
  const bloques = []
  let actual = null
  for (const ln of lineas.filas) {
    if (ln._sep) { actual = { fecha: ln.fecha, filas: [] }; bloques.push(actual); continue }
    if (!actual) { actual = { fecha: null, filas: [] }; bloques.push(actual) }
    actual.filas.push(ln)
  }

  return (
    <div style={{ marginBottom: 14 }}>
      {bloques.map((b, bi) => (
        <section key={b.fecha || bi} className="bm-dia">
          {b.fecha && <div className="bm-dia-t">{fechaLarga(b.fecha)}</div>}
          <div className="bm-tarjeta bm-lista">
            {b.filas.map(ln => {
              const m = ln.m
              const k = claveDe(m)
              const marcado = k in sel
              const tabla = pagada ? ESTADOS_PAGADOS : ESTADOS
              const est = tabla[m.estado] || tabla.aprobada
              const esCobro = m.tipo === 'cobro'
              const inapelable = esInapelable(m)
              const monto = Number(m.monto || 0)
              const rec = esCobro ? reclamadas[`cobro|${m.cobro_id}`] : reclamadas[`pago|${m.fecha}|${m.ref}`]
              const recE = rec ? (EST_DIF[rec.estado] || EST_DIF.abierta) : null
              return (
                <div key={k} className={`bm-linea${marcado ? ' marcada' : ''}${reclamando && inapelable ? ' bloqueada' : ''}`}
                  onClick={e => { if (reclamando && !inapelable && e.target.tagName !== 'INPUT') toggleSel(m) }}
                  style={{ cursor: reclamando && !inapelable ? 'pointer' : 'default' }}>
                  {reclamando && (
                    <input type="checkbox" checked={marcado} disabled={inapelable}
                      onChange={() => toggleSel(m)} className="bm-check" aria-label="Marcar esta línea" />
                  )}
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="bm-linea-t">
                      {esCobro ? (m.concepto || 'Cobro') : `Ruta ${m.ref}`}
                    </div>
                    <div className="bm-linea-s">
                      {[m.placa, m.sc].filter(Boolean).join(' · ')}
                      {esCobro
                        ? <>{m.shipment_id ? ` · guía ${m.shipment_id}` : ''}{m.fecha_hecho ? ` · ${m.tipo_cobro === 'noshow' ? 'del día' : 'ruta del'} ${fechaCorta(m.fecha_hecho)}` : ''}</>
                        : <>{m.driver_name ? ` · ${m.driver_name}` : ''}
                            {m.ns_pct != null && ` · NS ${Number(m.ns_pct).toFixed(1)}%`}
                            {m.tiene_auxiliar && m.monto_auxiliar ? ` · ayudante ${money(m.monto_auxiliar)}` : ''}</>}
                    </div>
                    {m.motivo && <div className="bm-linea-s" style={{ color: 'var(--red)' }}>{m.motivo}</div>}
                    {(m.estado !== 'aprobada' || inapelable || rec) && (
                      <div className="bm-pills">
                        {m.estado !== 'aprobada' && <span style={{ background: est.bg, color: est.fg }}>{est.label}</span>}
                        {inapelable && <span style={{ background: '#EFEFEF', color: 'var(--muted)' }}>Inapelable</span>}
                        {rec && <span style={{ background: recE.bg, color: recE.fg }}>Diferencia #{rec.folio}</span>}
                      </div>
                    )}
                  </div>
                  <div className="bm-linea-m">
                    <b className={!ln.cuenta ? 'gris' : monto < 0 ? 'neg' : 'pos'}>
                      {monto < 0 ? '− ' : '+ '}{money(Math.abs(monto))}
                    </b>
                    {ln.cuenta && <small>saldo {money(ln.saldo)}</small>}
                  </div>
                  {marcado && (
                    <input className="bm-comentario" value={sel[k]} autoFocus
                      onChange={e => comentar(k, e.target.value)}
                      placeholder="¿Qué reclamas en esta línea?" />
                  )}
                </div>
              )
            })}
          </div>
        </section>
      ))}
      <div className="bm-subtotal">
        <span>Subtotal de los días</span>
        <b>{money(lineas.saldoDias)}</b>
      </div>
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

// ═══════════════════════════════════════════════════════════════════════════
// Movimientos en la web · Maqueta 8.9.8
//
// Semana, tarjeta de pago, resumen, filtro por site y la tabla por día. El
// modo "Informar diferencia" marca líneas y abre un formulario por cada una;
// cada formulario se envía por separado y abre su propia diferencia con folio.
// En el teléfono sigue la vista de siempre (más arriba).
// ═══════════════════════════════════════════════════════════════════════════
const MESES_L = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const DIAS_L = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const MESES_C = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const aFecha = (s) => (s instanceof Date ? s : new Date(String(s).slice(0, 10) + 'T12:00:00'))
// "Semana 39 · 14 al 20 de septiembre" (o "28 de septiembre al 4 de octubre")
const rangoSemana = (a, b) => a.getMonth() === b.getMonth()
  ? `${a.getDate()} al ${b.getDate()} de ${MESES_L[b.getMonth()]}`
  : `${a.getDate()} de ${MESES_L[a.getMonth()]} al ${b.getDate()} de ${MESES_L[b.getMonth()]}`
// "Viernes 2 de octubre"
const diaLargo = (d) => { const x = aFecha(d); return `${DIAS_L[x.getDay()]} ${x.getDate()} de ${MESES_L[x.getMonth()]}` }
// "Miércoles 16 sep"
const diaCorto = (d) => { const x = aFecha(d); return `${DIAS_L[x.getDay()]} ${x.getDate()} ${MESES_C[x.getMonth()]}` }
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`
// Montos de la tabla: "$1,890.00" y los descuentos con "−".
const pesosT = (n) => (Number(n) < 0 ? '−' : '') + '$' + Math.abs(Number(n || 0)).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// Descuentos que no llevan selector de motivo (elemento 8 de la maqueta).
const DESC_FIJO = /paquete perdido|pnr|no devuelto/i
const MOTIVOS_DESC = ['Ruta pendiente', 'Paquete perdido', 'Paquete no devuelto (PNR)', 'Adicional por ayudante', 'Otro']
const MOTIVOS_RUTA = ['No pago de ayudante', 'Diferencia por tarifa', 'No reconozco esta ruta', 'Otros']
const EVIDENCIA_ACEPTA = '.jpg,.jpeg,.png,.pdf'

function MovimientosWeb({
  tercero, email, lunes, setLunes, domingo, cargando, error, filasSC, extrasSC, centros, scSel, setScSel,
  totalPagos, totalCobros, totalAjustes, totalNeto, iva, totalBruto, hayPrefactura, pagada, pagadoAt,
  faltaFactura, lineasAjuste, descargarPdf, armandoPdf, reclamadas, alEnviar,
}) {
  const [toggle, setToggle] = useState({})        // fecha -> abierto (lo que eligió el tercero)
  const [modo, setModo] = useState(false)         // modo informar diferencia
  const [forms, setForms] = useState({})          // clave de línea -> formulario
  const [nuevas, setNuevas] = useState({})        // fecha -> [formulario de ruta que no aparece]
  const [enviando, setEnviando] = useState(null)
  const [recibida, setRecibida] = useState(null)  // datos del modal de confirmación
  const ir = (v) => window.dispatchEvent(new CustomEvent('bt:ir', { detail: v }))

  // ── Las líneas de cada día, con el saldo corrido ─────────────────────────
  const desde = iso(lunes), hasta = iso(domingo)
  const { grupos, totPagamos, totDescontamos, saldoFinal } = useMemo(() => {
    const items = []
    for (const m of filasSC) {
      const esCobro = m.tipo === 'cobro'
      const cuenta = m.estado === 'aprobada' || esCobro
      items.push({
        key: claveDe(m), fecha: m.fecha, clase: esCobro ? 'cobro' : 'ruta', m,
        monto: Number(m.monto || 0), cuenta,
        titulo: esCobro ? (m.concepto || 'Descuento') : [m.sc, m.ref ? `Ruta ${m.ref}` : null].filter(Boolean).join(' · '),
        sub: esCobro
          ? [m.sc, m.ref ? `Ruta ${m.ref}` : null, m.placa].filter(Boolean).join(' · ')
          : [m.driver_name || 'Sin conductor', m.placa].filter(Boolean).join(' · '),
        estado: m.estado,
        sc: m.sc || '', idRuta: m.ref || '', placa: m.placa || '', idGuia: m.shipment_id || '',
      })
    }
    extrasSC.forEach((e, i) => {
      const monto = Number(e.monto || 0)
      const f = e.fecha && String(e.fecha).slice(0, 10)
      items.push({
        key: `extra|${i}`, fecha: f && f >= desde && f <= hasta ? f : null,
        clase: monto < 0 ? 'cargo' : 'ajuste', e, monto, cuenta: true,
        titulo: e.concepto || (monto < 0 ? 'Descuento' : 'Ajuste a tu favor'),
        sub: [e.service_center, e.detalle || e.descripcion].filter(Boolean).join(' · '),
        sc: e.service_center || '', idRuta: '', placa: '', idGuia: '',
      })
    })
    const porFecha = new Map()
    for (const it of items) {
      const k = it.fecha || 'zz'
      if (!porFecha.has(k)) porFecha.set(k, [])
      porFecha.get(k).push(it)
    }
    let saldo = 0, pag = 0, des = 0
    const gs = [...porFecha.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([fecha, ls]) => {
      // Las líneas van en el orden en que llegan, y los ajustes y cargos de la
      // prefactura al final del día.
      ls.sort((a, b) => (a.e ? 1 : 0) - (b.e ? 1 : 0))
      let p = 0, d = 0
      for (const it of ls) {
        if (it.cuenta) { saldo += it.monto; if (it.monto >= 0) p += it.monto; else d += it.monto }
        it.saldo = saldo
      }
      pag += p; des += d
      const nRutas = ls.filter(x => x.clase === 'ruta').length
      const nDesc = ls.filter(x => x.clase === 'cobro' || x.clase === 'cargo').length
      const nAj = ls.filter(x => x.clase === 'ajuste').length
      return {
        fecha: fecha === 'zz' ? null : fecha, lineas: ls, pagamos: p, descontamos: d, saldo,
        meta: [nRutas && plural(nRutas, 'ruta', 'rutas'), nDesc && plural(nDesc, 'descuento', 'descuentos'), nAj && plural(nAj, 'ajuste', 'ajustes')].filter(Boolean).join(' · '),
        destacado: nDesc > 0 || nAj > 0,
      }
    })
    return { grupos: gs, totPagamos: pag, totDescontamos: des, saldoFinal: saldo }
  }, [filasSC, extrasSC, desde, hasta])

  const abierto = (g) => modo || (toggle[g.fecha || 'zz'] ?? g.destacado)

  // ── Resumen de la semana ─────────────────────────────────────────────────
  const rutasOk = filasSC.filter(f => f.tipo === 'pago' && f.estado === 'aprobada')
  const nSites = new Set([...filasSC.map(f => f.sc), ...extrasSC.map(e => e.service_center)].filter(Boolean)).size
  const infoRutas = `${plural(rutasOk.length, 'ruta', 'rutas')} en ${plural(nSites, 'site', 'sites')}`
  const infoAjustes = lineasAjuste.map(l => l.concepto).join(', ')
  // Se paga el viernes de la semana siguiente a la prefactura del lunes.
  const fechaPago = pagada && pagadoAt ? pagadoAt : iso(sumaDias(domingo, 12))

  // ── Modo informar diferencia ─────────────────────────────────────────────
  const tipoForm = (it) => {
    if (it.clase === 'cobro' || it.clase === 'cargo') return DESC_FIJO.test(it.titulo) ? 'desc_fijo' : 'desc_otro'
    return 'sin_desc'
  }
  const nuevoForm = (it, fecha) => ({
    motivo: it && tipoForm(it) === 'desc_fijo' ? it.titulo : '',
    sc: it?.sc || '', idRuta: it?.idRuta || '', placa: it?.placa || '', idGuia: it?.idGuia || '',
    fecha: fecha || it?.fecha || '', comentario: '', archivos: [],
  })
  const marcar = (it) => setForms(p => {
    const n = { ...p }
    if (n[it.key]) delete n[it.key]; else n[it.key] = nuevoForm(it, it.fecha)
    return n
  })
  const setCampo = (k, campo, v) => setForms(p => ({ ...p, [k]: { ...p[k], [campo]: v } }))
  const salir = () => { setModo(false); setForms({}); setNuevas({}) }
  const nMarcadas = Object.keys(forms).length

  const agregarNueva = (g) => {
    const ultima = [...g.lineas].reverse().find(x => x.clase === 'ruta') || g.lineas[g.lineas.length - 1]
    setNuevas(p => ({ ...p, [g.fecha]: [...(p[g.fecha] || []), { ...nuevoForm(null, g.fecha), sc: ultima?.sc || '', placa: ultima?.placa || '' }] }))
  }
  const setNueva = (fecha, i, campo, v) => setNuevas(p => ({ ...p, [fecha]: p[fecha].map((x, j) => j === i ? { ...x, [campo]: v } : x) }))
  const quitarNueva = (fecha, i) => setNuevas(p => ({ ...p, [fecha]: p[fecha].filter((_, j) => j !== i) }))

  // Qué falta en un formulario, según su tipo y el motivo elegido.
  const faltan = (tipo, f) => {
    const req = ['sc', 'placa', 'comentario']
    if (tipo === 'desc_fijo') req.push('idRuta', 'idGuia', 'archivos')
    if (tipo === 'desc_otro') req.push('motivo', 'idRuta', 'idGuia', 'fecha', 'archivos')
    if (tipo === 'sin_desc') { req.push('motivo', 'fecha'); if (f.motivo !== 'No reconozco esta ruta') req.push('idRuta') }
    if (tipo === 'nueva') req.push('fecha')
    return req.filter(c => (c === 'archivos' ? !f.archivos?.length : !String(f[c] || '').trim()))
  }

  const enviar = async (clave, tipo, f, it) => {
    if (faltan(tipo, f).length) { alert('Completa los campos marcados con *.'); return }
    setEnviando(clave)
    try {
      const m = it?.m
      const linea = {
        tipo: tipo === 'nueva' ? 'faltante' : (it.clase === 'cobro' ? 'cobro' : 'ruta'),
        fecha: f.fecha || it?.fecha || null,
        id_ruta: f.idRuta.trim() || null,
        cobro_id: it?.clase === 'cobro' ? m.cobro_id : null,
        cobro_origen: it?.clase === 'cobro' ? (m.tipo_cobro || null) : null,
        concepto: it ? [it.titulo, f.idGuia ? `guía ${f.idGuia}` : null].filter(Boolean).join(' · ') : null,
        placa: f.placa.trim(), monto_ref: it ? Math.abs(it.monto) : null,
        comentario: f.comentario.trim(), motivo: f.motivo || null, sc: f.sc.trim() || null, id_guia: f.idGuia.trim() || null,
      }
      const { data: dif, error: eDif } = await supabase.from('diferencias').insert({
        tercero_id: tercero.tercero_id, service_center: linea.sc,
        monto_reclamado: Number(linea.monto_ref || 0), creada_por: email || tercero.nombre,
      }).select('id, folio').single()
      if (eDif) throw eDif
      const { error: eLin } = await supabase.from('diferencias_lineas').insert({ ...linea, diferencia_id: dif.id })
      if (eLin) throw eLin
      for (const file of f.archivos || []) {
        const path = `diferencias/${dif.id}/${Date.now()}_${file.name.replace(/[^\w.\-]/g, '_')}`
        const { error: eUp } = await supabase.storage.from(BUCKET).upload(path, file)
        if (!eUp) await supabase.from('diferencias_adjuntos').insert({ diferencia_id: dif.id, storage_path: path, nombre: file.name, subido_por: email || tercero.nombre })
      }
      await supabase.from('diferencias_eventos').insert({
        diferencia_id: dif.id, tipo: 'creada', actor: email || tercero.nombre,
        detalle: `${linea.motivo || 'Diferencia'}${f.archivos?.length ? ` · ${f.archivos.length} adjunto(s)` : ''}`,
      })
      const { error: eAbrir } = await supabase.rpc('fn_abrir_diferencia', { p_dif: dif.id })
      if (eAbrir) alert(`Tu diferencia #${dif.folio} quedó registrada, pero no se pudo avisar al supervisor.\n\nAvísanos por el chat de consultas citando ese número.`)
      try {
        const { data: payload } = await supabase.rpc('fn_payload_aviso_diferencia', { p_dif: dif.id })
        if (payload) await fetch('https://bigticket2026.app.n8n.cloud/webhook/diferencia-notificar', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
        })
      } catch (e) { console.error('No se pudo enviar el aviso por correo:', e) }
      setRecibida({ linea: it ? it.titulo : 'Ruta que no aparece', site: linea.sc || '—', folio: dif.folio, monto: it ? it.monto : null })
      if (alEnviar) alEnviar()
    } catch (e) {
      alert('No se pudo enviar la diferencia:\n\n' + (e.message || e))
    }
    setEnviando(null)
  }

  const iconoSemana = (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  )

  return (
    <div className="mw">
      <nav className="ms-ruta">
        <button className="rc-volver" onClick={() => window.dispatchEvent(new Event('bt:atras'))}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
          Volver
        </button>
        <span className="rc-sep" aria-hidden="true" />
        <a href="#" onClick={e => { e.preventDefault(); ir('home') }}>Inicio</a>
        <Chev12 /><span>Mi billetera</span>
        <Chev12 /><span aria-current="page">Movimientos</span>
      </nav>
      <h1 className="mw-titulo">Movimientos</h1>

      {/* 2 · Semana y descarga */}
      <div className="week-bar">
        <div className="week-nav">
          <button className="week-arrow" aria-label="Semana anterior" onClick={() => setLunes(sumaDias(lunes, -7))}
            disabled={iso(lunes) <= INICIO_PORTAL}><ChevI dir="izq" /></button>
          <span className="week-label">{iconoSemana}Semana {semanaBrain(lunes)} · {rangoSemana(lunes, domingo)}</span>
          <button className="week-arrow" aria-label="Semana siguiente" onClick={() => setLunes(sumaDias(lunes, 7))}><ChevI dir="der" /></button>
        </div>
        <button className="btn-download" onClick={() => descargarPdf()}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
          </svg>
          {armandoPdf ? 'Generando PDF…' : 'Descargar movimientos'}
        </button>
      </div>

      {error && <div className="form-error">No se pudieron cargar tus movimientos: {error}</div>}

      {/* 3 · Tarjeta de pago y factura */}
      <section className="pay-card">
        <div className="pay-card__top">
          <div>
            <div className="pay-label">{pagada ? 'Pagado el' : 'Fecha de pago'}</div>
            <div className="pay-date">{diaLargo(fechaPago)}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="pay-amount">{pesosT(hayPrefactura ? totalBruto : totalNeto)}</div>
            <div className="pay-iva">{hayPrefactura ? `Incluye IVA 16% · Neto ${pesosT(totalNeto)}` : 'Sin IVA: el total se calcula el lunes'}</div>
          </div>
        </div>
        {faltaFactura && (
          <div className="invoice-strip">
            <span className="dot-pulse" aria-hidden="true" />
            <span className="invoice-txt"><b>Falta tu factura.</b> Para pagarte necesitamos que cargues tu factura.</span>
            <a href="#" className="invoice-link" onClick={e => { e.preventDefault(); ir('facturacion') }}>Ir a Por facturar <ChevI dir="flecha" /></a>
          </div>
        )}
      </section>

      {/* 4 · Resumen de la semana */}
      <section className="summary">
        <div className="summary__row">
          <span className="summary__left"><span className="summary__label">Tus rutas</span><span className="summary__sep">|</span><span className="summary__info">{infoRutas}</span></span>
          <span className="summary__amount">+ {pesosT(totalPagos)}</span>
        </div>
        {totalAjustes !== 0 && (
          <div className="summary__row">
            <span className="summary__left"><span className="summary__label">Ajustes a tu favor</span><span className="summary__sep">|</span><span className="summary__info">{infoAjustes}</span></span>
            <span className="summary__amount">+ {pesosT(totalAjustes)}</span>
          </div>
        )}
        {totalCobros !== 0 && (
          <div className="summary__row">
            <span className="summary__left"><span className="summary__label">Descuentos</span><span className="summary__sep">|</span>
              <a href="#" className="link-desc" onClick={e => { e.preventDefault(); ir('descuentos') }}>Ver descuentos <ChevI dir="flecha" /></a></span>
            <span className="summary__amount">− {pesosT(Math.abs(totalCobros))}</span>
          </div>
        )}
        <div className="summary__row summary__row--neto">
          <span className="summary__label">Neto</span>
          <span className="summary__amount">{pesosT(totalNeto)}</span>
        </div>
        {hayPrefactura && (
          <div className="summary__row summary__row--iva">
            <span>IVA 16%</span>
            <span className="summary__amount">+ {pesosT(iva)}</span>
          </div>
        )}
        <div className="summary__row summary__row--total">
          <span className="summary__total-label">Total</span>
          <span className="summary__total">{hayPrefactura ? pesosT(totalBruto) : '—'}</span>
        </div>
      </section>

      {/* 5 · Filtro de site e Informar diferencia */}
      <div className="detail-bar">
        <h2 className="detail-title">Detalle de movimientos por día</h2>
        {centros.length > 1 && (
          <div className="site-filter" role="group" aria-label="Filtrar por site">
            {['todos', ...centros].map(c => (
              <button key={c} aria-pressed={scSel === c} onClick={() => setScSel(c)}>{c === 'todos' ? 'Todos los sites' : c}</button>
            ))}
          </div>
        )}
      </div>

      {!modo ? (
        <div className="diff-hint">
          <span className="diff-hint__t">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10" /><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01" />
            </svg>
            ¿Ves algo que no cuadra? Selecciona la línea e informa la diferencia.
          </span>
          <span className="diff-btn-caja">
            <span className="tip" role="tooltip">Selecciona la línea y notifica</span>
            <button className="btn-diff" onClick={() => setModo(true)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="3" width="18" height="18" rx="3" /><path d="m8 12 3 3 5-6" />
              </svg>
              Informar diferencia
            </button>
          </span>
        </div>
      ) : (
        <div className="diff-banner">
          <div className="diff-banner__t">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#002E5D" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 5 5 9-10" /></svg>
            <div>
            <div className="diff-banner__count">{nMarcadas === 0 ? 'Marca las líneas que no cuadran' : `Marcaste ${plural(nMarcadas, 'línea', 'líneas')}`}</div>
            <div className="diff-banner__sub">Abrimos todos los días para que puedas revisar cada línea.</div>
            </div>
          </div>
          <button className="diff-banner__cancel" onClick={salir}>Cancelar</button>
        </div>
      )}

      {/* 6 · Tabla por día */}
      {cargando ? (
        <div className="msg-empty">Cargando…</div>
      ) : grupos.length === 0 ? (
        <div className="msg-empty">Todavía no hay movimientos de esta semana.</div>
      ) : (
        <div className="det-scroll">
          <div className={`det-grid det-head${modo ? ' det-grid--diff' : ''}`}>
            {modo && <span />}
            <span style={{ textAlign: 'left' }}>Detalle</span>
            <span>Te pagamos</span>
            <span className="det-head__desc">Te descontamos</span>
            <span>Te quedan</span>
          </div>

          {grupos.map(g => {
            const ab = abierto(g)
            const fkey = g.fecha || 'zz'
            return (
              <div key={fkey} className={`day${ab ? ' day--open' : ''}`}>
                <div className={`det-grid day__head${modo ? ' det-grid--diff' : ''}`} role="button" tabIndex={0} aria-expanded={ab}
                  onClick={() => !modo && setToggle(p => ({ ...p, [fkey]: !ab }))}
                  onKeyDown={e => { if (!modo && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setToggle(p => ({ ...p, [fkey]: !ab })) } }}>
                  {modo && <span />}
                  <span className="day__t">
                    <svg className="day__chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#002E5D" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
                    <span className="day__label">{g.fecha ? diaCorto(g.fecha) : 'Otros movimientos de la semana'}</span>
                    {g.meta && <span className="day__meta">· {g.meta}</span>}
                  </span>
                  <span className="line__amount">{pesosT(g.pagamos)}</span>
                  <span className="line__amount">{g.descontamos ? pesosT(g.descontamos) : '—'}</span>
                  <span className="line__amount line__saldo">{pesosT(g.saldo)}</span>
                </div>

                {ab && g.lineas.map(it => {
                  const f = forms[it.key]
                  const marcada = !!f
                  const rec = it.m ? (it.clase === 'cobro' ? reclamadas[`cobro|${it.m.cobro_id}`] : reclamadas[`pago|${it.m.fecha}|${it.m.ref}`]) : null
                  // El estado solo se dice en las rutas que no se pagan o están en revisión.
                  const est = it.clase === 'ruta' && it.estado && it.estado !== 'aprobada' ? (ESTADOS[it.estado] || null) : null
                  return (
                    <div key={it.key}>
                      <div className={`det-grid line${modo ? ' det-grid--diff' : ''}${marcada ? ' line--selected' : ''}`}>
                        {modo && (
                          <button className="check" role="checkbox" aria-checked={marcada} aria-label={`Marcar ${it.titulo}`} onClick={() => marcar(it)}>
                            {marcada && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 5 5 9-10" /></svg>}
                          </button>
                        )}
                        <span className="line__title">
                          {it.titulo}
                          {(it.sub || est || rec) && (
                            <span className="line__sub">
                              {it.sub}
                              {est && ` · ${est.label}`}
                              {rec && ` · Diferencia #${rec.folio} en revisión`}
                            </span>
                          )}
                        </span>
                        {marcada ? <><span /><span /><span /></> : (
                          <>
                            <span className="line__amount">{it.cuenta && it.monto > 0 ? pesosT(it.monto) : ''}</span>
                            <span className="line__amount">{it.cuenta && it.monto < 0 ? pesosT(it.monto) : ''}</span>
                            <span className="line__amount line__saldo">{it.cuenta ? pesosT(it.saldo) : '—'}</span>
                          </>
                        )}
                      </div>
                      {marcada && (
                        <FormDiferencia tipo={tipoForm(it)} f={f} fecha={it.fecha}
                          set={(c, v) => setCampo(it.key, c, v)} onCerrar={() => marcar(it)}
                          onEnviar={() => enviar(it.key, tipoForm(it), f, it)} enviando={enviando === it.key} sites={centros} />
                      )}
                    </div>
                  )
                })}

                {/* 10 · Agregar ruta que no aparece (solo en modo diferencia) */}
                {modo && g.fecha && (
                  <>
                    {(nuevas[g.fecha] || []).map((nf, i) => (
                      <div key={i} className="new-route">
                        <div className="new-route__cab">
                          <span className="new-route__title">Ruta que no aparece</span>
                          <button className="form-close" aria-label="Quitar" onClick={() => quitarNueva(g.fecha, i)}><Equis /></button>
                        </div>
                        <Campos tipo="nueva" f={nf} set={(c, v) => setNueva(g.fecha, i, c, v)} sites={centros} />
                        <div className="form-acciones">
                          <button className="btn-cancel" onClick={() => quitarNueva(g.fecha, i)}>Cancelar</button>
                          <button className="btn-send" disabled={enviando === `n|${g.fecha}|${i}`}
                            onClick={() => enviar(`n|${g.fecha}|${i}`, 'nueva', nf, null).then(() => {})}>
                            {enviando === `n|${g.fecha}|${i}` ? 'Enviando…' : 'Enviar diferencia'}
                          </button>
                        </div>
                      </div>
                    ))}
                    <div className="add-route-wrap">
                      <button className="add-route" onClick={() => agregarNueva(g)}>+ Agregar ruta que no aparece</button>
                    </div>
                  </>
                )}
              </div>
            )
          })}

          <div className={`det-grid week-total${modo ? ' det-grid--diff' : ''}`}>
            {modo && <span />}
            <span className="week-total__t">Te quedan esta semana{scSel !== 'todos' ? ` en ${scSel}` : ''} (neto)</span>
            <span className="line__amount">{pesosT(totPagamos)}</span>
            <span className="line__amount">{totDescontamos ? pesosT(totDescontamos) : '—'}</span>
            <span className="line__amount line__saldo">{pesosT(saldoFinal)}</span>
          </div>
        </div>
      )}

      {/* 11 · Confirmación de envío */}
      {recibida && (
        <div className="overlay" onClick={() => setRecibida(null)}>
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="mw-modal-t" onClick={e => e.stopPropagation()}>
            <span className="modal__icon" aria-hidden="true">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 5 5 9-10" /></svg>
            </span>
            <h3 className="modal__title" id="mw-modal-t">Recibimos tu diferencia</h3>
            <p className="modal__txt">Te respondemos en 48 horas en Mis mensajes. Mientras tanto, la línea queda marcada como En revisión.</p>
            <div className="modal__summary">
              <div><span>Línea</span><b>{recibida.linea}</b></div>
              <div><span>Site</span><b>{recibida.site}</b></div>
              <div><span>Folio</span><b>#{recibida.folio}</b></div>
              <div><span>Monto</span><b>{recibida.monto != null ? pesosT(recibida.monto) : '—'}</b></div>
            </div>
            <div className="modal__actions">
              <button className="btn-outline" onClick={() => { setRecibida(null); salir(); ir('mensajes') }}>Ir a Mis mensajes</button>
              <button className="btn-primary" onClick={() => { setRecibida(null); salir() }}>Volver a Movimientos</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// 8 y 9 · Formulario de una línea marcada.
function FormDiferencia({ tipo, f, set, onCerrar, onEnviar, enviando, sites }) {
  const sinMotivo = tipo === 'sin_desc' && !f.motivo
  return (
    <div className="diff-form">
      {tipo === 'sin_desc' && (
        <div className="reason-cab">
          <label className="reason-select-caja">
            <span className="reason-select-label">Motivo de la diferencia *</span>
            <select className="reason-select" value={f.motivo} onChange={e => set('motivo', e.target.value)}>
              <option value="" disabled>Selecciona un motivo</option>
              {MOTIVOS_RUTA.map(m => <option key={m}>{m}</option>)}
            </select>
          </label>
          {sinMotivo && <button className="form-close" aria-label="Cerrar" onClick={onCerrar}><Equis /></button>}
        </div>
      )}
      {tipo === 'desc_otro' && (
        <div className="reasons" role="group" aria-label="Motivo">
          {MOTIVOS_DESC.map(m => (
            <button key={m} className="reason" aria-pressed={f.motivo === m} onClick={() => set('motivo', m)}>{m}</button>
          ))}
        </div>
      )}
      {!sinMotivo && (
        <>
          <Campos tipo={tipo} f={f} set={set} sites={sites} />
          <div className="form-acciones">
            <button className="btn-cancel" onClick={onCerrar}>Cancelar</button>
            <button className="btn-send" disabled={enviando} onClick={onEnviar}>{enviando ? 'Enviando…' : 'Enviar diferencia'}</button>
          </div>
        </>
      )}
    </div>
  )
}

// Los campos de cada formulario, en el orden de la maqueta.
function Campos({ tipo, f, set, sites = [] }) {
  const conGuia = tipo === 'desc_fijo' || tipo === 'desc_otro'
  const conFecha = tipo !== 'desc_fijo'
  const rutaOpcional = tipo === 'nueva' || (tipo === 'sin_desc' && f.motivo === 'No reconozco esta ruta')
  const evidenciaObligatoria = conGuia
  return (
    <>
      <div className="fields">
        <label className="field"><span>Site *</span>
          <select value={f.sc} onChange={e => set('sc', e.target.value)}>
            {[...new Set([f.sc, ...sites].filter(Boolean))].map(x => <option key={x} value={x}>{x}</option>)}
          </select>
        </label>
        <label className="field"><span>{rutaOpcional ? 'ID ruta (opcional)' : 'ID ruta *'}</span>
          <input value={f.idRuta} onChange={e => set('idRuta', e.target.value)} placeholder={rutaOpcional ? 'Ej: 156342888' : ''} /></label>
        <label className="field"><span>Placa *</span><input value={f.placa} onChange={e => set('placa', e.target.value.toUpperCase())} /></label>
        {conGuia && <label className="field"><span>ID Guía *</span><input value={f.idGuia} onChange={e => set('idGuia', e.target.value)} /></label>}
        {conFecha && <label className="field"><span>Fecha de ruta *</span><input type="date" value={f.fecha} onChange={e => set('fecha', e.target.value)} /></label>}
      </div>
      <label className="field"><span>Comentarios *</span><textarea value={f.comentario} onChange={e => set('comentario', e.target.value)}
        placeholder="Ej: el paquete se entregó al cliente, adjunto la foto de entrega" /></label>
      <div className="field">
        <span>{evidenciaObligatoria ? 'Evidencia *' : 'Evidencia (opcional)'}</span>
        <label className="evidence">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" /></svg>
          {evidenciaObligatoria ? 'Adjuntar foto o comprobante' : 'Adjuntar evidencia (JPG, PNG, PDF)'}
          <input type="file" accept={EVIDENCIA_ACEPTA} multiple hidden onChange={e => set('archivos', [...e.target.files])} />
        </label>
        {f.archivos?.length > 0 && <span className="evidence-n">{f.archivos.length} archivo(s) listo(s)</span>}
      </div>
    </>
  )
}

const Equis = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
)
const Chev12 = () => (
  <svg className="ms-chev" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
)
function ChevI({ dir }) {
  const d = dir === 'izq' ? 'm15 18-6-6 6-6' : dir === 'der' ? 'm9 18 6-6-6-6' : 'M5 12h14M13 6l6 6-6 6'
  return <svg width={dir === 'flecha' ? 14 : 18} height={dir === 'flecha' ? 14 : 18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
}
