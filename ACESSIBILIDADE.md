# Acessibilidade — Central da Informação 0.4

Referências: **ABNT NBR 17225:2025** e **WCAG 2.2**, com foco nos requisitos A e AA. Este documento registra decisões e pendências; não substitui o checklist integral da norma e não constitui declaração de conformidade.

## Decisões por seção temática da norma

| Seção | Aplicação nesta versão |
| --- | --- |
| Interação por teclado | Controles nativos, ordem de foco do documento, link para pular ao conteúdo e ausência de armadilhas. |
| Imagens | O logotipo tem nome acessível no link de início. Os quatro ícones decorativos acompanham rótulos visíveis. SVGs dos cards ocultos da árvore assistiva por aria-hidden. |
| Cabeçalhos | Um h1 visível por tela; cada opção abre uma seção nomeada e oculta as demais. A página explicativa usa h2 para suas seções. |
| Regiões | Header, main e footer; seções nomeadas e grupo com os quatro botões iniciais. |
| Listas | Fontes adicionais em lista semântica. |
| Tabelas | Não há tabelas na interface da extensão. |
| Links e navegação | Links descritivos, aviso de nova aba, retorno ao painel e destino externo explícito. |
| Botões e controles | Cards são botões nativos com ícones e nomes visíveis; alvos de pelo menos 44 px na escala padrão. |
| Formulários e entrada | Labels explícitos, instruções associadas, erro textual, aria-invalid e foco no campo inválido. |
| Apresentação | Layout fluido, ampliação até 200%, zoom nativo e conteúdo reorganizado em largura estreita. |
| Uso de cores | Status sempre escrito, contraste nos temas padrão e alto contraste e suporte a cores forçadas. |
| Conteúdo textual | Quatro ações na tela inicial, detalhes recolhidos no resultado, português brasileiro, frases diretas e resultados com fonte. Sem notas numéricas de confiança. |
| Codificação e marcação semântica | HTML nativo; ARIA usado para mensagens, agrupamentos e associações necessárias. |
| Áudio e vídeo | Voz somente por acionamento, com pausa, retomada e parada; texto sempre disponível. A captura usa um quadro de vídeo sem áudio e sem reprodução visual no painel. |
| Animação | Sem animação, flashes ou movimento automático; preferência de movimento reduzido respeitada. |
| Tempo | Sem contagem regressiva, expiração de formulários ou avisos que desaparecem automaticamente. |

Os quatro ícones medem 56 px CSS na escala inicial. O card inteiro recebe o clique. A área de acionamento toma como referência os itens 5.8.6 e 5.8.7 da ABNT NBR 17225, conforme o [mapeamento do Ceweb.br](https://todosnaweb.ceweb.br/publicacoes/wcag-2-2-abnt-17225). A cartilha Acessibilidade na Web, fascículo VI, página 64, orientou o uso de parágrafos de pelo menos 16 px e entrelinha de 1,5 ou mais. O tamanho de 56 px do ícone é uma escolha do projeto.

## Comportamentos de foco e mensagens

- O primeiro Tab revela o link Pular para o conteúdo; Enter leva ao main.
- Erros de entrada preservam o texto e levam o foco ao campo.
- Abrir uma opção leva o foco ao título correspondente; Voltar devolve o foco ao card que iniciou o fluxo.
- Analisar tela abre o seletor de compartilhamento do navegador. Após autorizar, o painel captura uma imagem, encerra o compartilhamento e leva o foco ao título do resultado. Erros de captura oferecem a opção de colar texto.
- Editar uma informação descarta o resultado anterior. Navegar durante uma captura impede que sua conclusão tardia troque a tela ou roube o foco.
- A leitura em voz alta transfere foco para Pausar; Parar devolve o foco para Ouvir.
- Mensagens de estado ficam em uma região com anúncio educado; não há anúncio a cada tecla.
- Abrir Ouvir conteúdo não inicia áudio automaticamente. O botão Ouvir é necessário; a voz inclui o texto e a explicação disponível da fonte.
- A checagem se refere à afirmação indicada, não à página inteira; ausência de correspondência produz Sem conclusão.

## Verificações automatizadas

O comando `npm test` inclui avaliação axe-core na tela inicial, formulário com erro, resultado com fonte, ajustes em alto contraste, áudio e página explicativa; teclado, retorno do foco, layout a 320 px com texto a 200%, interação de áudio simulada, cancelamento de capturas antigas ao navegar e proteção de áreas editáveis. Os resultados efetivos da execução devem ser consultados no terminal; a mera existência dos testes não comprova aprovação.

O teste de integração carrega a extensão em um perfil temporário do Chromium, reproduz a ação da barra via protocolo de depuração e verifica o acesso temporário, a criação do painel nativo e a captura real de texto. A interação com o documento do painel ocorre em uma aba de teste: a superfície nativa do painel não é exposta como Page pelo Playwright. A avaliação manual dessa superfície permanece pendente.

## Validação manual pendente

- Uso completo com NVDA e Chrome; leitura de rótulos, ordem, erros, estados e fontes.
- Teste do atalho e entrada/saída do painel lateral na interface nativa do navegador.
- Zoom real do navegador a 200% e 400%, espaçamento de texto personalizado e Windows em alto contraste.
- Voz real em português: disponibilidade, pronúncia, textos longos, pausa e recuperação após erro.
- Testes com pessoas cegas, com baixa visão, deficiência motora e diferentes necessidades cognitivas; registrar barreiras e correções.
- Revisão integral dos requisitos aplicáveis da ABNT NBR 17225:2025, incluindo conteúdo de terceiros e páginas de destino.

Uma extensão não garante a acessibilidade de sites externos. Os ajustes desta versão atuam no próprio painel. A página explicativa oferece texto ampliável pelo zoom nativo; as preferências do painel não são aplicadas automaticamente a outras abas.
