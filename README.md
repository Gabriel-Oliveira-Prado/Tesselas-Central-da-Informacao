<p align="center"><img src="web/assets/logotipo.svg" width="258" alt="Logotipo da Central da Informação"></p>

# Central da Informação

**Versão 0.9.1** · Site e extensão para Chrome de computador.

A Central da Informação acompanha a área de tela que você escolher, reconhece texto em português e mostra a afirmação checada, a explicação e a fonte. O acompanhamento ocorre no dispositivo e dispensa conta, chave de API e gravação.

<p align="center"><img src="docs/inicio.png" width="320" height="549" alt="Painel inicial com cinco botões e acompanhamento da tela ativado."> <img src="docs/checagem.png" width="320" height="549" alt="Resultado com a condição para votar depois das 17h e a fonte do Tribunal Superior Eleitoral."></p>

## Executar o site

Com Node.js 20 ou posterior, execute `npm start` e abra o endereço impresso no terminal. A interface web funciona sem instalar a extensão. Compartilhamento de tela e áudio depende das opções oferecidas pelo navegador. Em celulares, os cards ficam empilhados e os campos e arquivos continuam disponíveis.

## Preparar a extensão

Execute `npm run build`. No Chrome, abra `chrome://extensions`, ative Modo do desenvolvedor e escolha Carregar sem compactação. Selecione `dist/extensao`. O ícone abre o painel lateral.

## Organização

- `web/` contém a interface compartilhada, os recursos locais, a captura, os controles de áudio e o tradutor.
- `extensao/` contém o manifesto e o serviço do Chrome.
- `regras-negocio/` contém validação, checagens, pesquisa e fontes.
- `scripts/` contém o servidor local, a atualização editorial e o empacotamento.
- `tests/` contém testes de regras, navegação, mídia e fuzzing.
- `dist/site` e `dist/extensao` são gerados pelo mesmo código. Alterações devem ser feitas nos arquivos-fonte.

O site em atualização online usa o servidor de `npm start`. O pacote estático mantém a edição de notícias incluída quando as fontes online estão indisponíveis.

## Primeira consulta

Escolha **Colar informação** e cole a frase de teste “A urna eletrônica é conectada à internet durante a votação.” Clique em **Pesquisar informação**. O painel encontra a checagem, explica que a urna funciona desconectada durante a votação e oferece o link da Justiça Eleitoral.

Em **Analisar tela**, escolha a aba ou a tela. Para incluir voz, marque o áudio no seletor do navegador. O painel mostra o trecho e o contexto e oferece **Encerrar acompanhamento**. Na aba autorizada, um selo informa se a Central lê a tela e escuta áudio. Outras superfícies usam o indicador nativo do navegador.

## Experimentar sem instalar

Requer Node.js 20 ou mais recente.

```sh
npm start
```

Abra http://127.0.0.1:4173/web/index.html no Chrome ou Edge de computador. Para testar com um vídeo que muda de assunto, abra http://127.0.0.1:4173/demo/acompanhamento.html em outra aba. Compartilhe essa aba com a Central e reproduza o vídeo.

## Os cinco cards

- **Analisar tela** usa reconhecimento de texto, comparação com duas artes conhecidas e transcrição em português. O reconhecimento de objetos inicia automaticamente nos computadores que disponibilizam o modelo do Chrome. Ao encerrar, os trechos e suas fontes ficam na tela Resultados do acompanhamento. O navegador pode precisar baixá-lo.
- **Colar informação** recebe texto ou um link do g1, Agência Brasil, TSE, Justiça Eleitoral ou Aos Fatos. O card de arquivos aceita áudio, vídeo e legendas SRT ou VTT. Confira o texto reconhecido antes de verificar.
- **Ouvir conteúdo** recebe arquivo, microfone ou som da aba. Ao escolher o microfone, você também pode dizer “abrir eleições”, “abrir acessibilidade”, “colar informação” ou “voltar ao início”. A leitura em voz alta tem velocidade, pausa e parada, com destaque de palavra quando a voz do navegador informa os marcadores de leitura.
- **Acessibilidade** permite ampliar até 200%, aumentar o espaçamento, usar cores suaves, alternar a paleta para daltonismo, ativar avisos falados e consultar o VLibras. A fonte Atkinson Hyperlegible Next acompanha a extensão.

- **Eleições** abre os serviços oficiais e até três manchetes por fonte, com data e link. O painel consulta as listagens públicas do TSE e da Agência Brasil. Na extensão instalada, use **Atualizar notícias** para autorizar essas duas origens. Sem conexão, a seleção incluída na versão continua disponível. Para renovar essa seleção antes de distribuir uma versão, execute `node scripts/atualizar-edicao.mjs` com as dependências e o Chromium do Playwright instalados.

Todos os cards são botões nativos com ícone decorativo e nome visível. Teclado, foco, zoom e mensagens de estado permanecem disponíveis. A revisão do texto, as buscas adicionais e a consulta pontual em Libras têm telas próprias. Os números 1 a 5 abrem os cards. O botão de informação em cada card explica sua função. Ao navegar por Tab, a voz opcional lê o foco.

**Fontes de contexto.** A Central combina sete checagens editoriais com as publicações do g1 Fato ou Fake e da Agência Brasil. A atualização lê seus feeds públicos. Uma edição incluída funciona offline. Uma afirmação revisada ou correspondente ao enunciado de uma checagem explícita pode receber um veredito. Matérias relacionadas apresentam o contexto e o link da publicação.

