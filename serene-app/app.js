// Serene — Mental Health & Habit Tracker
// Vanilla JS SPA. Local storage only.

const STORAGE = {
  habits: 'serene.habits.v1',
  entries: 'serene.entries.v1',
  settings: 'serene.settings.v1',
};

const PRESETS_POS = [
  { name: 'Early start (woke up early)' },
  { name: 'Getting 7–9 hours of quality sleep' },
  { name: 'Drinking enough water' },
  { name: 'Ate at least 3 times' },
  { name: 'Keeping your living/workspace tidy' },
  { name: 'Have a decent social interaction with someone' },
];
const PRESETS_NEG = [
  { name: 'Skipped meals' },
  { name: 'Excess screen time before bed' },
  { name: 'Doom-scrolling' },
  { name: 'Skipped movement / exercise' },
];

const uid = () => Math.random().toString(36).slice(2, 10);
const todayKey = (d = new Date()) => {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};
const parseKey = (k) => { const [y,m,d] = k.split('-').map(Number); return new Date(y, m-1, d); };
const fmtLongDate = (d) => d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
const monthName = (d) => d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

// State
let state = {
  view: 'today',        // today | month | habits | settings
  monthDate: new Date(),
  detailKey: null,
  habits: load(STORAGE.habits, null),
  entries: load(STORAGE.entries, {}),
  settings: load(STORAGE.settings, { theme: 'dark', bg: '', notifyEnabled: false, notifyEveryHours: 2, notifyStart: 9, notifyEnd: 22, notifyAsked: false, updateUrl: '', lastUpdateCheck: 0, lastUpdateResult: '' }),
};

// Backfill new settings for existing users
const _defaults = { notifyEnabled: false, notifyEveryHours: 2, notifyStart: 9, notifyEnd: 22, notifyAsked: false, updateUrl: '', lastUpdateCheck: 0, lastUpdateResult: '' };
for (const k in _defaults) if (state.settings[k] === undefined) state.settings[k] = _defaults[k];
save(STORAGE.settings, state.settings);


if (!state.habits) {
  state.habits = {
    positive: PRESETS_POS.map(p => ({ id: uid(), name: p.name, enabled: true, preset: true })),
    negative: PRESETS_NEG.map(p => ({ id: uid(), name: p.name, enabled: true, preset: true })),
  };
  save(STORAGE.habits, state.habits);
}

function load(key, def) {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : def; }
  catch { return def; }
}
function save(key, val) { localStorage.setItem(key, JSON.stringify(val)); }

function getTodayEntry() {
  const k = todayKey();
  if (!state.entries[k]) {
    state.entries[k] = { date: k, checked: {}, mood: 5, mental: 5, submitted: false };
  }
  return state.entries[k];
}

