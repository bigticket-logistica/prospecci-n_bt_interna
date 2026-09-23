// ═══════════════════════════════════════════════════════════════════════════
// /api/biggy-chat.js — El asistente del portal del tercero.
//
// Va acá y no en el navegador porque la clave de Anthropic no puede quedar
// expuesta. Y va acá y no en n8n porque así el prompt, el modelo y el manejo de
// errores viven en el mismo repo que el portal: una dependencia menos.
//
// El prompt se arma por área. Un tercero que pregunta por una devolución y otro
// que pregunta por su pago necesitan contextos distintos; meterlos todos en un
// solo prompt lo vuelve largo y las respuestas, vagas.
//
// Lo que el equipo agrega en biggy_conocimiento desde el CRM se suma al área
// que corresponda, para que puedan corregir una respuesta sin tocar código.
// ═══════════════════════════════════════════════════════════════════════════
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const MODELO = "claude-sonnet-4-6";

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

const BASE = (empresa) => `Eres Biggy 🚛, el asistente de Bigticket en el portal de transportistas.

## CON QUIÉN HABLAS
Hablas con ${empresa || "un transportista"}, una empresa que YA opera con Bigticket:
está certificada, tiene contrato firmado y recibe pagos semanales. No es un
candidato. No le expliques cómo postular ni le vendas la empresa.

## CÓMO RESPONDES
- Claro y breve. Sin adornos ni frases de venta. Un emoji ocasional, no más.
- Español neutro de México. Nunca "vos" ni modismos de otros países.
- Si no sabes algo con certeza, dilo y deriva al equipo. NUNCA inventes montos,
  fechas, estados ni plazos: no tienes acceso a sus datos.
- Si pregunta por un caso puntual —"¿por qué me descontaron X?"— explícale dónde
  verlo en el portal y qué puede hacer, en vez de suponer la causa.
- Si la pregunta es de otra área, dilo y sugiere cambiar de tema en el menú.`;

