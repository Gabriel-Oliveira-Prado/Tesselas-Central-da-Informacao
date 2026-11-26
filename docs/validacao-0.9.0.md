# Validação da Central da Informação 0.9.0

Avaliação executada em 26/11/2026, em Windows e Chromium. A versão web e o pacote da extensão compartilham a interface de web/ e a pesquisa de regras-negocio/.

## Interface e regras

O conjunto inclui 30 testes de navegador e 11 testes de regras. O fuzzing usa uma semente fixa e 4.000 entradas com caracteres inválidos, acentos, HTML, URLs adulteradas e perguntas com negação. As verificações incluem retorno de foco, teclas 1 a 5, explicações dos cards, leitura do foco, destaque de palavras, layout de celular, ampliação a 200%, contraste e axe-core.

“Pode votar depois das 17?” encontra a condição publicada pelo TSE. Quem estava na fila às 17h recebe senha e pode votar depois. A conclusão inclui a condição e o link da fonte. [Orientação do TSE](https://www.tse.jus.br/comunicacao/noticias/2026/Outubro/o-que-acontece-nas-secoes-eleitorais-apos-as-17h-entenda-as-regras-de-seguranca-e-fiscalizacao)

A checagem de manchetes completas distingue a publicação falsa sobre o descarte de cebolas, reapresentado com contexto de 2026, e a publicação confirmada sobre o resgate de uma onça no rio Negro. Esse ensaio exercita os enunciados e links publicados nas fontes. Os arquivos originais desses vídeos não foram classificados por reconhecimento visual. [Checagem do vídeo das cebolas](https://g1.globo.com/fato-ou-fake/noticia/2026/11/24/e-fake-que-video-de-descarte-de-cebolas-na-bahia-tenha-a-ver-com-alta-de-precos-em-2026-cena-ha-dois-anos.ghtml), [checagem do resgate da onça](https://g1.globo.com/fato-ou-fake/noticia/2026/11/23/e-fato-video-mostra-resgate-de-onca-no-rio-negro-em-manaus-no-ano-passado-assista.ghtml)

## Captura e mídia

Um vídeo de controle de 24 segundos percorreu quatro situações, com saída falsa, confirmada, fora de contexto e inconclusiva. A captura real de aba também foi exercitada com a extensão instalada. O histórico preservou os trechos ao encerrar. Um teste adicional recusou a própria interface da Central e confirmou o encerramento da faixa.

Microfone e som da aba foram exercitados com uma fonte de áudio controlada enviada às mesmas APIs de captura. Um arquivo de voz em português foi transcrito pelo modelo local. A integração foi verificada na extensão instalada. Uma voz sintetizada dizendo “abrir eleições” acionou o comando de navegação. Esses ensaios verificam os fluxos técnicos. A qualidade em sotaques, ruído e fala espontânea precisa de avaliação com pessoas.

Dois arquivos reais da campanha Democracia Todo Dia 2020, publicada pelo TSE, foram processados por meio do card de envio de vídeo. Foram usados WEB_FAKE_redes_sociais_LIB_LEG.mp4 e TV_peq.mp4. O ensaio de trechos iniciais encontrou texto e fala, com erros de OCR e transcrição, e terminou sem conclusão sobre uma afirmação específica. O material é uma campanha de orientação. A palavra FAKE no nome do primeiro arquivo não indica que a campanha seja falsa. [Campanha e arquivos do TSE](https://www.tse.jus.br/comunicacao/campanhas-publicitarias/democracia-todo-dia-2020)

Também foram consultadas páginas de vídeos checados do g1 e seus metadados públicos. O acesso aos arquivos de mídia retornou HTTP 400 em um domínio e falha de DNS no endereço progressivo indicado pela API. Um endereço de imagem devolveu uma miniatura, que foi descartada. Esses arquivos não foram considerados reproduzidos nem classificados no ensaio.

O reconhecimento de objetos da Prompt API depende da disponibilidade do modelo no Chrome. O teste automatizado dessa integração usa uma resposta simulada. A comparação de duas artes conhecidas e o reconhecimento de texto foram exercitados com dados reais. A aplicação preserva a conclusão inconclusiva quando falta evidência.

## Libras e acessibilidade

O widget oficial foi ativado pela preferência global. O serviço respondeu HTTP 200 à tradução de “Olá”. A raiz do tradutor permaneceu disponível após trocar de tela. Os módulos JavaScript são locais na extensão e os recursos do avatar são carregados do VLibras. A telemetria do widget foi desativada.

A conformidade global WCAG permanece indeterminada. Estão pendentes a avaliação completa dos critérios aplicáveis, leitores de tela com pessoas usuárias e avaliação da tradução por pessoas fluentes em Libras. Os testes automáticos da interface própria não certificam os componentes de terceiros.

## Limite de interpretação

O sistema consulta enunciados revisados e publicações relacionadas. Interpretar a autenticidade e o contexto de qualquer imagem ou vídeo inédito exige uma etapa adicional de pesquisa e análise multimodal. Essa capacidade requer avaliação própria, fontes recuperadas e um serviço que proteja as credenciais de API quando houver um fornecedor externo.
