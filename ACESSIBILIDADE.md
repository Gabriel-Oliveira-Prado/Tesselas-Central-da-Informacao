# Acessibilidade — Central da Informação

Referências: **ABNT NBR 17225:2025** e **WCAG 2.2**, com foco nos requisitos A e AA. Este documento registra decisões e pendências; não substitui o checklist integral da norma e não constitui declaração de conformidade.

## Decisões por seção temática da norma

| Seção | Aplicação nesta versão |
| --- | --- |
| Interação por teclado | Controles nativos, ordem de foco do documento, link para pular ao conteúdo e ausência de armadilhas. |
| Imagens | O logotipo tem nome acessível no link de início. Os cinco ícones decorativos acompanham rótulos visíveis. SVGs dos cards ocultos da árvore assistiva por aria-hidden. |
| Cabeçalhos | Um h1 visível por tela; cada opção abre uma seção nomeada e oculta as demais. A página explicativa usa h2 para suas seções. |
| Regiões | Header, main e footer; seções nomeadas e grupo com os cinco botões iniciais. |
| Listas | Fontes adicionais em lista semântica. |
| Tabelas | Não há tabelas na interface da extensão. |
| Links e navegação | Links descritivos, aviso de nova aba, retorno ao painel e destino externo explícito. |
| Botões e controles | Cards são botões nativos com ícones e nomes visíveis; alvos de pelo menos 44 px na escala padrão. |
| Formulários e entrada | Labels explícitos, instruções associadas, erro textual, aria-invalid e foco no campo inválido. |
| Apresentação | Layout fluido, ampliação até 400%, zoom nativo e conteúdo reorganizado em largura estreita. |
| Uso de cores | Status sempre escrito, contraste nos temas padrão e alto contraste e suporte a cores forçadas. |
| Conteúdo textual | Fonte Atkinson Hyperlegible Next, trechos em português e explicações com fonte. A revisão de texto, as buscas adicionais e a consulta em Libras têm telas próprias. |
| Codificação e marcação semântica | HTML nativo; ARIA usado para mensagens, agrupamentos e associações necessárias. |
| Áudio e vídeo | Arquivo de som, vídeo, microfone e som da aba podem gerar transcrição local. A Central aceita SRT e VTT e mantém a leitura em voz alta. A demonstração inclui descrição escrita e controles nativos. |
| Animação | Indicador suave de pesquisa, sem flashes. Redução de movimento pelo sistema e por controle persistido nas configurações. |
| Tempo | Sem contagem regressiva, expiração de formulários ou avisos que desaparecem automaticamente. |

Na versão 0.19.0, **Sobre** abre um diálogo com explicação escrita e falada conforme a preferência de leitura. Escape e **Fechar** devolvem o foco ao botão do cabeçalho. **Voz da leitura** oferece amostras de Dora e Alex. O guia da extensão apresenta instruções por escrito e um vídeo com narração, legendas em português e controles nativos.