Cada checagem inclui sua data de consulta. A edição de novembro de 2026 cobre voto pelo celular, conexão da urna, celular na cabine, identificação pelo e-Título, título impresso um vídeo de 2018 recirculado em 2022 e a regra da fila às 17h. As referências ficam em `regras-negocio/checagens.js`.

As três fontes iniciais são [urna e internet](https://www.justicaeleitoral.jus.br/fato-ou-boato/checagens/2026/fato-ou-boato-inteligencia-artificial-nao-pode-mudar-o-voto-do-eleitor-na-urna), [voto pela internet](https://www.justicaeleitoral.jus.br/fato-ou-boato/checagens/2026/e-falso-que-eleitores-possam-votar-on-line-pelo-celular-em-caso-de-chuva-no-brasil-votacao-e-sempre-presencial) e [celular na cabine](https://www.tse.jus.br/comunicacao/noticias/2026/Setembro/manual-do-eleitor-uso-de-celular-e-proibido-na-cabine-de-votacao). Isso ainda não constitui um serviço geral de checagem.

## Libras

Em Acessibilidade, marque **Ativar Libras em todas as telas** para usar o widget no site e na extensão. O ajuste fica salvo. A tradução precisa de conexão e envia ao VLibras o texto selecionado. Em um resultado, a consulta pontual também permanece disponível. Na versão web, o botão **Ativar VLibras nesta página** carrega o widget oficial em uma página separada. Na extensão instalada, o link abre a ferramenta hospedada pelo VLibras. A consulta inicia quando a pessoa escolhe o texto no serviço. A checagem eleitoral continua local.

O VLibras é gratuito. A API comercial Hand Talk for Devs requer uma chave contratada. A página de planos do plugin para sites anuncia tradução em Libras a partir do plano Light. [VLibras](https://www.gov.br/governodigital/pt-br/acessibilidade-e-usuario/vlibras) · [Configuração do SDK Hand Talk](https://api-docs.handtalk.me/v1/javascript/reference/explain-configs) · [Planos do plugin Hand Talk](https://www.handtalk.me/br/planos/)

## Privacidade e permissões

O manifesto autoriza consultas aos portais do g1 e da Agência Brasil. Para links dos outros portais aceitos, a extensão pode pedir acesso à origem. O seletor de tela e o microfone exigem autorização do navegador. A transcrição usa o Vosk local e o modelo de português incluído. O texto, os arquivos e as capturas não são enviados na atualização das notícias.

O texto fica na memória do painel; recarregá-lo apaga o conteúdo. Apenas os ajustes de leitura são armazenados localmente. A consulta à base é local e não envia o texto para checagem externa. Ao abrir uma busca adicional, o trecho visível no campo correspondente é enviado ao Google. Os links informam abertura de nova aba. Vozes podem usar serviços do navegador/sistema; vozes locais em português são priorizadas quando disponíveis.

A imagem pode conter qualquer dado visível na área escolhida. O fluxo alternativo que lê o documento da aba exclui campos de formulário e conteúdo oculto. Ambos mantêm o texto apenas na memória do painel.

O motor Tesseract.js, o worker, o núcleo WebAssembly e os dados de português acompanham a extensão. O reconhecimento dispensa servidor externo, conta e chave de IA. Os pacotes de origem estão fixados no arquivo de dependências. As licenças acompanham os arquivos em `web/vendor/ocr`.

## Acessibilidade

ABNT NBR 17225:2025 e WCAG 2.2 orientam o desenvolvimento. Consulte [ACESSIBILIDADE.md](ACESSIBILIDADE.md) para o mapeamento, verificações e pendências. Não há declaração de conformidade integral ou certificação. A página **Como funciona e privacidade**, incluída na extensão, explica os limites em linguagem simples.

## Verificação técnica

```sh
npm ci
npx playwright install chromium
npm test
```

Os testes exercitam os cinco cards, teclado e retorno do foco, erros, contraste, ampliação, áudio simulado, cancelamento de capturas antigas ao navegar, exclusão de campos privados, ausência de envio automático, persistência mínima, correspondências conservadoras e captura real da extensão em um perfil isolado. A avaliação automática usa axe-core e não substitui leitores de tela nem testes com pessoas.

`npm start` não exige instalar pacotes. As dependências são apenas de desenvolvimento. Os ícones já estão incluídos; para regenerá-los, execute `node scripts/gerar-icones.mjs` com as dependências de desenvolvimento e o Chromium do Playwright instalados.

## Próxima etapa possível

Ampliar e manter a base de checagens ou conectar um serviço de busca com fonte, data e revisão humana. Um serviço de IA poderá ajudar a extrair afirmações ou localizar checagens; a conclusão precisará de evidências rastreáveis e opção de resultado inconclusivo. Nenhuma credencial deve ser colocada dentro de uma extensão distribuída.

## Referências

- [Ceweb.br — acessibilidade e ABNT NBR 17225](https://ceweb.br/acessibilidade/)
- [IFRS — apresentação da ABNT NBR 17225:2025](https://cta.ifrs.edu.br/abnt-nbr-17225-2025-acessibilidade-em-conteudo-e-aplicacoes-web-requisitos/)
- [W3C — WCAG 2.2](https://www.w3.org/TR/WCAG22/)
- [Chrome — acesso temporário à aba](https://developer.chrome.com/docs/extensions/develop/concepts/activeTab)
- [Chrome — painel lateral](https://developer.chrome.com/docs/extensions/reference/api/sidePanel)
- [Fato ou Boato](https://www.justicaeleitoral.jus.br/fato-ou-boato/)
- [Aos Fatos](https://www.aosfatos.org/)
