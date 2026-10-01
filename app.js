/* DENSAM — vanilla JS, no dependencies */
(() => {
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const FINE = matchMedia('(hover:hover) and (pointer:fine)').matches;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const wait = ms => new Promise(r => setTimeout(r, RM ? Math.min(ms, 60) : ms));
const store = {
  get(k, d) { try { const v = localStorage.getItem('densam.' + k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem('densam.' + k, JSON.stringify(v)); } catch {} },
  del(k) { try { localStorage.removeItem('densam.' + k); } catch {} }
};
const fmtN = n => Math.round(n).toLocaleString('en-US');
const mm = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const go = sel => { const el = $(sel); if (el) el.scrollIntoView({ behavior: RM ? 'auto' : 'smooth', block: 'start' }); };
const M = { x: 0, y: 0, cx: 0, cy: 0 }; // mouse normalised -1..1

/* ---------- toast + notifications ---------- */
let toastT;
function toast(msg, err) {
  const t = $('#toast'); t.textContent = msg; t.classList.toggle('err', !!err); t.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 3200);
}
let NT = [
  { i: '💪', t: 'Workout complete', p: '35 минут. Керемет жұмыс.', w: '2 сағ', u: 1 },
  { i: '💧', t: 'Hydration', p: 'Су мақсатыңа 500 ml қалды.', w: '4 сағ', u: 1 },
  { i: '🔥', t: 'Streak', p: '12 күндік streak сақталды.', w: 'Кеше', u: 0 }
];
function renderNt() {
  const l = $('#ntList');
  l.innerHTML = NT.length ? NT.map(n => `<div class="nt ${n.u ? 'unread' : ''}"><div class="nt__i">${n.i}</div><div><b>${esc(n.t)}</b><p>${esc(n.p)}</p></div><time>${n.w}</time></div>`).join('')
    : `<div class="empty"><svg viewBox="0 0 240 28" aria-hidden="true"><path d="M0 14h58l8-11 10 22 9-17 7 6h36l8-9 9 19 8-10h87" fill="none"/></svg><b>Алғашқы қадамыңды жаса.</b><span>Жаңа хабарламалар осында шығады.</span></div>`;
  $('#bellDot').style.display = NT.some(n => n.u) ? '' : 'none';
}
function notify(i, t, p) { NT.unshift({ i, t, p, w: 'қазір', u: 1 }); renderNt(); }
const bell = $('#bell'), pop = $('#notif');
function togglePop(open) {
  open = open ?? !pop.classList.contains('open');
  pop.classList.toggle('open', open); bell.setAttribute('aria-expanded', open);
  if (open) { setTimeout(() => { NT.forEach(n => n.u = 0); $('#bellDot').style.display = 'none'; $$('.nt.unread').forEach(e => e.classList.remove('unread')); }, 1200); }
}
bell.addEventListener('click', e => { e.stopPropagation(); togglePop(); });
pop.addEventListener('click', e => e.stopPropagation());
document.addEventListener('click', () => togglePop(false));
$('#clearNt').addEventListener('click', () => { NT = []; renderNt(); });
renderNt();

/* ---------- dialogs ---------- */
function openDlg(d) { if (!d.open) { d.showModal(); document.documentElement.classList.add('lock'); } }
$$('dialog').forEach(d => d.addEventListener('close', () => { if (!$$('dialog[open]').length) document.documentElement.classList.remove('lock'); }));
function modal(html) {
  const m = $('#mdl'); m.innerHTML = `<button class="icon-btn x" aria-label="Жабу" data-close>✕</button>${html}`;
  openDlg($('#modal')); $('[data-close]', m).focus();
}
$('#modal').addEventListener('click', e => { if (e.target.id === 'modal' || e.target.closest('[data-close]')) $('#modal').close(); });
$('#cmd').addEventListener('click', e => { if (e.target.id === 'cmd') $('#cmd').close(); });

/* ---------- loader, nav, cursor ---------- */
const profileKey = 'profile';
setTimeout(() => {
  $('#loader').classList.add('done');
  if (!store.get(profileKey) && !store.get('skipped')) setTimeout(() => openOb(), 450);
}, RM ? 100 : 1300);

if (FINE) {
  const c = $('#cursor'); document.documentElement.classList.add('has-cursor');
  addEventListener('pointermove', e => {
    c.style.left = e.clientX + 'px'; c.style.top = e.clientY + 'px'; c.classList.add('on');
    c.classList.toggle('hov', !!e.target.closest('a,button,[role=button],input,select,label,.chip,.zone,.opt,.wr,.hc,.bdg,.ci'));
  }, { passive: true });
  addEventListener('pointerdown', () => c.classList.add('dn')); addEventListener('pointerup', () => c.classList.remove('dn'));
  document.addEventListener('pointerleave', () => c.classList.remove('on'));
  $$('[data-magnetic]').forEach(b => {
    b.addEventListener('pointermove', e => { const r = b.getBoundingClientRect(); b.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * .22}px,${(e.clientY - r.top - r.height / 2) * .32 - 2}px)`; });
    b.addEventListener('pointerleave', () => { b.style.transform = ''; });
  });
}
$('#kbdHint').textContent = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? '⌘ K' : 'Ctrl K';

/* ---------- scroll loop: nav, parallax, story, scrollspy ---------- */
const hero = $('#top'), layers = $$('[data-depth]', hero), story = $('#story');
const secMap = { top: ['', 'top'], story: ['story', 'top'], today: ['story', 'top'], coach: ['coach', 'top'], workouts: ['workouts', 'workouts'], body: ['workouts', 'workouts'], nutrition: ['nutrition', 'nutrition'], calc: ['nutrition', 'nutrition'], recovery: ['progress', 'progress'], habits: ['progress', 'progress'], progress: ['progress', 'progress'], pillars: ['', 'progress'], final: ['', ''] };
const secEls = Object.keys(secMap).map(id => $('#' + id));
const navLinks = $$('#navlinks a'), ind = $('#navind'), docks = $$('.dock [data-dock]');
let lastScene = -1, raf = 0;
function setInd(a) {
  if (!a) { ind.style.opacity = 0; return; }
  ind.style.opacity = 1; ind.style.width = (a.offsetWidth - 28) + 'px'; ind.style.transform = `translateX(${a.offsetLeft + 14}px)`;
}
function frame() {
  raf = 0;
  const y = scrollY, vh = innerHeight;
  $('#nav').classList.toggle('stuck', y > 20);
  // parallax (mouse lerp + scroll)
  M.cx += (M.x - M.cx) * .07; M.cy += (M.y - M.cy) * .07;
  if (y < vh * 1.3 && !RM) {
    layers.forEach(l => {
      const d = +l.dataset.depth;
      l.style.transform = `translate3d(${(-M.cx * d).toFixed(2)}px,${(-M.cy * d * .7 + y * d * .006 * -1).toFixed(2)}px,0)`;
    });
  }
  // story scenes
  const r = story.getBoundingClientRect(), total = story.offsetHeight - vh;
  const p = clamp(-r.top / total, 0, .999), sc = Math.floor(p * 4);
  if (sc !== lastScene) {
    lastScene = sc; story.dataset.scene = sc;
    if (sc === 3) countTo($('#storyNum'), 87, 1600); else { cancelCount($('#storyNum')); $('#storyNum').textContent = sc === 2 ? '0' : '0'; }
  }
  // scrollspy
  let cur = 'top';
  secEls.forEach(s => { if (s && s.getBoundingClientRect().top < vh * .45) cur = s.id; });
  const [n, d] = secMap[cur];
  navLinks.forEach(a => a.classList.toggle('on', a.dataset.nav === n));
  setInd(navLinks.find(a => a.dataset.nav === n));
  docks.forEach(a => a.classList.toggle('on', a.dataset.dock === d));
  if (Math.abs(M.x - M.cx) > .002 || Math.abs(M.y - M.cy) > .002) schedule();
}
function schedule() { if (!raf) raf = requestAnimationFrame(frame); }
addEventListener('scroll', schedule, { passive: true });
addEventListener('resize', schedule);
addEventListener('pointermove', e => { M.x = e.clientX / innerWidth * 2 - 1; M.y = e.clientY / innerHeight * 2 - 1; schedule(); }, { passive: true });
schedule();

/* ---------- reveal, counters, gauges ---------- */
const counters = new WeakMap();
function setNum(el, v, fmt) {
  const t = [...el.childNodes].find(n => n.nodeType === 3);
  const s = fmt === 'n' ? fmtN(v) : String(Math.round(v));
  if (t) t.nodeValue = s; else el.textContent = s;
}
function cancelCount(el) { const c = counters.get(el); if (c) cancelAnimationFrame(c); }
function countTo(el, to, dur = 1500, from = 0) {
  cancelCount(el);
  const fmt = el.dataset.fmt;
  if (RM) return setNum(el, to, fmt);
  const t0 = performance.now();
  const step = t => {
    const k = clamp((t - t0) / dur, 0, 1), e = 1 - Math.pow(1 - k, 4);
    setNum(el, from + (to - from) * e, fmt);
    if (k < 1) counters.set(el, requestAnimationFrame(step));
  };
  counters.set(el, requestAnimationFrame(step));
}
const io = new IntersectionObserver(es => es.forEach(e => {
  if (!e.isIntersecting) return;
  const el = e.target; io.unobserve(el);
  if (el.classList.contains('rv')) el.classList.add('in');
  if (el.dataset.count !== undefined) countTo(el, +el.dataset.count, 1700);
  if (el.dataset.gv !== undefined) el.style.strokeDashoffset = 100 - el.dataset.gv;
}), { threshold: .18, rootMargin: '0px 0px -6% 0px' });
$$('.rv,[data-count],[data-gv]').forEach(el => io.observe(el));
const finalIO = new IntersectionObserver(es => es.forEach(e => e.isIntersecting && e.target.classList.add('in')), { threshold: .3 });
finalIO.observe($('#final'));

/* ---------- hero: live dashboard ---------- */
let steps = 8421;
setInterval(() => {
  if (document.hidden) return;
  $('#hrV').textContent = 70 + Math.round(Math.random() * 5);
  if (Math.random() > .6) { steps += 1 + Math.round(Math.random() * 3); $('#stepV').textContent = fmtN(steps); }
}, 1500);

/* ---------- DENSAM core (canvas pseudo-3D, no libraries) ---------- */
(function core() {
  const cv = $('#core'); if (!cv) return; const ctx = cv.getContext('2d'); if (!ctx) return;
  const light = innerWidth < 768 || RM || (navigator.hardwareConcurrency || 4) <= 2 || (navigator.deviceMemory && navigator.deviceMemory <= 2);
  const dpr = Math.min(devicePixelRatio || 1, 2), S = Math.round(560 * dpr); cv.width = cv.height = S;
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const P = [], E = [];
  const K = 96;
  for (let i = 0; i < K; i++) { const t = i / K * Math.PI * 2; const r = 2 + Math.cos(3 * t); P.push([r * Math.cos(2 * t) * .62, r * Math.sin(2 * t) * .62, Math.sin(3 * t) * .9, 0]); }
  for (let i = 0; i < K; i++) E.push([i, (i + 1) % K]);
  for (let i = 0; i < 46; i++) { const u = rnd() * 2 - 1, th = rnd() * 6.283, rr = Math.cbrt(rnd()) * 1.5; const s = Math.sqrt(1 - u * u); P.push([rr * s * Math.cos(th), rr * s * Math.sin(th), rr * u, 1]); }
  for (let a = K; a < P.length; a++) for (let b = 0; b < P.length; b++) {
    if (a === b) continue; const d = Math.hypot(P[a][0] - P[b][0], P[a][1] - P[b][1], P[a][2] - P[b][2]); if (d < .85 && (b < K ? a % 2 === 0 : b > a)) E.push([a, b]);
  }
  const RING = 120;
  function draw(t) {
    const c = S / 2, sc = S * .165;
    ctx.clearRect(0, 0, S, S);
    const ph = (t % .83) / .83, beat = Math.exp(-Math.pow((ph - .08) * 12, 2)) + .55 * Math.exp(-Math.pow((ph - .27) * 11, 2));
    const g = ctx.createRadialGradient(c, c, 0, c, c, S * (.2 + beat * .05));
    g.addColorStop(0, `rgba(214,255,138,${.55 + beat * .4})`); g.addColorStop(.35, `rgba(183,255,60,${.22 + beat * .15})`); g.addColorStop(1, 'rgba(183,255,60,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
    const ry = t * .28 + M.cx * .9, rx = .45 + M.cy * .5 + Math.sin(t * .2) * .1, cy = Math.cos(ry), sy = Math.sin(ry), cx = Math.cos(rx), sx = Math.sin(rx);
    const pr = P.map(p => { let x = p[0] * cy + p[2] * sy, z = -p[0] * sy + p[2] * cy, y = p[1] * cx - z * sx; z = p[1] * sx + z * cx; const f = 4.2 / (4.2 + z); return [c + x * sc * f * 1.25, c + y * sc * f * 1.25, z, f]; });
    ctx.lineWidth = Math.max(1, dpr * .8); ctx.lineCap = 'round';
    for (const [a, b] of E) { const A = pr[a], B = pr[b], dz = (A[2] + B[2]) / 2, al = clamp(.5 - dz * .22, .06, .7); ctx.strokeStyle = `rgba(183,255,60,${al * (a < K && b < K ? .85 : .45)})`; ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); ctx.stroke(); }
    for (let i = 0; i < pr.length; i++) { const p = pr[i], al = clamp(.65 - p[2] * .2, .15, 1); ctx.fillStyle = i < K ? `rgba(230,255,170,${al})` : `rgba(183,255,60,${al * .7})`; ctx.beginPath(); ctx.arc(p[0], p[1], (i < K ? 2.2 : 1.7) * dpr * p[3], 0, 6.283); ctx.fill(); }
    // heartbeat ring
    ctx.beginPath();
    for (let i = 0; i <= RING; i++) {
      const a = i / RING * 6.283, q = (i / RING + t * .08) % 1, spike = Math.exp(-Math.pow((q - .5) * 40, 2)) * Math.sin(q * 140) * .22 * (.6 + beat);
      const rr = 1.95 + spike; let x = Math.cos(a) * rr, z = Math.sin(a) * rr, y = 0;
      const x1 = x * cy + z * sy, z1 = -x * sy + z * cy, y1 = y * cx - z1 * sx, z2 = y * sx + z1 * cx, f = 4.2 / (4.2 + z2);
      const X = c + x1 * sc * f * 1.25, Y = c + y1 * sc * f * 1.25; i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y);
    }
    ctx.strokeStyle = 'rgba(183,255,60,.5)'; ctx.lineWidth = dpr * 1.3; ctx.shadowColor = '#B7FF3C'; ctx.shadowBlur = 10 * dpr; ctx.stroke(); ctx.shadowBlur = 0;
  }
  if (light) { draw(1.2); return; }
  let run = true, last = performance.now(), T = 0;
  new IntersectionObserver(e => { run = e[0].isIntersecting; if (run) { last = performance.now(); loop(); } }).observe(cv);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && run) { last = performance.now(); loop(); } });
  let looping = false;
  function loop() { if (looping) return; looping = true; const f = now => { if (!run || document.hidden) { looping = false; return; } T += (now - last) / 1000; last = now; draw(T); requestAnimationFrame(f); }; requestAnimationFrame(f); }
  loop();
})();

/* ---------- onboarding + personal plan ---------- */
const OB = [
  { k: 'goal', q: 'Сенің мақсатың қандай?', o: ['Денені қалыпқа келтіру', 'Бұлшықет жинау', 'Арықтау', 'Күшті болу', 'Энергияны арттыру', 'Денсаулықты жақсарту'], c: '' },
  { k: 'days', q: 'Аптасына қанша күн жаттығасың?', o: ['2', '3', '4', '5', '6+'], c: 'n5' },
  { k: 'place', q: 'Қай жерде жаттығасың?', o: ['Үйде', 'Залда', 'Сыртта', 'Аралас'], c: 'n4' },
  { k: 'level', q: 'Деңгейің?', o: ['Beginner', 'Intermediate', 'Advanced'], c: 'n3' }
];
const SESS = { 'Денені қалыпқа келтіру': 'Full Body Reset', 'Бұлшықет жинау': 'Hypertrophy Split', 'Арықтау': 'Fat Burn · HIIT + Strength', 'Күшті болу': 'Strength Base', 'Энергияны арттыру': 'Energy Flow', 'Денсаулықты жақсарту': 'Daily Health Base' };
const DAYS = { 2: [1, 4], 3: [0, 2, 4], 4: [0, 1, 3, 4], 5: [0, 1, 2, 4, 5], 6: [0, 1, 2, 3, 4, 5] };
let obI = 0, obA = {}, obDone = false;
const ob = $('#ob');
function openOb() { obI = 0; obA = {}; obDone = false; renderOb(); openDlg(ob); }
function renderOb() {
  const body = $('#obBody'), s = OB[obI];
  $('#obBack').style.visibility = obI > 0 && !obDone ? 'visible' : 'hidden';
  if (!s) return;
  $('#obStep').textContent = `0${obI + 1} / 04`; $('#obProg').style.setProperty('--p0', (obI + 1) / 5);
  body.innerHTML = `<span class="meta"><b>DENSAM</b> — Сұрақ 0${obI + 1}</span><h2 id="obQ">${s.q}</h2><div class="ob__opts ${s.c}" role="radiogroup" aria-label="${s.q}">${s.o.map((o, i) => `<button class="opt" role="radio" aria-checked="${obA[s.k] === o}" style="--i:${i}" data-v="${esc(o)}"><span class="meta">0${i + 1}</span><strong>${esc(o)}</strong></button>`).join('')}</div>`;
  $('.opt', body).focus({ preventScroll: true });
}
$('#obBody').addEventListener('click', e => {
  const b = e.target.closest('.opt'); if (!b) return;
  const s = OB[obI]; obA[s.k] = b.dataset.v; $$('.opt', b.parentNode).forEach(x => x.setAttribute('aria-checked', x === b));
  setTimeout(() => { obI++; obI < OB.length ? renderOb() : finishOb(); }, RM ? 0 : 380);
});
$('#obBack').addEventListener('click', () => { if (obI > 0) { obI--; renderOb(); } });
$('#obSkip').addEventListener('click', () => { store.set('skipped', 1); ob.close(); });
ob.addEventListener('cancel', () => store.set('skipped', 1));
async function finishOb() {
  obDone = true; $('#obBack').style.visibility = 'hidden'; $('#obStep').textContent = '04 / 04'; $('#obProg').style.setProperty('--p0', 1);
  $('#obBody').innerHTML = `<div class="ob__gen" role="status"><span class="meta"><b>AI</b> · жоспар құрылуда</span><svg viewBox="0 0 240 28" aria-hidden="true"><path d="M0 14h58l8-11 10 22 9-17 7 6h36l8-9 9 19 8-10h87"/></svg><span class="mut">Мақсатың, деңгейің және уақытыңа сай бейімдеп жатырмыз…</span></div>`;
  await wait(1700);
  store.set(profileKey, obA); store.del('skipped');
  $('#obBody').innerHTML = `<div class="ob__res"><span class="meta"><b>Done</b></span><h2 id="obQ" style="margin:0">Сенің жоспарың дайын.</h2><div class="chips">${Object.values(obA).map(v => `<span class="chip">${esc(v)}</span>`).join('')}</div><p class="mut" style="max-width:48ch">Персональды dashboard, апталық кесте және AI Coach енді сенің мақсатыңа бейімделді.</p><button class="btn btn--p" id="obGo">Dashboard-қа өту <span class="ar">→</span></button></div>`;
  $('#obGo').focus();
  $('#obGo').addEventListener('click', () => { ob.close(); renderPlan(true); go('#today'); notify('🎯', 'Жоспар дайын', `${SESS[obA.goal]} — аптасына ${obA.days} күн.`); });
}
function renderPlan(skel) {
  const el = $('#plan'), pr = store.get(profileKey);
  if (!pr) {
    el.innerHTML = `<div class="plan__l"><span class="meta"><b>Жеке жоспар</b></span><h3>Алғашқы қадамыңды жаса.</h3><p class="mut" style="max-width:36ch">4 сұраққа жауап бер — DENSAM жеке жоспар мен dashboard құрады.</p></div><div class="plan__r" style="align-self:end"><button class="btn btn--p" data-open-ob data-magnetic>Жоспар құру <span class="ar">→</span></button></div>`;
  } else {
    const n = pr.days === '6+' ? 6 : +pr.days, sel = DAYS[n] || DAYS[3], today = (new Date().getDay() + 6) % 7, nm = ['ДС', 'СС', 'СР', 'БС', 'ЖМ', 'СБ', 'ЖК'];
    el.innerHTML = `<div class="plan__l"><span class="meta"><b>Сенің жоспарың</b> · ${esc(pr.goal)}</span><h3>${SESS[pr.goal] || 'Full Body'}</h3><p class="mut" style="max-width:38ch">Аптасына ${n} жаттығу · ${esc(pr.place).toLowerCase()} · ${esc(pr.level)}. Қалған күндері — recovery және жеңіл қозғалыс.</p><button class="btn btn--g btn--s" data-open-ob style="margin-top:20px">Жоспарды өзгерту</button></div>
    <div class="plan__r"><div class="plan__facts">${[pr.goal, n + ' күн / апта', pr.place, pr.level].map(v => `<span class="chip">${esc(v)}</span>`).join('')}</div><div class="week" role="list" aria-label="Апталық кесте">${nm.map((d, i) => `<div role="listitem" class="${sel.includes(i) ? 'w' : ''} ${i === today ? 't' : ''}" aria-label="${d}: ${sel.includes(i) ? 'жаттығу' : 'recovery'}">${d}<i></i></div>`).join('')}</div></div>`;
  }
  el.classList.add('in');
  if (skel) { el.classList.add('sk'); setTimeout(() => el.classList.remove('sk'), RM ? 0 : 900); }
}
renderPlan();
document.addEventListener('click', e => {
  if (e.target.closest('[data-open-ob]')) openOb();
  const g = e.target.closest('[data-goto]'); if (g) go('#' + g.dataset.goto);
  if (e.target.closest('[data-faq]')) { e.preventDefault(); faq(); }
});

/* ---------- AI Coach ---------- */
const log = $('#chatLog'), cin = $('#chatIn'), orb = $('#orb');
let busy = false;
const SUG = ['Мен 3 айда формама келгім келеді.', 'Бүгін не жеймін?', 'Менде тек жұмыртқа мен күріш бар.', 'Кеше аяқ жаттығуы ауыр болды.', 'Ұйқымды қалай жақсартамын?'];
$('#chatSug').innerHTML = SUG.map(s => `<button class="chip" type="button">${esc(s)}</button>`).join('');
const dishHTML = d => `<div class="mini"><b>${d.n}</b><div class="m"><span>kcal <b>${d.k}</b></span><span>Protein <b>${d.p}g</b></span><span>Carbs <b>${d.c}g</b></span><span>Fat <b>${d.f}g</b></span></div></div>`;
const DISH = {
  oat: { n: 'Protein Oat Bowl', k: 420, p: 28, c: 52, f: 12 },
  egg: { n: 'Жұмыртқалы күріш боулы', k: 480, p: 24, c: 62, f: 14 }
};
function reply(q) {
  const pr = store.get(profileKey);
  if (/ауырсын|жарақат|жүрек|қысым|диабет|ауру|науқас|жүкті|басым айналады|естен/i.test(q)) return ['Мен дәрігер емеспін, сондықтан диагноз қоя алмаймын.', '<ul><li>Ауырсыну, бас айналу немесе жүрек тұсындағы жайсыздық болса — жаттығуды тоқтат.</li><li>Маманға (дәрігерге) көріну — ең дұрыс қадам.</li></ul>'];
  if (/жұмыртқа|күріш/i.test(q)) return ['Жақсы таңдау: екеуі де қолжетімді және протеин мен энергияға бай. Мынадай нұсқа ұсынамын:', dishHTML(DISH.egg) + '<a class="lnk" href="#nutrition" data-recipe="egg">Рецептті көру →</a>'];
  if (/не жей|тамақ|мәзір|калория|ас\b/i.test(q)) return ['Бүгінгі протеин мақсатыңа 26 г қалды. Таңғы асқа мынау жарасады:', dishHTML(DISH.oat) + '<a class="lnk" href="#nutrition" data-recipe="oat">Рецептті көру →</a>'];
  if (/ұйқы|ұйықта|ұйқым/i.test(q)) return ['Ұйқың жақсы — 7h 42m. Тұрақтандыру үшін:', '<ul><li>Бір уақытта жат (±30 мин).</li><li>Жатар алдында 60 минут экраннан алыс бол.</li><li>Кофеинді 14:00-ден кейін шектеу.</li></ul>'];
  if (/ауыр|шаршады|шаршап|аяқ/i.test(q)) return ['Түсіндім. Кеше аяқ жаттығуы ауыр болса, бүгін lower body intensity -15% болады.', '<div class="mini"><b>Бейімделген жоспар</b><div class="m"><span>Lower body <b>−15%</b></span><span>Upper body <b>100%</b></span></div></div><a class="lnk" href="#adaptive" data-go="#adaptive">Неліктен? →</a>'];
  if (/3 ай|форма|арық|бұлшықет|салмақ|мақсат/i.test(q)) return ['Керемет. Алдымен сенің қазіргі деңгейіңді анықтайық.', `<ul><li>Белсенділік: <b>92</b> · Ұйқы: <b>7h 42m</b> · Recovery: <b>87%</b></li><li>Streak: <b>12 күн</b> — тұрақтылығың жақсы.</li></ul><div class="mini"><b>3 айлық жоспар${pr ? ' · ' + esc(pr.goal) : ''}</b><div class="m"><span>1–4 апта <b>база</b></span><span>5–8 <b>күш + көлем</b></span><span>9–12 <b>деңгей ↑</b></span></div></div>`];
  if (/су\b|water|сусын/i.test(q)) return ['Күніне шамамен 30–35 мл/кг су — жақсы бағдар. Қазір 1.8 L / 2.5 L.', '<a class="lnk" href="#habits" data-go="#habits">Суды белгілеу →</a>'];
  if (/жаттығ|тренир/i.test(q)) return ['Recovery 87% — бүгін күш жаттығуына қолайлы күн.', '<div class="mini"><b>Full Body</b><div class="m"><span>35 <b>min</b></span><span>Intermediate</span><span><b>310</b> kcal</span></div></div><a class="lnk" href="#workouts" data-go="#workouts">Жаттығуды бастау →</a>'];
  return ['Түсіндім. Мен белсенділігіңді, ұйқыңды, жаттығуларыңды, recovery мен әдеттеріңді қарап ұсыныс беремін.', '<ul><li>Мақсатыңды нақтыла: «арықтау», «бұлшықет жинау» немесе «энергия».</li><li>Не жейтініңді не жаттығуды сұра.</li></ul>'];
}
function addMsg(cls, html, text) { const d = document.createElement('div'); d.className = 'msg ' + cls; if (text != null) d.textContent = text; else d.innerHTML = html; log.appendChild(d); log.scrollTop = log.scrollHeight; return d; }
async function ask(q) {
  if (busy) return;
  q = q.trim();
  if (!q) { cin.classList.add('err'); toast('Хабарлама жаз.', true); setTimeout(() => cin.classList.remove('err'), 500); return; }
  busy = true; addMsg('u', '', q); cin.value = '';
  const m = addMsg('a', '<span class="typing" aria-label="AI жазып жатыр"><i></i><i></i><i></i></span>');
  orb.classList.add('think'); $('#coachSt').textContent = '● талдап жатыр…';
  await wait(1100 + Math.random() * 500);
  if (!navigator.onLine) { m.innerHTML = 'Бір нәрсе дұрыс болмады. Интернетті тексеріп, қайта көр.'; toast('Қосылу қатесі', true); }
  else {
    const [t, extra] = reply(q); m.innerHTML = '<span class="t"></span><div class="x"></div>';
    const tt = $('.t', m), words = t.split(' ');
    for (const w of words) { tt.textContent += (tt.textContent ? ' ' : '') + w; log.scrollTop = log.scrollHeight; if (!RM) await wait(32); }
    if (extra) { $('.x', m).innerHTML = extra; log.scrollTop = log.scrollHeight; }
  }
  orb.classList.remove('think'); $('#coachSt').textContent = '● онлайн'; busy = false;
}
$('#chatForm').addEventListener('submit', e => { e.preventDefault(); ask(cin.value); });
$('#chatSug').addEventListener('click', e => { const b = e.target.closest('.chip'); if (b) ask(b.textContent); });
log.addEventListener('click', e => {
  const r = e.target.closest('[data-recipe]'); if (r) { e.preventDefault(); recipe(r.dataset.recipe); }
  const g = e.target.closest('[data-go]'); if (g) { e.preventDefault(); go(g.dataset.go); }
});
new IntersectionObserver((es, o) => { if (es[0].isIntersecting) { o.disconnect(); setTimeout(() => ask('Мен 3 айда формама келгім келеді.'), 500); } }, { threshold: .4 }).observe($('.chat'));

/* ---------- Workouts + player + adaptive ---------- */
const WO = [
  { id: 'full', c: 'strength', n: 'Full Body', m: 35, l: 'Intermediate', k: 310 }, { id: 'push', c: 'strength', n: 'Upper Push', m: 40, l: 'Advanced', k: 340 }, { id: 'pull', c: 'strength', n: 'Back & Biceps', m: 40, l: 'Intermediate', k: 330 },
  { id: 'zone2', c: 'cardio', n: 'Zone 2 Run', m: 45, l: 'Beginner', k: 420 }, { id: 'tempo', c: 'cardio', n: 'Tempo Intervals', m: 30, l: 'Intermediate', k: 380 },
  { id: 'tabata', c: 'hiit', n: 'Tabata 20', m: 20, l: 'Advanced', k: 290 }, { id: 'burn', c: 'hiit', n: 'Burn Ladder', m: 25, l: 'Intermediate', k: 330 },
  { id: 'flow', c: 'yoga', n: 'Morning Flow', m: 30, l: 'Beginner', k: 120 }, { id: 'power', c: 'yoga', n: 'Power Yoga', m: 40, l: 'Intermediate', k: 210 },
  { id: 'hip', c: 'mobility', n: 'Hip & Spine Reset', m: 15, l: 'Beginner', k: 60 }, { id: 'desk', c: 'mobility', n: 'Desk Release', m: 10, l: 'Beginner', k: 40 },
  { id: 'home', c: 'home', n: 'No Equipment 30', m: 30, l: 'Beginner', k: 260 }, { id: 'bw', c: 'home', n: 'Bodyweight Strength', m: 35, l: 'Intermediate', k: 300 }
];
const CATS = [['strength', 'Strength'], ['cardio', 'Cardio'], ['hiit', 'HIIT'], ['yoga', 'Yoga'], ['mobility', 'Mobility'], ['home', 'Home Workout']];
const EX = [['Squat', 45], ['Push-up', 40], ['Bent-over Row', 45], ['Lunge', 45], ['Plank', 60], ['Deadlift', 45], ['Burpee', 30]];
let cat = 'strength', cur = WO[0];
const P = { dur: 2100, t: 763, play: false, timer: null };
function renderWo() {
  $('#woTabs').innerHTML = CATS.map(([k, n]) => `<button class="chip" role="tab" aria-selected="${k === cat}" data-cat="${k}">${n}</button>`).join('');
  const list = WO.filter(w => w.c === cat);
  $('#woList').innerHTML = list.map((w, i) => `<button class="wr" role="listitem" aria-pressed="${w.id === cur.id}" data-id="${w.id}"><span class="no">0${i + 1}</span><span><b>${w.n}</b><small>${w.l}</small></span><em>${w.m} MIN</em></button>`).join('');
  $('#woCat').innerHTML = `<b>${CATS.find(c => c[0] === cur.c)[1]}</b> · Smart Workout`;
  $('#woName').textContent = cur.n.toUpperCase(); $('#woDur').textContent = cur.m + ' MIN'; $('#woLvl').textContent = cur.l; $('#woKcal').textContent = cur.k + ' kcal';
}
function pickWo(id, scroll) {
  const w = WO.find(x => x.id === id); if (!w) return; cur = w; cat = w.c; renderWo();
  pause(); P.dur = w.m * 60; P.t = w.id === 'full' ? 763 : 0; drawPlayer(true); $('#pvName').textContent = w.n;
  if (scroll) go('#workouts');
}
$('#woTabs').addEventListener('click', e => { const b = e.target.closest('[data-cat]'); if (!b) return; cat = b.dataset.cat; if (cur.c !== cat) cur = WO.find(w => w.c === cat); pickWo(cur.id); });
$('#woList').addEventListener('click', e => { const b = e.target.closest('[data-id]'); if (b) pickWo(b.dataset.id); });
function seg() { return P.dur / EX.length; }
function drawPlayer(rebuild) {
  const i = Math.min(EX.length - 1, Math.floor(P.t / seg()));
  $('#seek').max = P.dur; $('#seek').value = P.t; $('#seekF').style.width = (P.t / P.dur * 100) + '%';
  $('#pvTime').textContent = `${mm(P.t)} / ${mm(P.dur)}`; $('#pvEx').textContent = EX[i][0];
  const nx = EX[i + 1]; $('#nxName').textContent = nx ? `${nx[0]} — ${nx[1]} sec` : 'Cool-down — 60 sec';
  if (rebuild) $('#seekM').innerHTML = EX.slice(1).map((_, k) => `<i class="seek__m" style="left:${(k + 1) / EX.length * 100}%"></i>`).join('');
  $('#queue').innerHTML = EX.map((e, k) => `<div class="${k < i ? 'done' : k === i ? 'cur' : ''}"><span>${e[0]}</span><span>${e[1]} sec</span></div>`).join('');
  $('#pv').classList.toggle('play', P.play); $('#pvLive').textContent = P.play ? 'Live' : 'Pause'; $('#pvLive').classList.toggle('live', P.play);
  $('#playIc').setAttribute('d', P.play ? 'M7 5h4v14H7zM13 5h4v14h-4z' : 'M8 5v14l11-7z'); $('#playBtn').setAttribute('aria-label', P.play ? 'Тоқтату' : 'Ойнату');
  $('#pvHr').textContent = `❤ ${P.play ? 126 + Math.round(Math.sin(P.t / 7) * 8 + 6) : 96} BPM`;
}
function play() { if (P.t >= P.dur) P.t = 0; P.play = true; clearInterval(P.timer); P.timer = setInterval(() => { P.t = Math.min(P.dur, P.t + 1); if (P.t >= P.dur) done(); drawPlayer(); }, 1000); drawPlayer(); }
function pause() { P.play = false; clearInterval(P.timer); drawPlayer(); }
function done() {
  pause(); notify('💪', 'Workout complete', `${cur.m} минут. Керемет жұмыс.`); toast('💪 Жаттығу аяқталды. Керемет жұмыс!');
  ach.w10 = Math.min(10, (ach.w10 || 7) + 1); unlock('first'); saveAch(); renderAch();
}
$('#playBtn').addEventListener('click', () => P.play ? pause() : play());
$('#back10').addEventListener('click', () => { P.t = Math.max(0, P.t - 10); drawPlayer(); });
$('#fwd10').addEventListener('click', () => { P.t = Math.min(P.dur, P.t + 10); if (P.t >= P.dur) done(); drawPlayer(); });
$('#nextBtn').addEventListener('click', () => { const i = Math.floor(P.t / seg()); P.t = Math.min(P.dur, (i + 1) * seg()); if (P.t >= P.dur) done(); drawPlayer(); });
$('#seek').addEventListener('input', e => { P.t = +e.target.value; drawPlayer(); });
$('#woStart').addEventListener('click', () => { if (P.dur !== cur.m * 60) pickWo(cur.id); go('#player'); setTimeout(play, RM ? 0 : 500); });
$('[data-start-wo]').addEventListener('click', () => setTimeout(() => { go('#player'); play(); }, 50));
renderWo(); drawPlayer(true);
document.addEventListener('keydown', e => { if (e.code === 'Space' && e.target.closest('#pv') && !e.target.closest('button,input')) { e.preventDefault(); P.play ? pause() : play(); } });

const ld = $('#load');
function adapt() {
  const v = +ld.value, cut = v >= 9 ? 20 : v === 8 ? 15 : v === 7 ? 8 : 0;
  ld.style.setProperty('--v', (v - 1) / 9 * 100 + '%'); $('#loadV').textContent = `${v} / 10`;
  $('#adD').textContent = cut ? `−${cut}%` : '0%'; $('#adD').style.color = cut ? '' : 'var(--muted)';
  $('#adBar').style.setProperty('--w', 100 - cut + '%'); $('#adB').textContent = 100 - cut + '%';
  $('#adH').textContent = v >= 7 ? 'Кеше аяқ жаттығуы ауыр болды.' : 'Кешегі жаттығу жеңіл өтті.';
  $('#adSub').textContent = cut ? 'Сондықтан бүгінгі жоспар автоматты түрде бейімделді.' : 'Жоспар өзгеріссіз қалады.';
  $('#adWhy').textContent = cut ? 'Recovery score төмен болғандықтан. Аяқ бұлшықетінің қалпына келуі 64%.' : 'Аяқ бұлшықетінің recovery деңгейі жеткілікті — толық жүктеме.';
}
ld.addEventListener('input', adapt); adapt();

/* ---------- Body ---------- */
const Z = {
  chest: ['Кеуде', 12, [4, 5, 3], [['Knee Push-up', 'Incline Push-up'], ['Push-up', 'Dumbbell Press'], ['Weighted Push-up', 'Bench Press']]],
  back: ['Арқа', 14, [4, 6, 4], [['Superman', 'Band Row'], ['Dumbbell Row', 'Lat Pulldown'], ['Pull-up', 'Barbell Row']]],
  leg: ['Аяқ', 18, [6, 7, 5], [['Bodyweight Squat', 'Glute Bridge'], ['Goblet Squat', 'Lunge'], ['Back Squat', 'Deadlift']]],
  shoulder: ['Иық', 10, [3, 4, 3], [['Arm Circles', 'Pike Hold'], ['Overhead Press', 'Lateral Raise'], ['Handstand Hold', 'Push Press']]],
  abs: ['Пресс', 16, [6, 6, 4], [['Dead Bug', 'Plank'], ['Leg Raise', 'Russian Twist'], ['Hanging Knee Raise', 'Ab Wheel']]],
  arm: ['Қол', 15, [5, 6, 4], [['Band Curl', 'Bench Dip'], ['Hammer Curl', 'Triceps Extension'], ['Chin-up', 'Close-grip Push-up']]]
};
let zk = 'chest'; const bs = $('#bodySvg');
$('#zones').innerHTML = Object.entries(Z).map(([k, v]) => `<button class="chip" role="tab" data-z="${k}" aria-selected="${k === zk}">${v[0]}</button>`).join('');
function setZone(k, fromSvg) {
  zk = k; const z = Z[k];
  $$('.zone', bs).forEach(e => e.classList.toggle('on', e.dataset.zone === k));
  $$('#zones .chip').forEach(c => c.setAttribute('aria-selected', c.dataset.z === k));
  const back = k === 'back'; if (back || (bs.dataset.side === 'back' && ['chest', 'abs'].includes(k))) setSide(back ? 'back' : 'front');
  $('#zName').textContent = z[0]; countTo($('#zCnt'), z[1], 600); $('#zBar').innerHTML = z[2].map(n => `<i style="flex:${n}"></i>`).join('');
}
function setSide(s) { bs.dataset.side = s; $('#flipBody').setAttribute('aria-pressed', s === 'back'); $('#flipBody').textContent = s === 'back' ? '↺ Алдыңғы жағы' : '↺ Артқы жағы'; }
$('#flipBody').addEventListener('click', () => { setSide(bs.dataset.side === 'back' ? 'front' : 'back'); });
bs.addEventListener('click', e => { const z = e.target.closest('.zone'); if (z) setZone(z.dataset.zone, true); });
bs.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('zone')) { e.preventDefault(); setZone(e.target.dataset.zone); } });
$('#zones').addEventListener('click', e => { const c = e.target.closest('[data-z]'); if (c) setZone(c.dataset.z); });
$('#zGo').addEventListener('click', () => { const z = Z[zk]; modal(`<span class="meta"><b>${z[1]} жаттығу</b></span><h3>${z[0]}</h3>${['Beginner', 'Intermediate', 'Advanced'].map((l, i) => `<h5>${l}</h5>${z[3][i].map(n => `<div class="lvl"><b>${n}</b><span>${z[2][i]} нұсқа</span></div>`).join('')}`).join('')}<p class="note" style="margin-top:20px">Техниканы бақылап, жеңіл жүктемеден баста. Ауырсыну болса — тоқтат.</p>`); });
setZone('chest');

/* ---------- Nutrition: AI + recipes + scan ---------- */
const REC = {
  oat: { n: 'Protein Oat Bowl', k: 420, p: 28, c: 52, f: 12, ing: ['60 г сұлы жармасы', '200 мл сүт немесе өсімдік сүті', '1 өлшем протеин (≈25 г)', '100 г жидек', '10 г жаңғақ'], st: ['Сұлыны сүтпен 4–5 минут қайнат.', 'Аздап суытып, протеин ұнтағын араластыр.', 'Жидек пен жаңғақпен безендір.'] },
  egg: { n: 'Жұмыртқалы күріш боулы', k: 480, p: 24, c: 62, f: 14, ing: ['150 г піскен күріш', '2 жұмыртқа', '1 ас қасық соя соусы', 'Қияр, жасыл пиязша', '1 шай қасық өсімдік майы'], st: ['Күрішті майда қыздыр.', 'Жұмыртқаны қосып, тез араластыр.', 'Соя соусын құй, қиярмен бірге бер.'] },
  yog: { n: 'Greek Yogurt & Berries', k: 220, p: 18, c: 24, f: 6, ing: ['200 г грек йогурты', '80 г жидек', '1 шай қасық бал'], st: ['Йогуртты кесеге сал.', 'Жидек пен балмен жаб.'] }
};
function recipe(k) {
  const r = REC[k]; modal(`<span class="meta"><b>Рецепт</b> · ${r.k} kcal</span><h3>${r.n}</h3><div class="dish__m" style="margin-bottom:8px"><div><span class="meta">Protein</span><strong>${r.p}g</strong></div><div><span class="meta">Carbs</span><strong>${r.c}g</strong></div><div><span class="meta">Fat</span><strong>${r.f}g</strong></div><div><span class="meta">kcal</span><strong>${r.k}</strong></div></div><h5>Ингредиенттер</h5><ul>${r.ing.map(i => `<li>${i}</li>`).join('')}</ul><h5>Дайындау</h5><ol>${r.st.map(i => `<li>${i}</li>`).join('')}</ol><p class="note" style="margin-top:22px">Құндылықтар шамамен берілген.</p>`);
}
$('#ainu').addEventListener('click', async e => {
  const b = e.target.closest('[data-ask]'); if (!b) return;
  $$('[data-ask]').forEach(x => x.setAttribute('aria-pressed', x === b));
  const out = $('#dishOut'); out.innerHTML = `<div class="ai-load" role="status"><span class="typing"><i></i><i></i><i></i></span><span class="meta">AI ойлануда…</span></div>`;
  await wait(1100);
  const k = b.dataset.ask === 'egg' ? 'egg' : 'oat', d = REC[k];
  out.innerHTML = `<div class="dish"><div><span class="meta"><b>${k === 'egg' ? 'Сенде бар өнімдерден' : 'Бүгінгі ұсыныс'}</b></span><h4 style="margin-top:12px">${d.n}</h4></div><div class="dish__m"><div><span class="meta">Calories</span><strong>${d.k}</strong></div><div><span class="meta">Protein</span><strong>${d.p}g</strong></div><div><span class="meta">Carbs</span><strong>${d.c}g</strong></div><div><span class="meta">Fat</span><strong>${d.f}g</strong></div></div><p class="dish__why">${k === 'egg' ? 'Жұмыртқа протеин береді, күріш — энергия. Көкөніс қоссаң, тағам теңгерімді болады.' : 'Протеин мақсатыңа 26 г қалды — бұл тағам соның басым бөлігін жабады.'}</p><div><button class="btn btn--p" data-r="${k}">Рецептті көру <span class="ar">→</span></button></div></div>`;
});
$('#dishOut').addEventListener('click', e => { const b = e.target.closest('[data-r]'); if (b) recipe(b.dataset.r); });

const SCAN = [
  { n: 'Тауық пен күріш', k: 540, p: 32, c: 61, f: 18, col: ['#ffcf6b', '#f4f0df', '#76C93A'] },
  { n: 'Лосось боул', k: 610, p: 38, c: 48, f: 28, col: ['#ff9d7a', '#e9e4cf', '#4fb84a'] },
  { n: 'Қазақы салат', k: 260, p: 12, c: 22, f: 14, col: ['#ff6b5e', '#f4f0df', '#9be05a'] }
];
let sd = 0, scanning = false;
$('#dishChips').innerHTML = SCAN.map((s, i) => `<button class="chip" aria-pressed="${i === 0}" data-sd="${i}">${s.n}</button>`).join('');
$('#dishChips').addEventListener('click', e => { const b = e.target.closest('[data-sd]'); if (!b) return; sd = +b.dataset.sd; $$('#dishChips .chip').forEach(c => c.setAttribute('aria-pressed', c === b)); const pl = $('.plate', $('#scanScr')); SCAN[sd].col.forEach((c, i) => pl.style.setProperty('--c' + (i + 1), c)); resetScan(); });
function resetScan() { ['#scanKcal', '#scP', '#scC', '#scF'].forEach(s => $(s).textContent = '···'); $('#scanSt').textContent = 'FOOD SCAN · дайын'; }
async function runScan() {
  if (scanning) return; scanning = true; $('#scanErr').textContent = '';
  const b = $('#scanBtn'); b.classList.add('loading'); $('#scanScr').classList.add('scanning'); $('#scanSt').textContent = 'Талдап жатыр…'; resetScan(); $('#scanSt').textContent = 'Талдап жатыр…';
  await wait(1900);
  const d = SCAN[sd]; $('#scanScr').classList.remove('scanning'); b.classList.remove('loading');
  $('#scanSt').textContent = `${d.n} · шамамен`; $('#scanKcal').textContent = d.k; $('#scP').textContent = d.p + 'g'; $('#scC').textContent = d.c + 'g'; $('#scF').textContent = d.f + 'g';
  b.classList.add('ok'); b.textContent = '✓ Талдау дайын'; setTimeout(() => { b.classList.remove('ok'); b.textContent = '📷 Тағамды сканерлеу'; }, 2200);
  scanning = false;
}
$('#scanBtn').addEventListener('click', runScan);
$('#scanFile').addEventListener('change', e => {
  const f = e.target.files[0]; if (!f) return; const err = $('#scanErr');
  if (!f.type.startsWith('image/')) { err.textContent = 'Бір нәрсе дұрыс болмады. Бұл файл сурет емес — JPG немесе PNG таңда.'; toast('Файл форматы қате', true); e.target.value = ''; return; }
  if (f.size > 8e6) { err.textContent = 'Сурет тым үлкен (8 МБ-тан кіші болсын).'; e.target.value = ''; return; }
  const scr = $('#scanScr'); scr.style.background = `center/cover url(${URL.createObjectURL(f)})`; $('.plate', scr).style.opacity = 0; runScan();
});
$('#scanFileL').addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('#scanFile').click(); } });

/* ---------- Calculator ---------- */
const ACT = { '1.2': 'Төмен', '1.375': 'Жеңіл', '1.55': 'Орташа', '1.725': 'Жоғары', '1.9': 'Өте жоғары' };
function calc(show) {
  const f = { age: $('#cAge'), h: $('#cH'), w: $('#cW') }, lim = { age: [12, 90, 'Жас 12–90 аралығында болсын'], h: [120, 230, 'Бой 120–230 см болсын'], w: [30, 250, 'Салмақ 30–250 кг болсын'] };
  let ok = true;
  for (const k in f) {
    const v = parseFloat(f[k].value), bad = !(v >= lim[k][0] && v <= lim[k][1]);
    if (show || f[k].getAttribute('aria-invalid') === 'true') { f[k].setAttribute('aria-invalid', bad); $('#e' + { age: 'Age', h: 'H', w: 'W' }[k]).textContent = bad ? lim[k][2] : ''; }
    if (bad) ok = false;
  }
  if (!ok) { if (show) toast('Мәндерді тексер', true); return; }
  const a = +f.age.value, h = +f.h.value, w = +f.w.value, m = $('input[name=sex]:checked').value === 'm', act = $('#cAct').value;
  const bmi = w / Math.pow(h / 100, 2), bmr = 10 * w + 6.25 * h - 5 * a + (m ? 5 : -161), kc = Math.round(bmr * +act / 10) * 10;
  const cat = bmi < 18.5 ? 'Салмақ жетіспейді' : bmi < 25 ? 'Қалыпты' : bmi < 30 ? 'Артық салмақ' : 'Семіздік белгісі';
  $('#bmiV').textContent = bmi.toFixed(1); $('#bmiCat').textContent = cat; $('#bmiS').style.setProperty('--x', clamp((bmi - 15) / 25 * 100, 2, 98) + '%');
  $('#kcalV').textContent = fmtN(kc); $('#actV').textContent = ACT[act];
  const rec = [`Күнделікті калория бағдары: ~${fmtN(kc)} kcal. Салмақ азайту үшін 10–15% тапшылық, жинау үшін 5–10% профицит жеткілікті.`, `Протеин: күніне шамамен ${Math.round(w * 1.6)}–${Math.round(w * 2)} г.`, `Су: күніне ${(w * .03).toFixed(1)}–${(w * .035).toFixed(1)} L.`, bmi >= 25 ? 'Аптасына 150+ минут орташа кардио және 2 күш жаттығуы қосу пайдалы.' : bmi < 18.5 ? 'Калорияны біртіндеп арттырып, күш жаттығуларына назар аудар.' : 'Қазіргі тепе-теңдікті сақта: күш, cardio және ұйқы.'];
  $('#recs').innerHTML = rec.map(r => `<li>${r}</li>`).join('');
}
$('#calcForm').addEventListener('submit', async e => { e.preventDefault(); const b = $('#calcBtn'); b.classList.add('loading'); await wait(500); b.classList.remove('loading'); calc(true); });
$('#calcForm').addEventListener('input', () => calc(false)); calc(false);

/* ---------- Recovery + Sleep ---------- */
function setRecovery(h) {
  const r = clamp(Math.round(2.3 + 11 * h), 30, 98), st = r >= 75 ? 0 : r >= 50 ? 1 : 2, bar = $('#rcBar');
  bar.style.strokeDashoffset = 100 - r; bar.style.stroke = ['var(--p)', 'var(--warn)', 'var(--bad)'][st];
  countTo($('#rcV'), r, 700, +$('#rcV').textContent || 0);
  $$('#rcStates .st').forEach((s, i) => s.classList.toggle('on', i === st));
  $('#rcAi').textContent = ['Бүгін жоғары интенсивті жаттығу жасауға болады.', 'Орташа жүктеме таңда: жеңіл күш немесе Zone 2 cardio.', 'Бүгін demalys: mobility, жаяу жүру және ертерек ұйқы.'][st].replace('demalys', 'демалыс');
  $('#rcSlV').textContent = h.toFixed(1) + ' сағ'; $('#rcSl').style.setProperty('--v', (h - 4) / 5 * 100 + '%');
}
$('#rcSl').addEventListener('input', e => setRecovery(+e.target.value)); $('#rcSl').style.setProperty('--v', '74%');
const SL = [['light', 20], ['deep', 38], ['light', 35], ['rem', 12], ['light', 30], ['deep', 40], ['light', 40], ['rem', 20], ['light', 45], ['deep', 30], ['light', 38], ['rem', 25], ['light', 54], ['rem', 35]];
const SLC = { deep: ['#7c8cff', 138, 'Deep'], rem: ['#b98cff', 36, 'REM'], light: ['#4a5280', 88, 'Light'] };
(function sleep() {
  const svg = $('#sleepSvg'), tot = 462, W = 560, X0 = 40; let x = X0, t = 0, h = '<g stroke="rgba(124,140,255,.12)" stroke-dasharray="2 6"><path d="M40 48h560M40 100h560M40 150h560"/></g><g font-family="JetBrains Mono,monospace" font-size="9" fill="#6a7399"><text x="2" y="30">REM</text><text x="2" y="82">LIGHT</text><text x="2" y="132">DEEP</text></g>';
  let prev = null; const t0 = 23 * 60 + 10;
  SL.forEach(([s, m], i) => {
    const w = m / tot * W, c = SLC[s], y = c[1] - 8; const clk = ((t0 + t) % 1440); const lab = `${String(Math.floor(clk / 60)).padStart(2, '0')}:${String(clk % 60).padStart(2, '0')}`;
    if (prev !== null) h += `<path d="M${x} ${prev + 8}V${y + 8}" stroke="rgba(154,166,255,.25)"/>`;
    h += `<rect class="seg" data-s="${s}" data-m="${m}" data-t="${lab}" x="${x + .5}" y="${y}" width="${Math.max(1, w - 1)}" height="16" rx="5" fill="${c[0]}" opacity=".9"/>`;
    prev = y; x += w; t += m;
  });
  svg.innerHTML = h;
  const tip = $('#sleepTip'), card = $('#sleepCard');
  svg.addEventListener('pointermove', e => { const r = e.target.closest('.seg'); if (!r) { tip.style.opacity = 0; return; } const rc = r.getBoundingClientRect(), pc = svg.parentNode.getBoundingClientRect(); tip.style.left = rc.left - pc.left + rc.width / 2 + 'px'; tip.style.top = rc.top - pc.top + 'px'; tip.textContent = `${SLC[r.dataset.s][2]} · ${r.dataset.m} мин · ${r.dataset.t}`; tip.style.opacity = 1; });
  svg.addEventListener('pointerleave', () => tip.style.opacity = 0);
  $('.sleep__st', card).addEventListener('click', e => { const b = e.target.closest('[data-stage]'); if (!b) return; const on = b.classList.toggle('on'); $$('.sleep__st button', card).forEach(x => { if (x !== b) x.classList.remove('on'); }); $$('.seg', svg).forEach(r => r.style.opacity = !on || r.dataset.s === b.dataset.stage ? .9 : .12); });
})();
new IntersectionObserver((es, o) => { if (es[0].isIntersecting) { o.disconnect(); setRecovery(7.7); } }, { threshold: .3 }).observe($('.rec1'));

/* ---------- Water ---------- */
let water = store.get('water', 1800), wNoted = false;
function drawWater(anim) {
  const pct = water / 2500, y = 300 - pct * 270;
  $('#lq').style.transform = `translateY(${y}px)`;
  $('#wL').textContent = +(water / 1000).toFixed(2);
  $('#wPct').textContent = pct >= 1 ? 'Мақсат орындалды. Керемет! 💧' : `Мақсаттың ${Math.round(pct * 100)}%-ы орындалды.`;
  const b = $('#wAdd'); b.disabled = pct >= 1; b.setAttribute('aria-disabled', pct >= 1); b.classList.toggle('btn--p', pct < 1);
  if (anim && 2500 - water <= 500 && water < 2500 && !wNoted) { wNoted = true; notify('💧', 'Hydration', 'Су мақсатыңа 500 ml қалды.'); }
  if (anim && water >= 2500) { unlock('hyd'); notify('💧', 'Hydration Master', 'Бүгінгі су мақсаты орындалды.'); }
}
$('#wAdd').addEventListener('click', () => { water = Math.min(2500, water + 250); store.set('water', water); drawWater(true); toast('+250 ml 💧'); });
$('#wReset').addEventListener('click', () => { water = 1800; wNoted = false; store.set('water', water); drawWater(); });
$('#lq').style.transform = 'translateY(300px)';
new IntersectionObserver((es, o) => { if (es[0].isIntersecting) { o.disconnect(); drawWater(); } }, { threshold: .3 }).observe($('#bottle'));

/* ---------- Habits / streak / achievements ---------- */
const HB = [['💧', '2.5L water'], ['👟', '8k steps'], ['🏋️', 'Workout'], ['🥗', 'Healthy food'], ['😴', '7h sleep']], DN = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
const todayI = (new Date().getDay() + 6) % 7;
let hab = store.get('habits', null);
if (!hab) hab = HB.map((_, r) => DN.map((_, d) => d < todayI && (d + r) % 6 !== 4));
function drawHab() {
  $('#habGrid').innerHTML = '<span></span>' + DN.map((d, i) => `<span class="hab__d ${i === todayI ? 't' : ''}">${d}</span>`).join('') +
    HB.map((h, r) => `<span class="hab__n"><span aria-hidden="true">${h[0]}</span>${h[1]}</span>` + DN.map((d, i) => `<button class="hc ${i > todayI ? 'fut' : ''}" ${i > todayI ? 'disabled' : ''} aria-pressed="${!!hab[r][i]}" data-r="${r}" data-d="${i}" aria-label="${h[1]}, ${d}"></button>`).join('')).join('');
}
$('#habGrid').addEventListener('click', e => {
  const b = e.target.closest('.hc'); if (!b || b.disabled) return;
  const r = +b.dataset.r, d = +b.dataset.d; hab[r][d] = !hab[r][d]; b.setAttribute('aria-pressed', hab[r][d]); store.set('habits', hab);
  if (d === todayI && hab.every(x => x[d])) { toast('🔥 Бүгінгі барлық әдеттер орындалды!'); notify('🔥', 'Streak', '13 күндік streak жолда. Бүгін барлығын орындадың.'); }
});
drawHab();
const MS = [7, 14, 30, 60, 100], STREAK = 12;
$('#ms').innerHTML = MS.map(m => `<div class="${STREAK >= m ? 'ok' : ''}"><i></i>${m}</div>`).join('');
{ let idx = MS.filter(m => STREAK >= m).length - 1, nxt = MS[idx + 1], prev = MS[idx] || 0; $('#ms').style.setProperty('--w', ((idx + (STREAK - prev) / (nxt - prev)) / (MS.length - 1) * 100) + '%'); }
const AC = [
  ['first', '🏆', 'First Workout', 'Алғашқы жаттығуыңды аяқта.', 1], ['s7', '🔥', '7 Day Streak', '7 күн қатарынан мақсатыңды орында.', 1],
  ['hyd', '💧', 'Hydration Master', 'Бір күнде 2.5 L су іш.', 0], ['k100', '👟', '100K Steps', 'Бір аптада 100 000 қадам.', 0],
  ['w10', '💪', '10 Workouts', '10 жаттығу аяқта.', 0], ['sleep', '🌙', 'Sleep Champion', '7 түн қатарынан 7h+ ұйықта.', 1]
];
let ach = store.get('ach', { first: 1, s7: 1, sleep: 1, w10: 7, k: 84 });
const saveAch = () => store.set('ach', ach);
function unlock(id) { if (ach[id]) return; ach[id] = 1; saveAch(); renderAch(); const a = AC.find(x => x[0] === id); toast(`${a[1]} Жаңа жетістік: ${a[2]}`); notify(a[1], 'Achievement', a[2]); }
function renderAch() {
  const prog = { k100: `${ach.k || 84}K / 100K`, w10: `${ach.w10 || 7} / 10` };
  const on = id => ach[id] === 1 || (id === 'w10' && (ach.w10 || 7) >= 10);
  $('#achG').innerHTML = AC.map(a => `<button class="bdg ${on(a[0]) ? 'on' : ''}" data-a="${a[0]}" aria-label="${a[2]}: ${on(a[0]) ? 'ашылды' : 'жабық'}"><span class="em" aria-hidden="true">${a[1]}</span><b>${a[2]}</b><small>${on(a[0]) ? 'UNLOCKED' : (prog[a[0]] || 'LOCKED')}</small></button>`).join('');
  $('#achCnt').textContent = `${AC.filter(a => on(a[0])).length} / ${AC.length}`;
}
$('#achG').addEventListener('click', e => { const b = e.target.closest('[data-a]'); if (b) toast(AC.find(a => a[0] === b.dataset.a)[3]); });
renderAch();

/* ---------- Progress chart ---------- */
const MET = [
  { k: 'weight', n: 'Weight', u: ' kg', now: 74.9, py: -8.5, d: 1, nz: .22 }, { k: 'strength', n: 'Strength', u: ' pts', now: 81, py: 26, d: 0, nz: 1.4 },
  { k: 'steps', n: 'Steps', u: '', now: 8421, py: 3000, d: 0, nz: 650, f: 1 }, { k: 'sleep', n: 'Sleep', u: ' h', now: 7.7, py: .9, d: 1, nz: .28 },
  { k: 'cons', n: 'Consistency', u: '%', now: 91, py: 30, d: 0, nz: 2.5 }, { k: 'rec', n: 'Recovery', u: '%', now: 87, py: 12, d: 0, nz: 4 }
];
const RNG = { '1M': [30, .12], '3M': [90, .3], '6M': [180, .55], '1Y': [365, 1] };
let mk = 'weight', rk = '3M', pts = [], hi = -1;
const MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'], WD = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const dstr = d => `${WD[d.getDay()]}, ${MON[d.getMonth()]} ${d.getDate()}`;
$('#pgRange').innerHTML = Object.keys(RNG).map(k => `<button class="chip" aria-pressed="${k === rk}" data-r="${k}">${k}</button>`).join('');
$('#pgMetrics').innerHTML = MET.map(m => `<button class="chip" aria-pressed="${m.k === mk}" data-m="${m.k}">${m.n}</button>`).join('');
$('#pgRange').addEventListener('click', e => { const b = e.target.closest('[data-r]'); if (!b) return; rk = b.dataset.r; $$('#pgRange .chip').forEach(c => c.setAttribute('aria-pressed', c === b)); drawChart(); });
$('#pgMetrics').addEventListener('click', e => { const b = e.target.closest('[data-m]'); if (!b) return; setMetric(b.dataset.m); });
function setMetric(k) { mk = k; $$('#pgMetrics .chip').forEach(c => c.setAttribute('aria-pressed', c.dataset.m === k)); drawChart(); }
const fv = (m, v) => (m.f ? fmtN(v) : v.toFixed(m.d)) + m.u;
function drawChart() {
  const m = MET.find(x => x.k === mk), [days, fr] = RNG[rk], N = 30, end = new Date();
  let s = 11 + mk.length * 7 + days; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const st = m.now - m.py * fr; pts = [];
  for (let i = 0; i < N; i++) {
    const k = i / (N - 1), e = k * k * (3 - 2 * k) * .6 + k * .4; let v = st + (m.now - st) * e + (i < N - 1 ? (rnd() - .5) * 2 * m.nz * (rk === '1M' ? .6 : 1) : 0);
    if (m.u === '%') v = Math.min(99, v); const d = new Date(end); d.setDate(end.getDate() - Math.round(days * (1 - k))); pts.push({ v, d });
  }
  const W = 900, H = 320, L = 8, R = 8, T = 20, B = 34, vs = pts.map(p => p.v), lo = Math.min(...vs), hiV = Math.max(...vs), pad = (hiV - lo) * .18 || 1, y0 = lo - pad, y1 = hiV + pad;
  const X = i => L + i / (N - 1) * (W - L - R), Y = v => T + (1 - (v - y0) / (y1 - y0)) * (H - T - B);
  const xy = pts.map((p, i) => [X(i), Y(p.v)]); let d = `M${xy[0][0]} ${xy[0][1]}`;
  for (let i = 0; i < N - 1; i++) { const a = xy[Math.max(0, i - 1)], b = xy[i], c = xy[i + 1], e = xy[Math.min(N - 1, i + 2)]; d += `C${b[0] + (c[0] - a[0]) / 6} ${b[1] + (c[1] - a[1]) / 6} ${c[0] - (e[0] - b[0]) / 6} ${c[1] - (e[1] - b[1]) / 6} ${c[0]} ${c[1]}`; }
  const grid = [0, 1, 2, 3].map(i => { const yy = T + i / 3 * (H - T - B); return `<path class="grid-l" d="M${L} ${yy}H${W - R}"/><text class="ax" x="${W - R}" y="${yy - 6}" text-anchor="end">${fv(m, y1 - i / 3 * (y1 - y0))}</text>`; }).join('');
  const xl = [0, 7, 14, 22, 29].map(i => `<text class="ax" x="${X(i)}" y="${H - 8}" text-anchor="${i === 0 ? 'start' : i === 29 ? 'end' : 'middle'}">${dstr(pts[i].d)}</text>`).join('');
  const svg = $('#chartSvg');
  svg.innerHTML = `<defs><linearGradient id="ga" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#B7FF3C" stop-opacity=".18"/><stop offset="1" stop-color="#B7FF3C" stop-opacity="0"/></linearGradient></defs>${grid}${xl}<path d="${d}L${X(N - 1)} ${H - B}L${X(0)} ${H - B}Z" fill="url(#ga)" opacity="0" id="area"/><path class="ln" id="ln" d="${d}" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"/><g id="hov" opacity="0"><path id="hv" stroke="rgba(183,255,60,.5)" stroke-dasharray="3 4" d="M0 ${T}V${H - B}"/><circle id="hd" r="6" fill="#070908" stroke="#B7FF3C" stroke-width="2.4"/></g>`;
  svg._g = { X, Y, W, H, xy };
  const ln = $('#ln', svg); ln.getBoundingClientRect();
  requestAnimationFrame(() => { ln.style.transition = RM ? 'none' : 'stroke-dashoffset 1.4s cubic-bezier(.65,0,.35,1)'; ln.style.strokeDashoffset = 0; const a = $('#area', svg); a.style.transition = RM ? 'none' : 'opacity 1.2s .5s'; a.style.opacity = 1; });
  const first = pts[0].v, now = pts[N - 1].v, df = now - first;
  cancelCount($('#pgVal')); $('#pgVal').textContent = m.f ? fmtN(now) : now.toFixed(m.d); $('#pgUnit').textContent = m.u.trim();
  $('#pgChg').textContent = `${df >= 0 ? '+' : '−'}${m.f ? fmtN(Math.abs(df)) : Math.abs(df).toFixed(m.d)}${m.u} · ${rk}`; hi = -1; $('#tip').classList.remove('on');
}
function hover(i) {
  const svg = $('#chartSvg'), g = svg._g; if (!g) return; i = clamp(i, 0, pts.length - 1); hi = i;
  const [x, y] = g.xy[i], m = MET.find(z => z.k === mk);
  $('#hov', svg).setAttribute('opacity', 1); $('#hv', svg).setAttribute('d', `M${x} 20V${g.H - 34}`); $('#hd', svg).setAttribute('cx', x); $('#hd', svg).setAttribute('cy', y);
  const tip = $('#tip'); const sr = svg.getBoundingClientRect(), cr = $('#chart').getBoundingClientRect(); tip.style.left = ((sr.left - cr.left) + x / g.W * sr.width) + 'px'; tip.style.top = ((sr.top - cr.top) + y / g.H * sr.height) + 'px'; tip.classList.add('on');
  $('#tipD').textContent = dstr(pts[i].d); $('#tipV').textContent = `${m.n} ${fv(m, pts[i].v)}`;
}
$('#chartSvg').addEventListener('pointermove', e => { const svg = e.currentTarget, g = svg._g; if (!g) return; const r = svg.getBoundingClientRect(); hover(Math.round((e.clientX - r.left) / r.width * g.W / g.W * (pts.length - 1))); });
$('#chartSvg').addEventListener('pointerleave', () => { $('#tip').classList.remove('on'); const h = $('#hov'); if (h) h.setAttribute('opacity', 0); });
$('#chartSvg').addEventListener('keydown', e => { if (e.key === 'ArrowLeft') { e.preventDefault(); hover((hi < 0 ? pts.length - 1 : hi) - 1); } if (e.key === 'ArrowRight') { e.preventDefault(); hover((hi < 0 ? pts.length - 1 : hi) + 1); } });
new IntersectionObserver((es, o) => { if (es[0].isIntersecting) { o.disconnect(); drawChart(); } }, { threshold: .2 }).observe($('#chart'));

/* ---------- command palette ---------- */
const TIPS = [['Кеңес: ұйқы', 'Бір уақытта жат — тұрақты режим recovery-ді жақсартады.'], ['Кеңес: су', 'Жаттығу алдында 300–500 мл су іш.'], ['Кеңес: қадам', 'Күніне 8 000 қадам — жақсы бастапқы мақсат.'], ['Кеңес: протеин', 'Протеинді күн бойына 3–4 рет бөліп іш.']];
const CMD = [
  ...WO.map(w => ({ g: 'Жаттығулар', i: '🏋️', t: w.n, s: `${w.m} min · ${w.l}`, run: () => pickWo(w.id, true) })),
  ...Object.entries(REC).map(([k, r]) => ({ g: 'Рецепттер', i: '🥗', t: r.n, s: `${r.k} kcal`, run: () => { go('#nutrition'); setTimeout(() => recipe(k), 500); } })),
  { g: 'AI Coach', i: '✦', t: 'AI Coach-пен сөйлесу', s: 'Мақсатыңды айт', run: () => { go('#coach'); setTimeout(() => cin.focus({ preventScroll: true }), 600); } },
  { g: 'AI Coach', i: '✦', t: 'Бүгін не жеймін?', s: 'AI Nutrition', run: () => { go('#ainu'); } },
  ...MET.map(m => ({ g: 'Прогресс', i: '◉', t: m.n, s: 'Progress график', run: () => { go('#progress'); setMetric(m.k); } })),
  { g: 'Прогресс', i: '🔥', t: 'Әдеттер мен streak', s: '12 күн', run: () => go('#habits') },
  ...TIPS.map(t => ({ g: 'Кеңестер', i: '💡', t: t[0], s: t[1], run: () => modal(`<span class="meta"><b>Кеңес</b></span><h3>${t[0].replace('Кеңес: ', '')}</h3><p class="mut">${t[1]}</p>`) })),
  { g: 'DENSAM', i: '⚙', t: 'Онбордингті қайта өту', s: 'Жеке жоспар', run: openOb }, { g: 'DENSAM', i: '?', t: 'FAQ', s: 'Жиі қойылатын сұрақтар', run: faq }
];
let cmdSel = 0, cmdList = [];
function drawCmd() {
  const q = $('#cmdIn').value.trim().toLowerCase();
  cmdList = CMD.filter(c => !q || (c.t + ' ' + c.s + ' ' + c.g).toLowerCase().includes(q)).slice(0, 14); cmdSel = clamp(cmdSel, 0, Math.max(0, cmdList.length - 1));
  let last = '', h = '';
  cmdList.forEach((c, i) => { if (c.g !== last) { h += `<div class="cmd__g meta">${c.g}</div>`; last = c.g; } h += `<button class="ci" role="option" id="ci${i}" aria-selected="${i === cmdSel}" data-i="${i}"><span class="i">${c.i}</span><span><b>${esc(c.t)}</b><small>${esc(c.s)}</small></span><em>↵</em></button>`; });
  $('#cmdL').innerHTML = h || `<div class="empty"><b>Ештеңе табылмады.</b><span>Басқа сөз жазып көр.</span></div>`;
  $('#cmdIn').setAttribute('aria-activedescendant', cmdList.length ? 'ci' + cmdSel : '');
  const s = $('.ci[aria-selected=true]'); if (s) s.scrollIntoView({ block: 'nearest' });
}
function openCmd() { $('#cmdIn').value = ''; cmdSel = 0; drawCmd(); openDlg($('#cmd')); $('#cmdIn').focus(); }
function runCmd(i) { const c = cmdList[i]; if (!c) return; $('#cmd').close(); setTimeout(c.run, 80); }
$('#cmdIn').addEventListener('input', () => { cmdSel = 0; drawCmd(); });
$('#cmdIn').addEventListener('keydown', e => {
  if (e.key === 'ArrowDown') { e.preventDefault(); cmdSel = Math.min(cmdList.length - 1, cmdSel + 1); drawCmd(); }
  if (e.key === 'ArrowUp') { e.preventDefault(); cmdSel = Math.max(0, cmdSel - 1); drawCmd(); }
  if (e.key === 'Enter') { e.preventDefault(); runCmd(cmdSel); }
});
$('#cmdL').addEventListener('click', e => { const b = e.target.closest('.ci'); if (b) runCmd(+b.dataset.i); });
$('#cmdL').addEventListener('pointermove', e => { const b = e.target.closest('.ci'); if (b && +b.dataset.i !== cmdSel) { cmdSel = +b.dataset.i; $$('.ci').forEach((x, i) => x.setAttribute('aria-selected', i === cmdSel)); } });
$('#openCmd').addEventListener('click', openCmd); $('#openCmd2').addEventListener('click', openCmd);
document.addEventListener('keydown', e => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); $('#cmd').open ? $('#cmd').close() : openCmd(); }
  else if (e.key === '/' && !e.target.closest('input,textarea,select')) { e.preventDefault(); openCmd(); }
  else if (e.key === 'Escape') togglePop(false);
});

/* ---------- FAQ, profile ---------- */
function faq() {
  modal(`<span class="meta"><b>FAQ</b></span><h3>Жиі сұрақтар</h3>${[
    ['DENSAM дәрігер ме?', 'Жоқ. DENSAM — ақпараттық және мотивациялық құрал, медициналық диагноз қоймайды.'],
    ['Деректерім қайда сақталады?', 'Бұл демода барлық деректер тек сенің браузеріңде сақталады.'],
    ['AI Coach қалай жұмыс істейді?', 'Белсенділік, ұйқы, recovery және әдеттерді талдап, жалпы ұсыныс береді.'],
    ['Food Scan дәл ме?', 'Жоқ, нәтиже шамамен. Нақты есеп үшін өнім салмағын өлшеу керек.']
  ].map(([q, a]) => `<h5>${q}</h5><p class="mut">${a}</p>`).join('')}`);
}
$('#dockProfile').addEventListener('click', () => {
  const p = store.get(profileKey);
  modal(`<span class="meta"><b>Profile</b></span><h3>Сенің профилің</h3>${p ? Object.entries({ Мақсат: p.goal, 'Күн / апта': p.days, Орын: p.place, Деңгей: p.level }).map(([k, v]) => `<div class="lvl"><span>${k}</span><b>${esc(v)}</b></div>`).join('') : '<div class="empty"><b>Алғашқы қадамыңды жаса.</b><span>Профиль әлі құрылмаған.</span></div>'}<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:24px"><button class="btn btn--p btn--s" id="pfOb">${p ? 'Жоспарды өзгерту' : 'Жоспар құру'}</button><button class="btn btn--g btn--s" id="pfReset">Деректерді тазалау</button></div>`);
  $('#pfOb').onclick = () => { $('#modal').close(); openOb(); };
  $('#pfReset').onclick = () => { ['profile', 'skipped', 'water', 'habits', 'ach'].forEach(store.del); toast('Деректер тазаланды'); setTimeout(() => location.reload(), 600); };
});
})();
