import React from "react";
import { requireSession } from "@/lib/auth/guards";
import { withTenant } from "@/lib/db/tenant";
import { listSolicitudes } from "@/lib/solicitudes/service";
import { SolicitudesView } from "@/components/solicitudes-view";

interface PageProps {
  searchParams: Promise<{ estado?: string; q?: string }>;
}

export default async function SolicitudesPage({ searchParams }: PageProps) {
  const session = await requireSession();
  const params = await searchParams;

  const items = await withTenant(session.businessId, (tx) =>
    listSolicitudes(tx, session.businessId, { estado: params.estado, q: params.q })
  );

  // Solo se pasan al componente de cliente los datos que necesita, con fechas en texto
  const rows = items.map((s) => ({
    id: s.id,
    ticket: s.ticket,
    nombre: s.nombre,
    telefono: s.telefono,
    localidad: s.localidad,
    tipo: s.tipo,
    mensaje: s.mensaje,
    estado: s.estado,
    origen: s.origen,
    contactId: s.contactId,
    createdAt: s.createdAt.toISOString(),
  }));

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto w-full">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-100">Solicitudes ciudadanas</h1>
        <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
          Lo que llega desde la Oficina Virtual de la web y desde el recepcionista telefónico, con su ticket de seguimiento
        </p>
      </div>

      <SolicitudesView items={rows} filtroEstado={params.estado ?? ""} busqueda={params.q ?? ""} />
    </div>
  );
}
