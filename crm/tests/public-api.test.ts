import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createRateLimiter } from "../lib/solicitudes/rate-limit";
import { corsHeaders, parseAllowedOrigins, getClientIp } from "../lib/solicitudes/cors";

describe("Límite de envíos por IP", () => {
  it("permite hasta el máximo y bloquea el siguiente intento", () => {
    const limiter = createRateLimiter({ max: 3, windowMs: 1000 });
    assert.equal(limiter.check("1.1.1.1", 0), true);
    assert.equal(limiter.check("1.1.1.1", 10), true);
    assert.equal(limiter.check("1.1.1.1", 20), true);
    assert.equal(limiter.check("1.1.1.1", 30), false);
  });

  it("no mezcla direcciones distintas", () => {
    const limiter = createRateLimiter({ max: 1, windowMs: 1000 });
    assert.equal(limiter.check("1.1.1.1", 0), true);
    assert.equal(limiter.check("2.2.2.2", 0), true);
    assert.equal(limiter.check("1.1.1.1", 1), false);
  });

  it("vuelve a permitir cuando termina la ventana de tiempo", () => {
    const limiter = createRateLimiter({ max: 1, windowMs: 1000 });
    assert.equal(limiter.check("1.1.1.1", 0), true);
    assert.equal(limiter.check("1.1.1.1", 500), false);
    assert.equal(limiter.check("1.1.1.1", 1001), true);
  });

  it("limpia entradas vencidas para no crecer sin límite", () => {
    const limiter = createRateLimiter({ max: 1, windowMs: 1000 });
    for (let i = 0; i < 50; i++) limiter.check(`10.0.0.${i}`, 0);
    limiter.check("9.9.9.9", 5000);
    assert.ok(limiter.size() <= 2);
  });
});

describe("CORS de la API pública", () => {
  const allowed = parseAllowedOrigins(" http://localhost:8000 , https://jacoboramos.do ,, ");

  it("separa y limpia la lista de orígenes", () => {
    assert.deepEqual(allowed, ["http://localhost:8000", "https://jacoboramos.do"]);
    assert.deepEqual(parseAllowedOrigins(""), []);
  });

  it("devuelve cabeceras solo para orígenes permitidos", () => {
    const headers = corsHeaders("https://jacoboramos.do", allowed);
    assert.equal(headers["Access-Control-Allow-Origin"], "https://jacoboramos.do");
    assert.equal(headers["Vary"], "Origin");
  });

  it("no devuelve cabeceras para orígenes desconocidos ni sin origen", () => {
    assert.deepEqual(corsHeaders("https://malo.example", allowed), {});
    assert.deepEqual(corsHeaders(null, allowed), {});
  });

  it("nunca usa comodín", () => {
    const headers = corsHeaders("https://jacoboramos.do", allowed);
    assert.notEqual(headers["Access-Control-Allow-Origin"], "*");
  });
});

describe("IP del cliente", () => {
  it("toma la primera IP de x-forwarded-for", () => {
    assert.equal(getClientIp("203.0.113.5, 10.0.0.1"), "203.0.113.5");
  });

  it("usa 'unknown' si no hay cabecera", () => {
    assert.equal(getClientIp(null), "unknown");
  });
});
