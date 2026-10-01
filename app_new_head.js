/* DENSAM — vanilla JS, no dependencies */
(() => {
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const wait = ms => new Promise(r => setTimeout(r, RM ? Math.min(ms, 60) : ms));
const store = {
  get(k, d) { try { const v = localStorage.getItem('densam.' + k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem('densam.' + k, JSON.stringify(v)); } catch {} }
};
const fmtN = n => Math.round(n).toLocaleString('en-US');
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const go = sel => { const el = $(sel); if (el) el.scrollIntoView({ behavior: RM ? 'auto' : 'smooth', block: 'start' }); };
let toastT;
function toast(msg, err) { const t = $('#toast'); t.textContent = msg; t.classList.toggle('err', !!err); t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 3000); }
const notify = () => {};
function openDlg(d) { if (!d.open) d.showModal(); }
function modal(html) { const m = $('#mdl'); m.innerHTML = `<button class="icon-btn x" aria-label="Жабу" data-close>✕</button>${html}`; openDlg($('#modal')); }
$('#modal').addEventListener('click', e => { if (e.target.id === 'modal' || e.target.closest('[data-close]')) $('#modal').close(); });

/* loader, nav */
setTimeout(() => $('#loader').classList.add('done'), RM ? 50 : 700);
const nav = $('#nav'), links = $('#navlinks'), burger = $('#burger');
addEventListener('scroll', () => nav.classList.toggle('stuck', scrollY > 20), { passive: true });
burger.addEventListener('click', () => { const o = links.classList.toggle('open'); burger.setAttribute('aria-expanded', o); });
links.addEventListener('click', e => { if (e.target.closest('a')) { links.classList.remove('open'); burger.setAttribute('aria-expanded', false); } });
const spy = $$('#navlinks a'), spyEls = spy.map(a => $(a.getAttribute('href')));
new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) spy.forEach((a, i) => a.classList.toggle('on', spyEls[i] === e.target)); }), { rootMargin: '-40% 0px -55% 0px' }).observe && spyEls.forEach(el => el && new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) spy.forEach(a => a.classList.toggle('on', $(a.getAttribute('href')) === e.target)); }), { rootMargin: '-40% 0px -55% 0px' }).observe(el));

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

