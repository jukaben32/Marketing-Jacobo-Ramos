import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { withTenant } from "@/lib/db/tenant";
import { getSolicitudPublica } from "@/lib/solicitudes/service";
import { isValidTicket } from "@/lib/solicitudes/validation";
import { createRateLimiter } from "@/lib/solicitudes/rate-limit";
import { corsHeaders, getClientIp, parseAllowedOrigins } from "@/lib/solicitudes/cors";
import { formatSolicitudEstado } from "@/lib/labels";

// Consulta PÚBLICA por ticket. Solo devuelve estado, localidad y fecha: nunca datos personales.
const MAX_LOOKUPS_PER_WINDOW = 30;
const WINDOW_MS = 10 * 60 * 1000;

const limiter = createRateLimiter({ max: MAX_LOOKUPS_PER_WINDOW, windowMs: WINDOW_MS });

function json(body: unknown, status: number, headers: Record<string, string>) {
  return NextResponse.json(body, { status, headers });
}

export async function OPTIONS(req: NextRequest) {
  const allowed = parseAllowedOrigins(env.LANDING_ALLOWED_ORIGINS);
  return new NextResponse(null, { status: 204, headers: corsHeaders(req.headers.get("origin"), allowed) });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ ticket: string }> }) {
  const allowed = parseAllowedOrigins(env.LANDING_ALLOWED_ORIGINS);
  const origin = req.headers.get("origin");
  const headers = corsHeaders(origin, allowed);

  if (origin && !allowed.includes(origin)) {
    return json({ ok: false, error: "Origen no permitido." }, 403, headers);
  }

  if (!limiter.check(getClientIp(req.headers.get("x-forwarded-for")))) {
    return json({ ok: false, error: "Demasiadas consultas. Intenta de nuevo en unos minutos." }, 429, headers);
  }

  if (!env.OFICINA_BUSINESS_ID) {
    return json({ ok: false, error: "El servicio no está disponible en este momento." }, 503, headers);
  }

  const { ticket: rawTicket } = await params;
  const ticket = decodeURIComponent(rawTicket).trim().toUpperCase();

  // Se valida el formato antes de tocar la base de datos
  if (!isValidTicket(ticket)) {
    return json({ ok: false, error: "Ticket no válido." }, 400, headers);
  }

  try {
    const result = await withTenant(env.OFICINA_BUSINESS_ID, (tx) =>
      getSolicitudPublica(tx, env.OFICINA_BUSINESS_ID as string, ticket)
    );
    if (!result) {
      return json({ ok: false, error: "No encontramos ese ticket." }, 404, headers);
    }
    return json(
      {
        ok: true,
        ticket,
        estado: formatSolicitudEstado(result.estado),
        localidad: result.localidad,
        creadaEn: result.creadaEn,
      },
      200,
      headers
    );
  } catch (error) {
    console.error("Error al consultar el ticket:", error);
    return json({ ok: false, error: "No pudimos consultar el ticket. Intenta de nuevo." }, 500, headers);
  }
}
