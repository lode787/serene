// Serene — Mental Health & Habit Tracker
// Vanilla JS SPA. Local storage only.

const STORAGE = {
  habits: 'serene.habits.v1',
  entries: 'serene.entries.v1',
  settings: 'serene.settings.v1',
};

const PRESETS_POS = [
  { name: 'Early start (woke up early)', labelKey: 'preset.pos.early' },
  { name: 'Getting 7–9 hours of quality sleep', labelKey: 'preset.pos.sleep' },
  { name: 'Drinking enough water', labelKey: 'preset.pos.water' },
  { name: 'Ate at least 3 times', labelKey: 'preset.pos.meals' },
  { name: 'Keeping your living/workspace tidy', labelKey: 'preset.pos.tidy' },
  { name: 'Have a decent social interaction with someone', labelKey: 'preset.pos.social' },
];
const PRESETS_NEG = [
  { name: 'Skipped meals', labelKey: 'preset.neg.meals' },
  { name: 'Excess screen time before bed', labelKey: 'preset.neg.screen' },
  { name: 'Doom-scrolling', labelKey: 'preset.neg.doom' },
  { name: 'Skipped movement / exercise', labelKey: 'preset.neg.movement' },
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
function localeTag() {
  try {
    if (window.SereneI18n && window.SereneI18n.localeTag) return window.SereneI18n.localeTag(state.settings.language);
  } catch (e) {}
  return undefined;
}
function t(key, vars) {
  try {
    if (window.SereneI18n && window.SereneI18n.t) return window.SereneI18n.t(key, vars, state.settings.language);
  } catch (e) {}
  return key;
}
function habitLabel(h) {
  if (!h) return '';
  if (h.labelKey) return t(h.labelKey);
  const all = [...PRESETS_POS, ...PRESETS_NEG];
  const match = all.find(p => p.name === h.canonicalName || p.name === h.name || (h.labelKey && p.labelKey === h.labelKey));
  if (match) return t(match.labelKey);
  return h.name || '';
}

function syncPresetHabitNames() {
  const all = [...PRESETS_POS, ...PRESETS_NEG];
  let changed = false;
  ['positive', 'negative'].forEach((k) => {
    (state.habits[k] || []).forEach((h) => {
      if (!h || !h.preset) return;
      const match = all.find(p =>
        p.labelKey === h.labelKey ||
        p.name === h.canonicalName ||
        p.name === h.name ||
        (h.labelKey && p.labelKey === h.labelKey)
      );
      if (!match) return;
      const nextName = t(match.labelKey);
      if (h.labelKey !== match.labelKey || h.canonicalName !== match.name || h.name !== nextName) {
        h.labelKey = match.labelKey;
        h.canonicalName = match.name;
        h.name = nextName;
        changed = true;
      }
    });
  });
  if (changed) save(STORAGE.habits, state.habits);
  return changed;
}
const fmtLongDate = (d) => d.toLocaleDateString(localeTag(), { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
const monthName = (d) => d.toLocaleDateString(localeTag(), { month: 'long', year: 'numeric' });

// State
let state = {
  view: 'today',        // today | month | habits | settings
  monthDate: new Date(),
  detailKey: null,
  habits: load(STORAGE.habits, null),
  entries: load(STORAGE.entries, {}),
  settings: load(STORAGE.settings, { theme: 'dark', bg: '', language: 'en', graphType: 'line', combineHabits: false, notifyEnabled: false, notifyEveryHours: 2, notifyStart: 9, notifyEnd: 22, notifyAsked: false, updateUrl: '', lastUpdateCheck: 0, lastUpdateResult: '', minimizeToTray: false, afkEnabled: true, afkTimeoutMin: 3, afkPassword: '', streakNotifyMilestone: true, streakNotifyAtRisk: true, streakAtRiskHour: 20 }),
};

// Backfill new settings for existing users
const _defaults = { language: 'en', graphType: 'line', combineHabits: false, notifyEnabled: false, notifyEveryHours: 2, notifyStart: 9, notifyEnd: 22, notifyAsked: false, updateUrl: '', lastUpdateCheck: 0, lastUpdateResult: '', minimizeToTray: false, afkEnabled: true, afkTimeoutMin: 3, afkPassword: '', streakNotifyMilestone: true, streakNotifyAtRisk: true, streakAtRiskHour: 20 };
for (const k in _defaults) if (state.settings[k] === undefined) state.settings[k] = _defaults[k];
// Sync tray preference to main process
try { if (window.serene && window.serene.setTray) window.serene.setTray(!!state.settings.minimizeToTray); } catch (e) {}
save(STORAGE.settings, state.settings);


if (!state.habits) {
  state.habits = {
    positive: PRESETS_POS.map(p => ({ id: uid(), name: t(p.labelKey), canonicalName: p.name, labelKey: p.labelKey, enabled: true, preset: true })),
    negative: PRESETS_NEG.map(p => ({ id: uid(), name: t(p.labelKey), canonicalName: p.name, labelKey: p.labelKey, enabled: true, preset: true })),
  };
  save(STORAGE.habits, state.habits);
} else {
  syncPresetHabitNames();
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
    ['today', '☀', 'nav.today'],
    ['month', '⊞', 'nav.month'],
    ['graphs', '∿', 'nav.graphs'],
    ['habits', '✓', 'nav.habits'],
    ['settings', '⚙', 'nav.settings'],
    ['patchnotes', '◈', 'nav.patchnotes'],
    ['about', '❋', 'nav.about'],
  ];
  items.forEach(([v, i, key]) => {
    const b = el('button', 'nav-btn' + (state.view === v ? ' active' : ''));
    b.appendChild(el('span', 'ico', i));
    b.appendChild(el('span', '', t(key)));
    b.onclick = () => { state.view = v; state.detailKey = null; render(); };
    s.appendChild(b);
  });
  const foot = el('div', 'sidebar-foot', t('sidebar.foot'));
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
  l.appendChild(el('h1', 'page-title', t('today.title')));
  l.appendChild(el('div', 'page-sub', fmtLongDate(today)));
  head.appendChild(l);
  const streak = computeStreak();
  if (streak > 0) {
    const sb = el('div', 'streak-badge', '');
    sb.innerHTML = '<span class="flame">🔥</span><span class="streak-num">' + streak + '</span><span class="streak-lbl">' + t('today.dayStreak') + '</span>';
    sb.title = streak + ' ' + t('today.dayStreak');
    head.appendChild(sb);
  }
  if (entry.submitted) {
    const badge = el('div', 'stat');
    badge.appendChild(el('div', 'stat-label', t('today.status')));
    badge.appendChild(el('div', 'stat-val', t('today.submitted')));
    head.appendChild(badge);
  }
  const container = el('div');
  container.appendChild(head);

  const grid = el('div', 'grid-2');
  // habits panel
  const habitsPanel = el('section', 'glass');
  habitsPanel.appendChild(el('h3', 'panel-title', t('today.habits')));
  const enabledPos = state.habits.positive.filter(h => h.enabled);
  const enabledNeg = state.habits.negative.filter(h => h.enabled);

  const posGroup = el('div', 'habit-group');
  posGroup.appendChild(el('div', 'habit-group-label', t('today.positive')));
  if (enabledPos.length === 0) posGroup.appendChild(el('div', 'empty-state', t('today.noPos')));
  enabledPos.forEach(h => posGroup.appendChild(habitRow(h, entry, false)));
  habitsPanel.appendChild(posGroup);

  const negGroup = el('div', 'habit-group');
  negGroup.appendChild(el('div', 'habit-group-label', t('today.negative')));
  if (enabledNeg.length === 0) negGroup.appendChild(el('div', 'empty-state', t('today.noNeg')));
  enabledNeg.forEach(h => negGroup.appendChild(habitRow(h, entry, true)));
  habitsPanel.appendChild(negGroup);

  grid.appendChild(habitsPanel);

  // meters + submit panel
  const right = el('section', 'glass');
  right.appendChild(el('h3', 'panel-title', t('today.feeling')));

  const moodMeter = meter(t('today.mood'), entry.mood, (v) => { entry.mood = v; save(STORAGE.entries, state.entries); });
  right.appendChild(moodMeter);
  const mentalMeter = meter(t('today.mental'), entry.mental, (v) => { entry.mental = v; save(STORAGE.entries, state.entries); });
  right.appendChild(mentalMeter);

  const submitBtn = el('button', 'btn btn-primary btn-lg', t('today.submit'));
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
  panel.appendChild(el('h3', 'panel-title', asking ? t('today.notesAsk') : t('today.notesTitle')));
  panel.appendChild(el('div', 'panel-sub', asking ? t('today.notesHintAsk') : t('today.notesHint')));
  const ta = document.createElement('textarea');
  ta.className = 'note-input';
  ta.placeholder = asking ? t('today.notesPlaceholderAsk') : t('today.notesPlaceholder');
  ta.value = entry.note || '';
  ta.rows = 6;
  let debounce;
  ta.oninput = () => {
    entry.note = ta.value;
    clearTimeout(debounce);
    debounce = setTimeout(() => save(STORAGE.entries, state.entries), 250);
  };
  ta.onblur = () => { save(STORAGE.entries, state.entries); };
  panel.appendChild(ta);
  const foot = el('div', 'note-foot');
  const hint = el('span', 'note-hint', t('today.savedAuto'));
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
    row.appendChild(el('div', 'habit-name', habitLabel(habit)));
    if (habit.preset) row.appendChild(el('div', 'habit-badge', t('common.preset')));
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
  l.appendChild(el('h1', 'page-title', t('month.title')));
  l.appendChild(el('div', 'page-sub', t('month.sub')));
  head.appendChild(l);
  const nav = el('div', 'row');
  const prev = el('button', 'btn btn-icon', '‹'); prev.onclick = () => { state.monthDate = new Date(md.getFullYear(), md.getMonth() - 1, 1); state.detailKey = null; render(); };
  const next = el('button', 'btn btn-icon', '›'); next.onclick = () => { state.monthDate = new Date(md.getFullYear(), md.getMonth() + 1, 1); state.detailKey = null; render(); };
  const today = el('button', 'btn btn-icon', t('month.todayBtn')); today.onclick = () => { state.monthDate = new Date(); state.detailKey = null; render(); };
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
  panel.appendChild(el('h3', 'panel-title', t('month.calendar')));
  const grid = el('div', 'cal-grid');
  // header row
  grid.appendChild(el('div', 'cal-week-label', ''));
  [0,1,2,3,4,5,6].forEach(i => grid.appendChild(el('div', 'cal-dow', t('month.dow' + i))));

  const y = md.getFullYear(), m = md.getMonth();
  const firstDow = (new Date(y, m, 1).getDay() + 6) % 7; // Mon=0
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const totalCells = Math.ceil((firstDow + daysInMonth) / 7) * 7;
  const todayK = todayKey();

  let weekIdx = 0;
  for (let i = 0; i < totalCells; i++) {
    if (i % 7 === 0) {
      weekIdx++;
      grid.appendChild(el('div', 'cal-week-label', t('month.week', { n: weekIdx })));
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
  legend.append(t('month.legend'));
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
  panel.appendChild(el('h3', 'panel-title', t('month.analysis')));

  const y = md.getFullYear(), m = md.getMonth();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const days = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const k = todayKey(new Date(y, m, d));
    const e = state.entries[k];
    if (e && e.submitted) days.push(e);
  }

  if (days.length === 0) {
    panel.appendChild(el('div', 'empty-state', t('month.noData')));
    return panel;
  }

  const avgMood = days.reduce((a, b) => a + b.mood, 0) / days.length;
  const avgMental = days.reduce((a, b) => a + b.mental, 0) / days.length;
  const best = [...days].sort((a, b) => (b.mood + b.mental) - (a.mood + a.mental))[0];
  const worst = [...days].sort((a, b) => (a.mood + a.mental) - (b.mood + b.mental))[0];

  const stats = el('div', 'stat-grid');
  stats.appendChild(statBox(t('month.loggedDays'), days.length, `${t('month.of')} ${daysInMonth}`));
  stats.appendChild(statBox(t('month.avgMood'), avgMood.toFixed(1), '/ 10'));
  stats.appendChild(statBox(t('month.avgMental'), avgMental.toFixed(1), '/ 10'));
  stats.appendChild(statBox(t('month.bestDay'), String(parseKey(best.date).getDate()), fmtLongDate(parseKey(best.date))));
  panel.appendChild(stats);

  // Smooth line charts
  panel.appendChild(el('div', 'panel-title', t('month.moodMental')));
  panel.appendChild(lineChart(y, m, daysInMonth, [
    { key: 'mood', label: 'Mood', color: 'var(--accent)' },
    { key: 'mental', label: 'Mental', color: 'var(--accent-2)' },
  ]));


  // Habit completion rates
  panel.appendChild(el('div', 'panel-title', t('month.habitCompletion')));
  const allHabits = [
    ...state.habits.positive.map(h => ({ ...h, kind: 'pos' })),
    ...state.habits.negative.map(h => ({ ...h, kind: 'neg' })),
  ];
  allHabits.filter(h => h.enabled).forEach(h => {
    const done = days.filter(d => d.checked[h.id]).length;
    const rate = days.length ? done / days.length : 0;
    const row = el('div', 'hrate-row');
    const top = el('div', 'hrate-top');
    top.appendChild(el('span', '', habitLabel(h) + (h.kind === 'neg' ? '  ' + t('month.negTag') : '')));
    top.appendChild(el('span', '', Math.round(rate * 100) + '%  ·  ' + done + '/' + days.length));
    row.appendChild(top);
    const bar = el('div', 'bar' + (h.kind === 'neg' ? ' neg' : ''));
    const fill = el('i'); fill.style.width = (rate * 100) + '%'; bar.appendChild(fill);
    row.appendChild(bar);
    panel.appendChild(row);
  });

  // Insights
  panel.appendChild(el('div', 'panel-title', t('month.insights')));
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
          html: `On days you ${h.kind === 'neg' ? 'did' : 'did'} <b>${escape(habitLabel(h))}</b>, your combined mood+mental was ${diff > 0 ? 'higher' : 'lower'} by <b>${Math.abs(diff).toFixed(1)} pts</b>.`
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

  modal.appendChild(el('div', 'panel-title', t('habits.positive')));
  state.habits.positive.forEach(h => {
    const row = el('div', 'habit-row' + (entry.checked[h.id] ? ' checked' : ''));
    row.appendChild(el('div', 'check', entry.checked[h.id] ? '✓' : ''));
    row.appendChild(el('div', 'habit-name', habitLabel(h)));
    modal.appendChild(row);
  });
  modal.appendChild(el('div', 'panel-title', t('habits.negative')));
  state.habits.negative.forEach(h => {
    const row = el('div', 'habit-row neg' + (entry.checked[h.id] ? ' checked' : ''));
    row.appendChild(el('div', 'check', entry.checked[h.id] ? '✓' : ''));
    row.appendChild(el('div', 'habit-name', habitLabel(h)));
    modal.appendChild(row);
  });

  // Editable note for this day
  if (typeof entry.note !== 'string') entry.note = '';
  modal.appendChild(notesPanel(entry, { promptIfEmpty: false }));

  back.appendChild(modal);
  return back;
}

// -------- GRAPHS --------
function monthPickerControl(md, onChange) {
  const wrap = el('div', 'month-picker');
  wrap.appendChild(el('span', 'muted', t('graphs.monthPicker')));
  const monthSel = document.createElement('select');
  monthSel.className = 'month-select';
  for (let i = 0; i < 12; i++) {
    const o = document.createElement('option');
    o.value = i;
    o.textContent = new Date(2000, i, 1).toLocaleDateString(localeTag(), { month: 'long' });
    if (i === md.getMonth()) o.selected = true;
    monthSel.appendChild(o);
  }
  const yearSel = document.createElement('select');
  yearSel.className = 'month-select';
  const thisYear = new Date().getFullYear();
  for (let y = thisYear - 8; y <= thisYear + 1; y++) {
    const o = document.createElement('option');
    o.value = y;
    o.textContent = String(y);
    if (y === md.getFullYear()) o.selected = true;
    yearSel.appendChild(o);
  }
  const commit = () => onChange(new Date(Number(yearSel.value), Number(monthSel.value), 1));
  monthSel.onchange = commit;
  yearSel.onchange = commit;
  wrap.appendChild(monthSel);
  wrap.appendChild(yearSel);
  return wrap;
}

function donutChart(label, value, max, color, sub) {
  const v = Math.max(0, Math.min(max, Number(value) || 0));
  const pct = max ? (v / max) : 0;
  const size = 160;
  const stroke = 14;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = pct * c;
  const wrap = el('div', 'donut-card');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
  svg.setAttribute('class', 'donut-svg');
  const bg = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  bg.setAttribute('cx', size / 2); bg.setAttribute('cy', size / 2); bg.setAttribute('r', r);
  bg.setAttribute('fill', 'none'); bg.setAttribute('stroke', 'var(--glass-border)'); bg.setAttribute('stroke-width', stroke);
  const fg = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  fg.setAttribute('cx', size / 2); fg.setAttribute('cy', size / 2); fg.setAttribute('r', r);
  fg.setAttribute('fill', 'none'); fg.setAttribute('stroke', color); fg.setAttribute('stroke-width', stroke);
  fg.setAttribute('stroke-linecap', 'round');
  fg.setAttribute('stroke-dasharray', `${dash} ${c - dash}`);
  fg.setAttribute('transform', `rotate(-90 ${size / 2} ${size / 2})`);
  svg.appendChild(bg); svg.appendChild(fg);
  const center = el('div', 'donut-center');
  center.appendChild(el('div', 'donut-value', max === 100 ? Math.round(v) + '%' : v.toFixed(1)));
  center.appendChild(el('div', 'donut-sub', sub || ''));
  const ring = el('div', 'donut-ring');
  ring.appendChild(svg);
  ring.appendChild(center);
  wrap.appendChild(ring);
  wrap.appendChild(el('div', 'donut-label', label));
  return wrap;
}

function habitPalette(i, neg) {
  const pos = ['#5ec8a0', '#6aa8ff', '#b48cff', '#f0c35a', '#7ad4d4', '#9ad27a', '#ff9f7a', '#8ab4f8'];
  const bad = ['#ff6f8a', '#ff8f6b', '#e05a7a', '#d97757', '#c45c7a', '#f07178'];
  const arr = neg ? bad : pos;
  return arr[i % arr.length];
}

function viewGraphs() {
  const wrap = document.createDocumentFragment();
  const md = state.monthDate;
  const y = md.getFullYear(), m = md.getMonth();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const chartType = state.settings.graphType === 'circle' ? 'circle' : 'line';
  const combine = !!state.settings.combineHabits;

  const head = el('div', 'page-head');
  const l = el('div');
  l.appendChild(el('h1', 'page-title', t('graphs.title')));
  l.appendChild(el('div', 'page-sub', t('graphs.sub')));
  head.appendChild(l);
  const nav = el('div', 'row wrap graphs-toolbar');
  const prev = el('button', 'btn btn-icon', '‹'); prev.onclick = () => { state.monthDate = new Date(y, m - 1, 1); render(); };
  const next = el('button', 'btn btn-icon', '›'); next.onclick = () => { state.monthDate = new Date(y, m + 1, 1); render(); };
  const today = el('button', 'btn btn-icon', t('month.todayBtn')); today.onclick = () => { state.monthDate = new Date(); render(); };
  const title = el('div', 'cal-title', monthName(md));
  nav.appendChild(prev); nav.appendChild(title); nav.appendChild(next); nav.appendChild(today);
  nav.appendChild(monthPickerControl(md, (d) => { state.monthDate = d; render(); }));

  const typeGroup = el('div', 'chip-group');
  [['line', t('graphs.line')], ['circle', t('graphs.circle')]].forEach(([val, label]) => {
    const c = el('div', 'chip' + (chartType === val ? ' active' : ''), label);
    c.onclick = () => { state.settings.graphType = val; save(STORAGE.settings, state.settings); render(); };
    typeGroup.appendChild(c);
  });
  nav.appendChild(typeGroup);

  const combineChip = el('div', 'chip' + (combine ? ' active' : ''), t('graphs.combine'));
  combineChip.title = t('graphs.combineHint');
  combineChip.onclick = () => { state.settings.combineHabits = !combine; save(STORAGE.settings, state.settings); render(); };
  nav.appendChild(combineChip);

  head.appendChild(nav);
  wrap.appendChild(head);

  let hasAny = false;
  const days = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const e = state.entries[todayKey(new Date(y, m, d))];
    if (e && e.submitted) { hasAny = true; days.push(e); }
  }
  if (!hasAny) {
    const empty = el('section', 'glass');
    empty.appendChild(el('div', 'empty-state', t('graphs.noData')));
    wrap.appendChild(empty);
    return wrap;
  }

  const posHabits = state.habits.positive.filter(h => h.enabled);
  const negHabits = state.habits.negative.filter(h => h.enabled);
  const pct = (v) => Math.round(v) + '%';
  const posRate = (e) => posHabits.length ? (posHabits.filter(h => e.checked[h.id]).length / posHabits.length) * 100 : null;
  const negRate = (e) => negHabits.length ? (negHabits.filter(h => e.checked[h.id]).length / negHabits.length) * 100 : null;

  const avgMood = days.reduce((a, b) => a + (Number(b.mood) || 0), 0) / days.length;
  const avgMental = days.reduce((a, b) => a + (Number(b.mental) || 0), 0) / days.length;
  let posHits = 0, posTotal = 0, negHits = 0, negTotal = 0;
  days.forEach((e) => {
    posHabits.forEach((h) => { posTotal += 1; if (e.checked && e.checked[h.id]) posHits += 1; });
    negHabits.forEach((h) => { negTotal += 1; if (e.checked && e.checked[h.id]) negHits += 1; });
  });
  const posPct = posTotal ? (posHits / posTotal) * 100 : 0;
  const negPct = negTotal ? (negHits / negTotal) * 100 : 0;

  if (chartType === 'circle') {
    const p = el('section', 'glass');
    p.appendChild(el('h3', 'panel-title', monthName(md)));
    const grid = el('div', 'donut-grid');
    grid.appendChild(donutChart(t('graphs.donutMood'), avgMood, 10, 'var(--accent)', `${t('graphs.avg')} / 10`));
    grid.appendChild(donutChart(t('graphs.donutMental'), avgMental, 10, 'var(--accent-2)', `${t('graphs.avg')} / 10`));
    grid.appendChild(donutChart(t('graphs.donutPos'), posPct, 100, 'var(--good)', t('graphs.completion')));
    grid.appendChild(donutChart(t('graphs.donutNeg'), negPct, 100, 'var(--bad)', t('graphs.slipRate')));
    p.appendChild(grid);
    wrap.appendChild(p);
    return wrap;
  }

  const p1 = el('section', 'glass');
  p1.appendChild(el('h3', 'panel-title', t('graphs.moodMental')));
  p1.appendChild(lineChart(y, m, daysInMonth, [
    { key: 'mood', label: t('graphs.donutMood'), color: 'var(--accent)' },
    { key: 'mental', label: t('graphs.donutMental'), color: 'var(--accent-2)' },
  ], { big: true, max: 10 }));
  wrap.appendChild(p1);

  if (combine) {
    const all = [
      ...posHabits.map((h, i) => ({ h, neg: false, i })),
      ...negHabits.map((h, i) => ({ h, neg: true, i })),
    ];
    const pC = el('section', 'glass');
    pC.appendChild(el('h3', 'panel-title', t('graphs.combinedTitle')));
    if (all.length === 0) {
      pC.appendChild(el('div', 'empty-state', t('graphs.noPos')));
    } else {
      const series = all.map(({ h, neg, i }) => ({
        key: 'h_' + h.id,
        label: habitLabel(h),
        color: habitPalette(i, neg),
        compute: (e) => (e.checked && e.checked[h.id]) ? 100 : 0,
        tipFmt: pct,
      }));
      pC.appendChild(lineChart(y, m, daysInMonth, series, { big: true, max: 100, yFmt: (v) => v + '%' }));
    }
    wrap.appendChild(pC);
  } else {
    const p2 = el('section', 'glass');
    p2.appendChild(el('h3', 'panel-title', t('graphs.goodHabits')));
    if (posHabits.length === 0) {
      p2.appendChild(el('div', 'empty-state', t('graphs.noPos')));
    } else {
      p2.appendChild(lineChart(y, m, daysInMonth, [
        { key: 'posRate', label: t('graphs.donutPos'), color: 'var(--good)', compute: posRate, tipFmt: pct },
      ], { big: true, max: 100, yFmt: (v) => v + '%' }));
    }
    wrap.appendChild(p2);

    const p3 = el('section', 'glass');
    p3.appendChild(el('h3', 'panel-title', t('graphs.badHabits')));
    if (negHabits.length === 0) {
      p3.appendChild(el('div', 'empty-state', t('graphs.noNeg')));
    } else {
      p3.appendChild(lineChart(y, m, daysInMonth, [
        { key: 'negRate', label: t('graphs.donutNeg'), color: 'var(--bad)', compute: negRate, tipFmt: pct },
      ], { big: true, max: 100, yFmt: (v) => v + '%' }));
    }
    wrap.appendChild(p3);
  }

  return wrap;
}

// -------- ABOUT / SERENE --------
function viewAbout() {
  const wrap = document.createDocumentFragment();
  const head = el('div', 'page-head');
  const l = el('div');
  l.appendChild(el('h1', 'page-title', t('about.title')));
  l.appendChild(el('div', 'page-sub', t('about.sub')));
  head.appendChild(l);
  wrap.appendChild(head);

  const panel = el('section', 'glass about-panel');
  panel.appendChild(el('h3', 'panel-title', t('about.whatFor')));

  panel.appendChild(el('p', 'about-p', t('about.p1')));
  panel.appendChild(el('p', 'about-p', t('about.p2')));
  panel.appendChild(el('p', 'about-p', t('about.p3')));
  panel.appendChild(el('p', 'about-p', t('about.p4')));

  const list = el('ul', 'about-list');
  ['about.li1','about.li2','about.li3','about.li4','about.li5','about.li6','about.li7'].forEach((key) => {
    list.appendChild(el('li', '', t(key)));
  });
  panel.appendChild(list);

  // Latest highlights (short)
  panel.appendChild(el('h3', 'panel-title', t('about.whatsNew', { version: APP_VERSION })));
  const latest = PATCH_NOTES[0];
  const highlights = el('ul', 'about-list');
  patchNoteTexts(latest).slice(0, 3).forEach(n => highlights.appendChild(el('li', '', n)));
  panel.appendChild(highlights);
  const seeAll = el('button', 'btn', t('about.seePatch'));
  seeAll.onclick = () => { state.view = 'patchnotes'; render(); };
  panel.appendChild(seeAll);

  const foot = el('div', 'about-foot', t('about.foot', { version: APP_VERSION }));
  panel.appendChild(foot);

  wrap.appendChild(panel);
  return wrap;
}

// -------- PATCH NOTES --------
const PATCH_NOTES = [
  { v: '1.1.14', date: '2026', noteKeys: ['patch.v1_1_14.n1','patch.v1_1_14.n2','patch.v1_1_14.n3','patch.v1_1_14.n4'] },
  { v: '1.1.13', date: '2026', noteKeys: ['patch.v1_1_13.n1','patch.v1_1_13.n2'] },
  { v: '1.1.12', date: '2026', noteKeys: ['patch.v1_1_12.n1','patch.v1_1_12.n2','patch.v1_1_12.n3','patch.v1_1_12.n4','patch.v1_1_12.n5'] },
  { v: '1.1.11', date: '2026', noteKeys: ['patch.v1_1_11.n1','patch.v1_1_11.n2'] },
  { v: '1.1.10', date: '2026', noteKeys: ['patch.v1_1_10.n1','patch.v1_1_10.n2'] },
  { v: '1.1.9', date: '2026', noteKeys: ['patch.v1_1_9.n1','patch.v1_1_9.n2','patch.v1_1_9.n3','patch.v1_1_9.n4','patch.v1_1_9.n5'] },
  { v: '1.1.8', date: '', noteKeys: ['patch.v1_1_8.n1','patch.v1_1_8.n2'] },
  { v: '1.1.7', date: '', noteKeys: ['patch.v1_1_7.n1'] },
  { v: '1.1.6', date: '', noteKeys: ['patch.v1_1_6.n1'] },
  { v: '1.1.5', date: '', noteKeys: ['patch.v1_1_5.n1','patch.v1_1_5.n2'] },
  { v: '1.1.4', date: '', noteKeys: ['patch.v1_1_4.n1'] },
  { v: '1.1.3', date: '', noteKeys: ['patch.v1_1_3.n1'] },
  { v: '1.1.2', date: '', noteKeys: ['patch.v1_1_2.n1'] },
  { v: '1.1.1', date: '', noteKeys: ['patch.v1_1_1.n1','patch.v1_1_1.n2'] },
  { v: '1.1.0', date: '', noteKeys: ['patch.v1_1_0.n1','patch.v1_1_0.n2','patch.v1_1_0.n3','patch.v1_1_0.n4'] },
  { v: '1.0.0', date: '', noteKeys: ['patch.v1_0_0.n1'] },
];

function patchNoteTexts(p) {
  if (p.noteKeys && p.noteKeys.length) return p.noteKeys.map(k => t(k));
  return p.notes || [];
}

function viewPatchNotes() {
  const wrap = document.createDocumentFragment();
  const head = el('div', 'page-head');
  const l = el('div');
  l.appendChild(el('h1', 'page-title', t('patch.title')));
  l.appendChild(el('div', 'page-sub', t('patch.sub')));
  head.appendChild(l);
  wrap.appendChild(head);

  const panel = el('section', 'glass about-panel');
  PATCH_NOTES.forEach((p, i) => {
    const row = el('div', 'patch');
    const h = el('div', 'patch-head');
    h.appendChild(el('span', 'patch-ver', 'v' + p.v));
    if (i === 0) h.appendChild(el('span', 'patch-badge', t('patch.current')));
    row.appendChild(h);
    const ul = el('ul', 'about-list');
    patchNoteTexts(p).forEach(n => ul.appendChild(el('li', '', n)));
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
  l.appendChild(el('h1', 'page-title', t('habits.title')));
  l.appendChild(el('div', 'page-sub', t('habits.sub')));
  head.appendChild(l);
  wrap.appendChild(head);

  const grid = el('div', 'grid-2');
  grid.appendChild(habitListPanel('positive', t('habits.positive'), PRESETS_POS));
  grid.appendChild(habitListPanel('negative', t('habits.negative'), PRESETS_NEG));
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
    row.appendChild(el('div', 'habit-name', habitLabel(h)));
    if (h.preset) row.appendChild(el('div', 'habit-badge', t('common.preset')));
    const del = el('button', 'btn btn-icon btn-danger', '✕');
    del.onclick = (e) => { e.stopPropagation(); state.habits[kind] = list.filter(x => x.id !== h.id); save(STORAGE.habits, state.habits); render(); };
    row.appendChild(del);
    row.onclick = () => { h.enabled = !h.enabled; save(STORAGE.habits, state.habits); render(); };
    panel.appendChild(row);
  });

  // Add custom
  const addRow = el('div', 'row'); addRow.style.marginTop = '14px';
  const input = document.createElement('input'); input.type = 'text'; input.placeholder = t('habits.addPlaceholder');
  const add = el('button', 'btn btn-primary', t('habits.add'));
  add.onclick = () => {
    const v = input.value.trim(); if (!v) return;
    state.habits[kind].push({ id: uid(), name: v, enabled: true, preset: false });
    save(STORAGE.habits, state.habits); render();
  };
  input.onkeydown = (e) => { if (e.key === 'Enter') add.click(); };
  addRow.appendChild(input); addRow.appendChild(add);
  panel.appendChild(addRow);

  // Preset suggestions
  const existingKeys = new Set(list.map(h => h.labelKey || h.canonicalName || h.name));
  const missing = presets.filter(p => !existingKeys.has(p.labelKey) && !existingKeys.has(p.name));
  if (missing.length) {
    panel.appendChild(el('div', 'panel-title', t('habits.addPreset')));
    const wrap = el('div', 'row wrap');
    missing.forEach(p => {
      const label = p.labelKey ? t(p.labelKey) : p.name;
      const b = el('button', 'btn btn-icon', '+ ' + label);
      b.onclick = () => {
        state.habits[kind].push({ id: uid(), name: t(p.labelKey), canonicalName: p.name, labelKey: p.labelKey, enabled: true, preset: true });
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
  l.appendChild(el('h1', 'page-title', t('settings.title')));
  l.appendChild(el('div', 'page-sub', t('settings.sub')));
  head.appendChild(l);
  wrap.appendChild(head);

  const panel = el('section', 'glass');
  // language
  const langRow = el('div', 'setting-row');
  const ll = el('div', 'setting-label'); ll.appendChild(el('b', '', t('settings.language'))); ll.appendChild(el('span', '', t('settings.languageHint')));
  langRow.appendChild(ll);
  const langSel = document.createElement('select');
  langSel.className = 'month-select';
  const langs = (window.SereneI18n && window.SereneI18n.languages) || [{ code: 'en', label: 'English' }];
  langs.forEach((lang) => {
    const o = document.createElement('option');
    o.value = lang.code;
    o.textContent = lang.label;
    if ((state.settings.language || 'en') === lang.code) o.selected = true;
    langSel.appendChild(o);
  });
  langSel.onchange = () => {
    state.settings.language = langSel.value;
    save(STORAGE.settings, state.settings);
    document.documentElement.lang = langSel.value;
    syncPresetHabitNames();
    render();
  };
  langRow.appendChild(langSel);
  panel.appendChild(langRow);

  // theme
  const themeRow = el('div', 'setting-row');
  const tl = el('div', 'setting-label'); tl.appendChild(el('b', '', t('settings.theme'))); tl.appendChild(el('span', '', t('settings.themeHint')));
  themeRow.appendChild(tl);
  const chips = el('div', 'chip-group');
  [
    ['dark', t('settings.dark')],
    ['light', t('settings.light')],
    ['system', t('settings.system')],
  ].forEach(([val, label]) => {
    const c = el('div', 'chip' + (state.settings.theme === val ? ' active' : ''), label);
    c.onclick = () => { state.settings.theme = val; save(STORAGE.settings, state.settings); render(); };
    chips.appendChild(c);
  });
  themeRow.appendChild(chips);
  panel.appendChild(themeRow);

  // background
  const bgRow = el('div', 'setting-row');
  const bl = el('div', 'setting-label'); bl.appendChild(el('b', '', t('settings.bg'))); bl.appendChild(el('span', '', t('settings.bgHint')));
  bgRow.appendChild(bl);
  const bgActions = el('div', 'row');
  const file = document.createElement('input'); file.type = 'file'; file.accept = 'image/*'; file.style.display = 'none';
  file.onchange = () => {
    const f = file.files && file.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => { state.settings.bg = r.result; save(STORAGE.settings, state.settings); render(); };
    r.readAsDataURL(f);
  };
  const pick = el('button', 'btn btn-primary', t('settings.chooseImage')); pick.onclick = () => file.click();
  const clear = el('button', 'btn', t('settings.clear')); clear.onclick = () => { state.settings.bg = ''; save(STORAGE.settings, state.settings); render(); };
  bgActions.appendChild(pick); bgActions.appendChild(clear); bgActions.appendChild(file);
  bgRow.appendChild(bgActions);
  panel.appendChild(bgRow);

  // NOTIFICATIONS
  const nRow = el('div', 'setting-row');
  const nl = el('div', 'setting-label');
  nl.appendChild(el('b', '', t('settings.reminders')));
  nl.appendChild(el('span', '', t('settings.remindersHint')));
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
  nActs.appendChild(el('span', 'muted', state.settings.notifyEnabled ? t('settings.on') : t('settings.off')));
  nRow.appendChild(nActs);
  panel.appendChild(nRow);

  if (state.settings.notifyEnabled) {
    const fRow = el('div', 'setting-row');
    const fl = el('div', 'setting-label');
    fl.appendChild(el('b', '', t('settings.freq')));
    fl.appendChild(el('span', '', t('settings.freqHint', { start: fmtHr(state.settings.notifyStart), end: fmtHr(state.settings.notifyEnd) })));
    fRow.appendChild(fl);
    const fActs = el('div', 'row');
    const sel = document.createElement('select');
    [1,2,3,4,6,8].forEach(h => {
      const o = document.createElement('option'); o.value = h;
      o.textContent = h === 1 ? t('settings.everyHour', { n: h }) : t('settings.everyHours', { n: h });
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
    fActs.appendChild(el('span', 'muted', t('settings.from'))); fActs.appendChild(startI);
    fActs.appendChild(el('span', 'muted', t('settings.to'))); fActs.appendChild(endI);

    const test = el('button', 'btn', t('settings.sendTest'));
    test.onclick = async () => {
      const ok = await sendNotification('Serene', 'This is a test reminder. Take a slow breath.');
      if (!ok) alert('Could not show a notification. On Windows, make sure Serene is allowed to send notifications in Settings → System → Notifications.');
    };
    fActs.appendChild(test);
    fRow.appendChild(fActs);
    panel.appendChild(fRow);

    // Streak notification toggles
    const mkSwitch = (checked, on) => {
      const sw = el('label', 'switch');
      const c = document.createElement('input'); c.type = 'checkbox'; c.checked = !!checked;
      const s = el('span', 'slider');
      sw.appendChild(c); sw.appendChild(s);
      c.onchange = () => on(c.checked);
      return sw;
    };
    const streakRow = el('div', 'setting-row');
    const srl = el('div', 'setting-label');
    srl.appendChild(el('b', '', t('settings.streakNotif')));
    srl.appendChild(el('span', '', t('settings.streakNotifHint')));
    streakRow.appendChild(srl);
    const srActs = el('div', 'row');
    const mLbl = el('label', 'inline-toggle');
    mLbl.appendChild(mkSwitch(state.settings.streakNotifyMilestone, (v) => { state.settings.streakNotifyMilestone = v; save(STORAGE.settings, state.settings); }));
    mLbl.appendChild(el('span', 'muted', t('settings.milestones')));
    const rLbl = el('label', 'inline-toggle');
    rLbl.appendChild(mkSwitch(state.settings.streakNotifyAtRisk, (v) => { state.settings.streakNotifyAtRisk = v; save(STORAGE.settings, state.settings); }));
    rLbl.appendChild(el('span', 'muted', t('settings.atRisk')));
    srActs.appendChild(mLbl); srActs.appendChild(rLbl);
    streakRow.appendChild(srActs);
    panel.appendChild(streakRow);
  }

  // WINDOW BEHAVIOR
  const wRow = el('div', 'setting-row');
  const wl = el('div', 'setting-label');
  wl.appendChild(el('b', '', t('settings.tray')));
  wl.appendChild(el('span', '', t('settings.trayHint')));
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
  wActs.appendChild(el('span', 'muted', state.settings.minimizeToTray ? t('settings.on') : t('settings.off')));
  wRow.appendChild(wActs);
  panel.appendChild(wRow);

  // AFK LOCK
  const aRow = el('div', 'setting-row');
  const al = el('div', 'setting-label');
  al.appendChild(el('b', '', t('settings.afk')));
  al.appendChild(el('span', '', t('settings.afkHint')));
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
  aActs.appendChild(el('span', 'muted', state.settings.afkEnabled ? t('settings.on') : t('settings.off')));
  aRow.appendChild(aActs);
  panel.appendChild(aRow);

  if (state.settings.afkEnabled) {
    const tRow = el('div', 'setting-row');
    const tl2 = el('div', 'setting-label');
    tl2.appendChild(el('b', '', t('settings.timeout')));
    tl2.appendChild(el('span', '', t('settings.timeoutHint')));
    tRow.appendChild(tl2);
    const tActs = el('div', 'row');
    const tSel = document.createElement('select');
    [1,2,3,5,10,15,20,30].forEach(n => {
      const o = document.createElement('option'); o.value = n;
      o.textContent = n === 1 ? t('settings.minute', { n }) : t('settings.minutes', { n });
      if (state.settings.afkTimeoutMin === n) o.selected = true;
      tSel.appendChild(o);
    });
    tSel.onchange = () => { state.settings.afkTimeoutMin = Number(tSel.value); save(STORAGE.settings, state.settings); resetIdleTimer(); };
    tActs.appendChild(tSel);
    const lockNow = el('button', 'btn', t('settings.lockNow'));
    lockNow.onclick = () => showAfkLock();
    tActs.appendChild(lockNow);
    tRow.appendChild(tActs);
    panel.appendChild(tRow);

    const pRow = el('div', 'setting-row');
    const pl = el('div', 'setting-label');
    pl.appendChild(el('b', '', t('settings.password')));
    pl.appendChild(el('span', '', state.settings.afkPassword ? t('settings.passwordSet') : t('settings.passwordNone')));
    pRow.appendChild(pl);
    const pActs = el('div', 'row');
    const pInp = document.createElement('input'); pInp.type = 'password'; pInp.placeholder = t('settings.passwordPlaceholder');
    const pSave = el('button', 'btn btn-primary', state.settings.afkPassword ? t('settings.updatePwd') : t('settings.set'));
    pSave.onclick = () => {
      state.settings.afkPassword = pInp.value || '';
      save(STORAGE.settings, state.settings);
      render();
    };
    const pClear = el('button', 'btn btn-danger', t('settings.remove'));
    pClear.onclick = () => { state.settings.afkPassword = ''; save(STORAGE.settings, state.settings); render(); };
    pActs.appendChild(pInp); pActs.appendChild(pSave);
    if (state.settings.afkPassword) pActs.appendChild(pClear);
    pRow.appendChild(pActs);
    panel.appendChild(pRow);
  }



  // data
  const dataRow = el('div', 'setting-row');
  const dl = el('div', 'setting-label'); dl.appendChild(el('b', '', t('settings.data'))); dl.appendChild(el('span', '', t('settings.dataHint')));
  dataRow.appendChild(dl);
  const dActs = el('div', 'row wrap');
  const exp = el('button', 'btn', t('settings.export')); exp.onclick = () => {
    save(STORAGE.habits, state.habits);
    save(STORAGE.entries, state.entries);
    save(STORAGE.settings, state.settings);
    const posN = (state.habits.positive || []).length;
    const negN = (state.habits.negative || []).length;
    const dayN = Object.keys(state.entries || {}).length;
    const payload = {
      v: 2,
      exportedAt: new Date().toISOString(),
      habits: state.habits,
      entries: state.entries,
      settings: state.settings,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `serene-backup-${todayKey()}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast(t('backup.exportedTitle'), t('backup.exportedBody', { habits: posN + negN, days: dayN }));
  };
  const impFile = document.createElement('input'); impFile.type = 'file'; impFile.accept = 'application/json,.json'; impFile.style.display = 'none';
  impFile.onchange = () => {
    const f = impFile.files && impFile.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const data = JSON.parse(r.result);
        if (!data || typeof data !== 'object') throw new Error(t('backup.invalidFile'));
        const mode = confirm(t('backup.importMode'));
        const result = importData(data, mode ? 'merge' : 'replace');
        if (result && result.orphanChecks) {
          alert(t('backup.orphanWarn', { count: result.orphanChecks }));
        }
        alert(t('backup.importComplete'));
        render();
      } catch (e) {
        alert(t('backup.importFailed', { error: (e && e.message) ? e.message : t('backup.invalidFile') }));
      }
      impFile.value = '';
    };
    r.readAsText(f);
  };
  const imp = el('button', 'btn', t('settings.import')); imp.onclick = () => impFile.click();
  const reset = el('button', 'btn btn-danger', t('settings.reset')); reset.onclick = () => {
    if (!confirm(t('settings.resetConfirm'))) return;
    localStorage.removeItem(STORAGE.habits); localStorage.removeItem(STORAGE.entries);
    location.reload();
  };
  dActs.appendChild(exp); dActs.appendChild(imp); dActs.appendChild(impFile); dActs.appendChild(reset);
  dataRow.appendChild(dActs);
  panel.appendChild(dataRow);

  // UPDATES
  const uRow = el('div', 'setting-row');
  const ul = el('div', 'setting-label');
  ul.appendChild(el('b', '', t('settings.updates')));
  const verSpan = el('span', '', t('settings.updatesHint', {
    version: APP_VERSION,
    status: state.settings.lastUpdateResult || t('settings.updatesDefault'),
  }));
  ul.appendChild(verSpan);
  uRow.appendChild(ul);
  const uActs = el('div', 'row wrap');
  const urlI = document.createElement('input'); urlI.type = 'text'; urlI.placeholder = t('settings.manifestPlaceholder'); urlI.value = state.settings.updateUrl || ''; urlI.style.minWidth = '260px';
  urlI.onchange = () => { state.settings.updateUrl = urlI.value.trim(); save(STORAGE.settings, state.settings); };
  const check = el('button', 'btn btn-primary', t('settings.checkUpdates'));
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

const APP_VERSION = '1.1.14';
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

function normalizeHabit(h) {
  if (!h || typeof h !== 'object') return null;
  return {
    id: h.id || uid(),
    name: String(h.name || '').trim() || 'Habit',
    enabled: h.enabled !== false,
    preset: !!h.preset,
  };
}

function mergeHabitLists(current, incoming) {
  const cur = Array.isArray(current) ? current.map(normalizeHabit).filter(Boolean) : [];
  const byId = new Map(cur.map(h => [h.id, h]));
  const byName = new Map(cur.map(h => [h.name.toLowerCase(), h]));
  const idMap = {}; // importedId -> localId

  (Array.isArray(incoming) ? incoming : []).forEach((raw) => {
    const h = normalizeHabit(raw);
    if (!h) return;
    const importedId = raw.id || h.id;
    let existing = byId.get(importedId) || byName.get(h.name.toLowerCase());
    if (existing) {
      idMap[importedId] = existing.id;
      existing.name = h.name || existing.name;
      if (typeof raw.enabled === 'boolean') existing.enabled = raw.enabled;
      if (typeof raw.preset === 'boolean') existing.preset = raw.preset;
    } else {
      // Preserve imported id so entry.checked keys keep working
      const kept = { ...h, id: importedId };
      cur.push(kept);
      byId.set(kept.id, kept);
      byName.set(kept.name.toLowerCase(), kept);
      idMap[importedId] = kept.id;
    }
  });
  return { list: cur, idMap };
}

function remapChecked(checked, idMap) {
  const src = (checked && typeof checked === 'object') ? checked : {};
  const out = {};
  Object.keys(src).forEach((id) => {
    const mapped = idMap[id] || id;
    out[mapped] = !!src[id];
  });
  return out;
}

function mergeEntry(local, incoming, idMap) {
  if (!incoming || typeof incoming !== 'object') return local;
  if (!local) {
    return {
      date: incoming.date,
      checked: remapChecked(incoming.checked, idMap),
      mood: incoming.mood,
      mental: incoming.mental,
      submitted: !!incoming.submitted,
      note: typeof incoming.note === 'string' ? incoming.note : '',
    };
  }
  const mergedChecked = Object.assign({}, local.checked || {}, remapChecked(incoming.checked, idMap));
  const preferIncoming = !!incoming.submitted && !local.submitted;
  return {
    date: local.date || incoming.date,
    checked: mergedChecked,
    mood: preferIncoming || (incoming.mood != null && local.mood == null) ? incoming.mood : (local.mood != null ? local.mood : incoming.mood),
    mental: preferIncoming || (incoming.mental != null && local.mental == null) ? incoming.mental : (local.mental != null ? local.mental : incoming.mental),
    submitted: !!(local.submitted || incoming.submitted),
    note: (typeof local.note === 'string' && local.note.length >= (incoming.note || '').length)
      ? local.note
      : (typeof incoming.note === 'string' ? incoming.note : (local.note || '')),
  };
}

function countOrphanChecks(habits, entries) {
  const ids = new Set([
    ...(habits.positive || []).map(h => h.id),
    ...(habits.negative || []).map(h => h.id),
  ]);
  let orphan = 0;
  Object.values(entries || {}).forEach((e) => {
    if (!e || !e.checked) return;
    Object.keys(e.checked).forEach((id) => {
      if (e.checked[id] && !ids.has(id)) orphan += 1;
    });
  });
  return orphan;
}

function importData(data, mode) {
  const idMap = {};
  if (mode === 'replace') {
    if (data.habits && data.habits.positive && data.habits.negative) {
      state.habits = {
        positive: (data.habits.positive || []).map(normalizeHabit).filter(Boolean),
        negative: (data.habits.negative || []).map(normalizeHabit).filter(Boolean),
      };
    }
    if (data.entries && typeof data.entries === 'object') {
      const next = {};
      for (const k in data.entries) next[k] = mergeEntry(null, data.entries[k], {});
      state.entries = next;
    }
    if (data.settings && typeof data.settings === 'object') {
      state.settings = Object.assign({}, state.settings, data.settings);
    }
  } else {
    if (data.habits) {
      ['positive', 'negative'].forEach((k) => {
        const { list, idMap: map } = mergeHabitLists(state.habits[k], data.habits[k]);
        state.habits[k] = list;
        Object.assign(idMap, map);
      });
    }
    if (data.entries && typeof data.entries === 'object') {
      for (const k in data.entries) {
        state.entries[k] = mergeEntry(state.entries[k], data.entries[k], idMap);
      }
    }
    if (data.settings && typeof data.settings === 'object') {
      state.settings = Object.assign({}, state.settings, data.settings);
    }
  }
  save(STORAGE.habits, state.habits);
  save(STORAGE.entries, state.entries);
  save(STORAGE.settings, state.settings);
  return { orphanChecks: countOrphanChecks(state.habits, state.entries) };
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
    time.textContent = d.toLocaleTimeString(localeTag(), { hour: '2-digit', minute: '2-digit' });
    dateEl.textContent = d.toLocaleDateString(localeTag(), { weekday: 'long', month: 'long', day: 'numeric' });
  };
  updateClock();
  const clockInt = setInterval(updateClock, 1000);

  const title = document.createElement('div');
  title.className = 'afk-title';
  title.textContent = t('afk.resting');

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
    inp.placeholder = t('afk.passwordPlaceholder');
    inp.autocomplete = 'off';
    const err = document.createElement('div');
    err.className = 'afk-err';
    const btn = document.createElement('button');
    btn.type = 'submit'; btn.className = 'btn btn-primary'; btn.textContent = t('afk.unlock');
    form.appendChild(inp); form.appendChild(btn); form.appendChild(err);
    form.onsubmit = (e) => {
      e.preventDefault();
      if (inp.value === state.settings.afkPassword) {
        clearInterval(clockInt);
        hideAfkLock();
      } else {
        err.textContent = t('afk.incorrect');
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
    label.textContent = t('afk.slide');
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
  hint.textContent = state.settings.afkPassword ? t('afk.hintPassword') : t('afk.hintSlide');
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

try { document.documentElement.lang = state.settings.language || 'en'; } catch (e) {}
render();
scheduleNotifications();
maybePromptNotifications();
// Show lock on launch if enabled
if (state.settings.afkEnabled) setTimeout(() => showAfkLock(), 150);
else resetIdleTimer();


