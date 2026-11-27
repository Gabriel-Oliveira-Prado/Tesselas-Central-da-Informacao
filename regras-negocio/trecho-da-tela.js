export function trechoDaTela(texto) {
  if (typeof texto !== 'string') return '';
  // O OCR pode unir a manchete a botões de autenticação e comentários.
  const inicio = texto.split(/\s+[\[({]?\s*(?:entrar\s*[\])}]?\s+cadastre-se|cadastre-se)/iu)[0].trim();
  const trecho = inicio.length >= 35 ? inicio : texto.trim();
  // Uma arte e sua legenda formam blocos separados no OCR. Confira a manchete
  // que será mostrada à pessoa, preservando negação, números e o local.
  const blocos = trecho.split(/\n\s*\n/).map(b => b.trim());
  const primeiro = blocos.findIndex(b => b.length >= 35 && b.split(/\s+/).length >= 6);
  if (primeiro >= 0) {
    const titulo = blocos[primeiro];
    const seguintes = blocos.slice(primeiro + 1);
    if (titulo.length <= 220 && !/[.!?].+\S/.test(titulo) &&
        seguintes.some(b => b.length >= 120) &&
        !seguintes.some(b => /^(?:mas|porém|exceto|salvo|desde que|a menos que|correção|atualização|é falso|não é verdade)\b/iu.test(b))) {
      return titulo;
    }
  }
  return trecho;
}
