# CRM Oficina Jacobo Ramos — Guía para Asistentes y Desarrolladores

## 1. Visión General del Proyecto
Backend y panel de la landing del diputado Jacobo Ramos (San Pedro de Macorís). Es un clon adaptado de `CRM.Agentevoz` (VoiceOps, hecho para talleres). Recibe las solicitudes ciudadanas de la landing (Oficina Virtual) y de un recepcionista telefónico con IA (VAPI), las guarda con un ticket de seguimiento y las gestiona desde un panel interno. **Una sola oficina**: no es un SaaS abierto. Ver `docs/CLON-JACOBO-RAMOS.md` para el estado y los pendientes.

`PROMPT-crm-agente-voz.md` y `docs/ESTADO-Y-PENDIENTES.md` (solo en la copia local; no se suben al repositorio) describen el proyecto del taller: IDs de VAPI, proyecto Supabase, URL de Vercel. Son **referencia histórica**, no el estado de este clon.

## 2. Stack Tecnológico
- **Framework:** Next.js 16 (App Router, Turbopack, `proxy.ts` como middleware).
- **Frontend:** React 19, TypeScript estricto, Tailwind CSS 4 (`@theme` + `@custom-variant dark` por clase), Phosphor Icons, Recharts.
- **Base de datos:** PostgreSQL con `uuidv7()` (nativo en PG18; en Supabase/PG17 la migración 0001 crea una función de respaldo), extensiones `unaccent`, `pg_trgm`, `btree_gist` y RLS en todas las tablas.
- **ORM:** Drizzle ORM con `node-postgres`. SSL con Supabase: ver §7.
- **Autenticación:** sesiones opacas con cookie `httpOnly` (`jr_oficina_session`), contraseñas con `bcryptjs`.
- **Telefonía:** VAPI Server SDK, webhook con token Bearer validado con `timingSafeEqual`.
- **Fechas y teléfonos:** Luxon y `libphonenumber-js` (E.164; por defecto República Dominicana `+1809/829/849`).

## 3. Marca visual (la misma de la landing)
- **Azul marino** `#0B2545` (botón principal, modo oscuro), **dorado** `#D4AF37` (acento), **crema** `#F6F1E7` (fondo).
- Los componentes usan las clases `orange-*` de Tailwind; en `app/globals.css` esa escala está **redefinida como dorado** (`@theme`). No reemplazar clases `orange-*` por otras: cambiar la escala allí.
- Dorado oscuro (`orange-600+`) para texto sobre fondo claro; el dorado claro solo para fondos y modo oscuro.
- Badges pastel con su par `dark:` (ver `lib/labels.ts`). Iconografía: solo Phosphor.
- Tema oscuro por clase `.dark` (hook `lib/hooks/use-theme.ts`, clave `jr-oficina-theme`).

## 4. Dominio: de "taller" a "oficina"
| Concepto interno | Significado aquí |
|---|---|
| `contacts` | Ciudadanos (`custom_fields.comunidad` y `.sector`; origen `web`, `agente_voz`, `manual`) |
| `appointments` / `services` | Audiencias con el diputado o su equipo y las gestiones que atiende la oficina (sin precio) |
| `solicitudes` (nueva) | Solicitudes ciudadanas con `ticket` público (`SPM-AAAA-XXXXXX`), estado y origen |
| `voice_agents` | Recepcionista telefónico de la oficina |

Los nombres de tablas y de herramientas de VAPI (`reservarCita`, `anularCita`...) se conservan por compatibilidad; lo que cambia es el texto visible y el prompt.

## 5. Solicitudes y API pública
- Módulo `lib/solicitudes/`: `validation.ts` (listas cerradas de localidades y tipos, ticket), `service.ts` (acceso a datos), `cors.ts`, `rate-limit.ts`, `actions.ts` (server action del panel).
- **Las listas `LOCALIDADES` y `TIPOS_SOLICITUD` deben coincidir con los menús del formulario de la landing** (`landing/index.html`) y con el enum de la herramienta `registrarSolicitud`. Hay una prueba que lo vigila.
- API pública (sin sesión, protegida por CORS con lista blanca, límite por IP, tamaño máximo, campo trampa `website` y validación estricta):
  - `POST /api/solicitudes` → `201 { ok, ticket }`. El ticket lo genera el servidor.
  - `GET /api/solicitudes/[ticket]` → solo `estado`, `localidad` y fecha. **Nunca** nombre, teléfono ni mensaje.
- La oficina destino sale de `OFICINA_BUSINESS_ID` (sin esa variable la API responde 503). Los orígenes permitidos, de `LANDING_ALLOWED_ORIGINS` (nunca `*`).
- Panel: `/solicitudes` (cambio de estado en línea). Estados: recibido, en_evaluacion, en_gestion, resuelto, archivado.

## 6. Herramientas de voz (8)
`identificarLlamante`, `consultarHuecos`, `reservarCita`, `reprogramarCita`, `anularCita`, `datosDelNegocio`, `registrarSolicitud`, `registrarHandoff`. Regla de oro: **ninguna pide el teléfono ni el ID de negocio al modelo**; el teléfono sale de la llamada. Si `vapi_tools` está vacía pero las tools ya existen en VAPI, no relanzar `vapi:tools:sync` sin más (crearía duplicados).

