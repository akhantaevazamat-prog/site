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
const profileKey = 'profile', notify = () => {}, unlock = () => {};
let toastT;
function toast(msg, err) { const t = $('#toast'); t.textContent = msg; t.classList.toggle('err', !!err); t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 3000); }
function modal(html) { const m = $('#mdl'); m.innerHTML = `<button class="icon-btn x" aria-label="Жабу" data-close>✕</button>${html}`; if (!$('#modal').open) $('#modal').showModal(); }
$('#modal').addEventListener('click', e => { if (e.target.id === 'modal' || e.target.closest('[data-close]')) $('#modal').close(); });

/* loader + nav */
setTimeout(() => $('#loader').classList.add('done'), RM ? 50 : 600);
const nav = $('#nav'), links = $('#navlinks'), burger = $('#burger');
addEventListener('scroll', () => nav.classList.toggle('stuck', scrollY > 20), { passive: true });
burger.addEventListener('click', () => { const o = links.classList.toggle('open'); burger.setAttribute('aria-expanded', o); });
links.addEventListener('click', e => { if (e.target.closest('a')) { links.classList.remove('open'); burger.setAttribute('aria-expanded', false); } });
const spyIO = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) $$('#navlinks a').forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#' + e.target.id)); }), { rootMargin: '-40% 0px -55% 0px' });
$$('#navlinks a').forEach(a => { const s = $(a.getAttribute('href')); if (s) spyIO.observe(s); });

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

/* ---------- Workouts ---------- */
const WO = [
  { id: 'full', c: 'strength', n: 'Full Body', m: 35, l: 'Intermediate', k: 310 }, { id: 'push', c: 'strength', n: 'Upper Push', m: 40, l: 'Advanced', k: 340 }, { id: 'pull', c: 'strength', n: 'Back & Biceps', m: 40, l: 'Intermediate', k: 330 },
  { id: 'zone2', c: 'cardio', n: 'Zone 2 Run', m: 45, l: 'Beginner', k: 420 }, { id: 'tempo', c: 'cardio', n: 'Tempo Intervals', m: 30, l: 'Intermediate', k: 380 },
  { id: 'tabata', c: 'hiit', n: 'Tabata 20', m: 20, l: 'Advanced', k: 290 }, { id: 'burn', c: 'hiit', n: 'Burn Ladder', m: 25, l: 'Intermediate', k: 330 },
  { id: 'flow', c: 'yoga', n: 'Morning Flow', m: 30, l: 'Beginner', k: 120 }, { id: 'power', c: 'yoga', n: 'Power Yoga', m: 40, l: 'Intermediate', k: 210 },
  { id: 'hip', c: 'mobility', n: 'Hip & Spine Reset', m: 15, l: 'Beginner', k: 60 }, { id: 'desk', c: 'mobility', n: 'Desk Release', m: 10, l: 'Beginner', k: 40 },
  { id: 'home', c: 'home', n: 'No Equipment 30', m: 30, l: 'Beginner', k: 260 }, { id: 'bw', c: 'home', n: 'Bodyweight Strength', m: 35, l: 'Intermediate', k: 300 }
];
const CATS = [['strength', 'Strength'], ['cardio', 'Cardio'], ['hiit', 'HIIT'], ['yoga', 'Yoga'], ['mobility', 'Mobility'], ['home', 'Home Workout']];
const EX = [['Warm-up', '5 мин'], ['Squat', '3 × 12'], ['Push-up', '3 × 10'], ['Bent-over Row', '3 × 12'], ['Lunge', '3 × 10'], ['Plank', '3 × 45 сек'], ['Cool-down', '5 мин']];
let cat = 'strength', cur = WO[0];
function renderWo() {
  $('#woTabs').innerHTML = CATS.map(([k, n]) => `<button class="chip" role="tab" aria-selected="${k === cat}" data-cat="${k}">${n}</button>`).join('');
  $('#woList').innerHTML = WO.filter(w => w.c === cat).map((w, i) => `<button class="wr" role="listitem" aria-pressed="${w.id === cur.id}" data-id="${w.id}"><span class="no">0${i + 1}</span><span><b>${w.n}</b><small>${w.l}</small></span><em>${w.m} MIN</em></button>`).join('');
  $('#woCat').innerHTML = `<b>${CATS.find(c => c[0] === cur.c)[1]}</b> · Smart Workout`;
  $('#woName').textContent = cur.n.toUpperCase(); $('#woDur').textContent = cur.m + ' MIN'; $('#woLvl').textContent = cur.l; $('#woKcal').textContent = cur.k + ' kcal';
}
$('#woTabs').addEventListener('click', e => { const b = e.target.closest('[data-cat]'); if (!b) return; cat = b.dataset.cat; if (cur.c !== cat) cur = WO.find(w => w.c === cat); renderWo(); });
$('#woList').addEventListener('click', e => { const b = e.target.closest('[data-id]'); if (b) { cur = WO.find(w => w.id === b.dataset.id); renderWo(); } });
$('#woStart').addEventListener('click', () => modal(`<span class="meta"><b>${cur.m} min · ${cur.l} · ${cur.k} kcal</b></span><h3>${cur.n}</h3>${EX.map(e => `<div class="lvl"><b>${e[0]}</b><span>${e[1]}</span></div>`).join('')}<p class="note" style="margin-top:20px">Техниканы бақыла, жеңіл жүктемеден баста. Ауырсыну болса — тоқтат.</p>`));
renderWo();

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
  svg.innerHTML = `<defs><linearGradient id="ga" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FF5A36" stop-opacity=".18"/><stop offset="1" stop-color="#FF5A36" stop-opacity="0"/></linearGradient></defs>${grid}${xl}<path d="${d}L${X(N - 1)} ${H - B}L${X(0)} ${H - B}Z" fill="url(#ga)" opacity="0" id="area"/><path class="ln" id="ln" d="${d}" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"/><g id="hov" opacity="0"><path id="hv" stroke="rgba(183,255,60,.5)" stroke-dasharray="3 4" d="M0 ${T}V${H - B}"/><circle id="hd" r="6" fill="#fff" stroke="#FF5A36" stroke-width="2.4"/></g>`;
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

})();