function applyTheme() {
  const s = state.settings;
  const useDark = s.theme === 'dark' || (s.theme === 'system' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.body.classList.toggle('theme-light', !useDark);
  const bg = document.getElementById('bg-layer');
  if (s.bg) { bg.style.backgroundImage = `url("${s.bg}")`; bg.style.opacity = '.55'; }
  else { bg.style.backgroundImage = ''; bg.style.opacity = '1'; }
}

// =============== RENDER ===============
function render() {
  applyTheme();
  const root = document.getElementById('app');
  root.innerHTML = '';
  root.appendChild(sidebar());
  const content = el('main', 'content');
  if (state.view === 'today') content.appendChild(viewToday());
  else if (state.view === 'month') content.appendChild(viewMonth());
  else if (state.view === 'graphs') content.appendChild(viewGraphs());
  else if (state.view === 'habits') content.appendChild(viewHabits());
  else if (state.view === 'settings') content.appendChild(viewSettings());
  else if (state.view === 'about') content.appendChild(viewAbout());
  root.appendChild(content);
}

function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

function sidebar() {
  const s = el('aside', 'sidebar');
  const brand = el('div', 'brand');
  brand.appendChild(el('span', 'dot'));
  brand.appendChild(el('span', '', 'Serene'));
  s.appendChild(brand);
  const items = [
    ['today', '☀', 'Today'],
    ['month', '⊞', 'Monthly Overview'],
    ['graphs', '∿', 'Graphs'],
    ['habits', '✓', 'Habits'],
    ['settings', '⚙', 'Settings'],
    ['about', '❋', 'Serene'],
  ];
  items.forEach(([v, i, l]) => {
    const b = el('button', 'nav-btn' + (state.view === v ? ' active' : ''));
    b.appendChild(el('span', 'ico', i));
    b.appendChild(el('span', '', l));
    b.onclick = () => { state.view = v; state.detailKey = null; render(); };
    s.appendChild(b);
  });
  const foot = el('div', 'sidebar-foot', 'Your data stays on this device.');
  s.appendChild(foot);
  return s;
}

// -------- TODAY --------
function viewToday() {
  const wrap = document.createDocumentFragment();
  const today = new Date();
  const entry = getTodayEntry();

  const head = el('div', 'page-head');
  const l = el('div');
  l.appendChild(el('h1', 'page-title', 'Today'));
  l.appendChild(el('div', 'page-sub', fmtLongDate(today)));
  head.appendChild(l);
  if (entry.submitted) {
    const badge = el('div', 'stat');
    badge.appendChild(el('div', 'stat-label', 'Status'));
    badge.appendChild(el('div', 'stat-val', 'Submitted ✓'));
    head.appendChild(badge);
  }
  const container = el('div');
  container.appendChild(head);

  const grid = el('div', 'grid-2');
  // habits panel
  const habitsPanel = el('section', 'glass');
  habitsPanel.appendChild(el('h3', 'panel-title', 'Daily Habits'));
  const enabledPos = state.habits.positive.filter(h => h.enabled);
  const enabledNeg = state.habits.negative.filter(h => h.enabled);

  const posGroup = el('div', 'habit-group');
  posGroup.appendChild(el('div', 'habit-group-label', 'Positive'));
  if (enabledPos.length === 0) posGroup.appendChild(el('div', 'empty-state', 'No positive habits enabled. Add some in Habits.'));
  enabledPos.forEach(h => posGroup.appendChild(habitRow(h, entry, false)));
  habitsPanel.appendChild(posGroup);

  const negGroup = el('div', 'habit-group');
  negGroup.appendChild(el('div', 'habit-group-label', 'Negative (avoid)'));
  if (enabledNeg.length === 0) negGroup.appendChild(el('div', 'empty-state', 'No negative habits enabled.'));
  enabledNeg.forEach(h => negGroup.appendChild(habitRow(h, entry, true)));
  habitsPanel.appendChild(negGroup);

  grid.appendChild(habitsPanel);

  // meters + submit panel
  const right = el('section', 'glass');
  right.appendChild(el('h3', 'panel-title', 'How are you feeling?'));

  const moodMeter = meter('Mood — How happy were you today?', entry.mood, (v) => { entry.mood = v; save(STORAGE.entries, state.entries); });
  right.appendChild(moodMeter);
  const mentalMeter = meter('Mental state — Clarity & calm', entry.mental, (v) => { entry.mental = v; save(STORAGE.entries, state.entries); });
  right.appendChild(mentalMeter);

  const submitBtn = el('button', 'btn btn-primary btn-lg', entry.submitted ? 'Update Submitted Day →' : 'Submit Day');
  submitBtn.onclick = () => {
    entry.submitted = true;
    entry.submittedAt = new Date().toISOString();
    save(STORAGE.entries, state.entries);
    state.view = 'month';
    state.monthDate = new Date();
    state.detailKey = entry.date;
    render();
  };
  right.appendChild(submitBtn);

  grid.appendChild(right);
  container.appendChild(grid);
  wrap.appendChild(container);
  return wrap;
}

function habitRow(habit, entry, isNeg) {
  const checked = !!entry.checked[habit.id];
  const row = el('div', 'habit-row' + (checked ? ' checked' : '') + (isNeg ? ' neg' : ''));
  const c = el('div', 'check', checked ? '✓' : '');
  row.appendChild(c);
  row.appendChild(el('div', 'habit-name', habit.name));
  if (habit.preset) row.appendChild(el('div', 'habit-badge', 'preset'));
  row.onclick = () => {
    entry.checked[habit.id] = !checked;
    save(STORAGE.entries, state.entries);
    render();
  };
  return row;
}

function meter(label, value, onChange) {
  const m = el('div', 'meter');
  const head = el('div', 'meter-head');
  head.appendChild(el('span', '', label));
  const v = el('span', 'meter-val', String(value));
  head.appendChild(v);
  m.appendChild(head);
  const input = document.createElement('input');
  input.type = 'range'; input.min = '0'; input.max = '10'; input.step = '1'; input.value = value;
  input.oninput = () => { v.textContent = input.value; onChange(Number(input.value)); };
  m.appendChild(input);
  return m;
}

// -------- MONTH --------
function viewMonth() {
  const wrap = document.createDocumentFragment();
  const md = state.monthDate;
  const head = el('div', 'page-head');
  const l = el('div');
  l.appendChild(el('h1', 'page-title', 'Monthly Overview'));
  l.appendChild(el('div', 'page-sub', 'Track patterns, celebrate wins, spot what to gently improve.'));
  head.appendChild(l);
  const nav = el('div', 'row');
  const prev = el('button', 'btn btn-icon', '‹'); prev.onclick = () => { state.monthDate = new Date(md.getFullYear(), md.getMonth() - 1, 1); state.detailKey = null; render(); };
  const next = el('button', 'btn btn-icon', '›'); next.onclick = () => { state.monthDate = new Date(md.getFullYear(), md.getMonth() + 1, 1); state.detailKey = null; render(); };
  const today = el('button', 'btn btn-icon', 'Today'); today.onclick = () => { state.monthDate = new Date(); state.detailKey = null; render(); };
  const title = el('div', 'cal-title', monthName(md));
  nav.appendChild(prev); nav.appendChild(title); nav.appendChild(next); nav.appendChild(today);
  head.appendChild(nav);
  wrap.appendChild(head);

  const grid = el('div', 'grid-2');
  grid.appendChild(calendarPanel(md));
  grid.appendChild(analysisPanel(md));
  wrap.appendChild(grid);

  if (state.detailKey && state.entries[state.detailKey]) {
    wrap.appendChild(dayDetailModal(state.detailKey));
  }
  return wrap;
}

function calendarPanel(md) {
  const panel = el('section', 'glass');
  panel.appendChild(el('h3', 'panel-title', 'Calendar'));
  const grid = el('div', 'cal-grid');
  // header row
  grid.appendChild(el('div', 'cal-week-label', ''));
  ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].forEach(d => grid.appendChild(el('div', 'cal-dow', d)));

  const y = md.getFullYear(), m = md.getMonth();
  const firstDow = (new Date(y, m, 1).getDay() + 6) % 7; // Mon=0
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const totalCells = Math.ceil((firstDow + daysInMonth) / 7) * 7;
  const todayK = todayKey();

  let weekIdx = 0;
  for (let i = 0; i < totalCells; i++) {
    if (i % 7 === 0) {
      weekIdx++;
      grid.appendChild(el('div', 'cal-week-label', 'Week ' + weekIdx));
    }
    const dayNum = i - firstDow + 1;
    if (dayNum < 1 || dayNum > daysInMonth) {
      grid.appendChild(el('div', 'cal-day empty'));
      continue;
    }
    const key = todayKey(new Date(y, m, dayNum));
    const entry = state.entries[key];
    const cell = el('div', 'cal-day' + (key === todayK ? ' today' : '') + (entry && entry.submitted ? ' has-data' : ''));
    if (entry && entry.submitted) {
      cell.style.setProperty('--day-color', dayColor(entry));
    }
    cell.appendChild(el('div', 'cal-dnum', String(dayNum)));
    if (entry && entry.submitted) {
      const s = summarize(entry);
      cell.appendChild(el('div', 'cal-badge', `${s.doneCount}/${s.total} · M${entry.mood}`));
    }
    cell.onclick = () => { if (entry && entry.submitted) { state.detailKey = key; render(); } };
    grid.appendChild(cell);
  }
  panel.appendChild(grid);
  const legend = el('div', 'row wrap', ''); legend.style.marginTop = '14px'; legend.style.fontSize = '12px'; legend.style.color = 'var(--fg-mute)';
  legend.append('Green tint = great day · Amber = mixed · Rose = tough day. Click any day for details.');
  panel.appendChild(legend);
  return panel;
}

function dayColor(entry) {
  const s = summarize(entry);
  const score = (entry.mood + entry.mental) / 2 * 10 + s.posRate * 40 - s.negRate * 30; // 0..~140
  if (score >= 75) return 'rgba(125, 227, 176, .55)';
  if (score >= 45) return 'rgba(255, 210, 138, .55)';
  return 'rgba(255, 154, 168, .5)';
}

