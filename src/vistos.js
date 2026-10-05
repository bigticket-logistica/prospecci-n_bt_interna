// ═══════════════════════════════════════════════════════════════════════════
// vistos.js — Qué reclamos ya abrió el tercero.
//
// El punto naranja de Reclamos avisa de algo nuevo: un caso que todavía no
// abre, o uno que cambió de estado desde la última vez que lo miró. Al abrir
// el detalle queda visto y el punto se apaga. El caso sigue en la lista igual,
// porque sigue abierto; lo que se apaga es el aviso, no el caso.
//
// Se guarda en el teléfono o en el navegador: es una señal de lectura, no un
// dato del caso. Por eso lo visto en el computador no apaga el punto del
// teléfono.
// ═══════════════════════════════════════════════════════════════════════════
const CLAVE = 'bt_reclamos_vistos'

// El estado va en la clave: si MELI mueve el caso, vuelve a aparecer como nuevo.
export const claveCaso = (c) => `${c.case_id}|${c.sub_estado || ''}`

export function leerVistos() {
  try { return new Set(JSON.parse(localStorage.getItem(CLAVE) || '[]')) } catch { return new Set() }
}

export const sinVer = (casos) => {
  const v = leerVistos()
  return (casos || []).filter(c => !v.has(claveCaso(c)))
}

export function marcarVisto(c) {
  try {
    const v = [...leerVistos()]
    const k = claveCaso(c)
    if (v.includes(k)) return
    localStorage.setItem(CLAVE, JSON.stringify([...v, k].slice(-500)))
    // Los contadores del menú escuchan este evento y se actualizan al tiro.
    window.dispatchEvent(new Event('bt:leido'))
  } catch { /* sin almacenamiento el punto sigue encendido, nada más */ }
}
