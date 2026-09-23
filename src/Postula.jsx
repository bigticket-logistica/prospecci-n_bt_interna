// ═══════════════════════════════════════════════════════════════════════════
// Postula.jsx — Las campañas abiertas, vistas por un tercero que ya opera.
//
// La diferencia con el portal público de postulación: acá la empresa ya está
// certificada, con contrato firmado y flota validada. No vuelve a subir nada.
//
// Las campañas de los centros donde ya opera van primero: ahí conoce la
// operación, el supervisor lo conoce a él, y la barrera de entrada es menor.
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from './supabaseClient'

export default function Postula({ tercero, onBack }) {
  const [campanas, setCampanas] = useState(null)
  const [misSC, setMisSC] = useState([])
  const [error, setError] = useState(null)

  const cargar = useCallback(async () => {
    setError(null)
    const [c, p] = await Promise.all([
      supabase.from('campanas').select('*')
        .eq('toggle_activo', true)
        .order('created_at', { ascending: false }),
      // Los centros donde opera hoy, para destacar esas campañas.
      supabase.from('placas_terceros_pagos')
        .select('service_center_id')
        .eq('tercero_id', tercero?.tercero_id)
        .is('vigente_hasta', null),
    ])
    if (c.error) { setError(c.error.message); setCampanas([]); return }
    setCampanas(c.data || [])
    setMisSC([...new Set((p.data || []).map(x => x.service_center_id).filter(Boolean))])
  }, [tercero])

  useEffect(() => { cargar() }, [cargar])

  // El SC va dentro del nombre de la campaña — "MELI Celaya | SCY1" — así que
  // se saca de ahí. No hay una columna propia para el centro.
  const scDe = (c) => {
    const m = String(c.nombre || '').match(/\|\s*([A-Z]{2,}\d*)\s*$/)
    return m ? m[1] : null
  }
  const limpiaNombre = (c) => String(c.nombre || '').split('|')[0].trim()

  const { mias, otras } = useMemo(() => {
    const cs = campanas || []
    return {
      mias: cs.filter(c => misSC.includes(scDe(c))),
      otras: cs.filter(c => !misSC.includes(scDe(c))),
    }
  }, [campanas, misSC])

  return (
    <div style={{ maxWidth: 820, margin: '0 auto' }}>
      <button className="back-link" onClick={onBack}>← Volver</button>

      <div style={{
        background: 'linear-gradient(135deg,var(--navy) 0%,#2d5490 100%)',
        borderRadius: 16, padding: '20px 22px', marginBottom: 20,
      }}>
        <span style={{
          display: 'inline-block', background: 'var(--orange)', color: '#fff',
          fontSize: 10.5, fontWeight: 700, padding: '3px 10px', borderRadius: 12, letterSpacing: '.04em',
        }}>ACCESO PREFERENTE</span>
        <div style={{ color: '#fff', fontSize: 19, fontWeight: 700, marginTop: 10 }}>
          Suma operación con nosotros
        </div>
        <div style={{ color: '#b8c6de', fontSize: 12.5, marginTop: 5, lineHeight: 1.55, maxWidth: 520 }}>
          Ya estás certificado y operando, así que tu postulación entra directo a evaluación:
          no vuelves a subir tus documentos de empresa ni a pasar por la validación inicial.
        </div>
      </div>

      {error && <div className="form-error">{error}</div>}

      {campanas === null ? (
        <div style={{ padding: 30, textAlign: 'center', color: 'var(--muted)', fontSize: 13.5 }}>Cargando ofertas…</div>
      ) : campanas.length === 0 ? (
        <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14, padding: 32, textAlign: 'center' }}>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>No hay ofertas abiertas ahora</div>
          <div style={{ fontSize: 13.5, color: 'var(--muted)', maxWidth: 420, margin: '0 auto', lineHeight: 1.5 }}>
            Cuando se abra una operación en tu zona la vas a ver acá. También te avisamos por correo.
          </div>
        </div>
      ) : (
        <>
          {mias.length > 0 && (
            <Grupo titulo="Donde ya operas" color="var(--orange)">
              {mias.map(c => <Oferta key={c.id} c={c} sc={scDe(c)} nombre={limpiaNombre(c)} destacada />)}
            </Grupo>
          )}

          {otras.length > 0 && (
            <Grupo titulo="Otros centros" color="var(--navy)" nota={`${otras.length} disponible${otras.length === 1 ? '' : 's'}`}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10 }}>
                {otras.map(c => <Oferta key={c.id} c={c} sc={scDe(c)} nombre={limpiaNombre(c)} />)}
              </div>
            </Grupo>
          )}
        </>
      )}
    </div>
  )
}

function Grupo({ titulo, color, nota, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10 }}>
        <span style={{ width: 4, height: 15, borderRadius: 2, background: color }} />
        <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--navy)', letterSpacing: '.04em', textTransform: 'uppercase' }}>
          {titulo}
        </span>
        {nota && <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>{nota}</span>}
      </div>
      {children}
    </div>
  )
}

function Oferta({ c, sc, nombre, destacada }) {
  // Los cupos vienen en blanco en varias campañas: se dice "por confirmar" en
  // vez de mostrar un cero que el tercero leería como "no hay".
  const cupos = c.cantidad ? `${c.cantidad} unidad${c.cantidad === 1 ? '' : 'es'}` : null

  return (
    <div style={{
      background: 'var(--card)',
      border: destacada ? '1px solid var(--orange)' : '1px solid var(--line)',
      borderRadius: 14, padding: destacada ? 16 : 14, marginBottom: destacada ? 10 : 0,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 190 }}>
          <div style={{ fontSize: destacada ? 15 : 14, fontWeight: 600, color: 'var(--navy)' }}>
            {nombre}{sc ? ` · ${sc}` : ''}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 3 }}>
            {[c.zona, c.vehiculo].filter(Boolean).join(' · ')}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: destacada ? 7 : 6, lineHeight: 1.5 }}>
            {destacada && c.propuesta_cedis && <>📍 {c.propuesta_cedis}<br /></>}
            {c.ingreso_rango && <>💰 {c.ingreso_rango} por jornada</>}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          {cupos ? (
            <span style={{
              background: 'var(--amber-soft)', color: 'var(--amber)', fontSize: 10.5,
              fontWeight: 700, padding: '3px 10px', borderRadius: 12, whiteSpace: 'nowrap',
            }}>{cupos}</span>
          ) : (
            <span style={{ fontSize: 10.5, color: 'var(--muted)' }}>cupos por confirmar</span>
          )}
          <div style={{ marginTop: 10 }}>
            <button
              onClick={() => window.alert('El formulario de postulación está en construcción. Pronto vas a poder postular desde acá.')}
              style={{
                background: destacada ? 'var(--orange)' : '#fff',
                border: destacada ? 'none' : '1px solid var(--navy)',
                color: destacada ? '#fff' : 'var(--navy)',
                fontSize: destacada ? 12.5 : 11.5, fontWeight: 600,
                padding: destacada ? '9px 20px' : '6px 15px',
                borderRadius: 10, cursor: 'pointer', whiteSpace: 'nowrap',
              }}>
              Postular
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