function summarize(entry) {
  const pos = state.habits.positive;
  const neg = state.habits.negative;
  const posDone = pos.filter(h => entry.checked[h.id]).length;
  const negDone = neg.filter(h => entry.checked[h.id]).length;
  return {
    posDone, negDone,
    total: pos.length + neg.length,
    doneCount: posDone + negDone,
    posRate: pos.length ? posDone / pos.length : 0,
    negRate: neg.length ? negDone / neg.length : 0,
  };
}

// -------- ANALYSIS --------
function analysisPanel(md) {
  const panel = el('section', 'glass');
  panel.appendChild(el('h3', 'panel-title', 'Monthly Analysis'));

  const y = md.getFullYear(), m = md.getMonth();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const days = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const k = todayKey(new Date(y, m, d));
    const e = state.entries[k];
    if (e && e.submitted) days.push(e);
  }

  if (days.length === 0) {
    panel.appendChild(el('div', 'empty-state', 'No submitted days this month yet. Submit a day from the Today view to unlock analysis.'));
    return panel;
  }

  const avgMood = days.reduce((a, b) => a + b.mood, 0) / days.length;
  const avgMental = days.reduce((a, b) => a + b.mental, 0) / days.length;
  const best = [...days].sort((a, b) => (b.mood + b.mental) - (a.mood + a.mental))[0];
  const worst = [...days].sort((a, b) => (a.mood + a.mental) - (b.mood + b.mental))[0];

  const stats = el('div', 'stat-grid');
  stats.appendChild(statBox('Logged Days', days.length, `of ${daysInMonth}`));
  stats.appendChild(statBox('Avg Mood', avgMood.toFixed(1), '/ 10'));
  stats.appendChild(statBox('Avg Mental', avgMental.toFixed(1), '/ 10'));
  stats.appendChild(statBox('Best Day', String(parseKey(best.date).getDate()), fmtLongDate(parseKey(best.date))));
  panel.appendChild(stats);

  // Smooth line charts
  panel.appendChild(el('div', 'panel-title', 'Mood & Mental State'));
  panel.appendChild(lineChart(y, m, daysInMonth, [
    { key: 'mood', label: 'Mood', color: 'var(--accent)' },
    { key: 'mental', label: 'Mental', color: 'var(--accent-2)' },
  ]));


  // Habit completion rates
  panel.appendChild(el('div', 'panel-title', 'Habit Completion'));
  const allHabits = [
    ...state.habits.positive.map(h => ({ ...h, kind: 'pos' })),
    ...state.habits.negative.map(h => ({ ...h, kind: 'neg' })),
  ];
  allHabits.filter(h => h.enabled).forEach(h => {
    const done = days.filter(d => d.checked[h.id]).length;
    const rate = days.length ? done / days.length : 0;
    const row = el('div', 'hrate-row');
    const top = el('div', 'hrate-top');
    top.appendChild(el('span', '', h.name + (h.kind === 'neg' ? '  (neg)' : '')));
    top.appendChild(el('span', '', Math.round(rate * 100) + '%  ·  ' + done + '/' + days.length));
    row.appendChild(top);
    const bar = el('div', 'bar' + (h.kind === 'neg' ? ' neg' : ''));
    const fill = el('i'); fill.style.width = (rate * 100) + '%'; bar.appendChild(fill);
    row.appendChild(bar);
    panel.appendChild(row);
  });

  // Insights
  panel.appendChild(el('div', 'panel-title', 'Insights'));
  const insights = deriveInsights(days, allHabits, avgMood, avgMental, best, worst);
  insights.forEach(i => {
    const box = el('div', 'insight ' + i.tone);
    box.innerHTML = i.html;
    panel.appendChild(box);
  });

  return panel;
}

function statBox(label, val, sub) {
  const s = el('div', 'stat');
  s.appendChild(el('div', 'stat-label', label));
  s.appendChild(el('div', 'stat-val', String(val)));
  if (sub) s.appendChild(el('div', 'stat-sub', sub));
  return s;
}

