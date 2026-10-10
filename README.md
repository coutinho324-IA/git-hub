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
| **Ao vivo** | Cronômetro da prova, registro de voltas, contagem regressiva de 5:00 no box com bipes, alerta de janela de parada, bandeira amarela e queda de ritmo. |
| **Análise** | Média, melhor volta e consistência de cada piloto, gráfico volta a volta e segundos perdidos em cada parada. |
| **Manual** | A estratégia abaixo, com os números recalculados a partir da configuração. |

## Como usar

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

### Como sair na frente

Todas as equipes ficam os mesmos 15 minutos paradas. A vantagem vem do resto, nesta ordem de impacto:

1. **Ritmo e consistência.** Em 130 voltas, 0,1 s por volta vira 13 s no fim; 0,3 s vira 39 s, quase uma volta. O app avisa quando a média das 3 últimas voltas passa 0,5 s do alvo.
2. **Parada cirúrgica.** Sair em 5:00, nem um segundo depois. 16 s de sobra em cada uma das 3 paradas custam uma volta inteira. O cronômetro de box conta regressivo, bipa nos 60, 30 e 10 s finais e mostra LIBERA. A troca de piloto e de lastro cabe dentro dos 5 minutos.
3. **Parar sob bandeira amarela ou safety car.** Quem para enquanto o pelotão anda devagar perde menos terreno. Com volta de amarela em ~65 s, cada volta de amarela durante a parada vale cerca de 17 s sobre quem parou com bandeira verde. Por isso o plano usa janela, e não volta fixa.
4. **Ar limpo.** Preso atrás de um kart mais lento com a janela aberta, antecipe a parada. Evite parar na mesma volta de várias equipes.
5. **Entrada e saída do pit.** Entre no limite de velocidade sem frear antes da hora. Na volta de saída, pneu frio: freie um pouco antes nas duas primeiras curvas.

### Protocolo dos 5 minutos

| Tempo no box | O que acontece |
|---|---|
| 0:00 | Kart na marcação. Toque em **Entrou no box**. |
| 0:00–1:00 | Troca de piloto, lastro, banco e pedais. |
| 1:00–3:00 | Briefing: tempo-alvo, voltas do stint, rivais. Quem saiu relata o kart e bebe água. |
| 3:00–4:00 | Piloto sentado, cinto, luvas, viseira limpa. |
| 4:00–5:00 | Kart pronto. Contagem em voz alta nos 10 s finais. Libera no LIBERA. |

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
  index.html     interface (4 abas)
  style.css      visual, tema claro e escuro
  strategy.js    motor de cálculo, sem DOM (usado pelo app e pelos testes)
  app.js         interface, cronômetro, box, análise
tests/
  strategy.test.js
```
