import { describe, it } from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";
import { getEffectivePrompt } from "../lib/vapi/prompt";
import { SHARED_FUNCTION_TOOLS } from "../lib/vapi/tools-definition";
import { LOCALIDADES, TIPOS_SOLICITUD } from "../lib/solicitudes/validation";

describe("Procesamiento de Payloads y Prompt de VAPI", () => {
  it("debe ensamblar el prompt efectivo en español con audiencias y horarios", () => {
    const business: any = {
      name: "Oficina Jacobo Ramos",
      phone: "+18095550100",
      address: "Calle Duarte 10, San Pedro de Macorís",
      timezone: "America/Santo_Domingo",
    };

    const agent: any = {
      tone: "cercano y respetuoso",
      handoffNumber: "+18095550101",
      handoffMessage: "Le paso con alguien del equipo.",
    };

    const hours: any[] = [
      { weekday: 1, opensAt: "09:00:00", closesAt: "17:00:00", isClosed: false },
      { weekday: 0, opensAt: "00:00:00", closesAt: "00:00:00", isClosed: true },
    ];

    const services: any[] = [
      { name: "Audiencia con el equipo legislativo", durationMinutes: 30, priceCents: null, description: "Para presentar una necesidad", isActive: true },
    ];

    const facts: any[] = [
      { question: "¿Cómo puedo hacer una solicitud?", answer: "Por esta llamada o en la Oficina Virtual de la web." },
    ];

    const { prompt, isOverride } = getEffectivePrompt({ business, agent, hours, services, facts });

    assert.equal(isOverride, false);
    assert.match(prompt, /Oficina Jacobo Ramos/);
    assert.match(prompt, /Calle Duarte 10, San Pedro de Macorís/);
    assert.match(prompt, /Audiencia con el equipo legislativo/);
    assert.match(prompt, /Oficina Virtual de la web/);
    assert.match(prompt, /cercano y respetuoso/);
  });

  it("debe dejar la fecha como variable de VAPI (no congelada) y usar pesos dominicanos", () => {
    const { prompt } = getEffectivePrompt({
      business: { name: "Oficina Demo", timezone: "America/Santo_Domingo" } as any,
      agent: { tone: "cercano" } as any,
      hours: [],
      services: [
        { name: "Gestión con costo", durationMinutes: 60, priceCents: 250000, isActive: true },
      ] as any,
      facts: [],
    });

    // VAPI sustituye {{"now" | date: ...}} en cada llamada: el agente siempre sabe el día real
    assert.match(prompt, /\{\{"now" \| date: "[^"]+", "America\/Santo_Domingo"\}\}/);
    // No debe quedar ninguna fecha escrita a mano (ej: "2026") dentro del prompt
    assert.doesNotMatch(prompt, /\b20\d\d\b/);
    // Moneda: pesos dominicanos, nada de euros
    assert.match(prompt, /RD\$2,?500\.00/);
    assert.doesNotMatch(prompt, /€|euros/);
  });

  it("el prompt deja claras las reglas de la oficina (no es el diputado, 911, no prometer resultados)", () => {
    const { prompt } = getEffectivePrompt({
      business: { name: "Oficina Demo", timezone: "America/Santo_Domingo" } as any,
      agent: { tone: "cercano" } as any,
      hours: [],
      services: [],
      facts: [],
    });

    assert.match(prompt, /No eres el diputado/);
    assert.match(prompt, /911/);
    assert.match(prompt, /No prometas que una obra/);
    assert.match(prompt, /No opines de política/);
    // No debe quedar vocabulario del taller heredado
    assert.doesNotMatch(prompt, /taller|matrícula|mecánic|pre-ITV|cambio de aceite/i);
  });

  it("registrarSolicitud no pide el teléfono y usa las mismas listas que el formulario web", () => {
    const tool = SHARED_FUNCTION_TOOLS.find((t) => t.name === "registrarSolicitud");
    assert.ok(tool, "debe existir la herramienta registrarSolicitud");
    assert.equal("telefono" in tool.parameters.properties, false);
    assert.deepEqual(tool.parameters.properties.localidad.enum, [...LOCALIDADES]);
    assert.deepEqual(tool.parameters.properties.tipo.enum, [...TIPOS_SOLICITUD]);
    assert.deepEqual(tool.parameters.required, ["nombre", "localidad", "tipo", "mensaje"]);
  });

  it("ninguna herramienta del agente pide el teléfono del llamante", () => {
    for (const tool of SHARED_FUNCTION_TOOLS) {
      assert.equal("telefono" in tool.parameters.properties, false, `${tool.name} pide teléfono`);
    }
  });

  it("debe validar tokens con timingSafeEqual correctamente", () => {
    const secret = "vapi_secret_token_123456789";
    const headerValid = "Bearer vapi_secret_token_123456789";
    const headerInvalid = "Bearer vapi_wrong_token";

    const verifyToken = (header: string, expected: string): boolean => {
      const provided = header.replace(/^Bearer\s+/i, "");
      if (provided.length !== expected.length) return false;
      return crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
    };

    assert.equal(verifyToken(headerValid, secret), true);
    assert.equal(verifyToken(headerInvalid, secret), false);
  });

  it("debe mapear el rol bot de VAPI a assistant", () => {
    const mapRole = (vapiRole: string): "assistant" | "user" | "tool" | "discard" => {
      if (vapiRole === "bot" || vapiRole === "assistant") return "assistant";
      if (vapiRole === "user") return "user";
      if (vapiRole === "tool" || vapiRole === "tool_calls") return "tool";
      return "discard";
    };

    assert.equal(mapRole("bot"), "assistant");
    assert.equal(mapRole("user"), "user");
    assert.equal(mapRole("tool"), "tool");
    assert.equal(mapRole("system"), "discard");
  });
});
