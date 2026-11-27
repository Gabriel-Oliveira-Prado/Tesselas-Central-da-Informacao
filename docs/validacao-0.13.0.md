# Checagem de contexto com Gemini

Em 27 de novembro de 2026, o teste no Chromium pesquisou matérias públicas do Terra e do UOL. O site local enviou ao servidor a afirmação e as passagens recuperadas. O servidor consultou o Gemini 3.1 Flash-Lite para as duas manchetes completas. A verificação de ambiguidade identificou a terceira pergunta antes de consultar o modelo.

| Entrada testada | Primeiro resultado exibido |
| --- | --- |
| Flávio Bolsonaro perde para Lula na seção eleitoral em que vota em sao paulo | Fora de contexto. A passagem do UOL situa a seção de Flávio na Vila Isabel, no Rio de Janeiro. |
| Flávio Bolsonaro perde para Lula na seção eleitoral em que vota no Rio de Janeiro | Verdadeiro. A fonte informa 146 votos para Lula e 127 para Flávio na seção do senador. |
| Flávio Bolsonaro perdeu para Lula naquela seção eleitoral? | Não verificado. A interface pede que a pessoa identifique o local. |

A extensão instalada em perfil isolado também retornou **Fora de contexto** para a primeira frase. O resultado depende das passagens disponíveis e da disponibilidade do modelo. Em uma repetição posterior no site, a consulta não retornou o mesmo veredito conclusivo. A interface preserva a incerteza quando falta sustentação para a comparação.

Os testes automatizados exercitam separadamente a seleção da fonte, a rejeição de uma passagem inexistente, a indisponibilidade por cota e a apresentação de uma notícia sobre outro assunto. Esses testes usam respostas controladas para serem reproduzíveis.

As duas reportagens estão disponíveis no [UOL](https://noticias.uol.com.br/eleicoes/2026/10/05/lula-teve-mais-votos-na-secao-eleitoral-onde-flavio-bolsonaro-vota.ghtm) e no [Terra](https://www.terra.com.br/noticias/brasil/politica/flavio-bolsonaro-perde-para-lula-na-secao-eleitoral-em-que-vota-no-rio-de-janeiro,23c155bdaf8d161e60f7ec92770b4d595i0ztixh.html).
