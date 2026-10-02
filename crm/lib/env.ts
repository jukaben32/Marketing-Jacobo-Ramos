import { z } from "zod";

try {
  if (typeof process.loadEnvFile === "function") {
    process.loadEnvFile();
  }
} catch {
  // Ignorar si el archivo .env no existe en tiempo de compilación
}

const envSchema = z.object({
  POSTGRES_USER: z.string().default("oficina_jr"),
  POSTGRES_PASSWORD: z.string().default("oficina_jr_dev_pass"),
  POSTGRES_DB: z.string().default("oficina_jr"),
  DB_HOST: z.string().default("localhost"),
  DB_PORT: z.string().default("5435"),

  APP_DB_USER: z.string().default("app_user"),
  APP_DB_PASSWORD: z.string().default("app_user_dev_pass"),

  APP_URL: z.string().url().default("http://localhost:3000"),
  APP_DOMAIN: z.string().optional(),

  VAPI_API_KEY: z.string().optional(),
  VAPI_SERVER_CREDENTIAL_ID: z.string().optional(),
  VAPI_WEBHOOK_TOKEN: z.string().optional(),
  VAPI_WEBHOOK_SECRET: z.string().optional(),

  // Cuenta propia de ElevenLabs (opcional). ELEVENLABS_API_KEY solo se usa
  // para crear/rotar la Custom Credential "11labs" en VAPI a mano; el código
  // en producción solo lee ELEVENLABS_CREDENTIAL_ID (el ID de esa credencial
  // ya creada en VAPI). Sin ninguna de las dos, se sigue usando el pool
  // compartido de ElevenLabs de VAPI (comportamiento por defecto).
  ELEVENLABS_API_KEY: z.string().optional(),
  ELEVENLABS_CREDENTIAL_ID: z.string().optional(),

  DEFAULT_TIMEZONE: z.string().default("America/Santo_Domingo"),
  DEFAULT_COUNTRY_CODE: z.string().default("DO"),

  // Landing pública: la oficina (businesses.id) que recibe las solicitudes del formulario web
  // y los orígenes (separados por comas) desde los que el navegador puede llamar a la API.
  // Este clon es de una sola oficina: el registro abierto de cuentas nuevas está APAGADO por defecto.
  // Solo se enciende con ALLOW_SIGNUP=true (por ejemplo, al crear la primera cuenta en local).
  ALLOW_SIGNUP: z.string().default("false"),
  OFICINA_BUSINESS_ID: z.string().uuid().optional(),
  LANDING_ALLOWED_ORIGINS: z.string().default(""),

  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

export const env = envSchema.parse({
  POSTGRES_USER: process.env.POSTGRES_USER,
  POSTGRES_PASSWORD: process.env.POSTGRES_PASSWORD,
  POSTGRES_DB: process.env.POSTGRES_DB,
  DB_HOST: process.env.DB_HOST,
  DB_PORT: process.env.DB_PORT,
  APP_DB_USER: process.env.APP_DB_USER,
  APP_DB_PASSWORD: process.env.APP_DB_PASSWORD,
  APP_URL: process.env.APP_URL,
  APP_DOMAIN: process.env.APP_DOMAIN,
  VAPI_API_KEY: process.env.VAPI_API_KEY,
  VAPI_SERVER_CREDENTIAL_ID: process.env.VAPI_SERVER_CREDENTIAL_ID,
  VAPI_WEBHOOK_TOKEN: process.env.VAPI_WEBHOOK_TOKEN || process.env.VAPI_WEBHOOK_SECRET,
  VAPI_WEBHOOK_SECRET: process.env.VAPI_WEBHOOK_SECRET || process.env.VAPI_WEBHOOK_TOKEN,
  ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY,
  ELEVENLABS_CREDENTIAL_ID: process.env.ELEVENLABS_CREDENTIAL_ID,
  DEFAULT_TIMEZONE: process.env.DEFAULT_TIMEZONE,
  DEFAULT_COUNTRY_CODE: process.env.DEFAULT_COUNTRY_CODE,
  ALLOW_SIGNUP: process.env.ALLOW_SIGNUP,
  OFICINA_BUSINESS_ID: process.env.OFICINA_BUSINESS_ID || undefined,
  LANDING_ALLOWED_ORIGINS: process.env.LANDING_ALLOWED_ORIGINS,
  NODE_ENV: process.env.NODE_ENV,
});

/**
 * Obtiene la cadena de conexión a Postgres para el rol de aplicación (con o sin SSL / Supabase)
 */
export function getAppDatabaseUrl(): string {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }
  const host = process.env.DB_HOST || "localhost";
  const port = process.env.DB_PORT || "5435";
  const user = process.env.APP_DB_USER || "app_user";
  const pass = encodeURIComponent(process.env.APP_DB_PASSWORD || "app_user_dev_pass");
  const db = process.env.POSTGRES_DB || "oficina_jr";
  return `postgres://${user}:${pass}@${host}:${port}/${db}`;
}

/**
 * Obtiene la cadena de conexión directa para migraciones y operaciones de administración
 */
export function getAdminDatabaseUrl(): string {
  if (process.env.DATABASE_DIRECT_URL) {
    return process.env.DATABASE_DIRECT_URL;
  }
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }
  const host = process.env.DB_HOST || "localhost";
  const port = process.env.DB_PORT || "5435";
  const user = process.env.POSTGRES_USER || "oficina_jr";
  const pass = encodeURIComponent(process.env.POSTGRES_PASSWORD || "oficina_jr_dev_pass");
  const db = process.env.POSTGRES_DB || "oficina_jr";
  return `postgres://${user}:${pass}@${host}:${port}/${db}`;
}

/**
 * Construye las opciones de conexión `pg` (connectionString + ssl) para un host en la nube
 * (Supabase, Neon, etc.).
 *
 * node-postgres da prioridad al parámetro `sslmode` de la URL sobre la opción `ssl` explícita
 * (desde pg 8.x, `sslmode=require` se trata como `verify-full` y valida el certificado contra
 * las CA del sistema). Los certificados de Supabase/Neon no siempre validan así, así que
 * quitamos `sslmode` de la URL y controlamos el SSL exclusivamente con la opción `ssl`.
 */
export function toPgConnectionOptions(connectionString: string): {
  connectionString: string;
  ssl?: { rejectUnauthorized: boolean };
} {
  const isCloud = connectionString.includes("supabase.co") ||
    connectionString.includes("pooler.supabase.com") ||
    connectionString.includes("neon.tech") ||
    connectionString.includes("sslmode=require");

  if (!isCloud) {
    return { connectionString };
  }

  const sanitized = connectionString
    .replace(/([?&])sslmode=[^&]*&?/, "$1")
    .replace(/[?&]$/, "");

  return { connectionString: sanitized, ssl: { rejectUnauthorized: false } };
}
