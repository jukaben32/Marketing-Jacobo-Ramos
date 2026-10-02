# Clon para la Oficina Jacobo Ramos

Este proyecto es una **copia** de `MisProyectos/CRM.Agentevoz` (VoiceOps CRM, hecho para talleres).
El original **no se modificó**. Aquí se adapta para ser el backend de la landing.

Última actualización: 2 de octubre de 2026.

## Hecho

**Copia segura**
- Sin `.env` / `.env.local` (claves), `.vercel` (vinculado a la producción del taller), `.git`, `.github`, `node_modules`, `.next` ni las carpetas de otros agentes.
- Se eliminó `scripts/supabase-migrate.ts`: creaba un usuario `demo@taller.es` con contraseña débil y datos de taller.
- Valores por defecto de la base local propios (`oficina_jr`, puerto 5435, contenedores `jr_oficina_*`) para no tocar por accidente la base del CRM del taller.

**Marca**
- Escala `orange-*` de Tailwind redefinida como dorado en `app/globals.css`; fondo crema, botón principal azul marino, modo oscuro azul marino.
- Nombre "Oficina Jacobo Ramos"; cookie de sesión, tema y barra lateral renombrados (`jr_oficina_*`).

**Dominio taller → oficina**
- Prompt del agente de voz reescrito (no es el diputado, no promete resultados, no opina de política, remite emergencias al 911).
- Herramientas de voz adaptadas y nueva `registrarSolicitud` (8 en total).
- Etiquetas, textos de pantallas, ficha de contacto (comunidad y sector en vez de matrícula y vehículo), semillero y datos iniciales.
- Menú: Solicitudes, Audiencias, Ciudadanos.

**Backend de la landing**
- Migración `0003_solicitudes.sql` (tabla con RLS, contactos con origen `web`).
- `POST /api/solicitudes` y `GET /api/solicitudes/[ticket]` (públicos, con CORS de lista blanca, límite por IP, tamaño máximo, campo trampa y validación).
- Panel `/solicitudes` con cambio de estado.
- La landing (`../landing/index.html`) ya llama a esta API mediante `CONFIG.apiBaseUrl`.

**Seguridad**
- Sin usuario ni contraseña por defecto: `pnpm db:seed` exige `SEED_ADMIN_EMAIL` y `SEED_ADMIN_PASSWORD` (≥ 12 caracteres) y rechaza ejemplos de la documentación, marcadores `<...>` y contraseñas obvias.
- `pnpm admin:reset` cambia correo y contraseña de un administrador y cierra sus sesiones (`--lock` la bloquea con una contraseña aleatoria).
- Incidente del 2 de octubre de 2026: el semillero se ejecutó con el ejemplo literal del chat (`tu@correo.com` y una contraseña pública). La cuenta se bloqueó de inmediato con `admin:reset --lock`, se comprobó que esa contraseña ya no abre la cuenta y no había ninguna sesión abierta. Después, el administrador pasó a ser el correo del propietario con una contraseña **temporal y débil** (8 caracteres, escrita en un chat, aceptada con `ALLOW_TEMPORARY_PASSWORD=yes`). Login verificado contra el Supabase real. **Pendiente:** cambiarla con `pnpm admin:reset` por una de 12+ caracteres antes de desplegar o publicar el panel.
- Registro abierto apagado (`ALLOW_SIGNUP=false`).
- Se quitaron las credenciales de demostración de la pantalla de acceso.

## Supabase configurado (2 de octubre de 2026)

Proyecto "Marketing Jacobo Ramos" (us-east-2, Postgres 17; el identificador está en el panel de Supabase y no se publica aquí), **nuevo y distinto del del taller**.

