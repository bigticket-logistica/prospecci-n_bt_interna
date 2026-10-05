// ═══════════════════════════════════════════════════════════════════════════
// Visor.jsx — Muestra un documento HTML encima de todo, dentro de la app.
//
// Solo se usa en Android: en el navegador los documentos se abren en una
// pestaña nueva. Lo dispara abrirHtml() con el evento bt:visor, y se cierra
// con su botón o con el botón físico de volver.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useState } from 'react'

export default function Visor() {
  const [doc, setDoc] = useState(null)

  useEffect(() => {
    const abrir = (e) => setDoc(e.detail)
    window.addEventListener('bt:visor', abrir)
    return () => window.removeEventListener('bt:visor', abrir)
  }, [])

  // El botón de volver lo cierra antes de mover la pantalla de fondo, igual
  // que con el chat de Biggy.
  useEffect(() => {
    if (!doc) return
    const volver = (e) => { e.preventDefault(); setDoc(null) }
    window.addEventListener('bt:volver', volver)
    return () => window.removeEventListener('bt:volver', volver)
  }, [doc])

  if (!doc) return null
  return (
    <div className="vs-capa" role="dialog" aria-label={doc.titulo}>
      <div className="vs-cab">
        <span>{doc.titulo}</span>
        <button onClick={() => setDoc(null)}>Cerrar</button>
      </div>
      {/* Sin scripts: el documento solo se lee. */}
      <iframe className="vs-doc" title={doc.titulo} srcDoc={doc.html} sandbox="allow-same-origin" />
    </div>
  )
}
