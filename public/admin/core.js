/* ============================================================================
 * لوحة تحكم الإلمام — الأساسيات
 * ملاحظة أمنية: أي نص قادم من عميل خارجي (اسم مستلم، عنوان...) يُمرَّر دائماً عبر esc()
 * قبل عرضه، حتى لا يستطيع أي شخص حقن كود داخل لوحة التحكم.
 * ========================================================================== */
(function () {
  'use strict';
  const ALM = (window.ALM = {});
  const API = '/api/v1';

  const S = (ALM.S = {
    token: localStorage.getItem('alm_admin_token') || '',
    user: null,
    page: 'dashboard',
    refs: { clients: [], carriers: [], drivers: [] },
    f: { ship: { page: 1, status: '', carrier: '', clientId: '', q: '' }, dispatchDriver: '' },
    mustChange: false,
  });

  ALM.$ = (sel, root) => (root || document).querySelector(sel);
  ALM.$$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  ALM.esc = (s) =>
    String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const esc = ALM.esc;

  /* ---------- تنسيق ---------- */
  // ميلادي بأرقام لاتينية وبتوقيت السعودية (لتفادي أي التباس مع التقويم الهجري)
  const dtf = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Riyadh', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
  const df = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Riyadh', day: '2-digit', month: '2-digit', year: 'numeric' });
  ALM.fmtDT = (iso) => (iso ? dtf.format(new Date(iso)).replace(',', '') : '—');
  ALM.fmtD = (iso) => (iso ? df.format(new Date(iso)) : '—');
  ALM.money = (n) => (n === null || n === undefined || n === '' ? '—' : Number(n).toFixed(2));

  /* ---------- الحالات ---------- */
  ALM.STATUS = {
    PENDING: { ar: 'بانتظار الإرسال', cls: 'gray' },
    CREATED: { ar: 'جديدة', cls: 'blue' },
    PICKED_UP: { ar: 'تم الاستلام', cls: 'gold' },
    IN_TRANSIT: { ar: 'في الطريق', cls: 'gold' },
    OUT_FOR_DELIVERY: { ar: 'خرجت للتوصيل', cls: 'orange' },
    DELIVERED: { ar: 'تم التسليم', cls: 'green' },
    FAILED: { ar: 'فشلت', cls: 'red' },
    CANCELLED: { ar: 'ملغاة', cls: 'gray' },
    RETURNED: { ar: 'مرتجعة', cls: 'red' },
  };
  ALM.FINAL = ['DELIVERED', 'CANCELLED', 'FAILED', 'RETURNED'];
  ALM.statusBadge = (st) => {
    const m = ALM.STATUS[st] || { ar: st, cls: 'gray' };
    return `<span class="badge ${m.cls}">${esc(m.ar)}</span>`;
  };

  /* ---------- إشعار عائم ---------- */
  let toastTimer;
  ALM.toast = (msg, type) => {
    const t = ALM.$('#toast');
    t.textContent = msg;
    t.className = 'show ' + (type || '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (t.className = ''), 3200);
  };

  /* ---------- الاتصال بالخادم ---------- */
  ALM.api = async function (path, opts) {
    const { method = 'GET', body, auth = true } = opts || {};
    const headers = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (auth && S.token) headers.Authorization = 'Bearer ' + S.token;
    let res;
    try {
      res = await fetch(API + path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
    } catch (e) {
      throw new Error('تعذّر الاتصال بالخادم — تأكد من اتصال الإنترنت وحاول مجدداً');
    }
    if (res.status === 204) return null;
    let json = null;
    try { json = await res.json(); } catch (e) { /* ignore */ }
    if (res.status === 401 && auth) {
      if (ALM.onUnauthorized) ALM.onUnauthorized();
      throw new Error((json && json.message) || 'انتهت الجلسة، سجّل الدخول من جديد');
    }
    if (!res.ok) throw new Error((json && json.message) || 'حدث خطأ غير متوقع (' + res.status + ')');
    return json;
  };

  /* ---------- النوافذ المنبثقة ---------- */
  ALM.modal = {
    open(title, html, opts) {
      const { wide = false, lock = false } = opts || {};
      ALM.$('#modal-root').innerHTML =
        `<div class="overlay" data-overlay="1" ${lock ? 'data-lock="1"' : ''}>
           <div class="modal${wide ? ' wide' : ''}" role="dialog" aria-modal="true">
             <div class="modal-head"><h3>${esc(title)}</h3>${lock ? '' : '<button class="x" data-action="close-modal" aria-label="إغلاق">✕</button>'}</div>
             <div class="modal-body">${html}</div>
           </div>
         </div>`;
    },
    close() { ALM.$('#modal-root').innerHTML = ''; },
    isOpen() { return !!ALM.$('#modal-root .overlay'); },
    isLocked() { return !!ALM.$('#modal-root .overlay[data-lock]'); },
  };

  /* ---------- أدوات ---------- */
  ALM.copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      ALM.toast('تم النسخ ✓', 'ok');
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); ALM.toast('تم النسخ ✓', 'ok'); } catch (e2) { ALM.toast('تعذّر النسخ، انسخ يدوياً', 'err'); }
      ta.remove();
    }
  };

  ALM.print = (html) => {
    ALM.$('#print-area').innerHTML = html;
    window.print();
  };

  ALM.formData = (form) => {
    const o = {};
    new FormData(form).forEach((v, k) => { o[k] = typeof v === 'string' ? v.trim() : v; });
    return o;
  };

  ALM.setView = (html) => { const v = ALM.$('#view'); if (v) v.innerHTML = html; };
  ALM.loading = () => ALM.setView('<div class="empty"><span class="big">⏳</span>جارٍ التحميل…</div>');
  ALM.errorView = (e) => ALM.setView(`<div class="card"><div class="hint danger">⚠️ ${esc(e.message || e)}</div></div>`);

  // تحميل القوائم المرجعية (عملاء، شركات، مناديب). موظف التشغيل لا يملك صلاحية العملاء فنتجاوزها بهدوء.
  ALM.loadRefs = async () => {
    const [c, ca, d] = await Promise.allSettled([ALM.api('/auth/admin/clients'), ALM.api('/admin/carriers'), ALM.api('/internal/drivers')]);
    S.refs.clients = c.status === 'fulfilled' ? c.value.data : [];
    S.refs.carriers = ca.status === 'fulfilled' ? ca.value.data : [];
    S.refs.drivers = d.status === 'fulfilled' ? d.value.data : [];
  };

  // سجلات الأوامر (تُملأ من ملفات أخرى)
  ALM.actions = {};
  ALM.forms = {};
  ALM.changes = {};
  ALM.pages = {};
})();