## 7. Seguridad y trampas conocidas
- Toda consulta de negocio va dentro de `withTenant(businessId, async (tx) => { ... })`. La app conecta como `app_user` (sin BYPASSRLS, sin CREATE, sin superusuario): el RLS se cumple de verdad.
- La migración `0004_app_role_policies.sql` abre solo lo que el código lee antes de conocer el inquilino: SELECT en `businesses`, `memberships`, `voice_agents` y `webhook_events` (getSession y el webhook de VAPI), acceso completo a `users`, `sessions`, `vapi_tools`, e INSERT de auditoría en `webhook_events`. Todo lo demás (contactos, solicitudes, llamadas, citas) sigue aislado por inquilino. Si añades una consulta sin `withTenant` sobre otra tabla, devolverá 0 filas: usa `withTenant`.
- La Data API de Supabase (claves `anon`/`authenticated`) no tiene acceso a nada; no la uses y desactívala en el panel.
- **No hay usuario ni contraseña por defecto.** `pnpm db:seed` exige `SEED_ADMIN_EMAIL` y `SEED_ADMIN_PASSWORD` (≥ 12 caracteres) y luego se borran del `.env`. `scripts/admin-credentials.ts` rechaza a propósito los ejemplos de la documentación, los marcadores `<...>` y las contraseñas obvias. Para cambiar credenciales: `pnpm admin:reset` (con `--lock` deja una contraseña aleatoria desconocida).
- Registro abierto apagado: `ALLOW_SIGNUP=false` (por defecto).
- Webhook de VAPI cerrado por defecto en producción si falta `VAPI_WEBHOOK_TOKEN`.
- **Cuentas propias:** Supabase, VAPI, Vercel y Twilio de este proyecto deben ser nuevos. Nunca reutilizar claves, IDs de credencial ni proyectos del CRM del taller (cliente real en producción).
- **SSL con Supabase:** `pg` 8.x trata `sslmode=require` como `verify-full` e ignora la opción `ssl`. Usar `toPgConnectionOptions()` de `lib/env.ts` y no poner `sslmode` en la URL.
- `db.execute` (Drizzle) devuelve `timestamptz` como `string`, no `Date`.
- El `server.url` hay que actualizarlo en el asistente y en las tools (botón "Re-alinear con APP_URL" en Conexiones, o `pnpm vapi:sync`).
- Los teléfonos se normalizan a E.164 antes de tocar la base de datos.
- Un cambio de variable de entorno en Vercel no afecta a un deployment ya construido: hace falta redeploy.
- La limitación del límite por IP: es en memoria, por instancia. En hosting serverless frena abuso casual, no sustituye un WAF.

## 8. Comandos
- `pnpm dev`: desarrollo en http://localhost:3000.
- `pnpm build`: compilación de producción.
- `pnpm db:migrate`: aplica `db/migrations/*.sql` en orden (usa `DATABASE_DIRECT_URL`). Con Postgres local en Docker, `db/init/00-roles.sql` (solo desarrollo) corre al crear la base.
- `pnpm supabase:info | supabase:init | supabase:migrate`: configuran Supabase por la Management API (sin la contraseña de postgres). Exigen `SUPABASE_ACCESS_TOKEN` y `SUPABASE_PROJECT_REF` solo en la ventana de PowerShell; **nunca** guardes el token en un archivo. `init` crea `app_user` con contraseña aleatoria y escribe `DATABASE_URL` en `.env` sin imprimirla; el script se niega a tocar el proyecto de producción del taller.
- `pnpm db:seed`: crea el administrador (desde variables de entorno), la oficina y datos iniciales; imprime `OFICINA_BUSINESS_ID=...`. Funciona con `DATABASE_URL` (app_user) si no hay `DATABASE_DIRECT_URL`.
- `pnpm vapi:tools:sync` / `pnpm vapi:sync`: registra las herramientas y re-alinea URLs en VAPI.
- `pnpm test`: pruebas (labels, payloads y prompt, solicitudes, API pública, RLS — esta última se salta sin base de datos).

## 9. Reglas críticas para la IA
1. Responder siempre en **español**.
2. **NUNCA** ejecutar `git add`, `git commit` o `git push` de forma autónoma salvo petición explícita en ese momento. `git init` sí está permitido.
3. Mantener `CLAUDE.md` y `AGENTS.md` exactamente idénticos (mismo contenido byte a byte).
4. No usar Tailwind v3 ni librerías obsoletas; respetar Tailwind v4 `@theme` + `@custom-variant`.
5. Nunca inventar identificadores de VAPI (modelo, `voiceId`, tool ID): verificar contra la API o el dashboard.
6. **Nunca escribir en documentación, README ni respuestas un ejemplo de credencial que se pueda ejecutar tal cual** (correo o contraseña con pinta de reales). Usar marcadores con `<...>` que fallen la validación. Ya ocurrió: el ejemplo se ejecutó literalmente y la cuenta real quedó con una contraseña pública.
7. No inventar datos reales de la oficina o del diputado (teléfono, correo, horarios, proyectos, citas textuales): dejarlos marcados `TODO(cliente)` hasta que el cliente los confirme.
