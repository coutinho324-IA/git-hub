# Box Aristeu Just Motors

App de estratégia para endurance de kart da equipe **Aristeu Just Motors**.

- **Pilotos:** Kaka (piloto 1) e Guilherme Coutinho (piloto 2)
- **Prova:** 2 horas
- **Volta média (treino):** Kaka 48,05 s · Guilherme Coutinho 48,40 s
- **Regra:** 3 paradas obrigatórias, com 5 minutos de permanência no box em cada uma

O app roda no navegador do celular, sem instalação e sem internet depois de aberto. Ele tem quatro abas:

| Aba | Para que serve |
|---|---|
| **Plano** | Calcula stints, paradas, janelas e voltas estimadas. Todos os números do regulamento são editáveis. |
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
| Perda real por parada | 5:00 + 2 s de folga + ~10 s de pit lane + ~1,5 s de pneu frio ≈ **5:13,5** |
| Tempo de pista | ≈ **1:44:20** |
| Voltas estimadas | ≈ **130** (129,9) |
| Stints | Kaka 2 × **30:00** (≈ 37 voltas cada) · Guilherme 2 × **22:10** (≈ 27 voltas cada) |

As perdas de pit lane e volta de saída são estimativas. Meça no treino e ajuste no Plano.

### Plano base

Kaka é 0,35 s por volta mais rápido, então faz stints de 30 min e o Guilherme de cerca de 22 min.

| Stint | Piloto | De → até | Voltas | Entra no box |
|---|---|---|---|---|
| 1 | Kaka | 0:00 → 30:00 | 37,5 | volta 37 (janela V34–V40, prazo 35:00) |
| 2 | Guilherme Coutinho | 35:14 → 57:23 | 27,5 | volta 65 (janela V62–V68, prazo 1:10:14) |
| 3 | Kaka | 1:02:37 → 1:32:37 | 37,5 | volta 102 (janela V99–V105, prazo 1:37:37) |
| 4 | Guilherme Coutinho | 1:37:50 → 2:00:00 | 27,5 | bandeira |

- **Tempo de pista:** Kaka 1:00:00 (≈ 75 voltas), Guilherme 44:20 (≈ 55 voltas).
- **Ganho:** cerca de 3,4 s na prova em relação a dividir igual.
- **Folga:** cada parada do Kaka fica 5 min antes do prazo. Assim sobra janela para aproveitar uma amarela ou atrasar se o piloto estiver bem.
- **Botão Otimizar pelo ritmo:** leva o Kaka até cerca de 32,5 min por stint (≈ 5,7 s de ganho). Sempre sobram 3 voltas de janela antes do prazo, mas os stints longos cansam mais.

### Meta para chegar na frente

Na aba Plano, informe o **menor tempo da pista**, que pode ser o recorde ou a melhor volta da classificação. Informe também quanto as equipes da frente andam acima dele, em média. Por padrão o app usa 47,60 s e +0,80 s, que são valores de exemplo para trocar pelos reais.

Com isso o app mostra:

- **O ritmo estimado das equipes da frente:** 47,60 + 0,80 = 48,40 s por volta, cerca de 129,3 voltas.
- **Onde vocês terminam com os tempos atuais:** cerca de 0,5 volta (26 s) à frente.
- **O tempo máximo de cada piloto para ainda chegar na frente:**

| Piloto | Ritmo | vs menor tempo | Máximo p/ chegar na frente | vs menor tempo |
|---|---|---|---|---|
| Kaka | 48,05 s | +0,45 s | **48,25 s** | +0,65 s |
| Guilherme | 48,40 s | +0,80 s | **48,60 s** | +1,00 s |

A mesma meta aparece na ficha de cada piloto (aba Manual) e embaixo do nome do piloto na aba Ao vivo.

### Quem abre a prova: estratégias A e B

| | Estratégia A: Kaka abre | Estratégia B: Guilherme abre |
|---|---|---|
| Stints | Kaka 0:00–30:00 · Guilherme 35:14–57:23 · Kaka 1:02:37–1:32:37 · Guilherme 1:37:50–2:00 | Guilherme 0:00–22:10 · Kaka 27:23–57:23 · Guilherme 1:02:37–1:24:47 · Kaka 1:30:00–2:00 |
| Box nas voltas | 37, 65, 102 | 27, 65, 92 |
| Quem fecha | Guilherme | Kaka (o mais rápido defende ou ganha posição no fim) |
| Voltas | 129,9 | 129,9 |

As duas dão o mesmo total de voltas, porque cada piloto pilota o mesmo tempo. O que muda é quem enfrenta a largada, quem fecha a prova e em que voltas são as paradas. Escolha com o botão **Usar esta estratégia** na aba Plano.

### Estratégia só com os dois pilotos

A equipe corre contra o relógio, não contra as outras equipes. Ninguém precisa acompanhar rivais: o plano é fixo, o app diz quando parar e o piloto que está descansando cuida do relógio e da placa.

**Onde a corrida é ganha**, do maior ganho para o menor:

1. **Ritmo constante.** Em 130 voltas, 0,1 s por volta vira 13 s no fim; 0,3 s vira 39 s, quase uma volta.
2. **Zero incidente.** Uma rodada custa de 10 a 30 s. Na largada e no pelotão, a prioridade é chegar inteiro.
3. **Sair do box em 5:00.** 16 s de sobra em cada uma das 3 paradas custam uma volta inteira.
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
| 4:00–5:00 | Quem está com o celular conta os 10 s finais e libera no LIBERA. |
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
  index.html            interface (4 abas)
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
