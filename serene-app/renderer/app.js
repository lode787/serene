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
const STREAK_MILESTONES = [3, 7, 14, 21, 30, 50, 75, 100, 150, 200, 365];
function computeStreak() {
  let n = 0; const c = new Date();
  while (true) {
    const k = todayKey(c);
    if (state.entries[k] && state.entries[k].submitted) { n++; c.setDate(c.getDate() - 1); }
    else break;
  }
  return n;
}
function computeStreakUpTo(dateKey) {
  let n = 0; const c = parseKey(dateKey);
  while (true) {
    const k = todayKey(c);
    if (state.entries[k] && state.entries[k].submitted) { n++; c.setDate(c.getDate() - 1); }
    else break;
  }
  return n;
}
function pickQuote() {
  const q = (window.SERENE_QUOTES && window.SERENE_QUOTES.length) ? window.SERENE_QUOTES : ['Breathe. This moment is enough.'];
  return q[Math.floor(Math.random() * q.length)];
}
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
  settings: load(STORAGE.settings, { theme: 'dark', bg: '', notifyEnabled: false, notifyEveryHours: 2, notifyStart: 9, notifyEnd: 22, notifyAsked: false, updateUrl: '', lastUpdateCheck: 0, lastUpdateResult: '', minimizeToTray: false, afkEnabled: true, afkTimeoutMin: 3, afkPassword: '', streakNotifyMilestone: true, streakNotifyAtRisk: true, streakAtRiskHour: 20 }),
};

// Backfill new settings for existing users
const _defaults = { notifyEnabled: false, notifyEveryHours: 2, notifyStart: 9, notifyEnd: 22, notifyAsked: false, updateUrl: '', lastUpdateCheck: 0, lastUpdateResult: '', minimizeToTray: false, afkEnabled: true, afkTimeoutMin: 3, afkPassword: '', streakNotifyMilestone: true, streakNotifyAtRisk: true, streakAtRiskHour: 20 };
for (const k in _defaults) if (state.settings[k] === undefined) state.settings[k] = _defaults[k];
// Sync tray preference to main process
try { if (window.serene && window.serene.setTray) window.serene.setTray(!!state.settings.minimizeToTray); } catch (e) {}
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
    state.entries[k] = { date: k, checked: {}, mood: 5, mental: 5, submitted: false, note: '' };
  }
  if (typeof state.entries[k].note !== 'string') state.entries[k].note = '';
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
  else if (state.view === 'patchnotes') content.appendChild(viewPatchNotes());
  else if (state.view === 'about') content.appendChild(viewAbout());
  root.appendChild(content);
}

function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

function sidebar() {
  const s = el('aside', 'sidebar');
  const brand = el('div', 'brand');
  const logo = document.createElement('img');
  logo.className = 'brand-logo';
  logo.src = 'logo.png';
  logo.alt = '';
  brand.appendChild(logo);
  brand.appendChild(el('span', 'brand-name', 'Serene'));
  s.appendChild(brand);
  const items = [
    ['today', '☀', 'Today'],
    ['month', '⊞', 'Monthly Overview'],
    ['graphs', '∿', 'Graphs'],
    ['habits', '✓', 'Habits'],
    ['settings', '⚙', 'Settings'],
    ['patchnotes', '◈', 'Patch Notes'],
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
  const streak = computeStreak();
  if (streak > 0) {
    const sb = el('div', 'streak-badge', '');
    sb.innerHTML = '<span class="flame">🔥</span><span class="streak-num">' + streak + '</span><span class="streak-lbl">day streak</span>';
    sb.title = streak + '-day check-in streak';
    head.appendChild(sb);
  }
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
    const wasSubmitted = entry.submitted;
    entry.submitted = true;
    entry.submittedAt = new Date().toISOString();
    save(STORAGE.entries, state.entries);
    if (!wasSubmitted) checkStreakMilestone();
    state.view = 'month';
    state.monthDate = new Date();
    state.detailKey = entry.date;
    render();
  };
  right.appendChild(submitBtn);

  grid.appendChild(right);
  container.appendChild(grid);

  // Notes panel (full width)
  container.appendChild(notesPanel(entry, { promptIfEmpty: true }));

  wrap.appendChild(container);
  return wrap;
}

