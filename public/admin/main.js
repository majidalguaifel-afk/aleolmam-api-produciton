/* التشغيل: الدخول — الإعداد الأولي — القائمة — التنقل — الأحداث */
(function () {
  'use strict';
  const { $, $$, esc, api, toast, S, modal, actions, forms, changes, pages } = ALM;

  const NAV = [
    { id: 'dashboard', ico: '📊', label: 'الرئيسية', title: 'الرئيسية' },
    { id: 'shipments', ico: '📦', label: 'الشحنات', title: 'الشحنات' },
    { id: 'dispatch', ico: '🚚', label: 'التوزيع', title: 'توزيع الشحنات على المناديب', badge: true },
    { id: 'map', ico: '🗺️', label: 'الخريطة', title: 'خريطة تتبع المناديب الحية' },
    { id: 'cash', ico: '💰', label: 'التحصيل اليومي', title: 'التحصيل اليومي لكل مندوب' },
    { id: 'drivers', ico: '👤', label: 'المناديب', title: 'المناديب' },
    { id: 'clients', ico: '🔑', label: 'العملاء والربط', title: 'العملاء ومفاتيح الربط', admin: true },
    { id: 'carriers', ico: '🌐', label: 'شركات الشحن', title: 'شركات الشحن والتوصيل', admin: true },
    { id: 'settings', ico: '⚙️', label: 'الإعدادات', title: 'الإعدادات' },
  ];
  const isAdminRole = () => S.user && ['SUPER_ADMIN', 'ADMIN'].includes(S.user.role);
  const allowedNav = () => NAV.filter((n) => !n.admin || isAdminRole());

  /* ---------- التنقل ---------- */
  ALM.go = (page) => {
    const h = '#/' + page;
    if (location.hash === h) route(); else location.hash = h;
  };
  function currentPageFromHash() {
    const p = (location.hash || '').replace(/^#\/?/, '') || 'dashboard';
    return allowedNav().some((n) => n.id === p) ? p : 'dashboard';
  }
  function route() {
    if (!S.user) return;
    S.page = currentPageFromHash();
    $$('.nav button').forEach((b) => b.classList.toggle('active', b.dataset.page === S.page));
    const meta = NAV.find((n) => n.id === S.page);
    const t = $('#page-title');
    if (t) t.textContent = meta ? meta.title : '';
    document.body.classList.remove('nav-open');
    if (modal.isOpen() && !modal.isLocked()) modal.close();
    if (S.page !== 'map' && ALM.destroyMap) ALM.destroyMap();
    const render = pages[S.page];
    if (render) render();
    if (ALM.refreshBadges) ALM.refreshBadges();
    window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', route);

  /* ---------- الهيكل ---------- */
  function renderShell() {
    $('#root').innerHTML = `<div class="app">
      <aside class="sidebar">
        <div class="brand"><div class="logo-box"><img src="logo.png" alt="الإلمام"></div>
          <div class="name">شركة الإلمام</div><div class="sub">للخدمات اللوجستية</div></div>
        <nav class="nav">${allowedNav().map((n) => `<button data-action="nav" data-page="${n.id}"><span class="ico">${n.ico}</span><span>${n.label}</span>${n.badge ? '<span class="count hidden" id="nav-count-dispatch">0</span>' : ''}</button>`).join('')}</nav>
        <div class="side-foot"><div class="who">${esc(S.user.name)}</div><div>${esc(ALM.ROLE[S.user.role] || S.user.role)}</div><button data-action="logout">تسجيل الخروج</button></div>
      </aside>
      <div class="main">
        <header class="topbar"><button class="menu-btn" data-action="toggle-nav" aria-label="القائمة">☰</button><h1 id="page-title"></h1>
          <a class="btn ghost sm" href="/api-docs" target="_blank" rel="noopener">📖 التوثيق التقني</a></header>
        <div class="content" id="view"></div>
      </div></div>`;
  }

  async function startApp() {
    renderShell();
    try { await ALM.loadRefs(); } catch (e) { toast('تعذّر تحميل بعض البيانات المرجعية', 'err'); }
    if (!location.hash) location.hash = '#/dashboard'; else route();
    if (S.mustChange) forcePasswordChange();
  }

  function forcePasswordChange() {
    modal.open('⚠️ غيّر كلمة المرور الآن', `<div class="hint danger" style="margin-bottom:14px">حسابك يستخدم <b>كلمة المرور الافتراضية</b> المعروفة للجميع. لحماية النظام وبيانات عملائك، اختر كلمة مرور جديدة قبل المتابعة.</div>${ALM.pwForm('change-password-forced')}`, { lock: true });
  }
  forms['change-password-forced'] = async (form) => {
    if (await ALM.submitPasswordChange(form)) { S.mustChange = false; modal.close(); }
  };

  /* ---------- الدخول والإعداد الأولي ---------- */
  function renderLogin(needsSetup, requiresKey) {
    $('#root').innerHTML = `<div class="login-wrap"><div class="login-card">
      <div class="logo"><img src="logo.png" alt="الإلمام"></div>
      <h1>${needsSetup ? 'أهلاً بك في لوحة الإلمام' : 'لوحة تحكم الإلمام'}</h1>
      <p class="sub">${needsSetup ? 'هذه أول مرة يُشغَّل فيها النظام. أنشئ حساب المدير الأول للبدء.' : 'سجّل الدخول لإدارة الشحنات والعملاء'}</p>
      <div id="login-err" class="hint danger hidden" style="margin-bottom:12px"></div>
      ${needsSetup ? `<form data-form="setup">
          ${requiresKey ? '<div class="field"><label>مفتاح الإعداد (SETUP_KEY من إعدادات الخادم)</label><input name="setupKey" type="password" required autocomplete="off"></div>' : ''}
          <div class="field"><label>اسمك</label><input name="name" required minlength="2" autocomplete="name"></div>
          <div class="field"><label>البريد الإلكتروني</label><input name="email" type="email" required autocomplete="username"></div>
          <div class="field"><label>كلمة المرور (8 أحرف فأكثر)</label><input name="password" type="password" required minlength="8" autocomplete="new-password"></div>
          <div class="field"><label>تأكيد كلمة المرور</label><input name="password2" type="password" required minlength="8" autocomplete="new-password"></div>
          <button class="btn gold" type="submit">إنشاء الحساب والبدء</button></form>`
      : `<form data-form="login">
          <div class="field"><label>البريد الإلكتروني</label><input name="email" type="email" required autocomplete="username" autofocus></div>
          <div class="field"><label>كلمة المرور</label><input name="password" type="password" required autocomplete="current-password"></div>
          <button class="btn gold" type="submit">دخول</button></form>`}
    </div></div>`;
  }
  function loginError(msg) {
    const b = $('#login-err');
    if (b) { b.textContent = msg; b.classList.remove('hidden'); }
    toast(msg, 'err');
  }
  async function onAuthed(data) {
    S.token = data.token;
    localStorage.setItem('alm_admin_token', data.token);
    S.user = data.user;
    S.mustChange = !!data.mustChangePassword;
    location.hash = '';
    await startApp();
  }
  forms.login = async (form) => {
    const d = ALM.formData(form);
    try {
      const r = await api('/auth/login', { method: 'POST', auth: false, body: { email: d.email, password: d.password } });
      await onAuthed(r.data);
    } catch (e) { loginError(e.message); }
  };
  forms.setup = async (form) => {
    const d = ALM.formData(form);
    if (d.password !== d.password2) return loginError('كلمتا المرور غير متطابقتين');
    try {
      const r = await api('/setup', { method: 'POST', auth: false, body: { name: d.name, email: d.email, password: d.password, setupKey: d.setupKey } });
      await onAuthed(r.data);
      toast('تم إنشاء حسابك — أهلاً بك 👋', 'ok');
    } catch (e) { loginError(e.message); }
  };
  function logout(msg) {
    S.token = ''; S.user = null; S.mustChange = false;
    localStorage.removeItem('alm_admin_token');
    modal.close();
    location.hash = '';
    renderLogin(false);
    if (msg) toast(msg, 'err');
  }
  ALM.onUnauthorized = () => { if (S.user) logout('انتهت الجلسة — سجّل الدخول من جديد'); };

  /* ---------- الأوامر العامة ---------- */
  actions.nav = (el) => ALM.go(el.dataset.page);
  actions.logout = () => logout();
  actions['toggle-nav'] = () => document.body.classList.toggle('nav-open');
  actions['close-modal'] = () => { if (!modal.isLocked()) modal.close(); };

  /* ---------- ربط الأحداث (تفويض عام — متوافق مع سياسة الأمان CSP) ---------- */
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-action]');
    if (t) {
      const fn = actions[t.dataset.action];
      if (fn) { e.preventDefault(); fn(t, e); }
      return;
    }
    if (e.target.classList && e.target.classList.contains('overlay') && !e.target.hasAttribute('data-lock')) modal.close();
  });
  document.addEventListener('submit', (e) => {
    const f = e.target.closest('form[data-form]');
    if (!f) return;
    e.preventDefault();
    const fn = forms[f.dataset.form];
    if (!fn || f.dataset.busy) return;
    f.dataset.busy = '1';
    Promise.resolve(fn(f)).finally(() => { delete f.dataset.busy; });
  });
  document.addEventListener('change', (e) => {
    const t = e.target.closest('[data-change]');
    if (!t) return;
    const fn = changes[t.dataset.change];
    if (fn) fn(t, e);
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && modal.isOpen() && !modal.isLocked()) modal.close(); });

  /* ---------- الإقلاع ---------- */
  async function boot() {
    if (S.token) {
      try {
        const me = await api('/auth/me');
        S.user = me.data;
        return startApp();
      } catch (e) { S.token = ''; localStorage.removeItem('alm_admin_token'); }
    }
    let needsSetup = false, requiresKey = false;
    try { const st = await fetch('/api/v1/setup/status').then((r) => r.json()); needsSetup = st.needsSetup; requiresKey = st.requiresKey; } catch (e) { /* ignore */ }
    renderLogin(needsSetup, requiresKey);
  }
  ALM.boot = boot;
  boot();
})();
