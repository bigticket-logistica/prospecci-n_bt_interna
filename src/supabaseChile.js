// supabaseChile.js — Cliente de Supabase CHILE para el portal.
// Los terceros de Chile entran con su RUT + clave (las crea el Brain, en
// Certificaciones → Accesos al portal). Por dentro, cada RUT es un usuario con
// un correo interno (r76273379k@terceros.bigticket.cl) que el tercero no ve.
// La sesión de Chile se guarda aparte de la de México (storageKey propio).
import { createClient } from '@supabase/supabase-js'

const CL_URL = 'https://hmowsazntdjtsvdfgutn.supabase.co'
const CL_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhtb3dzYXpudGRqdHN2ZGZndXRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ5MTc4NzgsImV4cCI6MjEwMDQ5Mzg3OH0.xAJokU0eFhof--d8R4uCRBr2-CJLzC5re0w1IPRqQR8'

export const supabaseCL = createClient(CL_URL, CL_ANON, { auth: { storageKey: 'bt-portal-cl', persistSession: true, autoRefreshToken: true } })

// ¿Lo escrito es un RUT chileno? (76.273.379-K, 76273379-K, 76273379K)
export const esRut = (t) => /^\d{1,2}\.?\d{3}\.?\d{3}-?[\dkK]$/.test(String(t || '').trim())
// Mismo cálculo que fn_portal_cl_email en la base
export const correoDeRut = (rut) => 'r' + String(rut || '').replace(/[^0-9kK]/g, '').toLowerCase() + '@terceros.bigticket.cl'
