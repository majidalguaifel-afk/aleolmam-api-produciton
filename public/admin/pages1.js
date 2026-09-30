/* صفحات: الرئيسية — الشحنات — التوزيع */
(function () {
  'use strict';
  const { $, esc, api, toast, S, statusBadge, fmtDT, money, modal, setView, loading, errorView, actions, forms, changes, pages, FINAL, STATUS } = ALM;

  const DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  const isFinal = (st) => FINAL.includes(st);
  const activeDrivers = () => S.refs.drivers.filter((d) => d.is_active);
  const driverOptions = (sel) => activeDrivers().map((d) => `<option value="${esc(d.id)}" ${d.id === sel ? 'selected' : ''}>${esc(d.name)}</option>`).join('');
  const SRC = { internal: 'الإلمام', system: 'النظام', carrier: 'شركة الشحن' };
  function toWhatsappIntl(phone) {
    const d = String(phone).replace(/\D/g, '');
    if (d.startsWith('966')) return d;
    if (d.startsWith('05')) return '966' + d.slice(1);
    if (d.startsWith('5')) return '966' + d;
    return d;
  }
  const STATUS_TEXT = {
    PICKED_UP: 'استلم المندوب الشحنة من المرسل',
    IN_TRANSIT: 'الشحنة في الطريق',
    OUT_FOR_DELIVERY: 'خرج المندوب لتوصيل الشحنة',
    DELIVERED: 'تم تسليم الشحنة للمستلم',
  };

  function refreshBackground() {
    const p = pages[S.page];
    if (p) p();
    if (ALM.refreshBadges) ALM.refreshBadges();
  }

  ALM.refreshBadges = async function () {
    try {
      const r = await api('/admin/stats');
      const n = r.data.totals.pendingDispatch;
      const b = $('#nav-count-dispatch');
      if (b) { b.textContent = n; b.classList.toggle('hidden', !n); }
    } catch (e) { /* صامت */ }
  };

  /* ================= جدول الشحنات المشترك ================= */
  function shipmentsTable(items) {
    if (!items.length) return '<div class="empty"><span class="big">📦</span>لا توجد شحنات مطابقة</div>';
    return `<div class="table-wrap"><table><thead><tr>
      <th>المرجع</th><th>العميل</th><th>الوجهة</th><th>الشركة / المندوب</th><th>التحصيل</th><th>الحالة</th><th>التاريخ</th><th></th>
    </tr></thead><tbody>${items.map((s) => `<tr>
      <td><b class="mono">${esc(s.reference)}</b></td>
      <td>${esc(s.client_name)}</td>
      <td>${esc(s.sender_city)} ← ${esc(s.recipient_city)}<div class="muted">${esc(s.recipient_name)} · <span class="mono">${esc(s.recipient_phone)}</span></div></td>
      <td>${esc(s.carrier_name_ar)}${s.driver_name ? `<div class="muted">🚚 ${esc(s.driver_name)}</div>` : ''}</td>
      <td>${s.cod_amount ? money(s.cod_amount) + ' ر.س' : '—'}</td>
      <td>${statusBadge(s.status)}</td>
      <td class="muted">${fmtDT(s.created_at)}</td>
      <td class="actions"><button class="btn ghost sm" data-action="open-shipment" data-id="${esc(s.id)}">عرض</button></td>
    </tr>`).join('')}</tbody></table></div>`;
  }

  /* ================= الرئيسية ================= */
  pages.dashboard = async function () {
    loading();
    try {
      const [st, recent] = await Promise.all([api('/admin/stats'), api('/admin/shipments?pageSize=6')]);
      const d = st.data, t = d.totals;
      const card = (num, lbl, cls, go) => `<div class="stat ${cls || ''} ${go ? 'clickable' : ''}" ${go ? `data-action="goto" data-go="${go}"` : ''}><div class="num">${num}</div><div class="lbl">${lbl}</div></div>`;

      const max = Math.max(1, ...d.last7.map((x) => x.count));
      const bars = d.last7.map((x) => {
        const dt = new Date(x.day + 'T00:00:00Z');
        return `<div class="bar-col"><div class="v">${x.count}</div><div class="bar" style="height:${Math.max(3, Math.round((x.count / max) * 100))}%"></div><div class="d">${DAYS[dt.getUTCDay()]}<br>${x.day.slice(8, 10)}/${x.day.slice(5, 7)}</div></div>`;
      }).join('');

      const cmax = Math.max(1, ...d.byCarrier.map((c) => c.count));
      const byCarrier = d.byCarrier.length
        ? d.byCarrier.map((c) => `<div style="margin-bottom:10px"><div class="row"><span>${esc(c.name)}</span><span class="spacer"></span><b>${c.count}</b></div><div class="hbar"><i style="width:${Math.round((c.count / cmax) * 100)}%"></i></div></div>`).join('')
        : '<div class="empty">لا توجد بيانات بعد</div>';

      const extConfigured = S.refs.carriers.some((c) => c.kind === 'external' && c.configured);
      const alerts = [];
      if (t.pendingDispatch > 0) alerts.push(`<div class="hint danger row"><span>🚚 <b>${t.pendingDispatch}</b> شحنة بانتظار تعيين مندوب</span><span class="spacer"></span><button class="btn gold sm" data-action="goto" data-go="dispatch">افتح التوزيع</button></div>`);
      if (t.problems > 0) alerts.push(`<div class="hint warn row"><span>⚠️ <b>${t.problems}</b> شحنة فشلت أو مرتجعة وتحتاج متابعة</span><span class="spacer"></span><button class="btn ghost sm" data-action="goto" data-go="shipments:FAILED">عرض</button></div>`);
      if (d.drivers === 0) alerts.push(`<div class="hint warn row"><span>👤 لا يوجد مناديب مفعّلين — أضف مندوباً لتبدأ التوزيع</span><span class="spacer"></span><button class="btn ghost sm" data-action="goto" data-go="drivers">إضافة مندوب</button></div>`);
      const alertsHtml = alerts.length ? alerts.join('<div style="height:8px"></div>') : '<div class="hint ok">✓ كل شي تمام — لا يوجد شي يحتاج تصرفك الآن</div>';

      const steps = [
        [d.drivers > 0, 'أضف مندوباً واحداً على الأقل', 'drivers', 'المناديب'],
        [d.clients > 0, 'أنشئ حساب عميل (مثل شركة أوتو) واستلم مفتاح الربط الخاص به', 'clients', 'العملاء'],
        [d.totals.all > 0, 'أرسل أول طلب شحن (من هنا أو عبر الـ API)', 'shipments', 'الشحنات'],
        [extConfigured, 'اربط شركة شحن خارجية مثل أرامكس (اختياري)', 'carriers', 'شركات الشحن'],
      ];
      const showSteps = steps.some((s) => !s[0]);
      const checklist = showSteps
        ? `<div class="card"><h2>🚀 خطوات البداية</h2><ul class="steps">${steps.map((s, i) => `<li class="${s[0] ? 'done' : ''}"><span class="tick">${s[0] ? '✓' : i + 1}</span><span class="t">${esc(s[1])}</span><span class="spacer"></span>${s[0] ? '' : `<button class="btn ghost sm" data-action="goto" data-go="${s[2]}">${esc(s[3])}</button>`}</li>`).join('')}</ul></div>`
        : '';

      if (S.page !== 'dashboard') return; // المستخدم انتقل لصفحة أخرى أثناء التحميل
      setView(`
        <div class="stats">
          ${card(t.today, 'طلبات اليوم', 'blue', 'shipments')}
          ${card(t.pendingDispatch, 'بانتظار التوزيع', t.pendingDispatch ? 'red' : '', 'dispatch')}
          ${card(t.inTransit, 'قيد التوصيل', 'orange')}
          ${card(t.delivered, 'تم التسليم', 'green', 'shipments:DELIVERED')}
          ${card(t.problems, 'فشلت / مرتجعة', t.problems ? 'red' : '', 'shipments:FAILED')}
          ${card(t.all, 'إجمالي الشحنات', '', 'shipments')}
        </div>
        ${checklist}
        <div class="card"><div class="card-head"><h2>🔔 يحتاج اهتمامك</h2></div>${alertsHtml}</div>
        <div class="grid g2" style="margin-bottom:16px">
          <div class="card" style="margin:0"><h2>الطلبات آخر 7 أيام</h2><div class="bars">${bars}</div></div>
          <div class="card" style="margin:0"><h2>حسب شركة التوصيل</h2>${byCarrier}</div>
        </div>
        <div class="card"><div class="card-head"><h2>أحدث الشحنات</h2><button class="btn ghost sm" data-action="goto" data-go="shipments">عرض الكل</button></div>${shipmentsTable(recent.items)}</div>
      `);
    } catch (e) { if (S.page === 'dashboard') errorView(e); }
  };

  actions.goto = (el) => {
    const [page, status] = el.dataset.go.split(':');
    if (page === 'shipments') S.f.ship = { page: 1, status: status || '', carrier: '', clientId: '', q: '' };
    ALM.go(page);
  };

  /* ================= الشحنات ================= */
  pages.shipments = async function () {
    loading();
    try {
      const f = S.f.ship;
      const qs = new URLSearchParams({ page: f.page, pageSize: 20 });
      ['status', 'carrier', 'clientId', 'q'].forEach((k) => { if (f[k]) qs.set(k, f[k]); });
      const res = await api('/admin/shipments?' + qs.toString());
      const totalPages = Math.max(1, Math.ceil(res.total / res.pageSize));
      const canCreate = S.refs.clients.length > 0;
      if (S.page !== 'shipments') return; // المستخدم انتقل لصفحة أخرى أثناء التحميل
      setView(`<div class="card">
        <div class="card-head"><h2>الشحنات <small>(${res.total})</small></h2>${canCreate ? '<button class="btn gold" data-action="new-shipment">+ طلب جديد</button>' : ''}</div>
        <form data-form="ship-search" class="filters">
          <div><label>الحالة</label><select data-change="ship-filter" data-key="status"><option value="">الكل</option>${Object.keys(STATUS).map((k) => `<option value="${k}" ${f.status === k ? 'selected' : ''}>${esc(STATUS[k].ar)}</option>`).join('')}</select></div>
          <div><label>شركة التوصيل</label><select data-change="ship-filter" data-key="carrier"><option value="">الكل</option>${S.refs.carriers.map((c) => `<option value="${esc(c.code)}" ${f.carrier === c.code ? 'selected' : ''}>${esc(c.nameAr)}</option>`).join('')}</select></div>
          <div><label>العميل</label><select data-change="ship-filter" data-key="clientId"><option value="">الكل</option>${S.refs.clients.map((c) => `<option value="${esc(c.id)}" ${f.clientId === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div>
          <div><label>بحث</label><input name="q" value="${esc(f.q)}" placeholder="رقم الشحنة / اسم أو جوال المستلم / المدينة"></div>
          <div class="row"><button class="btn" type="submit">بحث</button><button class="btn ghost" type="button" data-action="ship-reset">مسح</button></div>
        </form>
        ${shipmentsTable(res.items)}
        <div class="pager"><span class="muted">صفحة ${res.page} من ${totalPages}</span>
          <span class="row"><button class="btn ghost sm" data-action="ship-page" data-page="${res.page - 1}" ${res.page <= 1 ? 'disabled' : ''}>السابق</button>
          <button class="btn ghost sm" data-action="ship-page" data-page="${res.page + 1}" ${res.page >= totalPages ? 'disabled' : ''}>التالي</button></span></div>
      </div>`);
    } catch (e) { if (S.page === 'shipments') errorView(e); }
  };
  changes['ship-filter'] = (el) => { S.f.ship[el.dataset.key] = el.value; S.f.ship.page = 1; pages.shipments(); };
  forms['ship-search'] = (form) => { S.f.ship.q = form.elements.q.value.trim(); S.f.ship.page = 1; pages.shipments(); };
  actions['ship-reset'] = () => { S.f.ship = { page: 1, status: '', carrier: '', clientId: '', q: '' }; pages.shipments(); };
  actions['ship-page'] = (el) => { S.f.ship.page = Math.max(1, Number(el.dataset.page)); pages.shipments(); };

  /* ---------- طلب جديد ---------- */
  actions['new-shipment'] = () => {
    const clients = S.refs.clients.filter((c) => c.status === 'ACTIVE');
    const carriers = S.refs.carriers.filter((c) => c.isActive);
    if (!clients.length) return toast('أنشئ حساب عميل أولاً من صفحة "العملاء والربط"', 'err');
    let last = {};
    try { last = JSON.parse(localStorage.getItem('alm_last_sender') || '{}'); } catch (e) { /* ignore */ }
    const phone = 'pattern="(05|9665|\\+9665)[0-9]{8}" title="رقم جوال سعودي مثل 0512345678" inputmode="tel"';
    const f = (name, label, extra, val) => `<div class="field"><label>${label}</label><input name="${name}" value="${esc(val || '')}" ${extra || ''}></div>`;
    modal.open('طلب شحن جديد', `<form data-form="new-shipment">
      <div class="grid g2">
        <div class="field"><label>العميل صاحب الطلب</label><select name="clientId" required>${clients.map((c) => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('')}</select></div>
        <div class="field"><label>شركة التوصيل</label><select name="carrierCode" required>${carriers.map((c) => `<option value="${esc(c.code)}">${esc(c.nameAr)}${c.code === 'internal' ? ' ⭐' : ''}</option>`).join('')}</select></div>
      </div>
      <div class="grid g2" style="margin-top:12px">
        <div class="box"><h4>📤 المرسل</h4><div class="grid">
          ${f('senderName', 'الاسم', 'required minlength="2"', last.senderName)}
          ${f('senderPhone', 'الجوال', 'required ' + phone, last.senderPhone)}
          ${f('senderCity', 'المدينة', 'required minlength="2"', last.senderCity)}
          ${f('senderAddress', 'العنوان', 'required minlength="3"', last.senderAddress)}
        </div></div>
        <div class="box"><h4>📥 المستلم</h4><div class="grid">
          ${f('recipientName', 'الاسم', 'required minlength="2"')}
          ${f('recipientPhone', 'الجوال', 'required ' + phone)}
          ${f('recipientCity', 'المدينة', 'required minlength="2"')}
          ${f('recipientAddress', 'العنوان', 'required minlength="3"')}
        </div></div>
      </div>
      <div class="grid g3" style="margin-top:12px">
        ${f('weightKg', 'الوزن (كجم)', 'required type="number" step="0.1" min="0.1"', '1')}
        ${f('codAmount', 'مبلغ التحصيل عند الاستلام (ر.س)', 'type="number" step="0.01" min="0" placeholder="اتركه فارغاً إن لا يوجد"')}
        ${f('packageDesc', 'وصف الطرد', 'maxlength="300"')}
      </div>
      <div class="row" style="margin-top:16px;justify-content:flex-end">
        <button class="btn ghost" type="button" data-action="close-modal">إلغاء</button>
        <button class="btn gold" type="submit">إنشاء الطلب</button>
      </div></form>`, { wide: true });
  };
  forms['new-shipment'] = async (form) => {
    const d = ALM.formData(form);
    const body = {
      clientId: d.clientId, carrierCode: d.carrierCode,
      senderName: d.senderName, senderPhone: d.senderPhone, senderAddress: d.senderAddress, senderCity: d.senderCity,
      recipientName: d.recipientName, recipientPhone: d.recipientPhone, recipientAddress: d.recipientAddress, recipientCity: d.recipientCity,
      weightKg: Number(d.weightKg),
    };
    if (d.codAmount !== '') body.codAmount = Number(d.codAmount);
    if (d.packageDesc) body.packageDesc = d.packageDesc;
    try {
      const res = await api('/admin/shipments', { method: 'POST', body });
      localStorage.setItem('alm_last_sender', JSON.stringify({ senderName: d.senderName, senderPhone: d.senderPhone, senderCity: d.senderCity, senderAddress: d.senderAddress }));
      toast('تم إنشاء الطلب ✓', 'ok');
      await openShipment(res.data.id);
      refreshBackground();
    } catch (e) { toast(e.message, 'err'); }
  };

  /* ---------- تفاصيل الشحنة ---------- */
  function statusButtons(s) {
    const steps = [['PICKED_UP', '📥 تم الاستلام'], ['IN_TRANSIT', '🛣️ في الطريق'], ['OUT_FOR_DELIVERY', '🏍️ خرج للتوصيل'], ['DELIVERED', '✅ تم التسليم']];
    return `<div class="row" style="margin-top:10px">${steps.map(([k, l]) => `<button class="btn ${s.status === k ? 'ok' : 'ghost'} sm" data-action="set-status" data-id="${esc(s.id)}" data-status="${k}" ${s.status === k ? 'disabled' : ''}>${l}</button>`).join('')}
      <button class="btn danger sm" data-action="fail-reason" data-id="${esc(s.id)}" data-from="modal">⚠️ تعذّر التسليم</button></div>`;
  }

  function shipmentBody(s) {
    const final = isFinal(s.status);
    const internal = s.carrier_code === 'internal';
    let failHint = '';
    if (s.status === 'FAILED' && s.raw_response) {
      try { const r = JSON.parse(s.raw_response); if (r && r.error) failHint = `<div class="hint danger" style="margin-bottom:12px">سبب الفشل: ${esc(r.error)}</div>`; } catch (e) { /* ignore */ }
    }
    let act = '';
    let codeBox = '';
    if (internal && s.delivery_code) {
      const waText = encodeURIComponent(`مرحباً ${s.recipient_name}، شحنتك رقم ${s.reference} خرجت للتوصيل. كود التسليم الخاص بك: ${s.delivery_code} — سلّمه للمندوب فقط لحظة استلامك الشحنة فعلياً، ولا تشاركه مع أي شخص قبل ذلك 🔒`);
      const waHref = `https://wa.me/${toWhatsappIntl(s.recipient_phone)}?text=${waText}`;
      codeBox = `<div class="box" style="margin-top:12px; background:#fff8e8; border-color:var(--gold)"><h4>🔐 كود التسليم (لا يظهر للمندوب)</h4>
        <div class="row" style="align-items:center"><span style="font-size:22px; font-weight:800; letter-spacing:4px; font-family:monospace">${esc(s.delivery_code)}</span><span class="spacer"></span>
        <a class="btn" style="background:#25D366;color:#fff" href="${waHref}" target="_blank" rel="noopener">📤 إرسال الكود واتساب للعميل</a></div>
        <p class="muted" style="margin-top:6px">المندوب لازم يطلب هذا الكود من العميل شخصياً عشان يقدر يسجّل "تم التسليم" — ما يقدر يشوفه من تطبيقه إطلاقاً.</p></div>`;
    }
    if (!final) {
      if (internal) {
        act = `<div class="box" style="margin-top:12px"><h4>🚚 التوزيع وتحديث الحالة</h4>
          <div class="row"><select id="assign-sel" style="max-width:260px"><option value="">— اختر مندوباً —</option>${driverOptions(s.assigned_driver_id)}</select>
          <button class="btn gold sm" data-action="assign-driver" data-id="${esc(s.id)}">${s.assigned_driver_id ? 'تغيير المندوب' : 'تعيين المندوب'}</button></div>
          ${s.assigned_driver_id ? statusButtons(s) : '<p class="muted" style="margin:8px 0 0">عيّن مندوباً أولاً، ثم حدّث حالة الشحنة من هنا.</p>'}</div>`;
      } else if (s.carrier_shipment_id) {
        act = `<div class="box" style="margin-top:12px"><h4>🔄 التتبع من ${esc(s.carrier_name_ar)}</h4><button class="btn ghost sm" data-action="refresh-tracking" data-id="${esc(s.id)}">تحديث التتبع الآن</button></div>`;
      }
    }
    const events = (s.events || []).map((e) => `<li><div class="t">${esc(e.description_ar || e.description || (STATUS[e.status] || {}).ar || e.status)}</div>
      <div class="m">${statusBadge(e.status)} ${e.location ? '· ' + esc(e.location) : ''} · ${fmtDT(e.occurred_at)} · ${esc(SRC[e.source] || e.source)}</div></li>`).join('');
    return `${failHint}
      <div class="row" style="margin-bottom:12px">${statusBadge(s.status)}<span class="muted">${esc(s.carrier_name_ar)} · العميل: <b>${esc(s.client_name)}</b> · ${fmtDT(s.created_at)}</span></div>
      <div class="grid g2">
        <div class="box"><h4>📤 المرسل</h4><dl class="kv"><dt>الاسم</dt><dd>${esc(s.sender_name)}</dd><dt>الجوال</dt><dd><a class="mono" href="tel:${esc(s.sender_phone)}">${esc(s.sender_phone)}</a></dd><dt>العنوان</dt><dd>${esc(s.sender_city)} — ${esc(s.sender_address)}</dd></dl></div>
        <div class="box"><h4>📥 المستلم</h4><dl class="kv"><dt>الاسم</dt><dd>${esc(s.recipient_name)}</dd><dt>الجوال</dt><dd><a class="mono" href="tel:${esc(s.recipient_phone)}">${esc(s.recipient_phone)}</a></dd><dt>العنوان</dt><dd>${esc(s.recipient_city)} — ${esc(s.recipient_address)}</dd></dl></div>
      </div>
      <div class="box" style="margin-top:12px"><dl class="kv">
        <dt>الوزن</dt><dd>${esc(s.weight_kg)} كجم</dd>
        <dt>التحصيل</dt><dd>${s.cod_amount ? '<b>' + money(s.cod_amount) + ' ر.س</b> عند الاستلام' : 'لا يوجد'}</dd>
        <dt>الوصف</dt><dd>${esc(s.package_desc || '—')}</dd>
        ${s.carrier_shipment_id ? `<dt>رقم الشركة</dt><dd class="mono">${esc(s.carrier_shipment_id)}</dd>` : ''}
        ${s.cost !== null && s.cost !== undefined ? `<dt>التكلفة</dt><dd>${money(s.cost)} ${esc(s.currency)}</dd>` : ''}
        <dt>المندوب</dt><dd>${s.driver_name ? esc(s.driver_name) + ' · <span class="mono">' + esc(s.driver_phone) + '</span>' : '—'}</dd>
      </dl></div>
      ${codeBox}
      ${act}
      <div class="box" style="margin-top:12px"><h4>🕒 سجل التتبع</h4><ul class="timeline">${events || '<li class="muted">لا توجد أحداث</li>'}</ul></div>
      <div class="row" style="margin-top:14px">
        <button class="btn" data-action="print-waybill" data-id="${esc(s.id)}">🖨️ طباعة البوليصة</button>
        ${final ? '' : `<button class="btn danger" data-action="cancel-shipment" data-id="${esc(s.id)}">إلغاء الشحنة</button>`}
        <span class="spacer"></span><button class="btn ghost" data-action="close-modal">إغلاق</button>
      </div>`;
  }

  async function openShipment(id) {
    try {
      const res = await api('/admin/shipments/' + encodeURIComponent(id));
      modal.open('الشحنة ' + res.data.reference, shipmentBody(res.data), { wide: true });
    } catch (e) { toast(e.message, 'err'); }
  }
  ALM.openShipment = openShipment;
  actions['open-shipment'] = (el) => openShipment(el.dataset.id);

  async function afterChange(id) { await openShipment(id); refreshBackground(); }
  async function setStatus(id, status, desc) {
    await api(`/internal/shipments/${encodeURIComponent(id)}/status`, { method: 'POST', body: { status, descriptionAr: desc || STATUS_TEXT[status] } });
  }

  actions['assign-driver'] = async (el) => {
    const sel = $('#assign-sel');
    if (!sel || !sel.value) return toast('اختر مندوباً أولاً', 'err');
    try {
      await api(`/internal/shipments/${encodeURIComponent(el.dataset.id)}/assign`, { method: 'POST', body: { driverId: sel.value } });
      toast('تم تعيين المندوب ✓', 'ok');
      afterChange(el.dataset.id);
    } catch (e) { toast(e.message, 'err'); }
  };
  actions['set-status'] = async (el) => {
    try { await setStatus(el.dataset.id, el.dataset.status); toast('تم تحديث الحالة ✓', 'ok'); afterChange(el.dataset.id); }
    catch (e) { toast(e.message, 'err'); }
  };
  actions['fail-reason'] = (el) => {
    modal.open('سبب تعذّر التسليم', `<form data-form="fail-reason"><input type="hidden" name="id" value="${esc(el.dataset.id)}"><input type="hidden" name="from" value="${esc(el.dataset.from || 'page')}">
      <div class="field"><label>اكتب السبب (يظهر في سجل التتبع ويصل للعميل)</label><textarea name="reason" required minlength="3" placeholder="مثال: العميل لا يرد على الاتصال"></textarea></div>
      <div class="row" style="margin-top:12px;justify-content:flex-end"><button class="btn ghost" type="button" data-action="close-modal">إلغاء</button><button class="btn danger" type="submit">تسجيل التعذّر</button></div></form>`);
  };
  forms['fail-reason'] = async (form) => {
    const d = ALM.formData(form);
    try {
      await setStatus(d.id, 'FAILED', d.reason);
      toast('تم تسجيل تعذّر التسليم', 'ok');
      if (d.from === 'modal') afterChange(d.id); else { modal.close(); refreshBackground(); }
    } catch (e) { toast(e.message, 'err'); }
  };
  actions['cancel-shipment'] = async (el) => {
    if (!confirm('هل أنت متأكد من إلغاء هذه الشحنة؟ لا يمكن التراجع.')) return;
    try { await api(`/admin/shipments/${encodeURIComponent(el.dataset.id)}/cancel`, { method: 'POST' }); toast('تم إلغاء الشحنة', 'ok'); afterChange(el.dataset.id); }
    catch (e) { toast(e.message, 'err'); }
  };
  actions['refresh-tracking'] = async (el) => {
    try { await api(`/admin/shipments/${encodeURIComponent(el.dataset.id)}/refresh-tracking`, { method: 'POST' }); toast('تم تحديث التتبع ✓', 'ok'); afterChange(el.dataset.id); }
    catch (e) { toast(e.message, 'err'); }
  };

  /* ---------- طباعة البوليصة ---------- */
  function printWaybill(s) {
    let qr = '';
    try { const q = window.qrcode(0, 'M'); q.addData(s.reference); q.make(); qr = q.createSvgTag(4, 0); } catch (e) { /* بدون QR */ }
    ALM.print(`<div class="waybill">
      <div class="wh"><img src="logo.png" alt=""><div><b>شركة الإلمام للخدمات اللوجستية</b><div style="font-size:9pt">بوليصة شحن</div></div><div class="qr">${qr}</div></div>
      <div class="ref">${esc(s.reference)}</div>
      <div class="two">
        <div class="blk"><b>من (المرسل)</b>${esc(s.sender_name)}<br>${esc(s.sender_phone)}<br>${esc(s.sender_city)} — ${esc(s.sender_address)}</div>
        <div class="blk"><b>إلى (المستلم)</b>${esc(s.recipient_name)}<br>${esc(s.recipient_phone)}<br>${esc(s.recipient_city)} — ${esc(s.recipient_address)}</div>
      </div>
      <div class="cod">${s.cod_amount ? 'المطلوب تحصيله: ' + money(s.cod_amount) + ' ر.س' : 'مدفوعة مسبقاً — لا يوجد تحصيل'}</div>
      <div>الوزن: ${esc(s.weight_kg)} كجم${s.package_desc ? ' · ' + esc(s.package_desc) : ''}<br>العميل: ${esc(s.client_name)}${s.driver_name ? ' · المندوب: ' + esc(s.driver_name) : ''}</div>
      <div style="font-size:9pt;margin-top:2mm">${fmtDT(s.created_at)}</div></div>`);
  }
  actions['print-waybill'] = async (el) => {
    try { const res = await api('/admin/shipments/' + encodeURIComponent(el.dataset.id)); printWaybill(res.data); }
    catch (e) { toast(e.message, 'err'); }
  };

  /* ================= التوزيع ================= */
  pages.dispatch = async function () {
    loading();
    try {
      const dr = S.f.dispatchDriver;
      const [wait, active] = await Promise.all([
        api('/admin/shipments?carrier=internal&assigned=no&active=true&pageSize=100'),
        api('/admin/shipments?carrier=internal&assigned=yes&active=true&pageSize=100' + (dr ? '&driverId=' + encodeURIComponent(dr) : '')),
      ]);
      const drivers = activeDrivers();
      const noDrivers = !drivers.length;

      const waitRows = wait.items.map((s) => `<tr>
        <td><b class="mono">${esc(s.reference)}</b><div class="muted">${esc(s.client_name)}</div></td>
        <td>${esc(s.recipient_name)} · <a class="mono" href="tel:${esc(s.recipient_phone)}">${esc(s.recipient_phone)}</a><div class="muted">${esc(s.recipient_city)} — ${esc(s.recipient_address)}</div></td>
        <td>${s.cod_amount ? '<b>' + money(s.cod_amount) + '</b> ر.س' : '—'}</td>
        <td class="muted">${fmtDT(s.created_at)}</td>
        <td class="actions"><div class="row"><select id="drv-${esc(s.id)}" style="min-width:140px"><option value="">— مندوب —</option>${driverOptions('')}</select>
          <button class="btn gold sm" data-action="assign-inline" data-id="${esc(s.id)}">تعيين</button>
          <button class="btn ghost sm" data-action="open-shipment" data-id="${esc(s.id)}">عرض</button></div></td></tr>`).join('');

      const qb = (id, status, label, cls) => `<button class="btn ${cls || 'ghost'} sm" data-action="quick-status" data-id="${esc(id)}" data-status="${status}">${label}</button>`;
      const actRows = active.items.map((s) => `<tr>
        <td><b class="mono">${esc(s.reference)}</b><div class="muted">${esc(s.client_name)}</div></td>
        <td>🚚 <b>${esc(s.driver_name || '—')}</b></td>
        <td>${esc(s.recipient_name)} · <a class="mono" href="tel:${esc(s.recipient_phone)}">${esc(s.recipient_phone)}</a><div class="muted">${esc(s.recipient_city)}</div></td>
        <td>${s.cod_amount ? '<b>' + money(s.cod_amount) + '</b> ر.س' : '—'}</td>
        <td>${statusBadge(s.status)}</td>
        <td class="actions"><div class="row">
          ${s.status !== 'PICKED_UP' ? qb(s.id, 'PICKED_UP', 'استلام') : ''}
          ${s.status !== 'IN_TRANSIT' ? qb(s.id, 'IN_TRANSIT', 'في الطريق') : ''}
          ${s.status !== 'OUT_FOR_DELIVERY' ? qb(s.id, 'OUT_FOR_DELIVERY', 'خرج للتوصيل') : ''}
          ${qb(s.id, 'DELIVERED', '✅ تم التسليم', 'ok')}
          <button class="btn danger sm" data-action="fail-reason" data-id="${esc(s.id)}" data-from="page">تعذّر</button>
          <button class="btn ghost sm" data-action="open-shipment" data-id="${esc(s.id)}">عرض</button></div></td></tr>`).join('');

      if (S.page !== 'dispatch') return; // المستخدم انتقل لصفحة أخرى أثناء التحميل
      setView(`
        ${noDrivers ? '<div class="hint warn row" style="margin-bottom:14px"><span>👤 لا يوجد مناديب مفعّلين لتوزيع الشحنات عليهم.</span><span class="spacer"></span><button class="btn gold sm" data-action="goto" data-go="drivers">إضافة مندوب</button></div>' : ''}
        <div class="card"><div class="card-head"><h2>📥 بانتظار التعيين <small>(${wait.total})</small></h2></div>
          ${wait.items.length ? `<div class="table-wrap"><table><thead><tr><th>الشحنة</th><th>المستلم والعنوان</th><th>التحصيل</th><th>وقت الطلب</th><th>تعيين مندوب</th></tr></thead><tbody>${waitRows}</tbody></table></div>` : '<div class="empty"><span class="big">✅</span>لا توجد شحنات بانتظار التوزيع</div>'}
        </div>
        <div class="card"><div class="card-head"><h2>🏍️ قيد التوصيل <small>(${active.total})</small></h2>
          <div><select data-change="dispatch-driver" style="min-width:180px"><option value="">كل المناديب</option>${S.refs.drivers.map((d) => `<option value="${esc(d.id)}" ${dr === d.id ? 'selected' : ''}>${esc(d.name)}</option>`).join('')}</select></div></div>
          ${active.items.length ? `<div class="table-wrap"><table><thead><tr><th>الشحنة</th><th>المندوب</th><th>المستلم</th><th>التحصيل</th><th>الحالة</th><th>تحديث سريع</th></tr></thead><tbody>${actRows}</tbody></table></div>` : '<div class="empty"><span class="big">📭</span>لا توجد شحنات قيد التوصيل</div>'}
        </div>`);
      if (ALM.refreshBadges) ALM.refreshBadges();
    } catch (e) { if (S.page === 'dispatch') errorView(e); }
  };
  changes['dispatch-driver'] = (el) => { S.f.dispatchDriver = el.value; pages.dispatch(); };
  actions['assign-inline'] = async (el) => {
    const sel = document.getElementById('drv-' + el.dataset.id);
    if (!sel || !sel.value) return toast('اختر مندوباً أولاً', 'err');
    try {
      await api(`/internal/shipments/${encodeURIComponent(el.dataset.id)}/assign`, { method: 'POST', body: { driverId: sel.value } });
      toast('تم تعيين المندوب ✓', 'ok');
      pages.dispatch();
    } catch (e) { toast(e.message, 'err'); }
  };

  /* ================= الخريطة الحية ================= */
  let _mapInstance = null, _mapInterval = null, _mapMarkers = {};
  function relTime(iso) {
    if (!iso) return '—';
    const diffMin = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (diffMin < 1) return 'الآن';
    if (diffMin < 60) return 'قبل ' + diffMin + ' دقيقة';
    const h = Math.round(diffMin / 60);
    return 'قبل ' + h + ' ساعة';
  }
  ALM.destroyMap = function () {
    if (_mapInterval) { clearInterval(_mapInterval); _mapInterval = null; }
    if (_mapInstance) { _mapInstance.remove(); _mapInstance = null; _mapMarkers = {}; }
  };
  pages.map = async function () {
    ALM.destroyMap();
    setView(`
      <div class="card">
        <div class="card-head"><h2>🗺️ خريطة تتبع المناديب الحية</h2><span class="muted" id="map-updated"></span></div>
        <p class="hint" style="margin-bottom:12px">تظهر مواقع المناديب اللي فاتحين تطبيق الجوال حالياً فقط — الموقع يتحدّث تلقائياً كل نص دقيقة تقريباً بدون أي رسوم أو اشتراك (خرائط OpenStreetMap المجانية).</p>
        <div id="live-map" style="height:520px; border-radius:12px; overflow:hidden; border:1px solid var(--line)"></div>
        <div id="map-empty" class="empty hidden"><span class="big">📍</span>لا يوجد مندوب فاتح تطبيق الجوال حالياً — بمجرد ما أي مندوب يفتحه، يظهر هنا تلقائياً</div>
      </div>`);
    _mapInstance = L.map('live-map').setView([24.7136, 46.6753], 11); // الرياض افتراضياً
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors', maxZoom: 19,
    }).addTo(_mapInstance);

    async function refresh() {
      if (S.page !== 'map') return;
      try {
        const r = await api('/internal/drivers-locations');
        const list = r.data;
        document.getElementById('map-empty').classList.toggle('hidden', list.length > 0);
        const seen = new Set();
        list.forEach((d) => {
          seen.add(d.id);
          const pos = [Number(d.last_lat), Number(d.last_lng)];
          const label = `<b>${esc(d.name)}</b><br><a href="tel:${esc(d.phone)}">${esc(d.phone)}</a><br><span class="muted">آخر تحديث: ${relTime(d.last_location_at)}</span>`;
          if (_mapMarkers[d.id]) { _mapMarkers[d.id].setLatLng(pos).setPopupContent(label); }
          else { _mapMarkers[d.id] = L.marker(pos).addTo(_mapInstance).bindPopup(label); }
        });
        Object.keys(_mapMarkers).forEach((id) => { if (!seen.has(id)) { _mapInstance.removeLayer(_mapMarkers[id]); delete _mapMarkers[id]; } });
        if (list.length && Object.keys(_mapMarkers).length) {
          const group = L.featureGroup(Object.values(_mapMarkers));
          if (list.length === 1) _mapInstance.setView(group.getBounds().getCenter(), 14);
          else _mapInstance.fitBounds(group.getBounds().pad(0.2));
        }
        const el = document.getElementById('map-updated'); if (el) el.textContent = 'آخر تحديث للصفحة: ' + new Date().toLocaleTimeString('ar-SA-u-ca-gregory', { hour: '2-digit', minute: '2-digit' });
      } catch (e) { /* صامت — لا نزعج المستخدم بخطأ مؤقت بالشبكة */ }
    }
    await refresh();
    _mapInterval = setInterval(refresh, 30000);
  };

  actions['quick-status'] = async (el) => {
    try { await setStatus(el.dataset.id, el.dataset.status); toast('تم تحديث الحالة ✓', 'ok'); pages.dispatch(); }
    catch (e) { toast(e.message, 'err'); }
  };

  /* ================= التحصيل اليومي ================= */
  function todayStr() {
    // تاريخ اليوم بتوقيت الرياض (وليس توقيت متصفح المستخدم)، لمطابقة حساب الخادم
    return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Riyadh' }); // en-CA يعطي YYYY-MM-DD
  }
  pages.cash = async function () {
    if (!S.f.cashDate) S.f.cashDate = todayStr();
    loading();
    try {
      const r = await api('/admin/cash-collection?date=' + encodeURIComponent(S.f.cashDate));
      const d = r.data;
      const isToday = d.date === todayStr();
      const rows = d.drivers.map((dr) => `<tr>
        <td><b>${esc(dr.driverName)}</b></td>
        <td><a class="mono" href="tel:${esc(dr.driverPhone)}">${esc(dr.driverPhone)}</a></td>
        <td>${dr.deliveredCount}</td>
        <td><b style="font-size:16px">${money(dr.totalCod)}</b> ر.س</td>
        <td>${dr.settled ? `<span class="badge green">✅ استُلم${dr.settledAt ? ' · ' + fmtDT(dr.settledAt) : ''}</span>` : '<span class="badge gold">⏳ لم يُستلم بعد</span>'}</td>
        <td class="actions"><div class="row">
          <a class="btn ok sm" href="https://wa.me/${toWhatsappIntl(dr.driverPhone)}?text=${encodeURIComponent(`مرحباً ${dr.driverName}، إجمالي المبلغ المُحصَّل منك اليوم (${d.date}) هو ${money(dr.totalCod)} ر.س من ${dr.deliveredCount} طلب. الرجاء تسليمه للمحاسبة في أقرب وقت 🙏`)}" target="_blank" rel="noopener">💬 تذكير</a>
          ${dr.settled
            ? `<button class="btn ghost sm" data-action="unsettle-cash" data-driver="${esc(dr.driverId)}" data-date="${esc(d.date)}">تراجع</button>`
            : `<button class="btn gold sm" data-action="settle-cash" data-driver="${esc(dr.driverId)}" data-date="${esc(d.date)}" data-name="${esc(dr.driverName)}" data-amount="${money(dr.totalCod)}">✔️ استلمنا المبلغ</button>`}
        </div></td>
      </tr>`).join('');
      setView(`
        <div class="card">
          <div class="card-head"><h2>💰 التحصيل اليومي <small>لكل مندوب</small></h2>
            <div class="row">
              <input type="date" data-change="cash-date" value="${esc(d.date)}" max="${esc(todayStr())}" style="width:auto">
              ${isToday ? '' : '<button class="btn ghost sm" data-action="cash-today">اليوم</button>'}
            </div>
          </div>
          <div class="hint" style="margin-bottom:14px">المبالغ هنا محسوبة من الشحنات اللي فيها "تحصيل عند الاستلام" وتم تسليمها فعلياً في هذا اليوم (بتوقيت الرياض). لما تستلم كاش المندوب فعلياً (تلفون أو حضوري)، اضغط "✔️ استلمنا المبلغ" لتسجيله كمُستلم.</div>
          ${d.drivers.length ? `
          <div class="table-wrap"><table><thead><tr><th>المندوب</th><th>الجوال</th><th>عدد الطلبات</th><th>الإجمالي</th><th>حالة الاستلام</th><th></th></tr></thead>
          <tbody>${rows}</tbody>
          <tfoot><tr style="font-weight:800; background:#fafbfd"><td colspan="2">الإجمالي الكلي</td><td>${d.totals.deliveredCount}</td><td style="font-size:17px">${money(d.totals.totalCod)} ر.س</td><td colspan="2">${d.totals.remainingTotal > 0 ? `<span class="badge red">متبقي: ${money(d.totals.remainingTotal)} ر.س</span>` : '<span class="badge green">✅ كل المبالغ مُستلمة</span>'}</td></tr></tfoot>
          </table></div>` : `<div class="empty"><span class="big">📭</span>لا يوجد تحصيل مسجّل في ${esc(d.date)}</div>`}
        </div>`);
    } catch (e) { errorView(e); }
  };
  actions['settle-cash'] = async (el) => {
    if (!confirm(`تأكيد استلام ${el.dataset.amount} ر.س نقداً من ${el.dataset.name}؟`)) return;
    try {
      await api('/admin/cash-collection/settle', { method: 'POST', body: { driverId: el.dataset.driver, date: el.dataset.date } });
      toast('تم تسجيل الاستلام ✓', 'ok');
      pages.cash();
    } catch (e) { toast(e.message, 'err'); }
  };
  actions['unsettle-cash'] = async (el) => {
    if (!confirm('التراجع عن تسجيل الاستلام؟ (لو كان بالغلط)')) return;
    try {
      await api('/admin/cash-collection/unsettle', { method: 'POST', body: { driverId: el.dataset.driver, date: el.dataset.date } });
      toast('تم التراجع', 'ok');
      pages.cash();
    } catch (e) { toast(e.message, 'err'); }
  };
  changes['cash-date'] = (el) => { S.f.cashDate = el.value; pages.cash(); };
  actions['cash-today'] = () => { S.f.cashDate = todayStr(); pages.cash(); };
})();
