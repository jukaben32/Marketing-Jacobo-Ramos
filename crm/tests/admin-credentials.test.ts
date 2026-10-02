import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validateAdminEmail, validateAdminPassword } from "../scripts/admin-credentials";

describe("Validación de las credenciales del administrador", () => {
  it("acepta un correo y una contraseña reales", () => {
    assert.equal(validateAdminEmail("direccion@oficinajr.do"), null);
    assert.equal(validateAdminPassword("Kz7#mP2vQ9xL-4tRw"), null);
  });

  it("rechaza el correo de ejemplo del README", () => {
    assert.notEqual(validateAdminEmail("tu@correo.com"), null);
    assert.notEqual(validateAdminEmail("admin@prueba.local"), null);
  });

  it("rechaza correos con marcadores o sin formato", () => {
    assert.notEqual(validateAdminEmail("<tu correo real>"), null);
    assert.notEqual(validateAdminEmail("sin-arroba"), null);
    assert.notEqual(validateAdminEmail(undefined), null);
    assert.notEqual(validateAdminEmail(""), null);
  });

  it("rechaza la contraseña de ejemplo que se pegó por error en el chat", () => {
    assert.notEqual(validateAdminPassword("tu-contraseña-de-12-o-más-caracteres"), null);
  });

  it("rechaza marcadores entre < > aunque midan más de 12 caracteres", () => {
    assert.notEqual(validateAdminPassword("<contraseña nueva de 12+ caracteres>"), null);
  });

  it("rechaza contraseñas cortas o ausentes", () => {
    assert.notEqual(validateAdminPassword("corta123"), null);
    assert.notEqual(validateAdminPassword(undefined), null);
  });

  it("el modo temporal acepta 8 caracteres pero sigue rechazando los ejemplos", () => {
    assert.notEqual(validateAdminPassword("Ab3$xy9!"), null); // normal: exige 12
    assert.equal(validateAdminPassword("Ab3$xy9!", { temporary: true }), null);
    assert.notEqual(validateAdminPassword("Ab3$xy", { temporary: true }), null); // 6 < 8
    assert.notEqual(validateAdminPassword("tu-contraseña-de-12-o-más-caracteres", { temporary: true }), null);
    assert.notEqual(validateAdminPassword("<contraseña>", { temporary: true }), null);
  });

  it("rechaza contraseñas obvias aunque midan 12 o más", () => {
    assert.notEqual(validateAdminPassword("aaaaaaaaaaaaaaaa"), null);
    assert.notEqual(validateAdminPassword("123456789012345"), null);
    assert.notEqual(validateAdminPassword("passwordpassword"), null);
    assert.notEqual(validateAdminPassword("Contrasena-De-Prueba-2026"), null);
  });
});