// Smooth SVG line chart — Catmull-Rom to Bezier for silky curves
function lineChart(y, m, daysInMonth, series, opts) {
  opts = opts || {};
  const big = !!opts.big;
  const yMax = opts.max || 10;
  const yFmt = opts.yFmt || ((v) => String(v));
  const W = 640, H = big ? 340 : 220, padL = 40, padR = 16, padT = 20, padB = 28;
  const innerW = W - padL - padR, innerH = H - padT - padB;
  const xs = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const k = todayKey(new Date(y, m, d));
    const e = state.entries[k];
    xs.push({ d, k, e: e && e.submitted ? e : null });
  }
  const xAt = (i) => padL + (daysInMonth === 1 ? innerW / 2 : (i * innerW) / (daysInMonth - 1));
  const yAt = (v) => padT + innerH - (Math.max(0, Math.min(yMax, v)) / yMax) * innerH;

  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('class', 'linechart' + (big ? ' big' : ''));
  svg.setAttribute('preserveAspectRatio', 'none');

  // Gridlines & Y labels — three ticks: 0, mid, max
  const yTicks = [0, yMax / 2, yMax];
  yTicks.forEach(v => {
    const gy = yAt(v);
    const line = document.createElementNS(svgNS, 'line');
    line.setAttribute('x1', padL); line.setAttribute('x2', W - padR);
    line.setAttribute('y1', gy); line.setAttribute('y2', gy);
    line.setAttribute('class', 'grid');
    svg.appendChild(line);
    const t = document.createElementNS(svgNS, 'text');
    t.setAttribute('x', padL - 8); t.setAttribute('y', gy + 4);
    t.setAttribute('class', 'axis'); t.setAttribute('text-anchor', 'end');
    t.textContent = yFmt(v);
    svg.appendChild(t);
  });
  // X labels: 1, 8, 15, 22, last
  const xTicks = Array.from(new Set([1, 8, 15, 22, daysInMonth]));
  xTicks.forEach(d => {
    const i = d - 1;
    const t = document.createElementNS(svgNS, 'text');
    t.setAttribute('x', xAt(i)); t.setAttribute('y', H - 8);
    t.setAttribute('class', 'axis'); t.setAttribute('text-anchor', 'middle');
    t.textContent = String(d);
    svg.appendChild(t);
  });

  // For each series: build smooth path over segments of contiguous data
  series.forEach((sr, idx) => {
    const getVal = sr.compute ? sr.compute : (e) => e[sr.key];
    const points = xs.map((x, i) => {
      if (!x.e) return null;
      const v = getVal(x.e);
      if (v == null || isNaN(v)) return null;
      return { x: xAt(i), y: yAt(v), i, v, k: x.k };
    });
    const runs = [];
    let cur = [];
    points.forEach(p => { if (p) cur.push(p); else if (cur.length) { runs.push(cur); cur = []; } });
    if (cur.length) runs.push(cur);

    const gradId = `grad-${sr.key || 'c'}-${idx}-${Math.random().toString(36).slice(2,7)}`;
    const defs = document.createElementNS(svgNS, 'defs');
    defs.innerHTML = `<linearGradient id="${gradId}" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0%" stop-color="${sr.color}" stop-opacity="0.38"/>
      <stop offset="100%" stop-color="${sr.color}" stop-opacity="0"/>
    </linearGradient>`;
    svg.appendChild(defs);

    runs.forEach(run => {
      if (run.length < 1) return;
      const d = smoothPath(run);
      if (run.length >= 2) {
        const area = document.createElementNS(svgNS, 'path');
        area.setAttribute('d', d + ` L ${run[run.length-1].x} ${padT + innerH} L ${run[0].x} ${padT + innerH} Z`);
        area.setAttribute('fill', `url(#${gradId})`);
        area.setAttribute('class', 'area');
        svg.appendChild(area);
      }
      const line = document.createElementNS(svgNS, 'path');
      line.setAttribute('d', d);
      line.setAttribute('fill', 'none');
      line.setAttribute('stroke', sr.color);
      line.setAttribute('stroke-width', big ? '3' : '2.5');
      line.setAttribute('stroke-linecap', 'round');
      line.setAttribute('stroke-linejoin', 'round');
      line.setAttribute('class', 'lineseg');
      line.style.filter = `drop-shadow(0 2px 8px ${sr.color})`;
      svg.appendChild(line);
      run.forEach(p => {
        const c = document.createElementNS(svgNS, 'circle');
        c.setAttribute('cx', p.x); c.setAttribute('cy', p.y);
        c.setAttribute('r', big ? '3.5' : '3'); c.setAttribute('fill', sr.color); c.setAttribute('class', 'dot');
        const title = document.createElementNS(svgNS, 'title');
        title.textContent = `${p.k} · ${sr.label} ${sr.tipFmt ? sr.tipFmt(p.v) : p.v}`;
        c.appendChild(title);
        svg.appendChild(c);
      });
    });
  });

  const wrap = el('div', 'chart-wrap' + (big ? ' big' : ''));
  wrap.appendChild(svg);
  const legend = el('div', 'chart-legend');
  series.forEach(sr => {
    const item = el('span', 'legend-item');
    const sw = el('span', 'legend-sw'); sw.style.background = sr.color;
    item.appendChild(sw); item.appendChild(el('span', '', sr.label));
    legend.appendChild(item);
  });
  wrap.appendChild(legend);
  return wrap;
}


function smoothPath(pts) {
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const t = 0.18; // tension
    const c1x = p1.x + (p2.x - p0.x) * t;
    const c1y = p1.y + (p2.y - p0.y) * t;
    const c2x = p2.x - (p3.x - p1.x) * t;
    const c2y = p2.y - (p3.y - p1.y) * t;
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}


function deriveInsights(days, habits, avgMood, avgMental, best, worst) {
  const out = [];
  const escape = (s) => String(s).replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));

  out.push({ tone: avgMood >= 7 ? 'good' : avgMood >= 5 ? 'warn' : 'bad',
    html: `Your average mood this month is <b>${avgMood.toFixed(1)}/10</b> and mental state <b>${avgMental.toFixed(1)}/10</b>.` });

  if (best && worst && best.date !== worst.date) {
    out.push({ tone: 'good', html: `Best day: <b>${escape(fmtLongDate(parseKey(best.date)))}</b> — mood ${best.mood}, mental ${best.mental}.` });
    out.push({ tone: 'bad', html: `Toughest day: <b>${escape(fmtLongDate(parseKey(worst.date)))}</b> — mood ${worst.mood}, mental ${worst.mental}.` });
  }

  // correlations
  habits.filter(h => h.enabled).forEach(h => {
    const withH = days.filter(d => d.checked[h.id]);
    const withoutH = days.filter(d => !d.checked[h.id]);
    if (withH.length >= 2 && withoutH.length >= 2) {
      const a = withH.reduce((s, d) => s + d.mood + d.mental, 0) / withH.length;
      const b = withoutH.reduce((s, d) => s + d.mood + d.mental, 0) / withoutH.length;
      const diff = a - b;
      if (Math.abs(diff) >= 1.5) {
        const positive = (h.kind === 'pos' && diff > 0) || (h.kind === 'neg' && diff < 0);
        out.push({
          tone: positive ? 'good' : 'warn',
          html: `On days you ${h.kind === 'neg' ? 'did' : 'did'} <b>${escape(h.name)}</b>, your combined mood+mental was ${diff > 0 ? 'higher' : 'lower'} by <b>${Math.abs(diff).toFixed(1)} pts</b>.`
        });
      }
    }
  });

  // streak
  const sortedKeys = Object.keys(state.entries).filter(k => state.entries[k].submitted).sort();
  let streak = 0, cursor = new Date();
  while (true) {
    const k = todayKey(cursor);
    if (state.entries[k] && state.entries[k].submitted) { streak++; cursor.setDate(cursor.getDate() - 1); }
    else break;
  }
  if (streak >= 2) out.push({ tone: 'good', html: `Current logging streak: <b>${streak} day${streak>1?'s':''}</b>. Consistency is a superpower.` });

  // weekend vs weekday
  const wknd = days.filter(d => { const w = parseKey(d.date).getDay(); return w === 0 || w === 6; });
  const wk = days.filter(d => { const w = parseKey(d.date).getDay(); return w !== 0 && w !== 6; });
  if (wknd.length && wk.length) {
    const wknMood = wknd.reduce((s, d) => s + d.mood, 0) / wknd.length;
    const wkMood = wk.reduce((s, d) => s + d.mood, 0) / wk.length;
    if (Math.abs(wknMood - wkMood) >= 1) {
      out.push({ tone: 'warn', html: `You feel <b>${wknMood > wkMood ? 'better on weekends' : 'better on weekdays'}</b> (Δ ${Math.abs(wknMood-wkMood).toFixed(1)} mood pts).` });
    }
  }

  return out;
}

