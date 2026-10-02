/**
 * Configura la base de datos de un proyecto de Supabase usando la Management API
 * (no hace falta la contraseña del rol postgres).
 *
 * Uso (PowerShell):
 *   $env:SUPABASE_ACCESS_TOKEN = "sbp_..."        # solo para esta ventana; no se guarda en ningún archivo
 *   $env:SUPABASE_PROJECT_REF  = "<ref del proyecto>"
 *   pnpm supabase:info      # muestra el proyecto y cuántas tablas tiene
 *   pnpm supabase:init      # extensiones + rol app_user (contraseña fuerte) + escribe DATABASE_URL en .env
 *   pnpm supabase:migrate   # aplica db/migrations/*.sql pendientes y los registra en schema_migrations
 *
 * Seguridad: el token y la contraseña de app_user nunca se imprimen ni se escriben en el repositorio.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const API_BASE = "https://api.supabase.com";
const PASSWORD_PLACEHOLDER = "__APP_USER_PASSWORD__";
const PASSWORD_BYTES = 24;
const SAFE_MIGRATION_NAME = /^[A-Za-z0-9_.-]+\.sql$/;

// Huellas SHA-256 (no los identificadores en claro) de proyectos que este script se niega a tocar:
// producción del CRM del taller (cliente real). Se pueden añadir más con SUPABASE_FORBIDDEN_REFS.
const DEFAULT_FORBIDDEN_REF_HASHES = ["89c17a5ef30ee1995f296ffc27095deb0323d2c3cd87d78912a65c720e93bbf2"];

const token = process.env.SUPABASE_ACCESS_TOKEN;
const ref = process.env.SUPABASE_PROJECT_REF;
const root = process.cwd();

function fail(message: string): never {
  console.error(`✖ ${message}`);
  process.exit(1);
}

function assertConfigured(): { token: string; ref: string } {
  if (!token) fail("Falta SUPABASE_ACCESS_TOKEN (defínelo solo en esta ventana de PowerShell).");
  if (!ref || !/^[a-z0-9]{20}$/.test(ref)) fail("Falta SUPABASE_PROJECT_REF o no tiene el formato de un ref de Supabase.");

  const forbidden = (process.env.SUPABASE_FORBIDDEN_REFS ?? "").split(",").map((r) => r.trim());
  const refHash = crypto.createHash("sha256").update(ref).digest("hex");
  if (DEFAULT_FORBIDDEN_REF_HASHES.includes(refHash) || forbidden.includes(ref)) {
    fail(`El proyecto ${ref} está protegido: es de producción de otro cliente. No se toca.`);
  }
  return { token, ref };
}

/** Quita secretos de un texto antes de mostrarlo (por si Supabase repite la consulta en un error). */
function redact(text: string, secrets: string[]): string {
  return secrets.filter(Boolean).reduce((acc, secret) => acc.split(secret).join("***"), text);
}

