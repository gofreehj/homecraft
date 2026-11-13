// 把 content.js 渲染到封面和 3D 卡片里，并负责按需启动 3D 世界。
// 内容全部来自 content.js；这个文件只管版式与交互。
// 普通脚本（不是 ES module）：双击打开的 file:// 页面也能正常读到配置并渲染。
(function () {
'use strict';

const content = window.SITE_CONTENT;
if (!content) {
  console.error('[cover] 没有读到 content.js：请确认 index.html 里先加载 content.js。');
  return;
}

// 有些宿主环境会把脚本重写成绝对地址，导致脚本自身失去相对路径基准
// （import() 报 “base URL is about:blank”）。这里先推导出一个可用的绝对目录，
// 再用它拼出所有资源地址，不依赖任何隐式基准。
const ASSET_BASE = (() => {
  const candidates = [];
  if (document.currentScript && document.currentScript.src) candidates.push(document.currentScript.src);
  const tag = document.querySelector('script[src*="cover.js"]');
  if (tag && tag.src) candidates.push(tag.src);
  // 样式表与脚本同目录；若脚本被内联，它也能给出真实目录。
  const css = document.querySelector('link[rel="stylesheet"][href*="cover.css"]');
  if (css && css.href) candidates.push(css.href);
  candidates.push(document.baseURI, location.href);
  for (const c of candidates) {
    try {
      const u = new URL(c, location.href);
      if (['http:', 'https:', 'file:'].includes(u.protocol)) return new URL('.', u).href;
    } catch (e) { /* 忽略不可用的候选 */ }
  }
  try { return new URL('.', location.href).href; } catch (e) { return './'; }
})();

// 资源版本号：发版时改这里，可以让浏览器和 CDN 丢弃旧的缓存副本。
// 它也兼作排查用——线上取到旧文件时，先升这个值。
const RES_VER = '14';

// 3D 引擎由 esbuild 预先打包成 engine/world-3d.js（three 与所有子模块都内联在里面），
// 所以运行时不需要 import map，也不依赖几十个子文件的相对导入。
// 产物放在 engine/ 下，是为了让引擎里的 new URL('...', import.meta.url) 仍然以 engine/ 为基准。
// 改了 engine/ 或 world/ 下的源码之后，重新运行 tools/stage.mjs 打包。
const ENTRY = 'engine/world-3d.js';

const $ = sel => document.querySelector(sel);

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// 允许在配置里用 **粗体** 强调一小段。
const rich = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

const { profile, projects, office, contact } = content;
const deptPath = profile.deptPath || [];
const deptShort = profile.department || deptPath[deptPath.length - 1] || '';

// ---------- 封面 ----------
function fill(selector, html) {
  const el = $(selector);
  if (el) el.innerHTML = html;
}

fill('[data-render="brand-name"]', esc(profile.latin));
fill('[data-render="coord"]', `${esc(office.coord)}<br>${esc(office.city).toUpperCase()}`);

const heroCopy = $('[data-render="hero"]');
if (heroCopy) {
  heroCopy.innerHTML = `
    <div class="eyebrow"><i></i>${esc(profile.eyebrow)}</div>
    <h1>${esc(profile.name)}<span class="thin">${esc(profile.headline).replace('走进去的', '走进去的<br>')}</span></h1>
    <p class="lede">${rich(profile.lede)}</p>
    <div class="hero-actions">
      <button class="btn primary" type="button" data-enter>走进小屋逛逛</button>
      <a class="btn" href="#works">先看项目
        <svg class="arrow" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M2 8h10M8 4l4 4-4 4" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="square"></path></svg>
      </a>
      <span class="hint">需要 WebGL · 方向键走动，F 打开卡片</span>
    </div>
    <div id="enterError" class="enter-error" hidden>
      <b>3D 小屋没能启动</b>
      <p>上面的内容不受影响，可以继续阅读。可以点下面的按钮清掉缓存重开一次；还不行就把下面这行错误发给我。</p>
      <code id="enterErrorText"></code>
      <button class="btn" type="button" data-hard-reload>强制刷新</button>
    </div>
  `;
}

fill('[data-render="facts"]', `
  <div><dt>常驻</dt><dd>${esc(office.city)} <span>· ${esc(office.site)}</span></dd></div>
  <div><dt>部门</dt><dd>${esc(deptShort)}</dd></div>
  <div><dt>在做</dt><dd>${esc(projects[0]?.title || '')} <span>等 ${esc(projects.length)} 个项目</span></dd></div>
  <div><dt>联络</dt><dd>飞书优先 <span>· 工作日</span></dd></div>
`);

fill('[data-render="about"]', `
  ${profile.paragraphs.map(p => `<p>${rich(p)}</p>`).join('')}
  <div class="creed">
    ${profile.creed.map((t, i) => `<div><b>${String(i + 1).padStart(2, '0')}</b><p>${esc(t)}</p></div>`).join('')}
  </div>
`);

// App Store 的外链在封面和 3D 卡片里共用一个渲染片段。
const VERSION = 'v0.1.0';
fill('[data-render="version"]', `版本 ${VERSION}`);
const storeArrow = `<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 9L9 3M9 3H4.5M9 3v4.5" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="square"></path></svg>`;

fill('[data-render="projects"]', projects.map((p, i) => `
  <article class="project">
    <div class="no">${String(i + 1).padStart(2, '0')}</div>
    <div>
      <h3>${p.app ? `<img class="app-icon" src="${esc(p.app.icon)}" width="34" height="34" alt="${esc(p.app.name)} App 图标">` : ''}${esc(p.title)}</h3>
      <p>${rich(p.summary)}</p>
      ${p.app ? `<a class="app-link" href="${esc(p.app.store)}" target="_blank" rel="noopener">在 App Store 看「${esc(p.app.name)}」${storeArrow}</a>` : ''}
    </div>
    <div class="role">
      <b>${esc(p.role)}</b>
      <span>${esc((p.tags || []).join(' / '))}</span>
    </div>
  </article>
`).join(''));

fill('[data-render="office"]', `
  <dl class="office-rows">
    <div>
      <dt>常驻</dt>
      <dd>${esc(office.city)} · ${esc(office.site)}</dd>
    </div>
    <div>
      <dt>部门</dt>
      <dd class="dept-path">${deptPath.map(d => `<span>${esc(d)}</span>`).join('<i>/</i>')}</dd>
    </div>
    <div>
      <dt>工位</dt>
      <dd>${esc(office.desk)}<em>${esc(office.deskHint)}</em></dd>
    </div>
    <div>
      <dt>时间</dt>
      <dd>${esc(office.hours)}<em>${esc(office.hoursHint)}</em></dd>
    </div>
  </dl>
  <aside class="office-note">
    <h3>怎么找到我</h3>
    <p>${rich(office.howTo)}</p>
    <div class="coord">${esc(office.coord)}</div>
  </aside>
`);

fill('[data-render="contact"]', `
  <dl class="reach-place">
    <div><dt>办公地点</dt><dd>${esc(office.city)} · ${esc(office.site)}</dd></div>
    <div><dt>工位</dt><dd>${esc(office.desk)}${office.deskHint ? `<em>${esc(office.deskHint)}</em>` : ''}</dd></div>
  </dl>
  <div class="reach-links">
    <a class="chip" href="#top" data-enter><i></i>走进 3D 小屋</a>
  </div>
`);

// ---------- 深浅色主题 ----------
// 首帧的主题已由 index.html 里的内联脚本定好（避免闪白），这里只接手切换与同步。
const THEME_KEY = 'manual-theme';
const themeMeta = document.querySelector('meta[name="theme-color"]');
const readTheme = () => (document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');

function paintTheme(next, persist) {
  const theme = next === 'light' ? 'light' : 'dark';
  document.documentElement.dataset.theme = theme;
  if (themeMeta) themeMeta.setAttribute('content', theme === 'light' ? '#f4efe3' : '#0f1815');
  const toggle = $('[data-theme-toggle]');
  if (toggle) {
    toggle.setAttribute('aria-pressed', String(theme === 'light'));
    toggle.setAttribute('aria-label', theme === 'light' ? '切换到深色主题' : '切换到浅色主题');
  }
  if (persist) {
    try { localStorage.setItem(THEME_KEY, theme); } catch (e) { /* 隐私模式下存不了就只生效这一次 */ }
  }
}

paintTheme(readTheme(), false);
document.addEventListener('click', e => {
  const toggle = e.target.closest && e.target.closest('[data-theme-toggle]');
  if (!toggle) return;
  paintTheme(readTheme() === 'light' ? 'dark' : 'light', true);
});
// 没手动选过时跟着系统走。
if (window.matchMedia) {
  const mq = window.matchMedia('(prefers-color-scheme: light)');
  const follow = e => {
    let chosen = null;
    try { chosen = localStorage.getItem(THEME_KEY); } catch (err) {}
    if (chosen !== 'light' && chosen !== 'dark') paintTheme(e.matches ? 'light' : 'dark', false);
  };
  if (mq.addEventListener) mq.addEventListener('change', follow);
  else if (mq.addListener) mq.addListener(follow);
}

// ---------- 3D 世界里按 F 打开的卡片 ----------
const pages = $('#pages');
if (pages) {
  pages.innerHTML = `
    <h1 class="plain-title">${esc(profile.name)} · 个人说明书</h1>
    <p class="plain-version">${VERSION}</p>

    <article class="page" data-station="about" data-icon="about">
      <h2>关于我</h2>
      <div class="about">
        <figure class="about-figure">
          <img src="${esc(profile.photo || profile.image || 'assets/hero.webp')}" alt="${esc(profile.photoCaption || profile.imageCaption || '工作台')}">
          <figcaption>${esc(profile.photoCaption || profile.imageCaption || '')}</figcaption>
        </figure>
        <div class="about-text">
          ${profile.paragraphs.map(p => `<p>${rich(p)}</p>`).join('')}
          <div class="about-foot">
            <a class="mc-button" href="#works" data-open="works">看工作台</a>
            <a class="mc-button" href="#mailbox" data-open="mailbox">留言</a>
            <span class="build-tag">${VERSION}</span>
          </div>
        </div>
      </div>
    </article>

    <article class="page" data-station="works" data-icon="works">
      <h2>工作台</h2>
      <p class="page-lede">我每天坐在这张桌子前，做的是这些事。</p>
      <ul class="work-cards">
        ${projects.map(p => `
          <li>
            ${p.app ? `<img src="${esc(p.app.icon)}" width="56" height="56" alt="${esc(p.app.name)} App 图标">` : ''}
            <h3>${esc(p.title)}</h3>
            ${p.role || p.tags?.length ? `<p class="work-meta">${[p.role, ...(p.tags || [])].filter(Boolean).map(esc).join(' · ')}</p>` : ''}
            <p>${rich(p.summary)}</p>
            ${p.app ? `<a class="mc-button get" href="${esc(p.app.store)}" target="_blank" rel="noopener">App Store</a>` : ''}
          </li>
        `).join('')}
      </ul>
    </article>


    <article class="page" data-station="contact" data-icon="chat">
      <h2>找到我</h2>
      <ul class="contact">
        <li data-app="mail"><span>邮箱</span><a href="mailto:${esc(contact.email)}">${esc(contact.email)}</a><p>正式材料、对外协作走这里。</p></li>
        <li data-app="feishu"><span>飞书</span><a href="https://www.feishu.cn/invitation/page/add_contact/?token=874jf800-7789-45ff-9747-1f7d7b5eb579&amp;unique_id=JXd6NMI2Ug0w9CR2FLuATQ==" target="_blank" rel="noopener">${esc(contact.feishu)}</a><p>加我飞书，日常问题最快。</p></li>
      </ul>
    </article>

    <article class="page" id="mailbox" data-station="mailbox" data-icon="mail">
      <h2>留言</h2>
      <dl class="mailbox-where">
        <div><dt>常驻</dt><dd>${esc(office.city)} · ${esc(office.site)}</dd></div>
        <div><dt>工位</dt><dd>${esc(office.desk)}</dd></div>
        <div><dt>时间</dt><dd>${esc(office.hours)}</dd></div>
      </dl>
      <form class="mailbox" method="post" enctype="text/plain">
        <input name="subject" maxlength="80" required placeholder="主题" aria-label="主题，必填">
        <textarea name="message" rows="6" maxlength="1000" required placeholder="想说的话" aria-label="想说的话"></textarea>
        <input name="contact" maxlength="120" required autocomplete="email" placeholder="联系方式（邮箱或飞书，必填）" aria-label="联系方式，必填">
        <input class="trap" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
        <div class="mailbox-foot"><button class="mc-button" type="submit" disabled>发送</button></div>
        <p class="mailbox-status" role="status" aria-live="polite"></p>
      </form>
    </article>
  `;
}

// ---------- 展厅：点车辆前的信息牌看详情 ----------
// 展厅不再弹一整页文字。牌面上只有车名和一句“点击看参数”，参数放在这张卡里。
// 牌子的点击由引擎转发过来（window.__homePlate），id 与 world/scooters.js 的车型一一对应。
const SCOOTERS = [
  {
    id: 'space-l',
    name: '元宇宙 Space L',
    series: 'Q 系列 · 电轻摩',
    desc: '奶油色车身，圆灯加前筐，偏城市通勤的一台。',
    specs: [['电池', '60V 22Ah 石墨烯'], ['续航', '约 80 km']],
  },
  {
    id: 'a7-plus',
    name: '爱玛 A7 Plus',
    series: 'A 系列 · 电摩',
    desc: '机甲风前脸，贯穿式大灯加 U 型日行灯，雷霆 V8 电机。',
    specs: [['峰值功率', '3000 W'], ['续航', '100–120 km'], ['最高车速', '65 km/h']],
  },
  {
    id: 's1-max',
    name: '爱玛马赫 S1 MAX',
    series: '商用系列 · 电摩',
    desc: '面向即时配送：加长踏板、32L 大座桶，配双通道 ABS 与 E-TCS。',
    specs: [['电机', '雷霆 V8S · 4100 W'], ['电池', '72V 38Ah'], ['加速', '50 m / 6.1 s']],
  },
  {
    id: 'luna',
    name: '爱玛露娜 Luna',
    series: 'S 系列 · 电轻摩',
    desc: '轻巧的一台，圆润前脸配低座高，城市里好停好挪，通勤代步都顺手。',
    specs: [['车型', '电轻摩'], ['用途', '通勤 · 代步']],
  },
];

const sheet = document.createElement('div');
sheet.className = 'vsheet';
sheet.id = 'vehicleSheet';
sheet.hidden = true;
sheet.innerHTML = `
  <div class="vsheet-backdrop" data-vsheet-close></div>
  <article class="vsheet-card" role="dialog" aria-modal="true" aria-labelledby="vsheetName">
    <button class="vsheet-close" type="button" data-vsheet-close aria-label="关闭详情">
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path></svg>
    </button>
    <p class="vsheet-kicker">展厅 · 车型详情</p>
    <h3 class="vsheet-name" id="vsheetName"></h3>
    <p class="vsheet-series"></p>
    <p class="vsheet-desc"></p>
    <dl class="vsheet-specs"></dl>
    <p class="vsheet-note">参数按公开报道与电商页整理，具体以官方配置表为准。</p>
  </article>`;
if (document.body) document.body.appendChild(sheet);

const sheetName = sheet.querySelector('.vsheet-name');
const sheetSeries = sheet.querySelector('.vsheet-series');
const sheetDesc = sheet.querySelector('.vsheet-desc');
const sheetSpecs = sheet.querySelector('.vsheet-specs');

function openVehicle(id) {
  const v = SCOOTERS.find(s => s.id === id);
  if (!v) return;
  sheetName.textContent = v.name;
  sheetSeries.textContent = v.series;
  sheetDesc.textContent = v.desc;
  sheetSpecs.innerHTML = v.specs.map(([k, val]) => `<div><dt>${esc(k)}</dt><dd>${esc(val)}</dd></div>`).join('');
  sheet.hidden = false;
  requestAnimationFrame(() => sheet.classList.add('on'));
  sheet.querySelector('.vsheet-close').focus({ preventScroll: true });
}

function closeVehicle() {
  if (sheet.hidden) return;
  sheet.classList.remove('on');
  setTimeout(() => { sheet.hidden = true; }, 180);
}

// 引擎里点中信息牌时会调它。
window.__homePlate = openVehicle;

sheet.addEventListener('click', e => { if (e.target.closest('[data-vsheet-close]')) closeVehicle(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeVehicle(); });

// ---------- 按需进入 3D ----------
const hint = $('.hint');
const errorBox = $('#enterError');
const errorText = $('#enterErrorText');
let booted = false;
let watchdog = null;

// 引擎用的是 WebGL2（纹理数组、实例化、GLSL3），只有 WebGL1 的浏览器进来必崩，
// 所以在门外就分清三种情况：能用、只有旧版 WebGL、完全没有。
function webglSupport() {
  try {
    const canvas = document.createElement('canvas');
    if (canvas.getContext('webgl2')) return 'ok';
    if (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')) return 'legacy';
    return 'none';
  } catch (e) {
    return 'none';
  }
}

function showError(message) {
  if (errorBox) {
    errorBox.hidden = false;
    if (errorText) errorText.textContent = message;
  }
  if (hint) {
    hint.textContent = '3D 小屋没能启动，上面的内容可以正常阅读。';
    hint.classList.add('err');
  }
}

function backToCover() {
  document.documentElement.classList.remove('in-3d');
  // 引擎会把时段、涉水、第一人称等状态挂在 body 上，退回封面时一并清掉；
  // body 的背景被天气改写过，也要还原，否则封面会染上一层天空色。
  document.body.classList.remove('plain', 'night', 'in-pool', 'first-person', 'flying', 'portrait');
  document.body.style.background = '';
  booted = false;
  if (watchdog) { clearInterval(watchdog); watchdog = null; }
}

function enter(event) {
  if (event) event.preventDefault();
  if (booted) return;
  // 双击打开的本地文件里，浏览器不允许加载 3D 需要的模块；文字版不受影响。
  if (location.protocol === 'file:') {
    backToCover();
    showError('file · 双击本地文件时浏览器不允许加载 3D 模块。请通过站点地址打开，或在本目录执行 python3 -m http.server 后访问 localhost。');
    return;
  }

  const support = webglSupport();
  if (support !== 'ok') {
    backToCover();
    showError(support === 'legacy'
      ? 'webgl1 · 这台设备只支持旧版 WebGL，3D 小屋需要 WebGL2。换 Chrome / Edge 最新版，或在显示设置里打开“硬件加速”再试。'
      : 'webgl · 这个浏览器没有可用的 WebGL，通常是硬件加速被关掉了。');
    return;
  }

  booted = true;
  if (errorBox) errorBox.hidden = true;
  if (hint) { hint.textContent = '正在加载小屋，第一次需要几秒…'; hint.classList.remove('err'); }
  document.documentElement.classList.add('in-3d');

  let waited = 0;
  watchdog = setInterval(() => {
    // 引擎启动成功会把站点对象挂到 window.__home；失败会留下 __homeStartupError。
    if (window.__home) {
      clearInterval(watchdog); watchdog = null;
      openPageFromUrl();
      return;
    }
    const fail = window.__homeStartupError;
    if (fail) {
      clearInterval(watchdog); watchdog = null;
      backToCover();
      showError(`${fail.phase || 'startup'} · ${fail.message || '未知错误'}`);
      return;
    }
    waited += 400;
    if (waited > 25000) {
      clearInterval(watchdog); watchdog = null;
      backToCover();
      showError('timeout · 25 秒内没有加载完成');
    }
  }, 400);

  const entry = ASSET_BASE + ENTRY + '?v=' + RES_VER;
  import(entry).catch(async err => {
    // 线上偶发：CDN 把一条旧的 404 缓存住了，而文件其实已经存在。
    // 换一个全新的 query 再要一次，绕过所有缓存层；成功就让引擎自己继续启动。
    const retry = ASSET_BASE + ENTRY + '?t=' + Date.now().toString(36);
    try {
      await import(retry);
      return;
    } catch (err2) {
      backToCover();
      // 两次都失败才报错。顺带探测真实响应，否则浏览器只给一句 “Failed to fetch”，
      // 看不出到底是 404、服务端类型不对，还是请求根本没发出去。
      let detail = (err2 && err2.message) ? err2.message : String(err2 || err);
      try {
        const res = await fetch(retry, { cache: 'no-store' });
        const ct = res.headers.get('content-type') || '无';
        // 有时候服务器会用一个 200 的 HTML 页面顶替缺失的文件（服务器按扩展名给了 JS 类型），
        // 所以把正文开头也带出来，一眼就能区分“真文件”和“占位页”。
        let head = '';
        try {
          head = (await res.text()).trim().slice(0, 48).replace(/\s+/g, ' ');
        } catch (e) { head = '读取失败'; }
        detail += `（HTTP ${res.status}，${ct}；开头：${head}）`;
      } catch (e) {
        detail += '（探测请求也失败了，多半被网络策略拦掉）';
      }
      showError('import · ' + detail);
    }
  });
}

// 清掉浏览器与 CDN 这一侧能清的缓存，再用一个全新的地址重开页面。
// 只动缓存，不碰 localStorage 里的阅读位置等用户数据。
async function hardReload() {
  try {
    if (window.caches && typeof caches.keys === 'function') {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    }
  } catch (e) { /* 不支持 CacheStorage 就跳过 */ }
  try { sessionStorage.clear(); } catch (e) { /* 隐私模式下可能不可写 */ }
  try {
    const u = new URL(location.href);
    u.searchParams.set('fresh', Date.now().toString(36));
    location.replace(u.toString());
  } catch (e) {
    location.reload();
  }
}

document.addEventListener('click', e => {
  const reload = e.target.closest('[data-hard-reload]');
  if (reload) { e.preventDefault(); hardReload(); return; }
  const trigger = e.target.closest('[data-enter]');
  if (trigger) enter(e);
});

// 调试钩子：地址后加 ?autostart 就直接进屋，不用手点，方便反复排查加载问题。
if (new URLSearchParams(location.search).has('autostart')) {
  setTimeout(() => enter(), 200);
}

// 调试钩子：?page=works 进屋后直接弹开对应卡片，省得每次走过去按 F。
function openPageFromUrl() {
  const id = new URLSearchParams(location.search).get('page');
  if (!id || !window.__home || typeof window.__home.openPage !== 'function') return;
  setTimeout(() => window.__home.openPage(id), 800);
}

const back = $('#backToCover');
if (back) back.addEventListener('click', () => location.reload());

})();
