// ═══════════════════════════════════════════════════════════════════════════
// FirmaContrato.jsx — Certificación › Firma de contrato (maqueta 8.9.20)
// Una tarjeta por contrato o anexo, con los pasos Enviado → Tu firma → Firma
// BigTicket y un solo botón según el estado:
//   falta tu firma        → "Firma tu contrato" (flujo actual de Mi Fiel: el widget)
//   falta firma BigTicket → "Ver documento"
//   firmado por ambos     → "Descargar contrato"
// Fuentes (las mismas de antes): certificaciones_mx (contrato de transportista),
// certificaciones (contratos de personal) y contratos_gestion (anexos y otros).
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useState } from 'react'
import { supabase, BUCKET } from './supabaseClient'

const fFirma = (x) => x ? new Date(x).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }).replace(/\./g, '').toLowerCase() : null
// Columnas posibles con el documento (sin firmar y firmado): se usa la primera que exista
const COLS_DOC = ['documento_url', 'pdf_url', 'archivo_url', 'url_documento', 'pdf_path', 'archivo_path', 'storage_path', 'documento_path']
const COLS_FIRMADO = ['documento_firmado_url', 'pdf_firmado_url', 'archivo_firmado_url', 'pdf_firmado_path', 'archivo_firmado_path', 'firmado_path', 'pdf_firmado']
const primera = (r, cols) => cols.map((c) => r?.[c]).find((v) => v)
const IcoCheck = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>

