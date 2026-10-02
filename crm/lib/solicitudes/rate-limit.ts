export interface RateLimiterOptions {
  max: number;
  windowMs: number;
}

export interface RateLimiter {
  /** Devuelve true si la petición está permitida y la cuenta; false si superó el máximo. */
  check: (key: string, now?: number) => boolean;
  size: () => number;
}

/**
 * Límite de peticiones por clave (ventana fija) en memoria.
 * Limitación conocida: en hosting serverless cada instancia lleva su propia cuenta,
 * así que frena abuso casual pero no reemplaza un límite a nivel de red (WAF/CDN).
 */
export function createRateLimiter({ max, windowMs }: RateLimiterOptions): RateLimiter {
  const hits = new Map<string, { count: number; resetAt: number }>();

  return {
    check(key: string, now: number = Date.now()): boolean {
      // Limpieza de entradas vencidas para que el mapa no crezca sin control
      for (const [k, entry] of hits) {
        if (entry.resetAt <= now) hits.delete(k);
      }

      const entry = hits.get(key);
      if (!entry) {
        hits.set(key, { count: 1, resetAt: now + windowMs });
        return true;
      }
      if (entry.count >= max) return false;
      hits.set(key, { count: entry.count + 1, resetAt: entry.resetAt });
      return true;
    },
    size: () => hits.size,
  };
}
