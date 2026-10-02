# CRM Oficina Jacobo Ramos

Backend y panel de la landing del diputado Jacobo Ramos. Recibe las solicitudes del formulario web (Oficina Virtual) y de un recepcionista telefónico con IA, les asigna un ticket de seguimiento y las gestiona desde un panel interno.

> Es un clon adaptado de `CRM.Agentevoz` (hecho para talleres). Detalle de lo que cambió y lo que falta: [`docs/CLON-JACOBO-RAMOS.md`](docs/CLON-JACOBO-RAMOS.md). Los archivos `PROMPT-crm-agente-voz.md` y `docs/ESTADO-Y-PENDIENTES.md` son referencia histórica del proyecto del taller y solo existen en la copia local (no se suben al repositorio porque contienen identificadores de producción de otro cliente).

## Qué incluye

- **API pública para la landing:** `POST /api/solicitudes` (crea la solicitud y devuelve el ticket) y `GET /api/solicitudes/[ticket]` (estado, sin datos personales).
- **Panel** (requiere sesión): Panel de control, **Solicitudes**, Audiencias, Ciudadanos (CRM), Conversaciones, Ajustes del agente, Conexiones.
- **Recepcionista de voz (VAPI):** 8 herramientas, entre ellas `registrarSolicitud`, que registra la solicitud de quien llama y le dice su ticket.
- **Seguridad:** RLS en todas las tablas, CORS con lista blanca, límite de envíos por IP, campo trampa contra bots, validación estricta, sin usuario por defecto, registro abierto apagado.

## Puesta en marcha en local

Requisitos: Node 22 o 24, pnpm 11 y Docker Desktop (para el Postgres local).

```bash
cp .env.example .env              # y rellena las variables (ver abajo)
docker compose up -d              # Postgres en 127.0.0.1:5435 (no choca con el CRM del taller)
pnpm install
pnpm db:migrate                   # aplica db/migrations/*.sql
```

Con Docker, el script `db/init/00-roles.sql` (roles y extensiones) se ejecuta solo al crear la base. Con otro Postgres, ejecútalo a mano antes de migrar.

Crear el primer administrador y la oficina (sin usuario ni contraseña por defecto):

```bash
# PowerShell
# Reemplaza TODO lo que está entre < > (incluidos los signos) por tus datos reales.
# Los ejemplos con < > o los de la documentación se rechazan a propósito.
$env:SEED_ADMIN_EMAIL = "<tu correo real>"; $env:SEED_ADMIN_PASSWORD = "<contraseña nueva de 12+ caracteres>"
pnpm db:seed
```

Al terminar imprime `OFICINA_BUSINESS_ID=...`. Cópialo a tu `.env` y **borra** `SEED_ADMIN_*` del entorno.

Para cambiar el correo o la contraseña de un administrador ya creado (también cierra sus sesiones):

```powershell
$env:ADMIN_CURRENT_EMAIL = "<correo actual de la cuenta>"
$env:ADMIN_NEW_EMAIL     = "<tu correo real>"            # opcional
$env:ADMIN_NEW_PASSWORD  = "<contraseña nueva de 12+ caracteres>"
pnpm admin:reset         # con --lock deja una contraseña aleatoria que nadie conoce
```

```bash
pnpm dev                          # http://localhost:3000
```

## Configurar Supabase (sin la contraseña de postgres)

Crea un proyecto NUEVO en Supabase (no el del taller) y un token de acceso en Account → Access Tokens con permisos de proyecto y base de datos. Luego, en PowerShell (el token solo vive en esa ventana):

```powershell
$env:SUPABASE_ACCESS_TOKEN = "sbp_..."
$env:SUPABASE_PROJECT_REF  = "<ref del proyecto>"
pnpm supabase:info      # comprueba el proyecto
pnpm supabase:init      # extensiones + rol app_user + escribe DATABASE_URL en .env
pnpm supabase:migrate   # aplica db/migrations/*.sql y las registra
```

La app conecta como `app_user`, un rol restringido. Después ejecuta el semillero con tu correo y una contraseña de 12+ caracteres (se escriben en TU terminal, no en un chat):

```powershell
$env:SEED_ADMIN_EMAIL = "<tu correo real>"; $env:SEED_ADMIN_PASSWORD = "<contraseña nueva de 12+ caracteres>"
pnpm db:seed
```

Copia `OFICINA_BUSINESS_ID=...` al `.env`. Al terminar, revoca el token `sbp_`.

## Variables de entorno principales

| Variable | Para qué |
|---|---|
| `DATABASE_URL` / `DATABASE_DIRECT_URL` | Postgres (app y migraciones). Con Supabase, **sin** `sslmode` en la URL |
| `OFICINA_BUSINESS_ID` | Oficina que recibe las solicitudes de la landing (la imprime `pnpm db:seed`) |
| `LANDING_ALLOWED_ORIGINS` | Dominios de la landing que pueden llamar a la API, separados por comas. Nunca `*` |
| `ALLOW_SIGNUP` | `false` (por defecto). El panel es de una sola oficina |
| `VAPI_API_KEY`, `VAPI_WEBHOOK_TOKEN`, `VAPI_SERVER_CREDENTIAL_ID` | Telefonía con IA (cuenta de VAPI **propia** de este proyecto) |
| `APP_URL` | URL pública del backend (la usa VAPI para llamar al webhook) |

Plantilla comentada completa en `.env.example`.

## Conectar la landing

1. En `LANDING_ALLOWED_ORIGINS` pon el dominio de la landing (en local: `http://localhost:8000`).
2. En `landing/index.html`, dentro de `CONFIG`, pon `apiBaseUrl` con la URL del backend (en local: `http://localhost:3000`).
3. Envía una solicitud de prueba desde el formulario y revisa que aparezca en el panel, en **Solicitudes**.

## Despliegue

Pensado para Vercel + Supabase, con proyectos **nuevos** (no reutilizar los del taller). Variables en el dashboard de Vercel; un cambio de variable exige redeploy. Tras desplegar: ejecutar `pnpm db:migrate` y `pnpm db:seed` contra la base nueva, y en **Conexiones** pulsar "Re-alinear con APP_URL" y "Provisionar Asistente".

## Pruebas

```bash
pnpm test        # 42 pruebas; las 2 de RLS se saltan sin base de datos
pnpm build
```

## Pendiente de la oficina (marcado en el código como `TODO(cliente)`)

Teléfono, correo y dirección reales; horarios de la oficina; audiencias que se ofrecen; preguntas frecuentes; número de teléfono para el agente de voz (aún sin decidir) y canal de WhatsApp (planeado para una segunda etapa).