function notesPanel(entry, opts) {
  opts = opts || {};
  const panel = el('section', 'glass notes-panel');
  const isEmpty = !entry.note || !entry.note.trim();
  const asking = opts.promptIfEmpty && isEmpty;
  panel.appendChild(el('h3', 'panel-title', asking ? 'Would you like to add a note for today?' : 'Notes'));
  panel.appendChild(el('div', 'panel-sub', asking
    ? 'Capture a thought, a moment, a feeling — anything you want to remember about today.'
    : 'Reflections for this day. Edit anytime.'));
  const ta = document.createElement('textarea');
  ta.className = 'note-input';
  ta.placeholder = asking ? 'Write freely…' : 'Add to your note…';
  ta.value = entry.note || '';
  ta.rows = 6;
  let t;
  ta.oninput = () => {
    entry.note = ta.value;
    clearTimeout(t);
    t = setTimeout(() => save(STORAGE.entries, state.entries), 250);
  };
  ta.onblur = () => { save(STORAGE.entries, state.entries); };
  panel.appendChild(ta);
  const foot = el('div', 'note-foot');
  const hint = el('span', 'note-hint', 'Saved automatically');
  foot.appendChild(hint);
  panel.appendChild(foot);
  return panel;
}

function habitRow(habit, entry, isNeg) {
  const build = () => {
    const checked = !!entry.checked[habit.id];
    const row = el('div', 'habit-row' + (checked ? ' checked' : '') + (isNeg ? ' neg' : ''));
    const c = el('div', 'check', checked ? '✓' : '');
    row.appendChild(c);
    row.appendChild(el('div', 'habit-name', habit.name));
    if (habit.preset) row.appendChild(el('div', 'habit-badge', 'preset'));
    row.onclick = (e) => {
      e.preventDefault();
      entry.checked[habit.id] = !checked;
      save(STORAGE.entries, state.entries);
      row.replaceWith(build());
    };
    return row;
  };
  return build();
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

  // Editable note for this day
  if (typeof entry.note !== 'string') entry.note = '';
  modal.appendChild(notesPanel(entry, { promptIfEmpty: false }));

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

  const panel = el('section', 'glass about-panel');
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
    'Lock the app behind a slide gesture or password when you step away.',
    'Export a backup any time, or import one to move between machines.',
  ].forEach(t => {
    const li = el('li', '', t);
    list.appendChild(li);
  });
  panel.appendChild(list);

  // Latest highlights (short)
  panel.appendChild(el('h3', 'panel-title', "What's new in v" + APP_VERSION));
  const latest = PATCH_NOTES[0];
  const highlights = el('ul', 'about-list');
  latest.notes.slice(0, 3).forEach(n => highlights.appendChild(el('li', '', n)));
  panel.appendChild(highlights);
  const seeAll = el('button', 'btn', 'See full patch notes →');
  seeAll.onclick = () => { state.view = 'patchnotes'; render(); };
  panel.appendChild(seeAll);

  const foot = el('div', 'about-foot', 'Version ' + APP_VERSION + ' — made to be used slowly.');
  panel.appendChild(foot);

  wrap.appendChild(panel);
  return wrap;
}

