'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const KS = require('../app/strategy.js');

const near = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} ≉ ${b}`);

test('plano padrão: 2 h, 3 paradas de 5:00, volta de 48,20 s', () => {
  const plan = KS.buildPlan(KS.DEFAULT_CONFIG);
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
  const plan = KS.buildPlan(KS.DEFAULT_CONFIG);
  near(plan.perPilot.p1.driveSec, plan.driveSec / 2);
  near(plan.perPilot.p2.driveSec, plan.driveSec / 2);
});

test('janelas respeitam stint mínimo, máximo e prazo final', () => {
  const plan = KS.buildPlan(KS.DEFAULT_CONFIG);
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
    ...KS.DEFAULT_CONFIG,
    pilots: [{ name: 'Kaka', lapSec: 48.0 }, { name: 'Guilherme Coutinho', lapSec: 48.4 }],
  });
  const res = KS.optimizeStints(cfg);
  assert.ok(res.feasible);
  near(res.durs[0], 35 * 60);
  near(res.durs[2], 35 * 60);
  near(res.durs.reduce((a, b) => a + b, 0), KS.driveSec(cfg), 1e-6);
  near(res.durs[1], res.durs[3]);

  const equal = KS.buildPlan(cfg);
  const optimized = KS.buildPlan({ ...cfg, stintMode: 'custom', customStintMin: res.durs.slice(0, -1).map((d) => d / 60) });
  assert.ok(optimized.totalLaps > equal.totalLaps);
  assert.equal(optimized.warnings.length, 0);
});

test('otimizar respeita o tempo mínimo por piloto', () => {
  const cfg = KS.normalizeConfig({
    ...KS.DEFAULT_CONFIG,
    minDriveMin: 50,
    pilots: [{ name: 'Kaka', lapSec: 48.0 }, { name: 'Guilherme Coutinho', lapSec: 48.4 }],
  });
  const res = KS.optimizeStints(cfg);
  assert.ok(res.feasible);
  near(res.durs[1] + res.durs[3], 50 * 60, 1e-6);
});

test('com ritmos iguais, otimizar mantém stints iguais', () => {
  const cfg = KS.normalizeConfig(KS.DEFAULT_CONFIG);
  const res = KS.optimizeStints(cfg);
  for (const d of res.durs) near(d, KS.driveSec(cfg) / 4, 1e-6);
});

test('stints personalizados: o último fecha a conta e gera alerta se passar do máximo', () => {
  const plan = KS.buildPlan({ ...KS.DEFAULT_CONFIG, stintMode: 'custom', customStintMin: [20, 20, 20] });
  near(plan.stints[3].durSec, plan.driveSec - 3 * 20 * 60);
  assert.ok(plan.warnings.some((w) => w.level === 'critical' && /stint máximo/.test(w.text)));
});

test('normalizeConfig ajusta ordem e listas quando muda o número de paradas', () => {
  const cfg = KS.normalizeConfig({ ...KS.DEFAULT_CONFIG, stops: 5 });
  assert.equal(cfg.order.length, 6);
  assert.equal(cfg.customStintMin.length, 5);
  assert.equal(KS.buildPlan(cfg).stops.length, 5);
});

test('ao vivo: estados da janela da próxima parada', () => {
  const cfg = KS.normalizeConfig(KS.DEFAULT_CONFIG);
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
  const cfg = KS.normalizeConfig(KS.DEFAULT_CONFIG);
  const plan = KS.buildPlan(cfg);
  const race = { laps: [], pits: [], pit: null, yellow: true, stintPilots: ['p1'] };
  const st = KS.liveStatus(cfg, plan, race, 20 * 60);
  assert.ok(st.alerts.some((a) => a.level === 'good'));
});

test('ao vivo: parada antecipada redistribui o tempo restante', () => {
  const cfg = KS.normalizeConfig(KS.DEFAULT_CONFIG);
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
  const cfg = KS.normalizeConfig(KS.DEFAULT_CONFIG);
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
  const cfg = KS.normalizeConfig(KS.DEFAULT_CONFIG);
  const race = {
    pit: null, stintPilots: ['p1', 'p2'],
    pits: [{ inSec: 1500, outSec: 1802 }],
  };
  const t = KS.driveTimes(cfg, race, 2000);
  near(t.p1, 1500);
  near(t.p2, 198);
});

test('ganho por segundo de parada sob amarela', () => {
  const cfg = KS.normalizeConfig(KS.DEFAULT_CONFIG);
  near(KS.yellowGainPerSec(cfg, 48.2), 1 - 48.2 / 65);
});

test('amarela no começo do stint não chama para o box', () => {
  const cfg = KS.normalizeConfig(KS.DEFAULT_CONFIG);
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
  const cfg = KS.normalizeConfig(KS.DEFAULT_CONFIG);
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