// -------- DAY DETAIL --------
function dayDetailModal(key) {
  const entry = state.entries[key];
  const back = el('div', 'modal-back');
  back.onclick = (e) => { if (e.target === back) { state.detailKey = null; render(); } };
  const modal = el('div', 'modal glass');
  const close = el('button', 'btn btn-icon modal-close', '✕');
  close.onclick = () => { state.detailKey = null; render(); };
  modal.appendChild(close);
  modal.appendChild(el('h2', '', fmtLongDate(parseKey(key))));

  const s = summarize(entry);
  const stats = el('div', 'stat-grid');
  stats.appendChild(statBox('Mood', entry.mood, '/ 10'));
  stats.appendChild(statBox('Mental', entry.mental, '/ 10'));
  stats.appendChild(statBox('Positive done', s.posDone, `of ${state.habits.positive.length}`));
  stats.appendChild(statBox('Negative done', s.negDone, `of ${state.habits.negative.length}`));
  modal.appendChild(stats);

  modal.appendChild(el('div', 'panel-title', 'Positive habits'));
  state.habits.positive.forEach(h => {
    const row = el('div', 'habit-row' + (entry.checked[h.id] ? ' checked' : ''));
    row.appendChild(el('div', 'check', entry.checked[h.id] ? '✓' : ''));
    row.appendChild(el('div', 'habit-name', h.name));
    modal.appendChild(row);
  });
  modal.appendChild(el('div', 'panel-title', 'Negative habits'));
  state.habits.negative.forEach(h => {
    const row = el('div', 'habit-row neg' + (entry.checked[h.id] ? ' checked' : ''));
    row.appendChild(el('div', 'check', entry.checked[h.id] ? '✓' : ''));
    row.appendChild(el('div', 'habit-name', h.name));
    modal.appendChild(row);
  });

  back.appendChild(modal);
  return back;
}

// -------- GRAPHS --------
function viewGraphs() {
  const wrap = document.createDocumentFragment();
  const md = state.monthDate;
  const y = md.getFullYear(), m = md.getMonth();
  const daysInMonth = new Date(y, m + 1, 0).getDate();

  const head = el('div', 'page-head');
  const l = el('div');
  l.appendChild(el('h1', 'page-title', 'Graphs'));
  l.appendChild(el('div', 'page-sub', 'Big, smooth trends across the month.'));
  head.appendChild(l);
  const nav = el('div', 'row');
  const prev = el('button', 'btn btn-icon', '‹'); prev.onclick = () => { state.monthDate = new Date(y, m - 1, 1); render(); };
  const next = el('button', 'btn btn-icon', '›'); next.onclick = () => { state.monthDate = new Date(y, m + 1, 1); render(); };
  const today = el('button', 'btn btn-icon', 'Today'); today.onclick = () => { state.monthDate = new Date(); render(); };
  const title = el('div', 'cal-title', monthName(md));
  nav.appendChild(prev); nav.appendChild(title); nav.appendChild(next); nav.appendChild(today);
  head.appendChild(nav);
  wrap.appendChild(head);

  // Any data this month?
  let hasAny = false;
  for (let d = 1; d <= daysInMonth; d++) {
    const e = state.entries[todayKey(new Date(y, m, d))];
    if (e && e.submitted) { hasAny = true; break; }
  }
  if (!hasAny) {
    const empty = el('section', 'glass');
    empty.appendChild(el('div', 'empty-state', 'No submitted days this month yet. Submit a day from the Today view to see the graphs come alive.'));
    wrap.appendChild(empty);
    return wrap;
  }

  const posHabits = state.habits.positive.filter(h => h.enabled);
  const negHabits = state.habits.negative.filter(h => h.enabled);

  const pct = (v) => Math.round(v) + '%';
  const posRate = (e) => posHabits.length ? (posHabits.filter(h => e.checked[h.id]).length / posHabits.length) * 100 : null;
  const negRate = (e) => negHabits.length ? (negHabits.filter(h => e.checked[h.id]).length / negHabits.length) * 100 : null;

  // Mood + Mental (theme colors)
  const p1 = el('section', 'glass');
  p1.appendChild(el('h3', 'panel-title', 'Mood & Mental State'));
  p1.appendChild(lineChart(y, m, daysInMonth, [
    { key: 'mood', label: 'Mood', color: 'var(--accent)' },
    { key: 'mental', label: 'Mental', color: 'var(--accent-2)' },
  ], { big: true, max: 10 }));
  wrap.appendChild(p1);

  // Good habits — green
  const p2 = el('section', 'glass');
  p2.appendChild(el('h3', 'panel-title', 'Good Habits — daily completion'));
  if (posHabits.length === 0) {
    p2.appendChild(el('div', 'empty-state', 'No positive habits enabled. Add some in Habits.'));
  } else {
    p2.appendChild(lineChart(y, m, daysInMonth, [
      { key: 'posRate', label: 'Positive habits done', color: 'var(--good)', compute: posRate, tipFmt: pct },
    ], { big: true, max: 100, yFmt: (v) => v + '%' }));
  }
  wrap.appendChild(p2);

  // Bad habits — red
  const p3 = el('section', 'glass');
  p3.appendChild(el('h3', 'panel-title', 'Bad Habits — daily slip rate'));
  if (negHabits.length === 0) {
    p3.appendChild(el('div', 'empty-state', 'No negative habits enabled.'));
  } else {
    p3.appendChild(lineChart(y, m, daysInMonth, [
      { key: 'negRate', label: 'Negative habits done', color: 'var(--bad)', compute: negRate, tipFmt: pct },
    ], { big: true, max: 100, yFmt: (v) => v + '%' }));
  }
  wrap.appendChild(p3);

  return wrap;
}

