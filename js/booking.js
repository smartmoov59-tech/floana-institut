/* ==========================================================================
   Floana Institut — module de réservation (100 % statique, sans back-end)
   Le visiteur choisit un soin, un créneau et laisse ses coordonnées :
   le site prépare un SMS / un e-mail déjà rédigé pour Marie-Paule,
   et un fichier .ics (rendez-vous provisoire). Aucune donnée n'est stockée.
   ========================================================================== */
(function () {
  'use strict';

  var PHONE = '+33698177438';
  var MAIL = 'mariepaule.grac@sfr.fr';
  var PLACE = 'Floana Institut, 3 place Joseph Orcesi, Résidence la Bléone, 04000 Digne-les-Bains';
  var SLOT_STEP = 30;        // pas des créneaux (minutes)
  var LAST_BEFORE_CLOSE = 60; // dernier départ de soin avant la fermeture (minutes)
  var DAYS_AHEAD = 35;

  var SERVICES = [
    { id: 'visage', label: 'Soin du visage' },
    { id: 'japonais', label: 'Modelage ancestral japonais', price: '65 €' },
    { id: 'corps', label: 'Massage du corps' },
    { id: 'reflexo', label: 'Réflexologie plantaire' },
    { id: 'pieds', label: 'Modelage des pieds', price: '30 €' },
    { id: 'epilation', label: 'Épilations' },
    { id: 'cadeau', label: 'Bon cadeau' },
    { id: 'conseil', label: 'Je ne sais pas encore, conseillez-moi' }
  ];

  // Horaires (minutes depuis minuit), 0 = dimanche … 6 = samedi
  var HOURS = {
    0: [], 1: [],
    2: [[14 * 60, 19 * 60]],
    3: [[8 * 60 + 30, 12 * 60]],
    4: [[8 * 60 + 30, 19 * 60]],
    5: [[8 * 60 + 30, 19 * 60]],
    6: [[8 * 60 + 30, 12 * 60]]
  };

  var form = document.getElementById('booking');
  if (!form) return;

  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  var chipsEl = $('#bkChips'), datesEl = $('#bkDates'), timesEl = $('#bkTimes');
  var steps = $$('.bk-step', form), stepDots = $$('.booking__steps li', form);
  var btnNext = $('#bkNext'), btnPrev = $('#bkPrev'), nav = $('#bkNav');
  var result = $('#bkResult');

  var state = { step: 1, services: [], date: null, time: null };

  /* ---------- Jours fériés français (pour prévenir, pas pour bloquer) ---------- */
  function easter(y) {
    var a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4,
      f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3),
      h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4,
      l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451),
      month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(y, month - 1, day);
  }
  var holidayCache = {};
  function holidays(y) {
    if (holidayCache[y]) return holidayCache[y];
    var set = {}, add = function (d) { set[key(d)] = true; };
    [[0, 1], [4, 1], [4, 8], [6, 14], [7, 15], [10, 1], [10, 11], [11, 25]].forEach(function (m) { add(new Date(y, m[0], m[1])); });
    var e = easter(y);
    [1, 39, 50].forEach(function (n) { add(new Date(e.getFullYear(), e.getMonth(), e.getDate() + n)); });
    holidayCache[y] = set; return set;
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function key(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function isHoliday(d) { return !!holidays(d.getFullYear())[key(d)]; }
  function fromKey(k) { var p = k.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }

  /* ---------- Format ---------- */
  var fmtLong = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  var fmtWd = new Intl.DateTimeFormat('fr-FR', { weekday: 'short' });
  var fmtMo = new Intl.DateTimeFormat('fr-FR', { month: 'short' });
  function hm(min) { var h = Math.floor(min / 60), m = min % 60; return h + 'h' + (m ? pad(m) : ''); }
  function timeLabel(t) { var p = t.split(':'); return +p[0] + 'h' + (p[1] === '00' ? '' : p[1]); }
  function toStr(min) { return pad(Math.floor(min / 60)) + ':' + pad(min % 60); }
  function listFr(arr) { return arr.length < 2 ? arr.join('') : arr.slice(0, -1).join(', ') + ' et ' + arr[arr.length - 1]; }

  /* ---------- Créneaux ---------- */
  function slotsFor(d) {
    var ranges = HOURS[d.getDay()] || [], out = [];
    var now = new Date(), isToday = key(d) === key(now);
    var nowMin = now.getHours() * 60 + now.getMinutes() + 120; // préavis de 2 h le jour même
    ranges.forEach(function (r) {
      for (var t = r[0]; t <= r[1] - LAST_BEFORE_CLOSE; t += SLOT_STEP) {
        if (isToday && t < nowMin) continue;
        out.push(t);
      }
    });
    return out;
  }

  /* ---------- Étape 1 : soins ---------- */
  function renderChips() {
    chipsEl.innerHTML = SERVICES.map(function (s) {
      return '<label class="bk-chip"><input type="checkbox" name="soin" value="' + s.id + '"><span>' + s.label +
        (s.price ? ' <small>' + s.price + '</small>' : '') + '</span></label>';
    }).join('');
    $$('input', chipsEl).forEach(function (inp) {
      inp.addEventListener('change', function () {
        if (inp.checked) {
          if (inp.value === 'conseil') uncheckOthers('conseil');
          else uncheckOthers(null, 'conseil');
        }
        state.services = $$('input:checked', chipsEl).map(function (i) { return i.value; });
        hideErr();
      });
    });
  }
  function uncheckOthers(only, except) {
    $$('input', chipsEl).forEach(function (i) {
      if (only && i.value !== only) i.checked = false;
      if (except && i.value === except) i.checked = false;
    });
  }
  function labelOf(id) { for (var i = 0; i < SERVICES.length; i++) if (SERVICES[i].id === id) return SERVICES[i].label; return id; }

  /* ---------- Étape 2 : jours et heures ---------- */
  function renderDates() {
    var today = new Date(); today.setHours(0, 0, 0, 0);
    // calendrier en grille de 7 colonnes (lundi → dimanche), jamais de défilement horizontal
    var html = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(function (w) { return '<span class="bk-wd" aria-hidden="true">' + w + '</span>'; }).join('');
    var lead = (today.getDay() + 6) % 7, k;
    for (k = 0; k < lead; k++) html += '<span class="bk-blank" aria-hidden="true"></span>';
    for (var i = 0; i < DAYS_AHEAD; i++) {
      var d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
      var closed = !(HOURS[d.getDay()] || []).length;
      var full = !closed && slotsFor(d).length === 0;
      var month = fmtMo.format(d).replace('.', '');
      var note = closed ? (d.getDate() === 1 ? month : '') : (full ? 'complet' : (isHoliday(d) ? 'férié' : (i === 0 ? 'auj.' : (d.getDate() === 1 ? month : ''))));
      html += '<button type="button" class="bk-date" aria-pressed="false" data-date="' + key(d) + '"' +
        (closed || full ? ' disabled' : '') + ' aria-label="' + fmtLong.format(d) + (closed ? ', fermé' : (full ? ', complet' : '')) + '">' +
        '<b>' + d.getDate() + '</b><em>' + note + '</em></button>';
    }
    datesEl.innerHTML = html;
    $$('.bk-date', datesEl).forEach(function (b) {
      b.addEventListener('click', function () {
        $$('.bk-date', datesEl).forEach(function (x) { x.setAttribute('aria-pressed', 'false'); });
        b.setAttribute('aria-pressed', 'true');
        state.date = b.getAttribute('data-date'); state.time = null;
        renderTimes(); hideErr();
      });
    });
    renderTimes();
  }
  function renderTimes() {
    if (!state.date) { timesEl.innerHTML = '<p>Choisissez d\'abord un jour, puis l\'heure qui vous convient.</p>'; return; }
    var d = fromKey(state.date), slots = slotsFor(d);
    var am = slots.filter(function (t) { return t < 12 * 60; }), pm = slots.filter(function (t) { return t >= 12 * 60; });
    var html = '';
    if (isHoliday(d)) html += '<p>Jour férié : l\'ouverture est à confirmer avec Marie-Paule.</p>';
    [['Matin', am], ['Après-midi', pm]].forEach(function (g) {
      if (!g[1].length) return;
      html += '<div><h4>' + g[0] + '</h4><div class="bk-slots">' + g[1].map(function (t) {
        return '<button type="button" class="bk-slot" aria-pressed="' + (state.time === toStr(t)) + '" data-t="' + toStr(t) + '">' + hm(t) + '</button>';
      }).join('') + '</div></div>';
    });
    timesEl.innerHTML = html || '<p>Plus de créneau ce jour-là, essayez un autre jour.</p>';
    $$('.bk-slot', timesEl).forEach(function (b) {
      b.addEventListener('click', function () {
        state.time = b.getAttribute('data-t');
        $$('.bk-slot', timesEl).forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        hideErr();
      });
    });
  }

  /* ---------- Étape 3 : coordonnées ---------- */
  function validPhone(v) {
    var d = v.replace(/[\s.\-()]/g, '');
    return /^0\d{9}$/.test(d) || /^(\+|00)\d{8,15}$/.test(d);
  }

  /* ---------- Navigation entre étapes ---------- */
  function err(msg) { var box = $('.bk-step[data-step="' + state.step + '"] .bk-err', form); if (box) { box.textContent = msg; box.hidden = false; } }
  function hideErr() { $$('.bk-err', form).forEach(function (b) { b.hidden = true; }); $$('.bk-field', form).forEach(function (f) { f.classList.remove('is-bad'); }); }

  function validate(step) {
    hideErr();
    if (step === 1 && !state.services.length) { err('Choisissez au moins un soin (ou « conseillez-moi »).'); return false; }
    if (step === 2) {
      if (!state.date) { err('Choisissez un jour.'); return false; }
      var flex = $('#bkFlex').checked;
      if (!state.time && !flex) { err('Choisissez une heure, ou cochez « Je suis flexible ».'); return false; }
    }
    if (step === 3) {
      var first = $('#bkFirst'), phone = $('#bkPhone');
      if (!first.value.trim()) { first.parentNode.classList.add('is-bad'); err('Indiquez votre prénom.'); first.focus(); return false; }
      if (!validPhone(phone.value)) { phone.parentNode.classList.add('is-bad'); err('Indiquez un numéro de téléphone valide (par exemple 06 12 34 56 78).'); phone.focus(); return false; }
    }
    return true;
  }

  function show(step, focus) {
    state.step = step;
    steps.forEach(function (s) {
      var on = +s.getAttribute('data-step') === step;
      s.hidden = !on; s.classList.toggle('is-on', on);
      if (on) { s.classList.remove('is-entering'); void s.offsetWidth; s.classList.add('is-entering'); }
    });
    stepDots.forEach(function (li, i) { li.classList.toggle('is-on', i < step); });
    btnPrev.hidden = step === 1;
    $('span', btnNext).textContent = step === 3 ? 'Préparer ma demande' : 'Continuer';
    result.hidden = true; nav.hidden = false;
    if (focus) {
      var lg = $('.bk-step[data-step="' + step + '"] legend', form); if (lg) { lg.setAttribute('tabindex', '-1'); lg.focus({ preventScroll: true }); }
      revealCard();
    }
  }

  // Quand l'étape change, on remet le haut de la carte à l'écran (l'étape 2 est plus haute que la 1)
  var revealTimer = null;
  function revealCard() {
    clearTimeout(revealTimer);
    revealTimer = setTimeout(function () {
      var r = form.getBoundingClientRect();
      if (Math.abs(r.top) > window.innerHeight * 2) return; // visiteur loin du formulaire : on ne le déplace pas
      if (r.top < 90 || r.top > window.innerHeight * 0.45) {
        if (window.FloanaScroll) window.FloanaScroll.to(form, -100);
        else form.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 60);
  }

  btnNext.addEventListener('click', function () {
    if (!validate(state.step)) return;
    if (state.step < 3) show(state.step + 1, true);
    else buildResult();
  });
  btnPrev.addEventListener('click', function () { show(state.step - 1, true); });
  form.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'BUTTON') { e.preventDefault(); btnNext.click(); }
  });
  form.addEventListener('submit', function (e) { e.preventDefault(); });

  /* ---------- Message et envoi ---------- */
  function message() {
    var first = $('#bkFirst').value.trim(), last = $('#bkLast').value.trim();
    var phone = $('#bkPhone').value.trim(), note = $('#bkMsg').value.trim();
    var names = state.services.map(labelOf);
    var d = fromKey(state.date), flex = $('#bkFlex').checked;
    var when = fmtLong.format(d) + (state.time ? ' à ' + timeLabel(state.time) : ' (horaire à convenir)');
    var lines = [
      'Bonjour Marie-Paule, c\'est ' + first + (last ? ' ' + last : '') + '.',
      'Je souhaiterais réserver : ' + listFr(names) + '.',
      'Créneau souhaité : ' + when + (flex && state.time ? ', mais je suis flexible' : '') + (isHoliday(d) ? ' (jour férié, à confirmer)' : '') + '.'
    ];
    if (note) lines.push(note);
    lines.push('Mon numéro : ' + phone + '.');
    lines.push('Pouvez-vous me confirmer le rendez-vous ? Merci !');
    lines.push('(Demande faite depuis le site Floana Institut)');
    return lines.join('\n');
  }

  function buildResult() {
    var msg = message();
    var first = $('#bkFirst').value.trim(), last = $('#bkLast').value.trim();
    $('#bkPreview').value = msg;
    $('#bkSms').setAttribute('href', 'sms:' + PHONE + '?&body=' + encodeURIComponent(msg));
    $('#bkMail').setAttribute('href', 'mailto:' + MAIL + '?subject=' + encodeURIComponent('Demande de rendez-vous : ' + first + (last ? ' ' + last : '')) + '&body=' + encodeURIComponent(msg));
    steps.forEach(function (s) { s.hidden = true; });
    nav.hidden = true; result.hidden = false;
    var pv = $('#bkPreview'); pv.style.height = 'auto'; pv.style.height = (pv.scrollHeight + 6) + 'px';
    stepDots.forEach(function (li) { li.classList.add('is-on'); });
    var t = $('.bk-result__title', result); if (t) { t.setAttribute('tabindex', '-1'); t.focus({ preventScroll: true }); }
    revealCard();
    document.dispatchEvent(new CustomEvent('floana:booking-result'));
  }

  $('#bkRestart').addEventListener('click', function () { show(3, true); });

  $('#bkCopy').addEventListener('click', function () {
    var btn = this, txt = $('#bkPreview').value, done = function () { var s = $('span', btn), old = s.textContent; s.textContent = 'Message copié ✓'; setTimeout(function () { s.textContent = old; }, 2200); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(done, fallback); else fallback();
    function fallback() { var ta = $('#bkPreview'); ta.select(); try { document.execCommand('copy'); done(); } catch (e) { /* rien */ } }
  });

  $('#bkIcs').addEventListener('click', function () {
    var d = fromKey(state.date), startMin = state.time ? (+state.time.split(':')[0]) * 60 + (+state.time.split(':')[1]) : (HOURS[d.getDay()][0] || [600])[0];
    var endMin = startMin + 60;
    var stamp = function (min) { return d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + 'T' + pad(Math.floor(min / 60)) + pad(min % 60) + '00'; };
    var now = new Date(), utc = now.getUTCFullYear() + pad(now.getUTCMonth() + 1) + pad(now.getUTCDate()) + 'T' + pad(now.getUTCHours()) + pad(now.getUTCMinutes()) + pad(now.getUTCSeconds()) + 'Z';
    var esc = function (s) { return String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n'); };
    var summary = 'Floana Institut : ' + listFr(state.services.map(labelOf)) + ' (à confirmer)';
    var ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Floana Institut//Reservation//FR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'BEGIN:VEVENT',
      'UID:' + now.getTime() + '@floana-institut', 'DTSTAMP:' + utc, 'DTSTART:' + stamp(startMin), 'DTEND:' + stamp(endMin),
      'SUMMARY:' + esc(summary), 'LOCATION:' + esc(PLACE), 'DESCRIPTION:' + esc('Rendez-vous demandé sur le site, à confirmer par Marie-Paule : ' + PHONE.replace('+33', '0')),
      'STATUS:TENTATIVE', 'BEGIN:VALARM', 'TRIGGER:-PT2H', 'ACTION:DISPLAY', 'DESCRIPTION:Rendez-vous Floana Institut', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    var blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'rendez-vous-floana.ics';
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  });

  /* ---------- API publique : pré-sélection d'un soin depuis les cartes ---------- */
  window.FloanaBooking = {
    preselect: function (id) {
      var inp = $('input[value="' + id + '"]', chipsEl);
      if (!inp) return;
      uncheckOthers(null, 'conseil');
      inp.checked = true;
      state.services = $$('input:checked', chipsEl).map(function (i) { return i.value; });
      show(1, false);
    }
  };

  renderChips();
  renderDates();
  show(1, false);
})();
