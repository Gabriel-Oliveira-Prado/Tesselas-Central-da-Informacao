// Evita a fila assíncrona de canvas.toBlob em painéis em segundo plano.
export function frameBytes(canvas,type = 'image/png',quality) {
  const encoded = canvas.toDataURL(type,quality).split(',')[1];
  return Uint8Array.from(atob(encoded),char=>char.charCodeAt(0));
}