// -------- PATCH NOTES --------
const PATCH_NOTES = [
  { v: '1.1.13', date: '2026', notes: [
    'Serene now uses a strict single-instance lock: opening it again focuses the already-running window instead of starting a second copy.',
    'Rebuilt the Windows executable and installer with the Serene lotus icon applied to the app, taskbar and shortcuts.',
  ]},
  { v: '1.1.12', date: '2026', notes: [
    'AFK lock screen now shows a rotating library of 500+ calming quotes — a new one every time it locks.',
    'Added an ambient Now Playing widget on the lock screen with a smooth animated waveform (reads whatever is playing on Windows: Spotify, browser tabs, Media Player, etc.).',
    'Introduced habit streaks: a sleek flame indicator on Today shows your current check-in streak.',
    'Optional streak notifications: get a gentle heads-up before a streak breaks, and a celebration when you hit a milestone (3, 7, 14, 21, 30, 50, 75, 100…).',
    'New Graphs insights: plain-English correlation cards (e.g. “Quality sleep boosted mood by 1.8 pts on average”).',
  ]},
  { v: '1.1.11', date: '2026', notes: [
    'Fixed desktop and Start Menu shortcuts using the wrong (default Electron) icon — the branded Serene lotus is now used everywhere.',
    'Fixed the Today view jumping back to the top when checking a habit while scrolled down.',
  ]},
  { v: '1.1.10', date: '2026', notes: [
    'Themed splash screen on launch and in-app themed notification toasts.',
    'Branded lotus icon embedded in the app executable.',
  ]},
  { v: '1.1.9', date: '2026', notes: [
    'Added an AFK lock screen with a soft blurred backdrop that appears on launch and after a few minutes of inactivity.',
    'Slide to unlock with a glowing cursor trail, or set a password in Settings for private access.',
    'AFK mode can be turned off completely, and the inactivity timeout is fully configurable.',
    'Redesigned the Serene about tab so it stays perfectly readable over any custom background.',
    'Introduced a dedicated Patch Notes tab so you can follow every update at a glance.',
  ]},
  { v: '1.1.8', date: '', notes: [
    'Added an unlimited daily notes field on Today and every past day in the calendar.',
    'Notes are included in export and import backups automatically.',
  ]},
  { v: '1.1.7', date: '', notes: [
    'Transparent lotus logo used everywhere — window, taskbar, tray and installer.',
  ]},
  { v: '1.1.6', date: '', notes: [
    'New brand mark across the sidebar, tray and installer.',
  ]},
  { v: '1.1.5', date: '', notes: [
    'Minimize to tray option — Serene keeps running quietly in the system tray.',
    'Themed scrollbars across every scrollable surface.',
  ]},
  { v: '1.1.4', date: '', notes: [
    'New Serene about tab explaining what the app is for.',
  ]},
  { v: '1.1.3', date: '', notes: [
    'Monochrome sidebar glyphs for a cleaner, more consistent look.',
  ]},
  { v: '1.1.2', date: '', notes: [
    'Dedicated Graphs section with big smooth charts for mood, good habits and bad habits.',
  ]},
  { v: '1.1.1', date: '', notes: [
    'Fully themed selects, number inputs and toggles.',
    'More reliable Windows toast notifications.',
  ]},
  { v: '1.1.0', date: '', notes: [
    'Native reminders with configurable frequency.',
    'Smooth SVG line charts with tooltips.',
    'Import and merge backups.',
    'Manual update checker.',
  ]},
  { v: '1.0.0', date: '', notes: [
    'First release of Serene.',
  ]},
];

