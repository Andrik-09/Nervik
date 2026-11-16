// Gemelo digital de un dispositivo Nervik: genera llaves, firma mensajes y lleva
// el contador y la cadena de hashes igual que el firmware del RP2040 (firmware/).
import { generateKeyPairSync, createPrivateKey, createPublicKey, sign, createHash } from 'node:crypto';

const CERO = '0'.repeat(64);

export class Dispositivo {
  constructor({ id, unidad, corredor, llavePrivadaPem }) {
    this.id = id;
    this.unidad = unidad;
    this.corredor = corredor;
    if (llavePrivadaPem) {
      this.privada = createPrivateKey(llavePrivadaPem);
    } else {
      const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
      this.privada = privateKey;
    }
    this.contador = 0;
    this.hashPrev = CERO;
  }

  get llavePublicaPem() {
    return createPublicKey(this.privada).export({ type: 'spki', format: 'pem' }).toString();
  }

  get llavePrivadaPem() {
    return this.privada.export({ type: 'pkcs8', format: 'pem' }).toString();
  }

  // Devuelve el sobre listo para enviar. `extra` se mezcla en el payload.
  sobre(tipo, extra) {
    this.contador += 1;
    const datos = { dispositivo: this.id, tipo, contador: this.contador, ts: new Date().toISOString(), ...extra };
    if (tipo === 'evento') datos.hash_prev = this.hashPrev;
    const bytes = Buffer.from(JSON.stringify(datos), 'utf8');
    const firma = sign('sha256', bytes, { key: this.privada, dsaEncoding: 'ieee-p1363' });
    if (tipo === 'evento') this.hashPrev = createHash('sha256').update(bytes).digest('hex');
    return { dispositivo: this.id, payload: bytes.toString('base64'), firma: firma.toString('base64') };
  }
}
