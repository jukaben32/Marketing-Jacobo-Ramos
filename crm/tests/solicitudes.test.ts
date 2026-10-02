import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  validateSolicitudInput,
  generateTicket,
  isValidTicket,
  spellTicket,
  LOCALIDADES,
  TIPOS_SOLICITUD,
} from "../lib/solicitudes/validation";

const validInput = {
  nombre: "  Juan Pérez  ",
  telefono: "809-555-0199",
  localidad: "Quisqueya",
  tipo: "Problema comunitario / Asfaltado",
  mensaje: "La calle principal del sector tiene muchos huecos.",
};

describe("Validación de solicitudes ciudadanas", () => {
  it("acepta una solicitud válida y limpia los espacios", () => {
    const result = validateSolicitudInput(validInput);
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.data.nombre, "Juan Pérez");
      assert.equal(result.data.localidad, "Quisqueya");
    }
  });

  it("no modifica el objeto original (inmutabilidad)", () => {
    const copy = { ...validInput };
    validateSolicitudInput(copy);
    assert.deepEqual(copy, validInput);
  });

  it("rechaza un nombre demasiado corto", () => {
    const result = validateSolicitudInput({ ...validInput, nombre: "Jo" });
    assert.equal(result.ok, false);
  });

  it("rechaza un teléfono con letras", () => {
    const result = validateSolicitudInput({ ...validInput, telefono: "llamame ya" });
    assert.equal(result.ok, false);
  });

  it("rechaza una localidad que no está en la lista", () => {
    const result = validateSolicitudInput({ ...validInput, localidad: "Marte" });
    assert.equal(result.ok, false);
  });

  it("rechaza un tipo de solicitud desconocido", () => {
    const result = validateSolicitudInput({ ...validInput, tipo: "otra cosa" });
    assert.equal(result.ok, false);
  });

  it("rechaza mensajes muy cortos o muy largos", () => {
    assert.equal(validateSolicitudInput({ ...validInput, mensaje: "corto" }).ok, false);
    assert.equal(validateSolicitudInput({ ...validInput, mensaje: "x".repeat(1001) }).ok, false);
  });

  it("rechaza entradas que no son objetos", () => {
    assert.equal(validateSolicitudInput(null).ok, false);
    assert.equal(validateSolicitudInput("hola").ok, false);
    assert.equal(validateSolicitudInput(42).ok, false);
  });

  it("rechaza campos que no son texto (evita inyección de objetos)", () => {
    const result = validateSolicitudInput({ ...validInput, nombre: { $ne: "" } });
    assert.equal(result.ok, false);
  });

  it("incluye Consuelo entre las localidades", () => {
    assert.ok((LOCALIDADES as readonly string[]).includes("Consuelo"));
    assert.ok(TIPOS_SOLICITUD.length >= 5);
  });
});

describe("Coherencia entre la landing y el backend", () => {
  const landingPath = path.join(process.cwd(), "..", "landing", "index.html");
  const hasLanding = fs.existsSync(landingPath);

  // Extrae el texto de las <option> de un <select> por su id, sin la opción vacía de "Selecciona..."
  function optionsOf(html: string, selectId: string): string[] {
    const select = html.match(new RegExp(`<select[^>]*id="${selectId}"[^>]*>([\\s\\S]*?)</select>`));
    if (!select) return [];
    return [...select[1].matchAll(/<option(?![^>]*value="")[^>]*>([^<]+)<\/option>/g)].map((m) => m[1].trim());
  }

  it("las localidades del formulario web son las mismas que acepta el servidor", { skip: !hasLanding }, () => {
    const html = fs.readFileSync(landingPath, "utf8");
    assert.deepEqual(optionsOf(html, "citizen-location"), [...LOCALIDADES]);
  });

  it("los tipos de solicitud del formulario web son los mismos que acepta el servidor", { skip: !hasLanding }, () => {
    const html = fs.readFileSync(landingPath, "utf8");
    assert.deepEqual(optionsOf(html, "citizen-type"), [...TIPOS_SOLICITUD]);
  });
});

describe("Tickets de seguimiento", () => {
  it("genera tickets con el formato SPM-AAAA-XXXXXX", () => {
    assert.match(generateTicket(), /^SPM-\d{4}-[0-9A-F]{6}$/);
  });

  it("genera tickets distintos en cada llamada", () => {
    const tickets = new Set(Array.from({ length: 200 }, () => generateTicket()));
    assert.ok(tickets.size > 190);
  });

  it("deletrea el ticket para que el agente de voz lo lea despacio", () => {
    assert.equal(spellTicket("SPM-2026-A1B2C3"), "S P M, 2 0 2 6, A 1, B 2, C 3");
  });

  it("deja intacto un texto que no es un ticket al deletrear", () => {
    assert.equal(spellTicket("otra cosa"), "otra cosa");
  });

  it("valida y rechaza formatos de ticket", () => {
    assert.equal(isValidTicket("SPM-2026-A1B2C3"), true);
    assert.equal(isValidTicket("spm-2026-a1b2c3"), false);
    assert.equal(isValidTicket("SPM-2026-ZZZZZZ"), false);
    assert.equal(isValidTicket("' OR 1=1 --"), false);
    assert.equal(isValidTicket(""), false);
  });
});