function viewPatchNotes() {
  const wrap = document.createDocumentFragment();
  const head = el('div', 'page-head');
  const l = el('div');
  l.appendChild(el('h1', 'page-title', 'Patch Notes'));
  l.appendChild(el('div', 'page-sub', 'Every update, in plain words.'));
  head.appendChild(l);
  wrap.appendChild(head);

  const panel = el('section', 'glass about-panel');
  PATCH_NOTES.forEach((p, i) => {
    const row = el('div', 'patch');
    const h = el('div', 'patch-head');
    h.appendChild(el('span', 'patch-ver', 'v' + p.v));
    if (i === 0) h.appendChild(el('span', 'patch-badge', 'Current'));
    row.appendChild(h);
    const ul = el('ul', 'about-list');
    p.notes.forEach(n => ul.appendChild(el('li', '', n)));
    row.appendChild(ul);
    panel.appendChild(row);
  });
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

    // Streak notification toggles
    const mkSwitch = (checked, on) => {
      const t = el('label', 'switch');
      const c = document.createElement('input'); c.type = 'checkbox'; c.checked = !!checked;
      const s = el('span', 'slider');
      t.appendChild(c); t.appendChild(s);
      c.onchange = () => on(c.checked);
      return t;
    };
    const streakRow = el('div', 'setting-row');
    const srl = el('div', 'setting-label');
    srl.appendChild(el('b', '', 'Streak notifications'));
    srl.appendChild(el('span', '', 'Celebrate milestones (3, 7, 14, 21, 30, 50, 75, 100 days…) and get a heads‑up in the evening if today’s streak is about to break.'));
    streakRow.appendChild(srl);
    const srActs = el('div', 'row');
    const mLbl = el('label', 'inline-toggle');
    mLbl.appendChild(mkSwitch(state.settings.streakNotifyMilestone, (v) => { state.settings.streakNotifyMilestone = v; save(STORAGE.settings, state.settings); }));
    mLbl.appendChild(el('span', 'muted', 'Milestones'));
    const rLbl = el('label', 'inline-toggle');
    rLbl.appendChild(mkSwitch(state.settings.streakNotifyAtRisk, (v) => { state.settings.streakNotifyAtRisk = v; save(STORAGE.settings, state.settings); }));
    rLbl.appendChild(el('span', 'muted', 'About to break'));
    srActs.appendChild(mLbl); srActs.appendChild(rLbl);
    streakRow.appendChild(srActs);
    panel.appendChild(streakRow);
  }

  // WINDOW BEHAVIOR
  const wRow = el('div', 'setting-row');
  const wl = el('div', 'setting-label');
  wl.appendChild(el('b', '', 'Minimize to tray'));
  wl.appendChild(el('span', '', 'When on, closing or minimizing the window keeps Serene running as an icon in the system tray. Click the tray icon to reopen, or right‑click it to quit.'));
  wRow.appendChild(wl);
  const wActs = el('div', 'row');
  const wtgl = el('label', 'switch');
  const wcbx = document.createElement('input'); wcbx.type = 'checkbox'; wcbx.checked = !!state.settings.minimizeToTray;
  const wsl = el('span', 'slider');
  wtgl.appendChild(wcbx); wtgl.appendChild(wsl);
  wcbx.onchange = () => {
    state.settings.minimizeToTray = wcbx.checked;
    save(STORAGE.settings, state.settings);
    try { window.serene && window.serene.setTray && window.serene.setTray(wcbx.checked); } catch (e) {}
    render();
  };
  wActs.appendChild(wtgl);
  wActs.appendChild(el('span', 'muted', state.settings.minimizeToTray ? 'On' : 'Off'));
  wRow.appendChild(wActs);
  panel.appendChild(wRow);

  // AFK LOCK
  const aRow = el('div', 'setting-row');
  const al = el('div', 'setting-label');
  al.appendChild(el('b', '', 'AFK lock screen'));
  al.appendChild(el('span', '', 'Blur the app when you launch it and after a few minutes of inactivity. Slide to unlock, or set a password below for private access.'));
  aRow.appendChild(al);
  const aActs = el('div', 'row');
  const atgl = el('label', 'switch');
  const acbx = document.createElement('input'); acbx.type = 'checkbox'; acbx.checked = !!state.settings.afkEnabled;
  const asl = el('span', 'slider');
  atgl.appendChild(acbx); atgl.appendChild(asl);
  acbx.onchange = () => {
    state.settings.afkEnabled = acbx.checked;
    save(STORAGE.settings, state.settings);
    if (!acbx.checked) hideAfkLock();
    resetIdleTimer();
    render();
  };
  aActs.appendChild(atgl);
  aActs.appendChild(el('span', 'muted', state.settings.afkEnabled ? 'On' : 'Off'));
  aRow.appendChild(aActs);
  panel.appendChild(aRow);

  if (state.settings.afkEnabled) {
    const tRow = el('div', 'setting-row');
    const tl2 = el('div', 'setting-label');
    tl2.appendChild(el('b', '', 'Inactivity timeout'));
    tl2.appendChild(el('span', '', 'Lock automatically after this many minutes with no mouse or keyboard input.'));
    tRow.appendChild(tl2);
    const tActs = el('div', 'row');
    const tSel = document.createElement('select');
    [1,2,3,5,10,15,20,30].forEach(n => {
      const o = document.createElement('option'); o.value = n; o.textContent = `${n} minute${n>1?'s':''}`;
      if (state.settings.afkTimeoutMin === n) o.selected = true;
      tSel.appendChild(o);
    });
    tSel.onchange = () => { state.settings.afkTimeoutMin = Number(tSel.value); save(STORAGE.settings, state.settings); resetIdleTimer(); };
    tActs.appendChild(tSel);
    const lockNow = el('button', 'btn', 'Lock now');
    lockNow.onclick = () => showAfkLock();
    tActs.appendChild(lockNow);
    tRow.appendChild(tActs);
    panel.appendChild(tRow);

    const pRow = el('div', 'setting-row');
    const pl = el('div', 'setting-label');
    pl.appendChild(el('b', '', 'Password'));
    pl.appendChild(el('span', '', state.settings.afkPassword ? 'Password is set. Unlock requires the password (slide is disabled).' : 'No password. Unlock with a slide gesture.'));
    pRow.appendChild(pl);
    const pActs = el('div', 'row');
    const pInp = document.createElement('input'); pInp.type = 'password'; pInp.placeholder = 'New password (leave empty to disable)';
    const pSave = el('button', 'btn btn-primary', state.settings.afkPassword ? 'Update' : 'Set');
    pSave.onclick = () => {
      state.settings.afkPassword = pInp.value || '';
      save(STORAGE.settings, state.settings);
      render();
    };
    const pClear = el('button', 'btn btn-danger', 'Remove');
    pClear.onclick = () => { state.settings.afkPassword = ''; save(STORAGE.settings, state.settings); render(); };
    pActs.appendChild(pInp); pActs.appendChild(pSave);
    if (state.settings.afkPassword) pActs.appendChild(pClear);
    pRow.appendChild(pActs);
    panel.appendChild(pRow);
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

const APP_VERSION = '1.1.13';
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

function showToast(title, body) {
  let host = document.getElementById('serene-toast-host');
  if (!host) {
    host = document.createElement('div');
    host.id = 'serene-toast-host';
    document.body.appendChild(host);
  }
  const t = document.createElement('div');
  t.className = 'serene-toast';
  t.innerHTML = `
    <div class="serene-toast__icon">
      <img src="../assets/icon.png" alt="" onerror="this.style.display='none'"/>
    </div>
    <div class="serene-toast__body">
      <div class="serene-toast__title"></div>
      <div class="serene-toast__text"></div>
    </div>
    <button class="serene-toast__close" aria-label="Dismiss">×</button>
    <div class="serene-toast__bar"><span></span></div>
  `;
  t.querySelector('.serene-toast__title').textContent = title || 'Serene';
  t.querySelector('.serene-toast__text').textContent = body || '';
  t.querySelector('.serene-toast__close').addEventListener('click', () => dismiss());
  const dismiss = () => {
    t.classList.add('leaving');
    setTimeout(() => { try { t.remove(); } catch(e){} }, 320);
  };
  host.appendChild(t);
  requestAnimationFrame(() => t.classList.add('in'));
  setTimeout(dismiss, 6000);
  return true;
}

async function sendNotification(title, body) {
  // Always show a themed in-app toast so notifications match the app.
  try { showToast(title, body); } catch (e) {}
  // Also send a native OS toast when the window isn't focused, so the user
  // still gets a system-level nudge in the background.
  const focused = typeof document !== 'undefined' && document.hasFocus && document.hasFocus();
  if (focused) return true;
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
  return true;
}

let _notifyTimer = null;
function checkStreakMilestone() {
  if (!state.settings.streakNotifyMilestone) return;
  const s = computeStreak();
  if (!s) return;
  if (!STREAK_MILESTONES.includes(s)) return;
  const key = 'serene.milestone.' + s;
  if (localStorage.getItem(key)) return;
  localStorage.setItem(key, '1');
  sendNotification('🔥 ' + s + '-day streak!', "You've checked in " + s + " days in a row on Serene. Beautifully consistent.");
}

function checkStreakAtRisk() {
  if (!state.settings.streakNotifyAtRisk) return;
  const now = new Date();
  const h = now.getHours();
  const targetHour = state.settings.streakAtRiskHour || 20;
  if (h < targetHour) return;
  const tkey = todayKey();
  if (state.entries[tkey] && state.entries[tkey].submitted) return;
  const y = new Date(); y.setDate(y.getDate() - 1);
  const yStreak = computeStreakUpTo(todayKey(y));
  if (yStreak < 2) return;
  const flag = 'serene.atrisk.' + tkey;
  if (localStorage.getItem(flag)) return;
  localStorage.setItem(flag, '1');
  sendNotification('🔥 Your ' + yStreak + '-day streak', "Don't forget to check in tonight to keep it alive.");
}

function scheduleNotifications() {
  if (_notifyTimer) { clearInterval(_notifyTimer); _notifyTimer = null; }
  const tick = async () => {
    checkStreakAtRisk();
    if (!state.settings.notifyEnabled) return;
    const hours = Math.max(1, Number(state.settings.notifyEveryHours) || 2);
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
  _notifyTimer = setInterval(tick, 60 * 1000);
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

// ============ AFK LOCK ============
let _idleTimer = null;
let _lockShown = false;

function resetIdleTimer() {
  if (_idleTimer) { clearTimeout(_idleTimer); _idleTimer = null; }
  if (!state.settings.afkEnabled) return;
  if (_lockShown) return;
  const ms = Math.max(1, Number(state.settings.afkTimeoutMin) || 3) * 60 * 1000;
  _idleTimer = setTimeout(() => showAfkLock(), ms);
}

['mousemove','mousedown','keydown','wheel','touchstart'].forEach(ev => {
  window.addEventListener(ev, () => { if (!_lockShown) resetIdleTimer(); }, { passive: true });
});

let _npTimer = null;
function hideAfkLock() {
  _lockShown = false;
  if (_npTimer) { clearInterval(_npTimer); _npTimer = null; }
  const n = document.getElementById('afk-lock');
  if (n) n.remove();
  document.body.classList.remove('afk-locked');
  resetIdleTimer();
}

function showAfkLock() {
  if (_lockShown) return;
  _lockShown = true;
  if (_idleTimer) { clearTimeout(_idleTimer); _idleTimer = null; }
  document.body.classList.add('afk-locked');

  const back = document.createElement('div');
  back.id = 'afk-lock';
  back.className = 'afk-lock';

  const card = document.createElement('div');
  card.className = 'afk-card glass';

  const time = document.createElement('div');
  time.className = 'afk-time';
  const dateEl = document.createElement('div');
  dateEl.className = 'afk-date';
  const updateClock = () => {
    const d = new Date();
    time.textContent = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    dateEl.textContent = d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  };
  updateClock();
  const clockInt = setInterval(updateClock, 1000);

  const title = document.createElement('div');
  title.className = 'afk-title';
  title.textContent = 'Serene is resting';

  card.appendChild(time);
  card.appendChild(dateEl);
  card.appendChild(title);

  // Rotating calming quote
  const quote = document.createElement('div');
  quote.className = 'afk-quote';
  quote.textContent = '“' + pickQuote() + '”';
  card.appendChild(quote);

  // Now Playing widget with animated waveform
  const np = document.createElement('div');
  np.className = 'afk-np';
  np.style.display = 'none';
  const npInfo = document.createElement('div'); npInfo.className = 'afk-np-info';
  const npTitle = document.createElement('div'); npTitle.className = 'afk-np-title';
  const npArtist = document.createElement('div'); npArtist.className = 'afk-np-artist';
  npInfo.appendChild(npTitle); npInfo.appendChild(npArtist);
  const wave = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  wave.setAttribute('class', 'afk-wave');
  wave.setAttribute('viewBox', '0 0 200 40');
  wave.setAttribute('preserveAspectRatio', 'none');
  const wpath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  wpath.setAttribute('class', 'afk-wave-path');
  wave.appendChild(wpath);
  np.appendChild(wave);
  np.appendChild(npInfo);
  card.appendChild(np);

  let wavePhase = 0; let waveAmp = 0; let waveTarget = 0;
  const drawWave = () => {
    wavePhase += 0.08;
    waveAmp += (waveTarget - waveAmp) * 0.08;
    let d = '';
    for (let x = 0; x <= 200; x += 4) {
      const y = 20
        + Math.sin(x * 0.09 + wavePhase) * 6 * waveAmp
        + Math.sin(x * 0.21 + wavePhase * 1.7) * 4 * waveAmp
        + Math.sin(x * 0.05 - wavePhase * 0.6) * 3 * waveAmp;
      d += (x === 0 ? 'M' : 'L') + x + ',' + y.toFixed(2) + ' ';
    }
    wpath.setAttribute('d', d);
  };
  let waveRaf = 0;
  const waveLoop = () => { drawWave(); waveRaf = requestAnimationFrame(waveLoop); };
  waveLoop();

  const pollNp = async () => {
    try {
      if (!window.serene || !window.serene.nowPlaying) return;
      const data = await window.serene.nowPlaying();
      if (data && data.title) {
        np.style.display = '';
        npTitle.textContent = data.title;
        npArtist.textContent = [data.artist, data.album].filter(Boolean).join(' • ');
        waveTarget = /playing/i.test(data.status || '') ? 1 : 0.15;
      } else {
        np.style.display = 'none';
        waveTarget = 0;
      }
    } catch (e) { np.style.display = 'none'; waveTarget = 0; }
  };
  pollNp();
  _npTimer = setInterval(pollNp, 2500);
  // Cleanup wave RAF when lock closes
  const origHide = hideAfkLock;
  const cleanup = () => { cancelAnimationFrame(waveRaf); };
  back.addEventListener('remove', cleanup);
  new MutationObserver((muts, obs) => {
    if (!document.getElementById('afk-lock')) { cleanup(); obs.disconnect(); }
  }).observe(document.body, { childList: true });

  if (state.settings.afkPassword) {
    const form = document.createElement('form');
    form.className = 'afk-pw';
    const inp = document.createElement('input');
    inp.type = 'password';
    inp.placeholder = 'Enter password to unlock';
    inp.autocomplete = 'off';
    const err = document.createElement('div');
    err.className = 'afk-err';
    const btn = document.createElement('button');
    btn.type = 'submit'; btn.className = 'btn btn-primary'; btn.textContent = 'Unlock';
    form.appendChild(inp); form.appendChild(btn); form.appendChild(err);
    form.onsubmit = (e) => {
      e.preventDefault();
      if (inp.value === state.settings.afkPassword) {
        clearInterval(clockInt);
        hideAfkLock();
      } else {
        err.textContent = 'Incorrect password';
        inp.value = '';
        card.animate([
          { transform: 'translateX(0)' }, { transform: 'translateX(-10px)' },
          { transform: 'translateX(10px)' }, { transform: 'translateX(0)' }
        ], { duration: 260 });
      }
    };
    card.appendChild(form);
    setTimeout(() => inp.focus(), 50);
  } else {
    const slideWrap = document.createElement('div');
    slideWrap.className = 'afk-slide';
    const track = document.createElement('div');
    track.className = 'afk-track';
    const label = document.createElement('div');
    label.className = 'afk-slide-label';
    label.textContent = 'Slide to unlock →';
    const handle = document.createElement('div');
    handle.className = 'afk-handle';
    handle.textContent = '❋';
    track.appendChild(label);
    track.appendChild(handle);
    slideWrap.appendChild(track);
    card.appendChild(slideWrap);

    let dragging = false, startX = 0, curX = 0, maxX = 0;
    const onDown = (e) => {
      dragging = true;
      startX = (e.touches ? e.touches[0].clientX : e.clientX);
      maxX = track.clientWidth - handle.clientWidth - 8;
      handle.classList.add('dragging');
      e.preventDefault();
    };
    const onMove = (e) => {
      if (!dragging) return;
      const x = (e.touches ? e.touches[0].clientX : e.clientX);
      curX = Math.max(0, Math.min(maxX, x - startX));
      handle.style.transform = `translateX(${curX}px)`;
      const pct = curX / maxX;
      label.style.opacity = String(Math.max(0, 1 - pct * 1.4));
      handle.style.boxShadow = `0 0 ${20 + pct * 40}px ${8 + pct * 20}px color-mix(in oklab, var(--accent) ${20 + pct * 60}%, transparent)`;
      spawnTrail(x, (e.touches ? e.touches[0].clientY : e.clientY));
    };
    const onUp = () => {
      if (!dragging) return;
      dragging = false;
      handle.classList.remove('dragging');
      if (curX >= maxX - 4) {
        handle.style.transition = 'transform .25s ease';
        handle.style.transform = `translateX(${maxX}px) scale(1.2)`;
        setTimeout(() => { clearInterval(clockInt); hideAfkLock(); }, 200);
      } else {
        handle.style.transition = 'transform .3s cubic-bezier(.2,1.3,.4,1), box-shadow .3s ease';
        handle.style.transform = 'translateX(0)';
        handle.style.boxShadow = '';
        label.style.opacity = '';
        setTimeout(() => { handle.style.transition = ''; }, 320);
      }
    };
    handle.addEventListener('mousedown', onDown);
    handle.addEventListener('touchstart', onDown, { passive: false });
    window.addEventListener('mousemove', onMove);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchend', onUp);
  }

  const hint = document.createElement('div');
  hint.className = 'afk-hint';
  hint.textContent = state.settings.afkPassword ? 'Enter your password to return.' : 'Drag the glowing dot all the way across to return.';
  card.appendChild(hint);

  back.appendChild(card);
  document.body.appendChild(back);
}

// Cursor trail during slide
function spawnTrail(x, y) {
  const dot = document.createElement('div');
  dot.className = 'afk-trail';
  dot.style.left = x + 'px';
  dot.style.top = y + 'px';
  document.body.appendChild(dot);
  setTimeout(() => dot.remove(), 700);
}

render();
scheduleNotifications();
maybePromptNotifications();
// Show lock on launch if enabled
if (state.settings.afkEnabled) setTimeout(() => showAfkLock(), 150);
else resetIdleTimer();


