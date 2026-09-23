/* ─────────────────────────────────────────────────────────────
   網站設定：日常要改的文字幾乎都在這個檔案。
   在 GitHub 網頁上點這個檔案 → 按鉛筆圖示 → 修改 → Commit changes，
   一兩分鐘後網站就會更新。

   修改時注意：
   ・文字前後的單引號 ' ' 要留著
   ・每一項後面的逗號 , 要留著
   ・改壞了可以在 GitHub 的「History」找回舊版本
   ───────────────────────────────────────────────────────────── */

window.SITE_CONFIG = {
  name: '番社參拾',
  org: '苗栗縣在地文化推廣協會',
  tagline: '老屋裡的在地學',
  description: '苗栗縣在地文化推廣協會以竹南中港的陳家古厝（番社30號）為據點，記錄在地文史、推廣文化導覽與地方教育。',

  // 文章來源：WordPress.com 網站
  wordpressSite: 'huansia30.home.blog',

  // WordPress.com 網站 ID（Email 訂閱用）。留空會自動查詢
  wordpressBlogId: '',

  // 首頁顯示幾篇文章；列表每頁幾篇
  homePostCount: 10,
  perPage: 12,

  // 首頁文章篩選列要顯示的分類（WordPress 上的分類名稱）
  featuredCategories: ['在地微觀', '文史記錄', '最新消息', '故事工坊', '公告訊息', '活動記實', '媒體報導'],

  // 首頁段落順序，可調整或刪除
  // cover 封面文章、journal 文章、events 近期活動、shanhaiji 山海集、services 協會的服務、towns 小鎮社區人文、visit 到訪資訊
  homeSections: ['cover', 'journal', 'events', 'shanhaiji', 'services', 'towns', 'visit'],

  // 訪客統計（選填）：GoatCounter 的代碼，例如 'fanshe30'
  goatcounter: '',

  /* ── 選單 ──
     連結寫法：
       pageTitle: '海口'       連到 WordPress 上標題含「海口」的頁面
       category: '媒體報導'    連到這個 WordPress 分類
       href: 'https://…'      連到任何網址
     找不到頁面時，會改成搜尋這個項目的名稱。 */
  nav: [
    { label: '所有文章', href: '?view=archives' },
    { label: '協會服務', pageTitle: '協會服務', children: [
      { label: '文化導覽', pageTitle: '導覽' },
      { label: '藝文策展', pageTitle: '策展' },
      { label: '古厝市集', pageTitle: '市集' },
      { label: '文化教育', pageTitle: '文化教育' },
      { label: '教學與課程', category: '訓練課程' },
    ]},
    { label: '社區人文', href: './#towns' },
    { label: '媒體報導', category: '媒體報導' },
    { label: '影片精選', pageTitle: '影片' },
    { label: '到訪', href: './#visit' },
    { label: '搜尋', href: '?view=search' },
  ],

  towns: [
    { label: '海口社區', pageTitle: '海口' },
    { label: '塭內社區', pageTitle: '塭內' },
    { label: '山佳社區', pageTitle: '山佳' },
    { label: '聖福社區', pageTitle: '聖福' },
    { label: '公館社區', pageTitle: '公館' },
    { label: '龍鳳觀光文化發展協會', pageTitle: '龍鳳' },
    { label: '在地文化推廣協會', pageTitle: '在地文化推廣協會' },
  ],

  // 「協會的服務」說明文字（暫擬，請依實際情況修改）
  services: {
    intro: '以陳家古厝為據點，做導覽、展覽、課程與市集。',
    items: [
      { title: '文化導覽', text: '走進中港聚落與陳家古厝，聽建築、信仰與金紙產業的故事。' },
      { title: '藝文策展', text: '在老屋裡舉辦與地方歷史、工藝有關的展覽。' },
      { title: '古厝市集', text: '在三合院的院落，與在地職人和小店相遇。' },
      { title: '文化教育', text: '為學校與社區設計走讀與在地學課程。' },
      { title: '教學與課程', text: '手抄紙、金紙撕貼等手作體驗，可預約。' },
      { title: '商品展售', text: '《山海集》與在地夥伴的手作及文創商品。' },
    ],
  },

  shanhaiji: {
    text: '協會自 2018 年創刊的地方刊物，介紹在地文化、歷史風俗與人物故事，至今持續發行，已出版到第七期。近年的主題包括飲食、地名與地方信仰。',
    covers: ['2020 夏季號', '2022 秋季號', '2024 小鎮眾神會'],
    buy: 'https://www.huansiaeshop.com/',
    blog: 'https://shanhaiji2020summer.blogspot.com/',
  },

  visit: {
    address: '苗栗縣竹南鎮中港里番社30號',
    openDays: [0, 3, 4, 5, 6],        // 開放日：0＝週日、1＝週一 … 6＝週六
    openText: '週三至週日',
    open: '08:30',
    close: '16:30',
    phone: '0953-118-143',
    email: 'cnhuansia30@gmail.com',
    facebook: { label: '蕃社30', url: 'https://www.facebook.com/huansia' },
    bookingForm: '',                    // 預約表單網址（選填），例如 Google 表單
  },

  /* ── 近期活動 ──
     照下面的格式新增。活動結束後會自動隱藏；沒有活動時，整段不顯示。
     end（結束日）、time、place、note、link 都可以留空 '' */
  events: [
    { title: '範例：古厝秋日市集', date: '2026-10-17', end: '2026-10-18', time: '10:00–16:00', place: '陳家古厝', note: '這是示範資料，請改成實際活動或刪除', link: '' },
  ],
};
