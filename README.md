# Marketing Jacobo Ramos

Landing page y backend del diputado Jacobo Ramos (San Pedro de Macorís).

## Estructura

- `landing/index.html` → la página web (un solo archivo, sin instalar nada). Imágenes en `landing/assets/images/`.
- `crm/` → backend y panel (clon adaptado de `CRM.Agentevoz`). Ver `crm/README.md` y `crm/docs/CLON-JACOBO-RAMOS.md`.
- `n8n/oficina-virtual-webhook.json` → flujo base de n8n de la primera versión. **Opcional**: el formulario ahora envía a `crm/`. Sirve si más adelante quieres avisos por correo o WhatsApp.

## Ver la landing en tu computadora

```powershell
python -m http.server 8000 --bind 127.0.0.1 --directory "C:\Users\IA Power Engine\MisProyectos\Marketing Jacobo Ramos\landing"
```

Abre http://localhost:8000. `--directory` evita servir una carpeta equivocada y `--bind 127.0.0.1` hace que solo se vea desde tu computadora. Si el puerto 8000 está ocupado, usa otro (8001...).

En ese modo el formulario funciona como **demo** (no guarda nada) hasta que conectes el backend.

## Conectar la landing con el backend

1. Levanta `crm/` (pasos en `crm/README.md`): Postgres local, migraciones, semillero y `pnpm dev`.
2. En `crm/.env`: `LANDING_ALLOWED_ORIGINS=http://localhost:8000` y el `OFICINA_BUSINESS_ID` que imprimió el semillero.
3. En `landing/index.html`, dentro de `CONFIG`, pon `apiBaseUrl: 'http://localhost:3000'`.
4. Envía una solicitud desde el formulario: debe aparecer en el panel, en **Solicitudes**, y el ticket sirve en "Consultar ticket".

## Pendiente antes de publicar (buscar en el código: `TODO(cliente)`, `VERIFICAR`, `PENDIENTE`)

- Verificar proyectos y estatus en el Sistema de Información Legislativa de la Cámara de Diputados.
- Aprobación del diputado para las dos citas textuales.
- Teléfono, correo, direcciones, redes sociales y videos reales. La foto y el banner ya están en `landing/assets/images/` pero la landing aún no los usa.
- Cuentas propias de Supabase, Vapi y Vercel para el backend.
