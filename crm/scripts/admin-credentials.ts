/**
 * Validación de las credenciales del administrador (semillero y cambio de contraseña).
 * Rechaza a propósito los ejemplos del README y de los chats: ya pasó una vez que alguien
 * ejecutó el ejemplo tal cual y la cuenta real quedó con una contraseña pública.
 */

const MIN_PASSWORD_LENGTH = 12;
const EMAIL_REGEX = /^[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+$/;

// Textos que aparecen en ejemplos de la documentación o en pruebas
const EXAMPLE_EMAILS = ["tu@correo.com", "admin@prueba.local", "correo@ejemplo.com", "ejemplo@ejemplo.com"];
const EXAMPLE_PASSWORD_MARKERS = [
  "tu-contraseña",
  "tu contraseña",
  "tu-contrasena",
  "contraseña-de-",
  "contrasena-de-prueba",
  "contraseña nueva",
];
const OBVIOUS_PASSWORD_MARKERS = ["password", "qwerty", "123456", "abcdef", "admin1234"];

export function validateAdminEmail(email: string | undefined): string | null {
  const value = email?.trim().toLowerCase() ?? "";
  if (!value) return "Define el correo del administrador.";
  if (!EMAIL_REGEX.test(value)) return "El correo no tiene un formato válido (¿dejaste un marcador como <tu correo>?).";
  if (EXAMPLE_EMAILS.includes(value)) return "Ese correo es un ejemplo de la documentación: usa tu correo real.";
  return null;
}

// Modo temporal (solo `admin:reset` con ALLOW_TEMPORARY_PASSWORD=yes): para usar una contraseña
// corta mientras el panel solo corre en local. Los ejemplos de la documentación se siguen rechazando.
const MIN_TEMPORARY_PASSWORD_LENGTH = 8;

export interface PasswordOptions {
  temporary?: boolean;
}

export function validateAdminPassword(password: string | undefined, options: PasswordOptions = {}): string | null {
  const minLength = options.temporary ? MIN_TEMPORARY_PASSWORD_LENGTH : MIN_PASSWORD_LENGTH;
  if (!password) return "Define la contraseña del administrador.";
  if (password.length < minLength) return `La contraseña debe tener al menos ${minLength} caracteres.`;

  const lower = password.toLowerCase();
  if (lower.includes("<") || lower.includes(">")) {
    return "La contraseña contiene < o >: parece un marcador de ejemplo, no una contraseña real.";
  }
  if (EXAMPLE_PASSWORD_MARKERS.some((marker) => lower.includes(marker))) {
    return "Esa contraseña es un ejemplo de la documentación (y es pública): inventa una propia.";
  }
  if (new Set(password).size <= 2) return "La contraseña es demasiado repetitiva.";
  if (!options.temporary && OBVIOUS_PASSWORD_MARKERS.some((marker) => lower.includes(marker))) {
    return "La contraseña es demasiado obvia: evita palabras como password o secuencias como 123456.";
  }
  return null;
}
