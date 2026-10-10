# Box Aristeu Just Motors

App de estratégia para endurance de kart da equipe **Aristeu Just Motors**.

- **Pilotos:** Kaka (piloto 1) e Guilherme Coutinho (piloto 2)
- **Prova:** 2 horas
- **Volta média (treino):** Kaka 48,05 s · Guilherme Coutinho 48,40 s
- **Regra:** 3 paradas obrigatórias, com 5 minutos de permanência no box em cada uma

O app roda no navegador do celular, sem instalação e sem internet depois de aberto. O botão no topo troca a cor da tela: **Automático** (segue o celular), **Claro** ou **Escuro**. Ele tem seis abas:

| Aba | Para que serve |
|---|---|
| **Equipes** | Cadastra, edita e exclui equipes: nome da equipe, oficina, quantidade de pilotos (1 a 6), nome e volta média de cada piloto. A equipe em uso alimenta o resto do app e guarda a própria escala de stints. |
| **Plano** | Calcula stints, paradas, janelas e voltas estimadas. Todos os números do regulamento são editáveis. |
| **Comparar** | Divide a tela em partes e mostra tudo ao mesmo tempo: cada parte pode ter um menu do app (Plano, Ao vivo, Análise, Equipes, Manual) ou a estratégia de uma equipe. |
| **Ao vivo** | Cronômetro da prova, o que mostrar na placa de box, contagem regressiva de 5:00 com bipes, alerta de janela de parada, bandeira amarela e queda de ritmo. Registrar voltas é opcional: as paradas são chamadas pelo relógio. |
| **Análise** | Média, melhor volta e consistência de cada piloto, gráfico volta a volta e segundos perdidos em cada parada. |
| **Manual** | Ficha de cada piloto, regras na pista, placa de box e roteiro da troca, com os números recalculados a partir da configuração. |

## Usar sem internet

Há três jeitos, do mais simples para o mais completo.

### 1. Arquivo único no celular (não precisa configurar nada)

`dist/Box-AJM.html` tem o app inteiro num arquivo só, com estilos, fontes e ícone embutidos. Guarde no celular e abra no navegador: funciona sem internet desde a primeira vez.

- **Android:** baixe o arquivo, abra pelo app Arquivos/Downloads e escolha **Abrir com Chrome**. Os dados da prova ficam salvos no celular.
- **iPhone:** o iPhone não roda apps salvos como arquivo. Use o jeito 2 ou 3.

Depois de mudar o app, gere o arquivo de novo com `npm run build:offline` (o teste avisa se ficou desatualizado).

### 2. Link do Claude aberto antes da largada

Depois de aberto, o app roda inteiro no celular e não usa a internet. Abra o link com sinal antes da largada e não feche a página durante a prova. Se fechar, ele só abre de novo com internet.

### 3. Instalar pelo GitHub Pages

Se o GitHub Pages estiver ativo, o app fica em **https://coutinho324-ia.github.io/git-hub/app/**. Abra uma vez com internet e instale na tela inicial: no Android pelo botão **Instalar no celular** na aba Ao vivo; no iPhone pelo Safari em Compartilhar → Adicionar à Tela de Início. Depois disso abre pelo ícone **Box AJM**, mesmo em modo avião, e se atualiza sozinho quando há sinal.

Para ativar o Pages: **Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch: main, pasta / (root) → Save**. Desligue a tradução automática do navegador antes: ela costuma quebrar os botões do GitHub. O workflow `.github/workflows/tests.yml` roda os testes em cada PR e em cada push.

## Como usar no computador

Abra `app/index.html` no navegador. Para servir na rede local (útil para abrir no celular):

```bash
npm start            # http://localhost:8080
npm test             # testes do motor de estratégia
```

Os dados ficam salvos no próprio aparelho (localStorage). No dia da prova, use um único celular como cronômetro oficial da equipe.

## Análise da prova

### Os números

