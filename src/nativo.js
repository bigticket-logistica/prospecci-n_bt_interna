// ═══════════════════════════════════════════════════════════════════════════
// nativo.js — Lo que cambia cuando el portal corre dentro de la aplicación.
//
// El mismo código sirve para el navegador y para Android. Acá viven las pocas
// diferencias: la barra de estado, el botón físico de volver, el teclado y
// las notificaciones push.
//
// Todo está detrás de `esApp()`: en el navegador no se carga nada de esto, así
// que el portal web no carga peso que no usa.
// ═══════════════════════════════════════════════════════════════════════════

export const esApp = () =>
  typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.() === true

// ── Arranque ───────────────────────────────────────────────────────────────

export async function iniciarNativo({ onVolver } = {}) {
  if (!esApp()) return

  const [{ StatusBar, Style }, { SplashScreen }, { App }] = await Promise.all([
    import('@capacitor/status-bar'),
    import('@capacitor/splash-screen'),
    import('@capacitor/app'),
  ])

  // La barra de estado toma el azul de marca y el texto va en blanco.
  await StatusBar.setStyle({ style: Style.Dark }).catch(() => {})
  await StatusBar.setBackgroundColor({ color: '#002E5D' }).catch(() => {})

  // El botón físico de volver tiene que navegar dentro del portal, no cerrar
  // la aplicación: cerrarla de golpe en medio de una factura es lo peor que
  // puede pasarle al tercero.
  App.addListener('backButton', ({ canGoBack }) => {
    if (onVolver && onVolver() === true) return
    if (canGoBack) window.history.back()
    else App.exitApp()
  })

  await SplashScreen.hide().catch(() => {})
}

// ── Notificaciones push ────────────────────────────────────────────────────

// El token identifica al teléfono, no a la empresa: una misma empresa puede
// tener varios usuarios y cada uno su aparato. Por eso se guarda junto al
// tercero y al correo con que inició sesión.
export async function registrarPush(supabase, tercero, email) {
  if (!esApp() || !tercero?.tercero_id) return

  const { PushNotifications } = await import('@capacitor/push-notifications')

  const permiso = await PushNotifications.checkPermissions()
  let estado = permiso.receive
  if (estado === 'prompt' || estado === 'prompt-with-rationale') {
    estado = (await PushNotifications.requestPermissions()).receive
  }
  // Si el tercero dice que no, no se insiste: el portal sigue funcionando y
  // las mismas alertas están en Mis mensajes.
  if (estado !== 'granted') return

  PushNotifications.addListener('registration', async ({ value }) => {
    await supabase.from('dispositivos_tercero').upsert({
      token: value,
      tercero_id: tercero.tercero_id,
      email,
      plataforma: 'android',
      visto_en: new Date().toISOString(),
    }, { onConflict: 'token' })
  })

  PushNotifications.addListener('registrationError', (e) => {
    console.error('[push] no se pudo registrar', e)
  })

  // Al tocar la notificación, el portal abre la pantalla que corresponde.
  PushNotifications.addListener('pushNotificationActionPerformed', ({ notification }) => {
    const destino = notification?.data?.destino
    if (destino) window.dispatchEvent(new CustomEvent('bt:ir', { detail: destino }))
  })

  await PushNotifications.register()
}
