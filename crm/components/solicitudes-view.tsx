"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { updateSolicitudEstadoAction } from "@/lib/solicitudes/actions";
import { SOLICITUD_ESTADO_LABELS, formatContactSource, solicitudBadgeClasses } from "@/lib/labels";

export interface SolicitudRow {
  id: string;
  ticket: string;
  nombre: string;
  telefono: string | null;
  localidad: string;
  tipo: string;
  mensaje: string;
  estado: string;
  origen: string;
  contactId: string | null;
  createdAt: string;
}

interface SolicitudesViewProps {
  items: SolicitudRow[];
  filtroEstado: string;
  busqueda: string;
}

const ORIGEN_LABELS: Record<string, string> = { web: "Formulario web", voz: "Agente de voz", panel: "Panel" };

function formatFecha(iso: string): string {
  return new Date(iso).toLocaleString("es-DO", {
    timeZone: "America/Santo_Domingo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Lista de solicitudes ciudadanas con filtros (por URL) y cambio de estado en línea. */
export function SolicitudesView({ items, filtroEstado, busqueda }: SolicitudesViewProps) {
  const [rows, setRows] = useState<SolicitudRow[]>(items);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function cambiarEstado(id: string, estado: string) {
    const anterior = rows;
    setError(null);
    // Se actualiza la pantalla al instante (copia nueva, sin mutar) y se revierte si el servidor falla
    setRows(rows.map((r) => (r.id === id ? { ...r, estado } : r)));
    startTransition(async () => {
      const result = await updateSolicitudEstadoAction(id, estado);
      if (!result.success) {
        setRows(anterior);
        setError(result.error ?? "No se pudo actualizar el estado.");
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Filtros: formulario GET para que la búsqueda quede en la URL */}
      <form method="get" action="/solicitudes" className="card-saas p-4 flex flex-col sm:flex-row gap-3">
        <input
          type="search"
          name="q"
          defaultValue={busqueda}
          placeholder="Buscar por ticket, nombre o localidad"
          aria-label="Buscar solicitudes"
          className="field flex-1"
        />
        <select name="estado" defaultValue={filtroEstado} aria-label="Filtrar por estado" className="field sm:w-52">
          <option value="">Todos los estados</option>
          {Object.entries(SOLICITUD_ESTADO_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <button type="submit" className="btn btn-primary">
          Filtrar
        </button>
      </form>

      {error && (
        <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          {error}
        </p>
      )}

      <div className="card-saas overflow-hidden">
        {rows.length === 0 ? (
          <p className="p-10 text-center text-sm text-stone-500 dark:text-stone-400">
            No hay solicitudes con estos filtros todavía.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-stone-500 dark:text-stone-400 border-b border-stone-200 dark:border-stone-800">
                  <th className="px-4 py-3 font-semibold">Ticket</th>
                  <th className="px-4 py-3 font-semibold">Ciudadano</th>
                  <th className="px-4 py-3 font-semibold">Localidad y tipo</th>
                  <th className="px-4 py-3 font-semibold">Mensaje</th>
                  <th className="px-4 py-3 font-semibold">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                {rows.map((r) => (
                  <tr key={r.id} className="align-top">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="font-mono text-xs font-bold text-stone-900 dark:text-stone-100">{r.ticket}</div>
                      <div className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5">{formatFecha(r.createdAt)}</div>
                      <div className="text-[11px] text-stone-400 mt-0.5">{ORIGEN_LABELS[r.origen] ?? formatContactSource(r.origen)}</div>
                    </td>
                    <td className="px-4 py-3">
                      {r.contactId ? (
                        <Link href={`/contactos?id=${r.contactId}`} className="font-medium text-orange-600 dark:text-orange-400 hover:underline">
                          {r.nombre}
                        </Link>
                      ) : (
                        <span className="font-medium">{r.nombre}</span>
                      )}
                      <div className="text-xs text-stone-500 dark:text-stone-400">{r.telefono ?? "Sin teléfono"}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{r.localidad}</div>
                      <div className="text-xs text-stone-500 dark:text-stone-400">{r.tipo}</div>
                    </td>
                    <td className="px-4 py-3 max-w-xs">
                      <p className="line-clamp-3 text-stone-700 dark:text-stone-300" title={r.mensaje}>
                        {r.mensaje}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={r.estado}
                        disabled={isPending}
                        onChange={(e) => cambiarEstado(r.id, e.target.value)}
                        aria-label={`Estado de la solicitud ${r.ticket}`}
                        className={`text-xs font-semibold rounded-full border px-3 py-1.5 cursor-pointer ${solicitudBadgeClasses(r.estado)}`}
                      >
                        {Object.entries(SOLICITUD_ESTADO_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
