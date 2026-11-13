// Cobros.jsx — Portal del transportista (Chile) · Cuidado de Activo → Mis cobros (Conciliaciones).
// El tercero ve los cobros que se le notificaron (multas del Anexo III en UF, deducibles, combustible, reparaciones)
// y puede apelar cada uno dentro del plazo (15 días desde la notificación). Primero opina Operaciones y luego
// Conciliaciones decide. Si la apelación se rechaza, el cobro queda firme: Finanzas factura y lo descuenta en la prefactura.
import { useEffect, useState } from 'react'
import { supabaseCL } from './supabaseChile'

const ESTADO = {
  notificado: ['Puedes apelar', '#FFF4E0', '#C47A00'], rev_operaciones: ['Apelado · en revisión', '#EEF2F8', '#002E5D'], rev_conciliaciones: ['Apelado · en revisión', '#EEF2F8', '#002E5D'],
  firme: ['Firme: se descuenta en tu prefactura', '#FBE3E0', '#B42318'], anulado: ['Anulado', '#E7F5EC', '#1A7A3C'],
}
const TIPO = { falta: 'Multa Anexo III', deducible: 'Deducible de siniestro', combustible: 'Combustible sobre la subvención', reparacion: 'Reparación con cobro al tercero' }
const fecha = (v) => (v ? new Date(v).toLocaleDateString('es-CL', { timeZone: 'America/Santiago', day: '2-digit', month: '2-digit', year: 'numeric' }) : '')
const monto = (x) => [x.uf !== null && x.uf !== undefined ? `${Number(x.uf)} UF` : null, x.pesos !== null && x.pesos !== undefined ? `$${Math.round(Number(x.pesos)).toLocaleString('es-CL')}` : null].filter(Boolean).join(' · ')

export default function Cobros() {
  const [filas, setFilas] = useState(null)
  const [err, setErr] = useState('')
  const [abierta, setAbierta] = useState(null)
  const [motivo, setMotivo] = useState('')
  const [busy, setBusy] = useState(false)
  const cargar = async () => {
    const { data, error } = await supabaseCL.rpc('fn_portal_cl_cobros')
    if (error) { setErr('No se pudieron cargar tus cobros. Intenta de nuevo en un momento.'); setFilas([]); return }
    setErr(''); setFilas(data || [])
  }
  useEffect(() => { cargar() }, [])
  const apelar = async (id) => {
    setBusy(true); setErr('')
    const { error } = await supabaseCL.rpc('fn_portal_cl_apelar', { p_item: id, p_motivo: motivo })
    setBusy(false)
    if (error) { setErr(error.message); return }
    setAbierta(null); setMotivo(''); cargar()
  }
  const porApelar = (filas || []).filter((x) => x.estado === 'notificado').length
  return (
    <div>
      <h1 className="pc-h1">Mis cobros</h1>
      <div className="pc-sub">Cobros que Bigticket te notificó por incumplimientos y cargos de Cuidado de Activo. Puedes <b>apelar cada uno hasta 15 días</b> después de la notificación, explicando el motivo. Las multas se expresan en UF: se facturan al valor de la UF del día de facturación y se descuentan en tu prefactura.</div>
      {err && <div className="pc-card" style={{ background: '#FBE3E0', color: '#C43D2F' }}>{err}</div>}
      {filas === null ? <div className="pc-card">Cargando…</div> : filas.length === 0 ? <div className="pc-card">No tienes cobros notificados.</div> : (
        <>
          {porApelar > 0 && <div className="pc-card" style={{ background: '#FFF4E0', color: '#7a4a00' }}>Tienes <b>{porApelar}</b> cobro(s) dentro del plazo para apelar.</div>}
          {filas.map((x) => {
            const e = ESTADO[x.estado] || [x.estado, '#eee', '#555']
            return (
              <div key={x.id} className="pc-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                  <b style={{ color: '#002E5D' }}>{x.patente} · {TIPO[x.tipo] || x.tipo}</b>
                  <span style={{ background: e[1], color: e[2], borderRadius: 999, padding: '2px 10px', fontSize: 12, fontWeight: 700 }}>{e[0]}</span>
                </div>
                <div style={{ fontSize: 13, color: '#545454', marginTop: 4 }}>{x.detalle}</div>
                <div style={{ fontSize: 14, fontWeight: 800, marginTop: 4 }}>{monto(x)}</div>
                <div style={{ fontSize: 12, color: '#888' }}>Notificado el {fecha(x.notificado_at)}{x.estado === 'notificado' ? ` · puedes apelar hasta el ${fecha(x.apelar_hasta)}` : ''}</div>
                {x.apelacion_motivo && <div style={{ fontSize: 12.5, marginTop: 4 }}>Tu apelación: {x.apelacion_motivo}</div>}
                {x.conc_decision && <div style={{ fontSize: 12.5, marginTop: 2, color: x.conc_decision === 'acepta' ? '#1A7A3C' : '#B42318' }}>Respuesta: {x.conc_decision === 'acepta' ? 'apelación aceptada, el cobro se anuló' : 'apelación rechazada'}{x.conc_nota ? ` · ${x.conc_nota}` : ''}</div>}
                {x.estado === 'notificado' && (abierta === x.id ? (
                  <div style={{ marginTop: 8 }}>
                    <textarea rows={3} style={{ width: '100%' }} placeholder="Explica por qué este cobro no corresponde (fecha, qué pasó, respaldo)" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
                    <button className="in-fin" disabled={busy || motivo.trim().length < 10} onClick={() => apelar(x.id)}>{busy ? 'Enviando…' : 'Enviar apelación'}</button>
                    <button className="in-fin" style={{ background: '#fff', color: '#002E5D', border: '1px solid #002E5D', marginLeft: 8 }} onClick={() => { setAbierta(null); setMotivo('') }}>Cancelar</button>
                  </div>
                ) : <button className="in-fin" style={{ marginTop: 8 }} onClick={() => { setAbierta(x.id); setMotivo('') }}>Apelar</button>)}
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}