| Item | Valor |
|---|---|
| Duração | 2 h = 7.200 s |
| Tempo parado obrigatório | 3 × 5:00 = 15:00 |
| Perda real por parada | 5:00 + 3 s de folga + ~10 s de pit lane + ~1,5 s de pneu frio ≈ **5:14,5** |
| Tempo de pista | ≈ **1:44:17** |
| Voltas estimadas | ≈ **130** (129,9) |
| Turnos | 4 de **26:15** (o último fecha a conta), cerca de **32 voltas** cada |

As perdas de pit lane e volta de saída são estimativas. Meça no treino e ajuste no Plano.

### Plano base: 4 turnos de 26:15

Turnos de 26:15 revezando **Piloto A (Kaka)**, que larga, e **Piloto B (Guilherme)**, que fecha a prova. Cada turno tem uma ação editável na aba Plano.

| Turno | Piloto | De → até | Voltas | Entra no box | Ação |
|---|---|---|---|---|---|
| 1 | Kaka | 0:00 → 26:15 | 32,8 | volta 33 (janela V30–V36, prazo 35:00) | Largada: escapar do tráfego inicial, sem riscos. |
| 2 | Guilherme Coutinho | 31:30 → 57:45 | 32,5 | volta 65 (janela V62–V68, prazo 1:06:30) | Pista mais limpa: ritmo constante. |
| 3 | Kaka | 1:02:59 → 1:29:14 | 32,8 | volta 98 (janela V95–V101, prazo 1:37:59) | Segundo turno: foco em consistência. |
| 4 | Guilherme Coutinho | 1:34:29 → 2:00:00 | 31,6 | bandeira | Sprint final até a bandeira. |

- **Por que não bate exatamente com 26:15 / 31:15 / 57:30:** cada parada custa cerca de 5:14,5 (5:03 no box + entrada/saída do pit + pneu frio), não 5:00. Por isso os horários depois da 1ª parada andam alguns segundos e o último turno fecha a conta com 25:32. Se os 5:00 do regulamento contarem de linha a linha do pit, zere "Pit lane" na aba Plano e o último turno volta para perto de 26:15.
- **Para mudar:** na aba Plano, digite a duração de cada turno como minutos:segundos (ex.: 26:15), troque o piloto do turno e escreva a ação. O último turno sempre fecha a conta até a bandeira.
- **Alternativa por ritmo:** o Kaka é 0,35 s por volta mais rápido. Com turnos de 30 min para ele e ~22 min para o Guilherme, a equipe ganha cerca de 3,4 s. O botão **Otimizar pelo ritmo** leva o Kaka até ~32,5 min por turno (≈ 5,7 s).

### Meta para chegar na frente

Na aba Plano, informe o **menor tempo da pista**, que pode ser o recorde ou a melhor volta da classificação. Informe também quanto as equipes da frente andam acima dele, em média. Por padrão o app usa 47,60 s e +0,80 s, que são valores de exemplo para trocar pelos reais.

Com isso o app mostra:

- **O ritmo estimado das equipes da frente:** 47,60 + 0,80 = 48,40 s por volta, cerca de 129,3 voltas.
- **Onde vocês terminam com os tempos atuais:** cerca de 0,5 volta (23 s) à frente.
- **O tempo máximo de cada piloto para ainda chegar na frente:**

| Piloto | Ritmo | vs menor tempo | Máximo p/ chegar na frente | vs menor tempo |
|---|---|---|---|---|
| Kaka | 48,05 s | +0,45 s | **48,23 s** | +0,63 s |
| Guilherme | 48,40 s | +0,80 s | **48,58 s** | +0,98 s |

A mesma meta aparece na ficha de cada piloto (aba Manual) e embaixo do nome do piloto na aba Ao vivo.

### Quem abre a prova: estratégias A e B

