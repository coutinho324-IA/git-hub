'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const KS = require('../app/strategy.js');

const near = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} ≉ ${b}`);

// Cenário fixo para testar a matemática: os dois a 48,20 s e stints iguais.
const EQUAL = {
  ...KS.DEFAULT_CONFIG,
  exitMarginSec: 2,
  stintMode: 'equal',
  pilots: [{ name: 'Kaka', lapSec: 48.2 }, { name: 'Guilherme Coutinho', lapSec: 48.2 }],
};

test('plano padrão: 2 h, 3 paradas de 5:00, volta de 48,20 s', () => {
  const plan = KS.buildPlan(EQUAL);
  // 300 s no box + 2 s de folga + 10 s de pit lane + 1,5 s de volta de saída
  near(plan.perStopLoss, 313.5);
  near(plan.driveSec, 7200 - 3 * 313.5);
  assert.equal(plan.stints.length, 4);
  assert.equal(plan.stops.length, 3);
  near(plan.totalLaps, plan.driveSec / 48.2);
  assert.ok(plan.totalLaps > 129 && plan.totalLaps < 131);
  // Stints iguais, alternando Kaka e Guilherme.
  for (const s of plan.stints) near(s.durSec, plan.driveSec / 4);
  assert.deepEqual(plan.stints.map((s) => s.pilotName), ['Kaka', 'Guilherme Coutinho', 'Kaka', 'Guilherme Coutinho']);
  assert.deepEqual(plan.stops.map((s) => s.lap), [32, 65, 97]);
  // O último stint termina exatamente na bandeira.
  near(plan.stints[3].endSec, 7200);
  assert.equal(plan.warnings.length, 0);
});

test('cada piloto pilota metade da prova no plano igual', () => {
  const plan = KS.buildPlan(EQUAL);
  near(plan.perPilot.p1.driveSec, plan.driveSec / 2);
  near(plan.perPilot.p2.driveSec, plan.driveSec / 2);
});

test('janelas respeitam stint mínimo, máximo e prazo final', () => {
  const plan = KS.buildPlan(EQUAL);
  const [s1, s2, s3] = plan.stops;
  near(s1.window.earliestSec, 5 * 60);
  near(s1.window.latestSec, 35 * 60);
  // Depois da 2ª parada sobram 2 stints de no máximo 35 min.
  near(s2.window.earliestSec, 7200 - 313.5 - 2 * 2100 - 313.5);
  // A última parada precisa deixar ao menos o stint mínimo até a bandeira.
  assert.ok(s3.window.latestSec <= 7200 - 313.5 - 300 + 1e-6);
  for (const s of plan.stops) {
    assert.ok(s.window.feasible);
    assert.ok(s.inSec >= s.window.earliestSec && s.inSec <= s.window.latestSec);
    assert.ok(s.idealLaps[0] <= s.lap && s.lap <= s.idealLaps[1]);
  }
});

test('otimizar dá mais pista ao piloto mais rápido até o stint máximo', () => {
  const cfg = KS.normalizeConfig({
    ...EQUAL,
    pilots: [{ name: 'Kaka', lapSec: 48.0 }, { name: 'Guilherme Coutinho', lapSec: 48.4 }],
  });
  const res = KS.optimizeStints(cfg);
  assert.ok(res.feasible);
  // Até o máximo de 35 min, menos a janela de 3 voltas para o prazo não coincidir com o alvo.
  near(res.durs[0], 35 * 60 - 3 * 48.0);
  near(res.durs[2], 35 * 60 - 3 * 48.0);
  near(res.durs.reduce((a, b) => a + b, 0), KS.driveSec(cfg), 1e-6);
  near(res.durs[1], res.durs[3]);

  const equal = KS.buildPlan(cfg);
  const optimized = KS.buildPlan({ ...cfg, stintMode: 'custom', customStintMin: res.durs.slice(0, -1).map((d) => d / 60) });
  assert.ok(optimized.totalLaps > equal.totalLaps);
  assert.equal(optimized.warnings.length, 0);
});

test('otimizar respeita o tempo mínimo por piloto', () => {
  const cfg = KS.normalizeConfig({
    ...EQUAL,
    minDriveMin: 50,
    pilots: [{ name: 'Kaka', lapSec: 48.0 }, { name: 'Guilherme Coutinho', lapSec: 48.4 }],
  });
  const res = KS.optimizeStints(cfg);
  assert.ok(res.feasible);
  near(res.durs[1] + res.durs[3], 50 * 60, 1e-6);
});

test('com ritmos iguais, otimizar mantém stints iguais', () => {
  const cfg = KS.normalizeConfig(EQUAL);
  const res = KS.optimizeStints(cfg);
  for (const d of res.durs) near(d, KS.driveSec(cfg) / 4, 1e-6);
});

test('stints personalizados: o último fecha a conta e gera alerta se passar do máximo', () => {
  const plan = KS.buildPlan({ ...EQUAL, stintMode: 'custom', customStintMin: [20, 20, 20] });
  near(plan.stints[3].durSec, plan.driveSec - 3 * 20 * 60);
  assert.ok(plan.warnings.some((w) => w.level === 'critical' && /stint máximo/.test(w.text)));
});

test('normalizeConfig ajusta ordem e listas quando muda o número de paradas', () => {
  const cfg = KS.normalizeConfig({ ...EQUAL, stops: 5 });
  assert.equal(cfg.order.length, 6);
  assert.equal(cfg.customStintMin.length, 5);
  assert.equal(KS.buildPlan(cfg).stops.length, 5);
});

test('ao vivo: estados da janela da próxima parada', () => {
  const cfg = KS.normalizeConfig(EQUAL);
  const plan = KS.buildPlan(cfg);
  const race = { laps: [], pits: [], pit: null, yellow: false, stintPilots: ['p1'] };
  assert.equal(KS.liveStatus(cfg, plan, race, 60).nextStop.state, 'locked');
  assert.equal(KS.liveStatus(cfg, plan, race, 10 * 60).nextStop.state, 'open');
  assert.equal(KS.liveStatus(cfg, plan, race, plan.stops[0].inSec).nextStop.state, 'ideal');
  assert.equal(KS.liveStatus(cfg, plan, race, 34 * 60).nextStop.state, 'late');
  const over = KS.liveStatus(cfg, plan, race, 36 * 60);
  assert.equal(over.nextStop.state, 'overdue');
  assert.ok(over.alerts.some((a) => a.level === 'critical'));
});

test('ao vivo: bandeira amarela com janela aberta recomenda parar', () => {
  const cfg = KS.normalizeConfig(EQUAL);
  const plan = KS.buildPlan(cfg);
  const race = { laps: [], pits: [], pit: null, yellow: true, stintPilots: ['p1'] };
  const st = KS.liveStatus(cfg, plan, race, 20 * 60);
  assert.ok(st.alerts.some((a) => a.level === 'good'));
});

test('ao vivo: parada antecipada redistribui o tempo restante', () => {
  const cfg = KS.normalizeConfig(EQUAL);
  const plan = KS.buildPlan(cfg);
  const race = {
    laps: [], pit: null, yellow: false, stintPilots: ['p1', 'p2'],
    pits: [{ inSec: 20 * 60, outSec: 20 * 60 + 302, pilotOut: 'p1', pilotIn: 'p2' }],
  };
  const st = KS.liveStatus(cfg, plan, race, 25 * 60);
  assert.equal(st.stopsDone, 1);
  assert.equal(st.pilotName, 'Guilherme Coutinho');
  // 3 stints restantes dividem o tempo que sobra igualmente.
  const lastOut = 20 * 60 + 302;
  const expected = lastOut + (7200 - lastOut - 2 * plan.perStopLoss) / 3;
  near(st.nextStop.targetSec, expected, 1e-6);
});

test('ao vivo: alerta de queda de ritmo', () => {
  const cfg = KS.normalizeConfig(EQUAL);
  const plan = KS.buildPlan(cfg);
  const laps = [49.0, 48.9, 49.1].map((sec, i) => ({ n: i + 1, sec, pilot: 'p1', stint: 0, kind: 'green' }));
  const st = KS.liveStatus(cfg, plan, { laps, pits: [], pit: null, yellow: false, stintPilots: ['p1'] }, 10 * 60);
  assert.ok(st.alerts.some((a) => a.level === 'warning' && /Ritmo caiu/.test(a.text)));
});

test('estatísticas de volta ignoram volta de saída e amarela', () => {
  const laps = [
    { pilot: 'p1', kind: 'green', sec: 48.1 },
    { pilot: 'p1', kind: 'green', sec: 48.3 },
    { pilot: 'p1', kind: 'out', sec: 55 },
    { pilot: 'p1', kind: 'yellow', sec: 65 },
    { pilot: 'p2', kind: 'green', sec: 48.0 },
  ];
  const s = KS.lapStats(laps, 'p1');
  assert.equal(s.count, 2);
  near(s.best, 48.1);
  near(s.avg, 48.2);
});

test('tempo de pista por piloto soma stints fechados e o atual', () => {
  const cfg = KS.normalizeConfig(EQUAL);
  const race = {
    pit: null, stintPilots: ['p1', 'p2'],
    pits: [{ inSec: 1500, outSec: 1802 }],
  };
  const t = KS.driveTimes(cfg, race, 2000);
  near(t.p1, 1500);
  near(t.p2, 198);
});

test('ganho por segundo de parada sob amarela', () => {
  const cfg = KS.normalizeConfig(EQUAL);
  near(KS.yellowGainPerSec(cfg, 48.2), 1 - 48.2 / 65);
});

test('amarela no começo do stint não chama para o box', () => {
  const cfg = KS.normalizeConfig(EQUAL);
  const plan = KS.buildPlan(cfg);
  const race = { laps: [], pits: [], pit: null, yellow: true, stintPilots: ['p1'] };
  const st = KS.liveStatus(cfg, plan, race, 10 * 60);
  assert.equal(st.yellowStop, false);
  assert.ok(st.alerts.some((a) => a.level === 'warning' && /Siga o plano/.test(a.text)));
  assert.equal(st.sign.text, 'OK');
  const later = KS.liveStatus(cfg, plan, race, 16 * 60);
  assert.equal(later.yellowStop, true);
  assert.equal(later.sign.text, 'BOX');
});

test('placa de box: OK, contagem de voltas, BOX e RITMO', () => {
  const cfg = KS.normalizeConfig(EQUAL);
  const plan = KS.buildPlan(cfg);
  const race = { laps: [], pits: [], pit: null, yellow: false, stintPilots: ['p1'] };
  const target = plan.stops[0].inSec;
  assert.equal(KS.liveStatus(cfg, plan, race, 10 * 60).sign.text, 'OK');
  assert.equal(KS.liveStatus(cfg, plan, race, target - 3 * 48.2).sign.text, '3');
  assert.equal(KS.liveStatus(cfg, plan, race, target - 0.8 * 48.2).sign.text, 'BOX');
  assert.equal(KS.liveStatus(cfg, plan, race, 34 * 60).sign.text, 'BOX');
  const slow = [49.0, 48.9, 49.1].map((sec, i) => ({ n: i + 1, sec, pilot: 'p1', stint: 0, kind: 'green' }));
  assert.equal(KS.liveStatus(cfg, plan, { ...race, laps: slow }, 10 * 60).sign.text, 'RITMO');
});

test('plano da equipe: 4 turnos de 26:15 revezando Kaka (A) e Guilherme (B)', () => {
  const plan = KS.buildPlan(KS.DEFAULT_CONFIG);
  assert.deepEqual(plan.stints.map((s) => s.pilotName), ['Kaka', 'Guilherme Coutinho', 'Kaka', 'Guilherme Coutinho']);
  for (const i of [0, 1, 2]) near(plan.stints[i].durSec, 26 * 60 + 15);
  near(plan.stints[0].endSec, 26 * 60 + 15); // 1ª parada aos 26:15
  near(plan.stints[3].endSec, 7200); // último turno fecha a conta até a bandeira
  assert.ok(plan.stints[3].durSec < 26 * 60 + 15); // as paradas custam mais que 5:00
  assert.equal(plan.warnings.length, 0);
  assert.deepEqual(plan.stints.map((s) => s.note.length > 0), [true, true, true, true]);
  for (const s of plan.stops) assert.ok(s.window.latestSec - s.inSec >= 3 * 60, `parada ${s.index + 1} sem folga`);
});

test('duração digitada: min:s, h:min:s ou minutos', () => {
  assert.equal(KS.parseDuration('26:15'), 1575);
  assert.equal(KS.parseDuration('1:02:30'), 3750);
  assert.equal(KS.parseDuration('26,25'), 1575);
  assert.ok(Number.isNaN(KS.parseDuration('26:75')));
  assert.ok(Number.isNaN(KS.parseDuration('abc')));
});

test('ação de cada turno acompanha a quantidade de turnos', () => {
  // Sem anotações informadas e com outra quantidade de turnos: ficam em branco.
  const { stintNotes, ...noNotes } = KS.DEFAULT_CONFIG;
  assert.equal(stintNotes.length, 4);
  assert.deepEqual(KS.normalizeConfig({ ...noNotes, stops: 1 }).stintNotes, ['', '']);
  // Com anotações informadas, mantém as primeiras.
  assert.deepEqual(KS.normalizeConfig({ ...KS.DEFAULT_CONFIG, stops: 1 }).stintNotes, stintNotes.slice(0, 2));
  const kept = KS.normalizeConfig({ ...KS.DEFAULT_CONFIG, stintNotes: ['a', 'b', 'c', 'd', 'e'] });
  assert.deepEqual(kept.stintNotes, ['a', 'b', 'c', 'd']);
});

test('otimizar nunca marca a parada em cima do prazo', () => {
  const cfg = KS.normalizeConfig(KS.DEFAULT_CONFIG);
  const res = KS.optimizeStints(cfg);
  const plan = KS.buildPlan({ ...cfg, stintMode: 'custom', customStintMin: res.durs.slice(0, -1).map((d) => d / 60) });
  for (const s of plan.stops) assert.ok(s.idealLaps[1] > s.lap, `parada ${s.index + 1} sem janela depois do alvo`);
});

test('meta: ritmo dos líderes e folga por volta de cada piloto', () => {
  const plan = KS.buildPlan(KS.DEFAULT_CONFIG); // menor tempo 47,60; líderes +0,80
  const t = KS.paceTargets(plan);
  near(t.leaderLapSec, 48.4, 1e-9);
  near(t.leaderLaps, plan.driveSec / 48.4, 1e-9);
  assert.ok(t.lapsAhead > 0);
  assert.ok(t.slackSec > 0);
  // Andando exatamente no máximo, a equipe empata com os líderes.
  const atMax = plan.stints.reduce((a, s) => a + s.durSec / (s.lapSec + t.slackSec), 0);
  near(atMax, t.leaderLaps, 1e-6);
  const kaka = t.perPilot[0];
  near(kaka.vsBest, 48.05 - 47.6, 1e-9);
  near(kaka.maxLapSec, 48.05 + t.slackSec, 1e-9);
});

test('meta: líderes mais rápidos pedem ganho por volta; sem menor tempo não há meta', () => {
  const fast = KS.paceTargets(KS.buildPlan({ ...KS.DEFAULT_CONFIG, leaderGapSec: 0.3 }));
  assert.ok(fast.lapsAhead < 0);
  assert.ok(fast.slackSec < 0);
  assert.equal(KS.paceTargets(KS.buildPlan({ ...KS.DEFAULT_CONFIG, trackBestSec: 0 })), null);
});

test('estratégias A e B: cada piloto abre e cada um mantém seu tempo de turno', () => {
  const [a, b] = KS.starterScenarios(KS.DEFAULT_CONFIG);
  assert.equal(a.starterName, 'Kaka');
  assert.equal(a.finisherName, 'Guilherme Coutinho');
  assert.ok(a.inUse);
  assert.equal(b.starterName, 'Guilherme Coutinho');
  assert.equal(b.finisherName, 'Kaka');
  assert.ok(!b.inUse);
  assert.ok(b.fastestFinishes);
  // O último turno fecha a conta: quem fecha pilota um pouco menos. Com o mais
  // rápido abrindo (A), sai um pouquinho mais de voltas.
  near(a.plan.totalLaps, b.plan.totalLaps, 0.05);
  assert.ok(a.plan.totalLaps >= b.plan.totalLaps);
  assert.equal(a.plan.warnings.length, 0);
  assert.equal(b.plan.warnings.length, 0);
  near(b.plan.stints[0].durSec, a.plan.stints[1].durSec, 1e-6);
  near(b.plan.stints[1].durSec, 26 * 60 + 15, 1e-6);
});

test('equipes: 3 pilotos se revezam e cada um pode abrir a prova', () => {
  const cfg = KS.applyTeam(KS.DEFAULT_CONFIG, {
    name: 'Equipe Teste',
    workshop: 'Oficina do Zé',
    pilots: [{ name: 'Ana', lapSec: 48.0 }, { name: 'Bruno', lapSec: 48.3 }, { name: 'Caio', lapSec: 48.6 }],
  });
  assert.equal(cfg.teamName, 'Equipe Teste');
  assert.equal(cfg.workshopName, 'Oficina do Zé');
  assert.deepEqual(cfg.pilots.map((p) => p.id), ['p1', 'p2', 'p3']);
  assert.deepEqual(cfg.order, ['p1', 'p2', 'p3', 'p1']);
  assert.equal(cfg.stintMode, 'equal'); // mudou a quantidade de pilotos
  const plan = KS.buildPlan(cfg);
  assert.equal(plan.warnings.length, 0);
  const sc = KS.starterScenarios(cfg);
  assert.deepEqual(sc.map((s) => s.starterName), ['Ana', 'Bruno', 'Caio']);
  assert.deepEqual(sc[1].plan.stints.map((s) => s.pilotName), ['Bruno', 'Caio', 'Ana', 'Bruno']);
  // Quem abre pilota 2 stints: abrir com o mais rápido dá mais voltas.
  assert.ok(sc[0].plan.totalLaps > sc[2].plan.totalLaps);
  const t = KS.paceTargets(plan);
  assert.equal(t.perPilot.length, 3);
});

test('equipes: mesma quantidade de pilotos mantém escala e stints', () => {
  const cfg = KS.applyTeam(KS.DEFAULT_CONFIG, {
    name: 'Aristeu Just Motors',
    workshop: '',
    pilots: [{ name: 'Kaka', lapSec: 47.9 }, { name: 'Guilherme Coutinho', lapSec: 48.4 }],
  });
  assert.equal(cfg.stintMode, 'custom');
  assert.deepEqual(cfg.customStintMin, KS.DEFAULT_CONFIG.customStintMin);
  near(cfg.pilots[0].lapSec, 47.9);
});

test('equipes: validação e equipe a partir da configuração', () => {
  assert.deepEqual(KS.validateTeam({ name: 'X', pilots: [{ name: 'A', lapSec: 48 }] }), []);
  const errs = KS.validateTeam({ name: ' ', pilots: [{ name: '', lapSec: 5 }] });
  assert.equal(errs.length, 3);
  assert.ok(KS.validateTeam({ name: 'X', pilots: [] }).length > 0);
  const tooMany = Array.from({ length: KS.MAX_PILOTS + 1 }, (_, i) => ({ name: `P${i}`, lapSec: 48 }));
  assert.ok(KS.validateTeam({ name: 'X', pilots: tooMany }).some((e) => /No máximo/.test(e)));
  const team = KS.teamFromConfig(KS.DEFAULT_CONFIG, 't9');
  assert.equal(team.id, 't9');
  assert.equal(team.name, 'Aristeu Just Motors');
  assert.deepEqual(team.pilots.map((p) => p.name), ['Kaka', 'Guilherme Coutinho']);
});

test('normalizeConfig aceita de 1 a 6 pilotos', () => {
  const one = KS.normalizeConfig({ ...KS.DEFAULT_CONFIG, order: undefined, pilots: [{ name: 'Solo', lapSec: 48 }] });
  assert.deepEqual(one.order, ['p1', 'p1', 'p1', 'p1']);
  const many = KS.normalizeConfig({ ...KS.DEFAULT_CONFIG, pilots: Array.from({ length: 9 }, (_, i) => ({ name: `P${i}`, lapSec: 48 })) });
  assert.equal(many.pilots.length, KS.MAX_PILOTS);
});

test('equipes: cada equipe guarda a própria escala', () => {
  const aristeu = KS.teamFromConfig(KS.DEFAULT_CONFIG, 't1');
  const trio = {
    id: 't2', name: 'Trio', workshop: '',
    pilots: [{ name: 'A', lapSec: 48 }, { name: 'B', lapSec: 48 }, { name: 'C', lapSec: 48 }],
  };
  let cfg = KS.applyTeam(KS.DEFAULT_CONFIG, trio);
  assert.equal(cfg.stintMode, 'equal');
  cfg = KS.applyTeam(cfg, aristeu); // volta: escala 30/22 da própria equipe
  assert.equal(cfg.stintMode, 'custom');
  assert.deepEqual(cfg.customStintMin, KS.DEFAULT_CONFIG.customStintMin);
  assert.deepEqual(cfg.order, ['p1', 'p2', 'p1', 'p2']);
  // Escala salva para outra quantidade de pilotos é ignorada.
  const grown = { ...aristeu, pilots: [...aristeu.pilots, { name: 'Novo', lapSec: 48.5 }] };
  const g = KS.applyTeam(KS.DEFAULT_CONFIG, grown);
  assert.deepEqual(g.order, ['p1', 'p2', 'p3', 'p1']);
  assert.equal(g.stintMode, 'equal');
});

test('box libera em 5:03 (3 s de folga)', () => {
  const cfg = KS.normalizeConfig(KS.DEFAULT_CONFIG);
  assert.equal(cfg.minPitSec + cfg.exitMarginSec, 303);
  const plan = KS.buildPlan(cfg);
  near(plan.perStopLoss, 314.5);
  near(plan.stints[3].endSec, 7200, 1e-6);
});

test('comparar: 6 modelos de divisão e a divisão livre', () => {
  assert.equal(KS.SPLIT_LAYOUTS.length, 6);
  const count = (id) => KS.splitCells(id).cells.length;
  assert.deepEqual(['c2', 'r2', 'c3', 'g4', 'b3', 'g6'].map(count), [2, 2, 3, 4, 3, 6]);
  // Partes iguais: cada parte ocupa uma célula da grade.
  const g6 = KS.splitCells('g6');
  assert.deepEqual([g6.cols, g6.rows], [3, 2]);
  assert.ok(g6.cells.every((c) => c.colSpan === 1 && c.rowSpan === 1));
  assert.deepEqual(g6.cells[4], { col: 2, row: 2, colSpan: 1, rowSpan: 1 });
  // 1 grande + 2: a primeira parte ocupa as duas linhas.
  assert.deepEqual(KS.splitCells('b3').cells[0], { col: 1, row: 1, colSpan: 1, rowSpan: 2 });
  // Livre: colunas × linhas, dentro dos limites.
  const free = KS.splitCells('free', 4, 3);
  assert.equal(free.id, 'free');
  assert.equal(free.cells.length, 12);
  const capped = KS.splitCells('free', 9, 0);
  assert.deepEqual([capped.cols, capped.rows], [KS.SPLIT_MAX_COLS, 1]);
  assert.equal(KS.splitCells('???', 'x', null).cells.length, 2);
});

test('comparar: escala da equipe, quem abre e otimizada', () => {
  const cfg = KS.normalizeConfig(KS.DEFAULT_CONFIG);
  assert.deepEqual(KS.variantConfig(cfg, 'plan').order, cfg.order);
  const g = KS.variantConfig(cfg, 'p2');
  assert.equal(g.order[0], 'p2');
  assert.equal(KS.buildPlan(g).stints[0].pilotName, 'Guilherme Coutinho');
  // Otimizada: o mais rápido (Kaka) pilota mais e a equipe faz mais voltas.
  const opt = KS.buildPlan(KS.variantConfig(cfg, 'opt'));
  const base = KS.buildPlan(cfg);
  assert.ok(opt.perPilot.p1.driveSec > opt.perPilot.p2.driveSec);
  assert.ok(opt.totalLaps > base.totalLaps);
  assert.equal(opt.warnings.filter((w) => w.level === 'critical').length, 0);
  // Escala desconhecida (piloto que não existe) cai na da equipe.
  assert.deepEqual(KS.variantConfig(cfg, 'p6').order, cfg.order);
});

test('comparar: classificação pelas voltas, com empate abaixo de meio segundo', () => {
  const mk = (laps) => ({ totalLaps: laps, driveSec: laps * 48 });
  const r = KS.rankByLaps([mk(129.5), mk(130), mk(129.995), mk(128)]);
  assert.deepEqual(r.map((x) => x.pos), [3, 1, 1, 4]);
  assert.equal(r[1].secBehind, 0);
  assert.equal(r[2].secBehind, 0); // 0,005 volta = 0,24 s: empate
  near(r[0].lapsBehind, 0.5);
  near(r[0].secBehind, 24);
  near(r[3].secBehind, 96);
  assert.deepEqual(KS.rankByLaps([]), []);
});

test('comparar: tela dividida sozinha para n equipes', () => {
  const ids = Array.from({ length: 12 }, (_, i) => KS.fitSplit(i + 1).id);
  assert.deepEqual(ids, ['free', 'c2', 'c3', 'g4', 'auto', 'g6', 'auto', 'free', 'free', 'auto', 'auto', 'free']);
  for (let n = 1; n <= 12; n++) {
    const s = KS.fitSplit(n);
    assert.equal(s.cells.length, n);
    // Cada linha fica cheia: a soma das larguras é a grade inteira.
    for (let r = 1; r <= s.rows; r++) {
      const row = s.cells.filter((c) => c.row === r);
      assert.equal(row.reduce((a, c) => a + c.colSpan, 0), s.cols, `n=${n}, linha ${r}`);
    }
  }
  // 5 equipes: 3 em cima e 2 mais largas embaixo.
  assert.deepEqual(KS.fitSplit(5).cells.map((c) => [c.row, c.colSpan]), [[1, 2], [1, 2], [1, 2], [2, 3], [2, 3]]);
  assert.equal(KS.splitCells('auto', 0, 0, 7).cells.length, 7);
  assert.equal(KS.fitSplit(40).cells.length, 12);
});

test('configurações: nome e ordem dos menus', () => {
  const ids = ['equipes', 'plano', 'comparar', 'vivo', 'analise', 'manual'];
  const d = KS.normalizeMenus(null, ids);
  assert.deepEqual(d.order, ids);
  assert.deepEqual(d.names, {});
  // Ordem salva com id repetido, id que não existe e menu faltando.
  const m = KS.normalizeMenus({ order: ['vivo', 'vivo', 'xx', 'plano'], names: { vivo: '  Box   ao vivo ', plano: '', xx: 'Nada' } }, ids);
  assert.deepEqual(m.order, ['vivo', 'plano', 'equipes', 'comparar', 'analise', 'manual']);
  assert.deepEqual(m.names, { vivo: 'Box ao vivo' });
  assert.equal(KS.normalizeMenus({ names: { manual: 'x'.repeat(40) } }, ids).names.manual.length, KS.MENU_NAME_MAX);
  // Arrastar: tira da posição e coloca na nova, sem mexer na lista original.
  assert.deepEqual(KS.moveItem(ids, 5, 0), ['manual', 'equipes', 'plano', 'comparar', 'vivo', 'analise']);
  assert.deepEqual(KS.moveItem(ids, 0, 2), ['plano', 'comparar', 'equipes', 'vivo', 'analise', 'manual']);
  assert.deepEqual(KS.moveItem(ids, 1, 99).at(-1), 'plano');
  assert.deepEqual(ids[0], 'equipes');
});
