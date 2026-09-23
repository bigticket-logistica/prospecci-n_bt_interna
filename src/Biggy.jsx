// ═══════════════════════════════════════════════════════════════════════════
// Biggy.jsx — El asistente, en el portal del tercero.
//
// Usa el mismo webhook de n8n que el portal de postulación, pero con otro
// prompt: acá no habla con alguien que quiere entrar, sino con una empresa que
// ya opera y pregunta por su plata. Las dudas son distintas — cuándo se paga,
// qué es un descuento, cómo reclamar — y responderlas con el prompt de
// captación sonaría a folleto.
//
// El botón sigue el scroll y en móvil el chat ocupa la pantalla completa: un
// panel flotante de 380px en un teléfono deja el teclado encima del texto.
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from './supabaseClient'

const API = '/api/biggy-chat'
const CARA = 'https://psvdtgjvognbmxfvqbaa.supabase.co/storage/v1/object/public/assets/Don_B1.jpeg'

// Cuatro áreas con contextos distintos. Un tercero que pregunta por una
// devolución y otro que pregunta por su pago necesitan respuestas de mundos
// distintos; el prompt de cada área vive en el endpoint.
const AREAS = [
  { id: 'pagos', ic: '💵', label: 'Pagos y cobros', desc: 'Tus pagos, descuentos, prefacturas y diferencias.' },
  { id: 'operaciones', ic: '🚛', label: 'Operaciones', desc: 'Rutas, unidades y el día a día en el centro.' },
  { id: 'certificaciones', ic: '🪪', label: 'Certificaciones', desc: 'Conductores, ayudantes y vehículos.' },
  { id: 'devoluciones', ic: '📦', label: 'Devoluciones', desc: 'Paquetes que vuelven al centro.' },
]

