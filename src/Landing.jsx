// ═══════════════════════════════════════════════════════════════════════════
// Landing.jsx — La página que ve quien todavía no entró al portal.
//
// Replicada de la maqueta de marketing (Landing_portal_transportista):
// cabecera navy de 72px, carrusel de dos slides que gira solo cada 7 s, la
// fila de "¿qué necesitas?" y el panel de acceso que entra por la derecha.
//
// Dos cosas se apartan de la maqueta a propósito:
//   · La maqueta pide RUT y clave; este portal es de México y el acceso es
//     con el correo de la empresa, igual que hoy.
//   · El panel lleva el error de acceso y el enlace para recuperar la clave,
//     que la maqueta dibuja pero no conecta.
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from './supabaseClient'

const NAVY = '#002E5D'
const ORANGE = '#FF6600'
const GRIS = '#545454'
const PAGE = '#F4F3F3'

const SLIDES = [
  {
    img: '/landing-flota.png',
    pos: 'center',
    titulo: 'Gestiona tu día a día sin complicaciones.',
    texto: 'Certifica conductores, vehículos, firma tu contrato y consulta movimientos y facturas.',
  },
  {
    img: '/landing-conductor.jpg',
    pos: '70% 30%',
    titulo: 'Súmate al peak season.',
    texto: 'Suma tus unidades, certifícalas y opera cuando más se necesita.',
    cta: 'Más información',
    // El peak se postula en el sitio de prospección, fuera de este portal.
    href: 'https://bigticket-portal.vercel.app/',
  },
]

// Cada atajo entra al portal y aterriza en su pantalla: el tercero llega a lo
// que vino a hacer en vez de buscarlo en el menú.
const NECESIDADES = [
  { label: 'Rutas', v: 'movimientos', d: 'M3 17V7h11v10M14 10h4l3 3v4h-7M6.5 19.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM17.5 19.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3z' },
  { label: 'Documentos', v: 'docs', d: 'M14 3H6v18h12V7l-4-4zM14 3v4h4M9 12h6M9 16h6' },
  { label: 'Facturación', v: 'facturacion', d: 'M6 3h12v18l-3-2-3 2-3-2-3 2V3zM9 8h6M9 12h6' },
  { label: 'Pagos', v: 'pagado', d: 'M3 6h18v12H3zM3 10h18M7 15h3' },
  { label: 'Mi flota', v: 'flota', d: 'M4 11l2-5h12l2 5M4 11h16v6H4zM7 17v2M17 17v2M7.5 14h.01M16.5 14h.01' },
  { label: 'Soporte', v: 'consultas', d: 'M4 13a8 8 0 0116 0M4 13v4h3v-5H4M20 13v4h-3v-5h3M17 17c0 2-2 3-5 3' },
]

