const locais = {
  br: 'Brasil · Presidência', ac: 'Acre', al: 'Alagoas', ap: 'Amapá', am: 'Amazonas',
  ba: 'Bahia', ce: 'Ceará', df: 'Distrito Federal', es: 'Espírito Santo', go: 'Goiás',
  ma: 'Maranhão', mt: 'Mato Grosso', ms: 'Mato Grosso do Sul', mg: 'Minas Gerais',
  pa: 'Pará', pb: 'Paraíba', pr: 'Paraná', pe: 'Pernambuco', pi: 'Piauí',
  rj: 'Rio de Janeiro', rn: 'Rio Grande do Norte', rs: 'Rio Grande do Sul',
  ro: 'Rondônia', rr: 'Roraima', sc: 'Santa Catarina', sp: 'São Paulo', se: 'Sergipe', to: 'Tocantins',
};
const local = document.getElementById('local-apuracao');
const disputa = document.getElementById('disputa');
const lista = document.getElementById('candidaturas');
const mais = document.getElementById('mais-candidaturas');
const resumo = document.getElementById('resumo-apuracao');
let disputas = [];
let revisao = 0;
for (const [uf, nome] of Object.entries(locais)) local.add(new Option(nome, uf));

function mostrarPagina(ampliar = false) {
  const atual = disputas[disputa.selectedIndex];
  if (!atual) return;
  if (!ampliar) lista.replaceChildren();
  const inicio = lista.children.length;
  for (const pessoa of atual.candidatos.slice(inicio, inicio + 10)) {
    const item = document.createElement('li');
    const nome = document.createElement('strong');
    nome.textContent = pessoa.nome + ' · ' + pessoa.partido;
    const detalhe = document.createElement('div');
    detalhe.textContent = atual.cargo + ' · ' + pessoa.situacao + ' · ' + pessoa.percentual + '%';
    item.tabIndex = 0;
    item.append(nome, ' ', detalhe);
    lista.append(item);
  }
  if (ampliar) lista.children[inicio]?.focus();
  mais.hidden = lista.children.length >= atual.candidatos.length;
  resumo.textContent = 'Apuração do TSE de ' + atual.data + ' às ' + atual.hora + '. ' +
    lista.children.length + ' de ' + atual.candidatos.length + ' candidaturas.';
}

export async function carregarApuracao() {
  const id = ++revisao;
  resumo.textContent = 'Carregando candidaturas…';
  lista.replaceChildren();
  disputa.replaceChildren();
  disputa.disabled = true;
  mais.hidden = true;
  try {
    const resposta = await fetch(new URL('../regras-negocio/apuracao-2026/' + local.value + '.json', import.meta.url));
    if (!resposta.ok) throw new Error();
    const dados = await resposta.json();
    if (id !== revisao) return;
    disputas = dados;
    for (const item of disputas) disputa.add(new Option(item.cargo + ' · ' + item.turno + 'º turno'));
    disputa.disabled = false;
    mostrarPagina();
  } catch {
    if (id === revisao) resumo.textContent = 'Não foi possível abrir a apuração. Escolha o estado novamente para tentar outra vez.';
  }
}

local.addEventListener('change', carregarApuracao);
disputa.addEventListener('change', () => mostrarPagina());
mais.addEventListener('click', () => mostrarPagina(true));