export default function Biggy({ tercero }) {
  const [abierto, setAbierto] = useState(false)
  const [area, setArea] = useState(null)   // null = todavía no elige
  const [msgs, setMsgs] = useState([])
  const [texto, setTexto] = useState('')
  const [cargando, setCargando] = useState(false)
  const finRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => { finRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs, cargando])
  useEffect(() => { if (abierto) setTimeout(() => inputRef.current?.focus(), 250) }, [abierto])

  // Con el chat abierto en móvil, el fondo no debe desplazarse detrás.
  useEffect(() => {
    if (!abierto) return
    const prev = document.body.style.overflow
    if (window.innerWidth < 720) document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [abierto])

  const elegir = (a) => {
    setArea(a)
    setMsgs([{ rol: 'biggy', texto: `Listo, hablemos de ${a.label.toLowerCase()}. ${a.desc} ¿Qué necesitas?` }])
  }

  const enviar = useCallback(async () => {
    const t = texto.trim()
    if (!t || cargando || !area) return
    setTexto('')
    setMsgs(p => [...p, { rol: 'yo', texto: t }])
    setCargando(true)
    try {
      const historial = msgs.slice(-9).map(m => ({
        role: m.rol === 'yo' ? 'user' : 'assistant', content: m.texto,
      }))
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          area: area.id,
          empresa: tercero?.nombre || null,
          messages: [...historial, { role: 'user', content: t }],
        }),
      })
      const d = await res.json()
      setMsgs(p => [...p, { rol: 'biggy', texto: d.respuesta || d.error || 'No pude procesar tu consulta.' }])
    } catch (e) {
      console.error('Biggy:', e)
      setMsgs(p => [...p, { rol: 'biggy', texto: 'Tuve un problema técnico. Intenta de nuevo en un momento 🙏' }])
    }
    setCargando(false)
  }, [texto, cargando, msgs, area, tercero])

  const movil = typeof window !== 'undefined' && window.innerWidth < 720

  return (
    <>
      {/* El botón sigue el scroll: position fixed, siempre a la vista. */}
      {!abierto && (
        <button onClick={() => setAbierto(true)} aria-label="Abrir chat con Biggy"
          style={{
            position: 'fixed', right: 18, bottom: 18, zIndex: 900,
            display: 'flex', alignItems: 'center', gap: 10,
            background: 'var(--navy)', color: '#fff', border: 'none',
            borderRadius: 999, padding: '10px 18px 10px 10px', cursor: 'pointer',
            boxShadow: '0 6px 24px rgba(26,58,107,.32)',
          }}>
          <Cara size={40} />
          <span style={{ fontSize: 13.5, fontWeight: 700 }}>¿Dudas? Pregúntale a Biggy</span>
        </button>
      )}

      {abierto && (
        <div style={{
          position: 'fixed', zIndex: 950,
          ...(movil
            ? { inset: 0, borderRadius: 0 }
            : { right: 18, bottom: 18, width: 390, maxHeight: 'calc(100vh - 36px)', borderRadius: 18 }),
          background: 'var(--card)', display: 'flex', flexDirection: 'column',
          boxShadow: '0 12px 48px rgba(0,0,0,.22)', overflow: 'hidden',
        }}>
          <div style={{
            background: 'var(--navy)', padding: '12px 14px',
            display: 'flex', alignItems: 'center', gap: 11, flexShrink: 0,
          }}>
            <Cara size={38} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: '#fff', fontSize: 14.5, fontWeight: 700 }}>Biggy</div>
              {area ? (
                <button onClick={() => { setArea(null); setMsgs([]) }}
                  style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                    color: '#9fb4d4', fontSize: 11, textDecoration: 'underline' }}>
                  {area.ic} {area.label} · cambiar
                </button>
              ) : (
                <div style={{ color: '#9fb4d4', fontSize: 11 }}>Asistente de transportistas</div>
              )}
            </div>
            <button onClick={() => setAbierto(false)} aria-label="Cerrar"
              style={{ background: 'rgba(255,255,255,.14)', border: 'none', color: '#fff',
                width: 30, height: 30, borderRadius: 999, fontSize: 17, cursor: 'pointer', lineHeight: 1 }}>×</button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: 14, background: 'var(--bg)' }}>
            {/* Elegir el área antes de escribir: así la respuesta llega con el
                contexto correcto en vez de con un prompt que intenta cubrirlo
                todo y termina siendo vago. */}
            {!area && (
              <div>
                <div style={{ fontSize: 13.5, color: 'var(--ink)', marginBottom: 4, fontWeight: 600 }}>
                  ¡Hola! Soy Biggy 🚛
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 14, lineHeight: 1.5 }}>
                  ¿Sobre qué necesitas ayuda?
                </div>
                {AREAS.map(a => (
                  <button key={a.id} onClick={() => elegir(a)}
                    style={{
                      width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12,
                      background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 12,
                      padding: '12px 14px', marginBottom: 8, cursor: 'pointer',
                    }}>
                    <span style={{ fontSize: 20 }}>{a.ic}</span>
                    <span style={{ flex: 1 }}>
                      <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: 'var(--navy)' }}>{a.label}</span>
                      <span style={{ display: 'block', fontSize: 11.5, color: 'var(--muted)', marginTop: 1, lineHeight: 1.4 }}>{a.desc}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}

            {msgs.map((m, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: m.rol === 'yo' ? 'flex-end' : 'flex-start', marginBottom: 9,
              }}>
                <div style={{
                  maxWidth: '84%', padding: '9px 13px', fontSize: 13.5, lineHeight: 1.55,
                  borderRadius: m.rol === 'yo' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                  background: m.rol === 'yo' ? 'var(--navy)' : 'var(--card)',
                  color: m.rol === 'yo' ? '#fff' : 'var(--ink)',
                  border: m.rol === 'yo' ? 'none' : '1px solid var(--line)',
                  whiteSpace: 'pre-wrap',
                }}>{m.texto}</div>
              </div>
            ))}
            {cargando && (
              <div style={{ display: 'flex', gap: 4, padding: '9px 13px' }}>
                {[0, .18, .36].map(d => (
                  <span key={d} style={{
                    width: 7, height: 7, borderRadius: 999, background: 'var(--muted)',
                    animation: `biggyPulse 1.1s ${d}s infinite ease-in-out`,
                  }} />
                ))}
              </div>
            )}
            <div ref={finRef} />
          </div>

          <div style={{
            display: 'flex', gap: 8, padding: 12, borderTop: '1px solid var(--line)',
            background: 'var(--card)', flexShrink: 0,
            paddingBottom: movil ? 'calc(12px + env(safe-area-inset-bottom, 0px))' : 12,
          }}>
            <input ref={inputRef} value={texto} onChange={e => setTexto(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar() } }}
              placeholder={area ? 'Escribe tu duda…' : 'Elige un tema para empezar'} disabled={cargando || !area}
              style={{
                flex: 1, border: '1px solid var(--line)', borderRadius: 999,
                padding: '10px 15px', fontSize: 14, outline: 'none', minWidth: 0,
              }} />
            <button onClick={enviar} disabled={cargando || !texto.trim() || !area} aria-label="Enviar"
              style={{
                background: texto.trim() && !cargando && area ? 'var(--orange)' : 'var(--line)',
                border: 'none', color: '#fff', width: 42, height: 42, borderRadius: 999,
                fontSize: 17, cursor: texto.trim() && !cargando && area ? 'pointer' : 'default', flexShrink: 0,
              }}>➤</button>
          </div>
        </div>
      )}

      <style>{`@keyframes biggyPulse{0%,60%,100%{opacity:.25;transform:translateY(0)}30%{opacity:1;transform:translateY(-3px)}}`}</style>
    </>
  )
}

function Cara({ size = 44 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: 999, overflow: 'hidden',
      border: '2px solid var(--orange)', background: '#fff', flexShrink: 0,
    }}>
      <img src={CARA} alt="Biggy" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }}
        onError={e => { e.currentTarget.style.display = 'none' }} />
    </div>
  )
}
