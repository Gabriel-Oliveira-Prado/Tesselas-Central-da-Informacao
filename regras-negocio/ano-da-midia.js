const unidades = ['um','dois','três','quatro','cinco','seis','sete','oito','nove'];
const anosFalados = new Map([['dois mil', '2000']]);
const pequenos = [...unidades,'dez','onze','doze','treze','quatorze','quinze','dezesseis','dezessete','dezoito','dezenove'];
pequenos.forEach((nome,i) => anosFalados.set('dois mil e ' + nome, String(2001+i)));
for (const [i, dezena] of ['vinte','trinta','quarenta','cinquenta','sessenta','setenta','oitenta','noventa'].entries()) {
  const ano = 2020 + i*10;
  anosFalados.set('dois mil e ' + dezena, String(ano));
  unidades.forEach((nome,j) => anosFalados.set('dois mil e ' + dezena + ' e ' + nome, String(ano+j+1)));
}
const falados = new RegExp('\\b(?:' + [...anosFalados.keys()].sort((a,b)=>b.length-a.length).join('|') + ')\\b', 'gu');

function separarAno(frase) {
  const normal = frase.toLocaleLowerCase('pt-BR').replace(/\s+/g,' ').replace(falados, s=>anosFalados.get(s))
    .normalize('NFD').replace(/\p{M}/gu,'').replace(/[,.:;!?“”"]/g,' ').replace(/\s+/g,' ').trim();
  const anos = normal.match(/\b(?:19|20)\d{2}\b/g);
  if (anos?.length !== 1 || !/\b(?:video|foto|imagens|gravacao)\b/.test(normal)) return;
  const data = /\b(?:em|no ano de) (?:19|20)\d{2}\b/.exec(normal);
  if (!data) return;
  // Uma data no início também pode qualificar a mesma manchete.
  // Dentro da frase, preserve a posição: o ano pode qualificar outro verbo.
  const naBorda = data.index === 0 || data.index + data[0].length === normal.length;
  const evento = normal.replace(data[0], naBorda ? '' : '@ano').trim()
    .replace(/^(?:e verdade que )?(?:o |a |as )?(?=(?:video|foto|imagens|gravacao)\b)/, '');
  return { evento, ano: anos[0] };
}

export function compararAnoDaMidia(texto, mancheteConfirmada) {
  const original = separarAno(mancheteConfirmada);
  if (!original) return;
  // Uma quebra visual no OCR não separa frases. Mantemos qualificadores e negações.
  let resultado;
  for (const frase of texto.split(/[.!?]+|\n\s*\n/u)) {
    const entrada = separarAno(frase);
    if (entrada?.evento !== original.evento) continue;
    if (resultado && resultado.informado !== entrada.ano) return { ambiguo: true };
    resultado = { informado: entrada.ano, confirmado: original.ano };
  }
  return resultado;
}
