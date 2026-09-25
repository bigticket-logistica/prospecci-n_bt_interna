// ═══════════════════════════════════════════════════════════════════════════
// Resumen.jsx — Lo primero que ve el tercero al entrar.
//
// Dos bloques: la jornada más reciente publicada, y sus ganancias por semana,
// mes o acumulado.
//
// La semana en curso muestra lo publicado hasta ahora, no el total teórico: hoy
// 24 la semana 40 va del 21 al 23, y cuando se publique el domingo va a mostrar
// los siete días. Por eso el período se arma con lo que existe en vez de
// asumir un rango.
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from './supabaseClient'

const money = (n) => (Number(n || 0) < 0 ? '−$' : '$') + Math.abs(Number(n || 0)).toLocaleString('es-MX', { maximumFractionDigits: 0 })
const num = (n) => Number(n || 0).toLocaleString('es-MX', { maximumFractionDigits: 0 })

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
  'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

const fechaLarga = (iso) => {
  const d = new Date(iso + 'T12:00:00')
  return `${DIAS[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]}`
}
const rango = (a, b) => {
  if (!a) return ''
  const d1 = new Date(a + 'T12:00:00'), d2 = new Date((b || a) + 'T12:00:00')
  const f = (d) => `${d.getDate()} ${MESES[d.getMonth()].slice(0, 3)}`
  return a === b ? f(d1) : `${f(d1)} – ${f(d2)}`
}
const etiquetaMes = (p) => {
  const [y, m] = String(p).split('-')
  return `${MESES[Number(m) - 1]} ${y}`
}

