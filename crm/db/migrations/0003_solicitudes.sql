-- 0003: Solicitudes ciudadanas (Oficina Virtual de la landing y recepcionista telefónico)
-- Se aplica DESPUÉS de 0001 y 0002.

-- 1. Los contactos creados desde el formulario web tienen origen 'web'
ALTER TABLE contacts DROP CONSTRAINT IF EXISTS contacts_source_check;
ALTER TABLE contacts
  ADD CONSTRAINT contacts_source_check
  CHECK (source IN ('agente_voz', 'manual', 'importado', 'web'));

-- 2. Tabla de solicitudes
CREATE TABLE IF NOT EXISTS solicitudes (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  call_id uuid REFERENCES calls(id) ON DELETE SET NULL,
  -- Código público de seguimiento (ej: SPM-2026-A1B2C3). Lo genera el servidor.
  ticket text NOT NULL,
  nombre text NOT NULL,
  telefono text,
  localidad text NOT NULL,
  tipo text NOT NULL,
  mensaje text NOT NULL,
  estado text NOT NULL DEFAULT 'recibido'
    CHECK (estado IN ('recibido', 'en_evaluacion', 'en_gestion', 'resuelto', 'archivado')),
  origen text NOT NULL DEFAULT 'web' CHECK (origen IN ('web', 'voz', 'panel')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- El ticket es único por negocio (así la consulta pública no puede mezclar oficinas)
CREATE UNIQUE INDEX IF NOT EXISTS idx_solicitudes_tenant_ticket ON solicitudes(business_id, ticket);
CREATE INDEX IF NOT EXISTS idx_solicitudes_tenant_created ON solicitudes(business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_solicitudes_tenant_estado ON solicitudes(business_id, estado);

CREATE TRIGGER trg_solicitudes_updated_at
BEFORE UPDATE ON solicitudes
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 3. Aislamiento por inquilino (igual que el resto de tablas de negocio)
ALTER TABLE solicitudes ENABLE ROW LEVEL SECURITY;
ALTER TABLE solicitudes FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_solicitudes ON solicitudes
  FOR ALL
  USING (business_id = NULLIF(current_setting('app.business_id', true), '')::uuid)
  WITH CHECK (business_id = NULLIF(current_setting('app.business_id', true), '')::uuid);
