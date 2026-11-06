/* ==========================================================================
   Floana Institut — mise en scène (GSAP + ScrollTrigger + Lenis)
   Principes : courbes douces (expo / power3), on n'anime que transform et
   opacity (sauf les révélations par masque, ponctuelles), stagger partout,
   version allégée si prefers-reduced-motion, sur mobile et sans GSAP.
   ========================================================================== */
(function () {
  'use strict';

  var root = document.documentElement;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var hasGSAP = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';
  var animate = hasGSAP && !reduce;
  var lenis = null;
  var savedata = !!(navigator.connection && navigator.connection.saveData);

  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  window.scrollTo(0, 0);

  function safe(name, fn) { try { fn(); } catch (e) { if (window.console) console.error('[floana] ' + name, e); } }

  /* ======================================================================
     1. Éléments indépendants de GSAP
     ====================================================================== */

  /* ---- Année ---- */
  var yr = $('#year'); if (yr) yr.textContent = new Date().getFullYear();

  /* ---- Horaires : statut « ouvert / fermé » en heure de Paris ---- */
  var HOURS = { 0: [], 1: [], 2: [[840, 1140]], 3: [[510, 720]], 4: [[510, 1140]], 5: [[510, 1140]], 6: [[510, 720]] };
  var DAYNAMES = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  function hm(min) { var h = Math.floor(min / 60), m = min % 60; return h + 'h' + (m ? (m < 10 ? '0' : '') + m : ''); }
  function parisNow() {
    var parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date());
    var o = {}; parts.forEach(function (p) { o[p.type] = p.value; });
    var map = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    return { day: map[o.weekday], min: (parseInt(o.hour, 10) % 24) * 60 + parseInt(o.minute, 10) };
  }
  function initStatus() {
    var n = parisNow(), open = null, next = null, i, r;
    (HOURS[n.day] || []).forEach(function (rg) { if (n.min >= rg[0] && n.min < rg[1]) open = rg; });
    if (!open) {
      for (i = 0; i < 8 && !next; i++) {
        var d = (n.day + i) % 7;
        for (r = 0; r < (HOURS[d] || []).length; r++) {
          var rg = HOURS[d][r];
          if (i > 0 || rg[0] > n.min) { next = { off: i, day: d, at: rg[0] }; break; }
        }
      }
    }
    var txt, closed = !open;
    if (open) txt = 'Ouvert · jusqu\'à ' + hm(open[1]);
    else if (next) txt = 'Fermé · rouvre ' + (next.off === 0 ? 'à ' + hm(next.at) : next.off === 1 ? 'demain à ' + hm(next.at) : DAYNAMES[next.day] + ' à ' + hm(next.at));
    else txt = 'Fermé';
    var chip = $('#openStatus');
    if (chip) { $('span', chip).textContent = txt; chip.classList.toggle('is-closed', closed); }
    var live = $('#hoursLive'); if (live) live.textContent = txt;
    $$('#hours tr').forEach(function (tr) { tr.classList.toggle('is-today', +tr.getAttribute('data-day') === n.day); });
  }
  safe('status', initStatus);

  /* ---- Vidéo héros (source adaptée à l'écran, pas d'autoplay si mouvement réduit) ---- */
  var heroVideo = $('#heroVideo');
  var small = window.matchMedia('(max-width: 767px)').matches;
  function loadHeroVideo() {
    if (!heroVideo || savedata) return;
    heroVideo.src = small ? 'assets/video/hero-540.mp4' : 'assets/video/hero-1080.mp4';
    heroVideo.muted = true;
    if (!reduce) { var p = heroVideo.play(); if (p && p.catch) p.catch(function () { /* poster de secours */ }); }
  }

  /* ---- Vidéo du manifeste : chargée à l'approche, en pause hors écran ---- */
  safe('manifestVideo', function () {
    var v = $('#manifestVideo'); if (!v || reduce || savedata || !('IntersectionObserver' in window)) return;
    var loaded = false;
    new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting) {
          if (!loaded) { v.src = small ? v.getAttribute('data-src-sd') : v.getAttribute('data-src-hd'); v.muted = true; loaded = true; }
          var p = v.play(); if (p && p.catch) p.catch(function () {});
        } else if (loaded) v.pause();
      });
    }, { rootMargin: '250px 0px' }).observe(v);
  });

  /* ---- Navigation : masquée en descendant, visible en remontant ---- */
  var nav = $('#nav'), lastY = 0, menuOpen = false;
  function onScrollY(y) {
    if (!nav) return;
    nav.classList.toggle('is-solid', y > 70);
    if (!menuOpen) {
      if (y > 220 && y > lastY + 4) nav.classList.add('is-hidden');
      else if (y < lastY - 4 || y < 160) nav.classList.remove('is-hidden');
    }
    lastY = y;
    var fab = $('.fab'); if (fab) fab.classList.toggle('is-on', y > window.innerHeight * 0.7);
  }
  window.addEventListener('scroll', function () { onScrollY(window.pageYOffset); }, { passive: true });

  /* ---- Menu mobile plein écran (piloté en CSS) ---- */
  var burger = $('#burger'), menu = $('#menu');
  function setMenu(open) {
    if (!menu || !burger) return;
    menuOpen = open;
    menu.classList.toggle('is-open', open);
    menu.setAttribute('aria-hidden', String(!open));
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Fermer le menu' : 'Ouvrir le menu');
    nav.classList.toggle('menu-open', open);
    if (open) nav.classList.remove('is-hidden');
    if (lenis) { open ? lenis.stop() : lenis.start(); }
    else document.body.style.overflow = open ? 'hidden' : '';
    if (open) { var f = $('a', menu); if (f) setTimeout(function () { f.focus({ preventScroll: true }); }, 350); }
  }
  if (burger) {
    $$('.menu__nav a', menu).forEach(function (a, i) { a.firstElementChild.style.setProperty('--i', i); });
    burger.addEventListener('click', function () { setMenu(!menuOpen); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && menuOpen) { setMenu(false); burger.focus(); } });
    window.addEventListener('resize', function () { if (menuOpen && window.innerWidth > 1100) setMenu(false); });
  }

  /* ---- Ancres : défilement fluide (Lenis si dispo) ---- */
  function goTo(hash) {
    var t = hash === '#top' ? 0 : $(hash);
    if (t === null || typeof t === 'undefined') return;
    if (lenis) lenis.scrollTo(t, { duration: 1.7, easing: function (x) { return x === 1 ? 1 : 1 - Math.pow(2, -10 * x); } });
    else if (t === 0) window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
    else t.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
  }
  $$('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var h = a.getAttribute('href'); if (!h || h.length < 2) return;
      if (h !== '#top' && !$(h)) return;
      e.preventDefault();
      if (menuOpen) setMenu(false);
      if (a.hasAttribute('data-pick') && window.FloanaBooking) window.FloanaBooking.preselect(a.getAttribute('data-pick'));
      goTo(h);
      if (history.replaceState) history.replaceState(null, '', h);
    });
  });
  var toTop = $('#toTop'); if (toTop) toTop.addEventListener('click', function () { goTo('#top'); });

  // utilisé par le module de réservation pour recadrer la carte quand l'étape change
  window.FloanaScroll = {
    to: function (el, offset) {
      if (lenis) lenis.scrollTo(el, { offset: offset || 0, duration: 1.1, easing: function (x) { return x === 1 ? 1 : 1 - Math.pow(2, -10 * x); } });
      else window.scrollTo({ top: el.getBoundingClientRect().top + window.pageYOffset + (offset || 0), behavior: reduce ? 'auto' : 'smooth' });
    }
  };

  /* ---- Lightbox (galerie) ---- */
  safe('lightbox', function () {
    var lb = $('#lightbox'); if (!lb) return;
    var tiles = $$('[data-lightbox]'), img = $('img', lb), cap = $('figcaption', lb);
    var idx = 0, opener = null;
    tiles.forEach(function (t, i) {
      t.tabIndex = 0; t.setAttribute('role', 'button');
      t.setAttribute('aria-label', 'Agrandir la photo : ' + ($('figcaption', t).firstChild.textContent));
      t.addEventListener('click', function () { open(i, t); });
      t.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(i, t); } });
    });
    function setImg(i) {
      idx = (i + tiles.length) % tiles.length;
      var src = $('img', tiles[idx]);
      img.src = src.currentSrc || src.src; img.alt = src.alt;
      cap.textContent = $('figcaption', tiles[idx]).firstChild.textContent;
    }
    function open(i, el) {
      opener = el; setImg(i);
      lb.classList.add('is-open'); lb.setAttribute('aria-hidden', 'false');
      if (lenis) lenis.stop(); else document.body.style.overflow = 'hidden';
      $('.lightbox__close', lb).focus();
    }
    function close() {
      lb.classList.remove('is-open'); lb.setAttribute('aria-hidden', 'true');
      if (lenis) lenis.start(); else document.body.style.overflow = '';
      if (opener) opener.focus({ preventScroll: true });
    }
    $('.lightbox__close', lb).addEventListener('click', close);
    $('.lightbox__nav--prev', lb).addEventListener('click', function () { setImg(idx - 1); });
    $('.lightbox__nav--next', lb).addEventListener('click', function () { setImg(idx + 1); });
    lb.addEventListener('click', function (e) { if (e.target === lb) close(); });
    document.addEventListener('keydown', function (e) {
      if (!lb.classList.contains('is-open')) return;
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowRight') setImg(idx + 1);
      if (e.key === 'ArrowLeft') setImg(idx - 1);
      if (e.key === 'Tab') {
        var f = $$('button', lb), first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
  });

  /* ---- Carrousel d'avis ---- */
  safe('carousel', function () {
    var box = $('#carousel'); if (!box) return;
    var cards = $$('.review', box), n = cards.length, idx = 0, timer = null, num = $('#revNum'), stage = $('.carousel__stage', box);
    // hauteur de la scène = carte la plus haute (le texte ne doit jamais être coupé)
    function measure() {
      stage.style.height = '';
      cards.forEach(function (c) { c.style.height = 'auto'; });
      var h = 0; cards.forEach(function (c) { h = Math.max(h, c.offsetHeight); });
      cards.forEach(function (c) { c.style.height = ''; });
      var min = parseFloat(getComputedStyle(stage).height);
      stage.style.height = Math.max(h + 8, min) + 'px';
    }
    function layout(instant) {
      var mobile = window.innerWidth < 900, dist = mobile ? 92 : 58;
      cards.forEach(function (c, i) {
        var off = i - idx; if (off > n / 2) off -= n; if (off < -n / 2) off += n;
        var abs = Math.abs(off);
        var props = { xPercent: off * dist, scale: 1 - abs * 0.1, rotationY: -off * 14, opacity: abs > 1 ? 0 : 1 - abs * (mobile ? 0.7 : 0.45), zIndex: 10 - abs };
        c.setAttribute('aria-hidden', String(abs !== 0));
        if (hasGSAP && !reduce && !instant) gsap.to(c, Object.assign({ duration: 1.1, ease: 'expo.out', transformPerspective: 1200, overwrite: 'auto' }, props));
        else if (hasGSAP) gsap.set(c, Object.assign({ transformPerspective: 1200 }, props));
        else { c.style.transform = 'translateX(' + off * dist + '%) scale(' + props.scale + ')'; c.style.opacity = props.opacity; c.style.zIndex = props.zIndex; }
      });
      if (num) num.textContent = idx + 1;
    }
    function go(d) { idx = (idx + d + n) % n; layout(); }
    $('#revPrev').addEventListener('click', function () { go(-1); restart(); });
    $('#revNext').addEventListener('click', function () { go(1); restart(); });
    function restart() { stop(); if (!reduce) timer = setInterval(function () { go(1); }, 7000); }
    function stop() { if (timer) clearInterval(timer); timer = null; }
    box.addEventListener('mouseenter', stop); box.addEventListener('mouseleave', restart);
    box.addEventListener('focusin', stop); box.addEventListener('focusout', restart);
    box.tabIndex = 0;
    box.addEventListener('keydown', function (e) { if (e.key === 'ArrowRight') { go(1); restart(); } if (e.key === 'ArrowLeft') { go(-1); restart(); } });
    var sx = null;
    box.addEventListener('pointerdown', function (e) { sx = e.clientX; });
    window.addEventListener('pointerup', function (e) { if (sx === null) return; var dx = e.clientX - sx; sx = null; if (Math.abs(dx) > 45) { go(dx < 0 ? 1 : -1); restart(); } });
    measure(); layout(true);
    window.addEventListener('resize', function () { measure(); layout(true); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { measure(); });
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { es[0].isIntersecting ? restart() : stop(); }, { threshold: 0.3 }).observe(box);
  });

  /* ---- Bouton « fab » : visibilité initiale, et masqué devant le formulaire (il couvrait le bouton « Continuer ») ---- */
  onScrollY(window.pageYOffset);
  safe('fabHide', function () {
    var fab = $('.fab'), bk = $('#booking');
    if (!fab || !bk || !('IntersectionObserver' in window)) return;
    new IntersectionObserver(function (es) { fab.classList.toggle('is-off', es[0].isIntersecting); }, { threshold: 0.01 }).observe(bk);
  });

  /* ======================================================================
     2. Sans GSAP / mouvement réduit : version simple, tout est visible
     ====================================================================== */
  if (!animate) {
    $$('.count').forEach(function (el) {
      var dec = +el.getAttribute('data-dec') || 0;
      var sfx = el.getAttribute('data-suffix') || '';
      el.innerHTML = (+el.getAttribute('data-to')).toFixed(dec).replace('.', ',') + (sfx ? '<span class="suf">' + sfx + '</span>' : '');
    });
    if (heroVideo) loadHeroVideo();
    var l = $('#loader'); if (l) l.remove();
    return;
  }

  /* ======================================================================
     3. Mode animé
     ====================================================================== */
  root.classList.add('anim');
  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true });

  /* ---- Lenis (défilement à inertie douce) ---- */
  if (typeof window.Lenis !== 'undefined') {
    lenis = new Lenis({ duration: 1.15, easing: function (t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); }, smoothWheel: true });
    lenis.on('scroll', function (e) { ScrollTrigger.update(); onScrollY(e.scroll); });
    gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
    gsap.ticker.lagSmoothing(0);
    lenis.stop();
  }

  /* ---- Découpage de texte (mots / lettres) en gardant le balisage (<em>) ---- */
  function splitNode(node) {
    Array.prototype.slice.call(node.childNodes).forEach(function (ch) {
      if (ch.nodeType === 3) {
        var frag = document.createDocumentFragment();
        ch.textContent.split(/(\s+)/).forEach(function (p) {
          if (!p) return;
          if (/^\s+$/.test(p)) { frag.appendChild(document.createTextNode(' ')); return; }
          var w = document.createElement('span'); w.className = 'sp-w';
          var s = document.createElement('span'); s.textContent = p; w.appendChild(s); frag.appendChild(w);
        });
        ch.parentNode.replaceChild(frag, ch);
      } else if (ch.nodeType === 1 && ch.tagName !== 'BR') splitNode(ch);
    });
  }
  function splitChars(el) {
    var txt = el.textContent; el.textContent = '';
    Array.prototype.slice.call(txt).forEach(function (c) { var s = document.createElement('span'); s.className = 'sp-c'; s.textContent = c; el.appendChild(s); });
  }
  $$('[data-split="words"]').forEach(splitNode);
  $$('[data-split="chars"]').forEach(splitChars);
  // état de départ posé par GSAP (jamais en CSS, pour éviter les conversions % → px)
  gsap.set($$('[data-split="words"] .sp-w > span'), { yPercent: 112 });
  gsap.set($$('[data-split="chars"] .sp-c'), { yPercent: 115 });
  $$('[data-reveal-words]').forEach(function (el) {
    var words = el.textContent.trim().split(/\s+/);
    el.innerHTML = words.map(function (w) { return '<span class="w">' + w + '</span>'; }).join(' ');
  });

  /* éléments à révéler en fondu-glissé */
  $$('.carte__intro,.carte__sub,.carte__note,.carte__row,.book__lead,.book__ways li,.book__privacy,.booking,.hours,.venir__addr,.venir__btns,.venir__frame,.reviews__score,.reviews__more,.stats .stat,.gallery__head .eyebrow,.footer__col').forEach(function (el) { el.setAttribute('data-fade', ''); });

  /* ---- Mouvements d'entrée (loader → hero) ---- */
  var loader = $('#loader'), loaderNum = $('#loaderNum');

  function imgReady(src) { return new Promise(function (res) { var i = new Image(); i.onload = i.onerror = function () { res(); }; i.src = src; if (i.decode) i.decode().then(res, res); }); }
  function wait(ms) { return new Promise(function (res) { setTimeout(res, ms); }); }

  function heroIntro() {
    var tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
    tl.fromTo('#heroMedia', { clipPath: 'inset(14% 33% 14% 33% round 50vw 50vw 0vw 0vw)' }, { clipPath: 'inset(0% 0% 0% 0% round 0vw 0vw 0vw 0vw)', duration: 1.9, ease: 'expo.inOut' }, 0)
      .fromTo('.hero__video', { scale: 1.3 }, { scale: 1, duration: 2.4 }, 0)
      .fromTo('.hero__a .sp-c', { yPercent: 115, rotation: 6 }, { yPercent: 0, rotation: 0, duration: 1.6, stagger: 0.07 }, 0.65)
      .fromTo('.hero__eyebrow', { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 1.1 }, 0.9)
      .fromTo('.hero__b', { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 1.3 }, 1.2)
      .fromTo('.hero__lead', { y: 36, opacity: 0 }, { y: 0, opacity: 1, duration: 1.3 }, 1.4)
      .fromTo('.hero__cta > *', { y: 36, opacity: 0 }, { y: 0, opacity: 1, duration: 1.2, stagger: 0.12 }, 1.55)
      .fromTo('.hero__status', { y: -16, opacity: 0 }, { y: 0, opacity: 1, duration: 1 }, 1.8)
      .fromTo('.hero__layers .fl, .hero__layers .pb', { scale: 0, opacity: 0 }, { scale: 1, opacity: function (i, t) { return t.classList.contains('fl--3') ? 1 : 1; }, duration: 1.8, stagger: 0.14, ease: 'elastic.out(1,.6)' }, 1.0)
      .fromTo('.nav > *', { y: -26, opacity: 0 }, { y: 0, opacity: 1, duration: 1, stagger: 0.07 }, 1.3)
      .fromTo('.hero__scroll', { scale: 0.4, opacity: 0 }, { scale: 1, opacity: 1, duration: 1.2 }, 2.0);
    return tl;
  }

  function runLoader() {
    if (!loader) { start(); return; }
    var lp = $$('.lp', loader), fill = $('.loader__fill', loader), heart = $('.loader__heart', loader), letters = $$('.loader__name span', loader);
    var cnt = { v: 0 };
    var posterReady = imgReady('assets/img/hero-poster.jpg');
    var fontsReady = (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();
    // le chargement ne doit jamais rester bloqué : on n'attend les ressources que 5 s au maximum
    var ready = Promise.race([Promise.all([posterReady, fontsReady, wait(1700)]), wait(5000)]);
    var exiting = false;
    setTimeout(function () { if (!exiting && document.body.contains(loader)) { loader.remove(); start(); loadHeroVideo(); } }, 12000);

    var tl = gsap.timeline();
    tl.to(lp, { strokeDashoffset: 0, duration: 1.6, stagger: 0.14, ease: 'power2.inOut' }, 0)
      .fromTo(letters, { yPercent: 115, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 1.1, stagger: 0.07, ease: 'expo.out' }, 0.35)
      .to(cnt, { v: 92, duration: 1.7, ease: 'power1.inOut', onUpdate: function () { loaderNum.textContent = Math.round(cnt.v); } }, 0);

    Promise.all([ready, new Promise(function (r) { tl.eventCallback('onComplete', r); })]).then(function () {
      if (!document.body.contains(loader)) return;
      exiting = true;
      gsap.to(cnt, { v: 100, duration: 0.4, ease: 'power2.out', onUpdate: function () { loaderNum.textContent = Math.round(cnt.v); } });
      var ex = gsap.timeline({ onComplete: function () { loader.remove(); start(); } });
      ex.to(fill, { opacity: 1, duration: 0.7, ease: 'power2.out' }, 0.2)
        .to(heart, { opacity: 1, duration: 0.4 }, 0.35)
        .to('.loader__flower', { rotation: 72, scale: 1.25, duration: 1.1, ease: 'power3.inOut', transformOrigin: '50% 50%' }, 0.2)
        .to(['.loader__name', '.loader__count'], { opacity: 0, y: -18, duration: 0.5, ease: 'power2.in' }, 0.8)
        .to('.loader__flower', { scale: 14, opacity: 0, duration: 1.1, ease: 'expo.in', transformOrigin: '50% 50%' }, 1.2)
        .to(loader, { opacity: 0, duration: 0.8, ease: 'power2.inOut' }, 1.6)
        .add(function () { loadHeroVideo(); heroIntro(); }, 1.5);
    });
  }

  function start() {
    if (lenis) lenis.start();
    ScrollTrigger.refresh();
  }

  /* ---- Curseur personnalisé (souris uniquement) ---- */
  safe('cursor', function () {
    if (!fine) return;
    var cur = $('.cursor'), dot = $('.cursor__dot'), ring = $('.cursor__ring'), label = $('b', ring);
    gsap.set([dot, ring], { xPercent: -50, yPercent: -50 });
    var dx = gsap.quickTo(dot, 'x', { duration: 0.12 }), dy = gsap.quickTo(dot, 'y', { duration: 0.12 });
    var rx = gsap.quickTo(ring, 'x', { duration: 0.5, ease: 'power3' }), ry = gsap.quickTo(ring, 'y', { duration: 0.5, ease: 'power3' });
    window.addEventListener('pointermove', function (e) { dx(e.clientX); dy(e.clientY); rx(e.clientX); ry(e.clientY); }, { passive: true });
    document.addEventListener('pointerover', function (e) {
      var view = e.target.closest && e.target.closest('[data-lightbox]');
      var link = e.target.closest && e.target.closest('a,button,input,textarea,label,.carte__row');
      cur.classList.toggle('is-view', !!view);
      cur.classList.toggle('is-link', !!link && !view);
      label.textContent = view ? 'Voir' : '';
    });
  });

  /* ---- Boutons magnétiques ---- */
  safe('magnetic', function () {
    if (!fine) return;
    $$('.magnetic').forEach(function (b) {
      var xTo = gsap.quickTo(b, 'x', { duration: 1, ease: 'elastic.out(1,.45)' }), yTo = gsap.quickTo(b, 'y', { duration: 1, ease: 'elastic.out(1,.45)' });
      b.addEventListener('mousemove', function (e) {
        var r = b.getBoundingClientRect();
        xTo((e.clientX - (r.left + r.width / 2)) * 0.36); yTo((e.clientY - (r.top + r.height / 2)) * 0.36);
      });
      b.addEventListener('mouseleave', function () { xTo(0); yTo(0); });
    });
  });

  /* ---- Cartes en 3D (tilt) avec reflet lumineux ---- */
  safe('tilt', function () {
    if (!fine) return;
    $$('[data-tilt]').forEach(function (el) {
      var glare = $('.glare', el);
      el.addEventListener('mousemove', function (e) {
        var r = el.getBoundingClientRect(), px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
        gsap.to(el, { rotationY: (px - 0.5) * 13, rotationX: -(py - 0.5) * 13, transformPerspective: 900, duration: 0.7, ease: 'power3.out', overwrite: 'auto' });
        if (glare) gsap.to(glare, { x: px * r.width - glare.offsetWidth / 2, y: py * r.height - glare.offsetHeight / 2, duration: 0.5, ease: 'power3.out', overwrite: 'auto' });
      });
      el.addEventListener('mouseleave', function () {
        gsap.to(el, { rotationX: 0, rotationY: 0, duration: 1.1, ease: 'elastic.out(1,.55)', overwrite: 'auto' });
      });
    });
  });

  /* ======================================================================
     4. Animations liées au défilement
     ====================================================================== */
  function buildScroll() {

    /* Barre de progression de lecture */
    safe('progress', function () {
      gsap.to('.progress i', { scaleX: 1, ease: 'none', scrollTrigger: { trigger: document.body, start: 'top top', end: 'bottom bottom', scrub: 0.3 } });
    });

    /* Parallax multicouche du hero */
    safe('heroParallax', function () {
      var st = { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true };
      gsap.to('.hero__video', { yPercent: 14, ease: 'none', scrollTrigger: st });
      gsap.to('.hero__content', { yPercent: -10, opacity: 0.2, ease: 'none', scrollTrigger: st });
      $$('.hero__layers [data-speed]').forEach(function (el) {
        gsap.to(el, { y: function () { return -window.innerHeight * parseFloat(el.getAttribute('data-speed')) * 0.7; }, ease: 'none', scrollTrigger: st });
      });
    });

    /* Titres : mots qui montent derrière un masque */
    safe('titles', function () {
      $$('[data-split="words"]').forEach(function (el) {
        gsap.fromTo($$('.sp-w > span', el), { yPercent: 112 }, { yPercent: 0, duration: 1.3, ease: 'expo.out', stagger: 0.07, scrollTrigger: { trigger: el, start: 'top 88%', once: true } });
      });
      $$('.eyebrow__bar').forEach(function (b) {
        gsap.to(b, { scaleX: 1, duration: 1.2, ease: 'expo.out', scrollTrigger: { trigger: b, start: 'top 92%', once: true } });
      });
    });

    /* Fondus glissés par lots */
    safe('fades', function () {
      ScrollTrigger.batch('[data-fade]', {
        start: 'top 90%', once: true,
        onEnter: function (b) { gsap.to(b, { opacity: 1, y: 0, duration: 1.2, ease: 'power3.out', stagger: 0.09 }); }
      });
    });

    /* Marquee : vitesse et sens qui réagissent au scroll */
    safe('marquee', function () {
      var tweens = [];
      $$('.marquee__row').forEach(function (row, i) {
        var track = $('.marquee__track', row), dir = +row.getAttribute('data-dir') || 1;
        track.innerHTML += track.innerHTML;
        var tw = gsap.fromTo(track, { xPercent: dir > 0 ? 0 : -50 }, { xPercent: dir > 0 ? -50 : 0, duration: i ? 52 : 40, ease: 'none', repeat: -1 });
        tweens.push(tw);
      });
      ScrollTrigger.create({
        start: 0, end: 'max',
        onUpdate: function (self) {
          var boost = 1 + Math.min(Math.abs(self.getVelocity()) / 240, 7), d = self.direction;
          tweens.forEach(function (tw) {
            gsap.timeline({ overwrite: true }).to(tw, { timeScale: d * boost, duration: 0.25, ease: 'power2.out' }).to(tw, { timeScale: d, duration: 1.4, ease: 'power2.inOut' });
          });
        }
      });
    });

    var mm = gsap.matchMedia();
    function addMM(q, fn) { safe('mm ' + q, function () { mm.add(q, fn); }); }

    /* ---- Section pinnée : storytelling en 4 temps (desktop) ---- */
    addMM('(min-width: 900px)', function () {
      var story = $('.story'); if (!story) return;
      var steps = $$('.story__step', story), imgs = $$('.story__img', story), ticks = $$('.story__progress i', story);
      var N = steps.length;
      gsap.set(steps, { autoAlpha: 0, y: 40 }); gsap.set(steps[0], { autoAlpha: 1, y: 0 });
      ticks[0].classList.add('is-on');
      // Ken Burns : zoom lent permanent sur les photos
      imgs.forEach(function (im, i) { gsap.fromTo(im, { scale: 1.04 }, { scale: 1.16, duration: 14, ease: 'sine.inOut', repeat: -1, yoyo: true, delay: i * 1.3 }); });
      var tl = gsap.timeline({
        defaults: { ease: 'power2.inOut' },
        scrollTrigger: {
          trigger: story, start: 'top top', end: '+=' + (N * 85) + '%', pin: true, scrub: 0.6, anticipatePin: 1, invalidateOnRefresh: true,
          onUpdate: function (self) {
            var idx = Math.min(N - 1, Math.floor(self.progress * N + 0.12));
            ticks.forEach(function (t, i) { t.classList.toggle('is-on', i <= idx); });
          }
        }
      });
      for (var i = 1; i < N; i++) {
        var at = i - 0.42;
        tl.to(steps[i - 1], { autoAlpha: 0, y: -44, duration: 0.34 }, at)
          .to(imgs[i], { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.62, ease: 'power3.inOut' }, at)
          .fromTo(steps[i], { autoAlpha: 0, y: 48 }, { autoAlpha: 1, y: 0, duration: 0.5, ease: 'power3.out' }, at + 0.26);
      }
      tl.to('.story__card', { y: -70, rotation: 3, duration: N - 1, ease: 'none' }, 0)
        .to('.story__flower', { rotation: 200, duration: N, ease: 'none' }, 0)
        .to({}, { duration: 0.5 }, N - 0.5); // temps de lecture sur la dernière étape
    });

    /* Mobile : étapes qui apparaissent simplement */
    addMM('(max-width: 899px)', function () {
      $$('.story__step').forEach(function (s) {
        gsap.from(s, { opacity: 0, y: 40, duration: 1.1, ease: 'power3.out', scrollTrigger: { trigger: s, start: 'top 85%', once: true } });
      });
    });

    /* Manifeste : mots qui s'allument + parallax de la vidéo */
    safe('manifest', function () {
      var words = $$('.manifest__text .w');
      gsap.fromTo(words, { opacity: 0.14 }, { opacity: 1, ease: 'none', stagger: 0.12, scrollTrigger: { trigger: '.manifest__text', start: 'top 78%', end: 'bottom 52%', scrub: 0.5 } });
      gsap.fromTo('.manifest__bg', { yPercent: -8 }, { yPercent: 8, ease: 'none', scrollTrigger: { trigger: '.manifest', start: 'top bottom', end: 'bottom top', scrub: true } });
    });

    /* ---- Soins : défilement horizontal piloté par le scroll (desktop) ---- */
    addMM('(min-width: 900px)', function () {
      var section = $('.services'), track = $('#svcTrack'); if (!section || !track) return;
      var dist = function () { return Math.max(0, track.scrollWidth - window.innerWidth); };
      var tween = gsap.to(track, {
        x: function () { return -dist(); }, ease: 'none',
        scrollTrigger: {
          trigger: section, start: 'top top', end: function () { return '+=' + dist(); }, pin: true, scrub: 0.6, anticipatePin: 1, invalidateOnRefresh: true,
          onUpdate: function (self) { gsap.set('.services__bar i', { scaleX: self.progress }); }
        }
      });
      $$('.svc', track).forEach(function (card) {
        var img = $('.svc__media img', card), body = $$('.svc__body > *', card);
        gsap.fromTo(img, { xPercent: -8 }, { xPercent: 8, ease: 'none', scrollTrigger: { trigger: card, containerAnimation: tween, start: 'left right', end: 'right left', scrub: true } });
        gsap.fromTo(body, { y: 46, opacity: 0 }, { y: 0, opacity: 1, duration: 1, ease: 'power3.out', stagger: 0.09, scrollTrigger: { trigger: card, containerAnimation: tween, start: 'left 82%', toggleActions: 'play none none reverse' } });
        gsap.fromTo($('.svc__media', card), { rotation: -3 }, { rotation: 3, ease: 'none', scrollTrigger: { trigger: card, containerAnimation: tween, start: 'left right', end: 'right left', scrub: true } });
      });
    });

    /* Mobile : cartes de soins en carrousel natif, révélations simples */
    addMM('(max-width: 899px)', function () {
      $$('.svc').forEach(function (c) {
        gsap.from($$('.svc__media, .svc__body > *', c), { y: 30, opacity: 0, duration: 1, stagger: 0.07, ease: 'power3.out', scrollTrigger: { trigger: '.services__track', start: 'top 85%', once: true } });
      });
    });

    /* ---- Carte : aperçu qui suit la souris ---- */
    safe('carte', function () {
      if (!fine) return;
      var pv = $('.carte__preview'), imgs = $$('img', pv), rows = $$('.carte__row');
      gsap.set(pv, { xPercent: 0, yPercent: 0, scale: 0.85, rotation: -4 });
      var xTo = gsap.quickTo(pv, 'x', { duration: 0.6, ease: 'power3' }), yTo = gsap.quickTo(pv, 'y', { duration: 0.6, ease: 'power3' });
      rows.forEach(function (r) {
        r.addEventListener('mouseenter', function () {
          imgs.forEach(function (i) { i.classList.toggle('is-on', i.getAttribute('data-pv') === r.getAttribute('data-img')); });
          gsap.to(pv, { opacity: 1, scale: 1, rotation: 0, duration: 0.7, ease: 'expo.out', overwrite: 'auto' });
        });
        r.addEventListener('mouseleave', function () { gsap.to(pv, { opacity: 0, scale: 0.85, rotation: -4, duration: 0.5, ease: 'power3.in', overwrite: 'auto' }); });
        r.addEventListener('mousemove', function (e) {
          // l'aperçu se place à gauche de la liste (il ne masque jamais le texte survolé) et suit la souris en hauteur
          var w = pv.offsetWidth, h = pv.offsetHeight, lr = r.parentNode.getBoundingClientRect(), x = lr.left - w - 28;
          if (x < 16) x = Math.min(window.innerWidth - w - 16, e.clientX + 60);
          xTo(x); yTo(Math.max(16, Math.min(window.innerHeight - h - 16, e.clientY - h / 2)));
        });
      });
    });

    /* ---- Chiffres : compteurs + fleur qui tourne ---- */
    safe('stats', function () {
      $$('.count').forEach(function (el) {
        var to = parseFloat(el.getAttribute('data-to')), dec = +el.getAttribute('data-dec') || 0, suf = el.getAttribute('data-suffix') || '', o = { v: 0 };
        var fmt = function (v) { return v.toFixed(dec).replace('.', ',') + (suf ? '<span class="suf">' + suf + '</span>' : ''); };
        el.innerHTML = fmt(0);
        ScrollTrigger.create({
          trigger: el, start: 'top 90%', once: true,
          onEnter: function () { gsap.to(o, { v: to, duration: 2.6, ease: 'power3.out', onUpdate: function () { el.innerHTML = fmt(o.v); } }); }
        });
      });
      gsap.to('.stats__flower', { rotation: 140, ease: 'none', scrollTrigger: { trigger: '.stats', start: 'top bottom', end: 'bottom top', scrub: true } });
      gsap.to('.book__flower', { rotation: -90, ease: 'none', scrollTrigger: { trigger: '.book', start: 'top bottom', end: 'bottom top', scrub: true } });
    });

    /* ---- Galerie : révélations par masque, parallax interne ---- */
    safe('gallery', function () {
      var reveals = ['inset(100% 0% 0% 0%)', 'inset(0% 0% 0% 100%)', 'circle(0% at 50% 50%)', 'inset(0% 100% 0% 0%)', 'inset(0% 0% 100% 0%)', 'inset(50% 50% 50% 50%)'];
      $$('.tile').forEach(function (tile, i) {
        var from = reveals[i % reveals.length], to = from.indexOf('circle') === 0 ? 'circle(100% at 50% 50%)' : (from.indexOf('50% 50% 50% 50%') > -1 ? 'inset(0% 0% 0% 0%)' : 'inset(0% 0% 0% 0%)');
        var inner = $('.tile__in', tile), img = $('img', tile);
        gsap.fromTo(inner, { clipPath: from }, { clipPath: to, duration: 1.5, ease: 'expo.inOut', scrollTrigger: { trigger: tile, start: 'top 88%', once: true }, onComplete: function () { gsap.set(inner, { clearProps: 'clipPath' }); } });
        gsap.fromTo(img, { yPercent: -5, scale: 1.12 }, { yPercent: 5, scale: 1.02, ease: 'none', scrollTrigger: { trigger: tile, start: 'top bottom', end: 'bottom top', scrub: true } });
      });
    });

    /* ---- Avis : entrée du carrousel ---- */
    safe('reviewsIn', function () {
      gsap.from('#carousel', { y: 60, opacity: 0, duration: 1.4, ease: 'expo.out', scrollTrigger: { trigger: '#carousel', start: 'top 85%', once: true } });
    });

    /* ---- Footer : grande signature qui monte ---- */
    safe('footer', function () {
      var spans = $$('.footer__giant span');
      gsap.fromTo(spans, { yPercent: 105 }, {
        yPercent: 0, duration: 1.7, ease: 'expo.out', stagger: 0.08,
        scrollTrigger: { trigger: '.footer__giant', start: 'top 92%', once: true },
        onComplete: function () { gsap.set(spans, { clearProps: 'transform' }); }
      });
    });

    /* ---- Lien actif dans la navigation ---- */
    safe('navActive', function () {
      ['histoire', 'soins', 'tarifs', 'galerie', 'avis', 'venir'].forEach(function (id) {
        var link = $('.nav__links [data-link="' + id + '"]'), sec = document.getElementById(id);
        if (!link || !sec) return;
        ScrollTrigger.create({ trigger: sec, start: 'top 55%', end: 'bottom 55%', onToggle: function (self) { link.classList.toggle('is-active', self.isActive); } });
      });
    });
  }

  safe('buildScroll', buildScroll);

  /* ---- Recalcul des positions (polices, images, redimensionnement) ---- */
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { ScrollTrigger.refresh(); });
  window.addEventListener('load', function () { ScrollTrigger.refresh(); });

  /* ---- Go ---- */
  runLoader();
})();
