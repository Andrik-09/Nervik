// Verificación de mensajes firmados por el dispositivo.
//
// Cada mensaje llega como sobre:
//   { "dispositivo": "NVK-0001", "payload": "<base64 de los bytes JSON>", "firma": "<base64 r||s>" }
//
// Se firma el payload tal cual (bytes), así el firmware en C no necesita reproducir
// una serialización JSON canónica: el servidor verifica exactamente lo que el equipo firmó.
// Algoritmo: ECDSA P-256 + SHA-256 (soportado por mbedTLS en el ESP32-S3 y por WebCrypto
// en el navegador, para que una aseguradora pueda verificar sin confiar en nuestro servidor).
import { createPublicKey, createHash, verify } from 'node:crypto';

export function sha256hex(buf) {
  return createHash('sha256').update(buf).digest('hex');
}

export function validarLlavePublica(pem) {
  const k = createPublicKey(pem);
  if (k.asymmetricKeyType !== 'ec' || k.asymmetricKeyDetails?.namedCurve !== 'prime256v1') {
    throw new Error('La llave debe ser ECDSA P-256 (prime256v1)');
  }
  return k.export({ type: 'spki', format: 'pem' }).toString();
}

export function verificarSobre(sobre, llavePem) {
  if (!sobre || typeof sobre.payload !== 'string' || typeof sobre.firma !== 'string') {
    return { ok: false, motivo: 'Sobre incompleto' };
  }
  const bytes = Buffer.from(sobre.payload, 'base64');
  const firma = Buffer.from(sobre.firma, 'base64');
  let valida = false;
  try {
    valida = verify('sha256', bytes, { key: llavePem, dsaEncoding: 'ieee-p1363' }, firma);
  } catch {
    valida = false;
  }
  if (!valida) return { ok: false, motivo: 'Firma inválida' };
  let datos;
  try {
    datos = JSON.parse(bytes.toString('utf8'));
  } catch {
    return { ok: false, motivo: 'Payload no es JSON' };
  }
  return { ok: true, datos, hash: sha256hex(bytes) };
}
