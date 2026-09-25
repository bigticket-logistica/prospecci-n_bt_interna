// ═══════════════════════════════════════════════════════════════════════════
// notificaciones.js — Alertas del portal.
//
// Las alertas se generan en la base (fn_portal_refrescar_notificaciones) a
// partir de lo que ya pasó: un día publicado, un descuento, una diferencia
// resuelta, un aviso del Brain. Los textos, colores y plazos se editan en el
// Brain (pestaña Alertas Portal); aquí solo se leen y se decide la pastilla.
// ═══════════════════════════════════════════════════════════════════════════
import { supabase } from './supabaseClient'

const DIA = 86400000

export async function cargarNotificaciones(terceroId) {
  if (!terceroId) return []
  // Si el refresco falla, igual se muestran las que ya existen.
  try { await supabase.rpc('fn_portal_refrescar_notificaciones') } catch { /* sigue */ }
  const ahora = new Date().toISOString()
  const { data } = await supabase.from('notificaciones_tercero')
    .select('id, tipo, clase, titulo, detalle, estilo, etiqueta, destino, evento_at, vence_at, urgente_desde, visible_hasta, leida_at')
    .eq('tercero_id', terceroId)
    .is('resuelta_at', null)
    .or(`visible_hasta.is.null,visible_hasta.gt.${ahora}`)
    .order('evento_at', { ascending: false })
    .limit(100)
  return ordenar((data || []).map(n => ({ ...n, pastilla: pastillaDe(n) })))
}

export function marcarLeida(id) {
  if (typeof id !== 'number') return
  supabase.rpc('fn_portal_marcar_leida', { p_id: id }).then(() => {}, () => {})
}

// Una pendiente con plazo cambia de pastilla a medida que se acerca el
// vencimiento; el resto usa la que se configuró en el Brain.
export function pastillaDe(n, ahora = Date.now()) {
  if (n.clase === 'pendiente') {
    if (n.urgente_desde && ahora >= new Date(n.urgente_desde).getTime()) return { estilo: 'rojo', etiqueta: 'Urgente' }
    if (n.vence_at) {
      const dias = Math.ceil((new Date(n.vence_at).getTime() - ahora) / DIA)
      if (dias <= 1) return { estilo: 'naranja', etiqueta: 'Mañana' }
      if (dias <= 7) return { estilo: 'naranja', etiqueta: `En ${dias} días` }
    }
  }
  return { estilo: n.estilo, etiqueta: n.etiqueta }
}

const peso = (n) => n.pastilla.estilo === 'rojo' && n.clase === 'pendiente' ? 0
  : n.clase === 'pendiente' ? 1 : n.leida_at ? 3 : 2

function ordenar(lista) {
  return lista.sort((a, b) => {
    const p = peso(a) - peso(b)
    if (p) return p
    if (a.clase === 'pendiente' && a.vence_at && b.vence_at) return a.vence_at.localeCompare(b.vence_at)
    return String(b.evento_at).localeCompare(String(a.evento_at))
  })
}

// Lo que cuenta la campana: pendientes abiertas y novedades sin leer.
export const cuentaCampana = (lista) => lista.filter(n => n.clase === 'pendiente' || !n.leida_at).length
