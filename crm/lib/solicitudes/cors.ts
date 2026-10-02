/** Convierte "a, b,,c" en ["a","b","c"] (sin vacíos ni espacios). */
export function parseAllowedOrigins(raw: string): string[] {
  return raw
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

/**
 * Cabeceras CORS solo para orígenes de la lista blanca. Nunca usa comodín "*".
 * Sin origen permitido devuelve un objeto vacío (el navegador bloqueará la lectura de la respuesta).
 */
export function corsHeaders(origin: string | null, allowed: string[]): Record<string, string> {
  if (!origin || !allowed.includes(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  };
}

/** Primera IP de x-forwarded-for; "unknown" si no viene la cabecera. */
export function getClientIp(forwardedFor: string | null): string {
  if (!forwardedFor) return "unknown";
  const first = forwardedFor.split(",")[0]?.trim();
  return first || "unknown";
}
