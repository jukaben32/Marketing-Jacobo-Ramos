-- 0004: La app corre con el rol restringido `app_user` (RLS forzado) y no con el superusuario.
-- Se abren SOLO los accesos que el código hace antes de conocer el inquilino y se cierran las
-- tablas que no tenían RLS. Requiere que el rol app_user exista (db/init/*.sql lo crea).

-- 1. Tablas globales sin inquilino: RLS activado; solo app_user tiene acceso.
--    Con RLS activado y sin política, el resto de roles (anon, authenticated...) no ve ninguna fila.
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE vapi_tools ENABLE ROW LEVEL SECURITY;
ALTER TABLE schema_migrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY app_access_users ON users
  FOR ALL TO app_user USING (true) WITH CHECK (true);
CREATE POLICY app_access_sessions ON sessions
  FOR ALL TO app_user USING (true) WITH CHECK (true);
CREATE POLICY app_access_vapi_tools ON vapi_tools
  FOR ALL TO app_user USING (true) WITH CHECK (true);
-- schema_migrations: sin política para app_user (solo el dueño de las migraciones la toca)

-- 2. Lecturas previas al inquilino (solo SELECT; las escrituras siguen exigiendo el inquilino):
--    getSession() une sessions + memberships + businesses; el webhook de VAPI busca el negocio
--    por vapi_assistant_id / vapi_phone_number_id en voice_agents.
CREATE POLICY app_read_businesses ON businesses
  FOR SELECT TO app_user USING (true);
CREATE POLICY app_read_memberships ON memberships
  FOR SELECT TO app_user USING (true);
CREATE POLICY app_read_voice_agents ON voice_agents
  FOR SELECT TO app_user USING (true);

-- 3. Auditoría de webhooks: se registra el evento con su negocio antes de fijar el inquilino,
--    y el inspector de desarrollo lista los eventos.
CREATE POLICY app_insert_webhook_events ON webhook_events
  FOR INSERT TO app_user WITH CHECK (true);
CREATE POLICY app_read_webhook_events ON webhook_events
  FOR SELECT TO app_user USING (true);

-- 4. Supabase: la Data API (claves anon / authenticated) no debe tener acceso a ninguna tabla.
--    Guarda por si se aplica en un Postgres sin esos roles (desarrollo local).
DO $$
DECLARE
  api_role text;
BEGIN
  FOREACH api_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = api_role) THEN
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM %I', api_role);
      EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM %I', api_role);
    END IF;
  END LOOP;
END
$$;
