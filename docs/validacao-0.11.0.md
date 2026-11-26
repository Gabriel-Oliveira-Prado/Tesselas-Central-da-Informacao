# Validação da versão 0.11.0

Avaliação em 26/11/2026, Windows, Chromium e Playwright. A interface passou a verificar informações de qualquer tema. Eleições mantém um formulário específico, compartilhando os mesmos componentes e regras de checagem.

## O que mudou

- A conclusão aparece primeiro no resultado escrito e na leitura em voz alta. Falso, Verdadeiro e Fora de contexto dependem da afirmação checada. Não verificado indica falta de evidências ou conclusões distintas entre as afirmações encontradas. Publicações relacionadas não são apresentadas como prova.
- Voltar e o título ficam na mesma linha, com reflow para textos ampliados. Links de conteúdo usam azul e sublinhado.
- A pesquisa tem texto de estado e indicador de movimento. O movimento pode ser desligado nas configurações e respeita a preferência do sistema. Não há flashes.
- A análise ao vivo diferencia preparação dos quadros, carregamento local, reconhecimento e pesquisa. A prévia chega antes da conclusão do OCR. O PNG enviado ao OCR é obtido de forma síncrona, evitando a fila assíncrona de conversão de canvas em painéis em segundo plano.
- Antes de solicitar compartilhamento, uma tela explica Tab, Shift + Tab, setas, confirmação, áudio e cancelamento. Há alternativas por texto e arquivo. A extensão também permite autorizar a leitura do texto da aba aberta.
- Eleições aceita texto, link, áudio, vídeo e legendas. As manchetes identificam o portal de destino dentro do próprio link.
- O VLibras começa desligado em uma instalação nova. Uma ativação deliberada pode ser salva como preferência.
- Sem JavaScript, uma alternativa em HTML oferece pesquisa e links às fontes. Com CSS removido, a sequência de títulos, formulário e resultado continua disponível.

## Ferramentas da imagem

| Ferramenta | Resultado observado | Alcance |
| --- | --- | --- |
| [HeadingsMap](https://chromewebstore.google.com/detail/headingsmap/flbjommegcjonpdmenkdiocclhjacmbi), 4.10.12 | Mapa inspecionado no início, envio e resultado. O resultado contém h1 da conclusão e h2 da afirmação. | Estrutura e regiões nos estados observados. |
| [WCAG Color Contrast Checker](https://chromewebstore.google.com/detail/wcag-color-contrast-check/plnahcmalebffmaghcpcmpaciebdhgdf), 3.8.5 | Contraste mínimo de texto 8,18:1 na tela de envio. A seleção AAA aparece na gravação. | Combinações visíveis nesse estado, sem declaração de conformidade AAA do site. |
| [Image Alt Text Viewer](https://chromewebstore.google.com/detail/image-alt-text-viewer/nhmihbneenlkbjjpbimhegikadfleccd), 1.3 | Texto alternativo do logotipo identificado. Ícones decorativos permanecem fora da árvore acessível. | Nome alternativo observado e revisão dos ícones. |
| [Disable HTML/CSS/JS](https://chromewebstore.google.com/detail/disable-htmlcssjs/jcciiagjkpknnjanioihiopnopjakbgo), 1.0.0 | CSS removido pela ferramenta, zero folhas de estilo restantes. O formulário retornou Falso com a fonte. | Fluxo sem CSS. A remoção de scripts por uma extensão não prova que JavaScript já executado foi desativado. |
| JavaScript desativado no Chromium | Alternativa em HTML exibida, campo de pesquisa e links utilizáveis. | Ensaio complementar com JavaScript realmente desligado. |
| [AMAWeb](https://amaweb.unifesp.br/avaliador/) | Nota 10/10, zero itens a corrigir, cinco verificações manuais indicadas. | Cópia do HTML renderizado do resultado Verdadeiro, enviada pelo campo de código. Não cobre os fluxos dinâmicos. |
| [Lighthouse](https://developer.chrome.com/docs/lighthouse/accessibility), 13.6.0 | Acessibilidade 100/100, zero auditorias automáticas reprovadas. | Página inicial, em computador. Dez auditorias dependem de revisão manual. |
| [AccessMonitor](https://accessmonitor.acessibilidade.gov.pt/) | Serviço retornou Web Page Blocked. A tentativa foi gravada. | Sem avaliação e sem nota atribuída ao projeto. |
| axe-core | Zero violações automáticas nas telas de envio, acessibilidade, áudio e eleições. | O motor deixou contraste para revisão manual nesses quatro estados. O relatório preserva essas pendências. |

As extensões foram obtidas pela distribuição oficial do Chrome e carregadas apenas em perfis temporários de teste. Não foram instaladas no perfil pessoal do usuário. As gravações usam mouse e teclado. O relatório do Lighthouse foi aberto no navegador. Os vídeos são silenciosos e têm resultados equivalentes em texto na galeria.

## Testes e gravações

O roteiro `node scripts/gravar-validacao.mjs` gera vídeos WebM, capturas, relatórios JSON e uma galeria em `dist/validacao-0.11.0`. O servidor local permite abrir `/validacao/index.html`, mantendo os outros arquivos de `dist` fora da rota pública. É possível repetir uma gravação com `QA_ONLY` e o nome do teste. O compartilhamento automático de uma aba usa uma flag do Chromium exclusivamente no perfil isolado; isso não demonstra operação manual do seletor do sistema por um leitor de tela.

A gravação principal percorre a checagem falsa sobre conexão da urna, a checagem verdadeira publicada pelo g1 sobre o resgate de uma onça e a checagem de vídeo dos peritos fora de contexto. As conclusões aparecem antes das explicações. O fluxo também abre o texto reconhecido, a orientação de captura e Eleições.

A gravação de análise ao vivo usa o [vídeo público da Agência Brasil sobre a posse do general Amaro](https://commons.wikimedia.org/wiki/File:Lula_d%C3%A1_posse_ao_general_Amaro_no_GSI.webm), distribuído no Wikimedia Commons com licença CC BY 3.0. A reprodução chegou ao fim, 17,241 segundos, enquanto a extensão recebia quadros da aba. O ensaio exibiu a prévia e o estado Checagem deste trecho concluída. O resultado foi Não verificado, e os trechos ficaram no histórico. O ensaio não confirmou a autenticidade do vídeo e não apresentou um veredito inventado pela aparência.

Passaram os 41 testes de navegador e 11 testes de regras, incluindo 4.000 entradas de fuzzing, navegação, foco, ampliação, contraste, permissões, ausência de persistência das perguntas, mídia e captura real da extensão. Os testes novos verificam que a permissão não é solicitada antes da orientação, que o formulário de Eleições é compartilhado, que o resultado aparece primeiro e que a redução de movimento funciona. Uma regressão também exercita OCR com a conversão assíncrona de canvas indisponível.

## Revisão humana pendente

As notas automáticas não estabelecem conformidade integral A, AA ou AAA. Permanecem necessários ensaios com pessoas cegas e outros usuários de tecnologias assistivas, incluindo NVDA, JAWS e VoiceOver, além de revisão da tradução em Libras e da compreensão das mensagens. Os testes atuais exercitam teclado e árvore de acessibilidade; não são um teste completo desses leitores de tela.

Uma manchete ou uma semelhança visual não autenticam um vídeo inteiro. A análise de mídias inéditas continua limitada pelo reconhecimento local de português e pelas checagens encontradas. Quando falta uma correspondência sustentada por fonte, o resultado correto continua sendo Não verificado.