export default function FirmaContrato({ tercero, email, onBack, Widget }) {
  const [lista, setLista] = useState(null)
  const [abierto, setAbierto] = useState(null)
  const [aviso, setAviso] = useState('')

  // Script del widget de Mi Fiel (una sola vez)
  useEffect(() => {
    if (document.querySelector('script[data-mifiel-widget]')) return
    const s = document.createElement('script')
    s.type = 'module'; s.src = 'https://app.mifiel.com/widget-component/index.js'; s.setAttribute('data-mifiel-widget', '1')
    document.head.appendChild(s)
  }, [])

  async function cargar() {
    const [mx, ce, ge, ar] = await Promise.all([
      supabase.from('certificaciones_mx').select('*').ilike('email', email || '').not('mifiel_documento_id', 'is', null).order('contrato_enviado_at', { ascending: false }),
      supabase.from('certificaciones').select('*, certificacion_conductor(nombre,curp)').eq('tercero_id', tercero.tercero_id).not('mifiel_documento_id', 'is', null).order('contrato_enviado_at', { ascending: false }),
      supabase.from('contratos_gestion').select('*').eq('tercero_id', tercero.tercero_id).in('estado', ['enviado', 'firmado']).order('enviado_at', { ascending: false }),
      // El archivador de la empresa: ahí deja el Brain los contratos firmados por ambos
      supabase.from('documentos_empresa').select('*').eq('tercero_id', tercero.tercero_id).order('created_at', { ascending: false }),
    ])
    const archivo = (ar.data || []).filter((d) => d.confidencial !== true && d.categoria !== 'rhcheck')
    const items = []
    for (const c of mx.data || []) items.push({
      key: `mx-${c.id}`, origen: 'mx', fila: c, titulo: `Contrato · ${c.nombre || 'Transportista'}`,
      enviado: c.contrato_enviado_at, tuFirma: !!c.mifiel_firmado_conductor, btFirma: !!c.mifiel_firmado_bigticket,
      tuFecha: c.firmado_conductor_at || c.mifiel_firmado_conductor_at || null, btFecha: c.contrato_firmado_at || c.firmado_bigticket_at || null,
      widget: c.mifiel_widget_conductor, doc: primera(c, COLS_DOC), docFirmado: primera(c, COLS_FIRMADO), mifiel: c.mifiel_documento_id,
    })
    for (const r of ce.data || []) {
      const p = Array.isArray(r.certificacion_conductor) ? r.certificacion_conductor[0] : r.certificacion_conductor
      const ambos = !!r.contrato_firmado_at
      items.push({
        key: `c-${r.id}`, origen: 'cert', fila: r, titulo: `Contrato · ${p?.nombre || 'Sin nombre'}`,
        enviado: r.contrato_enviado_at, tuFirma: !!r.mifiel_firmado_conductor || ambos, btFirma: !!r.mifiel_firmado_bigticket || ambos,
        tuFecha: r.firmado_conductor_at || null, btFecha: r.contrato_firmado_at || null,
        widget: r.mifiel_widget_conductor, doc: primera(r, COLS_DOC), docFirmado: primera(r, COLS_FIRMADO), mifiel: r.mifiel_documento_id,
      })
    }
    // Un mismo documento de Mi Fiel puede estar en certificaciones y en el Gestionador: se muestra una vez
    const ya = new Set(items.map((i) => String(i.mifiel || '')).filter(Boolean))
    for (const d of ge.data || []) {
      if (d.mifiel_documento_id && ya.has(String(d.mifiel_documento_id))) continue
      const ambos = d.estado === 'firmado'
      items.push({
        key: `g-${d.id}`, origen: 'gestion', fila: d, titulo: d.titulo || 'Documento',
        enviado: d.enviado_at, tuFirma: !!d.firmado_tercero || ambos, btFirma: !!d.firmado_bigticket || ambos,
        tuFecha: d.firmado_tercero_at || null, btFecha: d.firmado_at || null,
        widget: d.mifiel_widget_tercero, doc: primera(d, COLS_DOC), docFirmado: primera(d, COLS_FIRMADO), mifiel: d.mifiel_documento_id,
      })
    }
    // Cada contrato con su documento firmado del archivador: por id del contrato, por id de Mi Fiel o por título
    const norm = (x) => String(x || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    for (const it of items) {
      const ids = [String(it.fila.id), String(it.mifiel || '')].filter((x) => x && x !== 'undefined')
      const porId = archivo.find((d) => Object.values(d).some((v) => v != null && ids.includes(String(v))) || ids.some((x) => x.length > 6 && String(d.storage_path || '').includes(x)))
      const t = norm(it.titulo.replace(/^contrato · /i, ''))
      const porTitulo = archivo.find((d) => /contrat|anexo|firmad/i.test(`${d.categoria} ${d.nombre || d.titulo || ''}`) && t.length > 3 && norm(`${d.nombre || ''} ${d.titulo || ''} ${d.storage_path || ''}`).includes(t))
      const doc = porId || porTitulo
      if (doc) it.archivo = { bucket: doc.bucket || 'archivador_empresas', path: doc.storage_path }
    }
    items.sort((a, b) => new Date(b.enviado || 0) - new Date(a.enviado || 0))
    setLista(items)
  }
  useEffect(() => { cargar() }, [tercero])   // eslint-disable-line react-hooks/exhaustive-deps

  // Al terminar la firma en Mi Fiel: se marca "Tu firma" (la confirmación oficial llega por el webhook al Brain)
  async function firmado(it) {
    if (it.origen === 'mx') await supabase.from('certificaciones_mx').update({ mifiel_firmado_conductor: true }).eq('id', it.fila.id)
    if (it.origen === 'cert') await supabase.from('certificaciones').update({ mifiel_firmado_conductor: true }).eq('id', it.fila.id)
    if (it.origen === 'gestion') {
      await supabase.from('contratos_gestion').update({ firmado_tercero: true }).eq('id', it.fila.id)
      try {
        fetch('https://bigticket2026.app.n8n.cloud/webhook/sincronizar-firmados', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contrato_id: it.fila.id, origen: 'portal_tercero' }) }).catch(() => {})
      } catch { /* silencioso */ }
    }
    setAbierto(null); cargar()
  }

  const abrirDoc = async (ref, descargar, bucket) => {
    setAviso('')
    if (!ref) { setAviso('El contrato firmado por ambas partes todavía se está archivando. Vuelve a intentarlo en unos minutos o búscalo en Mi empresa › Documentos.'); return }
    let url = ref
    if (!/^https?:\/\//.test(ref)) {
      const { data } = await supabase.storage.from(bucket || BUCKET).createSignedUrl(ref, 600, descargar ? { download: true } : undefined)
      url = data?.signedUrl
    }
    if (!url) { setAviso('No se pudo abrir el documento. Inténtalo de nuevo en un momento.'); return }
    if (descargar) { const a = document.createElement('a'); a.href = url; a.download = ''; a.target = '_blank'; a.rel = 'noreferrer'; document.body.appendChild(a); a.click(); a.remove() }
    else window.open(url, '_blank', 'noopener')
  }

  return (
    <div className="fc">
      <style>{CSS_FC}</style>
      <nav className="fc-ruta" aria-label="Ruta">
        <button className="fc-volver" onClick={onBack}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M11 18l-6-6 6-6" /></svg>Volver</button><span className="fc-sep" />
        <button className="fc-miga" onClick={onBack}>Inicio</button><span className="fc-gt">›</span>
        <span>Certificación</span><span className="fc-gt">›</span>
        <span aria-current="page">Firma de contrato</span>
      </nav>
      <h1 className="fc-titulo">Firma de contrato</h1>
      <p className="fc-desc">Firma digitalmente aquí usando tu e.firma (SAT), de forma rápida y segura.</p>
      {aviso && <div className="fc-aviso">{aviso}</div>}

      {lista === null ? <div className="fc-contract">Cargando…</div>
        : lista.length === 0 ? (
          <div className="fc-contract"><h2>No tienes documentos por firmar</h2>
            <p className="fc-vacio">Cuando BigTicket te envíe un contrato o anexo, aparecerá aquí para firmarlo digitalmente.</p></div>
        ) : lista.map((it) => {
          const pasos = [
            { n: 1, nombre: 'Enviado', hecho: true, fecha: fFirma(it.enviado) },
            { n: 2, nombre: 'Tu firma', hecho: it.tuFirma, fecha: fFirma(it.tuFecha) },
            { n: 3, nombre: 'Firma BigTicket', hecho: it.btFirma, fecha: fFirma(it.btFecha) },
          ]
          return (
            <div key={it.key} className="fc-contract">
              <h2>{it.titulo}</h2>
              <div className="fc-foot">
                <div className="fc-steps">
                  {pasos.map((p, i) => (
                    <div key={p.n} style={{ display: 'contents' }}>
                      {i > 0 && <span className="fc-line" />}
                      <div className={`fc-step ${p.hecho ? 'is-done' : 'is-pending'}`}>
                        <span className="fc-dot">{p.hecho ? <IcoCheck /> : p.n}</span>
                        <span><span className="fc-step-name">{p.nombre}</span><span className="fc-step-date">{p.hecho ? (p.fecha || 'Listo') : 'Pendiente'}</span></span>
                      </div>
                    </div>
                  ))}
                </div>
                {!it.tuFirma ? (
                  <button className="fc-btn is-sign" disabled={!it.widget} title={it.widget ? '' : 'El enlace de firma aún no está listo'}
                    onClick={() => setAbierto(abierto === it.key ? null : it.key)}>{abierto === it.key ? 'Cerrar firma' : 'Firma tu contrato'}</button>
                ) : !it.btFirma ? (
                  // Firmado por el transportista, falta BigTicket: se ve en el visor de Mi Fiel (o el archivo, si ya está)
                  <button className="fc-btn is-outline" onClick={() => it.archivo ? abrirDoc(it.archivo.path, false, it.archivo.bucket)
                    : it.widget ? setAbierto(abierto === it.key ? null : it.key) : abrirDoc(it.doc, false)}>{abierto === it.key ? 'Cerrar documento' : 'Ver documento'}</button>
                ) : (
                  <button className="fc-btn is-outline" onClick={() => it.archivo ? abrirDoc(it.archivo.path, true, it.archivo.bucket) : abrirDoc(it.docFirmado || it.doc, true)}>Descargar contrato</button>
                )}
              </div>
              {abierto === it.key && it.widget && Widget && !it.btFirma && (
                <div className="fc-widget"><Widget widgetId={it.widget} onSuccess={() => firmado(it)} /></div>
              )}
            </div>
          )
        })}
    </div>
  )
}