// -------- ABOUT / SERENE --------
function viewAbout() {
  const wrap = document.createDocumentFragment();
  const head = el('div', 'page-head');
  const l = el('div');
  l.appendChild(el('h1', 'page-title', 'Serene'));
  l.appendChild(el('div', 'page-sub', 'A quiet space for looking after yourself.'));
  head.appendChild(l);
  wrap.appendChild(head);

  const panel = el('div', 'panel');
  panel.appendChild(el('h3', 'panel-title', 'What Serene is for'));

  const intro = el('p', 'about-p',
    'Serene is a calm, private companion for your mental wellbeing. It helps you notice how you feel and how you live, one day at a time, without noise or pressure.'
  );
  panel.appendChild(intro);

  const p2 = el('p', 'about-p',
    'Every day you check in with a short mood and mental state rating, tick off the habits you kept, and mark the ones that slipped. Nothing is shared, nothing leaves your computer. Your entries live only on this device.'
  );
  panel.appendChild(p2);

  const p3 = el('p', 'about-p',
    'Over time Serene turns those small check ins into something meaningful. The Monthly Overview shows your rhythm across the weeks, the Graphs section reveals how your mood and habits move together, and the built in analysis points out patterns that are easy to miss in the moment.'
  );
  panel.appendChild(p3);

  const p4 = el('p', 'about-p',
    'The goal is simple. Give you a gentle mirror so you can understand yourself a little better, celebrate the good streaks, and be kinder to the harder days.'
  );
  panel.appendChild(p4);

  const list = el('ul', 'about-list');
  [
    'Track mood and mental state on a soft 0 to 10 scale.',
    'Build your own set of positive and negative habits.',
    'See a full monthly calendar with a summary for every day.',
    'Explore smooth graphs for mood, good habits and bad habits.',
    'Get optional reminders so checking in becomes a habit itself.',
    'Export a backup any time, or import one to move between machines.',
  ].forEach(t => {
    const li = el('li', '', t);
    list.appendChild(li);
  });
  panel.appendChild(list);

  const foot = el('div', 'about-foot', 'Version ' + APP_VERSION + ' — made to be used slowly.');
  panel.appendChild(foot);

  wrap.appendChild(panel);
  return wrap;
}

// -------- HABITS --------

function viewHabits() {
  const wrap = document.createDocumentFragment();
  const head = el('div', 'page-head');
  const l = el('div');
  l.appendChild(el('h1', 'page-title', 'Habits'));
  l.appendChild(el('div', 'page-sub', 'Curate what you want to track. Enable, disable, add or remove any habit.'));
  head.appendChild(l);
  wrap.appendChild(head);

  const grid = el('div', 'grid-2');
  grid.appendChild(habitListPanel('positive', 'Positive Habits', PRESETS_POS));
  grid.appendChild(habitListPanel('negative', 'Negative Habits', PRESETS_NEG));
  wrap.appendChild(grid);
  return wrap;
}

function habitListPanel(kind, title, presets) {
  const panel = el('section', 'glass');
  panel.appendChild(el('h3', 'panel-title', title));
  const list = state.habits[kind];
  list.forEach(h => {
    const row = el('div', 'habit-row' + (h.enabled ? ' checked' : '') + (kind === 'negative' ? ' neg' : ''));
    const c = el('div', 'check', h.enabled ? '✓' : '');
    c.onclick = (e) => { e.stopPropagation(); h.enabled = !h.enabled; save(STORAGE.habits, state.habits); render(); };
    row.appendChild(c);
    row.appendChild(el('div', 'habit-name', h.name));
    if (h.preset) row.appendChild(el('div', 'habit-badge', 'preset'));
    const del = el('button', 'btn btn-icon btn-danger', '✕');
    del.onclick = (e) => { e.stopPropagation(); state.habits[kind] = list.filter(x => x.id !== h.id); save(STORAGE.habits, state.habits); render(); };
    row.appendChild(del);
    row.onclick = () => { h.enabled = !h.enabled; save(STORAGE.habits, state.habits); render(); };
    panel.appendChild(row);
  });

  // Add custom
  const addRow = el('div', 'row'); addRow.style.marginTop = '14px';
  const input = document.createElement('input'); input.type = 'text'; input.placeholder = 'Add a custom ' + (kind === 'positive' ? 'positive' : 'negative') + ' habit…';
  const add = el('button', 'btn btn-primary', 'Add');
  add.onclick = () => {
    const v = input.value.trim(); if (!v) return;
    state.habits[kind].push({ id: uid(), name: v, enabled: true, preset: false });
    save(STORAGE.habits, state.habits); render();
  };
  input.onkeydown = (e) => { if (e.key === 'Enter') add.click(); };
  addRow.appendChild(input); addRow.appendChild(add);
  panel.appendChild(addRow);

  // Preset suggestions
  const existing = new Set(list.map(h => h.name));
  const missing = presets.filter(p => !existing.has(p.name));
  if (missing.length) {
    panel.appendChild(el('div', 'panel-title', 'Add preset'));
    const wrap = el('div', 'row wrap');
    missing.forEach(p => {
      const b = el('button', 'btn btn-icon', '+ ' + p.name);
      b.onclick = () => {
        state.habits[kind].push({ id: uid(), name: p.name, enabled: true, preset: true });
        save(STORAGE.habits, state.habits); render();
      };
      wrap.appendChild(b);
    });
    panel.appendChild(wrap);
  }
  return panel;
}