| | Estratégia A: Kaka abre | Estratégia B: Guilherme abre |
|---|---|---|
| Turnos | Kaka 0:00–26:15 · Guilherme 31:30–57:45 · Kaka 1:02:59–1:29:14 · Guilherme 1:34:29–2:00 | Guilherme 0:00–26:15 · Kaka 31:30–57:45 · Guilherme 1:02:59–1:29:14 · Kaka 1:34:29–2:00 |
| Box nas voltas | 33, 65, 98 | 33, 65, 98 |
| Quem fecha | Guilherme | Kaka (o mais rápido defende ou ganha posição no fim) |
| Voltas | 129,7 | 129,7 |

As duas dão praticamente o mesmo total de voltas, porque cada piloto pilota quase o mesmo tempo. O que muda é quem enfrenta a largada e quem fecha a prova. Escolha com o botão **Usar esta estratégia** na aba Plano.

### Comparar estratégias na tela dividida

A aba **Comparar** divide a tela e mostra várias coisas ao mesmo tempo. Escolha a divisão por uma das miniaturas:

| Modelo | Partes |
|---|---|
| 2 lado a lado | 2 colunas |
| 2 empilhadas | 2 linhas |
| 3 lado a lado | 3 colunas |
| 4 partes | 2 × 2 |
| 1 grande + 2 | uma parte grande à esquerda e duas à direita |
| 6 partes | 3 × 2 |
| Livre | você escolhe de 1 a 4 colunas e de 1 a 3 linhas (até 12 partes) |

Em **Equipes na tela**, marque quais equipes quer ver juntas. O contador mostra quantas estão na tela (por exemplo, "3 de 5"):

- Marcar uma equipe acrescenta uma parte.
- Desmarcar tira a parte dessa equipe.
- **Todas** mostra todas as equipes cadastradas.
- **+ Cadastrar equipe** abre o cadastro.

A cada mudança, a tela se divide sozinha em partes do mesmo tamanho, até 12. Quando a última linha tem menos partes, elas ficam mais largas para ocupar a linha toda.

No primeiro seletor de cada parte você escolhe **o que ela mostra**:

- **Um menu do app:** Plano, Ao vivo, Análise, Equipes ou Manual. Funciona igual à aba: dá para editar o Plano, rodar o cronômetro e registrar voltas. Exemplos: Plano de um lado e Ao vivo do outro, ou Ao vivo grande com duas estratégias ao lado (modelo 1 grande + 2).
- **Estratégia de equipe:** pode aparecer em quantas partes quiser.

Cada menu aparece numa parte só. Se você escolher um menu que já está em outra parte, as duas trocam de lugar.

Na estratégia de equipe, escolha a **equipe** e a **escala**:

- **Escala da equipe:** a que está salva para ela.
- **Fulano abre:** o piloto escolhido larga e os outros revezam.
- **Otimizada pelo ritmo:** mais tempo de pista para quem é mais rápido.

Cada parte mostra:

- a posição entre as partes da tela (1º, 2º…), pelas voltas previstas;
- a diferença para o 1º, em segundos e em voltas;
- a folga por volta para chegar na frente;
- a linha do tempo com as paradas;
- os turnos e as paradas, com a janela de cada uma.

Todas usam as regras da prova da aba Plano. O botão **Usar no Plano** leva a equipe e a escala daquela parte para o Plano.

No notebook, **Tela cheia** usa a tela inteira, e Esc sai. No celular em pé, as partes ficam uma embaixo da outra.

### Estratégia só com os dois pilotos

A equipe corre contra o relógio, não contra as outras equipes. Ninguém precisa acompanhar rivais: o plano é fixo, o app diz quando parar e o piloto que está descansando cuida do relógio e da placa.

**Onde a corrida é ganha**, do maior ganho para o menor:

