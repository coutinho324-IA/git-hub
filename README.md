# Box Aristeu Just Motors

App de estratégia para endurance de kart da equipe **Aristeu Just Motors**.

- **Pilotos:** Kaka (piloto 1) e Guilherme Coutinho (piloto 2)
- **Prova:** 2 horas
- **Volta média:** 48,20 s
- **Regra:** 3 paradas obrigatórias, com 5 minutos de permanência no box em cada uma

O app roda no navegador do celular, sem instalação e sem internet depois de aberto. Ele tem quatro abas:

| Aba | Para que serve |
|---|---|
| **Plano** | Calcula stints, paradas, janelas e voltas estimadas. Todos os números do regulamento são editáveis. |
| **Ao vivo** | Cronômetro da prova, o que mostrar na placa de box, contagem regressiva de 5:00 com bipes, alerta de janela de parada, bandeira amarela e queda de ritmo. Registrar voltas é opcional: as paradas são chamadas pelo relógio. |
| **Análise** | Média, melhor volta e consistência de cada piloto, gráfico volta a volta e segundos perdidos em cada parada. |
| **Manual** | Ficha de cada piloto, regras na pista, placa de box e roteiro da troca, com os números recalculados a partir da configuração. |

## Usar sem internet (instalar no celular)

O app é publicado no GitHub Pages em **https://coutinho324-ia.github.io/git-hub/app/** e fica guardado no celular depois da primeira abertura. O endereço https://coutinho324-ia.github.io/git-hub/ também leva para o app.

1. Com internet, abra o link no celular.
2. Instale na tela inicial:
   - **Android (Chrome):** toque em **Instalar no celular** na aba Ao vivo, ou no menu ⋮ → Instalar app.
   - **iPhone (Safari):** Compartilhar → Adicionar à Tela de Início.
3. Teste: modo avião ligado, abra pelo ícone **Box AJM**. Na aba Ao vivo deve aparecer "Pronto para usar sem internet".

Quando há sinal, o app baixa atualizações em segundo plano e usa a versão nova na próxima abertura. Os dados da prova ficam no próprio celular.

O link do Claude (artifact) só funciona com internet. Se o sinal cair com ele já aberto, o cronômetro continua, mas ele não abre de novo sem rede.

### Ativar o GitHub Pages (uma vez só)

No GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch: main, pasta / (root) → Save**. Depois disso, cada mudança na `main` é publicada sozinha em 1 ou 2 minutos. O workflow `.github/workflows/tests.yml` roda os testes em cada PR e em cada push.

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
| Stints | 4 de ≈ **26:05** cada, cerca de **32 voltas** |

As perdas de pit lane e volta de saída são estimativas. Meça no treino e ajuste no Plano.

### Plano base

| Stint | Piloto | De → até | Voltas | Entra no box |
|---|---|---|---|---|
| 1 | Kaka | 0:00 → 26:05 | 32,5 | volta 32 (janela V29–V35) |
| 2 | Guilherme Coutinho | 31:19 → 57:23 | 32,5 | volta 65 (janela V62–V68) |
| 3 | Kaka | 1:02:37 → 1:28:42 | 32,5 | volta 97 (janela V94–V100) |
| 4 | Guilherme Coutinho | 1:33:55 → 2:00:00 | 32,5 | bandeira |

Cada piloto faz 2 stints e cerca de 52 minutos de pista. Kaka larga e Guilherme recebe a bandeira quadriculada. Se a classificação mostrar que um dos dois é mais rápido, lance a volta média de cada um e use **Otimizar pelo ritmo**: o mais rápido ganha tempo de pista até o limite de stint (35 min por padrão).

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
tests/
  strategy.test.js      cálculos do plano e do modo ao vivo
  offline.test.js       todos os arquivos do app estão no cache offline
.github/workflows/
  tests.yml             roda os testes em cada PR e push
index.html              leva o endereço raiz do site para app/
.nojekyll               publica os arquivos como estão, sem Jekyll
```
