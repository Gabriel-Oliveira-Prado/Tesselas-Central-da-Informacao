# Validação da pesquisa 0.10.0

Avaliação em 26/11/2026, Windows e Chromium.

## Pesquisa e acessibilidade

Foram aprovados 36 testes de navegador e 11 testes de regras, incluindo 4.000 entradas de fuzzing. Os testes cobrem pesquisa de assunto inédito, consulta efetiva ao buscador e leitura da página retornada, orientação condicionada à fonte, erro de rede, URLs adulteradas, caixa de texto somente para leitura com foco de teclado, botão de nova consulta, OCR e captura real da extensão. Após os ajustes finais, os testes de pesquisa, mídia, acessibilidade, captura da extensão e troca do resultado ao vivo foram repetidos e passaram.

A consulta “Posso votar no Lula?” recuperou orientações gerais sobre sigilo e liberdade de escolha. A síntese exige candidatura válida para o cargo e a eleição e oferece a consulta do TSE. Ela não verifica automaticamente a situação atual de uma candidatura nominal.

A consulta “É proibido votar no Nordeste?” recuperou o artigo 14 da Constituição na página do TSE e orientações de seção eleitoral. A resposta distingue o direito ao voto das condições de situação eleitoral, local e data.

As duas consultas também foram executadas em uma extensão instalada num perfil isolado do Chromium, com conexões reais e sem respostas simuladas. O TSE retornou HTTP 403 nesse ambiente. A Central consultou a [Constituição no Planalto](https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm) como fonte oficial alternativa. Ambas retornaram Orientação encontrada, com o artigo 14 e o endereço da fonte. Nenhum erro de JavaScript foi registrado. Uma página com codificação antiga teve seus acentos preservados. Quando uma matéria original está indisponível, a manchete descoberta continua identificada como contexto, sem inventar um trecho.

Também foram feitas consultas novas sobre segundo turno, reciclagem, vacinação e previsão de chuva. Os resultados são publicações relacionadas com sua fonte. A consulta não transforma a existência de uma notícia em comprovação automática.

## Arquivos reais enviados à aplicação

- Registro público da posse do general Amaro no GSI — Contexto encontrado. Duração 17.241 s. Fonte https://commons.wikimedia.org/wiki/File:Lula_d%C3%A1_posse_ao_general_Amaro_no_GSI.webm. Licença CC BY 3.0.
- Peça sintética da RepresentUs, publicada em 2020. O original é identificado como demonstração de deepfake. — Sem conclusão. Duração 49.401 s. Fonte https://commons.wikimedia.org/wiki/File:Dictators_-_Kim_Jong-Un_by_RepresentUs.webm. Licença CC BY 3.0.

O registro público teve a fala em português transcrita e encontrou publicações relacionadas à posse do general Amaro. A peça da RepresentUs é uma demonstração de deepfake publicada por uma organização externa, identificada dessa forma na origem. Ela não foi produzida neste projeto nem é tratada como uma ocorrência eleitoral brasileira.

O processamento percorreu os arquivos completos pelo campo de envio de vídeo. A fala em português passou a ter prioridade sobre o OCR, e textos repetidos do rodapé foram reduzidos. A peça em inglês teve erros de transcrição no modelo local de português e permaneceu inconclusiva. O sistema ainda não detecta a autenticidade de qualquer vídeo pela aparência.

As rodadas revelaram uma notícia sobre aniversário de Lula com pouca relação com a fala. A seleção passou a exigir mais correspondências para transcrições longas e a preservar a ordem de relevância ao ler páginas. Também houve rodadas sem resultado quando nenhum dos publicadores permitidos aparecia na seleção do buscador. A leitura de manchetes foi ampliada para outros veículos identificados, como UOL, O Globo, SBT News e Estadão, sem conceder à extensão acesso permanente a esses sites. Esses resultados continuam sendo contexto.

O áudio integral extraído do registro público, com 17.23 s, também passou pelo campo Adicionar áudio e retornou Contexto encontrado. Texto reconhecido.

> e o presidente lula deu posse ao ministro do gabinete de segurança institucional general marcos amaro o encontro foi no palácio do planalto o gabinete de segurança institucional apóia o presidente especialmente quanto assuntos militares e de segurança

Os arquivos, a transcrição integral, as fontes e os resultados técnicos estão em dist/ensaios-reais. O comando node scripts/testar-midias-reais.mjs reproduz o ensaio dos dois vídeos e registra os resultados observados. As amostras não são versionadas no repositório.

## Limites observados

Buscadores RSS públicos podem falhar, mudar o formato e recuperar publicações pouco relevantes. Os trechos preservam a redação da fonte e suas datas quando disponíveis. As sínteses gerais sobre voto são condicionadas à recuperação das páginas oficiais. A Central mantém as perguntas na memória da sessão e transmite o trecho de pesquisa aos provedores identificados na interface.

Para avaliar manipulação visual e contextualizar mídias inéditas com maior cobertura, permanece necessária uma integração multimodal, transcrição multilíngue e pesquisa de fontes. O reconhecimento local de objetos depende do modelo disponível no Chrome. Sua integração automática tem teste simulado e não foi apresentada como detecção real de deepfakes.
