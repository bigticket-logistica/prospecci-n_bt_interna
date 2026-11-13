// ═══════════════════════════════════════════════════════════════════════════
// Desempeno.jsx — Mi operación › Desempeño (maqueta 8.9.21)
// Estado temporal: mientras el reporte no esté listo, solo la ilustración y el
// mensaje. No consulta datos, no tiene acciones ni globo.
// ═══════════════════════════════════════════════════════════════════════════
export default function Desempeno({ onBack }) {
  return (
    <div className="dsm">
      <style>{CSS_DSM}</style>
      <nav className="mk-ruta" aria-label="Ruta">
        <button onClick={onBack}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M11 18l-6-6 6-6" /></svg>Volver</button>
        <span className="sep" />
        <button onClick={onBack}>Inicio</button><span className="gt">›</span>
        <span>Mi operación</span><span className="gt">›</span>
        <span aria-current="page">Desempeño</span>
      </nav>
      <h1 className="mk-titulo">Desempeño</h1>
      <section className="empty-state">
        <svg className="empty-illus" role="img" aria-label="Indicadores en ajuste" width="260" height="166" viewBox="0 0 220 140" fill="none">
          <ellipse cx="110" cy="130" rx="100" ry="7" fill="#EEF1F5" />
          <path d="M42.4 85.9A70 70 0 0 1 80.4 40.6" stroke="#C5D6EA" strokeWidth="16" strokeLinecap="round" />
          <path d="M139.6 40.6A70 70 0 0 1 179.7 110.1" stroke="#002E5D" strokeWidth="16" strokeLinecap="round" />
          <path d="M80.4 40.6A70 70 0 0 1 139.6 40.6" stroke="#7397C2" strokeWidth="16" />
          <path d="M64.9 87.6A48 48 0 0 1 155.1 87.6" stroke="#D3DAE3" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="0.5 7" />
          <path d="M110 104 105 60" stroke="#002E5D" strokeWidth="4" strokeLinecap="round" />
          <circle cx="110" cy="104" r="7" fill="#002E5D" />
          <circle cx="110" cy="104" r="2.6" fill="#fff" />
          <rect x="86" y="118" width="48" height="6" rx="2" fill="#002E5D" />
          <g transform="translate(8 90)" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 29 25 13" stroke="#002E5D" strokeWidth="7.5" />
            <path d="M9 29 25 13" stroke="#7397C2" strokeWidth="3.8" />
            <circle cx="27.5" cy="10.5" r="6.2" fill="#7397C2" stroke="#002E5D" strokeWidth="2" />
            <path d="M27.5 10.5 32.5 5.5" stroke="#fff" strokeWidth="5" />
            <path d="M25.6 8.6 29.6 4.6M29.4 12.4 33.4 8.4" stroke="#002E5D" strokeWidth="2" />
            <circle cx="8" cy="30" r="4.6" fill="#7397C2" stroke="#002E5D" strokeWidth="2" />
            <circle cx="8" cy="30" r="1.5" fill="#fff" />
            <path d="M6.5 6.5 19.5 19.5" stroke="#002E5D" strokeWidth="2.8" />
            <path d="M4.5 4.5 7 7" stroke="#002E5D" strokeWidth="4" />
            <path d="M17 22 22 17" stroke="#002E5D" strokeWidth="3" />
            <path d="M21.5 21.5 30 30" stroke="#002E5D" strokeWidth="8.5" />
            <path d="M21.5 21.5 30 30" stroke="#FF6600" strokeWidth="4.6" />
          </g>
          <path d="M190 96h6l9 32h-24z" fill="#FF6600" />
          <path d="M186.5 110h13M184.5 118h17.5" stroke="#fff" strokeWidth="4" />
          <rect x="178" y="127" width="30" height="4.5" rx="1.5" fill="#002E5D" />
        </svg>
        <h2>Estamos ajustando tus indicadores</h2>
        <p>Muy pronto verás aquí el detalle de tu nivel de servicio.</p>
      </section>
    </div>
  )
}

// Ruta y título comunes de las vistas 8.9.21 (los usan también Descuentos, Documentos y Perfil)
export const CSS_MK = `
.mk-ruta { display:flex; align-items:center; gap:10px; flex-wrap:wrap; font:400 13px "Open Sans",sans-serif; color:#545454; }
.mk-ruta button { background:none; border:none; padding:0; font:inherit; color:#545454; cursor:pointer; display:inline-flex; align-items:center; gap:6px; }
.mk-ruta button:hover { color:#002E5D; text-decoration:underline; }
.mk-ruta .sep { width:1px; height:14px; background:#D9D9D9; }
.mk-ruta .gt { color:#9AA3AE; }
.mk-ruta [aria-current] { color:#002E5D; font-weight:600; }
.mk-titulo { font:700 28px Poppins,sans-serif; color:#002E5D; margin:0; }
.mk-desc { font:400 14px/1.5 "Open Sans",sans-serif; color:#545454; margin:6px 0 0; }
`
const CSS_DSM = CSS_MK + `
.dsm { display:flex; flex-direction:column; gap:20px; }
.empty-state { background:#fff; border:1px solid #E4E3E3; border-radius:18px; padding:48px 28px; display:flex; flex-direction:column; align-items:center; text-align:center; gap:8px; }
.empty-illus { display:block; width:260px; height:166px; margin-bottom:14px; }
.empty-state h2 { font:700 17px Poppins,sans-serif; color:#002E5D; margin:0; }
.empty-state p { font:400 14px/1.5 "Open Sans",sans-serif; color:#545454; max-width:460px; margin:0; text-wrap:pretty; }
`