// -------- SETTINGS --------
function viewSettings() {
  const wrap = document.createDocumentFragment();
  const head = el('div', 'page-head');
  const l = el('div');
  l.appendChild(el('h1', 'page-title', 'Settings'));
  l.appendChild(el('div', 'page-sub', 'Personalize the atmosphere.'));
  head.appendChild(l);
  wrap.appendChild(head);

  const panel = el('section', 'glass');
  // theme
  const themeRow = el('div', 'setting-row');
  const tl = el('div', 'setting-label'); tl.appendChild(el('b', '', 'Theme')); tl.appendChild(el('span', '', 'Choose the color mode of the app.'));
  themeRow.appendChild(tl);
  const chips = el('div', 'chip-group');
  ['dark', 'light', 'system'].forEach(t => {
    const c = el('div', 'chip' + (state.settings.theme === t ? ' active' : ''), t[0].toUpperCase() + t.slice(1));
    c.onclick = () => { state.settings.theme = t; save(STORAGE.settings, state.settings); render(); };
    chips.appendChild(c);
  });
  themeRow.appendChild(chips);
  panel.appendChild(themeRow);

  // background
  const bgRow = el('div', 'setting-row');
  const bl = el('div', 'setting-label'); bl.appendChild(el('b', '', 'Custom background image')); bl.appendChild(el('span', '', 'Choose an image to set the mood. It will be tinted for readability.'));
  bgRow.appendChild(bl);
  const bgActions = el('div', 'row');
  const file = document.createElement('input'); file.type = 'file'; file.accept = 'image/*'; file.style.display = 'none';
  file.onchange = () => {
    const f = file.files && file.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => { state.settings.bg = r.result; save(STORAGE.settings, state.settings); render(); };
    r.readAsDataURL(f);
  };
  const pick = el('button', 'btn btn-primary', 'Choose image…'); pick.onclick = () => file.click();
  const clear = el('button', 'btn', 'Clear'); clear.onclick = () => { state.settings.bg = ''; save(STORAGE.settings, state.settings); render(); };
  bgActions.appendChild(pick); bgActions.appendChild(clear); bgActions.appendChild(file);
  bgRow.appendChild(bgActions);
  panel.appendChild(bgRow);

  // NOTIFICATIONS
  const nRow = el('div', 'setting-row');
  const nl = el('div', 'setting-label');
  nl.appendChild(el('b', '', 'Reminders'));
  nl.appendChild(el('span', '', 'Gentle nudges to check in with yourself throughout the day.'));
  nRow.appendChild(nl);
  const nActs = el('div', 'row');
  const tgl = el('label', 'switch');
  const cbx = document.createElement('input'); cbx.type = 'checkbox'; cbx.checked = !!state.settings.notifyEnabled;
  const sl = el('span', 'slider');
  tgl.appendChild(cbx); tgl.appendChild(sl);
  cbx.onchange = async () => {
    if (cbx.checked) {
      const ok = await ensureNotifyPermission();
      state.settings.notifyEnabled = ok;
    } else state.settings.notifyEnabled = false;
    save(STORAGE.settings, state.settings);
    scheduleNotifications();
    render();
  };
  nActs.appendChild(tgl);
  nActs.appendChild(el('span', 'muted', state.settings.notifyEnabled ? 'On' : 'Off'));
  nRow.appendChild(nActs);
  panel.appendChild(nRow);

  if (state.settings.notifyEnabled) {
    const fRow = el('div', 'setting-row');
    const fl = el('div', 'setting-label');
    fl.appendChild(el('b', '', 'Reminder frequency'));
    fl.appendChild(el('span', '', `Send a reminder every few hours between ${fmtHr(state.settings.notifyStart)} and ${fmtHr(state.settings.notifyEnd)}.`));
    fRow.appendChild(fl);
    const fActs = el('div', 'row');
    const sel = document.createElement('select');
    [1,2,3,4,6,8].forEach(h => {
      const o = document.createElement('option'); o.value = h; o.textContent = `Every ${h} hour${h>1?'s':''}`;
      if (state.settings.notifyEveryHours === h) o.selected = true;
      sel.appendChild(o);
    });
    sel.onchange = () => { state.settings.notifyEveryHours = Number(sel.value); save(STORAGE.settings, state.settings); scheduleNotifications(); render(); };
    fActs.appendChild(sel);

    const mkHourInput = (val, onCommit) => {
      const wrap = el('div', 'num-wrap');
      const inp = document.createElement('input');
      inp.type = 'number'; inp.min = '0'; inp.max = '23'; inp.value = val;
      const btns = el('div', 'num-btns');
      const up = el('button', 'num-btn', '▲');
      const dn = el('button', 'num-btn', '▼');
      const commit = () => {
        const n = Math.max(0, Math.min(23, Number(inp.value) || 0));
        inp.value = n; onCommit(n);
      };
      up.onclick = (e) => { e.preventDefault(); inp.value = Math.min(23, (Number(inp.value)||0) + 1); commit(); };
      dn.onclick = (e) => { e.preventDefault(); inp.value = Math.max(0, (Number(inp.value)||0) - 1); commit(); };
      inp.onchange = commit;
      btns.appendChild(up); btns.appendChild(dn);
      wrap.appendChild(inp); wrap.appendChild(btns);
      return wrap;
    };
    const startI = mkHourInput(state.settings.notifyStart, (n) => { state.settings.notifyStart = n; save(STORAGE.settings, state.settings); scheduleNotifications(); render(); });
    const endI = mkHourInput(state.settings.notifyEnd, (n) => { state.settings.notifyEnd = n; save(STORAGE.settings, state.settings); scheduleNotifications(); render(); });
    fActs.appendChild(el('span', 'muted', 'from')); fActs.appendChild(startI);
    fActs.appendChild(el('span', 'muted', 'to')); fActs.appendChild(endI);

    const test = el('button', 'btn', 'Send test');
    test.onclick = async () => {
      const ok = await sendNotification('Serene', 'This is a test reminder. Take a slow breath.');
      if (!ok) alert('Could not show a notification. On Windows, make sure Serene is allowed to send notifications in Settings → System → Notifications.');
    };
    fActs.appendChild(test);
    fRow.appendChild(fActs);
    panel.appendChild(fRow);
  }

  // data
  const dataRow = el('div', 'setting-row');
  const dl = el('div', 'setting-label'); dl.appendChild(el('b', '', 'Your data')); dl.appendChild(el('span', '', 'Everything is stored locally on this device. Export a backup or import from one.'));
  dataRow.appendChild(dl);
  const dActs = el('div', 'row wrap');
  const exp = el('button', 'btn', 'Export backup'); exp.onclick = () => {
    const blob = new Blob([JSON.stringify({ v: 1, exportedAt: new Date().toISOString(), habits: state.habits, entries: state.entries, settings: state.settings }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `serene-backup-${todayKey()}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const impFile = document.createElement('input'); impFile.type = 'file'; impFile.accept = 'application/json,.json'; impFile.style.display = 'none';
  impFile.onchange = () => {
    const f = impFile.files && impFile.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const data = JSON.parse(r.result);
        if (!data || typeof data !== 'object') throw new Error('Invalid file');
        const mode = confirm('OK = MERGE imported data with existing data.\nCancel = REPLACE all existing data with the import.');
        importData(data, mode ? 'merge' : 'replace');
        alert('Import complete.');
        render();
      } catch (e) {
        alert('Could not import: ' + (e && e.message ? e.message : 'invalid file'));
      }
      impFile.value = '';
    };
    r.readAsText(f);
  };
  const imp = el('button', 'btn', 'Import backup'); imp.onclick = () => impFile.click();
  const reset = el('button', 'btn btn-danger', 'Reset all data'); reset.onclick = () => {
    if (!confirm('This will erase all habits and daily logs. Continue?')) return;
    localStorage.removeItem(STORAGE.habits); localStorage.removeItem(STORAGE.entries);
    location.reload();
  };
  dActs.appendChild(exp); dActs.appendChild(imp); dActs.appendChild(impFile); dActs.appendChild(reset);
  dataRow.appendChild(dActs);
  panel.appendChild(dataRow);

  // UPDATES
  const uRow = el('div', 'setting-row');
  const ul = el('div', 'setting-label');
  ul.appendChild(el('b', '', 'App version & updates'));
  const verSpan = el('span', '', `Current version: ${APP_VERSION}. ${state.settings.lastUpdateResult || 'Click check to look for a newer release.'}`);
  ul.appendChild(verSpan);
  uRow.appendChild(ul);
  const uActs = el('div', 'row wrap');
  const urlI = document.createElement('input'); urlI.type = 'text'; urlI.placeholder = 'Update manifest URL (JSON)'; urlI.value = state.settings.updateUrl || ''; urlI.style.minWidth = '260px';
  urlI.onchange = () => { state.settings.updateUrl = urlI.value.trim(); save(STORAGE.settings, state.settings); };
  const check = el('button', 'btn btn-primary', 'Check for updates');
  check.onclick = async () => {
    check.disabled = true; check.textContent = 'Checking…';
    const res = await checkForUpdates();
    state.settings.lastUpdateCheck = Date.now();
    state.settings.lastUpdateResult = res.message;
    save(STORAGE.settings, state.settings);
    if (res.url) {
      if (confirm(`${res.message}\n\nOpen download page?`)) {
        if (window.serene && window.serene.openExternal) window.serene.openExternal(res.url);
      }
    } else {
      alert(res.message);
    }
    render();
  };
  uActs.appendChild(urlI); uActs.appendChild(check);
  uRow.appendChild(uActs);
  panel.appendChild(uRow);

  wrap.appendChild(panel);
  return wrap;
}

const APP_VERSION = '1.1.4';
const fmtHr = (h) => { const n = ((h % 24) + 24) % 24; const s = n < 12 ? 'AM' : 'PM'; const hh = ((n + 11) % 12) + 1; return `${hh} ${s}`; };

async function ensureNotifyPermission() {
  // In Electron we route notifications through the main process (native OS toasts),
  // so we don't require the browser Notification permission. Just say yes.
  if (window.serene && window.serene.notify) return true;
  if (!('Notification' in window)) return true;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') { alert('Notifications are blocked. Enable them in your OS notification settings for Serene.'); return false; }
  try {
    const p = await Notification.requestPermission();
    return p === 'granted';
  } catch { return true; }
}

async function sendNotification(title, body) {
  // Prefer Electron IPC (native Windows toast); fall back to web Notification.
  try {
    if (window.serene && window.serene.notify) {
      const ok = await window.serene.notify(title, body);
      if (ok) return true;
    }
  } catch (e) {}
  try {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body });
      return true;
    }
  } catch (e) {}
  return false;
}

let _notifyTimer = null;
function scheduleNotifications() {
  if (_notifyTimer) { clearInterval(_notifyTimer); _notifyTimer = null; }
  if (!state.settings.notifyEnabled) return;
  const hours = Math.max(1, Number(state.settings.notifyEveryHours) || 2);
  const tick = async () => {
    const now = new Date();
    const h = now.getHours();
    const s = state.settings.notifyStart, e = state.settings.notifyEnd;
    const inWindow = s <= e ? (h >= s && h < e) : (h >= s || h < e);
    if (!inWindow) return;
    const last = Number(localStorage.getItem('serene.lastNotify') || 0);
    if (Date.now() - last < hours * 3600 * 1000 - 60 * 1000) return;
    const entry = state.entries[todayKey()];
    const body = entry && entry.submitted
      ? 'Nice check-in earlier. How are you doing right now?'
      : 'A gentle nudge — check in with your mood and habits.';
    const ok = await sendNotification('Serene', body);
    if (ok) localStorage.setItem('serene.lastNotify', String(Date.now()));
  };
  // check every minute
  _notifyTimer = setInterval(tick, 60 * 1000);
  // initial small delay
  setTimeout(tick, 4000);
}

async function checkForUpdates() {
  const url = (state.settings.updateUrl || '').trim();
  if (!url) return { message: 'No update URL configured. Paste a JSON manifest URL (with a "version" field) to enable checks.' };
  try {
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const data = await r.json();
    const remote = String(data.version || '').trim();
    if (!remote) throw new Error('manifest missing "version"');
    if (cmpVer(remote, APP_VERSION) > 0) {
      return { message: `Update available: v${remote} (you have v${APP_VERSION}).`, url: data.url || data.download || url };
    }
    return { message: `You're up to date (v${APP_VERSION}).` };
  } catch (e) {
    return { message: 'Update check failed: ' + (e && e.message ? e.message : 'unknown error') };
  }
}
function cmpVer(a, b) {
  const pa = a.split('.').map(n => parseInt(n, 10) || 0);
  const pb = b.split('.').map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i]||0) - (pb[i]||0);
    if (d) return d;
  }
  return 0;
}

