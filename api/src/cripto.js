// Verificación de mensajes firmados por el dispositivo.
//
// Cada mensaje llega como sobre:
//   { "dispositivo": "NVK-0001", "payload": "<base64 de los bytes JSON>", "firma": "<base64 r||s>" }
//
// Se firma el payload tal cual (bytes), así el firmware en C no necesita reproducir
// una serialización JSON canónica: el servidor verifica exactamente lo que el equipo firmó.
// Algoritmo: ECDSA P-256 + SHA-256 (micro-ecc en el RP2040 del dispositivo y WebCrypto
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

// Código de alta que imprime el firmware (y su QR):  NVK1:<serie>:<base64 de X||Y, 64 bytes>
// Se convierte a PEM SPKI anteponiendo el encabezado DER fijo de una llave P-256 sin comprimir.
const PREFIJO_SPKI_P256 = Buffer.from('3059301306072a8648ce3d020106082a8648ce3d03010703420004', 'hex');
export function leerCodigoAlta(codigo) {
  const m = /^NVK1:(NVK-[0-9A-Z]{4,}):([A-Za-z0-9+/=]+)$/.exec(String(codigo || '').trim());
  if (!m) throw new Error('Código de alta inválido (se espera NVK1:NVK-XXXX:...)');
  const xy = Buffer.from(m[2], 'base64');
  if (xy.length !== 64) throw new Error('La llave del código de alta debe medir 64 bytes');
  const der = Buffer.concat([PREFIJO_SPKI_P256, xy]);
  const pem = `-----BEGIN PUBLIC KEY-----\n${der.toString('base64').match(/.{1,64}/g).join('\n')}\n-----END PUBLIC KEY-----\n`;
  return { id: m[1], pem };
}
