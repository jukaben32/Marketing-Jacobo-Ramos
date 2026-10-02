import { and, desc, eq, ilike, or } from "drizzle-orm";
import type { TenantDb } from "@/lib/db/tenant";
import { contactNotes, contacts, solicitudes, SOLICITUD_ESTADOS } from "@/lib/db/schema";
import type { Solicitud, SolicitudEstado } from "@/lib/db/schema";
import { normalizePhone } from "@/lib/phone";
import { generateTicket } from "./validation";
import type { SolicitudInput } from "./validation";

const MAX_TICKET_ATTEMPTS = 5;
const LIST_LIMIT = 200;

export interface CreateSolicitudOptions {
  origen: "web" | "voz" | "panel";
  callId?: string | null;
}

/** Busca un ticket libre. La probabilidad de choque es ínfima; el índice único es la última defensa. */
async function reserveTicket(tx: TenantDb, businessId: string): Promise<string> {
  for (let attempt = 0; attempt < MAX_TICKET_ATTEMPTS; attempt++) {
    const ticket = generateTicket();
    const [taken] = await tx
      .select({ id: solicitudes.id })
      .from(solicitudes)
      .where(and(eq(solicitudes.businessId, businessId), eq(solicitudes.ticket, ticket)))
      .limit(1);
    if (!taken) return ticket;
  }
  throw new Error("No se pudo generar un ticket único.");
}

/**
 * Registra una solicitud ciudadana y enlaza (o crea) la ficha del contacto por teléfono.
 * Debe ejecutarse dentro de withTenant().
 */
export async function createSolicitud(
  tx: TenantDb,
  businessId: string,
  input: SolicitudInput,
  options: CreateSolicitudOptions
): Promise<Solicitud> {
  const phone = normalizePhone(input.telefono);
  const contactSource = options.origen === "voz" ? "agente_voz" : "web";

  let contactId: string | null = null;
  if (phone) {
    const [existing] = await tx
      .select({ id: contacts.id })
      .from(contacts)
      .where(and(eq(contacts.businessId, businessId), eq(contacts.phone, phone)))
      .limit(1);

    if (existing) {
      contactId = existing.id;
      await tx.update(contacts).set({ lastContactedAt: new Date() }).where(eq(contacts.id, existing.id));
    } else {
      const [created] = await tx
        .insert(contacts)
        .values({
          businessId,
          fullName: input.nombre,
          phone,
          status: "lead",
          source: contactSource,
          lastContactedAt: new Date(),
        })
        .returning({ id: contacts.id });
      contactId = created.id;
    }
  }

  const ticket = await reserveTicket(tx, businessId);

  const [solicitud] = await tx
    .insert(solicitudes)
    .values({
      businessId,
      contactId,
      callId: options.callId ?? null,
      ticket,
      nombre: input.nombre,
      telefono: phone ?? input.telefono,
      localidad: input.localidad,
      tipo: input.tipo,
      mensaje: input.mensaje,
      origen: options.origen,
    })
    .returning();

  if (contactId) {
    await tx.insert(contactNotes).values({
      businessId,
      contactId,
      body: `Solicitud ${ticket} (${input.tipo}, ${input.localidad}): ${input.mensaje}`,
      authorUserId: null,
    });
  }

  return solicitud;
}

export interface SolicitudPublica {
  estado: SolicitudEstado;
  localidad: string;
  creadaEn: string;
}

/**
 * Datos mínimos para la consulta pública por ticket.
 * Nunca devuelve nombre, teléfono ni mensaje: el ticket no debe servir para ver datos personales.
 */
export async function getSolicitudPublica(
  tx: TenantDb,
  businessId: string,
  ticket: string
): Promise<SolicitudPublica | null> {
  const [row] = await tx
    .select({ estado: solicitudes.estado, localidad: solicitudes.localidad, createdAt: solicitudes.createdAt })
    .from(solicitudes)
    .where(and(eq(solicitudes.businessId, businessId), eq(solicitudes.ticket, ticket)))
    .limit(1);

  if (!row) return null;
  return { estado: row.estado, localidad: row.localidad, creadaEn: row.createdAt.toISOString() };
}

export interface ListSolicitudesParams {
  estado?: string;
  q?: string;
}

/** Listado para el panel, con filtro por estado y búsqueda por ticket, nombre o localidad. */
export async function listSolicitudes(
  tx: TenantDb,
  businessId: string,
  params: ListSolicitudesParams = {}
): Promise<Solicitud[]> {
  const conditions = [eq(solicitudes.businessId, businessId)];

  if (params.estado && (SOLICITUD_ESTADOS as readonly string[]).includes(params.estado)) {
    conditions.push(eq(solicitudes.estado, params.estado as SolicitudEstado));
  }

  const term = params.q?.trim();
  if (term) {
    // Se escapan los comodines de LIKE para que el texto buscado se trate como literal
    const safe = term.replace(/[%_\\]/g, (ch) => `\\${ch}`);
    const pattern = `%${safe}%`;
    const search = or(
      ilike(solicitudes.ticket, pattern),
      ilike(solicitudes.nombre, pattern),
      ilike(solicitudes.localidad, pattern)
    );
    if (search) conditions.push(search);
  }

  return tx
    .select()
    .from(solicitudes)
    .where(and(...conditions))
    .orderBy(desc(solicitudes.createdAt))
    .limit(LIST_LIMIT);
}

/** Cambia el estado de una solicitud. Devuelve false si no existe en este negocio. */
export async function updateSolicitudEstado(
  tx: TenantDb,
  businessId: string,
  id: string,
  estado: SolicitudEstado
): Promise<boolean> {
  const updated = await tx
    .update(solicitudes)
    .set({ estado })
    .where(and(eq(solicitudes.businessId, businessId), eq(solicitudes.id, id)))
    .returning({ id: solicitudes.id });
  return updated.length > 0;
}