function importData(data, mode) {
  if (mode === 'replace') {
    if (data.habits && data.habits.positive && data.habits.negative) state.habits = data.habits;
    if (data.entries && typeof data.entries === 'object') state.entries = data.entries;
    if (data.settings && typeof data.settings === 'object') {
      // preserve current update url + theme choice unless explicitly present
      state.settings = Object.assign({}, state.settings, data.settings);
    }
  } else {
    // merge
    if (data.habits) {
      ['positive','negative'].forEach(k => {
        const cur = state.habits[k] || [];
        const names = new Set(cur.map(h => h.name));
        (data.habits[k] || []).forEach(h => { if (!names.has(h.name)) cur.push({ ...h, id: uid() }); });
        state.habits[k] = cur;
      });
    }
    if (data.entries) {
      for (const k in data.entries) {
        if (!state.entries[k]) state.entries[k] = data.entries[k];
      }
    }
  }
  save(STORAGE.habits, state.habits);
  save(STORAGE.entries, state.entries);
  save(STORAGE.settings, state.settings);
}

// First-launch notification prompt
async function maybePromptNotifications() {
  if (state.settings.notifyAsked) return;
  state.settings.notifyAsked = true;
  save(STORAGE.settings, state.settings);
  setTimeout(async () => {
    const yes = confirm('Would you like Serene to send you gentle reminders throughout the day to check in with your mood and habits?\n\nYou can change the frequency or turn this off any time in Settings.');
    if (yes) {
      const ok = await ensureNotifyPermission();
      state.settings.notifyEnabled = ok;
      save(STORAGE.settings, state.settings);
      scheduleNotifications();
      if (ok) await sendNotification('Serene', 'Reminders are on. See you in a couple of hours 🌿');
    }
  }, 800);
}

// system theme reactivity
if (window.matchMedia) {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (state.settings.theme === 'system') render();
  });
}

render();
scheduleNotifications();
maybePromptNotifications();

