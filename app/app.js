/* App da equipe — interface do motor de estratégia (strategy.js). */
(function () {
  'use strict';

  const KS = window.KartStrategy;
  const STORAGE_KEY = 'ajm-kart-v1';
  const TABS = ['equipes', 'plano', 'vivo', 'analise', 'manual'];
  // Uma cor por posição do piloto no cadastro (até 6) e a cor do texto sobre ela.
  const PILOT_VARS = ['--p1', '--p2', '--p3', '--p4', '--p5', '--p6'];
  const PILOT_ON = ['#ffffff', '#111517', '#111517', '#111517', '#111517', '#ffffff'];

  const $ = (id) => document.getElementById(id);

  // ---------- Formatação ----------
  function pad2(n) { return String(n).padStart(2, '0'); }
  function fmtClock(sec) {
    if (!Number.isFinite(sec)) return '–';
    const neg = sec < 0;
    let s = Math.round(Math.abs(sec));
    const h = Math.floor(s / 3600); s -= h * 3600;
    const m = Math.floor(s / 60); s -= m * 60;
    const body = h ? `${h}:${pad2(m)}:${pad2(s)}` : `${m}:${pad2(s)}`;
    return neg ? `-${body}` : body;
  }
  function fmtHMS(sec) {
    let s = Math.max(0, Math.floor(sec));
    const h = Math.floor(s / 3600); s -= h * 3600;
    const m = Math.floor(s / 60); s -= m * 60;
    return `${h}:${pad2(m)}:${pad2(s)}`;
  }
  function fmtNum(x, d) {
    if (!Number.isFinite(x)) return '–';
    return x.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
  }
  function fmtLap(sec) { return fmtNum(sec, 2); }
  function fmtSigned(x, d) {
    if (!Number.isFinite(x)) return '–';
    return (x > 0 ? '+' : x < 0 ? '−' : '±') + fmtNum(Math.abs(x), d);
  }
  function firstName(name) { return String(name).trim().split(/\s+/)[0] || name; }

  // ---------- Estado ----------
  function newRace() {
    return {
      startedAt: null, pausedAt: null, pausedMs: 0, frozenElapsed: null,
      stintPilots: [], laps: [], pits: [], pit: null,
      yellow: false, lastCross: 0, outLapPending: false, example: false,
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  // v2: tempos medidos (Kaka 48,05 / Guilherme 48,40) e stints 30/22 min.
  // v3: folga de saída do box de 2 para 3 s (libera em 5:03).
  // v4: plano padrão de 4 turnos de 26:15 (A, B, A, B) com a ação de cada turno.
  const CFG_VERSION = 4;
  const OLD_STINTS_V2 = [30, 22.1625, 30];
  const OLD_STINTS_V3 = [30, 22.1375, 30];
  const saved = load() || {};
  const fromVersion = saved.cfg ? (saved.cfgVersion || 1) : CFG_VERSION;
  let cfg = KS.normalizeConfig(saved.cfg || KS.DEFAULT_CONFIG);
  if (fromVersion < 2) cfg = migrateCfg(cfg);
  if (fromVersion < 3) cfg = migrateMargin(cfg);
  if (fromVersion < 4) cfg = migrateStints(cfg);

  /** Quem estava com o plano padrão 30/22 passa para os 4 turnos de 26:15. */
  function isOldDefaultStints(c) {
    return c && c.stintMode === 'custom' && (sameStints(c.customStintMin, OLD_STINTS_V2) || sameStints(c.customStintMin, OLD_STINTS_V3));
  }
  function migrateStints(c) {
    if (!isOldDefaultStints(c)) return c;
    return KS.normalizeConfig({ ...c, customStintMin: KS.DEFAULT_CONFIG.customStintMin.slice() });
  }

  function sameStints(a, b) {
    return Array.isArray(a) && a.length === b.length && a.every((x, i) => Math.abs(x - b[i]) < 1e-6);
  }

  /** Folga padrão antiga (2 s) vira 3 s; o plano 30/22 é reajustado para os stints do Guilherme ficarem iguais. */
  function migrateMargin(c) {
    if (Math.abs(c.exitMarginSec - 2) > 1e-9) return c;
    const next = { ...c, exitMarginSec: KS.DEFAULT_CONFIG.exitMarginSec };
    if (c.stintMode === 'custom' && sameStints(c.customStintMin, OLD_STINTS_V2)) {
      next.customStintMin = KS.DEFAULT_CONFIG.customStintMin.slice();
    }
    return KS.normalizeConfig(next);
  }

  /** Quem nunca mexeu nos tempos (48,20 padrão antigo) recebe os tempos e o plano novos. */
  function migrateCfg(c) {
    const d = KS.DEFAULT_CONFIG;
    const untouched = c.pilots.every((p) => Math.abs(p.lapSec - 48.2) < 1e-9);
    if (!untouched) return c;
    const next = { ...c, pilots: c.pilots.map((p, i) => ({ ...p, lapSec: d.pilots[i] ? d.pilots[i].lapSec : p.lapSec })) };
    if (c.stintMode === 'equal' && c.stops === d.stops && c.raceMin === d.raceMin) {
      next.stintMode = d.stintMode;
      next.customStintMin = d.customStintMin.slice();
    }
    return KS.normalizeConfig(next);
  }
  let race = Object.assign(newRace(), saved.race || {});
  const ui = Object.assign({ tab: 'plano', sound: true }, saved.ui || {});

  // Equipes cadastradas. A primeira vem da configuração atual.
  let teams = Array.isArray(saved.teams) && saved.teams.length ? saved.teams : [KS.teamFromConfig(cfg, 't1')];
  if (fromVersion < 4) {
    teams = teams.map((t) => (isOldDefaultStints(t.plan)
      ? { ...t, plan: { ...t.plan, customStintMin: KS.DEFAULT_CONFIG.customStintMin.slice() } }
      : t));
  }
  let activeTeamId = teams.some((t) => t.id === saved.activeTeamId) ? saved.activeTeamId : teams[0].id;

  let plan = KS.buildPlan(cfg);
  let planNotes = [];

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ cfg, cfgVersion: CFG_VERSION, race, ui, teams, activeTeamId }));
    } catch (e) { /* sem armazenamento */ }
  }

  function pilotIndex(id) { return Math.max(0, cfg.pilots.findIndex((p) => p.id === id)); }
  function pilotVar(id) { return `var(${PILOT_VARS[pilotIndex(id)] || '--p1'})`; }
  function pilotName(id) { return (cfg.pilots.find((p) => p.id === id) || cfg.pilots[0]).name; }

  // ---------- Relógio ----------
  function started() { return race.startedAt != null; }
  function elapsedSec() {
    if (race.frozenElapsed != null) return race.frozenElapsed;
    if (!started()) return 0;
    const now = race.pausedAt || Date.now();
    return Math.max(0, (now - race.startedAt - race.pausedMs) / 1000);
  }

  // ---------- Tooltip ----------
  const tip = $('tooltip');
  function showTip(x, y, title, rows) {
    tip.replaceChildren();
    const t = document.createElement('div');
    t.className = 'tt-title';
    t.textContent = title;
    tip.appendChild(t);
    for (const r of rows) {
      const row = document.createElement('div');
      row.className = 'tt-row';
      if (r.color) {
        const k = document.createElement('i');
        k.className = r.rect ? 'key-rect' : 'key-line';
        k.style.background = r.color;
        row.appendChild(k);
      }
      const b = document.createElement('b');
      b.textContent = r.value;
      row.appendChild(b);
      if (r.label) {
        const s = document.createElement('span');
        s.textContent = r.label;
        row.appendChild(s);
      }
      tip.appendChild(row);
    }
    tip.hidden = false;
    const w = tip.offsetWidth;
    const h = tip.offsetHeight;
    const left = Math.min(window.innerWidth - w - 8, x + 14);
    const top = y + 14 + h > window.innerHeight ? y - h - 10 : y + 14;
    tip.style.left = `${Math.max(8, left)}px`;
    tip.style.top = `${Math.max(8, top)}px`;
  }
  function hideTip() { tip.hidden = true; }

  // ---------- SVG ----------
  const SVGNS = 'http://www.w3.org/2000/svg';
  function svgEl(tag, attrs, parent) {
    const el = document.createElementNS(SVGNS, tag);
    for (const k in attrs) {
      const v = String(attrs[k]);
      // var() em atributo de apresentação não é confiável em todos os navegadores.
      if ((k === 'fill' || k === 'stroke') && v.startsWith('var(')) el.style[k] = v;
      else el.setAttribute(k, v);
    }
    if (parent) parent.appendChild(el);
    return el;
  }
  function svgText(parent, x, y, text, cls, anchor) {
    const t = svgEl('text', { x, y, class: cls || 'svg-text', 'text-anchor': anchor || 'start' }, parent);
    t.textContent = text;
    return t;
  }

  // ---------- Abas ----------
  function setTab(tab) {
    if (!TABS.includes(tab)) tab = 'plano';
    ui.tab = tab;
    for (const t of TABS) {
      $(`tab-${t}`).hidden = t !== tab;
      const b = $(`t-${t}`);
      b.setAttribute('aria-selected', String(t === tab));
      b.tabIndex = t === tab ? 0 : -1;
    }
    try { history.replaceState(null, '', `#${tab}`); } catch (e) { /* ok */ }
    renderTab();
    save();
  }
  document.querySelector('.tabs').addEventListener('click', (e) => {
    const b = e.target.closest('[data-tab]');
    if (b) setTab(b.dataset.tab);
  });
  window.addEventListener('hashchange', () => {
    const h = (location.hash || '').replace('#', '');
    if (TABS.includes(h) && h !== ui.tab) setTab(h);
  });
  document.querySelector('.tabs').addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const i = TABS.indexOf(ui.tab) + (e.key === 'ArrowRight' ? 1 : -1);
    const next = TABS[(i + TABS.length) % TABS.length];
    setTab(next);
    $(`t-${next}`).focus();
  });

  function renderTab() {
    if (ui.tab === 'equipes') renderTeams();
    else if (ui.tab === 'plano') renderPlan();
    else if (ui.tab === 'vivo') renderLive(true);
    else if (ui.tab === 'analise') renderAnalysis();
    else renderManual();
  }

  // Botões que pedem segundo toque para confirmar.
  function armed(btn, action) {
    btn.addEventListener('click', () => {
      if (btn.dataset.armed === 'true') {
        btn.dataset.armed = 'false';
        btn.textContent = btn.dataset.label;
        action();
        return;
      }
      btn.dataset.label = btn.textContent;
      btn.dataset.armed = 'true';
      btn.textContent = btn.dataset.confirm;
      setTimeout(() => {
        if (btn.dataset.armed === 'true') {
          btn.dataset.armed = 'false';
          btn.textContent = btn.dataset.label;
        }
      }, 4000);
    });
  }

  // ======================= PLANO =======================
  const CFG_FORMS = [$('cfgForm'), $('refForm')];

  function fillForm() {
    for (const form of CFG_FORMS) {
      for (const el of form.querySelectorAll('[data-key]')) el.value = cfg[el.dataset.key];
      for (const el of form.querySelectorAll('[data-pilot]')) el.value = cfg.pilots[+el.dataset.pilot][el.dataset.pkey];
    }
  }

  function readForm(el) {
    const raw = { ...cfg, pilots: cfg.pilots.map((p) => ({ ...p })) };
    if (el.dataset.key) raw[el.dataset.key] = el.value;
    if (el.dataset.pilot) raw.pilots[+el.dataset.pilot][el.dataset.pkey] = el.value;
    if (el.dataset.key === 'stops') { raw.stintMode = 'equal'; }
    return raw;
  }

  let formTimer = null;
  function isField(el) { return el.matches('[data-key],[data-pilot]') && !(el.type === 'number' && el.value === ''); }
  function applyField(el) {
    cfg = KS.normalizeConfig(readForm(el));
    planNotes = [];
    updatePlan();
  }
  for (const form of CFG_FORMS) {
    form.addEventListener('input', (e) => {
      const el = e.target;
      if (!isField(el)) return;
      clearTimeout(formTimer);
      formTimer = setTimeout(() => applyField(el), 200);
    });
    form.addEventListener('change', (e) => {
      clearTimeout(formTimer);
      if (isField(e.target)) applyField(e.target);
      fillForm();
    });
    form.addEventListener('submit', (e) => e.preventDefault());
  }

  armed($('btnResetCfg'), () => {
    // Volta as regras e o plano ao padrão, mantendo a equipe em uso.
    cfg = KS.applyTeam(KS.DEFAULT_CONFIG, activeTeam());
    planNotes = [];
    fillForm();
    updatePlan();
  });

  // Plano da equipe: 4 turnos de 26:15 revezando os pilotos na ordem do cadastro.
  // Mantém as ações já escritas e preenche só as vazias.
  $('btnDefaultPlan').addEventListener('click', () => {
    const d = KS.DEFAULT_CONFIG;
    cfg = KS.normalizeConfig({
      ...cfg,
      order: undefined,
      stintMode: d.stintMode,
      customStintMin: d.customStintMin.slice(),
      stintNotes: cfg.stintNotes.map((note, i) => note || d.stintNotes[i] || ''),
    });
    planNotes = ['Plano de 4 turnos de 26:15 aplicado, revezando os pilotos na ordem do cadastro.'];
    updatePlan();
  });

  $('btnEqual').addEventListener('click', () => {
    cfg.stintMode = 'equal';
    planNotes = [];
    updatePlan();
  });
  $('btnOptimize').addEventListener('click', () => {
    const res = KS.optimizeStints(cfg);
    planNotes = res.notes.slice();
    const durs = res.durs;
    const allEqual = durs.every((d) => Math.abs(d - durs[0]) < 1);
    if (!res.feasible || allEqual) {
      cfg.stintMode = 'equal';
      if (res.feasible) planNotes.push('Os pilotos têm o mesmo ritmo: stints iguais já é o melhor plano.');
    } else {
      cfg.stintMode = 'custom';
      cfg.customStintMin = durs.slice(0, -1).map((d) => Math.round((d / 60) * 100) / 100);
      const gain = plan ? KS.buildPlan(cfg).totalLaps - plan.totalLaps : 0;
      planNotes.push(`Mais tempo para quem é mais rápido: ${fmtSigned(gain * cfg.pilots[0].lapSec, 1)} s na prova em relação ao plano anterior.`);
    }
    updatePlan();
  });

  function updatePlan() {
    plan = KS.buildPlan(cfg);
    save();
    renderHeader();
    renderTab();
  }

  function renderHeader() {
    $('brandTeam').textContent = cfg.teamName;
    const h = cfg.raceMin / 60;
    const dur = Number.isInteger(h) ? `${h} h` : `${cfg.raceMin} min`;
    $('brandSub').textContent = [cfg.workshopName, `Endurance de kart · ${dur} · ${cfg.stops} ${cfg.stops === 1 ? 'parada' : 'paradas'}`]
      .filter(Boolean).join(' · ');
    document.title = `Box ${cfg.teamName}`;
  }

  function renderPlan() {
    const active = document.activeElement && document.activeElement.id;
    $('planLede').textContent = `${joinNames(cfg.pilots.map((p) => p.name))} · ${fmtClock(plan.raceSec)} de prova · ${cfg.stops} paradas de ${fmtClock(cfg.minPitSec)} no box · volta média ${cfg.pilots.map((p) => `${fmtLap(p.lapSec)} s`).join(' / ')}.`;
    renderTeamSummary();

    // KPIs
    const n = plan.stints.length;
    const kpis = [
      ['Voltas estimadas', fmtNum(plan.totalLaps, 1), `${Math.floor(plan.totalLaps)} voltas completas`],
      ['Tempo de pista', fmtClock(plan.driveSec), `${fmtNum((plan.driveSec / plan.raceSec) * 100, 0)}% da prova`],
      ['Tempo parado', fmtClock(plan.totalPitLoss), `${cfg.stops} × ${fmtClock(plan.perStopLoss)} (box + perdas)`],
      ['Stint médio', fmtClock(plan.driveSec / n), `${fmtNum(plan.totalLaps / n, 1)} voltas`],
    ];
    const kWrap = $('kpis');
    kWrap.replaceChildren();
    for (const [label, value, sub] of kpis) {
      const d = document.createElement('div');
      d.className = 'kpi';
      const l = document.createElement('span'); l.className = 'k-label'; l.textContent = label;
      const v = document.createElement('span'); v.className = 'k-value'; v.textContent = value;
      const s = document.createElement('span'); s.className = 'k-sub'; s.textContent = sub;
      d.append(l, v, s);
      kWrap.appendChild(d);
    }

    renderMeta();
    renderScenarios();
    renderLegend($('tlLegend'), true);
    renderTimeline();
    renderStintTable();
    renderStopTable();
    renderWarnings();

    if (active) {
      const el = $(active);
      if (el && el !== document.activeElement) el.focus();
    }
  }

  function renderMeta() {
    const t = KS.paceTargets(plan);
    const pill = $('metaPill');
    const summary = $('metaSummary');
    const tbl = $('metaTable');
    tbl.replaceChildren();
    if (!t) {
      pill.hidden = true;
      summary.textContent = 'Informe o menor tempo da pista para ver quanto cada piloto precisa fazer por volta para chegar na frente.';
      return;
    }
    pill.hidden = false;
    const tight = Math.abs(t.slackSec) < 0.05;
    pill.dataset.state = tight ? 'late' : t.slackSec > 0 ? 'ideal' : 'overdue';
    pill.textContent = tight ? 'No limite' : t.slackSec > 0 ? 'À frente' : 'Atrás';

    const b = (text) => { const e = document.createElement('b'); e.textContent = text; return e; };
    const txt = (text) => document.createTextNode(text);
    const laps = Math.abs(t.lapsAhead);
    const lapsTxt = `${fmtNum(laps, 1)} ${laps < 1.95 ? 'volta' : 'voltas'} (${fmtNum(Math.abs(t.secAhead), 0)} s)`;
    summary.replaceChildren(
      txt(`Equipes da frente: ${fmtLap(t.leaderLapSec)} s por volta, cerca de ${fmtNum(t.leaderLaps, 1)} voltas na prova. Com os tempos atuais vocês terminam `),
      b(lapsTxt),
      txt(t.lapsAhead >= 0 ? ' à frente. ' : ' atrás. '),
      txt(t.slackSec >= 0
        ? `Cada piloto pode perder até ${fmtNum(t.slackSec, 2)} s por volta e ainda chegar na frente.`
        : `Cada piloto precisa andar ${fmtNum(-t.slackSec, 2)} s mais rápido por volta para chegar na frente.`)
    );

    const head = tbl.createTHead().insertRow();
    for (const [label, num, wide] of [['Piloto'], ['Ritmo do plano', 1, 1], ['vs menor tempo', 1, 1], ['Máximo p/ frente', 1], ['vs menor tempo', 1]]) {
      const th = document.createElement('th');
      th.textContent = label;
      if (num) th.className = 'num';
      if (wide) th.classList.add('wide-only');
      head.appendChild(th);
    }
    const body = tbl.createTBody();
    t.perPilot.forEach((pp, i) => {
      const tr = body.insertRow();
      const c0 = tr.insertCell();
      const wrap = document.createElement('span');
      wrap.className = 'pilot-cell';
      const dot = document.createElement('i');
      dot.className = 'dot';
      dot.style.background = `var(${PILOT_VARS[i]})`;
      wrap.append(dot, txt(firstName(pp.name)));
      c0.appendChild(wrap);
      for (const [v, strong, wide] of [[`${fmtLap(pp.lapSec)} s`, false, true], [`${fmtSigned(pp.vsBest, 2)} s`, false, true], [`${fmtLap(pp.maxLapSec)} s`, true], [`${fmtSigned(pp.maxVsBest, 2)} s`]]) {
        const td = tr.insertCell();
        td.className = wide ? 'num wide-only' : 'num';
        if (strong) td.appendChild(b(v)); else td.textContent = v;
      }
    });
  }

  function renderScenarios() {
    const list = KS.starterScenarios(cfg);
    const wrap = $('scenarios');
    wrap.replaceChildren();
    const same = list.every((sc) => Math.abs(sc.plan.totalLaps - list[0].plan.totalLaps) < 1e-6);
    $('scenariosHint').textContent = same
      ? 'As duas dão o mesmo total de voltas: cada piloto pilota o mesmo tempo. Muda quem larga, quem fecha e em que voltas são as paradas.'
      : 'Compare as duas e escolha a que a equipe vai usar.';
    const mk = (tag, cls, text) => {
      const e = document.createElement(tag);
      if (cls) e.className = cls;
      if (text != null) e.textContent = text;
      return e;
    };
    list.forEach((sc, si) => {
      const card = mk('section', 'card scenario');
      card.dataset.inUse = String(sc.inUse);
      card.style.borderTopColor = pilotVar(sc.starterId);
      const head = mk('div', 'scenario-head');
      const title = mk('div');
      title.append(mk('span', 'eyebrow', `Estratégia ${String.fromCharCode(65 + si)}`), mk('h3', null, `${firstName(sc.starterName)} abre`));
      head.appendChild(title);
      if (sc.inUse) head.appendChild(mk('span', 'in-use-chip', 'Em uso'));
      else {
        const btn = mk('button', 'btn', 'Usar esta estratégia');
        btn.type = 'button';
        btn.addEventListener('click', () => {
          cfg = KS.normalizeConfig({ ...sc.cfg });
          planNotes = [`Estratégia ${String.fromCharCode(65 + si)} em uso: ${sc.starterName} larga.`];
          updatePlan();
        });
        head.appendChild(btn);
      }
      card.appendChild(head);

      const ol = mk('ol');
      for (const st of sc.plan.stints) {
        const li = mk('li');
        const dot = mk('i', 'dot');
        dot.style.background = pilotVar(st.pilotId);
        li.append(dot, mk('span', null, `${st.index + 1}. ${firstName(st.pilotName)} · ${fmtClock(st.startSec)}–${fmtClock(st.endSec)}`), mk('span', 'muted', `~${Math.round(st.laps)} voltas`));
        ol.appendChild(li);
      }
      card.appendChild(ol);

      const facts = mk('div', 'facts-line');
      const fact = (k, v) => { const s = mk('span', null, `${k} `); s.appendChild(mk('b', null, v)); facts.appendChild(s); };
      fact('Box nas voltas', sc.plan.stops.map((p) => p.lap).join(', '));
      const last = sc.plan.stops[sc.plan.stops.length - 1];
      if (last) fact('Última parada', `${fmtClock(last.inSec)} (prazo ${fmtClock(last.window.latestSec)})`);
      fact('Voltas', fmtNum(sc.plan.totalLaps, 1));
      card.appendChild(facts);

      const notes = mk('ul', 'notes');
      notes.appendChild(mk('li', null, `${sc.starterName} larga e ${sc.finisherName} recebe a bandeira.`));
      if (sc.fastestStarts) notes.appendChild(mk('li', null, 'O mais rápido larga: aproveita o começo, com o pelotão ainda junto, para abrir vantagem.'));
      if (sc.fastestFinishes) notes.appendChild(mk('li', null, 'O mais rápido fecha: melhor para defender ou ganhar posição no fim.'));
      if (sc.targets) {
        const metas = sc.targets.perPilot.map((pp) => `${firstName(pp.name)} até ${fmtLap(pp.maxLapSec)} s`).join(' · ');
        notes.appendChild(mk('li', null, `Meta por volta para chegar na frente: ${metas}.`));
      }
      card.appendChild(notes);
      wrap.appendChild(card);
    });
  }

  function renderLegend(el, withPit) {
    el.replaceChildren();
    cfg.pilots.forEach((p, i) => {
      const s = document.createElement('span');
      const k = document.createElement('i');
      k.className = withPit ? 'key-rect' : 'key-line';
      k.style.background = `var(${PILOT_VARS[i]})`;
      s.append(k, document.createTextNode(p.name));
      el.appendChild(s);
    });
    if (withPit) {
      const s = document.createElement('span');
      const k = document.createElement('i');
      k.className = 'key-rect key-pit';
      s.append(k, document.createTextNode('Parada'));
      el.appendChild(s);
    }
  }

  function renderTimeline() {
    const host = $('timeline');
    const W = Math.max(300, host.clientWidth || 800);
    const H = 104;
    const padL = 2;
    const padR = 2;
    const barY = 28;
    const barH = 40;
    const plotW = W - padL - padR;
    const T = plan.raceSec;
    const x = (s) => padL + (Math.max(0, Math.min(T, s)) / T) * plotW;

    const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Linha do tempo com stints e paradas' });
    const defs = svgEl('defs', {}, svg);
    const pat = svgEl('pattern', { id: 'hatch', width: 6, height: 6, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(135)' }, defs);
    svgEl('rect', { width: 6, height: 6, fill: 'var(--surface-2)' }, pat);
    svgEl('rect', { width: 2, height: 6, fill: 'var(--pit)' }, pat);

    // Grade de tempo
    let stepMin = cfg.raceMin <= 60 ? 10 : cfg.raceMin <= 180 ? 15 : 30;
    if (W < 600) stepMin *= 2;
    for (let m = 0; m <= cfg.raceMin + 1e-9; m += stepMin) {
      const xx = x(m * 60);
      svgEl('line', { x1: xx, x2: xx, y1: barY - 4, y2: barY + barH + 4, class: 'svg-grid' }, svg);
      const anchor = m === 0 ? 'start' : m >= cfg.raceMin - 1e-9 ? 'end' : 'middle';
      svgText(svg, xx, barY + barH + 22, fmtClock(m * 60), 'svg-text', anchor);
    }

    const segs = [];
    plan.stints.forEach((s) => segs.push({ type: 'stint', s, from: s.startSec, to: s.endSec }));
    plan.stops.forEach((p) => segs.push({ type: 'stop', p, from: p.inSec, to: p.outSec }));

    for (const seg of segs) {
      const x0 = x(seg.from) + 1;
      const x1 = x(seg.to) - 1;
      const w = Math.max(1, x1 - x0);
      const g = svgEl('g', { class: 'seg', tabindex: 0 }, svg);
      if (seg.type === 'stint') {
        const i = pilotIndex(seg.s.pilotId);
        svgEl('rect', { x: x0, y: barY, width: w, height: barH, rx: 3, fill: `var(${PILOT_VARS[i]})` }, g);
        const short = firstName(seg.s.pilotName);
        const options = [`${short} · ${fmtClock(seg.s.durSec)}`, short, short.slice(0, 3)];
        const label = options.find((o) => w > o.length * 7 + 14);
        if (label) {
          const t = svgText(g, x0 + 8, barY + barH / 2 + 5, label, 'svg-inlabel');
          t.setAttribute('fill', PILOT_ON[i]);
        }
        g.setAttribute('aria-label', `Stint ${seg.s.index + 1}, ${seg.s.pilotName}, ${fmtClock(seg.s.startSec)} a ${fmtClock(seg.s.endSec)}`);
      } else {
        svgEl('rect', { x: x0, y: barY, width: w, height: barH, rx: 3, fill: 'url(#hatch)' }, g);
        const label = `P${seg.p.index + 1} · V${seg.p.lap}`;
        svgText(svg, x(seg.from), barY - 10, label, 'svg-text-strong', 'middle');
        g.setAttribute('aria-label', `Parada ${seg.p.index + 1} na volta ${seg.p.lap}`);
      }
      const show = (e) => {
        const r = e.clientX != null ? { x: e.clientX, y: e.clientY } : (() => { const b = g.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.bottom }; })();
        if (seg.type === 'stint') {
          const s = seg.s;
          showTip(r.x, r.y, `Stint ${s.index + 1} de ${plan.stints.length}`, [
            { color: pilotVar(s.pilotId), rect: true, value: s.pilotName },
            { value: `${fmtClock(s.startSec)} → ${fmtClock(s.endSec)}`, label: 'de prova' },
            { value: fmtClock(s.durSec), label: `· ${fmtNum(s.laps, 1)} voltas` },
            ...(s.note ? [{ value: s.note }] : []),
          ]);
        } else {
          const p = seg.p;
          showTip(r.x, r.y, `Parada ${p.index + 1}`, [
            { value: `Volta ${p.lap}`, label: `entrada ${fmtClock(p.inSec)}` },
            { value: fmtClock(p.outSec), label: 'volta à pista' },
            { value: fmtClock(plan.perStopLoss), label: `${fmtClock(cfg.minPitSec)} + ${fmtNum(plan.perStopLoss - cfg.minPitSec, 1)} s de perdas` },
          ]);
        }
      };
      g.addEventListener('pointermove', show);
      g.addEventListener('focus', show);
      g.addEventListener('pointerleave', hideTip);
      g.addEventListener('blur', hideTip);
    }

    // Marca do momento atual, se a corrida estiver rolando.
    if (started() && !race.example) {
      const xx = x(elapsedSec());
      svgEl('line', { x1: xx, x2: xx, y1: barY - 6, y2: barY + barH + 6, stroke: 'var(--ink)', 'stroke-width': 2 }, svg);
      svgText(svg, Math.min(W - 30, Math.max(30, xx)), barY + barH + 22, 'agora', 'svg-text-strong', 'middle');
    }
    host.replaceChildren(svg);
  }

  function renderStintTable() {
    // O plano de 26:15 só faz sentido na prova padrão (2 h, 3 paradas).
    $('btnDefaultPlan').hidden = !(cfg.stops === KS.DEFAULT_CONFIG.stops && cfg.raceMin === KS.DEFAULT_CONFIG.raceMin);
    const tbl = $('stintTable');
    tbl.replaceChildren();
    const head = tbl.createTHead().insertRow();
    for (const [t, num, wide] of [['Turno'], ['Piloto'], ['Duração', 1], ['Início', 1, 1], ['Fim', 1, 1], ['Voltas', 1, 1], ['Box', 1]]) {
      const th = document.createElement('th');
      th.textContent = t;
      if (num) th.className = 'num';
      if (wide) th.classList.add('wide-only');
      head.appendChild(th);
    }
    const body = tbl.createTBody();
    const n = plan.stints.length;
    plan.stints.forEach((s, i) => {
      const tr = body.insertRow();
      tr.insertCell().textContent = String(i + 1);

      const cp = tr.insertCell();
      const wrap = document.createElement('span');
      wrap.className = 'pilot-cell';
      const dot = document.createElement('i');
      dot.className = 'dot';
      dot.style.background = pilotVar(s.pilotId);
      const sel = document.createElement('select');
      sel.id = `st-pilot-${i}`;
      sel.setAttribute('aria-label', `Piloto do stint ${i + 1}`);
      for (const p of cfg.pilots) {
        const o = document.createElement('option');
        o.value = p.id;
        o.textContent = p.name;
        if (p.id === s.pilotId) o.selected = true;
        sel.appendChild(o);
      }
      sel.addEventListener('change', () => {
        cfg.order[i] = sel.value;
        updatePlan();
      });
      wrap.append(dot, sel);
      cp.appendChild(wrap);

      const cd = tr.insertCell();
      cd.className = 'num';
      if (i < n - 1) {
        const inp = document.createElement('input');
        inp.type = 'text';
        inp.inputMode = 'numeric';
        inp.autocomplete = 'off';
        inp.id = `st-dur-${i}`;
        inp.setAttribute('aria-label', `Duração do turno ${i + 1} (minutos:segundos)`);
        inp.value = fmtClock(s.durSec);
        inp.addEventListener('change', () => {
          const sec = KS.parseDuration(inp.value);
          if (!Number.isFinite(sec) || sec <= 0) { inp.value = fmtClock(s.durSec); return; }
          cfg.customStintMin = plan.stints.slice(0, n - 1).map((st) => st.durSec / 60);
          cfg.customStintMin[i] = sec / 60;
          cfg.stintMode = 'custom';
          planNotes = [];
          updatePlan();
        });
        cd.appendChild(inp);
      } else {
        cd.textContent = fmtClock(s.durSec);
        cd.title = 'O último turno fecha a conta com o tempo que sobra até a bandeira';
      }
      const c3 = tr.insertCell(); c3.className = 'num wide-only'; c3.textContent = fmtClock(s.startSec);
      const c4 = tr.insertCell(); c4.className = 'num wide-only'; c4.textContent = fmtClock(s.endSec);
      const c5 = tr.insertCell(); c5.className = 'num wide-only'; c5.textContent = fmtNum(s.laps, 1);
      const c6 = tr.insertCell(); c6.className = 'num';
      c6.textContent = i < plan.stops.length ? `V${plan.stops[i].lap}` : 'Bandeira';
      if (i >= plan.stops.length) c6.classList.add('muted');

      // Ação do turno, editável, numa linha logo abaixo.
      const nr = body.insertRow();
      nr.className = 'note-row';
      const nc = nr.insertCell();
      nc.colSpan = 7;
      const note = document.createElement('input');
      note.type = 'text';
      note.maxLength = 140;
      note.id = `st-note-${i}`;
      note.placeholder = 'O que o piloto faz neste turno';
      note.setAttribute('aria-label', `Ação do turno ${i + 1}`);
      note.value = s.note || '';
      note.addEventListener('change', () => {
        cfg.stintNotes[i] = note.value.trim();
        updatePlan();
      });
      nc.appendChild(note);
    });

    const notes = [];
    notes.push(cfg.stintMode === 'equal'
      ? `Turnos iguais de ${fmtClock(plan.driveSec / n)}. Digite uma duração (ex.: 26:15) para mudar; o último turno fecha a conta até a bandeira.`
      : 'Digite a duração como minutos:segundos (ex.: 26:15). O último turno fecha a conta até a bandeira, descontando as paradas.');
    $('stintHint').textContent = notes.concat(planNotes).join(' ');
  }

  function renderStopTable() {
    const tbl = $('stopTable');
    tbl.replaceChildren();
    if (!plan.stops.length) {
      const r = tbl.insertRow();
      r.insertCell().textContent = 'Sem paradas obrigatórias.';
      return;
    }
    const head = tbl.createTHead().insertRow();
    for (const [t, num, wide] of [['Parada'], ['Entrada', 1, 1], ['Alvo', 1], ['Janela ideal', 1], ['Prazo', 1], ['Volta à pista', 1, 1]]) {
      const th = document.createElement('th');
      th.textContent = t;
      if (num) th.className = 'num';
      if (wide) th.classList.add('wide-only');
      head.appendChild(th);
    }
    const body = tbl.createTBody();
    for (const p of plan.stops) {
      const tr = body.insertRow();
      const c0 = tr.insertCell();
      const pb = document.createElement('b');
      pb.textContent = `P${p.index + 1}`;
      const sub = document.createElement('span');
      sub.className = 'muted wide-only';
      sub.textContent = ` ${firstName(plan.stints[p.index].pilotName)} → ${firstName(plan.stints[p.index + 1].pilotName)}`;
      c0.append(pb, sub);
      const cells = [
        [fmtClock(p.inSec), 1],
        [`V${p.lap}`, 0],
        [p.window.feasible ? `V${p.idealLaps[0]}–V${p.idealLaps[1]}` : '–', 0],
        [p.window.feasible ? `${fmtClock(p.window.latestSec)} · V${Math.floor(p.window.latestLap)}` : 'inviável', 0],
        [fmtClock(p.outSec), 1],
      ];
      for (const [c, wide] of cells) {
        const td = tr.insertCell();
        td.className = wide ? 'num wide-only' : 'num';
        td.textContent = c;
      }
    }
  }

  function alertEl(a) {
    const d = document.createElement('div');
    d.className = `alert alert-${a.level}`;
    const b = document.createElement('b');
    b.textContent = a.level === 'critical' ? 'Atenção' : a.level === 'warning' ? 'Cuidado' : 'Ok';
    const s = document.createElement('span');
    s.textContent = a.text;
    d.append(b, s);
    return d;
  }

  function renderWarnings() {
    const w = $('warnings');
    w.replaceChildren();
    const list = plan.warnings.length ? plan.warnings : [{ level: 'good', text: 'Plano dentro das regras configuradas.' }];
    for (const a of list) w.appendChild(alertEl(a));
  }

  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (ui.tab === 'plano') renderTimeline();
      if (ui.tab === 'analise') renderLapChart();
    }, 150);
  });

  // ======================= AO VIVO =======================
  let audioCtx = null;
  function initAudio() {
    if (audioCtx) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) audioCtx = new AC();
    } catch (e) { audioCtx = null; }
  }
  function beep(freq, ms) {
    if (!ui.sound || !audioCtx) return;
    try {
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = 'square';
      o.frequency.value = freq;
      g.gain.value = 0.08;
      o.connect(g).connect(audioCtx.destination);
      const t = audioCtx.currentTime;
      o.start(t);
      g.gain.setValueAtTime(0.08, t + ms / 1000 - 0.02);
      g.gain.linearRampToValueAtTime(0, t + ms / 1000);
      o.stop(t + ms / 1000 + 0.01);
    } catch (e) { /* sem som */ }
  }
  function buzz(pattern) {
    try { if (navigator.vibrate) navigator.vibrate(pattern); } catch (e) { /* sem vibração */ }
  }

  let wakeLock = null;
  async function keepAwake() {
    try {
      if ('wakeLock' in navigator && !wakeLock && document.visibilityState === 'visible') {
        wakeLock = await navigator.wakeLock.request('screen');
        wakeLock.addEventListener('release', () => { wakeLock = null; });
      }
    } catch (e) { wakeLock = null; }
  }
  document.addEventListener('visibilitychange', () => {
    if (started() && race.frozenElapsed == null) keepAwake();
  });

  function currentPilotId() {
    return race.stintPilots[race.pits.length] || cfg.order[Math.min(race.pits.length, cfg.order.length - 1)];
  }
  function defaultNextPilot() {
    const k = race.pits.length + 1;
    if (!race.stintPilots[0] || race.stintPilots[0] === cfg.order[0]) return cfg.order[Math.min(k, cfg.order.length - 1)];
    // Largou alguém fora do plano: segue o rodízio do cadastro.
    const ids = cfg.pilots.map((p) => p.id);
    return ids[(ids.indexOf(currentPilotId()) + 1) % ids.length];
  }

  function fillPilotSelect(sel, selectedId) {
    const want = selectedId || sel.value;
    sel.replaceChildren();
    for (const p of cfg.pilots) {
      const o = document.createElement('option');
      o.value = p.id;
      o.textContent = p.name;
      sel.appendChild(o);
    }
    sel.value = cfg.pilots.some((p) => p.id === want) ? want : cfg.pilots[0].id;
  }

  $('btnStart').addEventListener('click', () => {
    initAudio();
    race = newRace();
    race.startedAt = Date.now();
    race.stintPilots = [$('lvStarter').value];
    beep(880, 300);
    buzz(200);
    keepAwake();
    save();
    renderLive(true);
  });

  function recordLap(sec, elapsed) {
    race.laps.push({
      n: race.laps.length + 1,
      sec,
      at: elapsed,
      pilot: currentPilotId(),
      stint: race.pits.length,
      kind: race.outLapPending ? 'out' : race.yellow ? 'yellow' : 'green',
      prevCross: race.lastCross,
      wasOut: race.outLapPending,
    });
    race.lastCross = elapsed;
    race.outLapPending = false;
    save();
    renderLive(true);
  }

  $('btnLap').addEventListener('click', () => {
    if (!started() || race.pit || race.example) return;
    const el = elapsedSec();
    const sec = el - race.lastCross;
    if (sec < 5) return; // toque duplo
    buzz(30);
    recordLap(sec, el);
  });

  $('manualLap').addEventListener('submit', (e) => {
    e.preventDefault();
    if (!started() || race.pit || race.example) return;
    const inp = $('manualLapInput');
    const v = parseFloat(String(inp.value).replace(',', '.'));
    if (!Number.isFinite(v) || v < 10 || v > 600) { inp.focus(); return; }
    recordLap(v, elapsedSec());
    inp.value = '';
  });

  $('btnUndo').addEventListener('click', () => {
    if (race.example) return;
    const last = race.laps[race.laps.length - 1];
    if (!last || last.stint !== race.pits.length) return;
    race.laps.pop();
    race.lastCross = last.prevCross;
    race.outLapPending = !!last.wasOut;
    save();
    renderLive(true);
  });

  $('btnYellow').addEventListener('click', () => {
    if (race.example) return;
    race.yellow = !race.yellow;
    save();
    renderLive(true);
  });

  let pitBeeped = new Set();
  $('btnPitIn').addEventListener('click', () => {
    if (!started() || race.pit || race.example) return;
    initAudio();
    race.pit = { inSec: elapsedSec() };
    pitBeeped = new Set();
    fillPilotSelect($('pitPilotIn'), defaultNextPilot());
    beep(660, 150);
    buzz(80);
    save();
    renderLive(true);
  });

  $('btnPitOut').addEventListener('click', () => {
    if (!race.pit) return;
    const el = elapsedSec();
    const pilotIn = $('pitPilotIn').value;
    race.pits.push({ inSec: race.pit.inSec, outSec: el, pilotOut: currentPilotId(), pilotIn });
    race.stintPilots[race.pits.length] = pilotIn;
    race.stintPilots.length = race.pits.length + 1;
    race.pit = null;
    race.lastCross = el;
    race.outLapPending = true;
    save();
    renderLive(true);
  });

  armed($('btnPitCancel'), () => {
    race.pit = null;
    save();
    renderLive(true);
  });

  $('btnPause').addEventListener('click', () => {
    if (!started() || race.frozenElapsed != null) return;
    if (race.pausedAt) {
      race.pausedMs += Date.now() - race.pausedAt;
      race.pausedAt = null;
    } else {
      race.pausedAt = Date.now();
    }
    save();
    renderLive(true);
  });

  armed($('btnResetRace'), () => {
    race = newRace();
    save();
    renderLive(true);
  });

  $('btnSound').addEventListener('click', () => {
    ui.sound = !ui.sound;
    if (ui.sound) { initAudio(); beep(880, 80); }
    save();
    renderLive(true);
  });

  let lastAlertKey = '';
  function renderLive(force) {
    const el = elapsedSec();
    const T = plan.raceSec;
    const isStarted = started();
    const inPit = !!race.pit;

    $('miniClock').textContent = isStarted ? fmtHMS(Math.max(0, T - el)) : fmtHMS(T);
    if (ui.tab !== 'vivo' && !force) return;

    const finished = isStarted && el >= T;
    $('lvClockLabel').textContent = !isStarted ? 'Duração da prova' : finished ? 'Bandeira quadriculada' : race.pausedAt ? 'Relógio pausado' : 'Tempo restante';
    $('lvRemaining').textContent = fmtHMS(isStarted ? T - el : T);
    $('lvElapsed').textContent = fmtHMS(el);
    $('lvLapCount').textContent = String(race.laps.length);
    $('lvLapPlan').textContent = isStarted ? `plano ${fmtNum(KS.lapsAt(plan, Math.min(el, T)), 1)}` : `plano ${fmtNum(plan.totalLaps, 1)}`;
    $('lvFlag').hidden = !race.yellow;

    $('lvPre').hidden = isStarted;
    $('lvTrack').hidden = !isStarted || inPit;
    $('lvPit').hidden = !inPit;

    if (!isStarted) {
      const sel = $('lvStarter');
      if (force || !sel.options.length) fillPilotSelect(sel, sel.value || cfg.order[0]);
    }

    if (isStarted) {
      const st = KS.liveStatus(cfg, plan, race, el);
      if (!inPit) renderTrack(st, el, finished);
      else renderPit(el);
      renderSide(el);
    } else {
      renderSide(0);
    }

    $('btnPause').textContent = race.pausedAt ? 'Retomar relógio' : 'Pausar relógio';
    $('btnPause').disabled = !isStarted || race.frozenElapsed != null;
    $('btnSound').textContent = ui.sound ? 'Som ligado' : 'Som desligado';
    $('btnSound').setAttribute('aria-pressed', String(ui.sound));
  }

  function renderTrack(st, el, finished) {
    const n = cfg.stops + 1;
    $('lvSwatch').style.background = pilotVar(st.pilotId);
    $('lvStintLabel').textContent = `Stint ${st.stintIndex + 1} de ${n}`;
    $('lvPilot').textContent = st.pilotName;
    const meta = KS.paceTargets(plan);
    const mine = meta && meta.perPilot.find((pp) => pp.id === st.pilotId);
    $('lvMeta').textContent = mine ? `Alvo ${fmtLap(mine.lapSec)} s · máximo p/ chegar na frente ${fmtLap(mine.maxLapSec)} s` : '';
    const stintPlan = plan.stints[st.stintIndex];
    $('lvNote').textContent = stintPlan && stintPlan.note ? stintPlan.note : '';
    $('lvNote').hidden = !(stintPlan && stintPlan.note);
    $('lvStintTime').textContent = fmtClock(st.stintElapsed);
    $('lvStintLaps').textContent = String(race.laps.filter((l) => l.stint === st.stintIndex).length);
    const last = race.laps[race.laps.length - 1];
    $('lvLastLap').textContent = last ? fmtLap(last.sec) + (last.kind === 'out' ? ' (saída)' : last.kind === 'yellow' ? ' (amarela)' : '') : '–';
    $('lvAvg3').textContent = Number.isFinite(st.recentAvg) ? fmtLap(st.recentAvg) : '–';

    const pill = $('lvNextPill');
    const bar = $('lvWinBar');
    const ns = st.nextStop;
    if (finished) {
      pill.dataset.state = 'done';
      pill.textContent = 'Prova encerrada';
      $('lvNextTitle').textContent = `${race.pits.length} de ${cfg.stops} paradas feitas`;
      $('lvNextMain').textContent = 'Registre a volta final e confira a classificação.';
      $('lvNextSub').textContent = race.pits.length < cfg.stops ? 'Faltou parada obrigatória. Avise o diretor de prova se houver erro de cronometragem.' : '';
      bar.hidden = true;
    } else if (!ns) {
      pill.dataset.state = 'done';
      pill.textContent = 'Paradas cumpridas';
      $('lvNextTitle').textContent = `${race.pits.length} de ${cfg.stops} paradas`;
      $('lvNextMain').textContent = `Bandeira em ${fmtClock(st.remaining)}`;
      $('lvNextSub').textContent = 'Agora é ritmo e posição. Sem riscos desnecessários.';
      bar.hidden = true;
    } else {
      const labels = { locked: 'Janela fechada', open: 'Janela aberta', ideal: 'Janela ideal', late: 'Passou do alvo', overdue: 'Prazo estourado' };
      pill.dataset.state = ns.state;
      pill.textContent = labels[ns.state];
      $('lvNextTitle').textContent = `Parada ${ns.number} de ${cfg.stops}`;
      const lapsToGo = Math.max(0, Math.round(ns.lapsToGo));
      let main;
      if (ns.state === 'locked') main = `Abre em ${fmtClock(ns.window.earliestSec - el)}`;
      else if (ns.state === 'overdue') main = 'Box agora';
      else if (ns.state === 'late') main = `Pare agora · prazo em ${fmtClock(ns.window.latestSec - el)}`;
      else if (ns.inSec > 0) main = `Alvo em ${fmtClock(ns.inSec)} · ${lapsToGo} ${lapsToGo === 1 ? 'volta' : 'voltas'}`;
      else main = 'Pare nesta volta';
      $('lvNextMain').textContent = main;
      $('lvNextSub').textContent = `Alvo ${fmtClock(ns.targetSec)} de prova · janela ${fmtClock(ns.window.earliestSec)}–${fmtClock(ns.window.latestSec)}. Amarela vale box a partir de ${fmtNum(cfg.yellowMinStintMin, 0)} min de stint.`;

      bar.hidden = false;
      const from = race.pits.length ? race.pits[race.pits.length - 1].outSec : 0;
      const to = Math.max(ns.window.latestSec, ns.targetSec) + 120;
      const pct = (s) => `${(Math.max(0, Math.min(1, (s - from) / (to - from))) * 100).toFixed(2)}%`;
      const half = cfg.windowLaps * cfg.pilots[pilotIndex(st.pilotId)].lapSec;
      const [o, i, now] = bar.children;
      o.style.left = pct(ns.window.earliestSec);
      o.style.width = `calc(${pct(ns.window.latestSec)} - ${pct(ns.window.earliestSec)})`;
      i.style.left = pct(Math.max(ns.window.earliestSec, ns.targetSec - half));
      i.style.width = `calc(${pct(Math.min(ns.window.latestSec, ns.targetSec + half))} - ${pct(Math.max(ns.window.earliestSec, ns.targetSec - half))})`;
      now.style.left = pct(el);
    }

    const sign = st.sign || { text: 'OK', hint: '' };
    $('lvSignText').textContent = sign.text;
    $('lvSignHint').textContent = sign.hint;
    $('lvSign').dataset.sign = sign.text === 'BOX' ? 'box' : sign.text === 'RITMO' ? 'pace' : /^\d+$/.test(sign.text) ? 'count' : 'ok';

    const alerts = st.alerts.slice();
    if (race.pausedAt) alerts.unshift({ level: 'warning', text: 'Relógio pausado. Retome quando a prova voltar.' });
    const key = JSON.stringify(alerts);
    if (key !== lastAlertKey) {
      lastAlertKey = key;
      const box = $('lvAlerts');
      box.replaceChildren(...alerts.map(alertEl));
    }

    $('btnLap').disabled = race.example;
    $('btnPitIn').disabled = race.example;
    $('btnYellow').setAttribute('aria-pressed', String(race.yellow));
  }

  function renderPit(el) {
    const inBox = el - race.pit.inSec;
    const target = cfg.minPitSec + cfg.exitMarginSec;
    const left = target - inBox;
    const board = $('pitBoard');
    const phase = left <= 0 ? 'go' : left <= 10 ? 'ready' : 'hold';
    board.dataset.phase = phase;
    $('pitTitle').textContent = `Box · parada ${race.pits.length + 1} de ${cfg.stops}`;
    $('pitState').textContent = phase === 'go' ? 'Libera' : phase === 'ready' ? 'Prepara' : 'Segura';
    $('pitCountdown').textContent = left > 0 ? fmtClock(Math.ceil(left)) : 'LIBERA';
    $('pitElapsed').textContent = fmtClock(Math.floor(inBox));
    $('pitTarget').textContent = fmtClock(target);
    $('pitProgress').style.width = `${Math.min(100, (inBox / target) * 100).toFixed(1)}%`;
    for (const li of $('pitSteps').children) {
      const a = +li.dataset.from;
      const b = +li.dataset.to;
      li.dataset.now = String(inBox >= a && inBox < b);
      li.dataset.past = String(inBox >= b);
    }
    const sel = $('pitPilotIn');
    if (!sel.options.length) fillPilotSelect(sel, defaultNextPilot());
    const out = $('btnPitOut');
    const early = inBox < cfg.minPitSec;
    out.dataset.early = String(early);
    out.textContent = early ? `Ainda não · faltam ${Math.ceil(cfg.minPitSec - inBox)} s` : 'Saiu do box';
  }

  function pitBeeps() {
    if (!race.pit) return;
    const inBox = elapsedSec() - race.pit.inSec;
    const left = cfg.minPitSec + cfg.exitMarginSec - inBox;
    for (const th of [60, 30, 10, 5, 4, 3, 2, 1, 0]) {
      if (left <= th && left > th - 1.5 && !pitBeeped.has(th)) {
        pitBeeped.add(th);
        if (th === 0) { beep(1320, 700); buzz([300, 100, 300]); }
        else if (th <= 5) beep(990, 120);
        else { beep(740, 200); buzz(120); }
      }
    }
  }

  function renderSide(el) {
    const totals = started() ? KS.driveTimes(cfg, race, el) : Object.fromEntries(cfg.pilots.map((p) => [p.id, 0]));
    const wrap = $('lvDrive');
    wrap.replaceChildren();
    const maxPlan = Math.max(...cfg.pilots.map((p) => plan.perPilot[p.id].driveSec), 1);
    const scale = Math.max(maxPlan, ...Object.values(totals)) * 1.08;
    for (const p of cfg.pilots) {
      const planned = plan.perPilot[p.id].driveSec;
      const row = document.createElement('div');
      row.className = 'drive-row';
      const top = document.createElement('div');
      top.className = 'dr-top';
      const name = document.createElement('span');
      name.textContent = p.name;
      const val = document.createElement('b');
      val.textContent = `${fmtClock(totals[p.id])} / ${fmtClock(planned)}`;
      top.append(name, val);
      const track = document.createElement('div');
      track.className = 'drive-track';
      const fill = document.createElement('div');
      fill.className = 'drive-fill';
      fill.style.width = `${Math.min(100, (totals[p.id] / scale) * 100)}%`;
      fill.style.background = pilotVar(p.id);
      const goal = document.createElement('div');
      goal.className = 'drive-goal';
      goal.style.left = `${(planned / scale) * 100}%`;
      goal.title = 'Planejado';
      track.append(fill, goal);
      row.append(top, track);
      if (cfg.minDriveMin > 0) {
        const h = document.createElement('span');
        h.className = 'hint';
        const need = cfg.minDriveMin * 60 - totals[p.id];
        h.textContent = need > 0 ? `Faltam ${fmtClock(need)} para o mínimo do regulamento.` : 'Mínimo do regulamento cumprido.';
        row.appendChild(h);
      }
      wrap.appendChild(row);
    }
    renderPitTable($('lvPitLog'), true);
  }

  function renderPitTable(tbl, compact) {
    tbl.replaceChildren();
    if (!race.pits.length) {
      const r = tbl.insertRow();
      const c = r.insertCell();
      c.className = 'muted';
      c.textContent = 'Nenhuma parada ainda.';
      return 0;
    }
    const head = tbl.createTHead().insertRow();
    const cols = compact ? [['#'], ['Entrada', 1], ['No box', 1], ['Sobra', 1]] : [['Parada'], ['Entrada', 1], ['No box', 1], ['Acima do mínimo', 1], ['Troca']];
    for (const [t, num] of cols) {
      const th = document.createElement('th');
      th.textContent = t;
      if (num) th.className = 'num';
      head.appendChild(th);
    }
    const body = tbl.createTBody();
    let waste = 0;
    race.pits.forEach((p, i) => {
      const dur = p.outSec - p.inSec;
      const extra = dur - cfg.minPitSec;
      waste += Math.max(0, extra);
      const tr = body.insertRow();
      tr.insertCell().textContent = compact ? String(i + 1) : `P${i + 1}`;
      const c1 = tr.insertCell(); c1.className = 'num'; c1.textContent = fmtClock(p.inSec);
      const c2 = tr.insertCell(); c2.className = 'num'; c2.textContent = fmtClock(dur);
      const c3 = tr.insertCell(); c3.className = 'num';
      c3.textContent = extra < 0 ? `${fmtNum(extra, 1)} s cedo` : `+${fmtNum(extra, 1)} s`;
      if (extra < 0) c3.style.color = 'var(--crit-ink)';
      if (!compact) tr.insertCell().textContent = `${firstName(pilotName(p.pilotOut))} → ${firstName(pilotName(p.pilotIn))}`;
    });
    return waste;
  }

  // ======================= ANÁLISE =======================
  function renderAnalysis() {
    const has = race.laps.length > 0;
    $('anEmpty').hidden = has;
    $('anContent').hidden = !has;
    $('exampleBanner').hidden = !race.example;
    if (!has) return;

    const statsWrap = $('pilotStats');
    statsWrap.replaceChildren();
    const totals = KS.driveTimes(cfg, race, elapsedSec());
    cfg.pilots.forEach((p, i) => {
      const s = KS.lapStats(race.laps, p.id);
      const card = document.createElement('section');
      card.className = 'card pstat';
      card.style.borderTopColor = `var(${PILOT_VARS[i]})`;
      const h = document.createElement('h2');
      h.textContent = p.name;
      const dl = document.createElement('dl');
      const items = [
        ['Voltas válidas', String(s.count), ''],
        ['Melhor volta', fmtLap(s.best), ''],
        ['Média', fmtLap(s.avg), `alvo ${fmtLap(p.lapSec)}`],
        ['Consistência', Number.isFinite(s.sd) ? `± ${fmtNum(s.sd, 2)}` : '–', 'desvio padrão (s)'],
        ['Média vs alvo', fmtSigned(s.avg - p.lapSec, 2), 's por volta'],
        ['Tempo de pista', fmtClock(totals[p.id]), `plano ${fmtClock(plan.perPilot[p.id].driveSec)}`],
      ];
      for (const [k, v, sub] of items) {
        const div = document.createElement('div');
        const dt = document.createElement('dt'); dt.textContent = k;
        const dd = document.createElement('dd'); dd.textContent = v;
        if (sub) { const sm = document.createElement('small'); sm.textContent = sub; dd.appendChild(sm); }
        div.append(dt, dd);
        dl.appendChild(div);
      }
      card.append(h, dl);
      statsWrap.appendChild(card);
    });

    renderLegend($('lapLegend'), false);
    if (race.laps.some((l) => l.kind === 'yellow')) {
      const s = document.createElement('span');
      const k = document.createElement('i');
      k.className = 'key-rect key-yellow';
      s.append(k, document.createTextNode('Bandeira amarela'));
      $('lapLegend').appendChild(s);
    }
    renderLapChart();
    renderLapTable();
    const waste = renderPitTable($('anPitTable'), false);
    $('pitWasteNote').textContent = race.pits.length
      ? `Total acima do mínimo: ${fmtNum(waste, 1)} s, cerca de ${fmtNum(waste / cfg.pilots[0].lapSec, 2)} volta.`
      : '';
  }

  function niceStep(range) {
    const steps = [0.1, 0.2, 0.25, 0.5, 1, 2, 5, 10];
    for (const s of steps) if (range / s <= 6) return s;
    return 10;
  }

  function renderLapChart() {
    const host = $('lapChart');
    if (!race.laps.length || $('anContent').hidden) return;
    const W = Math.max(300, host.clientWidth || 700);
    const H = 280;
    const m = { l: 44, r: 16, t: 16, b: 34 };
    const green = race.laps.filter((l) => l.kind === 'green');
    const ys = green.length ? green.map((l) => l.sec) : race.laps.map((l) => l.sec);
    const targets = cfg.pilots.map((p) => p.lapSec);
    let lo = Math.min(...ys, ...targets);
    let hi = Math.max(...ys, ...targets);
    if (hi - lo < 0.6) { const mid = (hi + lo) / 2; lo = mid - 0.3; hi = mid + 0.3; }
    const step = niceStep(hi - lo);
    lo = Math.floor(lo / step) * step;
    hi = Math.ceil(hi / step) * step;
    const maxN = race.laps.length;
    const x = (n) => m.l + ((n - 1) / Math.max(1, maxN - 1)) * (W - m.l - m.r);
    const y = (v) => m.t + (1 - (v - lo) / (hi - lo)) * (H - m.t - m.b);

    const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Tempo de volta por volta, por piloto' });

    // Faixas de amarela
    let runStart = null;
    race.laps.forEach((l, i) => {
      const isY = l.kind === 'yellow';
      if (isY && runStart == null) runStart = l.n;
      const next = race.laps[i + 1];
      if (runStart != null && (!next || next.kind !== 'yellow')) {
        const x0 = x(runStart) - 4;
        const x1 = x(l.n) + 4;
        svgEl('rect', { x: x0, y: m.t, width: Math.max(6, x1 - x0), height: H - m.t - m.b, fill: 'var(--warn)', opacity: 0.22 }, svg);
        runStart = null;
      }
    });

    // Grade Y
    for (let v = lo; v <= hi + 1e-9; v += step) {
      const yy = y(v);
      svgEl('line', { x1: m.l, x2: W - m.r, y1: yy, y2: yy, class: 'svg-grid' }, svg);
      svgText(svg, m.l - 6, yy + 4, fmtNum(v, step < 1 ? (step < 0.25 ? 1 : 2) : 0), 'svg-text', 'end');
    }
    svgEl('line', { x1: m.l, x2: W - m.r, y1: H - m.b, y2: H - m.b, class: 'svg-axis' }, svg);
    const xStep = maxN <= 30 ? 5 : maxN <= 80 ? 10 : 20;
    for (let n = xStep; n <= maxN; n += xStep) svgText(svg, x(n), H - m.b + 18, String(n), 'svg-text', 'middle');
    svgText(svg, m.l, H - m.b + 18, '1', 'svg-text', 'middle');
    svgText(svg, W - m.r, H - 2, 'volta', 'svg-text', 'end');

    // Paradas
    race.pits.forEach((p, i) => {
      const before = race.laps.filter((l) => l.at <= p.inSec + 0.01).length;
      if (!before) return;
      const xx = x(before + 0.5);
      svgEl('line', { x1: xx, x2: xx, y1: m.t, y2: H - m.b, stroke: 'var(--pit)', 'stroke-width': 1 }, svg);
      svgText(svg, xx + 4, m.t + 10, `P${i + 1}`, 'svg-text-strong');
    });

    // Alvo por stint e linhas por stint
    const stints = new Map();
    for (const l of race.laps) {
      if (!stints.has(l.stint)) stints.set(l.stint, []);
      stints.get(l.stint).push(l);
    }
    for (const [, laps] of stints) {
      const pid = laps[0].pilot;
      const target = cfg.pilots[pilotIndex(pid)].lapSec;
      svgEl('line', { x1: x(laps[0].n), x2: x(laps[laps.length - 1].n), y1: y(target), y2: y(target), stroke: 'var(--muted)', 'stroke-width': 1, opacity: 0.7 }, svg);
      let pts = [];
      const flush = () => {
        if (pts.length > 1) svgEl('polyline', { points: pts.join(' '), fill: 'none', stroke: pilotVar(pid), 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, svg);
        else if (pts.length === 1) { const [px, py] = pts[0].split(','); svgEl('circle', { cx: px, cy: py, r: 3, fill: pilotVar(pid) }, svg); }
        pts = [];
      };
      for (const l of laps) {
        if (l.kind !== 'green') { flush(); continue; }
        pts.push(`${x(l.n).toFixed(1)},${y(l.sec).toFixed(1)}`);
      }
      flush();
    }
    svgText(svg, W - m.r, y(targets[0]) - 6, 'alvo', 'svg-text', 'end');

    // Melhor volta de cada piloto
    cfg.pilots.forEach((p) => {
      const mine = green.filter((l) => l.pilot === p.id);
      if (!mine.length) return;
      const best = mine.reduce((a, b) => (b.sec < a.sec ? b : a));
      const cx = x(best.n);
      const cy = y(best.sec);
      svgEl('circle', { cx, cy, r: 6, fill: 'var(--surface)' }, svg);
      svgEl('circle', { cx, cy, r: 4, fill: pilotVar(p.id) }, svg);
      const anchor = cx > W - 120 ? 'end' : 'start';
      svgText(svg, cx + (anchor === 'end' ? -8 : 8), cy + 16, `melhor ${fmtLap(best.sec)}`, 'svg-text-strong', anchor);
    });

    // Cruz de leitura
    const cross = svgEl('line', { y1: m.t, y2: H - m.b, stroke: 'var(--ink-2)', 'stroke-width': 1, visibility: 'hidden' }, svg);
    const marker = svgEl('circle', { r: 5, fill: 'var(--surface)', stroke: 'var(--ink)', 'stroke-width': 2, visibility: 'hidden' }, svg);
    const hit = svgEl('rect', { x: m.l, y: 0, width: W - m.l - m.r, height: H, fill: 'transparent', tabindex: 0, 'aria-label': 'Leitura volta a volta: use as setas' }, svg);
    let focusN = maxN;
    const kindLabel = { green: '', out: 'volta de saída', yellow: 'sob amarela' };
    function showLap(n, cx, cy) {
      const l = race.laps[n - 1];
      if (!l) return;
      const xx = x(n);
      cross.setAttribute('x1', xx); cross.setAttribute('x2', xx); cross.setAttribute('visibility', 'visible');
      if (l.sec >= lo && l.sec <= hi) {
        marker.setAttribute('cx', xx); marker.setAttribute('cy', y(l.sec)); marker.setAttribute('visibility', 'visible');
      } else marker.setAttribute('visibility', 'hidden');
      const rows = [{ color: pilotVar(l.pilot), value: `${fmtLap(l.sec)} s`, label: pilotName(l.pilot) }];
      const target = cfg.pilots[pilotIndex(l.pilot)].lapSec;
      rows.push({ value: `${fmtSigned(l.sec - target, 2)} s`, label: 'vs alvo' });
      if (kindLabel[l.kind]) rows.push({ value: kindLabel[l.kind], label: 'fora da média' });
      showTip(cx, cy, `Volta ${l.n} · stint ${l.stint + 1} · ${fmtClock(l.at)}`, rows);
    }
    hit.addEventListener('pointermove', (e) => {
      const r = svg.getBoundingClientRect();
      const px = ((e.clientX - r.left) / r.width) * W;
      const n = Math.round(1 + ((px - m.l) / (W - m.l - m.r)) * Math.max(1, maxN - 1));
      focusN = Math.max(1, Math.min(maxN, n));
      showLap(focusN, e.clientX, e.clientY);
    });
    const hide = () => { cross.setAttribute('visibility', 'hidden'); marker.setAttribute('visibility', 'hidden'); hideTip(); };
    hit.addEventListener('pointerleave', hide);
    hit.addEventListener('blur', hide);
    hit.addEventListener('focus', () => { const b = svg.getBoundingClientRect(); showLap(focusN, b.left + (x(focusN) / W) * b.width, b.top + 20); });
    hit.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      focusN = Math.max(1, Math.min(maxN, focusN + (e.key === 'ArrowRight' ? 1 : -1)));
      const b = svg.getBoundingClientRect();
      showLap(focusN, b.left + (x(focusN) / W) * b.width, b.top + 20);
    });

    host.replaceChildren(svg);
  }

  function renderLapTable() {
    const tbl = $('lapTable');
    tbl.replaceChildren();
    const head = tbl.createTHead().insertRow();
    for (const [t, num] of [['Volta'], ['Piloto'], ['Stint', 1], ['Tempo', 1], ['Tipo'], ['Decorrido', 1]]) {
      const th = document.createElement('th');
      th.textContent = t;
      if (num) th.className = 'num';
      head.appendChild(th);
    }
    const body = tbl.createTBody();
    const kind = { green: 'verde', out: 'saída do box', yellow: 'amarela' };
    for (const l of race.laps) {
      const tr = body.insertRow();
      tr.insertCell().textContent = String(l.n);
      tr.insertCell().textContent = pilotName(l.pilot);
      const c1 = tr.insertCell(); c1.className = 'num'; c1.textContent = String(l.stint + 1);
      const c2 = tr.insertCell(); c2.className = 'num'; c2.textContent = fmtLap(l.sec);
      const c3 = tr.insertCell(); c3.textContent = kind[l.kind]; if (l.kind !== 'green') c3.className = 'muted';
      const c4 = tr.insertCell(); c4.className = 'num'; c4.textContent = fmtClock(l.at);
    }
  }

  function lapsCsv() {
    const kind = { green: 'verde', out: 'saida', yellow: 'amarela' };
    const rows = ['volta;piloto;stint;tempo_s;tipo;decorrido'];
    for (const l of race.laps) {
      rows.push([l.n, pilotName(l.pilot), l.stint + 1, fmtNum(l.sec, 3).replace(/\./g, ''), kind[l.kind], fmtClock(l.at)].join(';'));
    }
    return rows.join('\n');
  }

  $('btnCopyCsv').addEventListener('click', () => {
    const text = lapsCsv();
    const status = $('copyStatus');
    const fallback = () => {
      let ta = document.getElementById('csvFallback');
      if (!ta) {
        ta = document.createElement('textarea');
        ta.id = 'csvFallback';
        ta.rows = 6;
        ta.style.width = '100%';
        ta.readOnly = true;
        $('btnCopyCsv').parentElement.after(ta);
      }
      ta.value = text;
      ta.focus();
      ta.select();
      status.textContent = 'Texto selecionado. Copie com Ctrl+C ou segurando o dedo.';
    };
    try {
      navigator.clipboard.writeText(text).then(() => { status.textContent = `${race.laps.length} voltas copiadas.`; }, fallback);
    } catch (e) { fallback(); }
  });

  // Corrida simulada para demonstrar a análise.
  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function simulateRace() {
    const rnd = mulberry32(2026);
    const gauss = () => { let u = 0; let v = 0; while (!u) u = rnd(); while (!v) v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
    const T = plan.raceSec;
    const sim = newRace();
    sim.example = true;
    sim.startedAt = Date.now();
    sim.stintPilots = [cfg.order[0]];
    const profile = Object.fromEntries(cfg.pilots.map((p, i) => [
      p.id, { mean: p.lapSec + (i === 0 ? -0.05 : 0.12), sd: i === 0 ? 0.22 : 0.3 },
    ]));
    const stopAt = plan.stops.map((s) => s.inSec);
    // Amarela durante a janela da 2ª parada: a equipe aproveita e para antes.
    let yellow = null;
    if (plan.stops[1]) {
      const s = plan.stops[1];
      const start = Math.max(s.window.earliestSec + 60, s.inSec - 4 * 60);
      yellow = [start, start + 210];
      stopAt[1] = start + 50;
    }
    const slack = [2.8, 6.1, 2.3, 3.0, 2.5];
    let t = 0;
    let lapInStint = 0;
    let outPending = false;
    for (let guard = 0; guard < 1000; guard++) {
      const stint = sim.pits.length;
      const pid = sim.stintPilots[stint];
      const pr = profile[pid];
      const underYellow = yellow && t >= yellow[0] && t < yellow[1];
      let sec;
      let kind = 'green';
      if (outPending) { kind = 'out'; sec = pr.mean + cfg.outLapLossSec + 3 + rnd(); }
      else if (underYellow) { kind = 'yellow'; sec = cfg.yellowLapSec - 2 + rnd() * 4; }
      else { sec = pr.mean + 0.012 * lapInStint + gauss() * pr.sd + (rnd() < 0.04 ? 0.9 + rnd() : 0); }
      if (sim.laps.length === 0) sec += 2.2;
      sim.laps.push({ n: sim.laps.length + 1, sec, at: t + sec, pilot: pid, stint, kind, prevCross: t, wasOut: outPending });
      t += sec;
      outPending = false;
      lapInStint++;
      if (t >= T) break;
      if (stint < cfg.stops && t >= stopAt[stint] - sec / 2) {
        const dur = cfg.minPitSec + slack[stint % slack.length];
        const next = cfg.order[stint + 1];
        sim.pits.push({ inSec: t, outSec: t + dur, pilotOut: pid, pilotIn: next });
        sim.stintPilots.push(next);
        t += dur;
        outPending = true;
        lapInStint = 0;
      }
    }
    sim.lastCross = t;
    sim.frozenElapsed = T;
    return sim;
  }

  $('btnLoadExample').addEventListener('click', () => {
    race = simulateRace();
    save();
    renderAnalysis();
  });
  $('btnClearExample').addEventListener('click', () => {
    race = newRace();
    save();
    renderAnalysis();
  });

  // ======================= MANUAL =======================
  function renderManual() {
    const n = plan.stints.length;
    const lap = cfg.pilots.reduce((a, p) => a + p.lapSec, 0) / cfg.pilots.length;
    const P = cfg.pilots.length;
    const h = cfg.raceMin / 60;
    const values = {
      team: cfg.teamName,
      race: Number.isInteger(h) ? `${h} h` : `${cfg.raceMin} min`,
      stops: String(cfg.stops),
      minpit: fmtClock(cfg.minPitSec),
      pittotal: fmtClock(cfg.stops * cfg.minPitSec),
      drive: fmtClock(plan.driveSec),
      laps: fmtNum(plan.totalLaps, 1),
      lapsint: String(Math.round(plan.totalLaps)),
      lap: fmtLap(lap),
      stint: fmtClock(plan.driveSec / n),
      stintlaps: String(Math.round(plan.totalLaps / n)),
      rotation: P === 1 ? `1 piloto faz os ${n} stints.` : `${P} pilotos se revezam em ${n} stints.`,
      manualTitle: P === 1 ? 'Estratégia do piloto' : `Estratégia dos ${P} pilotos`,
      pace01: fmtNum(plan.totalLaps * 0.1, 0),
      pace03: fmtNum(plan.totalLaps * 0.3, 0),
      slacklap: fmtNum(cfg.stops ? lap / cfg.stops : lap, 0),
      ylap: fmtNum(cfg.yellowLapSec, 0),
      ygain: fmtNum(Math.max(0, cfg.yellowLapSec - lap), 0),
      ymin: fmtNum(cfg.yellowMinStintMin, 0),
      release: fmtClock(cfg.minPitSec + cfg.exitMarginSec),
      margin: fmtNum(cfg.exitMarginSec, Number.isInteger(cfg.exitMarginSec) ? 0 : 1),
    };
    for (const el of document.querySelectorAll('[data-m]')) {
      const v = values[el.dataset.m];
      if (v != null) el.textContent = v;
    }
    renderPilotCards();
  }

  function renderPilotCards() {
    const wrap = $('pilotCards');
    wrap.replaceChildren();
    const mk = (tag, cls, text) => {
      const e = document.createElement(tag);
      if (cls) e.className = cls;
      if (text != null) e.textContent = text;
      return e;
    };
    cfg.pilots.forEach((p, pi) => {
      const mine = plan.stints.filter((s) => s.pilotId === p.id);
      const card = mk('section', 'pcard');
      card.style.borderTopColor = `var(${PILOT_VARS[pi]})`;
      const head = mk('div', 'pcard-head');
      head.append(mk('h3', null, p.name));
      const roles = [];
      if (plan.stints[0] && plan.stints[0].pilotId === p.id) roles.push('Larga');
      if (plan.stints.length && plan.stints[plan.stints.length - 1].pilotId === p.id) roles.push('Recebe a bandeira');
      if (roles.length) head.append(mk('span', 'pcard-role', roles.join(' · ')));
      card.append(head);

      const facts = mk('dl', 'pcard-facts');
      const fact = (k, v) => { const d = mk('div'); d.append(mk('dt', null, k), mk('dd', null, v)); facts.append(d); };
      fact('Alvo de volta', `${fmtLap(p.lapSec)} s`);
      fact('Stints', String(mine.length));
      fact('Tempo de pista', fmtClock(plan.perPilot[p.id].driveSec));
      const t = KS.paceTargets(plan);
      if (t) fact('Máximo p/ chegar na frente', `${fmtLap(t.perPilot[pi].maxLapSec)} s`);
      card.append(facts);

      if (!mine.length) {
        card.append(mk('p', 'hint', 'Sem stint no plano atual. Ajuste a escala na aba Plano.'));
      }
      const list = mk('ol', 'pcard-stints');
      for (const s of mine) {
        const li = mk('li');
        li.append(mk('b', null, `Stint ${s.index + 1} · ${fmtClock(s.startSec)} → ${fmtClock(s.endSec)}`));
        if (s.note) li.append(mk('span', 'pcard-note', s.note));
        li.append(mk('span', null, `Cerca de ${Math.round(s.laps)} voltas no stint.`));
        const stop = plan.stops[s.index];
        if (stop) {
          const win = stop.window.feasible ? ` Janela V${stop.idealLaps[0]}–V${stop.idealLaps[1]}, prazo ${fmtClock(stop.window.latestSec)}.` : '';
          li.append(mk('span', null, `Box na volta ${stop.lap} da prova (relógio ${fmtClock(stop.inSec)}).${win}`));
        } else {
          li.append(mk('span', null, 'Sem parada no fim: leva o kart até a bandeira quadriculada.'));
        }
        if (s.index > 0) li.append(mk('span', 'muted', 'Volta de saída com pneu frio.'));
        list.append(li);
      }
      card.append(list);

      const others = plan.stints.filter((s) => s.pilotId !== p.id);
      if (others.length) {
        const when = others.map((s) => `${fmtClock(s.startSec)}–${fmtClock(s.endSec)}`).join(' e ');
        card.append(mk('p', 'pcard-off', `Fora do kart (${when}): água, 10 min de descanso, depois relógio e placa.`));
      }
      wrap.append(card);
    });
  }

  // ======================= LOOP =======================
  let lastPlanTick = 0;
  setInterval(() => {
    if (!started() || race.frozenElapsed != null) return;
    pitBeeps();
    renderLive(false);
    const now = Date.now();
    if (ui.tab === 'plano' && now - lastPlanTick > 5000) { lastPlanTick = now; renderTimeline(); }
  }, 250);

  // ======================= TEMA =======================
  // Automático segue o celular; Claro e Escuro fixam a cor da tela.
  const THEMES = ['auto', 'light', 'dark'];
  const THEME_NAMES = { auto: 'automático', light: 'claro', dark: 'escuro' };
  const THEME_SHORT = { auto: 'Auto', light: 'Claro', dark: 'Escuro' };
  const hostTheme = document.documentElement.getAttribute('data-theme');

  function applyTheme() {
    const t = THEMES.includes(ui.theme) ? ui.theme : 'auto';
    const root = document.documentElement;
    if (t !== 'auto') root.setAttribute('data-theme', t);
    else if (hostTheme) root.setAttribute('data-theme', hostTheme);
    else root.removeAttribute('data-theme');
    const btn = $('btnTheme');
    btn.dataset.theme = t;
    btn.setAttribute('aria-label', `Tema: ${THEME_NAMES[t]}. Toque para trocar.`);
    btn.title = `Tema: ${THEME_NAMES[t]}`;
    $('themeLabel').textContent = THEME_SHORT[t];
  }

  $('btnTheme').addEventListener('click', () => {
    const cur = THEMES.includes(ui.theme) ? ui.theme : 'auto';
    ui.theme = THEMES[(THEMES.indexOf(cur) + 1) % THEMES.length];
    applyTheme();
    save();
  });
  applyTheme();

  // ======================= SEM INTERNET =======================
  function storageWorks() {
    try {
      const k = '__ajm_teste__';
      localStorage.setItem(k, '1');
      localStorage.removeItem(k);
      return true;
    } catch (e) { return false; }
  }

  function setupOffline() {
    const status = $('offlineStatus');
    const setStatus = (state, text) => {
      status.dataset.state = state;
      status.textContent = text;
    };
    const updateNet = () => { $('netChip').hidden = navigator.onLine !== false; };
    window.addEventListener('online', updateNet);
    window.addEventListener('offline', updateNet);
    updateNet();
    $('storageWarn').hidden = storageWorks();

    // Arquivo único salvo no celular (dist/Box-AJM.html): já abre sem internet.
    if (/^(file|content):$/.test(location.protocol)) {
      setStatus('ready', 'Este arquivo está guardado no celular e abre sem internet.');
      return;
    }

    const keepOpen = 'Depois de aberto, o app funciona sem sinal. Abra antes da largada, com internet, e não feche esta página durante a prova.';
    const standalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
    const ios = /iPhone|iPad|iPod/.test(navigator.userAgent || '');

    let deferred = null;
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferred = e;
      $('btnInstall').hidden = false;
    });
    $('btnInstall').addEventListener('click', async () => {
      if (!deferred) return;
      deferred.prompt();
      try { await deferred.userChoice; } catch (e) { /* ok */ }
      deferred = null;
      $('btnInstall').hidden = true;
    });
    window.addEventListener('appinstalled', () => {
      $('btnInstall').hidden = true;
      setStatus('ready', 'Instalado. Abra pelo ícone Box AJM, com ou sem internet.');
    });

    const canCache = 'serviceWorker' in navigator && /^https?:$/.test(location.protocol);
    if (!canCache) {
      setStatus('unsupported', keepOpen);
      return;
    }
    navigator.serviceWorker.register('sw.js')
      .then(() => navigator.serviceWorker.ready)
      .then(() => {
        $('iosHint').hidden = !ios || standalone;
        setStatus('ready', standalone
          ? 'Pronto para usar sem internet.'
          : 'Pronto para usar sem internet. Instale na tela inicial para abrir pelo ícone.');
      })
      .catch(() => setStatus('unsupported', keepOpen));
  }

  // ======================= EQUIPES =======================
  function joinNames(names) {
    if (names.length <= 1) return names.join('');
    return `${names.slice(0, -1).join(', ')} e ${names[names.length - 1]}`;
  }

  function activeTeam() { return teams.find((t) => t.id === activeTeamId) || teams[0]; }

  function useTeam(id) {
    const team = teams.find((t) => t.id === id);
    if (!team) return;
    // Guarda a escala da equipe que sai, para voltar igual depois.
    teams = teams.map((t) => (t.id === activeTeamId ? { ...t, plan: KS.planOf(cfg) } : t));
    activeTeamId = id;
    cfg = KS.applyTeam(cfg, team);
    planNotes = [];
    fillForm();
    updatePlan();
  }

  // Plano: seletor da equipe em uso e resumo dos pilotos.
  $('teamSelect').addEventListener('change', (e) => useTeam(e.target.value));
  $('btnEditTeams').addEventListener('click', () => {
    editor.open(activeTeamId);
    setTab('equipes');
  });

  function renderTeamSummary() {
    const sel = $('teamSelect');
    sel.replaceChildren(...teams.map((t) => {
      const o = document.createElement('option');
      o.value = t.id;
      o.textContent = t.workshop ? `${t.name} (${t.workshop})` : t.name;
      return o;
    }));
    sel.value = activeTeamId;
    const ul = $('teamSummary');
    ul.replaceChildren(...cfg.pilots.map((p, i) => {
      const li = document.createElement('li');
      const dot = document.createElement('i');
      dot.className = 'dot';
      dot.style.background = `var(${PILOT_VARS[i]})`;
      const name = document.createElement('span');
      name.textContent = p.name;
      const lap = document.createElement('b');
      lap.textContent = `${fmtLap(p.lapSec)} s`;
      li.append(dot, name, lap);
      return li;
    }));
  }

  // Aba Equipes: lista e formulário de edição.
  const editor = (() => {
    let editingId = null; // id da equipe ou 'new'
    const countSel = $('te-count');
    countSel.replaceChildren(...Array.from({ length: KS.MAX_PILOTS }, (_, i) => {
      const o = document.createElement('option');
      o.value = String(i + 1);
      o.textContent = i === 0 ? '1 piloto' : `${i + 1} pilotos`;
      return o;
    }));

    function readPilots() {
      return [...$('te-pilots').querySelectorAll('.te-pilot')].map((row) => ({
        name: row.querySelector('[data-f="name"]').value,
        lapSec: row.querySelector('[data-f="lap"]').value,
      }));
    }

    function renderPilotRows(pilots) {
      const wrap = $('te-pilots');
      wrap.replaceChildren(...pilots.map((p, i) => {
        const row = document.createElement('div');
        row.className = 'te-pilot';
        const dot = document.createElement('i');
        dot.className = 'dot';
        dot.style.background = `var(${PILOT_VARS[i]})`;
        const name = document.createElement('label');
        name.className = 'field';
        const ns = document.createElement('span');
        ns.append(dot, document.createTextNode(`Piloto ${i + 1}`));
        const ni = document.createElement('input');
        ni.type = 'text';
        ni.maxLength = 40;
        ni.id = `te-p${i}-name`;
        ni.dataset.f = 'name';
        ni.value = p.name || '';
        name.append(ns, ni);
        const lap = document.createElement('label');
        lap.className = 'field';
        const ls = document.createElement('span');
        ls.textContent = 'Volta média (s)';
        const li = document.createElement('input');
        li.type = 'number';
        li.step = '0.01';
        li.min = '10';
        li.inputMode = 'decimal';
        li.id = `te-p${i}-lap`;
        li.dataset.f = 'lap';
        li.value = p.lapSec != null ? String(p.lapSec) : '';
        lap.append(ls, li);
        row.append(name, lap);
        return row;
      }));
    }

    function setErrors(list) {
      $('te-errors').replaceChildren(...list.map((text) => alertEl({ level: 'critical', text })));
    }

    function open(id) {
      editingId = id;
      const team = id === 'new'
        ? { name: '', workshop: '', pilots: [{ name: '', lapSec: KS.NEW_PILOT_LAP }, { name: '', lapSec: KS.NEW_PILOT_LAP }] }
        : teams.find((t) => t.id === id);
      if (!team) return;
      $('teamEditorTitle').textContent = id === 'new' ? 'Nova equipe' : 'Editar equipe';
      $('te-name').value = team.name;
      $('te-workshop').value = team.workshop || '';
      countSel.value = String(team.pilots.length);
      renderPilotRows(team.pilots);
      $('te-delete').hidden = id === 'new';
      setErrors([]);
      $('te-status').textContent = '';
    }

    countSel.addEventListener('change', () => {
      const want = Number(countSel.value);
      const pilots = readPilots().slice(0, want);
      while (pilots.length < want) pilots.push({ name: '', lapSec: KS.NEW_PILOT_LAP });
      renderPilotRows(pilots);
    });

    $('teamEditor').addEventListener('submit', (e) => {
      e.preventDefault();
      const draft = {
        name: $('te-name').value.trim(),
        workshop: $('te-workshop').value.trim(),
        pilots: readPilots().map((p) => ({ name: p.name.trim(), lapSec: parseFloat(String(p.lapSec).replace(',', '.')) })),
      };
      const errors = KS.validateTeam(draft);
      setErrors(errors);
      if (errors.length) return;
      if (editingId === 'new') {
        const team = { id: `t${Date.now().toString(36)}`, ...draft };
        teams.push(team);
        editingId = team.id;
        $('teamEditorTitle').textContent = 'Editar equipe';
        $('te-delete').hidden = false;
      } else {
        teams = teams.map((t) => (t.id === editingId ? { ...t, ...draft } : t));
      }
      if (editingId === activeTeamId) useTeam(activeTeamId);
      else save();
      $('te-status').textContent = editingId === activeTeamId
        ? 'Equipe salva. O plano já foi refeito com os dados novos.'
        : 'Equipe salva. Toque em Usar na lista para correr com ela.';
      renderTeamList();
    });

    $('te-cancel').addEventListener('click', () => open(editingId === 'new' ? activeTeamId : editingId));

    armed($('te-delete'), () => {
      if (teams.length === 1) {
        setErrors(['Precisa ter pelo menos uma equipe cadastrada. Crie outra antes de excluir esta.']);
        return;
      }
      const removed = editingId;
      teams = teams.filter((t) => t.id !== removed);
      if (removed === activeTeamId) useTeam(teams[0].id);
      else save();
      open(activeTeamId);
      $('te-status').textContent = 'Equipe excluída.';
      renderTeamList();
    });

    $('btnNewTeam').addEventListener('click', () => {
      open('new');
      $('te-name').focus();
    });

    return { open, current: () => editingId };
  })();

  function renderTeamList() {
    const wrap = $('teamList');
    const mk = (tag, cls, text) => {
      const e = document.createElement(tag);
      if (cls) e.className = cls;
      if (text != null) e.textContent = text;
      return e;
    };
    wrap.replaceChildren(...teams.map((t) => {
      const card = mk('section', 'card team-card');
      card.dataset.active = String(t.id === activeTeamId);
      card.dataset.editing = String(t.id === editor.current());
      const head = mk('div', 'team-card-head');
      const title = mk('div');
      title.append(mk('h3', null, t.name));
      if (t.workshop) title.append(mk('span', 'team-workshop', `Oficina ${t.workshop}`));
      head.append(title);
      if (t.id === activeTeamId) head.append(mk('span', 'in-use-chip', 'Em uso'));
      card.append(head);
      const ul = mk('ul', 'team-summary');
      t.pilots.forEach((p, i) => {
        const li = mk('li');
        const dot = mk('i', 'dot');
        dot.style.background = `var(${PILOT_VARS[i]})`;
        li.append(dot, mk('span', null, p.name), mk('b', null, `${fmtLap(Number(p.lapSec))} s`));
        ul.append(li);
      });
      card.append(ul);
      const row = mk('div', 'btn-row');
      if (t.id !== activeTeamId) {
        const use = mk('button', 'btn', 'Usar');
        use.type = 'button';
        use.addEventListener('click', () => { useTeam(t.id); renderTeamList(); });
        row.append(use);
      }
      const edit = mk('button', 'btn btn-ghost', 'Editar');
      edit.type = 'button';
      edit.addEventListener('click', () => { editor.open(t.id); renderTeamList(); $('te-name').focus(); });
      row.append(edit);
      card.append(row);
      return card;
    }));
  }

  function renderTeams() {
    if (!editor.current() || (editor.current() !== 'new' && !teams.some((t) => t.id === editor.current()))) editor.open(activeTeamId);
    renderTeamList();
  }

  function boot() {
    fillForm();
    renderHeader();
    let tab = ui.tab;
    try {
      const h = (location.hash || '').replace('#', '');
      if (TABS.includes(h)) tab = h;
    } catch (e) { /* ok */ }
    if (race.pit) fillPilotSelect($('pitPilotIn'), defaultNextPilot());
    fillPilotSelect($('lvStarter'), cfg.order[0]);
    setTab(tab);
    renderLive(true);
    setupOffline();
    if (started() && race.frozenElapsed == null) keepAwake();
  }
  boot();
})();