const CSS_FC = `
.fc { font-family:"Open Sans",system-ui,sans-serif; display:flex; flex-direction:column; }
.fc-ruta { display:flex; align-items:center; gap:10px; font:400 13px "Open Sans",sans-serif; color:#545454; margin-bottom:14px; flex-wrap:wrap; }
.fc-ruta button { background:none; border:none; padding:0; font:inherit; color:#545454; cursor:pointer; display:inline-flex; align-items:center; gap:6px; }
.fc-ruta button:hover { color:#002E5D; text-decoration:underline; }
.fc-sep { width:1px; height:14px; background:#D9D9D9; }
.fc-gt { color:#9AA3AE; }
.fc-ruta [aria-current] { color:#002E5D; font-weight:600; }
.fc-titulo { font:700 28px Poppins,sans-serif; color:#002E5D; margin:0; }
.fc-desc { font:400 14px/1.5 "Open Sans",sans-serif; color:#545454; margin:6px 0 20px; }
.fc-aviso { background:#FFF4EC; color:#7c3a12; border:1px solid #F5D9B8; border-radius:10px; padding:10px 14px; font-size:13.5px; margin-bottom:14px; }
.fc-contract { background:#fff; border:1px solid #E4E3E3; border-radius:14px; padding:20px 22px; display:flex; flex-direction:column; gap:18px;
  box-shadow:0 1px 3px rgba(0,46,93,.05); transition:box-shadow .2s, transform .2s, border-color .2s; margin-bottom:20px; }
.fc-contract:hover { box-shadow:0 12px 28px rgba(0,46,93,.14); transform:translateY(-2px); border-color:#B8C4D3; }
.fc-contract h2 { font:700 17px Poppins,sans-serif; color:#002E5D; margin:0; }
.fc-vacio { margin:0; font-size:14px; color:#545454; }
.fc-foot { display:flex; justify-content:space-between; align-items:center; gap:16px; flex-wrap:wrap; padding-top:18px; border-top:1px solid #EFEDED; }
.fc-steps { display:flex; align-items:center; gap:14px; flex-wrap:wrap; }
.fc-step { display:flex; align-items:center; gap:10px; }
.fc-step > span:last-child { display:flex; flex-direction:column; }
.fc-dot { width:28px; height:28px; border-radius:50%; flex:none; display:flex; align-items:center; justify-content:center; box-sizing:border-box; }
.fc-step.is-done .fc-dot { background:#002E5D; }
.fc-step.is-pending .fc-dot { border:1.5px solid #C9CDD2; font:700 13px Poppins,sans-serif; color:#9AA1A9; }
.fc-step-name { font:600 14px "Open Sans",sans-serif; color:#545454; }
.fc-step-date { font:400 12.5px "Open Sans",sans-serif; color:#545454; }
.fc-line { width:44px; height:2px; border-radius:2px; background:#D9D9D9; }
.fc-btn { width:200px; height:44px; border-radius:10px; font:700 14px Poppins,sans-serif; display:inline-flex; align-items:center; justify-content:center; white-space:nowrap; cursor:pointer; }
.fc-btn:disabled { opacity:.5; cursor:not-allowed; }
.fc-btn.is-sign { border:none; background:#FF6600; color:#fff; }
.fc-btn.is-sign:hover:not(:disabled) { background:#E65C00; }
.fc-btn.is-outline { border:1px solid #002E5D; background:#fff; color:#002E5D; }
.fc-btn.is-outline:hover { background:#F7F9FC; }
.fc-widget { border:1px solid #E4E3E3; border-radius:12px; padding:8px; min-height:620px; background:#fff; }
@media (max-width: 640px) { .fc-foot { flex-direction:column; align-items:stretch; } .fc-btn { width:100%; } .fc-line { width:20px; } }
`
