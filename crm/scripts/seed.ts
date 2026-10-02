import bcrypt from "bcryptjs";
import pg from "pg";
import { getAdminDatabaseUrl, toPgConnectionOptions } from "../lib/env";
import { validateAdminEmail, validateAdminPassword } from "./admin-credentials";

const { Client } = pg;

const BCRYPT_ROUNDS = 12;

// Datos iniciales de la oficina. TODO(cliente): confirmar horarios, audiencias y preguntas con la oficina.
const OFFICE = {
  name: "Oficina Jacobo Ramos",
  slug: "oficina-jacobo-ramos",
  timezone: "America/Santo_Domingo",
  address: "San Pedro de Macorís, República Dominicana",
};

const SERVICES = [
  {
    name: "Audiencia con el equipo legislativo",
    duration: 30,
    desc: "Reunión para presentar una necesidad o propuesta de la comunidad.",
  },
  {
    name: "Reunión con juntas de vecinos y dirigentes comunitarios",
    duration: 45,
    desc: "Encuentro para coordinar gestiones de un sector o comunidad.",
  },
  {
    name: "Orientación sobre una solicitud",
    duration: 20,
    desc: "Explicación del estado y los próximos pasos de una solicitud ya registrada.",
  },
];

const FACTS = [
  {
    q: "¿Cómo puedo hacer una solicitud?",
    a: "Puede hacerla por esta llamada o en la Oficina Virtual de la página web. En ambos casos recibe un número de ticket para darle seguimiento.",
  },
  {
    q: "¿Qué pasa después de registrar mi solicitud?",
    a: "El equipo de la oficina la evalúa y la canaliza. Con su número de ticket puede consultar el estado en la página web.",
  },
  {
    q: "¿Qué tipos de solicitudes atienden?",
    a: "Problemas comunitarios como calles y aceras, salud y asistencia médica, propuestas de ley, deporte e instalaciones, y otras consultas legislativas.",
  },
];

/** Lee las credenciales del administrador desde variables de entorno (nunca se dejan escritas en el código). */
function readAdminCredentials(): { email: string; password: string; fullName: string } {
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  const fullName = process.env.SEED_ADMIN_NAME?.trim() || "Administrador de la oficina";

  // Rechaza también los ejemplos de la documentación (ver scripts/admin-credentials.ts)
  const emailError = validateAdminEmail(email);
  if (emailError) throw new Error(`SEED_ADMIN_EMAIL: ${emailError}`);
  const passwordError = validateAdminPassword(password);
  if (passwordError) throw new Error(`SEED_ADMIN_PASSWORD: ${passwordError}`);

  return { email: email as string, password: password as string, fullName };
}

async function seed() {
  console.log("🌱 Iniciando semillero de la Oficina Jacobo Ramos (pnpm db:seed)...");
  const admin = readAdminCredentials();
  const client = new Client(toPgConnectionOptions(getAdminDatabaseUrl()));
  await client.connect();

  try {
    await client.query("BEGIN");

    const { rows: existingUser } = await client.query("SELECT id FROM users WHERE email = $1", [admin.email]);
    if (existingUser.length > 0) {
      console.log(`ℹ️ El usuario ${admin.email} ya existe. Omitiendo semillero.`);
      await client.query("ROLLBACK");
      return;
    }

    console.log(`👤 Creando administrador: ${admin.email}`);
    const passwordHash = await bcrypt.hash(admin.password, BCRYPT_ROUNDS);
    const { rows: userRows } = await client.query<{ id: string }>(
      `INSERT INTO users (email, password_hash, full_name) VALUES ($1, $2, $3) RETURNING id`,
      [admin.email, passwordHash, admin.fullName]
    );
    const userId = userRows[0].id;

    console.log(`🏢 Creando oficina: ${OFFICE.name}...`);
    // El ID se genera primero y el inquilino se fija ANTES de insertar: así el semillero funciona
    // tanto con el rol administrador como con el rol restringido app_user (RLS forzado).
    const { rows: idRows } = await client.query<{ id: string }>("SELECT uuidv7() AS id");
    const businessId = idRows[0].id;
    await client.query("SELECT set_config('app.business_id', $1, true)", [businessId]);

    await client.query(
      `INSERT INTO businesses (id, name, slug, timezone, address) VALUES ($1, $2, $3, $4, $5)`,
      [businessId, OFFICE.name, OFFICE.slug, OFFICE.timezone, OFFICE.address]
    );

    await client.query(`INSERT INTO memberships (user_id, business_id, role) VALUES ($1, $2, 'owner')`, [
      userId,
      businessId,
    ]);

    console.log("🤖 Configurando recepcionista de voz...");
    // El prompt completo se compone con los datos reales al pulsar "Provisionar Asistente" en el panel.
    await client.query(
      `INSERT INTO voice_agents (
         business_id, system_prompt, first_message, tone,
         voice_provider, voice_id, voice_model, voice_language, language,
         model, transcriber, handoff_message,
         slot_capacity, min_notice_minutes, booking_horizon_days
       ) VALUES (
         $1, $2, $3, 'cercano y respetuoso',
         '11labs', 'UOIqAnmS11Reiei1Ytkc', 'eleven_flash_v2_5', 'es', 'es',
         '{"provider":"openai","model":"gpt-4.1-mini"}'::jsonb,
         '{"provider":"deepgram","model":"nova-3-general","language":"es"}'::jsonb,
         'Le paso con alguien del equipo de la oficina, un segundo.',
         1, 60, 14
       )`,
      [
        businessId,
        "Prompt pendiente de provisionar desde el panel (Conexiones).",
        `${OFFICE.name}, buenas. Soy el asistente virtual, ¿en qué le puedo ayudar?`,
      ]
    );

    console.log("🕒 Creando horarios (borrador: lunes a viernes)...");
    for (let weekday = 1; weekday <= 5; weekday++) {
      await client.query(
        `INSERT INTO business_hours (business_id, weekday, opens_at, closes_at, is_closed)
         VALUES ($1, $2, '09:00:00', '13:00:00', false),
                ($1, $2, '14:00:00', '17:00:00', false)`,
        [businessId, weekday]
      );
    }

    console.log("🗂️ Creando audiencias y gestiones...");
    for (let i = 0; i < SERVICES.length; i++) {
      const s = SERVICES[i];
      await client.query(
        `INSERT INTO services (business_id, name, duration_minutes, price_cents, description, is_active, sort_order)
         VALUES ($1, $2, $3, NULL, $4, true, $5)`,
        [businessId, s.name, s.duration, s.desc, i + 1]
      );
    }

    console.log("❓ Añadiendo preguntas frecuentes...");
    for (let i = 0; i < FACTS.length; i++) {
      await client.query(
        `INSERT INTO business_facts (business_id, question, answer, sort_order) VALUES ($1, $2, $3, $4)`,
        [businessId, FACTS[i].q, FACTS[i].a, i + 1]
      );
    }

    await client.query("COMMIT");
    console.log("✨ ¡Semillero completado con éxito!");
    console.log(`   - Administrador: ${admin.email}`);
    console.log(`   - OFICINA_BUSINESS_ID=${businessId}`);
    console.log("   Copia esa línea en tu .env: la landing la usa para saber a qué oficina enviar las solicitudes.");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Error durante el semillero:", err);
    throw err;
  } finally {
    await client.end();
  }
}

seed().catch((err) => {
  console.error("Fatal seed error:", err instanceof Error ? err.message : err);
  process.exit(1);
});
