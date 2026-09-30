/* صفحات: المناديب — العملاء والربط — شركات الشحن — الإعدادات */
(function () {
  'use strict';
  const { $, esc, api, toast, S, fmtDT, fmtD, modal, setView, loading, errorView, actions, forms, changes, pages } = ALM;

  const ROLE = { SUPER_ADMIN: 'مدير عام', ADMIN: 'مدير', OPERATOR: 'موظف تشغيل' };
  ALM.ROLE = ROLE;
  const PHONE_ATTR = 'pattern="(05|9665|\\+9665)[0-9]{8}" title="رقم جوال سعودي مثل 0512345678" inputmode="tel"';

  /* ================= المناديب ================= */
  pages.drivers = async function () {
    loading();
    try {
      const r = await api('/internal/drivers');
      S.refs.drivers = r.data;
      const rows = r.data.map((d) => `<tr>
        <td><b>${esc(d.name)}</b></td>
        <td><a class="mono" href="tel:${esc(d.phone)}">${esc(d.phone)}</a></td>
        <td>${esc(d.vehicle_info || '—')}</td>
        <td>${d.active_shipments ? `<span class="badge gold">${d.active_shipments} قيد التوصيل</span>` : '<span class="muted">—</span>'}</td>
        <td>${d.delivered_count}</td>
        <td>${d.is_active ? '<span class="badge green">مفعّل</span>' : '<span class="badge gray">موقوف</span>'}</td>
        <td class="actions"><div class="row">
          <button class="btn ghost sm" data-action="regen-pin" data-id="${esc(d.id)}" data-name="${esc(d.name)}">🔑 رمز جديد</button>
          <button class="btn ${d.is_active ? 'danger' : 'ok'} sm" data-action="toggle-driver" data-id="${esc(d.id)}" data-active="${d.is_active ? '1' : '0'}">${d.is_active ? 'إيقاف' : 'تفعيل'}</button>
        </div></td>
      </tr>`).join('');
      if (S.page !== 'drivers') return; // المستخدم انتقل لصفحة أخرى أثناء التحميل
      setView(`
        <div class="card"><h2>إضافة مندوب</h2>
          <form data-form="add-driver" class="grid g4" style="align-items:end">
            <div class="field"><label>الاسم</label><input name="name" required minlength="2"></div>
            <div class="field"><label>الجوال</label><input name="phone" required ${PHONE_ATTR} placeholder="05xxxxxxxx"></div>
            <div class="field"><label>المركبة</label><input name="vehicleInfo" placeholder="مثال: هايلكس — أ ب ج 1234"></div>
            <div><button class="btn gold" type="submit">+ إضافة</button></div>
          </form></div>
        <div class="card"><h2>المناديب <small>(${r.data.length})</small></h2>
          ${r.data.length ? `<div class="table-wrap"><table><thead><tr><th>الاسم</th><th>الجوال</th><th>المركبة</th><th>الحالية</th><th>المُسلَّمة</th><th>الحالة</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>` : '<div class="empty"><span class="big">👤</span>لا يوجد مناديب بعد — أضف أول مندوب من الأعلى</div>'}
        </div>`);
    } catch (e) { if (S.page === 'drivers') errorView(e); }
  };
  forms['add-driver'] = async (form) => {
    const d = ALM.formData(form);
    try {
      const r = await api('/internal/drivers', { method: 'POST', body: { name: d.name, phone: d.phone, vehicleInfo: d.vehicleInfo || undefined } });
      form.reset();
      showPinModal('تمت إضافة ' + r.data.name, r.data);
      pages.drivers();
    } catch (e) { toast(e.message, 'err'); }
  };
  function showPinModal(title, driver) {
    modal.open(title, `
      <div class="hint warn" style="margin-bottom:12px">⚠️ <b>انسخ رمز الدخول الآن</b> — لن يظهر مرة ثانية. سلّمه للمندوب مع رقم جواله ليدخل به على تطبيق الجوال.</div>
      <div class="keybox"><code style="font-size:24px;letter-spacing:4px">${esc(driver.pin)}</code><button class="btn gold sm" data-action="copy-text" data-text="${esc(driver.pin)}">📋 نسخ</button></div>
      <dl class="kv" style="margin-top:14px"><dt>الاسم</dt><dd>${esc(driver.name)}</dd><dt>الجوال</dt><dd class="mono">${esc(driver.phone)}</dd></dl>
      <p class="muted" style="margin-top:10px">يدخل المندوب في التطبيق برقم جواله وهذا الرمز المكوّن من 6 أرقام.</p>
      <div class="row" style="margin-top:14px;justify-content:flex-end"><button class="btn ghost" data-action="close-modal">إغلاق</button></div>`);
  }
  actions['regen-pin'] = async (el) => {
    if (!confirm(`توليد رمز دخول جديد لـ ${el.dataset.name}؟\nالرمز القديم يتوقف فوراً.`)) return;
    try {
      const r = await api(`/internal/drivers/${encodeURIComponent(el.dataset.id)}/regenerate-pin`, { method: 'POST' });
      showPinModal('رمز جديد لـ ' + el.dataset.name, { name: el.dataset.name, phone: '', pin: r.data.pin });
    } catch (e) { toast(e.message, 'err'); }
  };
  actions['toggle-driver'] = async (el) => {
    const on = el.dataset.active === '1';
    if (on && !confirm('إيقاف هذا المندوب؟ لن يظهر في قوائم التعيين.')) return;
    try { await api(`/internal/drivers/${encodeURIComponent(el.dataset.id)}/${on ? 'deactivate' : 'activate'}`, { method: 'POST' }); toast('تم التحديث ✓', 'ok'); pages.drivers(); }
    catch (e) { toast(e.message, 'err'); }
  };

  /* ================= العملاء والربط ================= */
  pages.clients = async function () {
    loading();
    try {
      const r = await api('/auth/admin/clients');
      S.refs.clients = r.data;
      const rows = r.data.map((c) => `<tr>
        <td><b>${esc(c.name)}</b><div class="muted">${esc(c.contact_email)}${c.contact_phone ? ' · ' + esc(c.contact_phone) : ''}</div></td>
        <td class="mono">${esc(c.api_key_prefix)}</td>
        <td>${c.status === 'ACTIVE' ? '<span class="badge green">فعّال</span>' : '<span class="badge red">موقوف</span>'}</td>
        <td>${c.shipments_count}</td>
        <td>${c.webhooks_count ? `<a href="#" data-action="view-webhooks" data-id="${esc(c.id)}" data-name="${esc(c.name)}">${c.webhooks_count} رابط</a>` : '<span class="muted">—</span>'}</td>
        <td>${c.rate_limit}/د</td>
        <td class="actions"><div class="row">
          <button class="btn ghost sm" data-action="client-guide" data-id="${esc(c.id)}" data-name="${esc(c.name)}">📘 دليل الربط</button>
          <button class="btn ghost sm" data-action="regen-key" data-id="${esc(c.id)}" data-name="${esc(c.name)}">🔄 مفتاح جديد</button>
          <button class="btn ${c.status === 'ACTIVE' ? 'danger' : 'ok'} sm" data-action="toggle-client" data-id="${esc(c.id)}" data-status="${esc(c.status)}">${c.status === 'ACTIVE' ? 'إيقاف' : 'تفعيل'}</button>
        </div></td></tr>`).join('');
      if (S.page !== 'clients') return; // المستخدم انتقل لصفحة أخرى أثناء التحميل
      setView(`
        <div class="card">
          <div class="card-head"><h2>العملاء والربط <small>(${r.data.length})</small></h2><button class="btn gold" data-action="new-client">+ عميل جديد</button></div>
          <div class="hint" style="margin-bottom:12px">كل شركة أو متجر يرسل لك طلبات (مثل <b>أوتو</b>) يحصل على <b>حساب ومفتاح ربط خاص</b>. أنشئ الحساب، وسلّم المفتاح مع "دليل الربط" الجاهز لمبرمجهم، وينتهي الموضوع.</div>
          ${r.data.length ? `<div class="table-wrap"><table><thead><tr><th>العميل</th><th>مفتاح الربط</th><th>الحالة</th><th>الشحنات</th><th>إشعارات فورية</th><th>الحد</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>` : '<div class="empty"><span class="big">🔑</span>لا يوجد عملاء بعد</div>'}
        </div>`);
    } catch (e) { if (S.page === 'clients') errorView(e); }
  };

  actions['new-client'] = () => {
    modal.open('عميل جديد', `<form data-form="new-client">
      <div class="grid g2">
        <div class="field"><label>اسم الشركة / المتجر</label><input name="name" required minlength="2" placeholder="مثال: شركة أوتو"></div>
        <div class="field"><label>البريد الإلكتروني للتواصل</label><input name="contactEmail" type="email" required></div>
        <div class="field"><label>جوال التواصل (اختياري)</label><input name="contactPhone"></div>
        <div class="field"><label>الحد الأقصى للطلبات بالدقيقة</label><input name="rateLimit" type="number" min="1" max="10000" value="100"></div>
      </div>
      <div class="row" style="margin-top:14px;justify-content:flex-end"><button class="btn ghost" type="button" data-action="close-modal">إلغاء</button><button class="btn gold" type="submit">إنشاء الحساب والمفتاح</button></div></form>`);
  };
  forms['new-client'] = async (form) => {
    const d = ALM.formData(form);
    try {
      const r = await api('/auth/admin/clients', { method: 'POST', body: { name: d.name, contactEmail: d.contactEmail, contactPhone: d.contactPhone || undefined, rateLimit: Number(d.rateLimit) || 100 } });
      showKeyModal('تم إنشاء حساب ' + r.data.name, r.data.name, r.data.apiKey);
      if (S.page === 'clients') pages.clients();
      ALM.loadRefs();
    } catch (e) { toast(e.message, 'err'); }
  };

  function showKeyModal(title, name, key) {
    modal.open(title, `
      <div class="hint warn" style="margin-bottom:12px">⚠️ <b>انسخ المفتاح الآن</b> — لأسباب أمنية لن يظهر مرة ثانية. لو ضاع تقدر تولّد مفتاحاً جديداً (والقديم يتوقف).</div>
      <div class="keybox"><code>${esc(key)}</code><button class="btn gold sm" data-action="copy-text" data-text="${esc(key)}">📋 نسخ</button></div>
      <div class="row" style="margin:14px 0"><button class="btn" data-action="print-guide" data-key="${esc(key)}" data-name="${esc(name)}">🖨️ طباعة دليل الربط للعميل</button><span class="muted">أو انسخ الأمثلة أدناه وأرسلها له</span></div>
      ${ALM.guide.html(location.origin, key, { clientName: name })}`, { wide: true });
  }

  actions['client-guide'] = (el) => {
    modal.open('دليل الربط — ' + el.dataset.name, `
      <div class="hint" style="margin-bottom:12px">هذا الدليل يحتوي مكان المفتاح نصاً بديلاً. المفتاح الحقيقي يظهر لك مرة واحدة عند إنشاء الحساب أو عند "مفتاح جديد".</div>
      <div class="row" style="margin-bottom:10px"><button class="btn" data-action="print-guide" data-key="ضع_مفتاح_العميل_هنا" data-name="${esc(el.dataset.name)}">🖨️ طباعة الدليل</button></div>
      ${ALM.guide.html(location.origin, 'ضع_مفتاح_العميل_هنا', { clientName: el.dataset.name })}`, { wide: true });
  };
  actions['print-guide'] = (el) => ALM.print(ALM.guide.html(location.origin, el.dataset.key, { clientName: el.dataset.name, forPrint: true }));
  actions['copy-text'] = (el) => ALM.copy(el.dataset.text);
  actions['guide-tab'] = (el) => {
    const g = el.closest('.guide') || el.closest('.modal-body');
    ALM.$$('.tabs button', g).forEach((b) => b.classList.toggle('active', b === el));
    ALM.$$('[data-guide-panel]', g).forEach((p) => p.classList.toggle('hidden', p.dataset.guidePanel !== el.dataset.lang));
  };
  actions['copy-guide'] = (el) => {
    const g = el.closest('.guide') || el.closest('.modal-body');
    const code = $(`[data-code="${el.dataset.lang}"]`, g);
    if (code) ALM.copy(code.textContent);
  };
  actions['regen-key'] = async (el) => {
    if (!confirm(`توليد مفتاح جديد لـ ${el.dataset.name}؟\nالمفتاح القديم سيتوقف عن العمل فوراً وسيحتاج العميل لتحديثه في نظامه.`)) return;
    try {
      const r = await api(`/auth/admin/clients/${encodeURIComponent(el.dataset.id)}/regenerate-key`, { method: 'POST' });
      showKeyModal('مفتاح جديد لـ ' + el.dataset.name, el.dataset.name, r.data.apiKey);
      pages.clients();
    } catch (e) { toast(e.message, 'err'); }
  };
  actions['toggle-client'] = async (el) => {
    const active = el.dataset.status === 'ACTIVE';
    if (active && !confirm('إيقاف هذا العميل؟ ستتوقف طلباته فوراً (يظهر له خطأ عند أي محاولة).')) return;
    try { await api(`/auth/admin/clients/${encodeURIComponent(el.dataset.id)}/${active ? 'suspend' : 'activate'}`, { method: 'POST' }); toast('تم التحديث ✓', 'ok'); pages.clients(); ALM.loadRefs(); }
    catch (e) { toast(e.message, 'err'); }
  };
  actions['view-webhooks'] = async (el) => {
    try {
      const r = await api(`/admin/clients/${encodeURIComponent(el.dataset.id)}/webhooks`);
      modal.open('الإشعارات الفورية — ' + el.dataset.name, r.data.length
        ? `<div class="table-wrap"><table><thead><tr><th>الرابط</th><th>الأحداث</th><th>الحالة</th><th>تاريخ التسجيل</th></tr></thead><tbody>${r.data.map((w) => `<tr><td class="mono">${esc(w.url)}</td><td>${esc(w.events)}</td><td>${w.is_active ? 'فعّال' : 'متوقف'}</td><td class="muted">${fmtD(w.created_at)}</td></tr>`).join('')}</tbody></table></div>`
        : '<div class="empty">لا توجد روابط مسجّلة</div>');
    } catch (e) { toast(e.message, 'err'); }
  };

  /* ================= شركات الشحن ================= */
  pages.carriers = async function () {
    loading();
    try {
      const r = await api('/admin/carriers');
      S.refs.carriers = r.data;
      const canEdit = ['SUPER_ADMIN', 'ADMIN'].includes(S.user.role);
      const cards = r.data.map((c) => {
        let badge, body;
        if (c.kind === 'internal') {
          badge = '<span class="badge green">جاهز — أسطولكم</span>';
          body = '<p class="muted" style="margin:0">الشحنات المرسلة لهذا الخيار يوصّلها مناديبكم. توزّعها من صفحة <a href="#/dispatch">التوزيع</a>. لا يحتاج أي إعداد.</p>';
        } else if (c.kind === 'mock') {
          badge = '<span class="badge gray">للتجربة فقط</span>';
          body = '<p class="muted" style="margin:0">شركة وهمية لتجربة النظام بدون أي ربط حقيقي. يُنصح بتعطيلها عند التشغيل الفعلي.</p>';
        } else {
          badge = c.configured ? '<span class="badge green">بيانات الربط مُدخلة</span>' : '<span class="badge gray">غير مربوط</span>';
          const fields = c.fields.map((f) => `<div class="field"><label>${esc(f.label)}${f.required ? ' *' : ''}</label>
            <input name="${esc(f.key)}" ${f.secret ? 'type="password" autocomplete="new-password"' : ''} value="${esc(f.value)}" placeholder="${esc(f.secret && f.isSet ? '•••••••• (محفوظ — اتركه فارغاً للإبقاء)' : f.placeholder)}" ${canEdit ? '' : 'disabled'}></div>`).join('');
          body = `<div class="hint warn" style="margin-bottom:12px">⚠️ للربط الفعلي تحتاج <b>حساب أعمال رسمي</b> لدى ${esc(c.nameAr)} (اطلبه من مدير حسابكم عندهم). بعد إدخال بياناتك هنا، اطلب من فنّي مطابقة مسارات الربط مع التوثيق الرسمي للشركة <b>قبل أول شحنة حقيقية</b> — قوالب الربط الحالية مبنية على البنية العامة لواجهاتهم وتحتاج هذا التأكيد النهائي.</div>
            <form data-form="carrier-config" data-code="${esc(c.code)}"><div class="grid g2">${fields}</div>
            ${canEdit ? '<div class="row" style="margin-top:12px"><button class="btn gold" type="submit">💾 حفظ بيانات الربط</button><span class="muted">تُحفظ مشفّرة ولا تظهر لأحد بعد الحفظ.</span></div>' : ''}</form>`;
        }
        return `<div class="carrier-card"><div class="carrier-head"><h3>${esc(c.nameAr)}</h3>${badge}<span class="spacer"></span>
          <label class="switch"><input type="checkbox" data-change="toggle-carrier" data-code="${esc(c.code)}" ${c.isActive ? 'checked' : ''} ${canEdit ? '' : 'disabled'}> مفعّلة</label></div>${body}</div>`;
      }).join('');
      if (S.page !== 'carriers') return; // المستخدم انتقل لصفحة أخرى أثناء التحميل
      setView(`<div class="card"><div class="card-head"><h2>شركات الشحن والتوصيل</h2></div>
        <div class="hint" style="margin-bottom:14px">هنا تتحكم بكل الجهات اللي تقدر توصّل بها الشحنات: أسطولكم الداخلي، وأي شركة شحن خارجية تربطها. <b>عطّل</b> أي شركة لا تريد استقبال طلبات عليها.</div>${cards}</div>`);
    } catch (e) { if (S.page === 'carriers') errorView(e); }
  };
  forms['carrier-config'] = async (form) => {
    const values = ALM.formData(form);
    try {
      await api(`/admin/carriers/${encodeURIComponent(form.dataset.code)}/config`, { method: 'PUT', body: values });
      toast('تم حفظ بيانات الربط ✓', 'ok');
      pages.carriers();
    } catch (e) { toast(e.message, 'err'); }
  };
  changes['toggle-carrier'] = async (el) => {
    try {
      await api(`/admin/carriers/${encodeURIComponent(el.dataset.code)}/toggle`, { method: 'POST', body: { isActive: el.checked } });
      toast(el.checked ? 'تم تفعيل الشركة ✓' : 'تم تعطيل الشركة', 'ok');
      ALM.loadRefs();
    } catch (e) { el.checked = !el.checked; toast(e.message, 'err'); }
  };

  /* ================= الإعدادات ================= */
  ALM.submitPasswordChange = async (form) => {
    const d = ALM.formData(form);
    if (d.newPassword !== d.newPassword2) { toast('كلمتا المرور الجديدتان غير متطابقتين', 'err'); return false; }
    try {
      await api('/auth/change-password', { method: 'POST', body: { currentPassword: d.currentPassword, newPassword: d.newPassword } });
      toast('تم تغيير كلمة المرور ✓', 'ok');
      return true;
    } catch (e) { toast(e.message, 'err'); return false; }
  };
  const pwForm = (name) => `<form data-form="${name}" class="grid g3" style="align-items:end">
    <div class="field"><label>كلمة المرور الحالية</label><input type="password" name="currentPassword" required autocomplete="current-password"></div>
    <div class="field"><label>كلمة المرور الجديدة (8 أحرف فأكثر)</label><input type="password" name="newPassword" required minlength="8" autocomplete="new-password"></div>
    <div class="field"><label>تأكيد كلمة المرور الجديدة</label><input type="password" name="newPassword2" required minlength="8" autocomplete="new-password"></div>
    <div><button class="btn gold" type="submit">تغيير كلمة المرور</button></div></form>`;
  ALM.pwForm = pwForm;
  forms['change-password'] = async (form) => { if (await ALM.submitPasswordChange(form)) form.reset(); };

  pages.settings = async function () {
    loading();
    try {
      const isSuper = S.user.role === 'SUPER_ADMIN';
      let users = [];
      if (isSuper) users = (await api('/admin/users')).data;
      let health = '—';
      try { const h = await fetch('/health').then((r) => r.json()); health = h.status === 'ok' ? '<span class="badge green">الخادم يعمل بشكل سليم</span>' : '<span class="badge red">مشكلة</span>'; } catch (e) { health = '<span class="badge red">تعذّر الفحص</span>'; }

      const usersCard = isSuper ? `<div class="card"><h2>فريق العمل</h2>
        <div class="hint" style="margin-bottom:12px"><b>مدير عام</b>: كل الصلاحيات · <b>مدير</b>: العملاء وشركات الشحن والشحنات · <b>موظف تشغيل</b>: يتابع الشحنات ويوزّعها فقط.</div>
        <div class="table-wrap"><table><thead><tr><th>الاسم</th><th>البريد</th><th>الدور</th><th></th></tr></thead><tbody>${users.map((u) => `<tr><td><b>${esc(u.name)}</b></td><td class="mono">${esc(u.email)}</td><td>${esc(ROLE[u.role] || u.role)}</td><td class="actions">${u.id === S.user.id ? '<span class="muted">(أنت)</span>' : `<button class="btn danger sm" data-action="del-user" data-id="${esc(u.id)}" data-name="${esc(u.name)}">حذف</button>`}</td></tr>`).join('')}</tbody></table></div>
        <h3 style="font-size:14px;margin:16px 0 8px">إضافة موظف</h3>
        <form data-form="add-user" class="grid g4" style="align-items:end">
          <div class="field"><label>الاسم</label><input name="name" required minlength="2"></div>
          <div class="field"><label>البريد الإلكتروني</label><input name="email" type="email" required></div>
          <div class="field"><label>كلمة مرور مؤقتة (8+)</label><input name="password" type="password" required minlength="8" autocomplete="new-password"></div>
          <div class="field"><label>الدور</label><select name="role"><option value="OPERATOR">موظف تشغيل</option><option value="ADMIN">مدير</option><option value="SUPER_ADMIN">مدير عام</option></select></div>
          <div><button class="btn gold" type="submit">+ إضافة</button></div></form></div>` : '';

      if (S.page !== 'settings') return; // المستخدم انتقل لصفحة أخرى أثناء التحميل
      setView(`
        <div class="card"><h2>حسابي</h2>
          <dl class="kv" style="margin-bottom:14px"><dt>الاسم</dt><dd>${esc(S.user.name)}</dd><dt>البريد</dt><dd class="mono">${esc(S.user.email)}</dd><dt>الدور</dt><dd>${esc(ROLE[S.user.role] || S.user.role)}</dd></dl>
          ${pwForm('change-password')}</div>
        ${usersCard}
        <div class="card"><h2>معلومات النظام</h2><dl class="kv">
          <dt>رابط الخادم</dt><dd class="mono">${esc(location.origin)} <button class="btn ghost sm" data-action="copy-text" data-text="${esc(location.origin)}">نسخ</button></dd>
          <dt>حالة الخادم</dt><dd>${health}</dd>
          <dt>التوثيق التقني</dt><dd><a href="/api-docs" target="_blank" rel="noopener">${esc(location.origin)}/api-docs</a> — للمبرمجين فقط</dd>
        </dl></div>`);
    } catch (e) { if (S.page === 'settings') errorView(e); }
  };
  forms['add-user'] = async (form) => {
    const d = ALM.formData(form);
    try { await api('/admin/users', { method: 'POST', body: { name: d.name, email: d.email, password: d.password, role: d.role } }); toast('تمت إضافة الموظف ✓', 'ok'); pages.settings(); }
    catch (e) { toast(e.message, 'err'); }
  };
  actions['del-user'] = async (el) => {
    if (!confirm(`حذف حساب ${el.dataset.name}؟`)) return;
    try { await api(`/admin/users/${encodeURIComponent(el.dataset.id)}`, { method: 'DELETE' }); toast('تم الحذف', 'ok'); pages.settings(); }
    catch (e) { toast(e.message, 'err'); }
  };
})();
