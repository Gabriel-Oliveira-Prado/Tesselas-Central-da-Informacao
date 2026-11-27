export const fonteHorario = {
  name: 'TSE · Horário da votação no Brasil',
  url: 'https://www.tse.jus.br/comunicacao/noticias/2026/Setembro/faltam-26-dias-votacao-comeca-e-termina-no-mesmo-horario-em-todo-o-pais',
};

function simplificar(texto) {
  return texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

export function assuntoHorario(texto) {
  const frase = simplificar(texto);
  return /\b(?:votar|votacao|urna|secao eleitoral)\b/.test(frase) &&
    /\b(?:horario|horas?|fila|manha|tarde|noite|abre|fecha|encerra)\b|\b\d{1,2}(?:\s*(?:horas?|h)\b|h\d{2}\b|:\d{2}\b)/.test(frase);
}

export function respostaHorario(texto) {
  const frase = simplificar(texto).replace(/[?!.]+$/, '').trim();
  if (!assuntoHorario(frase) && !/\bas \d{1,2}$/.test(frase)) return;
  const horario = /^(?:(?:eu )?(?:posso|pode|consigo|da (?:pra|para)|e possivel) )?votar (?:de |as |a |pelas? )?(\d{1,2}|oito|vinte)(?:(?:h|:)(\d{2})|\s*(?:horas?|h))?(?: (?:da|a|de) (noite|tarde|manha))?$/.exec(frase);
  if (!horario) return;
  let hora = Number(({ oito: 8, vinte: 20 })[horario[1]] ?? horario[1]);
  const minuto = Number(horario[2] || 0);
  if (hora > 23 || minuto > 59) return;
  if (hora < 12 && ['noite','tarde'].includes(horario[3])) hora += 12;
  const depois = hora * 60 + minuto > 17 * 60;
  const resposta = depois ? 'Se você chegar nesse horário, a fila já estará fechada. Quem estava na fila às 17h recebe senha e ainda pode votar.' :
    hora < 8 ? 'Nesse horário a votação ainda não começou.' : 'Sim, esse horário está dentro do período de votação.';
  return { id:'horario-votacao-' + hora + '-' + minuto, kind:'answer', claim:texto.trim(),
    finding:'Horário informado pelo TSE', explanation:resposta + ' Nas eleições de 2026 no Brasil, a votação vai das 8h às 17h, pelo horário de Brasília.',
    topic:'horário da votação', url:fonteHorario.url, source:fonteHorario.name, consultedAt:'2026-11-27' };
}
