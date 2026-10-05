// ═══════════════════════════════════════════════════════════════════════════
// Visor.jsx — Muestra un documento HTML encima de todo, dentro de la app.
//
// Solo se usa en Android: en el navegador los documentos se abren en una
// pestaña nueva. Lo dispara abrirHtml() con el evento bt:visor, y se cierra
// con su botón o con el botón físico de volver.
//
// Las prefacturas están diseñadas para un computador y miden bastante más que
// la pantalla de un teléfono. Al abrir, el documento se ajusta al ancho para
// verlo completo; desde ahí se acerca con dos dedos o con los botones. El
// WebView de la app no tiene zoom propio, así que el zoom lo hace el visor.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useRef, useState } from 'react'

const MIN = 0.2, MAX = 3

export default function Visor() {
  const [doc, setDoc] = useState(null)
  const [zoom, setZoom] = useState(1)
  const marco = useRef(null)
  const zRef = useRef(1)        // el zoom vigente, para los gestos
  const ajuste = useRef(1)      // el zoom que deja el documento al ancho exacto

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

  const aplicar = (v) => {
    const d = marco.current?.contentDocument
    if (!d) return
    const z = Math.min(MAX, Math.max(MIN, v))
    d.documentElement.style.zoom = String(z)
    zRef.current = z
    setZoom(z)
  }

  // Al cargar: se mide el ancho real del documento y se calcula el zoom que lo
  // hace caber. Después se engancha el gesto de pellizcar.
  const alCargar = () => {
    const f = marco.current
    const d = f?.contentDocument
    if (!d) return
    d.documentElement.style.zoom = '1'
    const ancho = Math.max(d.documentElement.scrollWidth, d.body?.scrollWidth || 0)
    ajuste.current = ancho > f.clientWidth ? (f.clientWidth - 4) / ancho : 1
    aplicar(ajuste.current)

    let base = null
    const dist = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY)
    d.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) base = { d: dist(e.touches), z: zRef.current }
    }, { passive: true })
    d.addEventListener('touchmove', (e) => {
      if (!base || e.touches.length !== 2) return
      e.preventDefault()
      aplicar(base.z * dist(e.touches) / base.d)
    }, { passive: false })
    d.addEventListener('touchend', () => { base = null })
  }

  if (!doc) return null
  const ajustado = Math.abs(zoom - ajuste.current) < 0.01
  return (
    <div className="vs-capa" role="dialog" aria-label={doc.titulo}>
      <div className="vs-cab">
        <span>{doc.titulo}</span>
        <button onClick={() => setDoc(null)}>Cerrar</button>
      </div>
      {/* Sin scripts: el documento solo se lee. El visor puede tocarlo porque
          comparte origen, que es lo que permite el zoom. */}
      <iframe ref={marco} className="vs-doc" title={doc.titulo} srcDoc={doc.html}
        sandbox="allow-same-origin" onLoad={alCargar} />
      <div className="vs-zoom">
        <button onClick={() => aplicar(zRef.current / 1.25)} aria-label="Alejar">−</button>
        <button className="vs-ajustar" onClick={() => aplicar(ajustado ? 1 : ajuste.current)}>
          {ajustado ? 'Tamaño real' : 'Ajustar al ancho'}
        </button>
        <button onClick={() => aplicar(zRef.current * 1.25)} aria-label="Acercar">+</button>
      </div>
    </div>
  )
}
