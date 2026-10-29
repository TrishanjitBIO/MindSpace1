/* MindSpace – script.js
   All data stays in localStorage. User text is only ever inserted with textContent. */
(function () {
  'use strict';

  var VIEWS = ['home', 'track', 'learn', 'breathe', 'habits'];
  var KEY_ENTRIES = 'mindspace.entries.v1';
  var KEY_HABITS = 'mindspace.habits.v1';
  var HABITS = [
    'Drink water',
    'Move your body for a few minutes',
    'Take a screen break',
    'Connect with someone kind',
    'Wind down before sleep'
  ];

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ---------- storage ---------- */
  function load(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }
  function save(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (e) { return false; }
  }
  function dateKey(d) {
    d = d || new Date();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + m + '-' + day;
  }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  var entries = load(KEY_ENTRIES, []);
  if (!Array.isArray(entries)) entries = [];
  var habitLog = load(KEY_HABITS, {});
  if (!habitLog || typeof habitLog !== 'object') habitLog = {};

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
    if (name === 'home') renderOverview();
    if (name === 'track') { renderHistory(); renderInsights(); }
    if (name === 'habits') renderHabits();
    window.scrollTo(0, 0);
  }
  function go(name) {
    if (location.hash.replace('#', '') === name) show(name);
    else location.hash = name;
  }
  $$('[data-nav]').forEach(function (b) {
    b.addEventListener('click', function () { go(b.getAttribute('data-nav')); });
  });
  $$('[data-go]').forEach(function (b) {
    b.addEventListener('click', function () { go(b.getAttribute('data-go')); });
  });
  window.addEventListener('hashchange', function () { show(location.hash.replace('#', '')); });

  /* ---------- dates ---------- */
  var fmtLong = { weekday: 'long', day: 'numeric', month: 'long' };
  function setDates() {
    var s = new Date().toLocaleDateString(undefined, fmtLong);
    ['today-date', 'habit-date'].forEach(function (id) { var n = document.getElementById(id); if (n) n.textContent = s; });
  }

  /* ---------- Home overview ---------- */
  function renderOverview() {
    var box = $('#overview');
    box.textContent = '';

    var c1 = el('div', 'card stat-card');
    c1.appendChild(el('span', 'stat-label', 'Latest check-in'));
    var last = entries[0];
    if (last) {
      c1.appendChild(el('span', 'stat-value', last.mood + ' · stress ' + last.stress + '/10'));
      c1.appendChild(el('span', 'small muted', new Date(last.ts).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })));
    } else {
      c1.appendChild(el('div', 'empty', 'No check-ins yet. When you save one, it will appear here.'));
    }

    var c2 = el('div', 'card stat-card');
    c2.appendChild(el('span', 'stat-label', "Today's habits"));
    var done = (habitLog[dateKey()] || []).length;
    if (done > 0) {
      c2.appendChild(el('span', 'stat-value', done + ' of ' + HABITS.length + ' done'));
      c2.appendChild(el('span', 'small muted', 'Every small step counts.'));
    } else {
      c2.appendChild(el('div', 'empty', 'Nothing ticked yet today, and that is okay.'));
    }
    box.appendChild(c1);
    box.appendChild(c2);
  }

  /* ---------- Track ---------- */
  var form = $('#checkin-form');
  var stress = $('#stress');
  var stressOut = $('#stress-out');
  var msg = $('#form-msg');
  stress.addEventListener('input', function () { stressOut.textContent = stress.value; });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var picked = form.querySelector('input[name="mood"]:checked');
    var s = parseInt(stress.value, 10);
    msg.className = 'form-msg';
    if (!picked) { msg.textContent = 'Please choose how you are feeling.'; return; }
    if (!(s >= 1 && s <= 10)) { msg.textContent = 'Stress must be between 1 and 10.'; return; }
    entries.unshift({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      ts: Date.now(),
      mood: picked.value,
      stress: s,
      note: $('#note').value.trim().slice(0, 600)
    });
    if (!save(KEY_ENTRIES, entries)) {
      msg.textContent = 'Could not save on this browser (storage may be blocked).';
      return;
    }
    form.reset();
    stress.value = 5; stressOut.textContent = '5';
    msg.className = 'form-msg ok';
    msg.textContent = 'Saved. Thank you for checking in.';
    renderHistory(); renderInsights();
  });

  function renderHistory() {
    var box = $('#history');
    box.textContent = '';
    $('#clear-all').hidden = entries.length === 0;
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
      var del = el('button', 'btn btn-ghost', 'Delete');
      del.type = 'button';
      del.setAttribute('aria-label', 'Delete entry from ' + new Date(en.ts).toLocaleString());
      del.addEventListener('click', function () {
        entries = entries.filter(function (x) { return x.id !== en.id; });
        save(KEY_ENTRIES, entries);
        renderHistory(); renderInsights();
      });
      li.appendChild(del);
      li.appendChild(el('span', 'entry-time', new Date(en.ts).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })));
      if (en.note) li.appendChild(el('p', 'entry-note', en.note));
      ul.appendChild(li);
    });
    box.appendChild(ul);
  }

  var confirmDlg = $('#confirm-dialog');
  $('#clear-all').addEventListener('click', function () { openDialog(confirmDlg); });
  $('#confirm-yes').addEventListener('click', function () {
    entries = []; save(KEY_ENTRIES, entries);
    closeDialog(confirmDlg);
    renderHistory(); renderInsights();
  });

  function renderInsights() {
    var box = $('#insights');
    box.textContent = '';
    if (entries.length < 2) {
      box.appendChild(el('div', 'empty', entries.length
        ? 'Add one more check-in to see a trend.'
        : 'Save a few check-ins and your stress trend will show up here.'));
      return;
    }
    var recent = entries.slice(0, 7).reverse();
    var avg = recent.reduce(function (a, b) { return a + b.stress; }, 0) / recent.length;
    var counts = {};
    entries.forEach(function (e) { counts[e.mood] = (counts[e.mood] || 0) + 1; });
    var common = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; })[0];

    var stats = el('div', 'insight-stats');
    [['Check-ins saved', String(entries.length)],
     ['Average stress (last ' + recent.length + ')', avg.toFixed(1) + ' / 10'],
     ['Most logged mood', common]].forEach(function (p) {
      var d = el('div', 'stat-card');
      d.appendChild(el('span', 'stat-label', p[0]));
      d.appendChild(el('span', 'stat-value', p[1]));
      stats.appendChild(d);
    });
    box.appendChild(stats);

    var chart = el('div', 'chart');
    chart.setAttribute('role', 'img');
    chart.setAttribute('aria-label', 'Stress ratings of your last ' + recent.length + ' check-ins: ' +
      recent.map(function (r) { return r.stress; }).join(', '));
    recent.forEach(function (r) {
      var col = el('div', 'bar-col');
      var bar = el('div', 'bar');
      bar.style.height = (r.stress * 10) + '%';
      col.appendChild(bar);
      col.appendChild(el('span', 'bar-label', String(r.stress)));
      chart.appendChild(col);
    });
    box.appendChild(chart);
    box.appendChild(el('p', 'small muted', 'Oldest to newest. These numbers reflect your own ratings and are not a diagnosis.'));
  }

  /* ---------- Learn quiz ---------- */
  var QUIZ = [
    { q: 'Which brain region acts like an alarm system for possible threats?',
      o: ['Hippocampus', 'Amygdala', 'Prefrontal cortex'], a: 1,
      f: 'The amygdala helps detect threats and can trigger a quick stress response.' },
    { q: 'Which hormone is released at the end of the HPA axis?',
      o: ['Cortisol', 'Insulin', 'Melatonin'], a: 0,
      f: 'The adrenal glands release cortisol after the hypothalamus and pituitary send signals.' },
    { q: 'Which area supports planning and helps regulate emotional reactions?',
      o: ['Amygdala', 'Hippocampus', 'Prefrontal cortex'], a: 2,
      f: 'The prefrontal cortex supports planning, focus and emotional regulation.' }
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

  /* ---------- Breathe ---------- */
  var breath = (function () {
    var TOTAL = 60, INHALE = 4, CYCLE = 10;
    var circle = $('#breath-circle'), text = $('#breath-text'), timer = $('#breath-timer');
    var live = $('#breath-live');
    var startBtn = $('#breath-start'), stopBtn = $('#breath-stop');
    var id = null, elapsed = 0;

    function fmt(sec) { return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0'); }
    function setPhase(inhale) {
      circle.classList.toggle('inhale', inhale);
      circle.classList.toggle('exhale', !inhale);
      text.textContent = inhale ? 'Inhale' : 'Exhale';
      live.textContent = inhale ? 'Inhale' : 'Exhale';
    }
    function reset() {
      circle.classList.remove('inhale', 'exhale');
      text.textContent = 'Ready';
      timer.textContent = fmt(TOTAL);
      startBtn.disabled = false; stopBtn.disabled = true;
    }
    function stop(silent) {
      if (id) { clearInterval(id); id = null; }
      elapsed = 0;
      reset();
      if (silent) live.textContent = '';
    }
    function start() {
      if (id) clearInterval(id);           // never run two timers
      elapsed = 0;
      startBtn.disabled = true; stopBtn.disabled = false;
      timer.textContent = fmt(TOTAL);
      circle.classList.remove('inhale', 'exhale');
      void circle.offsetWidth;             // restart the CSS transition
      setPhase(true);
      id = setInterval(function () {
        elapsed++;
        timer.textContent = fmt(Math.max(TOTAL - elapsed, 0));
        if (elapsed >= TOTAL) {
          clearInterval(id); id = null;
          circle.classList.remove('inhale'); circle.classList.add('exhale');
          text.textContent = 'Well done';
          live.textContent = 'Session complete';
          startBtn.disabled = false; stopBtn.disabled = true;
          return;
        }
        var pos = elapsed % CYCLE;
        if (pos === 0) setPhase(true);
        else if (pos === INHALE) setPhase(false);
      }, 1000);
    }
    startBtn.addEventListener('click', start);
    stopBtn.addEventListener('click', function () { stop(false); });
    $('#breath-restart').addEventListener('click', start);
    reset();
    return { stop: stop };
  })();

  /* ---------- Habits ---------- */
  function renderHabits() {
    var list = $('#habit-list');
    list.textContent = '';
    var today = dateKey();
    var doneIdx = habitLog[today] || [];
    HABITS.forEach(function (name, i) {
      var li = el('li');
      var label = el('label', 'habit' + (doneIdx.indexOf(i) !== -1 ? ' done' : ''));
      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = doneIdx.indexOf(i) !== -1;
      cb.addEventListener('change', function () {
        var cur = (habitLog[dateKey()] || []).filter(function (x) { return x !== i; });
        if (cb.checked) cur.push(i);
        habitLog[dateKey()] = cur.sort();
        save(KEY_HABITS, habitLog);
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
  function openDialog(d) {
    if (typeof d.showModal === 'function') d.showModal(); else d.setAttribute('open', '');
  }
  function closeDialog(d) {
    if (typeof d.close === 'function') d.close(); else d.removeAttribute('open');
  }
  $$('[data-close-dialog]').forEach(function (b) {
    b.addEventListener('click', function () { closeDialog(b.closest('dialog')); });
  });
  $$('[data-open-privacy]').forEach(function (b) {
    b.addEventListener('click', function () { openDialog($('#privacy-dialog')); });
  });

  /* ---------- init ---------- */
  setDates();
  renderQuiz();
  show(location.hash.replace('#', '') || 'home');
})();
