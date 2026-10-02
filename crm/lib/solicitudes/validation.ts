import crypto from "crypto";

// Lista cerrada de localidades. Debe coincidir con el menú del formulario de la landing.
export const LOCALIDADES = [
  "San Pedro de Macorís",
  "Quisqueya",
  "Ramón Santana",
  "Gautier",
  "El Soco",
  "Consuelo",
  "Otro",
] as const;

// Lista cerrada de tipos de solicitud (igual que el formulario de la landing).
export const TIPOS_SOLICITUD = [
  "Problema comunitario / Asfaltado",
  "Salud y asistencia médica",
  "Propuesta de proyecto de ley",
  "Deporte e instalaciones",
  "Otra consulta",
] as const;

export interface SolicitudInput {
  nombre: string;
  telefono: string;
  localidad: string;
  tipo: string;
  mensaje: string;
}

export type ValidationResult =
  | { ok: true; data: SolicitudInput }
  | { ok: false; error: string };

const NOMBRE_MIN = 3;
const NOMBRE_MAX = 80;
const MENSAJE_MIN = 10;
const MENSAJE_MAX = 1000;
const TELEFONO_REGEX = /^[0-9+()\-\s]{7,20}$/;

// Formato del ticket público: SPM-2026-A1B2C3 (año + 6 caracteres hexadecimales en mayúscula)
export const TICKET_REGEX = /^SPM-\d{4}-[0-9A-F]{6}$/;

/**
 * Valida y limpia lo que llega desde la landing (o el agente de voz).
 * Nunca confía en el tipo: todo debe ser texto. Devuelve un objeto nuevo (no muta la entrada).
 */
export function validateSolicitudInput(raw: unknown): ValidationResult {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { ok: false, error: "Solicitud inválida." };
  }
  const source = raw as Record<string, unknown>;

  const fields = ["nombre", "telefono", "localidad", "tipo", "mensaje"] as const;
  for (const field of fields) {
    if (typeof source[field] !== "string") {
      return { ok: false, error: `El campo ${field} es obligatorio.` };
    }
  }

  const data: SolicitudInput = {
    nombre: (source.nombre as string).trim(),
    telefono: (source.telefono as string).trim(),
    localidad: (source.localidad as string).trim(),
    tipo: (source.tipo as string).trim(),
    mensaje: (source.mensaje as string).trim(),
  };

  if (data.nombre.length < NOMBRE_MIN || data.nombre.length > NOMBRE_MAX) {
    return { ok: false, error: "Escribe tu nombre completo." };
  }
  if (!TELEFONO_REGEX.test(data.telefono)) {
    return { ok: false, error: "Escribe un teléfono válido." };
  }
  if (!(LOCALIDADES as readonly string[]).includes(data.localidad)) {
    return { ok: false, error: "Selecciona tu localidad." };
  }
  if (!(TIPOS_SOLICITUD as readonly string[]).includes(data.tipo)) {
    return { ok: false, error: "Selecciona el tipo de solicitud." };
  }
  if (data.mensaje.length < MENSAJE_MIN || data.mensaje.length > MENSAJE_MAX) {
    return { ok: false, error: "El mensaje debe tener entre 10 y 1000 caracteres." };
  }

  return { ok: true, data };
}

/** Genera un ticket aleatorio con el generador criptográfico del sistema (difícil de adivinar). */
export function generateTicket(now: Date = new Date()): string {
  const code = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `SPM-${now.getFullYear()}-${code}`;
}

export function isValidTicket(value: string): boolean {
  return TICKET_REGEX.test(value);
}

/**
 * Deletrea un ticket para leerlo por teléfono: "SPM-2026-A1B2C3" → "S P M, 2 0 2 6, A 1, B 2, C 3".
 * Si el texto no tiene formato de ticket se devuelve tal cual.
 */
export function spellTicket(ticket: string): string {
  if (!isValidTicket(ticket)) return ticket;
  const [prefix, year, code] = ticket.split("-");
  const pairs = code.match(/.{2}/g) ?? [];
  return [prefix.split("").join(" "), year.split("").join(" "), ...pairs.map((p) => p.split("").join(" "))].join(", ");
}
