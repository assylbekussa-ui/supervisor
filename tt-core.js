/* =====================================================================
   Tap Taza — общее ядро для CRM (index.html), мобильного кабинета
   супервайзера (supervisor.html) и фотоотчёта клиента (report.html).
   ВСЕ ЦЕНЫ ЗДЕСЬ ДОЛЖНЫ СОВПАДАТЬ С САЙТОМ (калькулятор + абонементы).
   Меняете цену на сайте — поменяйте и здесь.
   ===================================================================== */
(function (root) {
  'use strict';

  const TT = {};

  TT.WA = '77710719375';
  TT.FIREBASE = { databaseURL: 'https://supervisor-464a6-default-rtdb.firebaseio.com' };

  /* ---------- Разовая уборка (как на сайте) ---------- */
  TT.TYPES = [
    { id: 's', key: 'standard', t: 'Поддерживающая', d: 'Стандартная влажная уборка помещений', p: 650 },
    { id: 'g', key: 'general',  t: 'Генеральная',    d: 'Глубокая очистка всех поверхностей',   p: 950 },
    { id: 'r', key: 'repair',   t: 'После ремонта',  d: 'Удаление пыли, цемента и краски',      p: 1200 }
  ];
  TT.ADD = [
    { ic: '🪟', t: 'Мойка окон',            p: 2500, u: 'окно', n: '2×1 м с двух сторон' },
    { ic: '🧊', t: 'Холодильник внутри',     p: 4500, u: 'шт' },
    { ic: '🔥', t: 'Духовка от жира',        p: 3900, u: 'шт' },
    { ic: '🚪', t: 'Кухонные шкафы внутри',  p: 7000, u: 'шт' },
    { ic: '📻', t: 'Микроволновка',          p: 2500, u: 'шт' },
    { ic: '🌿', t: 'Балкон / лоджия',        p: 4000, u: 'шт' },
    { ic: '💨', t: 'Парогенератор',          p: 5000, u: 'усл.' }
  ];
  TT.MIN = 50000;
  TT.OBJ = ['Квартира', 'Офис', 'Частный дом'];
  TT.AREA_MIN = 10;
  TT.AREA_MAX = 1000;

  /* ---------- Абонементы (как на сайте) ---------- */
  // [1 месяц / подписка, 6 месяцев, 12 месяцев] по количеству комнат
  TT.SUB_PRICE = {
    1: [35000, 210000, 420000],
    2: [45000, 270000, 540000],
    3: [82000, 492000, 984000],
    4: [88000, 528000, 1056000],
    5: [95000, 570000, 1140000]
  };
  TT.FIRST_VISIT = 10000;   // первичный выезд супервайзера
  TT.BATH2 = 10000;         // 2-й санузел, ₸ в месяц
  TT.PLANS = [
    { id: 'm1',   t: '1 месяц',       months: 1,  visits: 4,  col: 0, firstFree: false, recurring: false },
    { id: 'taza', t: 'Подписка Taza', months: 1,  visits: 4,  col: 0, firstFree: true,  recurring: true  },
    { id: 'm6',   t: '6 месяцев',     months: 6,  visits: 24, col: 1, firstFree: true,  recurring: false, gifts: '«Идеальная кухня» + мойка 4 оконных блоков' },
    { id: 'm12',  t: '12 месяцев',    months: 12, visits: 48, col: 2, firstFree: true,  recurring: false, gifts: 'Генеральная уборка + «Идеальная кухня» + 1 уборка другу' }
  ];

  TT.STATUSES = ['Новый заказ', 'Планируется выезд', 'В процессе', 'Завершен'];

  TT.fmt = n => Math.round(Number(n) || 0).toLocaleString('ru-RU').replace(/[  ,]/g, ' ');
  TT.esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  TT.typeById = id => TT.TYPES.find(x => x.id === id || x.key === id) || TT.TYPES[0];
  TT.planById = id => TT.PLANS.find(x => x.id === id) || TT.PLANS[0];

  /** Расчёт разовой уборки — та же формула, что на сайте */
  TT.calcOnce = function ({ type = 's', area = 60, q = [] }) {
    const T = TT.typeById(type);
    const base = area * T.p;
    let add = 0;
    const lines = [];
    TT.ADD.forEach((a, i) => {
      const n = Number(q[i]) || 0;
      if (n > 0) { add += n * a.p; lines.push({ t: a.t, q: n, p: a.p, sum: n * a.p }); }
    });
    const raw = base + add;
    const sum = Math.max(TT.MIN, raw);
    return { T, base, add, raw, sum, minApplied: raw < TT.MIN, lines };
  };

  /** Расчёт абонемента — цены сайта + первичный выезд + 2-й санузел */
  TT.calcSub = function ({ rooms = 1, plan = 'taza', bath2 = false }) {
    const P = TT.planById(plan);
    const r = Math.max(1, Math.min(5, Number(rooms) || 1));
    const price = TT.SUB_PRICE[r][P.col];
    const bath = bath2 ? TT.BATH2 * P.months : 0;
    const first = P.firstFree ? 0 : TT.FIRST_VISIT;
    const total = price + bath + first;
    return { P, rooms: r, price, bath, first, total, perVisit: Math.round((price + bath) / P.visits), visits: P.visits };
  };

  /** Ориентировочное время работы */
  TT.estimateTime = function (kind, area, type) {
    if (kind === 'sub') return '~2.5 - 3.5 ч';
    if (kind === 'custom') return '~1.5 - 2.5 ч';
    let h = area <= 80 ? [3, 4] : area <= 180 ? [4, 5] : [6, 8];
    if (type === 'r') h = h.map(x => x + 1);
    return `~${h[0]} - ${h[1]} ч`;
  };

  /* ---------- Чек-листы по регламенту (25 пунктов) ---------- */
  TT.CHECKLISTS = {
    standard: [
      'Протирка горизонтальных поверхностей на высоте рук', 'Очистка внешних фасадов шкафов и тумб',
      'Протирка рабочих столов', 'Дезинфекция ручек, выключателей и кнопок',
      'Обеспыливание мониторов и оргтехники', 'Протирка клавиатур и телефонов',
      'Обеспыливание подоконников', 'Полировка зеркал и стеклянных дверей',
      'Очистка дверных полотен и наличников', 'Протирка внешних фасадов кухни',
      'Мытье рабочей столешницы и фартука', 'Дезинфекция раковины и смесителя',
      'Протирка плиты и вытяжки снаружи', 'Очистка внешних корпусов СВЧ и холодильника',
      'Дезинфекция унитаза и биде', 'Чистка раковины и смесителей',
      'Освежающее мытье ванны и душ-поддона', 'Протирка зеркал в ванной',
      'Очистка полов пылесосом Kärcher', 'Влажная уборка плинтусов',
      'Мытье полов с учетом покрытия', 'Сбор и вынос мусора (до 10 кг)',
      'Замена пакетов в мусорках', 'Проверка цветовой кодировки салфеток',
      'Финальный осмотр объекта супервайзером'
    ],
    general: [
      'Удаление пыли и паутины со стен и потолков', 'Мытье люстр, светильников и бра',
      'Протирка карнизов и верха кондиционеров', 'Очистка верхов шкафов на всю высоту',
      'Протирка и дезинфекция столов и декора', 'Дезинфекция ручек, розеток, выключателей',
      'Обеспыливание ТВ, техники и кабелей', 'Полировка зеркал и глянцевых панелей',
      'Очистка дверей, наличников и замков', 'Глубокая очистка кухонного гарнитура',
      'Удаление жира с фартука и столешницы', 'Обезжиривание плиты и фильтров вытяжки',
      'Очистка уплотнителей бытовой техники', 'Дезинфекция зоны мусорного ведра',
      'Мытье плитки в санузле на всю высоту', 'Удаление известкового налета и водного камня',
      'Глубокая дезинфекция всей сантехники', 'Полировка ванны и душевой кабины',
      'Глубокая чистка полов и ковров Kärcher', 'Выдувка и мытье радиаторов изнутри',
      'Уборка под мебелью и плинтусов', 'Мытье полов спецсоставами',
      'Вынос мусора (до 10 кг)', 'Контроль кодировки микрофибры',
      'Финальный прием качества супервайзером'
    ],
    repair: [
      'Обеспыливание потолков и стен пылесосом Kärcher', 'Выдувка пыли из радиаторов отопления',
      'Очистка вентрешеток и люков', 'Удаление затирки, цемента и штукатурки',
      'Удаление следов краски, клея и герметика', 'Снятие защитных пленок и скотча',
      'Очистка подрозетников и щитков', 'Очистка светильников от строительной пыли',
      'Обеспыливание дверных коробок и петель', 'Очистка внешних поверхностей мебели',
      'Влажная протирка внутренних полок пустых шкафов', 'Сухая очистка пылесосом встроенных ниш',
      'Протирка элементов декора и плинтусов', 'Полировка металлических ручек',
      'Смыв строительного налета с плитки', 'Очистка новой сантехники от затирки',
      'Мытье и полировка ванны и трапов', 'Полировка хромированных смесителей',
      'Обеспыливание оконных профилей и пазов', 'Мытье подоконников и откосов',
      'Двустороннее мытье остекления', 'Уборка полов строительным пылесосом Kärcher',
      'Многоэтапное влажное мытье полов', 'Сбор строительного мусора (до 15 кг)',
      'Финальный прием и сдаточный фотоотчет'
    ]
  };
  TT.CHECKLIST_NAMES = { standard: 'Поддерживающая', general: 'Генеральная', repair: 'После ремонта' };

  /** Какой чек-лист нужен для заказа */
  TT.checklistKeyForOrder = function (ord) {
    if (!ord) return 'standard';
    if (ord.calc && ord.calc.type) return TT.typeById(ord.calc.type).key;
    const s = String(ord.serviceType || '').toLowerCase();
    if (s.includes('ремонт')) return 'repair';
    if (s.includes('генерал')) return 'general';
    return 'standard';
  };

  /* ---------- Парсер заявок, пришедших с сайта в WhatsApp ---------- */
  TT.parseSiteMessage = function (text) {
    const src = String(text || '').replace(/\r/g, '');
    const num = s => Number(String(s || '').replace(/[^\d]/g, '')) || 0;
    const field = name => {
      const m = src.match(new RegExp('^\\s*' + name + '\\s*:\\s*(.+)$', 'mi'));
      return m ? m[1].trim() : '';
    };
    const phoneM = src.match(/(?:\+7|8)[\s\-(]*\d{3}[\s\-)]*\d{3}[\s\-]*\d{2}[\s\-]*\d{2}/);
    const res = { kind: null, phone: phoneM ? phoneM[0] : '', sitePrice: 0, raw: src };

    // 1) Абонемент: «Хочу оформить абонемент «6 месяцев» для квартиры: 2 комн., 1 санузел. Цена от 270 000 ₸.»
    const sub = src.match(/абонемент\s*[«"]([^»"]+)[»"][^\n]*?(\d)\s*комн/i);
    if (sub) {
      const plan = TT.PLANS.find(p => p.t.toLowerCase() === sub[1].trim().toLowerCase()) || TT.PLANS[1];
      const bathM = src.match(/(\d)\s*сан/i);
      const priceM = src.match(/Цена\s*от\s*([\d\s ]+)/i);
      return Object.assign(res, {
        kind: 'sub', plan: plan.id, rooms: Number(sub[2]), bath2: bathM ? Number(bathM[1]) >= 2 : false,
        sitePrice: priceM ? num(priceM[1]) : 0
      });
    }

    // 2) Запрос КП для бизнеса
    if (/коммерческ/i.test(src)) {
      return Object.assign(res, {
        kind: 'custom',
        name: field('Имя'), company: field('Компания').replace(/^—$/, ''),
        phone: field('Телефон') || res.phone,
        obj: field('Объект'), area: num(field('Площадь')), freq: field('Частота'),
        note: field('Комментарий')
      });
    }

    // 3) Разовая уборка из калькулятора
    const vid = field('Вид');
    if (vid || /заказать уборку/i.test(src)) {
      const T = TT.TYPES.find(x => vid && vid.toLowerCase().startsWith(x.t.toLowerCase().slice(0, 6))) || TT.TYPES[0];
      const q = TT.ADD.map(() => 0);
      const extras = field('Доп\\.? услуги');
      if (extras) {
        extras.split(',').forEach(part => {
          const m = part.match(/(.+?)\s*[×x*]\s*(\d+)/i);
          const name = (m ? m[1] : part).trim().toLowerCase();
          const i = TT.ADD.findIndex(a => a.t.toLowerCase() === name || name.startsWith(a.t.toLowerCase().slice(0, 8)));
          if (i >= 0) q[i] = m ? Number(m[2]) : 1;
        });
      }
      const objRaw = field('Объект');
      const obj = TT.OBJ.find(o => objRaw && o.toLowerCase().startsWith(objRaw.toLowerCase().slice(0, 4))) || 'Квартира';
      return Object.assign(res, {
        kind: 'once', type: T.id, area: num(field('Площадь')) || 60, obj, q,
        sitePrice: num(field('Предварительная цена'))
      });
    }
    return res;
  };

  /* ---------- Фото: сжатие перед загрузкой ---------- */
  TT.compressImage = function (file, maxSide = 1280, quality = 0.7) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = () => {
        const img = new Image();
        img.onerror = reject;
        img.onload = () => {
          const k = Math.min(1, maxSide / Math.max(img.width, img.height));
          const c = document.createElement('canvas');
          c.width = Math.round(img.width * k);
          c.height = Math.round(img.height * k);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          resolve(c.toDataURL('image/jpeg', quality));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  };

  /* ---------- Отчёт супервайзера ---------- */
  /**
   * Сохраняет отчёт в reports/{orderId}/{key}, а в заказ appState/orders
   * дописывает краткую сводку и двигает статус / счётчик визитов абонемента.
   * Возвращает { key, url, order }.
   */
  TT.saveReport = async function (db, orderId, report) {
    const ref = db.ref('reports/' + orderId).push();
    const full = Object.assign({ createdAt: new Date().toISOString() }, report);
    await ref.set(full);

    let updatedOrder = null;
    if (orderId && orderId !== 'NO-ORDER') {
      await db.ref('appState/orders').transaction(orders => {
        if (!orders) return orders;
        const list = Array.isArray(orders) ? orders : Object.values(orders);
        const o = list.find(x => x && x.id === orderId);
        if (!o) return orders;
        const summary = {
          key: ref.key, at: full.createdAt, by: full.supervisor || '',
          done: full.done || 0, total: full.total || 0,
          nb: (full.photosBefore || []).length, na: (full.photosAfter || []).length
        };
        o.reports = (Array.isArray(o.reports) ? o.reports : Object.values(o.reports || {})).concat(summary);
        if (o.kind === 'sub') {
          o.visitsDone = (Number(o.visitsDone) || 0) + 1;
          o.status = o.visitsTotal && o.visitsDone >= o.visitsTotal ? 'Завершен' : 'В процессе';
        } else {
          o.status = 'Завершен';
        }
        o.lastReportAt = full.createdAt;
        updatedOrder = JSON.parse(JSON.stringify(o));
        return orders;
      });
    }
    return { key: ref.key, url: TT.reportUrl(orderId, ref.key), order: updatedOrder };
  };

  TT.reportUrl = function (orderId, key) {
    const base = location.href.replace(/[#?].*$/, '').replace(/[^/]*$/, '');
    return `${base}report.html?o=${encodeURIComponent(orderId)}&r=${encodeURIComponent(key)}`;
  };

  TT.clientReportMessage = function (ord, url, report) {
    const visits = ord && ord.kind === 'sub' && ord.visitsTotal ? `\nВизит ${ord.visitsDone || 1} из ${ord.visitsTotal} по абонементу.` : '';
    return `Здравствуйте${ord && ord.customerName ? ', ' + ord.customerName : ''}! Уборка по заказу №${ord ? ord.id : ''} завершена ✨` +
      `\nЧек-лист: ${report.done}/${report.total} пунктов.${visits}` +
      `\n\n📸 Фотоотчёт «до/после»: ${url}` +
      `\n\nБудем благодарны за оценку по ссылке — это займёт 10 секунд. Команда Tap Taza`;
  };

  TT.waPhone = p => {
    let d = String(p || '').replace(/\D/g, '');
    if (d.length === 11 && d[0] === '8') d = '7' + d.slice(1);
    if (d.length === 10) d = '7' + d;
    return d;
  };
  TT.waLink = (phone, text) => `https://wa.me/${TT.waPhone(phone)}?text=${encodeURIComponent(text)}`;

  root.TT = TT;
})(typeof window !== 'undefined' ? window : globalThis);
