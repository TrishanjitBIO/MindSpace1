/* MindSpace – script.js (v2)
   Storage: browser localStorage only (this browser, this device). Nothing is sent anywhere.
   User text is only ever inserted with textContent, never as HTML. */
(function () {
  'use strict';

  var VIEWS = ['home', 'track', 'learn', 'breathe', 'habits'];
  var TITLES = { home: 'Home', track: 'Track', learn: 'Learn', breathe: 'Breathe', habits: 'Habits' };
  var MOODS = ['Calm', 'Okay', 'Worried', 'Low', 'Positive'];
  var KEY_ENTRIES = 'mindspace.entries.v1';
  var KEY_BAD = 'mindspace.entries.v1.unreadable';
  var KEY_HABITS = 'mindspace.habits.v1';
  var KEY_RANGE = 'mindspace.range';
  var DAY = 86400000;
  var HABITS = [
    'Drink water',
    'Move your body for a few minutes',
    'Take a screen break',
    'Connect with someone kind',
    'Wind down before sleep'
  ];

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  /* ---------- storage ---------- */
  function readJSON(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }
  // Writes, then reads back to confirm it really persisted. Returns true only on success.
  function writeJSON(key, value) {
    try {
      var s = JSON.stringify(value);
      localStorage.setItem(key, s);
      return localStorage.getItem(key) === s;
    } catch (e) { return false; }
  }
  function dateKey(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function fmtDateTime(ts) {
    return new Date(ts).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  }

  /* Validate stored records. Unreadable ones are kept in a separate key, never silently deleted. */
  function cleanEntries(list) {
    var good = [], bad = [];
    (Array.isArray(list) ? list : []).forEach(function (r) {
      var ok = r && typeof r === 'object' && typeof r.id === 'string' && r.id &&
        isFinite(r.ts) && MOODS.indexOf(r.mood) !== -1 &&
        Number.isInteger(r.stress) && r.stress >= 1 && r.stress <= 10;
      if (ok) {
        good.push({
          id: r.id, ts: Number(r.ts), mood: r.mood, stress: r.stress,
          note: typeof r.note === 'string' ? r.note.slice(0, 600) : '',
          createdAt: isFinite(r.createdAt) ? Number(r.createdAt) : Number(r.ts),
          updatedAt: isFinite(r.updatedAt) ? Number(r.updatedAt) : null
        });
      } else { bad.push(r); }
    });
    if (bad.length) {
      var prev = readJSON(KEY_BAD, []);
      writeJSON(KEY_BAD, (Array.isArray(prev) ? prev : []).concat(bad));
      if (window.console) console.warn('MindSpace: ' + bad.length + ' unreadable record(s) were set aside, not deleted.');
    }
    good.sort(function (a, b) { return b.ts - a.ts; });
    return good;
  }
  function cleanHabits(obj) {
    var out = {};
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return out;
    Object.keys(obj).forEach(function (k) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(k) || !Array.isArray(obj[k])) return;
      var seen = {};
      out[k] = obj[k].filter(function (i) {
        var ok = Number.isInteger(i) && i >= 0 && i < HABITS.length && !seen[i];
        seen[i] = true; return ok;
      }).sort();
    });
    return out;
  }

  var entries = cleanEntries(readJSON(KEY_ENTRIES, []));
  var habitLog = cleanHabits(readJSON(KEY_HABITS, {}));
  var storageWarned = false;

  function persistEntries() { return writeJSON(KEY_ENTRIES, entries); }
  function persistHabits() { return writeJSON(KEY_HABITS, habitLog); }

  /* ---------- toast ---------- */
  var toastEl = $('#toast'), toastTimer;
  function toast(msg, kind) {
    toastEl.textContent = msg;
    toastEl.className = 'toast show' + (kind ? ' ' + kind : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.className = 'toast'; }, 3500);
  }

  /* ---------- navigation ---------- */
  function show(name) {
    if (VIEWS.indexOf(name) === -1) name = 'home';
    if (name !== 'breathe') breath.stop(true);
    $$('.view').forEach(function (v) { v.hidden = v.getAttribute('data-view') !== name; });
    $$('[data-nav]').forEach(function (b) {
      var on = b.getAttribute('data-nav') === name;
      b.classList.toggle('active', on);
      if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    document.title = TITLES[name] + ' – MindSpace';
    if (name === 'home') renderOverview();
    if (name === 'track') { renderHistory(); renderInsights(); }
    if (name === 'habits') renderHabits();
    window.scrollTo(0, 0);
  }
  function go(name) {
    if (location.hash.replace('#', '') === name) show(name);
    else location.hash = name;
  }
  $$('[data-nav]').forEach(function (b) { b.addEventListener('click', function () { go(b.getAttribute('data-nav')); }); });
  $$('[data-go]').forEach(function (b) { b.addEventListener('click', function () { go(b.getAttribute('data-go')); }); });
  window.addEventListener('hashchange', function () { show(location.hash.replace('#', '')); });

  /* ---------- dates ---------- */
  function setDates() {
    var s = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
    ['today-date', 'habit-date'].forEach(function (id) { var n = document.getElementById(id); if (n) n.textContent = s; });
  }

  /* ---------- Home overview ---------- */
  function statCard(label, value, sub, emptyText) {
    var c = el('div', 'card stat-card');
    c.appendChild(el('span', 'stat-label', label));
    if (value == null) {
      c.appendChild(el('div', 'empty', emptyText));
    } else {
      c.appendChild(el('span', 'stat-value', value));
      if (sub) c.appendChild(el('span', 'small muted', sub));
    }
    return c;
  }
  function renderOverview() {
    var box = $('#overview');
    box.textContent = '';
    var last = entries[0];
    box.appendChild(statCard('Latest mood', last ? last.mood : null, last ? fmtDateTime(last.ts) : '',
      'No check-ins yet. Your latest mood will appear here.'));
    box.appendChild(statCard('Perceived stress', last ? last.stress + ' / 10' : null, last ? 'Your own rating' : '',
      'Save a check-in to see your latest rating.'));
    var done = (habitLog[dateKey()] || []).length;
    box.appendChild(statCard("Today's habits", done > 0 ? done + ' of ' + HABITS.length + ' done' : null,
      'Every small step counts.', 'Nothing ticked yet today, and that is okay.'));
  }

  /* ---------- Track: form (create + edit) ---------- */
  var form = $('#checkin-form');
  var stress = $('#stress'), stressOut = $('#stress-out'), msg = $('#form-msg');
  var saveBtn = $('#save-btn'), cancelBtn = $('#cancel-edit'), formTitle = $('#form-title');
  var editingId = null, saving = false, lastSubmitAt = 0;

  stress.addEventListener('input', function () { stressOut.textContent = stress.value; });

  function setMsg(text, ok) { msg.className = 'form-msg' + (ok ? ' ok' : ''); msg.textContent = text; }

  function resetForm() {
    editingId = null;
    form.reset();
    stress.value = 5; stressOut.textContent = '5';
    formTitle.textContent = 'New check-in';
    saveBtn.textContent = 'Save check-in';
    cancelBtn.hidden = true;
    form.classList.remove('editing');
  }
  function startEdit(en) {
    editingId = en.id;
    var r = form.querySelector('input[name="mood"][value="' + en.mood + '"]');
    if (r) r.checked = true;
    stress.value = en.stress; stressOut.textContent = String(en.stress);
    $('#note').value = en.note || '';
    formTitle.textContent = 'Edit check-in';
    saveBtn.textContent = 'Update check-in';
    cancelBtn.hidden = false;
    form.classList.add('editing');
    setMsg('', false);
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    var first = form.querySelector('input[name="mood"]:checked') || form.querySelector('input[name="mood"]');
    if (first) first.focus({ preventScroll: true });
  }
  cancelBtn.addEventListener('click', function () { resetForm(); setMsg('Edit cancelled.', true); });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (saving || Date.now() - lastSubmitAt < 600) return;    // ignore double submits
    var picked = form.querySelector('input[name="mood"]:checked');
    var s = parseInt(stress.value, 10);
    if (!picked || MOODS.indexOf(picked.value) === -1) { setMsg('Please choose how you are feeling.', false); return; }
    if (!(Number.isInteger(s) && s >= 1 && s <= 10)) { setMsg('Stress must be a whole number from 1 to 10.', false); return; }
    var note = $('#note').value.trim().slice(0, 600);

    saving = true; saveBtn.disabled = true;
    var label = saveBtn.textContent; saveBtn.textContent = 'Saving…';
    var before = entries.map(function (x) { return Object.assign({}, x); });
    var now = Date.now(), wasEdit = !!editingId;

    if (wasEdit) {
      var t = entries.filter(function (x) { return x.id === editingId; })[0];
      if (t) { t.mood = picked.value; t.stress = s; t.note = note; t.updatedAt = now; }
    } else {
      entries.unshift({
        id: now.toString(36) + Math.random().toString(36).slice(2, 8),
        ts: now, mood: picked.value, stress: s, note: note, createdAt: now, updatedAt: null
      });
    }
    var ok = persistEntries();
    saving = false; saveBtn.disabled = false; lastSubmitAt = Date.now();

    if (!ok) {                                    // failed: roll back, say so, keep the form as typed
      entries = before;
      saveBtn.textContent = label;
      setMsg('Could not save. This browser may be blocking storage. Nothing was saved.', false);
      toast('Save failed. Nothing was saved.', 'error');
      return;
    }
    resetForm();
    setMsg(wasEdit ? 'Updated.' : 'Saved. Thank you for checking in.', true);
    toast(wasEdit ? 'Check-in updated' : 'Check-in saved');
    renderHistory(); renderInsights();
  });

  /* ---------- Track: history ---------- */
  function renderHistory() {
    var box = $('#history');
    box.textContent = '';
    $('#clear-all').hidden = entries.length === 0;
    $('#export-btn').hidden = entries.length === 0;
    if (!entries.length) {
      box.appendChild(el('div', 'empty', 'Your check-ins will appear here, newest first.'));
      return;
    }
    var ul = el('ul', 'history-list');
    entries.forEach(function (en) {
      var li = el('li', 'entry');
      var top = el('div', 'entry-top');
      top.appendChild(el('span', 'entry-mood', en.mood));
      top.appendChild(el('span', 'entry-stress', 'Stress ' + en.stress + '/10'));
      li.appendChild(top);

      var actions = el('div', 'entry-actions');
      var edit = el('button', 'btn btn-ghost', 'Edit');
      edit.type = 'button';
      edit.setAttribute('aria-label', 'Edit entry from ' + fmtDateTime(en.ts));
      edit.addEventListener('click', function () { startEdit(en); });
      var del = el('button', 'btn btn-ghost', 'Delete');
      del.type = 'button';
      del.setAttribute('aria-label', 'Delete entry from ' + fmtDateTime(en.ts));
      del.addEventListener('click', function () {
        var before = entries.slice();
        entries = entries.filter(function (x) { return x.id !== en.id; });
        if (!persistEntries()) { entries = before; toast('Could not delete. Nothing was changed.', 'error'); return; }
        if (editingId === en.id) resetForm();
        toast('Entry deleted');
        renderHistory(); renderInsights();
      });
      actions.appendChild(edit); actions.appendChild(del);
      li.appendChild(actions);

      var time = el('span', 'entry-time', fmtDateTime(en.ts));
      if (en.updatedAt) time.appendChild(el('span', 'entry-edited', ' · edited'));
      li.appendChild(time);
      if (en.note) li.appendChild(el('p', 'entry-note', en.note));
      ul.appendChild(li);
    });
    box.appendChild(ul);
  }

  /* clear-all with confirmation */
  var confirmDlg = $('#confirm-dialog');
  $('#clear-all').addEventListener('click', function () { openDialog(confirmDlg); });
  $('#confirm-yes').addEventListener('click', function () {
    var before = entries;
    entries = [];
    if (!persistEntries()) { entries = before; closeDialog(confirmDlg); toast('Could not clear. Nothing was changed.', 'error'); return; }
    closeDialog(confirmDlg);
    resetForm();
    toast('All check-ins cleared');
    renderHistory(); renderInsights();
  });

  /* export a JSON copy */
  $('#export-btn').addEventListener('click', function () {
    try {
      var blob = new Blob([JSON.stringify({ app: 'MindSpace', exportedAt: new Date().toISOString(), entries: entries }, null, 2)], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'mindspace-checkins-' + dateKey() + '.json';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
      toast('Export downloaded');
    } catch (e) { toast('Export is not available in this browser.', 'error'); }
  });

  /* ---------- Insights ---------- */
  var rangeSel = $('#range');
  var savedRange = null;
  try { savedRange = localStorage.getItem(KEY_RANGE); } catch (e) {}
  if (savedRange === '7' || savedRange === '30' || savedRange === 'all') rangeSel.value = savedRange;
  var lastCap = window.innerWidth <= 480;
  window.addEventListener('resize', function () {
    var now = window.innerWidth <= 480;
    if (now !== lastCap) { lastCap = now; renderInsights(); }
  });
  rangeSel.addEventListener('change', function () {
    try { localStorage.setItem(KEY_RANGE, rangeSel.value); } catch (e) {}
    renderInsights();
  });

  function renderInsights() {
    var box = $('#insights');
    box.textContent = '';
    if (!entries.length) {
      box.appendChild(el('div', 'empty', 'Save a few check-ins and your summary will show up here.'));
      return;
    }
    var v = rangeSel.value;
    var label = v === 'all' ? 'all time' : 'last ' + v + ' days';
    var inRange = v === 'all' ? entries : entries.filter(function (x) { return x.ts >= Date.now() - Number(v) * DAY; });

    var stats = el('div', 'insight-stats');
    function stat(l, val) {
      var d = el('div', 'stat-card');
      d.appendChild(el('span', 'stat-label', l));
      d.appendChild(el('span', 'stat-value', val));
      stats.appendChild(d);
    }
    stat('Check-ins saved', String(entries.length));
    stat('Latest rating', entries[0].stress + ' / 10');
    var avg = inRange.length ? (inRange.reduce(function (a, b) { return a + b.stress; }, 0) / inRange.length) : null;
    stat('Average (' + label + ')', avg == null ? '–' : avg.toFixed(1) + ' / 10');
    box.appendChild(stats);

    if (inRange.length < 2) {
      box.appendChild(el('div', 'empty', inRange.length === 0
        ? 'No check-ins in this period. Try a longer period, or add a check-in.'
        : 'Only one check-in in this period, which is not enough to show a trend. Add another, or choose a longer period.'));
      box.appendChild(el('p', 'small muted', 'Ratings are your own perceptions. They are not a medical measurement or a diagnosis.'));
      return;
    }
    var cap = window.innerWidth <= 480 ? 7 : 14;           // fewer bars on phones so the date labels stay readable
    var shown = inRange.slice(0, cap).reverse();
    var chart = el('div', 'chart');
    chart.setAttribute('role', 'img');
    chart.setAttribute('aria-label', 'Stress ratings, oldest to newest: ' + shown.map(function (r) {
      return r.stress + ' on ' + new Date(r.ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
    }).join(', '));
    shown.forEach(function (r) {
      var col = el('div', 'bar-col');
      var bar = el('div', 'bar');
      bar.style.height = (r.stress * 10) + '%';
      col.appendChild(el('span', 'bar-label', String(r.stress)));
      col.appendChild(bar);
      col.appendChild(el('span', 'bar-date', new Date(r.ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })));
      chart.appendChild(col);
    });
    box.appendChild(chart);
    box.appendChild(el('p', 'small muted', 'Showing up to the latest ' + cap + ' check-ins in this period, oldest to newest. Ratings are your own perceptions, not a diagnosis, and this chart cannot show why they changed.'));
  }

  /* ---------- Learn quiz ---------- */
  var QUIZ = [
    { q: 'Which brain region acts like an alarm system for possible threats?',
      o: ['Hippocampus', 'Amygdala', 'Prefrontal cortex'], a: 1,
      f: 'The amygdala helps detect threats and can trigger a quick stress response.' },
    { q: 'Which hormone is released at the end of the HPA axis?',
      o: ['Cortisol', 'Insulin', 'Melatonin'], a: 0,
      f: 'The adrenal glands release cortisol after the hypothalamus (CRH) and pituitary (ACTH) send signals.' },
    { q: 'Which area supports planning and helps regulate emotional reactions?',
      o: ['Amygdala', 'Hippocampus', 'Prefrontal cortex'], a: 2,
      f: 'The prefrontal cortex supports planning, focus and emotional regulation.' },
    { q: 'Which pair of chemicals is released within seconds and raises heart rate?',
      o: ['Adrenaline and noradrenaline', 'Cortisol and ACTH', 'Insulin and glucagon'], a: 0,
      f: 'Adrenaline and noradrenaline act fast. Cortisol follows more slowly through the HPA axis.' },
    { q: 'Which statement about short-term stress is most accurate?',
      o: ['It is always harmful', 'It is a normal response that usually settles afterwards', 'It only happens to some people'], a: 1,
      f: 'Short bursts of stress are a normal, adaptive response. How people experience them does vary.' }
  ];
  var qi = 0, score = 0;
  function renderQuiz() {
    var box = $('#quiz');
    box.textContent = '';
    if (qi >= QUIZ.length) {
      box.appendChild(el('p', 'quiz-q', 'You got ' + score + ' of ' + QUIZ.length + '. Nicely done for taking the time to learn.'));
      var again = el('button', 'btn btn-secondary', 'Try again');
      again.type = 'button';
      again.addEventListener('click', function () { qi = 0; score = 0; renderQuiz(); });
      box.appendChild(again);
      return;
    }
    var item = QUIZ[qi];
    box.appendChild(el('p', 'quiz-step', 'Question ' + (qi + 1) + ' of ' + QUIZ.length));
    box.appendChild(el('p', 'quiz-q', item.q));
    var opts = el('div', 'quiz-opts');
    var fb = el('p', 'quiz-fb');
    fb.setAttribute('role', 'status');
    var next = el('button', 'btn btn-primary', qi === QUIZ.length - 1 ? 'See result' : 'Next');
    next.type = 'button'; next.hidden = true;
    next.addEventListener('click', function () { qi++; renderQuiz(); });
    item.o.forEach(function (text, i) {
      var b = el('button', 'quiz-opt', text);
      b.type = 'button';
      b.addEventListener('click', function () {
        $$('.quiz-opt', opts).forEach(function (x, j) {
          x.disabled = true;
          if (j === item.a) x.classList.add('correct');
        });
        if (i === item.a) score++; else b.classList.add('wrong');
        fb.textContent = (i === item.a ? 'Correct. ' : 'Not quite. ') + item.f;
        next.hidden = false; next.focus();
      });
      opts.appendChild(b);
    });
    box.appendChild(opts); box.appendChild(fb); box.appendChild(next);
  }

  /* ---------- Breathe (clock-based, so the timer stays correct even if the tab is throttled) ---------- */
  var breath = (function () {
    var TOTAL = 60000, INHALE = 4000, CYCLE = 10000;
    var circle = $('#breath-circle'), text = $('#breath-text'), timer = $('#breath-timer'), live = $('#breath-live');
    var startBtn = $('#breath-start'), pauseBtn = $('#breath-pause'), stopBtn = $('#breath-stop'), restartBtn = $('#breath-restart');
    var id = null, running = false, paused = false, base = 0, startedAt = 0, phase = null;

    function elapsed() { return running && !paused ? base + (Date.now() - startedAt) : base; }
    function fmt(ms) { var s = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
    function setPhase(p, force) {
      if (p === phase && !force) return;
      phase = p;
      circle.classList.toggle('inhale', p === 'inhale');
      circle.classList.toggle('exhale', p === 'exhale');
      text.textContent = p === 'inhale' ? 'Inhale' : 'Exhale';
      live.textContent = text.textContent;
    }
    function clear() { if (id) { clearInterval(id); id = null; } }
    function buttons() {
      startBtn.disabled = running;
      pauseBtn.disabled = !running;
      pauseBtn.textContent = paused ? 'Resume' : 'Pause';
      stopBtn.disabled = !running;
    }
    function reset() {
      clear(); running = false; paused = false; base = 0; phase = null;
      circle.classList.remove('inhale', 'exhale');
      text.textContent = 'Ready';
      timer.textContent = fmt(TOTAL);
      buttons();
    }
    function finish() {
      clear(); running = false; paused = false; base = 0; phase = null;
      circle.classList.remove('inhale'); circle.classList.add('exhale');
      text.textContent = 'Well done';
      timer.textContent = fmt(0);
      live.textContent = 'Session complete';
      buttons();
    }
    function tick() {
      if (!running || paused) return;
      var e = elapsed();
      if (e >= TOTAL) { finish(); return; }
      timer.textContent = fmt(TOTAL - e);
      setPhase((e % CYCLE) < INHALE ? 'inhale' : 'exhale');
    }
    function start() {
      clear(); base = 0; phase = null; running = true; paused = false; startedAt = Date.now();
      circle.classList.remove('inhale', 'exhale');
      void circle.offsetWidth;
      buttons(); tick();
      id = setInterval(tick, 200);                 // only one interval ever exists (clear() above)
    }
    function pause() {
      if (!running) return;
      if (!paused) {
        base = elapsed(); paused = true; clear();
        text.textContent = 'Paused'; live.textContent = 'Paused';
      } else {
        paused = false; startedAt = Date.now(); phase = null;
        id = setInterval(tick, 200); tick();
      }
      buttons();
    }
    startBtn.addEventListener('click', start);
    pauseBtn.addEventListener('click', pause);
    stopBtn.addEventListener('click', function () { reset(); live.textContent = 'Stopped'; });
    restartBtn.addEventListener('click', start);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) tick(); });
    reset();
    return { stop: function (silent) { reset(); if (silent) live.textContent = ''; }, state: function () { return { running: running, paused: paused, hasInterval: !!id }; } };
  })();
  window.__mindspaceBreath = breath;               // read-only handle for automated tests

  /* ---------- Habits ---------- */
  function renderHabits() {
    var list = $('#habit-list');
    list.textContent = '';
    var doneIdx = habitLog[dateKey()] || [];
    HABITS.forEach(function (name, i) {
      var li = el('li');
      var isDone = doneIdx.indexOf(i) !== -1;
      var label = el('label', 'habit' + (isDone ? ' done' : ''));
      var cb = document.createElement('input');
      cb.type = 'checkbox'; cb.checked = isDone;
      cb.addEventListener('change', function () {
        var key = dateKey();                       // read at click time, so a day change never overwrites yesterday
        var prev = (habitLog[key] || []).slice();
        var cur = prev.filter(function (x) { return x !== i; });
        if (cb.checked) cur.push(i);
        habitLog[key] = cur.sort();
        if (!persistHabits()) {
          habitLog[key] = prev;
          toast('Could not save. Nothing was changed.', 'error');
        }
        renderHabits();
        var again = $$('#habit-list input')[i]; if (again) again.focus();
      });
      label.appendChild(cb);
      label.appendChild(el('span', null, name));
      li.appendChild(label);
      list.appendChild(li);
    });
    var n = doneIdx.length;
    $('#habit-count').textContent = n + ' of ' + HABITS.length + ' done';
    $('#habit-fill').style.width = (n / HABITS.length * 100) + '%';
    $('#habit-bar').setAttribute('aria-valuenow', String(n));
  }

  /* ---------- dialogs ---------- */
  function openDialog(d) { if (typeof d.showModal === 'function') d.showModal(); else d.setAttribute('open', ''); }
  function closeDialog(d) { if (typeof d.close === 'function') d.close(); else d.removeAttribute('open'); }
  $$('[data-close-dialog]').forEach(function (b) { b.addEventListener('click', function () { closeDialog(b.closest('dialog')); }); });
  $$('[data-open-privacy]').forEach(function (b) { b.addEventListener('click', function () { openDialog($('#privacy-dialog')); }); });

  /* ---------- init ---------- */
  setDates();
  renderQuiz();
  show(location.hash.replace('#', '') || 'home');
})();
