import crypto from "crypto";
import { LOCALIDADES, TIPOS_SOLICITUD } from "@/lib/solicitudes/validation";

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, any>;
    required?: string[];
  };
  messages?: Array<{
    type: "request-start" | "request-failed" | "request-response-delayed";
    content: string;
    timingMilliseconds?: number;
  }>;
}

/**
 * Catálogo de las 8 herramientas de tipo función que resuelven contra nuestro webhook
 * Cumplen con la regla de oro §9.1: NUNCA piden el teléfono del llamante ni el ID de negocio al modelo.
 */
export const SHARED_FUNCTION_TOOLS: ToolDefinition[] = [
  {
    name: "identificarLlamante",
    description:
      "Busca la ficha de la persona que llama en el CRM a partir de su número de teléfono. Llámala al inicio de la llamada para saber su nombre, si ya tiene solicitudes registradas y si tiene audiencias próximas.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
    messages: [],
  },
  {
    name: "consultarHuecos",
    description:
      "Consulta los huecos reales disponibles en la agenda de audiencias de la oficina según horario, duración y audiencias existentes. Devuelve hasta 3 opciones hablables.",
    parameters: {
      type: "object",
      properties: {
        servicio: {
          type: "string",
          description: "Nombre de la audiencia o gestión solicitada (ej: audiencia con el equipo legislativo).",
        },
        fechaPreferida: {
          type: "string",
          description: "Fecha preferida por la persona en formato ISO 8601 (YYYY-MM-DD o YYYY-MM-DDTHH:mm:ss).",
        },
        franja: {
          type: "string",
          enum: ["manana", "tarde", "cualquiera"],
          description: "Preferencia de franja horaria: manana (antes de las 14h), tarde (desde las 14h) o cualquiera.",
        },
        diasVista: {
          type: "integer",
          description: "Número de días a evaluar en el futuro (de 1 a 30, por defecto 7).",
        },
      },
      required: [],
    },
    messages: [
      { type: "request-start", content: "Déjeme mirar la agenda un segundo." },
      { type: "request-response-delayed", content: "Sigo consultando los huecos, un momento.", timingMilliseconds: 3000 },
      { type: "request-failed", content: "Ahora mismo no puedo entrar a la agenda. ¿Le parece que le llamemos nosotros?" },
    ],
  },
  {
    name: "reservarCita",
    description:
      "Reserva definitivamente una audiencia en la agenda e introduce o enriquece la ficha de la persona en el CRM. Llámala SOLO cuando la persona haya confirmado explícitamente el día y la hora.",
    parameters: {
      type: "object",
      properties: {
        inicioIso: {
          type: "string",
          description: "Fecha y hora exacta de inicio de la audiencia en formato ISO 8601 (ej: 2026-08-20T10:00:00).",
        },
        servicio: {
          type: "string",
          description: "Nombre de la audiencia o gestión a realizar (ej: audiencia con el equipo legislativo).",
        },
        nombre: {
          type: "string",
          description: "Nombre y apellidos de la persona.",
        },
        email: {
          type: "string",
          description: "Correo electrónico de la persona si lo facilita para la confirmación.",
        },
        notas: {
          type: "string",
          description: "Motivo o detalles de la audiencia.",
        },
        datosExtra: {
          type: "object",
          description: "Datos adicionales como el sector o comunidad donde vive (ej: {'comunidad': 'Quisqueya'}).",
        },
      },
      required: ["inicioIso", "servicio", "nombre"],
    },
    messages: [
      { type: "request-start", content: "Un momento mientras confirmo la reserva en el sistema." },
      { type: "request-response-delayed", content: "Estoy terminando de agendarla.", timingMilliseconds: 3000 },
      { type: "request-failed", content: "Ha habido un problema al registrar la audiencia. Déjeme sus datos y le llamamos en cuanto podamos." },
    ],
  },
  {
    name: "reprogramarCita",
    description:
      "Modifica la fecha y hora de una audiencia ya existente para la persona que llama. Revalida el nuevo hueco y conserva el histórico.",
    parameters: {
      type: "object",
      properties: {
        nuevoInicioIso: {
          type: "string",
          description: "Nueva fecha y hora solicitada en formato ISO 8601.",
        },
        citaId: {
          type: "string",
          description: "ID de la audiencia si se conoce previamente.",
        },
      },
      required: ["nuevoInicioIso"],
    },
    messages: [
      { type: "request-start", content: "Voy a cambiar la fecha de su audiencia, un segundo." },
      { type: "request-response-delayed", content: "Un momento mientras actualizo la agenda.", timingMilliseconds: 3000 },
      { type: "request-failed", content: "No consigo cambiar la audiencia ahora mismo. ¿Le llamamos luego?" },
    ],
  },
  {
    name: "anularCita",
    description:
      "Anula una audiencia futura de la persona que llama y libera el hueco en la agenda.",
    parameters: {
      type: "object",
      properties: {
        citaId: {
          type: "string",
          description: "ID de la audiencia a anular si se conoce.",
        },
        motivo: {
          type: "string",
          description: "Motivo por el que la persona cancela la audiencia.",
        },
      },
      required: [],
    },
    messages: [
      { type: "request-start", content: "Voy a anular la audiencia en la agenda, un momento." },
      { type: "request-failed", content: "No he podido anular la audiencia en este instante. Tomo nota para avisar a la oficina." },
    ],
  },
  {
    name: "datosDelNegocio",
    description:
      "Consulta información de la oficina: dirección exacta, cómo llegar, horarios, audiencias y gestiones que atiende o preguntas frecuentes.",
    parameters: {
      type: "object",
      properties: {
        tema: {
          type: "string",
          description: "Tema a consultar (ej: direccion, horarios, audiencias, como_solicitar).",
        },
      },
      required: [],
    },
    messages: [],
  },
  {
    name: "registrarSolicitud",
    description:
      "Registra una solicitud ciudadana (problema comunitario, salud, propuesta de ley, deporte u otra consulta) y devuelve el número de ticket de seguimiento. Llámala SOLO cuando la persona haya confirmado el resumen. NO pidas el teléfono: ya se conoce por la llamada.",
    parameters: {
      type: "object",
      properties: {
        nombre: {
          type: "string",
          description: "Nombre y apellidos de la persona que hace la solicitud.",
        },
        localidad: {
          type: "string",
          enum: [...LOCALIDADES],
          description: "Municipio o comunidad de la persona. Si no está en la lista, usa Otro.",
        },
        tipo: {
          type: "string",
          enum: [...TIPOS_SOLICITUD],
          description: "Tipo de solicitud que mejor describe el caso.",
        },
        mensaje: {
          type: "string",
          description: "Detalle de la situación o propuesta, con las palabras de la persona (mínimo 10 caracteres).",
        },
      },
      required: ["nombre", "localidad", "tipo", "mensaje"],
    },
    messages: [
      { type: "request-start", content: "Un momento mientras registro su solicitud." },
      { type: "request-response-delayed", content: "Sigo registrándola, un segundo.", timingMilliseconds: 3000 },
      { type: "request-failed", content: "No pude registrar la solicitud ahora mismo. ¿Le parece que le llamemos nosotros para tomarla?" },
    ],
  },
  {
    name: "registrarHandoff",
    description:
      "Anota en el sistema que la persona necesita hablar con alguien del equipo de la oficina o que la consulta requiere atención humana.",
    parameters: {
      type: "object",
      properties: {
        motivo: {
          type: "string",
          description: "Motivo detallado por el que se transfiere o deriva la llamada.",
        },
      },
      required: ["motivo"],
    },
    messages: [],
  },
];

/**
 * Calcula un checksum SHA-256 de la definición de una herramienta para detectar cambios
 */
export function getToolChecksum(tool: ToolDefinition): string {
  const str = JSON.stringify({
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
    messages: tool.messages,
  });
  return crypto.createHash("sha256").update(str).digest("hex").slice(0, 16);
}
