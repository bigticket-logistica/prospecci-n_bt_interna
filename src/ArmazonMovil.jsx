// ═══════════════════════════════════════════════════════════════════════════
// ArmazonMovil.jsx — El portal en el teléfono.
//
// Las pantallas son las mismas; lo que cambia es cómo se llega a ellas. En el
// computador hay un menú lateral con siete grupos desplegables: en una pantalla
// de 390px eso obliga a dos toques y una lectura en vertical para cada cosa.
//
// Acá se reemplaza por lo que la gente ya sabe usar en un teléfono: cabecera
// azul con el saludo y la campana, contenido en una columna, y cinco pestañas
// abajo con lo que se usa a diario. Lo demás vive en "Más", que abre el menú
// completo como hoja deslizante.
//
// Se activa solo en pantallas angostas o dentro de la aplicación; el portal web
// sigue exactamente igual.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useRef, useState } from 'react'
import { supabase } from './supabaseClient'
import { cargarNotificaciones } from './notificaciones'
import { sinVer } from './vistos'

// Cinco pestañas: las cuatro cosas que un tercero hace a diario, más el resto.
// Desempeño queda fuera a propósito mientras esté en construcción; Reclamos
// toma su lugar porque ahí hay plazos corriendo y plata en juego.
const TABS = [
  { k: 'home', label: 'Inicio', v: 'home' },
  { k: 'billetera', label: 'Billetera', v: 'movimientos' },
  { k: 'facturacion', label: 'Facturación', v: 'facturacion' },
  { k: 'reclamos', label: 'Reclamos', v: 'reclamos' },
  { k: 'mas', label: 'Más', v: null },
]

// A qué pestaña pertenece cada pantalla, para marcarla al navegar desde
// cualquier parte: una notificación puede llevar directo a Descuentos.
const TAB_DE = {
  home: 'home',
  movimientos: 'billetera', descuentos: 'billetera',
  facturacion: 'facturacion', facturado: 'facturacion', pagado: 'facturacion',
  reclamos: 'reclamos',
}

const MAS = [
  { grupo: 'Mensajes', items: [{ v: 'mensajes', t: 'Mis mensajes', d: 'Avisos sobre tus pagos y reclamos' }] },
  { grupo: 'Mi operación', items: [
    { v: 'flota', t: 'Mi Flota', d: 'Vehículos y personal activos' },
    { v: 'desempeno', t: 'Desempeño', d: 'Indicadores de nivel de servicio' },
  ] },
  { grupo: 'Certificación', items: [
    { v: 'certificar', t: 'Certificar', d: 'Sube los documentos de tu gente y tus unidades' },
    { v: 'estado', t: 'Estado', d: 'En qué va cada trámite' },
    { v: 'firma', t: 'Firma de contrato', d: 'Tus contratos y su estado' },
    { v: 'baja', t: 'Solicitar baja', d: 'Da de baja una unidad o una persona' },
  ] },
  { grupo: 'Mi empresa', items: [
    { v: 'perfil', t: 'Perfil y cuenta bancaria', d: 'Datos fiscales y dónde se te paga' },
    { v: 'docs', t: 'Documentos', d: 'Tu archivo con Bigticket' },
  ] },
]

// Lo que vive dentro de cada pestaña cuando tiene más de una pantalla.
const SOLAPAS = {
  billetera: [['movimientos', 'Movimientos'], ['descuentos', 'Descuentos']],
  facturacion: [['facturacion', 'Por facturar'], ['facturado', 'Facturado'], ['pagado', 'Pagado']],
}

const SOLO_PAGOS = ['movimientos', 'descuentos', 'facturacion', 'facturado', 'pagado']

export function esMovil() {
  if (typeof window === 'undefined') return false
  return window.Capacitor?.isNativePlatform?.() === true || window.innerWidth < 820
}

