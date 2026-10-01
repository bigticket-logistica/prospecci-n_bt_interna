// ═══════════════════════════════════════════════════════════════════════════
// Red.jsx — La red que impide que un error deje el portal en blanco.
//
// React desmonta todo el árbol cuando un componente lanza una excepción: una
// consulta a una vista recién creada, un campo que llegó nulo, cualquier cosa.
// El resultado es una pantalla vacía, sin pistas, que parece un problema de
// datos cuando es de código.
//
// Con esto el tercero ve qué falló y puede seguir usando el resto del portal,
// y nosotros vemos el error sin tener que abrir la consola.
// ═══════════════════════════════════════════════════════════════════════════
import { Component } from 'react'

class Captura extends Component {
  state = { error: null }
  static getDerivedStateFromError(error) { return { error } }
  componentDidCatch(error, info) { console.error('[portal]', this.props.nombre || 'app', error, info) }
  render() {
    if (!this.state.error) return this.props.children
    return this.props.fallback(this.state.error, () => this.setState({ error: null }))
  }
}

// Una pantalla falló: el menú y la cabecera siguen en pie.
export function Bloque({ nombre, children }) {
  return (
    <Captura nombre={nombre} fallback={(e, reintentar) => (
      <div className="bt-vacio" style={{ textAlign: 'left' }}>
        <h3>No pudimos mostrar {nombre}</h3>
        <p>
          Algo falló al cargar esta pantalla. Puedes volver a intentarlo o usar el resto del portal
          mientras lo revisamos.
        </p>
        <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>{String(e?.message || e)}</p>
        <button className="dx-btn" onClick={reintentar}>Volver a intentar</button>
      </div>
    )}>{children}</Captura>
  )
}

// El portal entero falló: último recurso antes de la pantalla en blanco.
export function Red({ children }) {
  return (
    <Captura nombre="portal" fallback={(e) => (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--page)', padding: 24 }}>
        <div className="bt-vacio" style={{ maxWidth: 480 }}>
          <h3>El portal no pudo cargar</h3>
          <p>Vuelve a cargar la página. Si sigue pasando, escríbenos y lo revisamos.</p>
          <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>{String(e?.message || e)}</p>
          <button className="dx-btn" onClick={() => window.location.reload()}>Recargar</button>
        </div>
      </div>
    )}>{children}</Captura>
  )
}
