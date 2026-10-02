"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/guards";
import { withTenant } from "@/lib/db/tenant";
import { SOLICITUD_ESTADOS } from "@/lib/db/schema";
import type { SolicitudEstado } from "@/lib/db/schema";
import { updateSolicitudEstado } from "./service";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Cambia el estado de una solicitud desde el panel (requiere sesión; el negocio sale de la sesión). */
export async function updateSolicitudEstadoAction(id: string, estado: string) {
  const session = await requireSession();

  if (!UUID_REGEX.test(id)) {
    return { success: false, error: "Solicitud no válida." };
  }
  if (!(SOLICITUD_ESTADOS as readonly string[]).includes(estado)) {
    return { success: false, error: "Estado no válido." };
  }

  const updated = await withTenant(session.businessId, (tx) =>
    updateSolicitudEstado(tx, session.businessId, id, estado as SolicitudEstado)
  );

  if (!updated) {
    return { success: false, error: "No se encontró la solicitud." };
  }

  revalidatePath("/solicitudes");
  revalidatePath("/");
  return { success: true };
}
