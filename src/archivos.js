// ═══════════════════════════════════════════════════════════════════════════
// archivos.js — Abrir y guardar archivos, en el navegador y en la aplicación.
//
// En el navegador basta con window.open y una descarga. Dentro de la
// aplicación de Android eso no funciona: el WebView no abre ventanas nuevas,
// no imprime y no descarga. Acá vive la diferencia, para que cada pantalla
// llame a una sola función y no tenga que saber dónde está corriendo.
//
//   · abrirUrl     un archivo del archivador (PDF, imagen, XML). En la app se
//                  abre en Chrome, dentro de la misma aplicación.
//   · abrirHtml    un documento HTML (las prefacturas). En la app se muestra
//                  en un visor propio, porque Chrome no puede leer un archivo
//                  que solo existe en la memoria del teléfono.
//   · guardarPdf   un PDF generado acá. En la app se abre el menú de
//                  compartir: guardarlo en Drive, mandarlo por WhatsApp, etc.
// ═══════════════════════════════════════════════════════════════════════════
import { esApp } from './nativo'

// Los .html del archivador llegan como texto plano y Chrome los muestra como
// código, así que se bajan y se muestran como página.
const esHtml = (url) => /\.html?($|\?)/i.test(String(url || ''))

export async function abrirUrl(url) {
  if (!url) return
  if (esHtml(url)) {
    try {
      const r = await fetch(url)
      abrirHtml(await r.text())
      return
    } catch (e) { console.error('No se pudo leer el documento:', e) }
  }
  if (esApp()) {
    const { Browser } = await import('@capacitor/browser')
    await Browser.open({ url })
    return
  }
  window.open(url, '_blank')
}

export function abrirHtml(html, titulo = 'Documento') {
  if (esApp()) {
    window.dispatchEvent(new CustomEvent('bt:visor', { detail: { html, titulo } }))
    return
  }
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }))
  window.open(url, '_blank')
  setTimeout(() => URL.revokeObjectURL(url), 60000)
}

// Recibe un documento de jsPDF ya armado.
export async function guardarPdf(doc, nombre) {
  if (!esApp()) { doc.save(nombre); return }
  const [{ Filesystem, Directory }, { Share }] = await Promise.all([
    import('@capacitor/filesystem'),
    import('@capacitor/share'),
  ])
  const data = doc.output('datauristring').split(',')[1]
  const { uri } = await Filesystem.writeFile({ path: nombre, data, directory: Directory.Cache })
  try {
    await Share.share({ title: nombre, files: [uri] })
  } catch (e) {
    // Cerrar el menú sin elegir nada también llega como error: no es un fallo.
    if (!/cancel/i.test(String(e?.message || e))) throw e
  }
}