export function ShellMovil({ tercero, email, vista, onNavegar, children }) {
  const [mas, setMas] = useState(false)
  const [sinLeer, setSinLeer] = useState(0)
  const [reclamos, setReclamos] = useState(0)

  useEffect(() => {
    if (!tercero?.tercero_id) return
    let vivo = true
    const contar = async () => {
      const [m, p] = await Promise.all([
        supabase.from('notificaciones_tercero').select('id', { count: 'exact', head: true })
          .eq('tercero_id', tercero.tercero_id).is('leida_at', null),
        supabase.from('vw_portal_pnr').select('case_id, sub_estado').eq('resultado', 'en_curso'),
      ])
      if (!vivo) return
      setSinLeer(m.count || 0)
      // Solo lo que el tercero no ha abierto: el punto avisa de lo nuevo, no
      // de lo que sigue abierto. Antes contaba todo y nunca se apagaba.
      setReclamos(sinVer(p.data).length)
    }
    contar()
    // Al leer un mensaje el número baja de inmediato, sin esperar a que el
    // tercero cambie de pantalla.
    window.addEventListener('bt:leido', contar)
    return () => { vivo = false; window.removeEventListener('bt:leido', contar) }
  }, [tercero, vista])

  // La cabecera completa se va con el scroll. Cuando sale de la pantalla
  // aparece arriba una barra delgada con el nombre y la campana: la campana
  // sigue al alcance sin que la banda de Biggy tape un cuarto de la pantalla.
  const hdRef = useRef(null)
  const [compacto, setCompacto] = useState(false)
  useEffect(() => {
    const hd = hdRef.current
    if (!hd || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([e]) => setCompacto(!e.isIntersecting), { threshold: 0 })
    io.observe(hd)
    return () => io.disconnect()
  }, [])

  const ir = (v) => { setMas(false); onNavegar(v) }
  const activa = TAB_DE[vista] || (mas ? 'mas' : null)
  const inicial = (tercero?.nombre || '?').trim().charAt(0).toUpperCase()

  return (
    <div className={`mv-shell${compacto ? ' compacto' : ''}`}>
      <div className="mv-mini" aria-hidden={!compacto}>
        <span>{tercero?.nombre || 'Transportista'}</span>
        <button className="mv-bell" onClick={() => ir('mensajes')} aria-label="Mis mensajes" tabIndex={compacto ? 0 : -1}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          {sinLeer > 0 && <span className="mv-badge">{sinLeer > 99 ? '99+' : sinLeer}</span>}
        </button>
      </div>
      {/* Cabecera azul: saludo, campana y la empresa. Se queda arriba mientras
          se baja, porque la campana tiene que estar siempre al alcance. */}
      <header className="mv-hd" ref={hdRef}>
        <div className="mv-hd-top">
          <div style={{ minWidth: 0 }}>
            <div className="mv-saludo">Hola,</div>
            <div className="mv-nombre">{tercero?.nombre || 'Transportista'}</div>
          </div>
          <div className="mv-hd-acc">
            <button className="mv-bell" onClick={() => ir('mensajes')} aria-label="Mis mensajes">
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#fff"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              {sinLeer > 0 && <span className="mv-badge">{sinLeer > 99 ? '99+' : sinLeer}</span>}
            </button>
            {/* La inicial abre el menú: en un teléfono todo lo que se ve se
                toca, y un adorno que no responde se siente roto. */}
            <button className="mv-avatar" onClick={() => setMas(true)} aria-label="Menú">{inicial}</button>
          </div>
        </div>

        {/* Biggy va acá y no flotando sobre el contenido: en el teléfono el
            botón tapaba la última tarjeta y competía con las pestañas. */}
        {/* Biggy no es una vista: es una capa que vive en App y abre encima de
            cualquier pantalla. Por eso se le avisa con un evento y no con
            onNavegar, que solo cambia la pantalla de fondo. */}
        <button className="mv-biggy" onClick={() => window.dispatchEvent(new Event('bt:biggy'))}>
          <img src="/biggy.jpg" alt="" />
          <p>
            <b>Biggy</b> responde tus dudas sobre pagos, reclamos y certificación.<br />
            <span className="toca">Tócame para preguntarme lo que quieras</span>
          </p>
        </button>
      </header>

      {/* Las secciones con varias pantallas llevan sus solapas acá arriba: una
          pestaña de abajo no alcanza para tres vistas, y esconder dos de ellas
          en el menú las vuelve invisibles. */}
      {SOLAPAS[activa] && (
        <div className="mv-solapas">
          {SOLAPAS[activa].map(([v, l]) => (
            <button key={v} className={vista === v ? 'on' : ''} onClick={() => onNavegar(v)}>{l}</button>
          ))}
        </div>
      )}

      <main className="mv-cuerpo">{children}</main>

      <nav className="mv-tabs">
        {TABS.map(t => {
          const on = activa === t.k
          const n = t.k === 'reclamos' ? reclamos : t.k === 'mas' ? sinLeer : 0
          return (
            <button key={t.k} className={`mv-tab${on ? ' on' : ''}`}
              onClick={() => t.v ? ir(t.v) : setMas(true)}>
              <span className="mv-ico"><Icono k={t.k} /></span>
              {n > 0 && <span className="mv-punto" />}
              <span>{t.label}</span>
            </button>
          )
        })}
      </nav>

      {mas && (
        <>
          <div className="mv-velo" onClick={() => setMas(false)} />
          <div className="mv-hoja">
            <div className="mv-hoja-asa" />
            <div className="mv-hoja-cuerpo">
              {MAS.map(g => (
                <section key={g.grupo}>
                  <h3>{g.grupo}</h3>
                  {g.items
                    .filter(i => !SOLO_PAGOS.includes(i.v) || tercero?.pagosHabilitados)
                    .map(i => (
                      <button key={i.v} className="mv-item" onClick={() => ir(i.v)}>
                        <span>
                          <b>{i.t}</b>
                          <small>{i.d}</small>
                        </span>
                        {i.v === 'mensajes' && sinLeer > 0 && <em className="mv-n">{sinLeer}</em>}
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9AA3AF"
                          strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                          <path d="m9 18 6-6-6-6" />
                        </svg>
                      </button>
                    ))}
                </section>
              ))}
              <button className="mv-salir" onClick={() => supabase.auth.signOut()}>Cerrar sesión</button>
              <p className="mv-correo">{email}</p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function Icono({ k }) {
  const p = { width: 21, height: 21, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
    strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round' }
  if (k === 'home') return <svg {...p}><path d="M3 10.5 12 3l9 7.5M5.5 9.5V21h13V9.5" /></svg>
  if (k === 'billetera') return <svg {...p}><rect x="3" y="6" width="18" height="13" rx="2.5" /><path d="M3 10h18M16.5 14.5h.01" /></svg>
  if (k === 'facturacion') return <svg {...p}><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z" /><path d="M9.5 8h5M9.5 12h5" /></svg>
  if (k === 'reclamos') return <svg {...p}><path d="M12 3 2.5 20h19L12 3Z" /><path d="M12 10v4M12 17h.01" /></svg>
  return <svg {...p}><path d="M4 7h16M4 12h16M4 17h16" /></svg>
}