- Migraciones 0001 a 0004 aplicadas y registradas en `schema_migrations` (a diferencia del taller, que nunca tuvo esa tabla).
- 0001 ahora incluye una función `uuidv7()` de respaldo (Postgres 17 no la trae nativa).
- Rol `app_user`: login, sin superusuario, sin BYPASSRLS, sin CREATE; contraseña aleatoria que solo vive en `.env`.
- 18 tablas con RLS y 22 políticas. `anon` y `authenticated` sin ningún permiso: la Data API responde 401.
- `.env` creado con `DATABASE_URL` (pooler, modo transacción, puerto 6543) y variables no secretas.

Pendiente en Supabase: ejecutar `pnpm db:seed` (necesita el correo y la contraseña del administrador), copiar `OFICINA_BUSINESS_ID` al `.env`, y desactivar la Data API en el panel (Project Settings → Data API), que esta app no usa. Revocar los tokens `sbp_` usados.

## Verificado

- `tsc --noEmit` y `pnpm build` sin errores.
- `pnpm test`: 42 pruebas (2 de RLS se saltan sin base de datos).
- Contra un Postgres real y desechable (embebido, ya apagado), **con el rol restringido app_user**: migraciones 0001-0004, semillero, login real y las 9 pantallas del panel, landing → panel, webhook de voz sin metadata, 24 casos de la API pública, 11 del webhook y aislamiento RLS.
- Contra el Supabase real: 13 comprobaciones (conexión como app_user por el pooler, sin crear ni borrar tablas, Data API cerrada con la clave anon).

## NO verificado todavía

- Vapi, Vercel y Twilio reales: aún no existen las cuentas propias de este proyecto.
- El semillero y el login contra el Supabase real (se probaron en local con el mismo rol restringido).
- Una llamada de voz real (requiere asistente provisionado y un número de teléfono).
- El panel con una sesión iniciada en el navegador (se probó la API, el build y el redireccionamiento al login, pero no se navegó el panel).
- Los textos de la oficina (horarios, audiencias, preguntas frecuentes) son un borrador marcado `TODO(cliente)`.

## Reglas de seguridad de este clon

1. **Cuentas propias.** Supabase, Vapi, Vercel y Twilio de este proyecto deben ser NUEVOS. No reutilizar `DATABASE_URL`, `VAPI_API_KEY`, `VAPI_WEBHOOK_TOKEN`, `VAPI_SERVER_CREDENTIAL_ID` ni el token de Supabase del taller: un error aquí leería o escribiría datos del cliente real del taller.
2. **No crear `.env` con claves del original.** Partir de `.env.example`.
3. Los documentos heredados (`PROMPT-crm-agente-voz.md`, `docs/ESTADO-Y-PENDIENTES.md`) describen el proyecto del taller (IDs de Vapi, proyecto Supabase, URL de Vercel). Son referencia, no el estado de este clon.
4. Cuidado al ejecutar `pnpm test` en otra configuración: la prueba de RLS inserta y borra filas de prueba en la base a la que apunten las variables de entorno.

## Pendiente

1. **Cuentas nuevas** (las crea el usuario): Vapi, Vercel y, para teléfono, Twilio/Telnyx. (Supabase ya está.)
2. **Datos reales de la oficina:** teléfono, correo, dirección, horarios, audiencias, preguntas frecuentes.
3. **Voz** (ya está en el código, verificar en el asistente nuevo): `eleven_flash_v2_5`, `optimizeStreamingLatency: 3`, `stopSpeakingPlan.numWords: 2` y tool nativo `endCall`.
4. **Número de teléfono:** sin decidir (número dominicano 809/829/849 vs. +1 EE. UU.).
5. **WhatsApp (Meta Cloud API):** segunda etapa. Encaja bien porque la landing ya habla de WhatsApp; el plan técnico está en §8 de `docs/ESTADO-Y-PENDIENTES.md` del original.
6. **Avisos a la oficina** cuando llega una solicitud (correo o WhatsApp). Opcional con n8n: `../n8n/oficina-virtual-webhook.json` es un flujo base de la primera versión; hoy el backend reemplaza esa función.
7. **Limitación conocida:** el límite de envíos por IP es en memoria y por instancia; en hosting serverless frena abuso casual, no reemplaza un WAF.
