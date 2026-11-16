// Verifica con el código de la API lo que firmó la implementación en C del firmware.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { leerCodigoAlta, verificarSobre } from '../../../api/src/cripto.js';
const pruebas = ['{"a":1}', 'x'.repeat(55), 'y'.repeat(56), 'z'.repeat(64), 'w'.repeat(119), undefined];
let ok = 0;
for (const p of pruebas) {
  const r = JSON.parse(execFileSync('/tmp/prueba_cripto', p === undefined ? [] : [p]).toString());
  const { pem } = leerCodigoAlta(r.codigo);
  const bytes = Buffer.from(r.sobre.payload, 'base64');
  const shaNode = createHash('sha256').update(bytes).digest('hex');
  const v = verificarSobre(r.sobre, pem);
  const firmaOk = p === undefined || p.startsWith('{') ? v.ok : true; // los no-JSON fallan al parsear, la firma se revisa abajo
  const { verify } = await import('node:crypto');
  const cruda = verify('sha256', bytes, { key: pem, dsaEncoding: 'ieee-p1363' }, Buffer.from(r.sobre.firma, 'base64'));
  const bien = shaNode === r.sha && cruda && firmaOk;
  console.log(`${bien ? 'OK ' : 'MAL'} payload de ${bytes.length} bytes · sha ${shaNode === r.sha ? 'igual' : 'DISTINTO'} · firma ${cruda ? 'válida' : 'INVÁLIDA'}`);
  ok += bien;
}
if (ok !== pruebas.length) process.exit(1);