export default function Resumen({ tercero, onVerMovimientos }) {
  const [dia, setDia] = useState(null)
  const [periodos, setPeriodos] = useState([])
  const [vista, setVista] = useState('semana')
  const [idx, setIdx] = useState(0)
  const [cargando, setCargando] = useState(true)

  const cargar = useCallback(async () => {
    if (!tercero?.tercero_id) return
    setCargando(true)
    const [d, p] = await Promise.all([
      supabase.from('vw_portal_resumen_dia').select('*')
        .eq('tercero_id', tercero.tercero_id)
        .order('fecha', { ascending: false }).limit(1),
      supabase.from('vw_portal_resumen_periodo').select('*')
        .eq('tercero_id', tercero.tercero_id),
    ])
    setDia((d.data || [])[0] || null)
    setPeriodos(p.data || [])
    setCargando(false)
  }, [tercero])

  useEffect(() => { cargar() }, [cargar])

  // Las semanas y meses se ordenan de más reciente a más antiguo: el tercero
  // entra a ver lo de ahora, no lo de hace tres meses.
  const lista = useMemo(() => {
    const fs = periodos.filter(p => p.tipo === vista)
    return fs.sort((a, b) => String(b.periodo).localeCompare(String(a.periodo)))
  }, [periodos, vista])

  useEffect(() => { setIdx(0) }, [vista])
  const actual = lista[idx] || null

  if (cargando) return null
  if (!dia) return null

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12, marginBottom: 22 }}>

      {/* Jornada más reciente. Siempre es el día anterior, porque se publica al
          día siguiente de operar. */}
      <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 16, padding: 18 }}>
        <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>
          Jornada del {fechaLarga(dia.fecha)}
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, marginTop: 6 }}>
          <span style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-.02em',
            color: Number(dia.ganancia) < 0 ? 'var(--red)' : 'var(--navy)' }}>
            {money(dia.ganancia)}
          </span>
          <span style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 600 }}>MXN</span>
        </div>

        {/* Si ese día hubo descuentos, se muestran: el número grande es el neto
            y sin el desglose parecería que ganó menos de lo que trabajó. */}
        {Number(dia.cargos || 0) !== 0 && (
          <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 3 }}>
            {money(dia.viajes)} en viajes · <span style={{ color: 'var(--red)' }}>{money(dia.cargos)} en descuentos</span>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 14 }}>
          <Dato v={num(dia.entregas)} k="Entregas" />
          <Dato v={num(dia.km)} k="Kilómetros" />
          <Dato v={`${Number(dia.ns || 0).toFixed(1)}%`} k="Nivel servicio"
            color={Number(dia.ns) >= 98 ? 'var(--green)' : Number(dia.ns) >= 95 ? 'var(--amber)' : 'var(--red)'} />
        </div>

        <button onClick={onVerMovimientos}
          style={{
            width: '100%', marginTop: 14, padding: '11px', borderRadius: 12, border: 'none',
            background: 'var(--navy)', color: '#fff', fontSize: 13.5, fontWeight: 700, cursor: 'pointer',
          }}>
          Ver detalle completo →
        </button>
      </div>

      {/* Ganancias por período. La semana en curso muestra lo que va, no el
          total teórico: el rango de fechas lo deja claro. */}
      <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 16, padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--navy)' }}>Mis ganancias</span>
        </div>

        <div style={{ display: 'flex', gap: 4, background: 'var(--bg)', borderRadius: 10, padding: 3, marginBottom: 14 }}>
          {[['semana', 'Semana'], ['mes', 'Mes'], ['total', 'Total']].map(([id, l]) => (
            <button key={id} onClick={() => setVista(id)}
              style={{
                flex: 1, padding: '7px 0', borderRadius: 8, border: 'none', cursor: 'pointer',
                fontSize: 12.5, fontWeight: 700,
                background: vista === id ? 'var(--card)' : 'transparent',
                color: vista === id ? 'var(--navy)' : 'var(--muted)',
                boxShadow: vista === id ? '0 1px 3px rgba(0,0,0,.08)' : 'none',
              }}>{l}</button>
          ))}
        </div>

        {!actual ? (
          <div style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center', padding: '20px 0' }}>
            Todavía no hay datos de este período.
          </div>
        ) : (
          <>
            <div style={{ background: 'var(--bg)', borderRadius: 12, padding: '14px 12px', textAlign: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                {vista !== 'total' && (
                  <button onClick={() => setIdx(i => Math.min(lista.length - 1, i + 1))}
                    disabled={idx >= lista.length - 1}
                    style={{ ...flecha, opacity: idx >= lista.length - 1 ? .25 : 1 }}>‹</button>
                )}
                <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>
                  {vista === 'semana' ? `Semana ${actual.periodo}`
                    : vista === 'mes' ? etiquetaMes(actual.periodo)
                    : 'Desde el inicio'}
                  <div style={{ fontSize: 10.5, marginTop: 1 }}>{rango(actual.desde, actual.hasta)}</div>
                </div>
                {vista !== 'total' && (
                  <button onClick={() => setIdx(i => Math.max(0, i - 1))} disabled={idx === 0}
                    style={{ ...flecha, opacity: idx === 0 ? .25 : 1 }}>›</button>
                )}
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, marginTop: 6, letterSpacing: '-.02em',
                color: Number(actual.ganancia) < 0 ? 'var(--red)' : 'var(--navy)' }}>
                {money(actual.ganancia)}
              </div>
              {Number(actual.cargos || 0) !== 0 && (
                <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 3 }}>
                  {money(actual.viajes)} en viajes · <span style={{ color: 'var(--red)' }}>{money(actual.cargos)} en descuentos</span>
                </div>
              )}
              <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>
                {num(actual.jornadas)} jornada{Number(actual.jornadas) === 1 ? '' : 's'} · {num(actual.unidades)} unidad{Number(actual.unidades) === 1 ? '' : 'es'}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 10 }}>
              <Dato v={`${Number(actual.ns || 0).toFixed(1)}%`} k="Nivel servicio"
                color={Number(actual.ns) >= 98 ? 'var(--green)' : Number(actual.ns) >= 95 ? 'var(--amber)' : 'var(--red)'} />
              <Dato v={num(actual.entregas)} k="Entregas" />
              <Dato v={num(actual.km)} k="Km" />
            </div>
          </>
        )}
      </div>
    </div>
  )
}

const flecha = {
  border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--navy)',
  width: 24, height: 24, borderRadius: 999, fontSize: 14, cursor: 'pointer', lineHeight: 1, padding: 0,
}

function Dato({ v, k, color }) {
  return (
    <div style={{ background: 'var(--bg)', borderRadius: 10, padding: '9px 6px', textAlign: 'center' }}>
      <div style={{ fontSize: 15, fontWeight: 800, color: color || 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{v}</div>
      <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 1 }}>{k}</div>
    </div>
  )
}
