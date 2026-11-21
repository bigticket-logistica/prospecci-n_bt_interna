// ═══════════════════════════════════════════════════════════════════════════
// AvisoCertificacion.jsx — Aviso de Certificación en "Mi flota"
//
// Muestra a la empresa los choferes y vehículos que operaron sin estar
// certificados (y si le falta firmar el contrato), según la última semana que
// publicó el equipo de Certificaciones de BigTicket. Si no hay nada publicado
// para la empresa, no muestra nada.
// Datos: fn_red_cert_aviso_tercero(tercero_id). No muestra montos.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

const TIPO = {
  contrato:            { t: 'Contrato sin firmar',        c: '#7c3aed' },
  vehiculo:            { t: 'Vehículo sin certificar',     c: '#b91c1c' },
  chofer:              { t: 'Conductor sin certificar',    c: '#b91c1c' },
  chofer_otra_empresa: { t: 'Conductor de otra empresa',   c: '#b45309' },
}

export default function AvisoCertificacion({ tercero, onCertificar }) {
  const [filas, setFilas] = useState(null)
  const [abierto, setAbierto] = useState(false)

  useEffect(() => {
    if (!tercero?.tercero_id) return
    ;(async () => {
      const { data, error } = await supabase.rpc('fn_red_cert_aviso_tercero', { p_tercero: tercero.tercero_id })
      setFilas(error ? [] : (data || []))
    })()
  }, [tercero])

  if (!filas || filas.length === 0) return null

  const ddmm = (iso) => { const s = String(iso || '').slice(0, 10); const [, m, d] = s.split('-'); return d ? `${d}/${m}` : s }
  const algunoRetenido = filas.some(f => f.modo === 'encendido')
  const contrato = filas.some(f => f.tipo === 'contrato')
  const personas = filas.filter(f => f.tipo === 'chofer' || f.tipo === 'chofer_otra_empresa')
  const vehiculos = filas.filter(f => f.tipo === 'vehiculo')

  return (
    <div role="alert" style={{ margin: '12px 0 16px', border: `1px solid ${algunoRetenido ? '#fca5a5' : '#fdba74'}`, background: algunoRetenido ? '#fef2f2' : '#fff7ed', borderRadius: 10, padding: '12px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: algunoRetenido ? '#991b1b' : '#9a3412' }}>
            {algunoRetenido ? 'Tienes viajes retenidos por certificación' : 'Certifica tu operación para evitar la retención de pagos'}
          </div>
          <div style={{ fontSize: 12.5, color: '#475569', marginTop: 4, lineHeight: 1.45 }}>
            En la semana {filas[0].semana} operaron
            {personas.length > 0 && <> <b>{personas.length} conductor(es)</b></>}
            {personas.length > 0 && vehiculos.length > 0 && ' y'}
            {vehiculos.length > 0 && <> <b>{vehiculos.length} vehículo(s)</b></>}
            {(personas.length > 0 || vehiculos.length > 0) && ' que no están certificados con tu empresa'}
            {contrato && <>{(personas.length > 0 || vehiculos.length > 0) ? '; además, ' : ' '}tu <b>contrato no está firmado</b></>}.
            {' '}Solo se pagan los viajes hechos por conductores y vehículos certificados de una empresa con contrato firmado.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="btn" onClick={() => setAbierto(a => !a)}
            style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
            {abierto ? 'Ocultar detalle' : 'Ver detalle'}
          </button>
          {onCertificar && (personas.length > 0 || vehiculos.length > 0) && (
            <button className="btn" onClick={onCertificar}
              style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid #ea580c', background: '#ea580c', color: '#fff', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
              Certificar ahora
            </button>
          )}
        </div>
      </div>

      {abierto && (
        <div style={{ marginTop: 10, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: '#64748b' }}>
                <th style={{ padding: '6px 8px' }}>Situación</th>
                <th style={{ padding: '6px 8px' }}>Conductor / vehículo</th>
                <th style={{ padding: '6px 8px' }}>CURP / placa</th>
                <th style={{ padding: '6px 8px' }}>Site</th>
                <th style={{ padding: '6px 8px', textAlign: 'right' }}>Viajes</th>
                <th style={{ padding: '6px 8px' }}>Días</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f, i) => (
                <tr key={i} style={{ borderTop: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '6px 8px', fontWeight: 700, color: TIPO[f.tipo]?.c, whiteSpace: 'nowrap' }}>
                    {TIPO[f.tipo]?.t || f.tipo}{f.modo === 'encendido' ? ' · retenido' : ''}
                  </td>
                  <td style={{ padding: '6px 8px' }}>
                    {f.tipo === 'contrato' ? 'Contrato de tu empresa' : f.tipo === 'vehiculo' ? 'Vehículo' : (f.nombre || '—')}
                    {f.tipo === 'chofer_otra_empresa' && <div style={{ fontSize: 11, color: '#94a3b8' }}>Está dado de alta en otra empresa; debe darse de alta en la tuya.</div>}
                  </td>
                  <td style={{ padding: '6px 8px', fontFamily: 'monospace' }}>{f.tipo === 'vehiculo' ? f.placa : (f.curp || '—')}</td>
                  <td style={{ padding: '6px 8px' }}>{f.service_centers || '—'}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right' }}>{f.rutas}</td>
                  <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>{ddmm(f.primer_dia)}{f.ultimo_dia !== f.primer_dia ? ` al ${ddmm(f.ultimo_dia)}` : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 6 }}>
            Información publicada por Certificaciones de BigTicket el {new Date(filas[0].publicado_at).toLocaleDateString('es-MX')}. Si ya lo regularizaste, se actualizará en la próxima revisión.
          </div>
        </div>
      )}
    </div>
  )
}
