/*
 * Motor de estratégia — Aristeu Just Motors
 *
 * Funções puras (sem DOM). O app usa via `window.KartStrategy`
 * e os testes via `require('../app/strategy.js')`.
 *
 * Unidades: tempos em segundos, durações de configuração em minutos
 * quando o nome termina em "Min".
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.KartStrategy = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const MAX_PILOTS = 6;
  const NEW_PILOT_LAP = 48.2;

  const DEFAULT_CONFIG = Object.freeze({
    teamName: 'Aristeu Just Motors',
    workshopName: '',
    raceMin: 120,
    stops: 3,
    minPitSec: 300,
    // Perdas de cada parada além dos 5:00 (ajuste depois do treino).
    pitLaneLossSec: 10, // entrar e sair do pit lane comparado a seguir na pista
    // Folga para não sair antes do tempo mínimo: cobre o erro de quem aperta o
    // cronômetro (1 a 2 s). Sair cedo dá punição; cada segundo de folga custa 1 s.
    exitMarginSec: 3,
    outLapLossSec: 1.5, // pneu frio na volta de saída
    // Regulamento e limites da equipe (0 = sem limite).
    maxStintMin: 35,
    minStintMin: 5,
    minDriveMin: 0,
    noPitFirstMin: 0,
    noPitLastMin: 0,
    // Estratégia.
    windowLaps: 3,
    yellowLapSec: 65,
    yellowMinStintMin: 15, // amarela só vale parada depois deste tempo de stint
    // Referência da pista: menor tempo de volta (recorde ou melhor volta da
    // classificação) e quanto as equipes da frente andam, em média, acima dele.
    trackBestSec: 47.6, // 0 = não informado
    leaderGapSec: 0.8,
    // Voltas médias medidas no treino.
    pilots: [
      { id: 'p1', name: 'Kaka', lapSec: 48.05 },
      { id: 'p2', name: 'Guilherme Coutinho', lapSec: 48.4 },
    ],
    order: ['p1', 'p2', 'p1', 'p2'],
    // Plano da equipe: 4 turnos de 26:15 revezando A (Kaka, larga) e B
    // (Guilherme, fecha). O último turno fecha a conta até a bandeira.
    stintMode: 'custom', // 'equal' | 'custom'
    customStintMin: [26.25, 26.25, 26.25],
    // O que o piloto faz em cada turno (editável).
    stintNotes: [
      'Largada: escapar do tráfego inicial, sem riscos.',
      'Pista mais limpa: ritmo constante.',
      'Segundo turno: foco em consistência.',
      'Sprint final até a bandeira.',
    ],
  });

  const NUMERIC_KEYS = [
    'raceMin', 'stops', 'minPitSec', 'pitLaneLossSec', 'exitMarginSec', 'outLapLossSec',
    'maxStintMin', 'minStintMin', 'minDriveMin', 'noPitFirstMin', 'noPitLastMin',
    'windowLaps', 'yellowLapSec', 'yellowMinStintMin', 'trackBestSec', 'leaderGapSec',
  ];

  function num(value, fallback) {
    const n = typeof value === 'string' ? parseFloat(value.replace(',', '.')) : Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function clamp(x, lo, hi) {
    return Math.min(hi, Math.max(lo, x));
  }

  /** Mescla com os padrões, converte números e acerta o tamanho das listas. */
  function normalizeConfig(input) {
    const src = input || {};
    const cfg = {};
    cfg.teamName = String(src.teamName || DEFAULT_CONFIG.teamName).trim() || DEFAULT_CONFIG.teamName;
    cfg.workshopName = String(src.workshopName || '').trim();
    for (const key of NUMERIC_KEYS) cfg[key] = Math.max(0, num(src[key], DEFAULT_CONFIG[key]));
    cfg.stops = clamp(Math.round(cfg.stops), 0, 10);
    cfg.raceMin = Math.max(1, cfg.raceMin);
    cfg.yellowLapSec = Math.max(1, cfg.yellowLapSec);

    // De 1 a MAX_PILOTS pilotos; ids pela posição (p1, p2, ...).
    const srcPilots = Array.isArray(src.pilots) && src.pilots.length
      ? src.pilots.slice(0, MAX_PILOTS)
      : DEFAULT_CONFIG.pilots;
    cfg.pilots = srcPilots.map((p, i) => {
      const fallbackName = `Piloto ${i + 1}`;
      return {
        id: `p${i + 1}`,
        name: String((p && p.name) || fallbackName).trim() || fallbackName,
        lapSec: Math.max(10, num(p && p.lapSec, NEW_PILOT_LAP)),
      };
    });

    const ids = cfg.pilots.map((p) => p.id);
    const n = cfg.stops + 1;
    // Sem ordem informada: os pilotos se revezam na ordem do cadastro.
    const srcOrder = Array.isArray(src.order) ? src.order : [];
    cfg.order = [];
    for (let i = 0; i < n; i++) {
      const id = srcOrder[i];
      cfg.order.push(ids.includes(id) ? id : ids[i % ids.length]);
    }

    cfg.stintMode = src.stintMode === 'custom' ? 'custom' : 'equal';
    const srcCustom = Array.isArray(src.customStintMin) ? src.customStintMin : [];
    cfg.customStintMin = [];
    for (let i = 0; i < n - 1; i++) cfg.customStintMin.push(Math.max(0, num(srcCustom[i], 0)));
    // Anotação de cada turno. Sem anotações salvas, usa as padrão quando a
    // prova tem o mesmo número de turnos do padrão.
    const srcNotes = Array.isArray(src.stintNotes)
      ? src.stintNotes
      : (n === DEFAULT_CONFIG.stintNotes.length ? DEFAULT_CONFIG.stintNotes : []);
    cfg.stintNotes = Array.from({ length: n }, (_, i) => String(srcNotes[i] || '').trim().slice(0, 140));
    if (cfg.stintMode === 'custom' && cfg.customStintMin.every((m) => m === 0) && n > 1) {
      cfg.stintMode = 'equal';
    }
    return cfg;
  }

  /** Segundos que cada parada custa em relação a não parar. */
  function perStopLoss(cfg) {
    return cfg.minPitSec + cfg.exitMarginSec + cfg.pitLaneLossSec + cfg.outLapLossSec;
  }

  function raceSec(cfg) {
    return cfg.raceMin * 60;
  }

  /** Tempo total de pilotagem disponível (prova menos paradas). */
  function driveSec(cfg) {
    return raceSec(cfg) - cfg.stops * perStopLoss(cfg);
  }

  function pilotById(cfg, id) {
    return cfg.pilots.find((p) => p.id === id) || cfg.pilots[0];
  }

  function equalStints(cfg) {
    const n = cfg.stops + 1;
    const d = driveSec(cfg) / n;
    return Array.from({ length: n }, () => d);
  }

  function stintBounds(cfg) {
    const n = cfg.stops + 1;
    const P = perStopLoss(cfg);
    const smin = cfg.minStintMin * 60;
    const smax = cfg.maxStintMin > 0 ? cfg.maxStintMin * 60 : Infinity;
    const lb = Array.from({ length: n }, () => smin);
    const ub = Array.from({ length: n }, () => smax);
    if (n > 1) {
      // Primeira parada não pode acontecer antes de "noPitFirst".
      lb[0] = Math.max(lb[0], cfg.noPitFirstMin * 60);
      // Última parada precisa começar antes dos "noPitLast" minutos finais.
      lb[n - 1] = Math.max(lb[n - 1], cfg.noPitLastMin * 60 - P);
    }
    return { lb, ub };
  }

  /** Distribui `amount` igualmente entre os índices, respeitando o teto. Devolve a sobra. */
  function waterFill(durs, ub, indices, amount) {
    let left = amount;
    let open = indices.filter((i) => durs[i] < ub[i] - 1e-9);
    while (left > 1e-9 && open.length) {
      const share = left / open.length;
      let used = 0;
      for (const i of open) {
        const add = Math.min(share, ub[i] - durs[i]);
        durs[i] += add;
        used += add;
      }
      left -= used;
      open = open.filter((i) => durs[i] < ub[i] - 1e-9);
      if (used < 1e-9) break;
    }
    return left;
  }

  /**
   * Dá mais tempo de pista ao piloto mais rápido, dentro dos limites:
   * stint mínimo/máximo, tempo mínimo por piloto e janelas proibidas.
   * Com ritmos iguais, divide igualmente.
   */
  function optimizeStints(cfg) {
    const n = cfg.stops + 1;
    const D = driveSec(cfg);
    const { lb, ub } = stintBounds(cfg);
    // Stint que termina em parada não encosta no máximo: deixa a janela de
    // ±windowLaps voltas caber antes do prazo (amarela, tráfego, atraso).
    if (cfg.maxStintMin > 0) {
      for (let i = 0; i < n - 1; i++) {
        const margin = cfg.windowLaps * pilotById(cfg, cfg.order[i]).lapSec;
        ub[i] = Math.max(lb[i], ub[i] - margin);
      }
    }
    const notes = [];
    const sumLb = lb.reduce((a, b) => a + b, 0);
    const sumUb = ub.reduce((a, b) => a + b, 0);
    if (sumLb > D + 1e-6 || sumUb < D - 1e-6 || lb.some((l, i) => l > ub[i])) {
      notes.push('Os limites do regulamento não fecham com a duração da prova. Mantive stints iguais.');
      return { durs: equalStints(cfg), feasible: false, notes };
    }

    const durs = lb.slice();
    let remaining = D - sumLb;

    // 1) Garante o tempo mínimo de cada piloto.
    const minDrive = cfg.minDriveMin * 60;
    if (minDrive > 0) {
      for (const p of cfg.pilots) {
        const idx = cfg.order.map((id, i) => (id === p.id ? i : -1)).filter((i) => i >= 0);
        const have = idx.reduce((a, i) => a + durs[i], 0);
        const need = Math.max(0, minDrive - have);
        if (need > 0) {
          const give = Math.min(need, remaining);
          const left = waterFill(durs, ub, idx, give);
          remaining -= give - left;
          if (left > 1e-6 || need > give) notes.push(`${p.name} não alcança o tempo mínimo de pilotagem com estes limites.`);
        }
      }
    }

    // 2) O resto vai primeiro para o piloto mais rápido.
    const groups = new Map();
    cfg.order.forEach((id, i) => {
      const lap = pilotById(cfg, id).lapSec;
      const key = lap.toFixed(3);
      if (!groups.has(key)) groups.set(key, { lap, idx: [] });
      groups.get(key).idx.push(i);
    });
    const ranked = [...groups.values()].sort((a, b) => a.lap - b.lap);
    for (const g of ranked) {
      if (remaining <= 1e-9) break;
      // Dentro do mesmo ritmo, equaliza: completa os stints mais curtos primeiro.
      remaining = levelFill(durs, ub, g.idx, remaining);
    }
    if (remaining > 1e-6) {
      notes.push('Sobrou tempo que nenhum stint comporta: aumente o stint máximo.');
      return { durs: equalStints(cfg), feasible: false, notes };
    }
    return { durs, feasible: true, notes };
  }

  /** Enche os stints mais curtos primeiro até nivelar (mantém stints iguais quando possível). */
  function levelFill(durs, ub, indices, amount) {
    let left = amount;
    for (let guard = 0; guard < 100 && left > 1e-9; guard++) {
      const open = indices.filter((i) => durs[i] < ub[i] - 1e-9);
      if (!open.length) break;
      const low = Math.min(...open.map((i) => durs[i]));
      const lowest = open.filter((i) => durs[i] <= low + 1e-9);
      const higher = open.filter((i) => durs[i] > low + 1e-9).map((i) => durs[i]);
      const nextLevel = Math.min(
        higher.length ? Math.min(...higher) : Infinity,
        Math.min(...lowest.map((i) => ub[i]))
      );
      const room = Number.isFinite(nextLevel) ? (nextLevel - low) * lowest.length : Infinity;
      const give = Math.min(left, room);
      for (const i of lowest) durs[i] += give / lowest.length;
      left -= give;
    }
    return left;
  }

  /** Durações (s) dos stints conforme o modo escolhido. O último stint fecha a conta. */
  function stintDurations(cfg) {
    const n = cfg.stops + 1;
    if (cfg.stintMode !== 'custom' || n === 1) return equalStints(cfg);
    const D = driveSec(cfg);
    const first = cfg.customStintMin.slice(0, n - 1).map((m) => m * 60);
    const used = first.reduce((a, b) => a + b, 0);
    return first.concat([D - used]);
  }

  /**
   * Janela permitida para a parada `k` (0 = primeira), dado o horário em que
   * o kart saiu da parada anterior (`prevOutSec`, 0 na largada).
   */
  function stopWindow(cfg, k, prevOutSec) {
    const T = raceSec(cfg);
    const P = perStopLoss(cfg);
    const N = cfg.stops;
    const smin = cfg.minStintMin * 60;
    const smax = cfg.maxStintMin > 0 ? cfg.maxStintMin * 60 : Infinity;
    const after = N - k - 1; // paradas que ainda faltam depois desta

    let earliest = Math.max(prevOutSec + smin, cfg.noPitFirstMin * 60);
    if (Number.isFinite(smax)) {
      // O que sobrar depois desta parada precisa caber nos stints restantes.
      earliest = Math.max(earliest, T - P - (after + 1) * smax - after * P);
    }
    const lastStopLatest = Math.min(T - cfg.noPitLastMin * 60, T - P - smin);
    let latest = Math.min(prevOutSec + smax, lastStopLatest - after * (P + smin));
    return { earliestSec: earliest, latestSec: latest, feasible: earliest <= latest + 1e-6 };
  }

  /** Plano completo: stints, paradas, voltas e alertas. */
  function buildPlan(rawCfg) {
    const cfg = normalizeConfig(rawCfg);
    const T = raceSec(cfg);
    const P = perStopLoss(cfg);
    const N = cfg.stops;
    const D = driveSec(cfg);
    const durs = stintDurations(cfg);
    const warnings = [];

    const stints = [];
    const stops = [];
    let t = 0;
    let laps = 0;
    durs.forEach((d, i) => {
      const pilot = pilotById(cfg, cfg.order[i]);
      const stintLaps = Math.max(0, d) / pilot.lapSec;
      stints.push({
        index: i,
        note: cfg.stintNotes[i] || '',
        pilotId: pilot.id,
        pilotName: pilot.name,
        lapSec: pilot.lapSec,
        startSec: t,
        endSec: t + d,
        durSec: d,
        laps: stintLaps,
        lapFrom: laps,
        lapTo: laps + stintLaps,
      });
      t += d;
      laps += stintLaps;
      if (i < N) {
        const prevOut = i === 0 ? 0 : stops[i - 1].outSec;
        const win = stopWindow(cfg, i, prevOut);
        stops.push({
          index: i,
          inSec: t,
          outSec: t + P,
          lap: Math.max(1, Math.round(laps)),
          window: win,
        });
        t += P;
      }
    });

    const plan = {
      cfg,
      raceSec: T,
      perStopLoss: P,
      totalPitLoss: N * P,
      driveSec: D,
      stints,
      stops,
      totalLaps: laps,
      perPilot: {},
      warnings,
    };

    for (const s of stops) {
      // Voltas contadas como se o piloto do stint seguisse na pista até a hora.
      const st = stints[s.index];
      const lapAt = (sec) => st.lapFrom + Math.max(0, sec - st.startSec) / st.lapSec;
      s.window.earliestLap = lapAt(s.window.earliestSec);
      s.window.latestLap = lapAt(s.window.latestSec);
      const lo = Math.max(1, s.lap - cfg.windowLaps, Math.ceil(s.window.earliestLap));
      const hi = Math.max(lo, Math.min(s.lap + cfg.windowLaps, Math.floor(s.window.latestLap)));
      s.idealLaps = [lo, hi];
    }

    for (const p of cfg.pilots) plan.perPilot[p.id] = { name: p.name, driveSec: 0, laps: 0, stints: 0 };
    for (const s of stints) {
      const pp = plan.perPilot[s.pilotId];
      pp.driveSec += s.durSec;
      pp.laps += s.laps;
      pp.stints += 1;
    }

    // Alertas.
    if (D <= 0) warnings.push({ level: 'critical', text: 'As paradas consomem a prova inteira. Revise duração e tempo de box.' });
    const smin = cfg.minStintMin * 60;
    const smax = cfg.maxStintMin > 0 ? cfg.maxStintMin * 60 : Infinity;
    stints.forEach((s, i) => {
      if (s.durSec < 0) warnings.push({ level: 'critical', text: `Stint ${i + 1} ficou negativo: os stints anteriores somam mais que o tempo de pista.` });
      else if (s.durSec + 1e-6 < smin) warnings.push({ level: 'warning', text: `Stint ${i + 1} (${s.pilotName}) tem menos que o stint mínimo de ${cfg.minStintMin} min.` });
      if (s.durSec > smax + 1e-6) warnings.push({ level: 'critical', text: `Stint ${i + 1} (${s.pilotName}) passa do stint máximo de ${cfg.maxStintMin} min.` });
    });
    stops.forEach((s, i) => {
      if (!s.window.feasible) warnings.push({ level: 'critical', text: `Parada ${i + 1}: não existe janela que respeite todas as regras.` });
      else if (s.inSec < s.window.earliestSec - 1e-6 || s.inSec > s.window.latestSec + 1e-6) {
        warnings.push({ level: 'critical', text: `Parada ${i + 1} está fora da janela permitida.` });
      }
    });
    if (cfg.minDriveMin > 0) {
      for (const p of cfg.pilots) {
        const have = plan.perPilot[p.id].driveSec;
        if (have + 1e-6 < cfg.minDriveMin * 60) {
          warnings.push({ level: 'critical', text: `${p.name} pilota menos que o mínimo de ${cfg.minDriveMin} min.` });
        }
      }
    }
    return plan;
  }

  /** Voltas acumuladas (fracionárias) num instante da prova, segundo o plano. */
  function lapsAt(plan, sec) {
    let laps = 0;
    for (const s of plan.stints) {
      if (sec <= s.startSec) return s.lapFrom;
      if (sec <= s.endSec) return s.lapFrom + (sec - s.startSec) / s.lapSec;
      laps = s.lapTo;
    }
    return laps;
  }

  /** Quanto tempo de corrida a equipe economiza por segundo de parada feita sob amarela/SC. */
  function yellowGainPerSec(cfg, lapSec) {
    const lap = lapSec || cfg.pilots[0].lapSec;
    return Math.max(0, 1 - lap / cfg.yellowLapSec);
  }

  function mean(xs) {
    return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN;
  }

  function stdev(xs) {
    if (xs.length < 2) return NaN;
    const m = mean(xs);
    return Math.sqrt(xs.reduce((a, x) => a + (x - m) * (x - m), 0) / (xs.length - 1));
  }

  /** Estatísticas de volta por piloto (só voltas de bandeira verde). */
  function lapStats(laps, pilotId) {
    const xs = laps.filter((l) => l.pilot === pilotId && l.kind === 'green').map((l) => l.sec);
    return {
      count: xs.length,
      best: xs.length ? Math.min(...xs) : NaN,
      avg: mean(xs),
      sd: stdev(xs),
    };
  }

  /**
   * Situação ao vivo: em qual stint estamos, quando parar e se a janela está aberta.
   * `race` = { laps:[], pits:[{inSec,outSec,pilotIn,pilotOut}], pit:{inSec}|null, yellow:bool, stintPilots:[] }
   */
  function liveStatus(rawCfg, plan, race, elapsed) {
    const cfg = normalizeConfig(rawCfg);
    const T = raceSec(cfg);
    const P = perStopLoss(cfg);
    const N = cfg.stops;
    const done = race.pits.length;
    const lastOut = done ? race.pits[done - 1].outSec : 0;
    const remainingStops = Math.max(0, N - done);
    const stintIndex = done;
    const pilotId = (race.stintPilots && race.stintPilots[stintIndex]) || cfg.order[Math.min(stintIndex, cfg.order.length - 1)];
    const pilot = pilotById(cfg, pilotId);

    // Replaneja o resto mantendo a proporção dos stints planejados.
    const plannedRest = plan.stints.slice(stintIndex).map((s) => Math.max(1, s.durSec));
    const restDrive = T - lastOut - remainingStops * P;
    const sumRest = plannedRest.reduce((a, b) => a + b, 0) || 1;
    const rest = plannedRest.map((d) => (d * restDrive) / sumRest);

    const out = {
      elapsed,
      remaining: Math.max(0, T - elapsed),
      finished: elapsed >= T,
      stopsDone: done,
      remainingStops,
      stintIndex,
      pilotId: pilot.id,
      pilotName: pilot.name,
      stintElapsed: race.pit ? 0 : Math.max(0, elapsed - lastOut),
      nextStop: null,
      alerts: [],
    };

    if (remainingStops > 0 && !race.pit) {
      const win = stopWindow(cfg, stintIndex, lastOut);
      const target = lastOut + rest[0];
      const half = cfg.windowLaps * pilot.lapSec;
      let state;
      if (elapsed > win.latestSec) state = 'overdue';
      else if (elapsed < win.earliestSec) state = 'locked';
      else if (elapsed < target - half) state = 'open';
      else if (elapsed <= target + half) state = 'ideal';
      else state = 'late';
      out.nextStop = {
        number: done + 1,
        targetSec: target,
        inSec: target - elapsed,
        lapsToGo: (target - elapsed) / pilot.lapSec,
        window: win,
        state,
      };
      if (state === 'overdue') out.alerts.push({ level: 'critical', text: `Prazo da parada ${done + 1} estourado. Chame para o box agora.` });
      else if (win.latestSec - elapsed < 180) out.alerts.push({ level: 'critical', text: `Faltam menos de 3 min para o prazo da parada ${done + 1}.` });
      const windowOpen = state === 'open' || state === 'ideal' || state === 'late';
      const stintLongEnough = out.stintElapsed >= cfg.yellowMinStintMin * 60;
      out.yellowStop = !!race.yellow && windowOpen && stintLongEnough;
      if (out.yellowStop) {
        out.alerts.push({ level: 'good', text: 'Bandeira amarela com janela aberta: chame para o box. Parar agora custa menos tempo de prova.' });
      } else if (race.yellow && state !== 'overdue') {
        out.alerts.push({ level: 'warning', text: `Amarela, mas ${stintLongEnough ? 'a janela ainda está fechada' : `o stint tem menos de ${cfg.yellowMinStintMin} min`}. Siga o plano.` });
      }
    }

    // Stint longo demais.
    if (!race.pit && cfg.maxStintMin > 0 && remainingStops > 0) {
      const left = cfg.maxStintMin * 60 - out.stintElapsed;
      if (left < 0) out.alerts.push({ level: 'critical', text: 'Stint passou do tempo máximo.' });
      else if (left < 180) out.alerts.push({ level: 'warning', text: 'Stint perto do tempo máximo.' });
    }

    // Queda de ritmo: média das 3 últimas voltas verdes do stint.
    const recent = race.laps.filter((l) => l.stint === stintIndex && l.kind === 'green').slice(-3);
    if (recent.length === 3) {
      const avg = mean(recent.map((l) => l.sec));
      out.recentAvg = avg;
      if (avg > pilot.lapSec + 0.5) {
        out.paceDrop = true;
        out.alerts.push({ level: 'warning', text: `Ritmo caiu: média ${avg.toFixed(2)} s nas últimas 3 voltas (alvo ${pilot.lapSec.toFixed(2)} s).` });
      }
    }
    out.sign = boardSign(out);
    return out;
  }

  /**
   * O que mostrar na placa de box quando o piloto passar.
   * BOX = entra na próxima passagem; número = voltas até o box;
   * RITMO = está abaixo do ritmo-alvo; OK = mantém.
   */
  function boardSign(st) {
    if (st.finished) return { text: 'FIM', hint: 'Prova encerrada.' };
    const ns = st.nextStop;
    if (ns) {
      if (ns.state === 'overdue' || ns.state === 'late') return { text: 'BOX', hint: 'Passou do alvo. Entra no box agora.' };
      if (st.yellowStop) return { text: 'BOX', hint: 'Amarela com janela aberta. Entra no box agora.' };
      if (ns.state === 'ideal' || ns.state === 'open') {
        const n = Math.round(ns.lapsToGo);
        if (n <= 1) return { text: 'BOX', hint: 'Entra no box na próxima passagem.' };
        if (n <= 5) return { text: String(n), hint: `Faltam ${n} voltas para o box.` };
      }
    }
    if (st.paceDrop) return { text: 'RITMO', hint: 'Média das últimas 3 voltas acima do alvo.' };
    return { text: 'OK', hint: 'Ritmo bom. Mantém.' };
  }

  /**
   * Metas de ritmo a partir do menor tempo da pista.
   * Os líderes fazem as mesmas paradas e rodam em média `leaderGapSec` acima
   * do menor tempo. `slackSec` é quanto cada piloto pode perder por volta em
   * relação ao ritmo do plano e ainda terminar na frente (negativo = precisa
   * ganhar esse tanto por volta).
   */
  function paceTargets(plan) {
    const cfg = plan.cfg;
    if (!(cfg.trackBestSec > 0)) return null;
    const best = cfg.trackBestSec;
    const leaderLap = best + cfg.leaderGapSec;
    const leaderLaps = plan.driveSec / leaderLap;
    const lapsWith = (delta) => plan.stints.reduce(
      (a, st) => a + Math.max(0, st.durSec) / Math.max(1, st.lapSec + delta), 0);
    // lapsWith diminui quando delta cresce: busca binária do empate com os líderes.
    let lo = -20;
    let hi = 20;
    for (let i = 0; i < 80; i++) {
      const mid = (lo + hi) / 2;
      if (lapsWith(mid) > leaderLaps) lo = mid; else hi = mid;
    }
    const slackSec = (lo + hi) / 2;
    const lapsAhead = plan.totalLaps - leaderLaps;
    return {
      trackBestSec: best,
      leaderLapSec: leaderLap,
      leaderLaps,
      ourLaps: plan.totalLaps,
      lapsAhead,
      secAhead: lapsAhead * leaderLap,
      slackSec,
      perPilot: cfg.pilots.map((p) => ({
        id: p.id,
        name: p.name,
        lapSec: p.lapSec,
        vsBest: p.lapSec - best,
        maxLapSec: p.lapSec + slackSec,
        maxVsBest: p.lapSec + slackSec - best,
      })),
    };
  }

  /**
   * Uma estratégia por piloto abrindo a prova; os outros entram em rodízio na
   * ordem do cadastro. Cada piloto mantém o tempo de stint que tem no plano
   * atual; o último stint fecha a conta.
   */
  function starterScenarios(rawCfg) {
    const cfg = normalizeConfig(rawCfg);
    const base = buildPlan(cfg);
    const n = cfg.stops + 1;
    const stintLen = {};
    for (const p of cfg.pilots) {
      const mine = base.stints.filter((st) => st.pilotId === p.id);
      const beforeStop = mine.filter((st) => st.index < n - 1);
      const pick = beforeStop.length ? beforeStop : mine;
      stintLen[p.id] = pick.length ? pick.reduce((a, st) => a + st.durSec, 0) / pick.length : base.driveSec / n;
    }
    const currentStarter = cfg.order[0];
    const P = cfg.pilots.length;
    return cfg.pilots.map((starter, si) => {
      const order = Array.from({ length: n }, (_, i) => cfg.pilots[(si + i) % P].id);
      const scfg = normalizeConfig({
        ...cfg,
        order,
        stintMode: cfg.stintMode,
        customStintMin: cfg.stintMode === 'custom' ? order.slice(0, n - 1).map((id) => stintLen[id] / 60) : [],
      });
      const plan = buildPlan(scfg);
      const finisher = plan.stints[plan.stints.length - 1];
      const fastest = cfg.pilots.reduce((a, b) => (b.lapSec < a.lapSec ? b : a));
      return {
        starterId: starter.id,
        starterName: starter.name,
        finisherId: finisher.pilotId,
        finisherName: finisher.pilotName,
        fastestStarts: fastest.id === starter.id,
        fastestFinishes: fastest.id === finisher.pilotId,
        inUse: currentStarter === starter.id && cfg.order.every((id, i) => id === order[i]),
        cfg: scfg,
        plan,
        targets: paceTargets(plan),
      };
    });
  }

  // ======================= EQUIPES =======================

  /** Equipe cadastrada a partir da configuração (nome, oficina e pilotos). */
  function teamFromConfig(rawCfg, id) {
    const cfg = normalizeConfig(rawCfg);
    return {
      id: id || 't1',
      name: cfg.teamName,
      workshop: cfg.workshopName,
      pilots: cfg.pilots.map((p) => ({ name: p.name, lapSec: p.lapSec })),
      plan: planOf(cfg),
    };
  }

  /** Escala da equipe (quem pilota cada stint e a duração), guardada junto da equipe. */
  function planOf(rawCfg) {
    const cfg = normalizeConfig(rawCfg);
    return {
      pilotCount: cfg.pilots.length,
      order: cfg.order.slice(),
      stintMode: cfg.stintMode,
      customStintMin: cfg.customStintMin.slice(),
      stintNotes: cfg.stintNotes.slice(),
    };
  }

  /**
   * Duração digitada pela equipe, em segundos: "26:15" (min:s), "1:02:30"
   * (h:min:s) ou minutos com vírgula/ponto ("26,25"). NaN se não entender.
   */
  function parseDuration(text) {
    const t = String(text == null ? '' : text).trim().replace(',', '.');
    if (!t) return NaN;
    if (t.includes(':')) {
      const parts = t.split(':').map((x) => x.trim());
      if (parts.length > 3 || parts.some((x) => !/^\d+(\.\d+)?$/.test(x))) return NaN;
      const nums = parts.map(Number);
      if (nums.slice(1).some((x) => x >= 60)) return NaN;
      return nums.reduce((acc, x) => acc * 60 + x, 0);
    }
    if (!/^\d+(\.\d+)?$/.test(t)) return NaN;
    return Number(t) * 60;
  }

  /** Problemas que impedem salvar a equipe (lista vazia = pode salvar). */
  function validateTeam(team) {
    const errors = [];
    if (!team || !String(team.name || '').trim()) errors.push('Dê um nome para a equipe.');
    const pilots = (team && team.pilots) || [];
    if (pilots.length < 1) errors.push('A equipe precisa de pelo menos 1 piloto.');
    if (pilots.length > MAX_PILOTS) errors.push(`No máximo ${MAX_PILOTS} pilotos por equipe.`);
    pilots.forEach((p, i) => {
      if (!String(p.name || '').trim()) errors.push(`Falta o nome do piloto ${i + 1}.`);
      const lap = num(p.lapSec, NaN);
      if (!Number.isFinite(lap) || lap < 10 || lap > 600) errors.push(`Volta média do piloto ${i + 1} precisa estar entre 10 e 600 s.`);
    });
    return errors;
  }

  /**
   * Usa a equipe na configuração. A escala vem, nesta ordem: da própria
   * equipe (se feita para a mesma quantidade de pilotos), da configuração
   * atual (mesma quantidade) ou do rodízio com stints iguais.
   */
  function applyTeam(rawCfg, team) {
    const cfg = normalizeConfig(rawCfg);
    const count = team.pilots.length;
    const own = team.plan && team.plan.pilotCount === count ? team.plan : null;
    const keep = own || (cfg.pilots.length === count ? cfg : null);
    return normalizeConfig({
      ...cfg,
      teamName: team.name,
      workshopName: team.workshop,
      pilots: team.pilots.map((p) => ({ name: String(p.name).trim(), lapSec: num(p.lapSec, NEW_PILOT_LAP) })),
      order: keep ? keep.order : undefined,
      stintMode: keep ? keep.stintMode : 'equal',
      customStintMin: keep ? keep.customStintMin : [],
      stintNotes: keep ? keep.stintNotes : undefined,
    });
  }

  /** Tempo de pista acumulado por piloto, incluindo o stint em andamento. */
  function driveTimes(cfg, race, elapsed) {
    const totals = {};
    for (const p of cfg.pilots) totals[p.id] = 0;
    let from = 0;
    race.pits.forEach((pit, i) => {
      const id = race.stintPilots[i];
      if (id in totals) totals[id] += Math.max(0, pit.inSec - from);
      from = pit.outSec;
    });
    const cur = race.stintPilots[race.pits.length];
    if (!race.pit && cur in totals) totals[cur] += Math.max(0, Math.min(elapsed, raceSec(cfg)) - from);
    return totals;
  }

  return {
    DEFAULT_CONFIG,
    MAX_PILOTS,
    NEW_PILOT_LAP,
    teamFromConfig,
    planOf,
    parseDuration,
    validateTeam,
    applyTeam,
    normalizeConfig,
    perStopLoss,
    raceSec,
    driveSec,
    equalStints,
    optimizeStints,
    stintDurations,
    stopWindow,
    buildPlan,
    lapsAt,
    yellowGainPerSec,
    lapStats,
    liveStatus,
    boardSign,
    paceTargets,
    starterScenarios,
    driveTimes,
    mean,
    stdev,
  };
});
