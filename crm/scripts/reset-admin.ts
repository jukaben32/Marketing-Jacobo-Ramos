/**
 * Cambia el correo y/o la contraseña de un administrador y cierra todas sus sesiones.
 *
 * Uso (PowerShell, dentro de la carpeta crm; las contraseñas se escriben en TU terminal):
 *   $env:ADMIN_CURRENT_EMAIL = "<correo con el que se creó>"
 *   $env:ADMIN_NEW_EMAIL     = "<tu correo real>"          # opcional: si no, se conserva el actual
 *   $env:ADMIN_NEW_PASSWORD  = "<contraseña nueva>"
 *   pnpm admin:reset
 *
 * Modo bloqueo (deja una contraseña aleatoria que nadie conoce; no imprime nada secreto):
 *   $env:ADMIN_CURRENT_EMAIL = "<correo>"; pnpm admin:reset --lock
 */
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import pg from "pg";
import { getAdminDatabaseUrl, toPgConnectionOptions } from "../lib/env";
import { validateAdminEmail, validateAdminPassword } from "./admin-credentials";

const { Client } = pg;
const BCRYPT_ROUNDS = 12;
const RANDOM_PASSWORD_BYTES = 24;

function fail(message: string): never {
  console.error(`✖ ${message}`);
  process.exit(1);
}

async function main(): Promise<void> {
  const lock = process.argv.includes("--lock");
  const currentEmail = process.env.ADMIN_CURRENT_EMAIL?.trim().toLowerCase();
  if (!currentEmail) fail("Define ADMIN_CURRENT_EMAIL con el correo actual de la cuenta.");

  const newEmail = (process.env.ADMIN_NEW_EMAIL?.trim().toLowerCase() || currentEmail) as string;
  let newPassword = process.env.ADMIN_NEW_PASSWORD;

  if (lock) {
    // Contraseña aleatoria que se descarta: la cuenta queda inutilizable hasta el siguiente cambio
    newPassword = crypto.randomBytes(RANDOM_PASSWORD_BYTES).toString("base64url");
  } else {
    // ALLOW_TEMPORARY_PASSWORD=yes permite una contraseña corta (mínimo 8) solo mientras el panel corre en local
    const temporary = process.env.ALLOW_TEMPORARY_PASSWORD === "yes";
    const passwordError = validateAdminPassword(newPassword, { temporary });
    if (passwordError) fail(passwordError);
    if (temporary) {
      console.warn("⚠️ Contraseña TEMPORAL y débil: cámbiala con `pnpm admin:reset` antes de desplegar o publicar el panel.");
    }
    // Si se cambia el correo, el nuevo no puede ser un ejemplo; si se conserva, no se valida (puede ser el antiguo)
    if (newEmail !== currentEmail) {
      const emailError = validateAdminEmail(newEmail);
      if (emailError) fail(emailError);
    }
  }

  const passwordHash = await bcrypt.hash(newPassword as string, BCRYPT_ROUNDS);
  const client = new Client(toPgConnectionOptions(getAdminDatabaseUrl()));
  await client.connect();
  try {
    await client.query("BEGIN");

    const { rows } = await client.query<{ id: string }>("SELECT id FROM users WHERE email = $1", [currentEmail]);
    if (rows.length === 0) {
      await client.query("ROLLBACK");
      fail(`No existe ningún usuario con el correo ${currentEmail}.`);
    }
    const userId = rows[0].id;

    if (newEmail !== currentEmail) {
      const { rows: taken } = await client.query("SELECT 1 FROM users WHERE email = $1", [newEmail]);
      if (taken.length > 0) {
        await client.query("ROLLBACK");
        fail(`Ya existe otra cuenta con el correo ${newEmail}.`);
      }
    }

    await client.query("UPDATE users SET email = $1, password_hash = $2 WHERE id = $3", [newEmail, passwordHash, userId]);
    const { rowCount } = await client.query("DELETE FROM sessions WHERE user_id = $1", [userId]);
    await client.query("COMMIT");

    console.log(lock ? "✔ Cuenta bloqueada con una contraseña aleatoria que nadie conoce." : "✔ Credenciales actualizadas.");
    console.log(`  Correo de la cuenta: ${newEmail}`);
    console.log(`  Sesiones cerradas: ${rowCount ?? 0}`);
  } catch (err) {
    try { await client.query("ROLLBACK"); } catch { /* conexión ya cerrada */ }
    throw err;
  } finally {
    await client.end();
  }
}

main().catch((err) => fail(err instanceof Error ? err.message : String(err)));