Os cinco ícones medem 56 px CSS na escala inicial. O card inteiro recebe o clique. A área de acionamento toma como referência os itens 5.8.6 e 5.8.7 da ABNT NBR 17225, conforme o [mapeamento do Ceweb.br](https://todosnaweb.ceweb.br/publicacoes/wcag-2-2-abnt-17225). A cartilha Acessibilidade na Web, fascículo VI, página 64, orientou o uso de parágrafos de pelo menos 16 px e entrelinha de 1,5 ou mais. O tamanho de 56 px do ícone é uma escolha do projeto.

## Comportamentos de foco e mensagens

- O primeiro Tab revela o link Pular para o conteúdo; Enter leva ao main.
- Erros de entrada preservam o texto e levam o foco ao campo.
- Abrir uma opção leva o foco ao título correspondente; Voltar devolve o foco ao card que iniciou o fluxo.
- Analisar tela abre o seletor do navegador e leva o foco ao título após a autorização. O modo contínuo informa os resultados por região de estado. Encerrar acompanhamento libera a captura. Voltar encerra a sessão e devolve o foco ao card. O modo de quadro único permanece disponível.
- Editar uma informação descarta o resultado anterior. Navegar durante uma captura impede que sua conclusão tardia troque a tela ou roube o foco.
- A leitura em voz alta transfere foco para Pausar; Parar devolve o foco para Ouvir.
- Mensagens de estado ficam em uma região com anúncio educado; não há anúncio a cada tecla.
- Abrir Ouvir conteúdo não inicia áudio automaticamente. O botão Ouvir é necessário; a voz inclui o texto e a explicação disponível da fonte.
- A checagem se refere à afirmação indicada, não à página inteira. A conclusão aparece primeiro como Falso ou Verdadeiro, com o contexto explicado em seguida. Sem evidência suficiente, informa Não verificado.

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

Uma extensão não garante a acessibilidade de sites externos. Os ajustes desta versão atuam no próprio painel. A página Sobre e privacidade também usa as preferências de leitura do painel.

## Revisão de 26 de novembro de 2026

| Barreira observada | Mudança e verificação |
| --- | --- |
| Perder o tamanho de letra ao procurar ajuda | A página Sobre e privacidade recebe os mesmos ajustes de tamanho, contraste e espaçamento do painel. O teste abre a página em 320 px com texto a 200% e verifica a atualização com ambas as abas abertas. |
| Links indistinguíveis na lista do leitor de tela | Cada link identifica o tema da fonte. Cada afirmação tem um título navegável. A troca de tela atualiza o título da janela e leva o foco ao conteúdo. |
| Depender de ouvir a narração ou capturar uma legenda no instante certo | A pessoa pode abrir um arquivo de legenda SRT ou WebVTT em UTF-8, selecionar a fala pelo horário e revisar seu texto. O painel consulta a base só depois de Pesquisar informação. O recurso depende de uma legenda existente. |
| Precisar lembrar o resultado enquanto se procura a leitura em voz alta | Ouvir resultado parte da checagem. Voltar retorna ao botão. A fala pode ser pausada, retomada ou interrompida e sua versão escrita inclui a conclusão e a fonte, quando disponível. |
| Dificuldade para distinguir ou acionar um ícone | Cada card tem um nome visível que também é seu nome acessível. Os testes verificam o alvo de 44 × 44 px CSS ou maior, contraste de texto de pelo menos 7:1 e contraste do ícone de pelo menos 3:1 nos cinco cards dos dois temas. |

A revisão usou a correspondência entre a ABNT NBR 17225 e a WCAG para foco (5.1.1 e 5.1.4), propósito dos links (5.7.3 e 5.7.4), áreas de acionamento (5.8.6 e 5.8.7) e texto redimensionado (5.12.7). Para mídia publicada pelo projeto, verificar equivalência e sincronização das legendas e descrição das informações visuais relevantes. A ferramenta de consulta a arquivos de legenda tem outra finalidade. [Mapeamento do Ceweb.br](https://todosnaweb.ceweb.br/publicacoes/wcag-2-2-abnt-17225) · [Transcrições segundo o W3C](https://www.w3.org/WAI/media/av/transcripts/)

O artigo 63 da Lei Brasileira de Inclusão trata de sites mantidos por empresas com sede ou representação comercial no Brasil ou por órgãos de governo. O enquadramento de uma implantação depende de quem a oferece e de como é publicada. [Lei 13.146/2015, artigo 63](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2015/lei/l13146.htm#art63)

### Roteiro para avaliação com pessoas

Ofereça uma mensagem fictícia e um vídeo de exemplo com legenda revisada. Convide pessoas com diferentes experiências de visão, audição, mobilidade e leitura a usar seus próprios recursos e ajustes. Combine previamente o formato da sessão, as pausas e o que poderá ser registrado. [Avaliação com pessoas com deficiência, W3C](https://www.w3.org/WAI/test-evaluate/involving-users/)

1. Peça à pessoa para conferir a mensagem pela forma que preferir. Observe se encontra a fonte e consegue explicar a que trecho o resultado se refere.
2. Peça que consulte uma fala do vídeo usando a legenda e que encontre a mesma informação em texto após a leitura por voz.
3. Peça que amplie o texto, abra a página de privacidade e volte à consulta. Verifique se consegue localizar a leitura novamente e identificar o foco.
4. Registre a tarefa, recurso assistivo, barreira observada e ajuda necessária. Após a correção, repita a tarefa com a pessoa. As sessões com participantes permanecem pendentes.

## Resultado da avaliação da versão 0.5.1

**Painel e extensão: meta WCAG 2.2 AA, nível global ainda indeterminado.** As verificações cobriram início, colagem, erro, importação de legenda, resultado, leitura por voz, ajustes e página de privacidade no Chromium. Seis telas foram examinadas nos dois temas com as regras aplicáveis do axe-core, incluindo regras de contraste aprimorado. Não houve violações detectadas nessa amostra da interface própria. A suíte também percorreu o fluxo real de captura de aba. Continuam pendentes a avaliação manual de todos os critérios aplicáveis aos fluxos completos e as sessões descritas acima.

**Site com o VLibras aberto: há falhas de nível A na interface incorporada.** Em 26/11/2026, o teste com o widget oficial ativo encontrou botões sem nome acessível (4.1.2), itens de lista fora de lista semântica (1.3.1) e divergência entre texto visível e nome acessível (2.5.3). A API respondeu ao pedido de tradução de “Olá”. O ensaio verificou o funcionamento técnico; a qualidade linguística precisa ser avaliada por pessoas fluentes em Libras.

A classificação WCAG exige o atendimento de todos os critérios aplicáveis ao nível e aos níveis anteriores, incluindo páginas e processos completos. Na seção de conformidade, a ABNT NBR 17225:2025 distingue conformidade regular e plena. Foram consultados diretamente os itens 5.8.6–5.8.7 e 5.11.2–5.11.6 do exemplar fornecido. [Requisitos de conformidade do W3C](https://www.w3.org/TR/WCAG22/#conformance-reqs)

| Medida no painel | Alto contraste | Cores suaves |
| --- | ---: | ---: |
| Texto do botão Voltar sobre o fundo do botão | 14,89:1 | 9,86:1 |
| Texto de Voltar ao passar o ponteiro | 12,83:1 | 8,47:1 |
| Borda de Voltar sobre o fundo da página | 14,89:1 | 9,29:1 |
| Indicador de foco sobre o fundo da página | 9,85:1 | 7,12:1 |
| Borda do campo sobre o fundo branco | 7,75:1 | 4,59:1 |

O botão mede pelo menos 48 px de altura e tem borda sólida de 2 px. Os cinco cards mantêm contraste mínimo de 7:1 para rótulos e de 3:1 para ícones nos testes. As relações acima são cálculos de luminância para os pares de cores indicados. O texto secundário do tema suave foi escurecido após uma medição inicial de 6,99:1.


## Verificações da versão 0.9.0

Os cards têm botões independentes para informação, números visíveis e atalhos 1 a 5 para posicionar o foco. Enter ou Espaço abre a opção. No celular, são empilhados. Textos de resultado entram na sequência do Tab. A voz de foco é opcional e pode ser desativada em Acessibilidade. A leitura de conteúdo destaca palavras quando o sintetizador fornece eventos de fronteira. A captura recusa a própria interface e mantém um histórico temporário com a origem dos trechos. O histórico é apagado ao iniciar outra análise ou fechar o painel.

O fuzzing determinístico cobre 4.000 entradas com Unicode inválido, links, HTML e negações. A avaliação automática da interface própria continua usando axe-core. A validação linguística de Libras, a análise de todos os critérios WCAG e o uso com leitores de tela por pessoas com deficiência continuam pendentes. As observações anteriores sobre o widget são registros da avaliação anterior, não uma certificação desta edição.
