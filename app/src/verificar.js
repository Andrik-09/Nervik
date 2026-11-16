// Verificación independiente de un expediente en el navegador (WebCrypto).
// No depende del servidor: con el sobre y la llave pública del dispositivo,
// cualquiera (por ejemplo, el ajustador de la aseguradora) puede comprobar la firma.
const b64aBytes = b64 => Uint8Array.from(atob(b64), c => c.charCodeAt(0));

function pemABytes(pem) {
  const cuerpo = pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  return b64aBytes(cuerpo);
}

export async function verificarExpediente(sobre, llavePem) {
  const bytes = b64aBytes(sobre.payload);
  const firma = b64aBytes(sobre.firma);
  const llave = await crypto.subtle.importKey('spki', pemABytes(llavePem), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
  const firmaValida = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, llave, firma, bytes);
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  const hash = [...digest].map(b => b.toString(16).padStart(2, '0')).join('');
  return { firmaValida, hash };
}
