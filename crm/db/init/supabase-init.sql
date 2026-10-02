-- Inicialización para Supabase (la ejecuta `pnpm supabase:init`; no se pega a mano).
-- Reemplaza a 00-roles.sql en Supabase: contraseña fuerte generada al ejecutarla (nunca escrita aquí),
-- sin CREATE en el esquema, y sin acceso para la Data API (anon / authenticated).
-- El marcador __APP_USER_PASSWORD__ lo sustituye el script en memoria.

-- 1. Extensiones (en public: f_unaccent y los índices de db/migrations las esperan ahí)
CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA public;

-- 2. Función wrapper inmutable para unaccent (permite usarla en índices)
CREATE OR REPLACE FUNCTION f_unaccent(text)
  RETURNS text AS $$
    SELECT public.unaccent('public.unaccent', $1);
$$ LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT;

-- 3. Rol de la aplicación: sin superusuario, sin BYPASSRLS, sin crear roles ni bases de datos
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user WITH LOGIN PASSWORD '__APP_USER_PASSWORD__'
      NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  ELSE
    ALTER ROLE app_user WITH LOGIN PASSWORD '__APP_USER_PASSWORD__'
      NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  END IF;
END
$$;

-- 4. Privilegios mínimos: solo USAGE en el esquema (sin CREATE)
GRANT USAGE ON SCHEMA public TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO app_user;

-- 5. La Data API de Supabase (PostgREST, claves anon/authenticated) no debe ver nada de este esquema.
--    Se protege con una guarda por si el script se prueba en un Postgres sin esos roles.
DO $$
DECLARE
  api_role text;
BEGIN
  FOREACH api_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = api_role) THEN
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM %I', api_role);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM %I', api_role);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM %I', api_role);
    END IF;
  END LOOP;
END
$$;