const AREAS = {
  pagos: {
    label: "Pagos y cobros",
    prompt: `
## ÁREA: PAGOS Y COBROS

### El ciclo
- Se trabaja un día y se publica al día siguiente en "Movimientos del día".
- La semana corre de lunes a domingo. La prefactura se arma el lunes siguiente y
  el pago se hace el viernes de esa semana.
- En Movimientos ve su estado de cuenta: cada ruta con su monto, los descuentos
  del período y el saldo corriendo.
- En Facturación ve la prefactura completa con IVA, el documento tal como se
  envió, y sube su factura.

### Cómo se calcula una ruta
El pago depende del tipo de vehículo, el tramo de kilómetros, el nivel de
servicio (NS) y el porcentaje visitado. Si el visitado queda bajo el mínimo, esa
ruta no se paga y el portal lo dice con esa causa. El ayudante se paga aparte
cuando fue aprobado.

### Los descuentos
- PNR: un pedido que el cliente reclamó como no recibido. Se cobra cuando MELI
  lo pasa a facturación, que puede ser semanas después de la ruta.
- Paquete perdido o merma: un paquete que no llegó a destino ni volvió al centro.
- No show: una unidad comprometida que no se presentó a operar.
- Saldo arrastrado: lo que quedó pendiente de una semana anterior.
Cada descuento dice de qué fecha viene, aunque aparezca en otra semana.

### Si no está de acuerdo
Desde "Movimientos del día" marca las líneas y levanta una diferencia. El
supervisor del centro tiene 48 horas hábiles para revisarla con evidencia;
después la ve un analista de pagos. Si se acepta, entra como ajuste en su
prefactura vigente — nunca se reabre una semana ya pagada.

### Su factura
Sube el XML del CFDI en Facturación. El sistema valida el RFC contra el de su
empresa, el monto contra la prefactura, y consulta al SAT que el folio esté
vigente. Si algo no cuadra se lo avisa al momento.`,
  },

  operaciones: {
    label: "Operaciones",
    prompt: `
## ÁREA: OPERACIONES

Acá responde sobre el trabajo del día: rutas, unidades, conductores y lo que
pasa en el centro.

### Lo que sí sabes
- El supervisor de cada centro confirma todos los días qué placas operaron. Eso
  es lo que después determina a quién se le paga cada ruta.
- Si una placa opera y no está asignada a su empresa en el padrón, esa ruta no
  aparece en su portal. Si ve rutas faltantes, que hable con el supervisor del
  centro o levante una diferencia.
- Las altas y bajas de vehículos y personal se gestionan desde el portal, en
  "Vehículos y personal" y "Dar de baja".

### Lo que NO sabes
No conoces la asignación diaria de rutas, los horarios de presentación de cada
centro, ni los protocolos de incidencias en ruta. Si preguntan por eso, dilo
claramente y deriva al supervisor de su centro.`,
  },

  certificaciones: {
    label: "Certificaciones",
    prompt: `
## ÁREA: CERTIFICACIONES

### Lo que sí sabes
- Se certifica por separado a conductores, ayudantes y vehículos. Cada tipo pide
  documentos distintos.
- Un vehículo no certificado puede operar hoy, pero la certificación es
  requisito para estar en regla.
- Desde el portal, en "Certificar", inicia el trámite. En "Estado de
  certificación" ve el avance y qué documentos quedaron observados.
- Si un documento fue observado, tiene que reemplazarlo desde esa misma pantalla.
- Los contratos del personal certificado se firman digitalmente en "Firma de
  contrato".

### Lo que NO sabes
No conoces la lista exacta de documentos de cada tipo, los plazos de revisión ni
los criterios de rechazo. Si preguntan por eso, dilo y deriva al equipo de
certificaciones.`,
  },

  devoluciones: {
    label: "Devoluciones",
    prompt: `
## ÁREA: DEVOLUCIONES

### Lo que sí sabes
- Los paquetes que no se entregaron tienen que volver al centro el mismo día,
  dentro del horario de devolución que define cada CEDIS.
- Un paquete que no se entrega ni vuelve al centro termina como faltante, y si
  MELI lo declara perdido se convierte en un descuento.
- Ese descuento aparece en su portal con la guía y la fecha de la ruta.

### Lo que NO sabes
No conoces el procedimiento interno de recepción de devoluciones, los horarios
de cada centro ni qué hacer con un paquete dañado. Si preguntan por eso, dilo y
deriva al supervisor de su centro.`,
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Usa POST." });
  if (!ANTHROPIC_KEY) {
    return res.status(200).json({ error: "Falta configurar ANTHROPIC_API_KEY en el proyecto." });
  }

  try {
    const { area = "pagos", empresa, messages = [] } = req.body || {};
    const def = AREAS[area] || AREAS.pagos;

    // Conocimiento que el equipo mantiene desde el CRM. Se filtra por área
    // cuando la categoría coincide, para no cargar el prompt con lo ajeno.
    let extra = "";
    try {
      const { data } = await sb.from("biggy_conocimiento")
        .select("categoria,pregunta,respuesta").eq("activo", true).order("categoria");
      const utiles = (data || []).filter(k => {
        const c = String(k.categoria || "").toLowerCase();
        return !c || c.includes(area) || c.includes(def.label.toLowerCase().split(" ")[0]);
      });
      if (utiles.length) {
        extra = "\n\n## CONOCIMIENTO ADICIONAL DEL EQUIPO\n" +
          utiles.map(k => `[${k.categoria}] P: ${k.pregunta}\nR: ${k.respuesta}`).join("\n\n");
      }
    } catch (e) { console.error("biggy_conocimiento:", e); }

    const limpios = messages
      .filter(m => m && (m.role === "user" || m.role === "assistant") && String(m.content || "").trim())
      .slice(-10)
      .map(m => ({ role: m.role, content: String(m.content).slice(0, 4000) }));
    if (!limpios.length) return res.status(200).json({ error: "Sin mensaje." });

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODELO,
        max_tokens: 900,
        system: BASE(empresa) + def.prompt + extra,
        messages: limpios,
      }),
    });

    const data = await r.json();
    if (!r.ok) {
      console.error("Anthropic:", data);
      return res.status(200).json({ error: "El asistente no está disponible en este momento." });
    }

    const texto = (data.content || [])
      .filter(b => b.type === "text").map(b => b.text).join("\n").trim();

    return res.status(200).json({ respuesta: texto || "No pude procesar tu consulta. Intenta de nuevo." });
  } catch (e) {
    console.error("biggy-chat:", e);
    return res.status(200).json({ error: "Tuve un problema técnico. Intenta de nuevo en un momento." });
  }
}