const Flecha = ({ dir = 'der', size = 10 }) => (
  <svg width={size} height={size * 1.6} viewBox="0 0 10 16" fill="none" aria-hidden="true">
    <path d={dir === 'izq' ? 'M8 2L2 8l6 6' : 'M2 2l6 6-6 6'} stroke="currentColor"
      strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

export default function Landing() {
  const [slide, setSlide] = useState(0)
  const [abierto, setAbierto] = useState(false)
  const timer = useRef(null)

  // Adónde llevar al tercero una vez dentro. "Ingresar al portal" siempre entra
  // al inicio; los atajos llevan a su pantalla. Se borra al usarlo, así que una
  // sesión nueva nunca hereda el destino de la anterior.
  const abrirAcceso = (destino) => {
    try {
      if (destino) sessionStorage.setItem('bt_destino', destino)
      else sessionStorage.removeItem('bt_destino')
    } catch { /* sin sessionStorage: entra al inicio */ }
    setAbierto(true)
  }


  const arrancar = useCallback(() => {
    clearInterval(timer.current)
    timer.current = setInterval(() => setSlide(s => (s + 1) % SLIDES.length), 7000)
  }, [])

  useEffect(() => {
    // Con el panel de acceso abierto el carrusel se detiene: nada se mueve
    // detrás mientras el tercero escribe su clave.
    if (abierto) { clearInterval(timer.current); return }
    arrancar()
    return () => clearInterval(timer.current)
  }, [abierto, arrancar])

  const ir = (i) => { clearInterval(timer.current); setSlide((i + SLIDES.length) % SLIDES.length); arrancar() }

  return (
    <div className="lp">
      <header className="lp-header">
        <div className="lp-marca">
          <img src="/logo-bigticket-blanco.png" alt="Bigticket" />
          <span className="lp-sep" />
          <span className="lp-rotulo">Portal del Transportista</span>
        </div>
        <button className="lp-entrar" onClick={() => abrirAcceso()}>Ingresar al portal</button>
      </header>

      <section className="lp-hero">
        <div className="lp-track" style={{ transform: `translateX(-${slide * 100}%)` }}>
          {SLIDES.map((s, i) => (
            <div key={i} className="lp-slide" aria-hidden={i !== slide}>
              <img src={s.img} alt="" className="lp-slide-img" style={{ objectPosition: s.pos }} />
              <div className="lp-slide-velo" />
              <img src="/logo-bigticket-blanco.png" alt="" className="lp-slide-marca" />
              <div className="lp-slide-texto">
                <div className="lp-regla" />
                <h1>{s.titulo}</h1>
                <p>{s.texto}</p>
                {s.cta && (
                  <a className="lp-cta" href={s.href}>
                    {s.cta}<Flecha />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>

        <button className="lp-nav izq" aria-label="Anterior" onClick={() => ir(slide - 1)}><Flecha dir="izq" /></button>
        <button className="lp-nav der" aria-label="Siguiente" onClick={() => ir(slide + 1)}><Flecha /></button>
        <div className="lp-puntos">
          {SLIDES.map((_, i) => (
            <button key={i} onClick={() => ir(i)} aria-label={`Ver ${SLIDES[i].titulo}`}
              className={i === slide ? 'on' : ''} />
          ))}
        </div>
      </section>

      <section className="lp-necesidades">
        <div className="lp-nec-titulo">
          <div className="lp-nec-regla" />
          <h2>Cuéntanos, ¿qué necesitas?</h2>
        </div>
        <div className="lp-nec-items">
          {NECESIDADES.map(n => (
            <button key={n.label} onClick={() => abrirAcceso(n.v)}>
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke={ORANGE}
                strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d={n.d} />
              </svg>
              <span>{n.label}</span>
            </button>
          ))}
        </div>
      </section>

      <footer className="lp-footer">
        <img src="/logo-bigticket-blanco.png" alt="Bigticket" />
        <span>© {new Date().getFullYear()} Bigticket · Soporte transportistas: soporte@bigticket.cl</span>
      </footer>

      {abierto && <PanelAcceso onCerrar={() => setAbierto(false)} />}
    </div>
  )
}

// ── Panel de acceso ────────────────────────────────────────────────────────
// incrustado: el mismo formulario sin el panel lateral ni el velo, para la
// pantalla de acceso de la aplicación (AccesoApp, más abajo).
function PanelAcceso({ onCerrar, incrustado = false }) {
  const [paso, setPaso] = useState('acceso')   // 'acceso' | 'codigo'
  const [correo, setCorreo] = useState('')
  const [clave, setClave] = useState('')
  const [codigo, setCodigo] = useState('')
  const [err, setErr] = useState('')
  const [aviso, setAviso] = useState('')
  const [busy, setBusy] = useState(false)
  const primero = useRef(null)

  useEffect(() => {
    // En la app no se enfoca solo: el teclado taparía la pantalla apenas abre.
    if (incrustado) return
    primero.current?.focus()
    const esc = (e) => { if (e.key === 'Escape') onCerrar() }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onCerrar, incrustado])

  const puede = correo.trim() && clave && !busy

  const entrar = async (e) => {
    e?.preventDefault()
    if (!puede) return
    setErr(''); setAviso(''); setBusy(true)
    const { error } = await supabase.auth.signInWithPassword({ email: correo.trim().toLowerCase(), password: clave })
    if (error) setErr('Correo o contraseña incorrectos. Revísalos e inténtalo de nuevo.')
    setBusy(false)
  }

  // Pide el código. Supabase responde igual exista o no la cuenta, así que el
  // formulario no sirve para averiguar qué correos están registrados.
  const pedirCodigo = async (e) => {
    e?.preventDefault()
    const c = correo.trim().toLowerCase()
    if (!c) {
      setErr('Escribe arriba el correo de tu empresa y vuelve a pulsar aquí.')
      primero.current?.focus()
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c)) {
      setErr('Ese correo no parece válido. Revísalo y vuelve a intentarlo.')
      primero.current?.focus()
      return
    }
    setErr(''); setAviso(''); setBusy(true)
    const { error } = await supabase.auth.resetPasswordForEmail(c)
    setBusy(false)
    if (error) { setErr('No se pudo enviar el correo. Inténtalo de nuevo en un momento.'); return }
    setPaso('codigo'); setCodigo('')
    setAviso('Te enviamos un código de 6 dígitos. Revisa tu correo y escríbelo aquí.')
  }

  // El código crea la sesión; la bandera hace que el portal pida la clave nueva
  // antes de dejar entrar.
  const verificar = async (e) => {
    e?.preventDefault()
    const t = codigo.replace(/\D/g, '')
    if (t.length !== 6) { setErr('El código son 6 dígitos.'); return }
    setErr(''); setBusy(true)
    try { sessionStorage.setItem('bt_recovery', '1') } catch { /* sin sessionStorage */ }
    const { error } = await supabase.auth.verifyOtp({ email: correo.trim().toLowerCase(), token: t, type: 'recovery' })
    setBusy(false)
    if (error) {
      try { sessionStorage.removeItem('bt_recovery') } catch { /* sin sessionStorage */ }
      setAviso('')
      setErr('El código no es válido o ya venció. Pide uno nuevo.')
    }
  }

  const cuerpo = (
    <>
        <p className="lp-panel-titulo">
          {paso === 'acceso'
            ? (incrustado ? 'Ingresa con el correo de tu empresa' : 'Ingresa al Portal del Transportista')
            : 'Escribe el código que te enviamos'}
        </p>

        {paso === 'acceso' ? (
          <>
            <form onSubmit={entrar}>
              {err && <div className="lp-error">{err}</div>}
              {aviso && <div className="lp-aviso">{aviso}</div>}
              <input ref={primero} type="email" autoComplete="username" placeholder="Correo de tu empresa"
                value={correo} onChange={e => setCorreo(e.target.value)} />
              <input type="password" autoComplete="current-password" placeholder="Clave"
                value={clave} onChange={e => setClave(e.target.value)} />
              <button type="submit" disabled={!puede}
                style={{ background: puede ? ORANGE : '#e6e5e5', color: puede ? '#fff' : GRIS }}>
                {busy ? 'Entrando…' : 'Ingresar'}
              </button>
            </form>

            <div className="lp-recuperar">
              <span>¿Olvidaste tu clave?</span>
              <button type="button" className="lp-link" onClick={pedirCodigo} disabled={busy}>
                <svg width="16" height="18" viewBox="0 0 16 18" fill="none" stroke={ORANGE} strokeWidth="1.5" aria-hidden="true">
                  <rect x="2" y="8" width="12" height="9" rx="2" /><path d="M5 8V5a3 3 0 016 0v3" />
                </svg>
                {busy ? 'Enviando el código…' : 'Recupérala aquí'}
                <svg width="7" height="11" viewBox="0 0 7 11" fill="none" aria-hidden="true">
                  <path d="M1.5 1.5l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          </>
        ) : (
          <>
            <form onSubmit={verificar}>
              {err && <div className="lp-error">{err}</div>}
              {aviso && <div className="lp-aviso">{aviso}</div>}
              <input ref={primero} inputMode="numeric" autoComplete="one-time-code" maxLength={6}
                placeholder="000000" className="lp-codigo"
                value={codigo} onChange={e => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))} />
              <button type="submit" disabled={busy || codigo.length !== 6}
                style={{ background: !busy && codigo.length === 6 ? ORANGE : '#e6e5e5', color: !busy && codigo.length === 6 ? '#fff' : GRIS }}>
                {busy ? 'Verificando…' : 'Continuar'}
              </button>
            </form>

            <div className="lp-recuperar">
              <span>El código llega a {correo.trim().toLowerCase()} y dura 1 hora.</span>
              <button type="button" className="lp-link" onClick={pedirCodigo} disabled={busy}>Enviar otro código</button>
              <button type="button" className="lp-link"
                onClick={() => { setPaso('acceso'); setErr(''); setAviso('') }}>
                Volver a ingresar con mi clave
              </button>
            </div>
          </>
        )}

        <div className="lp-ayuda">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke={NAVY} strokeWidth="1.4" aria-hidden="true">
            <circle cx="10" cy="10" r="8.5" /><path d="M10 9v5M10 6.2v.1" strokeLinecap="round" />
          </svg>
          <p>Si necesitas ayuda, escríbenos a soporte@bigticket.cl</p>
        </div>
    </>
  )

  if (incrustado) return <div className="ac-hoja">{cuerpo}</div>

  return (
    <div className="lp-modal" role="dialog" aria-modal="true" aria-label="Ingresar al portal">
      <div className="lp-velo" onClick={onCerrar} />
      <aside className="lp-panel">
        <button className="lp-cerrar" aria-label="Cerrar" onClick={onCerrar}>
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <path d="M2 2l14 14M16 2L2 16" stroke={ORANGE} strokeWidth="2.2" strokeLinecap="round" />
          </svg>
        </button>

        <img src="/bt_logo_color.png" alt="Bigticket Logística y Transporte" className="lp-panel-logo" />
        <div className="lp-panel-regla" />
        {cuerpo}
      </aside>
    </div>
  )
}

// ── Acceso dentro de la aplicación ─────────────────────────────────────────
// La aplicación no muestra la landing de marketing (carrusel, atajos, peak
// season): quien la abre ya es transportista y viene a entrar. Arriba la marca
// sobre el azul de la cabecera del portal; abajo, el formulario en una hoja
// blanca. Con hijos, la hoja muestra otra cosa, como la clave nueva tras el
// código de recuperación.
export function AccesoApp({ children }) {
  return (
    <div className="ac-pantalla">
      <header className="ac-cab">
        <img src="/logo-bigticket-blanco.png" alt="Bigticket" />
        <h1>Portal del Transportista</h1>
        <p>Tus pagos, facturas y reclamos en un solo lugar.</p>
      </header>
      {children || <PanelAcceso incrustado onCerrar={() => {}} />}
    </div>
  )
}

export { NAVY, PAGE }