1. **Ritmo constante.** Em 130 voltas, 0,1 s por volta vira 13 s no fim; 0,3 s vira 39 s, quase uma volta.
2. **Zero incidente.** Uma rodada custa de 10 a 30 s. Na largada e no pelotão, a prioridade é chegar inteiro.
3. **Sair do box no LIBERA (5:03).** O app soma 3 s de folga aos 5:00 para cobrir o erro de quem aperta o cronômetro; sair antes do mínimo dá punição. Além disso, 16 s de sobra em cada uma das 3 paradas custam uma volta inteira.
4. **Parar na bandeira amarela.** Todo mundo vê a bandeira, não precisa olhar ninguém. Cada volta de amarela durante a parada vale cerca de 17 s. Regra: amarela com 15 min ou mais de stint e janela aberta = BOX.
5. **Entrada e saída do box.** Volta de entrada forte até o limite do pit; volta de saída com cuidado, pneu frio.

**Regras na pista**

- Largada e volta 1: sem disputa, sem toque.
- Pilote no seu tempo-alvo. Volta 0,5 s mais lenta: volte ao traçado de referência na seguinte.
- Kart mais rápido chegando: deixe passar no ponto mais fácil. Defender custa mais que ceder.
- Não passou em 2 voltas: desista e volte ao seu ritmo.
- Problema no kart: entre no box.
- Obedeça a placa.

**Placa de box** (o app mostra qual levantar na aba Ao vivo)

| Placa | O que o piloto faz |
|---|---|
| 3, 2 | Faltam essas voltas para o box |
| BOX | Entra no box na próxima passagem |
| RITMO | Últimas 3 voltas mais lentas que o alvo |
| OK | Mantém |

**Quando mudar o plano**

- Amarela com 15 min ou mais de stint e janela aberta: BOX.
- RITMO três passagens seguidas com a janela aberta: piloto cansado, antecipe a parada.
- Kart com problema: antecipe a parada.
- Prazo chegando: BOX sempre.

### A troca com só os dois pilotos

Quem está fora do kart faz o papel de equipe de box.

| Momento | O que acontece |
|---|---|
| Antes | Quem vai entrar está de capacete e luvas, com o celular, 3 voltas antes do box. |
| 0:00 | Kart para. Quem vai entrar toca **Entrou no box** e entrega o celular para quem saiu. |
| 0:00–1:00 | Troca de piloto. Lastro conferido. |
| 1:00–3:00 | Quem saiu conta como está o kart; quem entra repete o alvo de volta e as voltas do stint. Água. |
| 3:00–4:00 | Piloto sentado, cinto, luvas, viseira limpa. |
| 4:00–LIBERA | Quem está com o celular conta os 10 s finais e libera no LIBERA (5:03). |
| Depois | Quem saiu bebe água, descansa 10 min e volta ao relógio e à placa. |

### Confirme no regulamento

- Os 5 minutos contam de linha a linha do pit ou com o kart parado?
- Há tempo mínimo/máximo por piloto ou stint máximo?
- Há período sem parada no início ou no fim?
- O pit fecha sob safety car?
- Peso mínimo e regra de lastro.

Lance as respostas na aba Plano. Janelas, prazos e voltas são recalculados.

## Estrutura

```
app/
  index.html            interface (6 abas)
  style.css             visual, tema claro e escuro
  strategy.js           motor de cálculo, sem DOM (usado pelo app e pelos testes)
  app.js                interface, cronômetro, box, análise
  sw.js                 guarda o app no celular para abrir sem internet
  manifest.webmanifest  nome e ícone do app instalado
  fonts/                fontes Barlow e Saira Condensed (licença SIL OFL)
  icons/                ícones do app
dist/
  Box-AJM.html          app inteiro num arquivo só (gerado por npm run build:offline)
scripts/
  build-offline.js      gera dist/Box-AJM.html
tests/
  strategy.test.js      cálculos do plano e do modo ao vivo
  offline.test.js       todos os arquivos do app estão no cache offline
  build.test.js         arquivo único sem dependências e atualizado
.github/workflows/
  tests.yml             roda os testes em cada PR e push
index.html              leva o endereço raiz do site para app/
.nojekyll               publica os arquivos como estão, sem Jekyll
```
