'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const KS = require('../app/strategy.js');

const near = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} ≉ ${b}`);

// Cenário fixo para testar a matemática: os dois a 48,20 s e stints iguais.
const EQUAL = {
  ...KS.DEFAULT_CONFIG,
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

test('plano da equipe: Kaka 48,05 s com stints de 30 min, Guilherme 48,40 s', () => {
  const plan = KS.buildPlan(KS.DEFAULT_CONFIG);
  assert.deepEqual(plan.stints.map((s) => s.pilotName), ['Kaka', 'Guilherme Coutinho', 'Kaka', 'Guilherme Coutinho']);
  near(plan.stints[0].durSec, 30 * 60);
  near(plan.stints[2].durSec, 30 * 60);
  near(plan.stints[1].durSec, plan.stints[3].durSec, 1e-6);
  near(plan.perPilot.p1.driveSec, 60 * 60);
  assert.equal(plan.warnings.length, 0);
  // Mais voltas que dividir igual.
  const equal = KS.buildPlan({ ...KS.DEFAULT_CONFIG, stintMode: 'equal' });
  assert.ok(plan.totalLaps > equal.totalLaps);
  // Toda parada tem folga até o prazo e a janela ideal passa da volta-alvo.
  for (const s of plan.stops) {
    assert.ok(s.window.latestSec - s.inSec >= 3 * 60, `parada ${s.index + 1} sem folga`);
    assert.ok(s.idealLaps[1] > s.lap);
  }
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

test('estratégias A e B: cada piloto abre, mesmo total de voltas e mesmo tempo por piloto', () => {
  const [a, b] = KS.starterScenarios(KS.DEFAULT_CONFIG);
  assert.equal(a.starterName, 'Kaka');
  assert.equal(a.finisherName, 'Guilherme Coutinho');
  assert.ok(a.inUse);
  assert.equal(b.starterName, 'Guilherme Coutinho');
  assert.equal(b.finisherName, 'Kaka');
  assert.ok(!b.inUse);
  assert.ok(b.fastestFinishes);
  near(a.plan.totalLaps, b.plan.totalLaps, 1e-9);
  near(a.plan.perPilot.p1.driveSec, b.plan.perPilot.p1.driveSec, 1e-6);
  assert.equal(a.plan.warnings.length, 0);
  assert.equal(b.plan.warnings.length, 0);
  near(b.plan.stints[0].durSec, a.plan.stints[1].durSec, 1e-6);
  near(b.plan.stints[1].durSec, 30 * 60, 1e-6);
});
