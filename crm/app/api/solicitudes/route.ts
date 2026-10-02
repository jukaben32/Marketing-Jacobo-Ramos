import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { withTenant } from "@/lib/db/tenant";
import { createSolicitud } from "@/lib/solicitudes/service";
import { generateTicket, validateSolicitudInput } from "@/lib/solicitudes/validation";
import { createRateLimiter } from "@/lib/solicitudes/rate-limit";
import { corsHeaders, getClientIp, parseAllowedOrigins } from "@/lib/solicitudes/cors";

// Ruta PÚBLICA (la llama el formulario de la landing). Por eso: lista blanca de orígenes,
// límite de envíos por IP, tamaño máximo de cuerpo, campo trampa y validación estricta.
const MAX_BODY_BYTES = 8 * 1024;
const MAX_SUBMISSIONS_PER_WINDOW = 5;
const WINDOW_MS = 10 * 60 * 1000;

const limiter = createRateLimiter({ max: MAX_SUBMISSIONS_PER_WINDOW, windowMs: WINDOW_MS });

function json(body: unknown, status: number, headers: Record<string, string>) {
  return NextResponse.json(body, { status, headers });
}

export async function OPTIONS(req: NextRequest) {
  const allowed = parseAllowedOrigins(env.LANDING_ALLOWED_ORIGINS);
  return new NextResponse(null, { status: 204, headers: corsHeaders(req.headers.get("origin"), allowed) });
}

export async function POST(req: NextRequest) {
  const allowed = parseAllowedOrigins(env.LANDING_ALLOWED_ORIGINS);
  const origin = req.headers.get("origin");
  const headers = corsHeaders(origin, allowed);

  // Si el navegador declara un origen que no está en la lista, no se procesa
  if (origin && !allowed.includes(origin)) {
    return json({ ok: false, error: "Origen no permitido." }, 403, headers);
  }

  if (!limiter.check(getClientIp(req.headers.get("x-forwarded-for")))) {
    return json({ ok: false, error: "Demasiadas solicitudes. Intenta de nuevo en unos minutos." }, 429, headers);
  }

  if (!env.OFICINA_BUSINESS_ID) {
    console.error("OFICINA_BUSINESS_ID no está configurada: no se pueden registrar solicitudes.");
    return json({ ok: false, error: "El servicio no está disponible en este momento." }, 503, headers);
  }

  const rawBody = await req.text();
  if (Buffer.byteLength(rawBody, "utf8") > MAX_BODY_BYTES) {
    return json({ ok: false, error: "La solicitud es demasiado grande." }, 413, headers);
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return json({ ok: false, error: "Solicitud inválida." }, 400, headers);
  }

  // Campo trampa: las personas no lo ven; si viene lleno es un bot. Se responde "éxito" sin guardar nada.
  if (typeof payload === "object" && payload !== null && "website" in payload) {
    const trap = (payload as Record<string, unknown>).website;
    if (typeof trap === "string" && trap.trim() !== "") {
      return json({ ok: true, ticket: generateTicket() }, 200, headers);
    }
  }

  const validation = validateSolicitudInput(payload);
  if (!validation.ok) {
    return json({ ok: false, error: validation.error }, 400, headers);
  }

  try {
    const solicitud = await withTenant(env.OFICINA_BUSINESS_ID, (tx) =>
      createSolicitud(tx, env.OFICINA_BUSINESS_ID as string, validation.data, { origen: "web" })
    );
    return json({ ok: true, ticket: solicitud.ticket }, 201, headers);
  } catch (error) {
    // El detalle va al log del servidor; a la persona solo se le da un mensaje genérico
    console.error("Error al registrar la solicitud web:", error);
    return json({ ok: false, error: "No pudimos registrar tu solicitud. Intenta de nuevo." }, 500, headers);
  }
}
