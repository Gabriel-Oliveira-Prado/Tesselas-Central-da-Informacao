export function trechoDaTela(texto) {
  if (typeof texto !== 'string') return '';
  // O OCR pode unir a manchete a botões de autenticação e comentários.
  const inicio = texto.split(/\s+[\[({]?\s*(?:entrar\s*[\])}]?\s+cadastre-se|cadastre-se)/iu)[0].trim();
  if (inicio.length >= 35 && inicio.length < texto.length) return inicio;
  return texto.trim();
}