async function api<T>(method: "GET" | "POST", apiPath: string, body?: unknown, secrets: string[] = []): Promise<T> {
  const { token: t } = assertConfigured();
  const res = await fetch(`${API_BASE}${apiPath}`, {
    method,
    headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    fail(`Supabase respondió ${res.status}: ${redact(text, [t, ...secrets]).slice(0, 400)}`);
  }
  return (text ? JSON.parse(text) : null) as T;
}

async function runSql<T = Record<string, unknown>>(sql: string, secrets: string[] = []): Promise<T[]> {
  const { ref: r } = assertConfigured();
  const result = await api<T[]>("POST", `/v1/projects/${r}/database/query`, { query: sql }, secrets);
  return Array.isArray(result) ? result : [];
}

async function showProject(): Promise<void> {
  const { ref: r } = assertConfigured();
  const project = await api<{ name: string; region: string; status: string; database: { version: string } }>(
    "GET",
    `/v1/projects/${r}`
  );
  const [{ tablas }] = await runSql<{ tablas: number }>(
    "SELECT count(1)::int AS tablas FROM information_schema.tables WHERE table_schema = 'public'"
  );
  console.log(`Proyecto: ${project.name} (${r})`);
  console.log(`Región: ${project.region} · Estado: ${project.status} · Postgres ${project.database.version}`);
  console.log(`Tablas en el esquema public: ${tablas}`);
}

/** Pone o reemplaza KEY=valor en el .env sin imprimir el valor. */
function upsertEnv(key: string, value: string): void {
  const envPath = path.join(root, ".env");
  const current = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
  const lines = current.split(/\r?\n/);
  const index = lines.findIndex((line) => line.startsWith(`${key}=`));
  const next = `${key}=${value}`;
  if (index >= 0) lines[index] = next;
  else lines.push(next);
  fs.writeFileSync(envPath, `${lines.filter((l, i) => l !== "" || i < lines.length - 1).join("\n")}\n`, { encoding: "utf8", mode: 0o600 });
}

function warnIfEnvNotIgnored(): void {
  const gitignore = path.join(root, ".gitignore");
  const content = fs.existsSync(gitignore) ? fs.readFileSync(gitignore, "utf8") : "";
  if (!/^\.env\*?$/m.test(content) && !/^\.env$/m.test(content)) {
    console.warn("⚠️ .env no aparece en .gitignore: añádelo antes de subir nada a Git.");
  }
}

async function init(rotate: boolean): Promise<void> {
  const { ref: r } = assertConfigured();
  await showProject();

  const [{ existe }] = await runSql<{ existe: boolean }>(
    "SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') AS existe"
  );
  if (existe && !rotate) {
    fail("El rol app_user ya existe. Para cambiar su contraseña usa: pnpm supabase:init --rotate-password");
  }

  const password = crypto.randomBytes(PASSWORD_BYTES).toString("base64url");
  const template = fs.readFileSync(path.join(root, "db", "init", "supabase-init.sql"), "utf8");
  await runSql(template.split(PASSWORD_PLACEHOLDER).join(password), [password]);
  console.log("✔ Extensiones y rol app_user listos.");

  const poolers = await api<Array<{ database_type: string; db_host: string; db_port: number; db_name: string }>>(
    "GET",
    `/v1/projects/${r}/config/database/pooler`
  );
  const pooler = poolers.find((p) => p.database_type === "PRIMARY") ?? poolers[0];
  if (!pooler) fail("No se encontró la dirección del pooler del proyecto.");

  upsertEnv("DATABASE_URL", `postgresql://app_user.${r}:${password}@${pooler.db_host}:${pooler.db_port}/${pooler.db_name}`);
  console.log("✔ DATABASE_URL escrita en .env (la contraseña no se muestra aquí).");
  warnIfEnvNotIgnored();
}

async function migrate(): Promise<void> {
  assertConfigured();
  await showProject();
  await runSql(`CREATE TABLE IF NOT EXISTS schema_migrations (
    id serial PRIMARY KEY,
    name text NOT NULL UNIQUE,
    applied_at timestamptz NOT NULL DEFAULT now()
  )`);

  const applied = new Set((await runSql<{ name: string }>("SELECT name FROM schema_migrations")).map((r) => r.name));
  const dir = path.join(root, "db", "migrations");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();

  let count = 0;
  for (const file of files) {
    if (!SAFE_MIGRATION_NAME.test(file)) fail(`Nombre de migración no permitido: ${file}`);
    if (applied.has(file)) {
      console.log(`⏩ Ya aplicada: ${file}`);
      continue;
    }
    console.log(`▶️ Aplicando: ${file}...`);
    // Una sola consulta con varias sentencias: Postgres la ejecuta como una transacción (todo o nada)
    const sql = `${fs.readFileSync(path.join(dir, file), "utf8")}\nINSERT INTO schema_migrations (name) VALUES ('${file}');`;
    await runSql(sql);
    console.log(`✅ Aplicada: ${file}`);
    count++;
  }
  console.log(count === 0 ? "No había migraciones pendientes." : `🎉 ${count} migración(es) aplicada(s).`);
}

async function main(): Promise<void> {
  const [command, ...flags] = process.argv.slice(2);
  switch (command) {
    case "info":
      return showProject();
    case "init":
      return init(flags.includes("--rotate-password"));
    case "migrate":
      return migrate();
    default:
      fail("Uso: supabase-provision.ts info | init [--rotate-password] | migrate");
  }
}

main().catch((err) => fail(err instanceof Error ? err.message : String(err)));
