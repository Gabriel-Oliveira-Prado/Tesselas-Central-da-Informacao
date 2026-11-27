import test from 'node:test';
import assert from 'node:assert/strict';
import { compararComGemini, compararComNovaTentativa, planejarConsultas } from '../scripts/gemini.mjs';
import { searchPlan } from '../regras-negocio/fontes-pesquisa.js';

const base = 'Flávio Bolsonaro perde para Lula na seção eleitoral em que vota';
const trecho = 'A seção de votação de Flávio Bolsonaro fica no Rio de Janeiro. Lula recebeu mais votos nessa seção.';
const fontes = [{titulo:base+' no Rio de Janeiro', trechos:[trecho]}];
for (const [texto, tipo] of [[base+' no Rio de Janeiro','true'],[base+' em sao paulo','context'],['Lula ganhou em uma seção eleitoral, mas não se sabe de quem era a seção.','unknown']]) {
  test('contrato do Gemini com resposta simulada: '+tipo, async()=>{
    const enviar = async (url, options)=>{
      assert.equal(new URL(url).hostname,'generativelanguage.googleapis.com');
      const carga=JSON.parse(options.body);
      const entrada = JSON.parse(carga.contents[0].parts[0].text);
      assert.equal(entrada.afirmacao,texto);
      assert.equal(entrada.passagens[0].texto,trecho);
      const resultado={tipo:{true:'coincide',context:'detalhe_trocado',unknown:'insuficiente'}[tipo],passagem:'F0P0',ancora:'Rio de Janeiro',explicacao:'Explicação de teste.'};
      return Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(resultado)}]}}]});
    };
    const dado=await compararComGemini(texto,fontes,{chave:'teste',enviar});
    assert.equal(dado.status,tipo==='unknown'?'sem-evidencia':'comparado');
    if (tipo!=='unknown') assert.equal(dado.tipo,tipo);
  });
}
test('pesquisa também pelo fato sem a localização alterada e recusa citação inexistente',async()=>{
  assert.ok(searchPlan(base+' em sao paulo').queries.includes(base));
  const resposta={tipo:'coincide',fonte:0,explicacao:'Teste',trecho:'Uma frase inventada que não existe no texto da reportagem.'};
  const enviar=async()=>Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(resposta)}]}}]});
  assert.equal((await compararComGemini(base,fontes,{chave:'teste',enviar})).status,'sem-evidencia');
  assert.equal((await compararComGemini(base,fontes,{chave:'teste',enviar:async()=>new Response(null,{status:429})})).status,'quota');
});

test('resposta a pergunta aberta exige passagem e âncora encontradas na fonte', async () => {
  const pergunta = 'Qual foi o local citado pela reportagem?';
  for (const [ancora, status] of [['Rio de Janeiro','comparado'],['Outro local','sem-evidencia']]) {
    const conteudo = {tipo:'resposta', passagem:'F0P0', ancora, explicacao:'A reportagem cita o Rio de Janeiro.'};
    const enviar = async () => Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(conteudo)}]}}]});
    const resultado = await compararComGemini(pergunta, fontes, {chave:'teste', enviar});
    assert.equal(resultado.status, status);
    if (status === 'comparado') assert.equal(resultado.tipo, 'answer');
  }
});

test('planejamento aceita buscas distintas e remove endereços, contatos e repetições', async () => {
  const lista = ['Feira do livro', 'https://exemplo.com', 'Feira do livro', 'E-mail a@exemplo.com', 'Data da feira', 'outra consulta'];
  const enviar = async () => Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(lista)}]}}]});
  const {consultas} = await planejarConsultas('Quando foi a feira do livro?', {chave:'teste', enviar});
  assert.deepEqual(consultas, ['Feira do livro','Data da feira']);
});

test('falha temporária permite uma nova tentativa e a cota encerra a consulta', async () => {
  let chamadas = 0;
  const enviar = async () => new Response(null,{status:++chamadas === 1 ? 503 : 429});
  const resultado = await compararComNovaTentativa(base, fontes, {chave:'teste', signal:new AbortController().signal, enviar});
  assert.equal(chamadas, 2);
  assert.equal(resultado.status, 'quota');
});
