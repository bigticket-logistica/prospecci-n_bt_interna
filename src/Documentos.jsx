// ═══════════════════════════════════════════════════════════════════════════
// Documentos.jsx — Mi empresa › Documentos (maqueta 8.9.21)
// Solo lectura: Ver y Descargar. Recuadros-filtro Empresa · Contratos ·
// Vehículos | QR · Personal (uno siempre activo) y una tabla por categoría.
// Fuentes:
//   · documentos_empresa (archivador)  → Empresa, Contratos, QR (y respaldo de
//     pólizas / documentos de personal cargados por BigTicket)
//   · perfiles_empresa.evidencia_cuenta_path → Comprobante bancario
//   · flota_personal_terceros (activos) + certificacion_documentos →
//     Vehículos (póliza, tarjeta) y Personal (INE, CURP, RFC, licencia)
// Las bajas completadas dejan de estar activas en el padrón y no se muestran.
// Los informes confidenciales (RHCHECK) nunca se muestran.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useState } from 'react'
import { supabase, BUCKET } from './supabaseClient'
import { CSS_MK } from './Desempeno'

const ARCHIVADOR = 'archivador_empresas'
const dmy = (d) => { if (!d) return '—'; const x = new Date(d); return `${String(x.getDate()).padStart(2, '0')}/${String(x.getMonth() + 1).padStart(2, '0')}/${x.getFullYear()}` }
const masReciente = (...ds) => ds.filter(Boolean).sort().slice(-1)[0] || null
const pat = (p) => String(p || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
const norm = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
const sinExt = (n) => String(n || 'Documento').replace(/\.[a-z0-9]{2,5}$/i, '').replace(/[_-]+/g, ' ').replace(/\s+\d{10,}$/, '').trim()
const tipoLimpio = (t) => String(t || '').replace(/_\d{10,}$/, '')
const formato = (path, mime) => /pdf/i.test(mime || '') || /\.pdf$/i.test(path || '') ? 'PDF' : 'Foto'

const TABS = [['empresa', 'Empresa'], ['contratos', 'Contratos'], ['vehiculos', 'Vehículos | QR'], ['personal', 'Personal']]

export default function Documentos({ tercero, onBack }) {
  const [tab, setTab] = useState('empresa')
  const [d, setD] = useState(null)
  const [visor, setVisor] = useState(null)

  useEffect(() => { (async () => {
    const tid = tercero.tercero_id
    const [ar, pf, fl] = await Promise.all([
      supabase.from('documentos_empresa').select('*').eq('tercero_id', tid).order('created_at', { ascending: false }),
      supabase.from('perfiles_empresa').select('evidencia_cuenta_path, updated_at').eq('tercero_id', tid).maybeSingle(),
      supabase.from('flota_personal_terceros').select('id, tipo, placa, nombre, curp, certificacion_id, estado').eq('tercero_id', tid).eq('estado', 'activo'),
    ])
    const archivo = (ar.data || []).filter((x) => x.confidencial !== true && x.categoria !== 'rhcheck')
    const padron = fl.data || []
    const certIds = padron.map((x) => x.certificacion_id).filter(Boolean)
    let cdocs = []
    if (certIds.length) {
      const { data } = await supabase.from('certificacion_documentos').select('*').in('certificacion_id', certIds)
      cdocs = data || []
    }
    const docCert = (certId, tipos) => {
      const xs = cdocs.filter((x) => x.certificacion_id === certId && tipos.includes(tipoLimpio(x.tipo_documento)))
        .sort((a, b) => String(b.updated_at || b.created_at || '').localeCompare(String(a.updated_at || a.created_at || '')))
      const x = xs[0]
      return x ? { bucket: BUCKET, path: x.storage_path, fecha: x.updated_at || x.created_at, formato: formato(x.storage_path) } : null
    }
    const docArch = (filtro) => {
      const x = archivo.find(filtro)
      return x ? { bucket: x.bucket || ARCHIVADOR, path: x.storage_path, fecha: x.created_at, formato: formato(x.storage_path, x.mime_type) } : null
    }
    const textoDe = (x) => norm(`${x.nombre || ''} ${x.nombre_archivo || ''} ${x.referencia || ''} ${x.titulo || ''}`)

    // Empresa: lo del alta + comprobante bancario del perfil
    const empresa = archivo.filter((x) => ['empresa', 'anexos', 'otros'].includes(x.categoria)).map((x) => ({
      nombre: x.nombre || x.titulo || sinExt(x.nombre_archivo), doc: { bucket: x.bucket || ARCHIVADOR, path: x.storage_path, formato: formato(x.storage_path, x.mime_type) }, fecha: x.created_at,
    }))
    if (pf.data?.evidencia_cuenta_path) empresa.push({ nombre: 'Comprobante bancario', doc: { bucket: ARCHIVADOR, path: pf.data.evidencia_cuenta_path, formato: formato(pf.data.evidencia_cuenta_path) }, fecha: pf.data.updated_at })

    // Contratos firmados por ambas partes (los archiva el Brain al cerrarse la firma en Mi Fiel)
    const contratos = archivo.filter((x) => x.categoria === 'contratos').map((x) => ({
      nombre: x.nombre || x.titulo || sinExt(x.nombre_archivo), detalle: x.referencia || x.descripcion || 'Firmado por ambas partes · Mi Fiel',
      fecha: x.firmado_at || x.created_at, doc: { bucket: x.bucket || ARCHIVADOR, path: x.storage_path, formato: formato(x.storage_path, x.mime_type) },
    }))

    // Vehículos | QR: una fila por placa activa
    const vehiculos = padron.filter((x) => x.tipo === 'vehiculo' && x.placa).map((v) => {
      const p = pat(v.placa), conPlaca = (x) => pat(`${x.referencia || ''} ${x.nombre_archivo || ''} ${x.nombre || ''}`).includes(p)
      const poliza = docCert(v.certificacion_id, ['poliza_seguro', 'poliza']) || docArch((x) => x.categoria === 'seguros' && conPlaca(x))
      const tarjeta = docCert(v.certificacion_id, ['tarjeta_circulacion', 'tarjeta']) || docArch((x) => x.categoria === 'vehiculos' && conPlaca(x) && /tarjeta|circulaci/.test(textoDe(x)))
      const qrs = archivo.filter((x) => x.categoria === 'qr' && conPlaca(x))
      const qrSdd = qrs.find((x) => /sdd/.test(textoDe(x)))
      const qrSpot = qrs.find((x) => x !== qrSdd && (/spot/.test(textoDe(x)) || !/sdd/.test(textoDe(x))))
      const aDoc = (x) => x ? { bucket: x.bucket || ARCHIVADOR, path: x.storage_path, fecha: x.created_at, formato: formato(x.storage_path, x.mime_type) } : null
      const docs = { poliza, tarjeta, qrSpot: aDoc(qrSpot), qrSdd: aDoc(qrSdd) }
      return { id: v.id, placa: v.placa, docs, fecha: masReciente(...Object.values(docs).map((x) => x?.fecha)) }
    })

    // Personal: una fila por persona activa
    const personal = padron.filter((x) => x.tipo === 'conductor' || x.tipo === 'ayudante').map((r) => {
      const esAyu = r.tipo === 'ayudante'
      const conPersona = (x) => x.categoria === 'personal' && ((r.curp && pat(`${x.referencia || ''} ${x.nombre_archivo || ''}`).includes(pat(r.curp))) || (r.nombre && textoDe(x).includes(norm(r.nombre))))
      const arch = (re) => docArch((x) => conPersona(x) && re.test(textoDe(x)))
      const docs = {
        ineFrente: docCert(r.certificacion_id, ['ine', 'ine_frente']) || arch(/ine.*(frente|anverso)|frente.*ine/),
        ineReverso: docCert(r.certificacion_id, ['ine_reverso']) || arch(/reverso/),
        curp: docCert(r.certificacion_id, ['curp']) || arch(/curp/),
        rfc: docCert(r.certificacion_id, ['rfc']) || arch(/rfc|constancia/),
        licencia: esAyu ? 'no_aplica' : (docCert(r.certificacion_id, ['licencia']) || arch(/licencia/)),
      }
      return { id: r.id, nombre: r.nombre || 'Sin nombre', rol: esAyu ? 'Ayudante' : 'Conductor', docs, fecha: masReciente(...Object.values(docs).map((x) => x?.fecha)) }
    })
    setD({ empresa, contratos, vehiculos, personal })
  })() }, [tercero])

  const ver = async (titulo, sub, doc) => {
    const { data } = await supabase.storage.from(doc.bucket).createSignedUrl(doc.path, 600)
    const { data: dl } = await supabase.storage.from(doc.bucket).createSignedUrl(doc.path, 600, { download: true })
    setVisor({ titulo, sub, url: data?.signedUrl || null, descarga: dl?.signedUrl || data?.signedUrl || null, esPdf: doc.formato === 'PDF' })
  }
  const Celda = ({ doc, titulo, sub }) => doc === 'no_aplica' ? <span className="dato">No aplica</span>
    : doc ? <button className="link-action" onClick={() => ver(titulo, sub, doc)}>Ver</button> : <span className="dato">No cargado</span>
  const cuentaDocs = (filas) => filas.reduce((s, f) => s + Object.values(f.docs).filter((x) => x && x !== 'no_aplica').length, 0)

  const cont = d ? {
    empresa: [d.empresa.length, d.empresa.length === 1 ? 'documento' : 'documentos'],
    contratos: [d.contratos.length, d.contratos.length === 1 ? 'firmado' : 'firmados'],
    vehiculos: [d.vehiculos.length, `${cuentaDocs(d.vehiculos)} ${cuentaDocs(d.vehiculos) === 1 ? 'documento' : 'documentos'}`],
    personal: [d.personal.length, `${cuentaDocs(d.personal)} ${cuentaDocs(d.personal) === 1 ? 'documento' : 'documentos'}`],
  } : null

  return (
    <div className="docs">
      <style>{CSS_DOC}</style>
      <nav className="mk-ruta" aria-label="Ruta">
        <button onClick={onBack}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M11 18l-6-6 6-6" /></svg>Volver</button>
        <span className="sep" />
        <button onClick={onBack}>Inicio</button><span className="gt">›</span>
        <span>Mi empresa</span><span className="gt">›</span>
        <span aria-current="page">Documentos</span>
      </nav>
      <div>
        <h1 className="mk-titulo">Documentos de mi empresa</h1>
        <p className="mk-desc">Revisa todo el respaldo documental que has enviado a BigTicket, ordenado por categoría.</p>
      </div>

      <div className="doc-tabs" role="tablist">
        {TABS.map(([k, t]) => (
          <button key={k} role="tab" aria-selected={tab === k} className="doc-tab" onClick={() => setTab(k)}>
            <span className="label">{t}</span>
            <span className="num">{cont ? cont[k][0] : '—'}</span>
            <span className="meta">{cont ? cont[k][1] : ''}</span>
          </button>
        ))}
      </div>

      <div className="doc-table">
        {!d ? <div className="doc-vacio">Cargando documentos…</div> : (
          <div className="doc-scroll"><div className={`doc-grid ${tab}`}>
            {tab === 'empresa' && (<>
              <div className="doc-head"><span>Documento</span><span className="center">Archivo</span><span className="center">Actualizado</span></div>
              {d.empresa.length === 0 ? <div className="doc-vacio">Todavía no hay documentos de tu empresa.</div> : d.empresa.map((x, i) => (
                <div key={i} className="doc-row"><span className="first">{x.nombre}</span><span className="center"><Celda doc={x.doc} titulo={x.nombre} sub={x.doc.formato} /></span><span className="dato center">{dmy(x.fecha)}</span></div>
              ))}
            </>)}
            {tab === 'contratos' && (<>
              <div className="doc-head"><span>Documento</span><span>Detalle</span><span className="center">Firmado</span><span className="center">Archivo</span></div>
              {d.contratos.length === 0 ? <div className="doc-vacio">Todavía no tienes contratos firmados por ambas partes.</div> : d.contratos.map((x, i) => (
                <div key={i} className="doc-row"><span className="first">{x.nombre}</span><span className="dato">{x.detalle}</span><span className="dato center">{dmy(x.fecha)}</span><span className="center"><Celda doc={x.doc} titulo={x.nombre} sub={x.doc.formato} /></span></div>
              ))}
            </>)}
            {tab === 'vehiculos' && (<>
              <div className="doc-head"><span>Placa</span><span className="center">Póliza de seguro</span><span className="center">Tarjeta de circulación</span><span className="center">QR SPOT</span><span className="center">QR SDD</span><span className="center">Actualizado</span></div>
              {d.vehiculos.length === 0 ? <div className="doc-vacio">No tienes vehículos activos.</div> : d.vehiculos.map((v) => (
                <div key={v.id} className="doc-row"><span className="first">{v.placa}</span>
                  <span className="center"><Celda doc={v.docs.poliza} titulo="Póliza de seguro" sub={v.placa} /></span>
                  <span className="center"><Celda doc={v.docs.tarjeta} titulo="Tarjeta de circulación" sub={v.placa} /></span>
                  <span className="center"><Celda doc={v.docs.qrSpot} titulo="QR SPOT" sub={v.placa} /></span>
                  <span className="center"><Celda doc={v.docs.qrSdd} titulo="QR SDD" sub={v.placa} /></span>
                  <span className="dato center">{dmy(v.fecha)}</span></div>
              ))}
            </>)}
            {tab === 'personal' && (<>
              <div className="doc-head"><span>Nombre</span><span className="center">INE (F)</span><span className="center">INE (R)</span><span className="center">CURP</span><span className="center">RFC</span><span className="center">Licencia</span><span className="center">Actualizado</span></div>
              {d.personal.length === 0 ? <div className="doc-vacio">No tienes personal activo.</div> : d.personal.map((r) => (
                <div key={r.id} className="doc-row"><span><span className="first" style={{ display: 'block' }}>{r.nombre}</span><span className="sub">{r.rol}</span></span>
                  <span className="center"><Celda doc={r.docs.ineFrente} titulo="INE (frente)" sub={r.nombre} /></span>
                  <span className="center"><Celda doc={r.docs.ineReverso} titulo="INE (reverso)" sub={r.nombre} /></span>
                  <span className="center"><Celda doc={r.docs.curp} titulo="CURP" sub={r.nombre} /></span>
                  <span className="center"><Celda doc={r.docs.rfc} titulo="RFC" sub={r.nombre} /></span>
                  <span className="center"><Celda doc={r.docs.licencia} titulo="Licencia de conducir" sub={r.nombre} /></span>
                  <span className="dato center">{dmy(r.fecha)}</span></div>
              ))}
            </>)}
          </div></div>
        )}
      </div>

      {visor && (
        <div className="doc-viewer-backdrop" onClick={() => setVisor(null)}>
          <div className="doc-viewer" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <header>
              <div><h2>{visor.titulo}</h2>{visor.sub && <div className="sub">{visor.sub}</div>}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {visor.descarga && <a className="link-action" href={visor.descarga} download target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>Descargar</a>}
                <button className="doc-x" aria-label="Cerrar" onClick={() => setVisor(null)}>✕</button>
              </div>
            </header>
            <div className="doc-body">
              {!visor.url ? <div className="doc-vacio">No se pudo abrir el documento. Inténtalo de nuevo.</div>
                : visor.esPdf ? <iframe src={visor.url} title={visor.titulo} /> : <img src={visor.url} alt={visor.titulo} />}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const CSS_DOC = CSS_MK + `
.docs { display:flex; flex-direction:column; gap:20px; font-family:"Open Sans",sans-serif; }
.doc-tabs { display:grid; gap:14px; grid-template-columns:repeat(auto-fit,minmax(min(100%,200px),1fr)); }
.doc-tab { text-align:left; background:#fff; border:1.5px solid #E4E3E3; border-radius:14px; padding:16px 18px; display:flex; flex-direction:column; gap:4px; cursor:pointer; box-shadow:0 1px 3px rgba(0,46,93,.05); transition:box-shadow .2s, transform .2s, border-color .2s; font-family:inherit; }
.doc-tab:hover { box-shadow:0 12px 28px rgba(0,46,93,.14); transform:translateY(-2px); border-color:#B8C4D3; }
.doc-tab[aria-selected="true"] { border-color:#002E5D; box-shadow:0 10px 28px rgba(0,46,93,.12); }
.doc-tab .label { font:700 14px Poppins,sans-serif; color:#002E5D; }
.doc-tab .num { font:700 28px/1.15 Poppins,sans-serif; color:#002E5D; }
.doc-tab .meta { font:400 12.5px "Open Sans",sans-serif; color:#545454; }
.doc-table { background:#fff; border:1px solid #E4E3E3; border-radius:16px; padding:18px 22px; box-shadow:0 1px 3px rgba(0,46,93,.05); }
.doc-scroll { overflow-x:auto; }
.doc-grid.empresa { --cols:minmax(0,1.6fr) minmax(0,.6fr) minmax(0,.7fr); }
.doc-grid.contratos { --cols:minmax(0,1.2fr) minmax(0,1.6fr) minmax(0,.7fr) minmax(0,.6fr); }
.doc-grid.vehiculos { --cols:minmax(0,.9fr) minmax(0,1fr) minmax(0,1.2fr) minmax(0,.8fr) minmax(0,.8fr) minmax(0,1fr); min-width:760px; }
.doc-grid.personal { --cols:minmax(0,1.2fr) repeat(4,minmax(0,.8fr)) minmax(0,1fr) minmax(0,1.15fr); min-width:820px; }
.doc-head, .doc-row { display:grid; gap:16px; align-items:center; padding:14px 16px; grid-template-columns:var(--cols); }
.doc-head { background:#002E5D; border-radius:12px; margin-bottom:6px; }
.doc-head span { font:700 15px/1.25 Poppins,sans-serif; letter-spacing:.06em; text-transform:uppercase; color:#fff; }
.doc-row { border-top:1px solid #EFEDED; transition:background .15s; }
.doc-row:hover { background:#F4F6F9; }
.doc-row .first { font:700 15px Poppins,sans-serif; color:#002E5D; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.doc-row .sub { font:400 12.5px "Open Sans",sans-serif; color:#545454; }
.doc-row .dato, .doc-grid .dato { font:400 14px "Open Sans",sans-serif; color:#545454; }
.left { text-align:left; } .center { text-align:center; }
.link-action { height:28px; padding:0 4px; border:none; background:none; font:400 14px "Open Sans",sans-serif; color:#545454; cursor:pointer; text-decoration:underline; text-underline-offset:3px; transition:color .15s; }
.link-action:hover { color:#002E5D; }
.doc-vacio { padding:18px 16px; color:#545454; font-size:14px; }
.doc-viewer-backdrop { position:fixed; inset:0; z-index:290; padding:24px; background:rgba(0,46,93,.45); display:flex; align-items:center; justify-content:center; }
.doc-viewer { width:min(860px,100%); max-height:calc(100vh - 48px); background:#fff; border-radius:16px; overflow:hidden; display:flex; flex-direction:column; box-shadow:0 12px 28px rgba(0,46,93,.14); }
.doc-viewer header { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:18px 22px; border-bottom:1px solid #E4E3E3; }
.doc-viewer h2 { font:600 20px Poppins,sans-serif; color:#002E5D; margin:0; }
.doc-viewer .sub { font:400 12.5px "Open Sans",sans-serif; color:#545454; margin-top:2px; }
.doc-x { width:40px; height:40px; border-radius:50%; border:1px solid #E4E3E3; background:#fff; color:#545454; cursor:pointer; font-size:16px; }
.doc-body { padding:16px; overflow:auto; display:flex; justify-content:center; background:#F7F8FA; }
.doc-viewer iframe { width:100%; height:70vh; border:none; }
.doc-viewer img { max-width:100%; max-height:60vh; border-radius:10px; }
`
