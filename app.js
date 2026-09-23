/* 番社參拾網站程式
   ・網站設定、協會服務、社區人文、影片、活動：讀取 data/ 資料夾（用 admin.html 管理程式編輯）
   ・文章、照片、留言：訪客打開網頁時，直接向 WordPress.com 讀取
   一般維護不需要改這個檔案。

   網址對照：
     ./                      首頁
     ?service=名稱            服務頁          ?view=services   所有服務
     ?town=名稱               社區頁          ?view=towns      所有社區
     ?view=videos            影片精選
     ?media=名稱              媒體報導        ?view=media      所有媒體報導
     ?p=123 / ?name=代稱      文章（沿用 WordPress 的寫法，舊網站的短網址也能用）
     ?page_id=45 / ?pagename= WordPress 上的頁面
     ?category_name=代稱      分類            ?tag=代稱         標籤
     ?s=關鍵字                搜尋            ?view=search     搜尋頁
     ?view=archives          所有文章         ?view=posts      文章列表（可加 &paged=2）
*/
(function () {
  'use strict';

  var D = {};          // data/ 資料夾裡的網站資料
  var C = {};          // 網站設定（data/site.json）
  var API = '';
  var OLD_HOSTS = [];
  var POST_FIELDS = 'id,date,slug,link,title,content,excerpt,categories,tags,comment_status,jetpack_featured_media_url,sticky';
  var LIST_FIELDS = 'id,date,link,title,excerpt,categories,jetpack_featured_media_url,sticky';
  var view = document.getElementById('view');
  var params = new URLSearchParams(location.search);
  var categoriesP, pagesP;

  /* ---------- 小工具 ---------- */

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function text(html) {
    var d = document.createElement('div');
    d.innerHTML = String(html || '').replace(/<(script|style)[\s\S]*?<\/\1>/gi, '');
    return (d.textContent || '').replace(/\s+/g, ' ').trim();
  }
  function excerpt(p, max) {
    var t = text(p.excerpt && p.excerpt.rendered || p.content && p.content.rendered || '');
    t = t.replace(/\s*(\[(…|\.\.\.)\]|繼續閱讀.*|Continue reading.*|Read more.*)$/i, '').trim();
    max = max || 110;
    return t.length > max ? t.slice(0, max) + '…' : t;
  }
  function title(p) { return text(p.title && p.title.rendered) || '（無標題）'; }
  function longDate(d) { var a = d.slice(0, 10).split('-'); return a[0] + ' 年 ' + (+a[1]) + ' 月 ' + (+a[2]) + ' 日'; }
  function dotDate(d) { return d.slice(0, 10).replace(/-/g, '.'); }
  function https(u) { return String(u || '').replace(/^http:\/\//i, 'https://').replace(/^\/\//, 'https://'); }
  function sized(u, w) {
    if (!u) return '';
    u = https(u);
    return /wordpress\.com\/|wp\.com\/|\/wp-content\/uploads\//i.test(u) ? u.replace(/\?.*$/, '') + '?w=' + w : u;
  }
  function q(obj) {
    var s = new URLSearchParams();
    Object.keys(obj).forEach(function (k) { if (obj[k] !== undefined && obj[k] !== null && obj[k] !== '') s.set(k, obj[k]); });
    return '?' + s.toString();
  }
  function postUrl(p) { return q({ p: p.id }); }
  function pageUrl(p) { return q({ page_id: p.id }); }
  function catUrl(c) { return isMediaCat(c.name || c.slugText) ? '?view=media' : q({ category_name: c.slugText }); }
  // 媒體報導已經搬到管理程式：WordPress 的「媒體報導」分類改顯示新的媒體報導頁
  function isMediaCat(name) {
    var n = decodeSlug(String(name || ''));
    return shown(D.media).length > 0 && (n === '媒體報導' || n === 'media' || n === '媒体报道');
  }
  function tagUrl(t) { return q({ tag: t.slugText }); }
  function decodeSlug(s) { try { return decodeURIComponent(s); } catch (e) { return s; } }
  function setTitle(t, desc) {
    document.title = t ? t + '｜' + C.name : C.name + '｜' + C.org;
    var m = $('meta[name="description"]');
    if (m && desc) m.setAttribute('content', desc);
  }
  function taipeiToday() { return new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10); }

  /* ---------- 讀取 WordPress ---------- */

  var memo = {};
  function api(path, query) {
    var url = API + '/' + path + (query ? q(query) : '');
    if (memo[url]) return memo[url];
    memo[url] = fetchJSON(url, 3).catch(function (e) { delete memo[url]; throw e; });
    return memo[url];
  }
  function fetchJSON(url, tries) {
    var ctrl = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 15000);
    return fetch(url, ctrl ? { signal: ctrl.signal } : {}).then(function (r) {
      clearTimeout(timer);
      if (r.status === 404 || r.status === 400) { var e = new Error('not found'); e.notFound = true; throw e; }
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).catch(function (e) {
      clearTimeout(timer);
      if (e.notFound || tries <= 1) throw e;
      return new Promise(function (ok) { setTimeout(ok, 1200); }).then(function () { return fetchJSON(url, tries - 1); });
    });
  }
  // 分類與頁面清單變動少，存在瀏覽器裡 30 分鐘，換頁時不用重抓
  function cached(key, loader) {
    try {
      var hit = JSON.parse(sessionStorage.getItem(key) || 'null');
      if (hit && Date.now() - hit.t < 30 * 60e3) return Promise.resolve(hit.v);
    } catch (e) { /* 忽略 */ }
    return loader().then(function (v) {
      try { sessionStorage.setItem(key, JSON.stringify({ t: Date.now(), v: v })); } catch (e) { /* 忽略 */ }
      return v;
    });
  }
  function allPages(path, query) {
    var out = [];
    function next(n) {
      return api(path, Object.assign({}, query, { per_page: 100, page: n })).then(function (list) {
        out = out.concat(list);
        return list.length === 100 && n < 30 ? next(n + 1) : out;
      }).catch(function (e) { if (e.notFound && n > 1) return out; throw e; });
    }
    return next(1);
  }
  function startWordPress() {
  categoriesP = cached('fs30-cats-' + C.wordpressSite, function () {
    return allPages('categories', { _fields: 'id,name,slug,count,parent' }).then(function (list) {
      return list.map(function (c) { return { id: c.id, name: text(c.name), slug: c.slug, slugText: decodeSlug(c.slug), count: c.count }; });
    });
  });
  pagesP = cached('fs30-pages-' + C.wordpressSite, function () {
    return allPages('pages', { _fields: 'id,slug,title,parent,menu_order,link' }).then(function (list) {
      return list.map(function (p) { return { id: p.id, slug: p.slug, title: title(p), parent: p.parent, order: p.menu_order, link: p.link }; });
    });
  });
  categoriesP.catch(function () {});
  pagesP.catch(function () {});
  }
  function catsById(ids, cats) {
    return (ids || []).map(function (id) { return cats.filter(function (c) { return c.id === id; })[0]; })
      .filter(function (c) { return c && c.slug !== 'uncategorized'; });
  }

  /* ---------- 整理 WordPress 內文 ---------- */

  var REMOVE = 'script,style,noscript,object,embed,form,.sharedaddy,.jp-relatedposts,#jp-post-flair,.wpcnt,.wordads-ad-wrapper,.jetpack-likes-widget-wrapper,.wp-block-jetpack-subscriptions';
  var IMAGE_FILE = /\.(jpe?g|png|gif|webp|avif)(\?|$)/i;

  // 連到舊網站的連結，改成新網站的網址
  function localHref(href) {
    var u;
    try { u = new URL(href, 'https://' + C.wordpressSite + '/'); } catch (e) { return null; }
    if (OLD_HOSTS.indexOf(u.hostname.toLowerCase()) < 0) return null;
    if (u.searchParams.get('p')) return q({ p: u.searchParams.get('p') });
    if (u.searchParams.get('page_id')) return q({ page_id: u.searchParams.get('page_id') });
    var seg = u.pathname.split('/').filter(Boolean);
    if (!seg.length) return './' + u.hash;
    if (/^(wp-admin|wp-login\.php|wp-content|feed)$/.test(seg[0]) || seg.indexOf('attachment') >= 0 || seg.indexOf('feed') >= 0) return null;
    if (seg[0] === 'category') return q({ category_name: decodeSlug(seg[seg.length - 1]) });
    if (seg[0] === 'tag') return q({ tag: decodeSlug(seg[1] || '') });
    if (/^\d{4}$/.test(seg[0])) return seg.length >= 4 ? q({ name: decodeSlug(seg[3]) }) + u.hash : q({ view: 'archives' });
    return q({ pagename: decodeSlug(seg[seg.length - 1]) }) + u.hash;
  }

  function clean(html, isComment) {
    var t = document.createElement('template');
    t.innerHTML = html || '';
    var root = t.content;
    $$(REMOVE, root).forEach(function (el) { el.remove(); });
    $$('*', root).forEach(function (el) {
      Array.prototype.slice.call(el.attributes).forEach(function (a) {
        if (/^on/i.test(a.name) || /^\s*javascript:/i.test(a.value)) el.removeAttribute(a.name);
      });
    });
    $$('a[href]', root).forEach(function (a) {
      var href = a.getAttribute('href');
      var local = localHref(href);
      if (local) { a.setAttribute('href', local); a.removeAttribute('target'); }
      else if (/^(https?:)?\/\//i.test(href)) {
        a.setAttribute('href', https(href));
        if (!IMAGE_FILE.test(href)) { a.setAttribute('target', '_blank'); a.setAttribute('rel', 'noopener'); }
      }
      if (isComment) a.setAttribute('rel', 'nofollow ugc noopener');
    });
    $$('img', root).forEach(function (img, i) {
      if (img.getAttribute('src')) img.setAttribute('src', https(img.getAttribute('src')));
      if (img.getAttribute('srcset')) img.setAttribute('srcset', img.getAttribute('srcset').replace(/http:\/\//gi, 'https://'));
      img.setAttribute('loading', i === 0 && !isComment ? 'eager' : 'lazy');
      img.setAttribute('decoding', 'async');
      img.setAttribute('referrerpolicy', 'no-referrer');
      if (!img.hasAttribute('alt')) img.setAttribute('alt', '');
      var a = img.parentElement && img.parentElement.tagName === 'A' ? img.parentElement : null;
      var linked = a && a.getAttribute('href');
      if (!isComment && (!linked || IMAGE_FILE.test(linked))) {
        img.setAttribute('data-full', sized(img.getAttribute('data-orig-file') || linked || img.getAttribute('src'), 2000));
      }
    });
    $$('iframe', root).forEach(function (f) {
      var src = https(f.getAttribute('src') || '');
      if (!/^https:\/\//.test(src)) { f.remove(); return; }
      f.setAttribute('src', src);
      f.setAttribute('loading', 'lazy');
      f.removeAttribute('width'); f.removeAttribute('height');
      if (/youtube|youtu\.be|vimeo|facebook\.com\/plugins\/video/i.test(src) && !f.parentElement.classList.contains('video-frame')) {
        var box = document.createElement('div');
        box.className = 'video-frame';
        f.parentNode.insertBefore(box, f);
        box.appendChild(f);
      }
    });
    $$('table', root).forEach(function (tb) {
      var box = document.createElement('div');
      box.className = 'table-scroll';
      tb.parentNode.insertBefore(box, tb);
      box.appendChild(tb);
    });
    $$('.tiled-gallery [style], .tiled-gallery img', root).forEach(function (el) {
      el.removeAttribute('style');
      if (el.tagName === 'IMG') { el.removeAttribute('width'); el.removeAttribute('height'); }
    });
    var d = document.createElement('div');
    d.appendChild(root);
    return d.innerHTML;
  }

  function imageKey(u) {
    return String(u || '').replace(/\?.*$/, '').split('/').pop().replace(/-(\d+x\d+|scaled|e\d{10,})(?=\.)/g, '').toLowerCase();
  }

  /* ---------- 共用畫面 ---------- */

  function loading() { view.innerHTML = '<div class="wrap loading">讀取中…</div>'; }

  function showError(err, what) {
    var notFound = err && err.notFound;
    setTitle(notFound ? '找不到這個頁面' : '暫時讀不到內容');
    view.innerHTML = '<div class="wrap err"><h1>' + (notFound ? '找不到這個頁面' : '暫時讀不到內容') + '</h1>' +
      (notFound
        ? '<p>網址可能打錯，或' + (what || '文章') + '已經移除。可以 <a href="?view=search">搜尋</a> 找找看，或看 <a href="?view=archives">所有文章</a>。</p>'
        : '<p>文章存放在 WordPress，現在連不上。請稍後重新整理，或直接到 <a href="https://' + esc(C.wordpressSite) + '/">原網站</a> 閱讀。</p>') +
      '<p><a class="more" href="./">回到首頁</a></p></div>';
    if (err && !notFound && window.console) console.error(err);
  }

  function thumbHtml(p, i) {
    var src = sized(p.jetpack_featured_media_url || firstImage(p), 480);
    return '<div class="ph thumb t' + (i % 3 + 1) + '" aria-hidden="true">' +
      (src ? '<img data-ph="1" src="' + esc(src) + '" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">' : '') + '</div>';
  }
  function firstImage(p) {
    var m = (p.content && p.content.rendered || '').match(/<img[^>]+src="([^"]+)"/);
    return m ? m[1] : '';
  }

  // 已經匯入管理程式的 WordPress 文章（媒體報導），不在文章列表重複出現
  function hideImported(posts) {
    var ids = {};
    (D.media || []).forEach(function (x) { if (x.wpId) ids[x.wpId] = 1; });
    return posts.filter(function (p) { return !ids[p.id]; });
  }

  function listHtml(posts, cats, offset) {
    posts = hideImported(posts);
    if (!posts.length) return '<p class="c-empty">這裡目前沒有文章。<a href="?view=archives">看所有文章</a></p>';
    return posts.map(function (p, i) {
      var c = catsById(p.categories, cats)[0];
      return '<article class="post"><div class="p-date"><span>' + dotDate(p.date) + '</span>' + (c ? '<span>' + esc(c.name) + '</span>' : '') + '</div>' +
        '<div><h3><a href="' + postUrl(p) + '">' + esc(title(p)) + '</a></h3><p>' + esc(excerpt(p)) + '</p></div>' +
        thumbHtml(p, i + (offset || 0)) + '</article>';
    }).join('');
  }

  function filterHtml(cats, currentId) {
    var list = C.featuredCategories.map(function (n) { return cats.filter(function (c) { return c.name === n && c.count > 0; })[0]; }).filter(Boolean);
    return '<nav class="filters" aria-label="依分類瀏覽"><a href="?view=archives"' + (!currentId ? ' aria-current="page"' : '') + '>全部</a>' +
      list.map(function (c) { return '<a href="' + catUrl(c) + '"' + (c.id === currentId ? ' aria-current="page"' : '') + '>' + esc(c.name) + '</a>'; }).join('') + '</nav>';
  }

  function pagerHtml(n, hasMore, extra) {
    if (n <= 1 && !hasMore) return '';
    return '<nav class="pager" aria-label="分頁">' +
      (n > 1 ? '<a href="' + q(Object.assign({}, extra, { paged: n > 2 ? n - 1 : '' })) + '" rel="prev">上一頁</a>' : '') +
      '<span aria-current="page">第 ' + n + ' 頁</span>' +
      (hasMore ? '<a href="' + q(Object.assign({}, extra, { paged: n + 1 })) + '" rel="next">下一頁</a>' : '') + '</nav>';
  }

  /* ---------- 網站資料 ---------- */

  function shown(list) { return (list || []).filter(function (x) { return x && !x.hidden && x.title; }); }
  function serviceUrl(x) { return q({ service: x.slug || x.title }); }
  function townUrl(x) { return q({ town: x.slug || x.title }); }
  function findBy(list, slug) {
    return shown(list).filter(function (x) { return (x.slug || x.title) === slug || x.title === slug; })[0];
  }
  // 照片網址：管理程式上傳的是 uploads/ 開頭的相對路徑；WordPress 的照片用 ?w= 縮圖
  function img(u, w) {
    if (!u) return '';
    if (/^uploads\//.test(u)) return u;
    return sized(u, w);
  }
  function bookingUrl(svc) {
    return (svc && svc.bookingUrl) || C.visit.bookingUrl || '';
  }
  function sectionConf(key) {
    return (C.sections || []).filter(function (x) { return x.key === key; })[0] || { key: key, title: '', intro: '' };
  }

  // 選單項目的網址
  function navHref(item) {
    switch (item.type) {
      case 'auto-services': return '?view=services';
      case 'auto-towns': return '?view=towns';
      case 'service': var sv = findBy(D.services, item.target); return sv ? serviceUrl(sv) : '?view=services';
      case 'town': var tw = findBy(D.towns, item.target); return tw ? townUrl(tw) : '?view=towns';
      case 'videos': return '?view=videos';
      case 'media': return '?view=media';
      case 'posts': return '?view=archives';
      case 'visit': return './#visit';
      case 'search': return '?view=search';
      case 'category': return isMediaCat(item.target) ? '?view=media' : q({ category_name: item.target || '' });
      case 'url': return item.target || './';
      default: return './';
    }
  }
  function navChildren(item) {
    if (item.type === 'auto-services') return shown(D.services).map(function (x) { return { label: x.title, href: serviceUrl(x) }; });
    if (item.type === 'auto-towns') return shown(D.towns).map(function (x) { return { label: x.title, href: townUrl(x) }; });
    if (item.type === 'menu') return (item.children || []).map(function (c) { return { label: c.label, href: navHref(c) }; });
    return [];
  }

  /* ---------- 頁首、頁尾 ---------- */

  function renderChrome() {
    $('#brand').textContent = C.org;
    $('#heroName').textContent = C.name;
    $('#heroTag').textContent = C.tagline;
    $('#copy').textContent = '© ' + new Date().getFullYear() + ' ' + C.org;
    var V = C.visit;
    $('#contact').innerHTML = '<p>' + esc(V.address) + '</p><div class="foot-links">' +
      (V.phone ? '<a href="tel:' + esc(V.phone.replace(/[^\d+]/g, '')) + '">' + esc(V.phone) + '</a>' : '') +
      (V.email ? '<a href="mailto:' + esc(V.email) + '">' + esc(V.email) + '</a>' : '') +
      (V.facebookUrl ? '<a href="' + esc(V.facebookUrl) + '" target="_blank" rel="noopener">Facebook</a>' : '') +
      (V.bookingUrl ? '<a href="' + esc(V.bookingUrl) + '" target="_blank" rel="noopener">預約導覽</a>' : '') +
      '<a href="?view=services">服務項目</a><a href="?view=archives">所有文章</a><a href="?view=search">搜尋</a></div>';

    var here = location.search || './';
    $('#nav').innerHTML = (C.nav || []).map(function (n) {
      var kids = navChildren(n);
      if (kids.length) {
        var top = n.type === 'menu' ? '' : navHref(n);
        return '<details><summary>' + esc(n.label) + '</summary><div class="sub">' +
          (top ? '<a href="' + esc(top) + '">' + esc(n.label) + '總覽</a>' : '') +
          kids.map(function (c) { return '<a href="' + esc(c.href) + '">' + esc(c.label) + '</a>'; }).join('') + '</div></details>';
      }
      var h = navHref(n);
      return '<a href="' + esc(h) + '"' + (h === here ? ' aria-current="page"' : '') + '>' + esc(n.label) + '</a>';
    }).join('');

    // 手機版選單：展開的面板從頁首下方開始
    var setTop = function () { document.documentElement.style.setProperty('--topbar-h', $('.topbar').offsetHeight + 'px'); };
    setTop();
    window.addEventListener('resize', setTop);

    // 手機版選單按鈕
    var mb = $('#menuBtn'), nav = $('#nav');
    if (mb && !mb._bound) {
      mb._bound = true;
      var setOpen = function (o) {
        document.body.classList.toggle('menu-open', o);
        mb.setAttribute('aria-expanded', o ? 'true' : 'false');
        mb.textContent = o ? '關閉' : '選單';
      };
      mb.addEventListener('click', function () { setOpen(!document.body.classList.contains('menu-open')); });
      nav.addEventListener('click', function (e) { if (e.target.closest('a')) setOpen(false); });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setOpen(false); });
    }

    // 封面按鈕
    var hb = $('#heroBtns');
    if (hb) {
      var H = C.hero || {};
      var book = bookingUrl();
      hb.innerHTML = '<a class="btn" href="?view=services">' + esc(H.primaryText || '看服務項目') + '</a>' +
        '<a class="btn ghost-dark" href="' + esc(book || './#visit') + '"' + (book ? ' target="_blank" rel="noopener"' : '') + '>' + esc(H.secondaryText || '預約導覽') + '</a>';
    }

    // Email 訂閱：使用 WordPress.com 原本的訂閱服務，現有訂閱者不用搬
    var blogId = C.wordpressBlogId
      ? Promise.resolve(String(C.wordpressBlogId))
      : cached('fs30-blogid', function () {
          return fetchJSON('https://public-api.wordpress.com/rest/v1.1/sites/' + C.wordpressSite + '?fields=ID', 2).then(function (d) { return String(d.ID || ''); });
        });
    blogId.then(function (id) {
      if (!id) throw new Error('no id');
      $('#subscribe').innerHTML = '<p>留下 Email，有新文章時會寄信通知你。訂閱由 WordPress.com 處理，需要到信箱點確認信。</p>' +
        '<form class="sub-form" action="https://subscribe.wordpress.com" method="post" accept-charset="utf-8" target="_blank">' +
        '<input type="hidden" name="action" value="subscribe"><input type="hidden" name="blog_id" value="' + esc(id) + '">' +
        '<input type="hidden" name="source" value="' + esc(location.origin + location.pathname) + '"><input type="hidden" name="sub-type" value="widget">' +
        '<label class="sr" for="subEmail">Email</label><input id="subEmail" type="email" name="email" required placeholder="你的 Email" autocomplete="email">' +
        '<button class="btn" type="submit">訂閱</button></form>';
    }).catch(function () {
      $('#subscribe').innerHTML = '<p><a class="more" href="https://' + esc(C.wordpressSite) + '/" target="_blank" rel="noopener">到 WordPress 訂閱 Email 通知</a></p>';
    });

    if (C.goatcounter) {
      var s = document.createElement('script');
      s.async = true; s.src = 'https://gc.zgo.at/count.js';
      s.setAttribute('data-goatcounter', 'https://' + C.goatcounter + '.goatcounter.com/count');
      document.body.appendChild(s);
    }
  }

  /* ---------- 首頁 ---------- */

  function secHead(key, id, fallback) {
    var c = sectionConf(key);
    return '<h2 class="sec-h" id="' + id + '">' + esc(c.title || fallback) + '</h2>' + (c.intro ? '<p class="sec-intro">' + esc(c.intro) + '</p>' : '');
  }

  // 服務卡片：直式大照片 + 名稱 + 一句話 + 服務資訊標籤
  function svcCard(x, i) {
    var src = img(x.cover, 900);
    var chips = [x.duration, x.audience, x.fee].filter(Boolean).slice(0, 2);
    return '<a class="svc-card" href="' + serviceUrl(x) + '"><div class="svc-photo ph t' + (i % 3 + 1) + '">' +
      (src ? '<img data-ph="1" src="' + esc(src) + '" alt="" loading="' + (i < 2 ? 'eager' : 'lazy') + '" decoding="async" referrerpolicy="no-referrer">' : '') + '</div>' +
      '<div class="svc-text"><h3>' + esc(x.title) + '</h3>' + (x.summary ? '<p>' + esc(x.summary) + '</p>' : '') +
      (chips.length ? '<ul class="chips">' + chips.map(function (c) { return '<li>' + esc(c) + '</li>'; }).join('') + '</ul>' : '') + '</div></a>';
  }
  function servicesHtml(rail) {
    var list = shown(D.services);
    if (!list.length) return '';
    return '<div class="' + (rail ? 'svc-rail' : 'svc-grid2') + '">' + list.map(svcCard).join('') + '</div>';
  }
  function cardHtml(x, href, i) {
    var src = img(x.cover, 800);
    return '<a class="card" href="' + href + '"><div class="ph t' + (i % 3 + 1) + '" aria-hidden="true">' +
      (src ? '<img data-ph="1" src="' + esc(src) + '" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">' : '') +
      '</div><h3>' + esc(x.title) + '</h3>' + (x.summary ? '<p>' + esc(x.summary) + '</p>' : '') + '</a>';
  }
  function townsHtml() {
    var list = shown(D.towns);
    if (!list.length) return '';
    return '<div class="cards cards-sm">' + list.map(function (x, i) { return cardHtml(x, townUrl(x), i + 1); }).join('') + '</div>';
  }

  function ytId(u) {
    var m = String(u || '').match(/(?:youtu\.be\/|v=|embed\/|shorts\/|live\/)([\w-]{11})/);
    return m ? m[1] : '';
  }
  function videoCard(v) {
    var id = ytId(v.url);
    if (!id) return '';
    return '<figure class="vid"><button type="button" class="vid-play" data-yt="' + id + '" aria-label="播放：' + esc(v.title) + '">' +
      '<img src="https://i.ytimg.com/vi/' + id + '/hqdefault.jpg" alt="" loading="lazy" decoding="async"><span class="vid-btn" aria-hidden="true"></span></button>' +
      '<figcaption><strong>' + esc(v.title) + '</strong>' + (v.description ? '<span>' + esc(v.description) + '</span>' : '') + '</figcaption></figure>';
  }

  function bookingActs(svc, compact) {
    var V = C.visit, book = bookingUrl(svc);
    return (book ? '<a class="btn" href="' + esc(book) + '" target="_blank" rel="noopener">線上預約</a>' : '') +
      (V.phone ? '<a class="btn ' + (book ? 'line' : '') + '" href="tel:' + esc(V.phone.replace(/[^\d+]/g, '')) + '">' + (compact ? '打電話' : '打電話 ' + esc(V.phone)) + '</a>' : '') +
      (V.line ? '<a class="btn line" href="' + esc(/^https?:/.test(V.line) ? V.line : 'https://line.me/R/ti/p/' + encodeURIComponent(V.line)) + '" target="_blank" rel="noopener">LINE 詢問</a>' : '') +
      (!V.line && V.facebookUrl ? '<a class="btn line" href="' + esc(V.facebookUrl) + '" target="_blank" rel="noopener">Facebook 私訊</a>' : '');
  }

  // 預約與到訪：開放狀態、時間地址、預約按鈕，一個區塊講完
  function bookingBarHtml(key) {
    var V = C.visit;
    var fmt = function (t) { return String(t || '').replace(/^0/, ''); };
    var map = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(V.address);
    return '<section class="booking" id="visit" aria-labelledby="bkH"><div class="wrap booking-in"><div class="booking-head">' + secHead(key, 'bkH', '預約與到訪') +
      '<p class="status" data-status><span class="dot"></span><span class="status-text"></span></p></div>' +
      '<dl class="booking-facts"><div><dt>開放時間</dt><dd>' + esc(V.openText) + ' ' + fmt(V.open) + '–' + fmt(V.close) + '</dd></div>' +
      '<div><dt>地址</dt><dd><a href="' + map + '" target="_blank" rel="noopener">' + esc(V.address) + '</a>' + (V.transport ? '<small>' + esc(V.transport) + '</small>' : '') + '</dd></div></dl>' +
      '<div class="booking-acts">' + bookingActs() + '</div></div></section>';
  }

  // 探索更多：社區、媒體報導、影片、山海集、紀錄文章，各一張小圖卡
  function exploreHtml(key) {
    var tiles = [];
    var tw = shown(D.towns), md = mediaSorted(), vd = shown(D.videos);
    if (tw.length) tiles.push(['?view=towns', '社區人文', tw.length + ' 個社區', img((tw.filter(function (x) { return x.cover; })[0] || {}).cover, 600)]);
    if (md.length) tiles.push(['?view=media', '媒體報導', md.length + ' 則報導', img((md.filter(function (x) { return x.cover; })[0] || {}).cover, 600)]);
    if (vd.length) { var id = ytId(vd[0].url); tiles.push(['?view=videos', '影片精選', vd.length + ' 部影片', id ? 'https://i.ytimg.com/vi/' + id + '/hqdefault.jpg' : '']); }
    if (C.shanhaiji && C.shanhaiji.text) tiles.push(['?view=shanhaiji', '《山海集》', '協會的地方刊物', '']);
    tiles.push(['?view=archives', '紀錄文章', '活動紀錄與在地觀察', '']);
    return '<section class="explore wrap" id="explore" aria-labelledby="exH">' + secHead(key, 'exH', '探索更多') + '<div class="tiles">' +
      tiles.map(function (t, i) {
        return '<a class="tile' + (t[3] ? ' has-img' : ' t' + (i % 3 + 1)) + '" href="' + t[0] + '">' +
          (t[3] ? '<img data-ph="1" src="' + esc(t[3]) + '" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">' : '') +
          '<span class="tile-txt"><strong>' + esc(t[1]) + '</strong><small>' + esc(t[2]) + '</small></span></a>';
      }).join('') + '</div></section>';
  }

  function shanhaijiHtml(sec) {
    var S = C.shanhaiji || {};
    return '<section class="band" id="shanhaiji" aria-labelledby="sH"><div class="wrap band-in"><div class="covers" aria-hidden="true">' +
      (S.covers || []).slice(0, 3).map(function (c, i) { return '<div class="mag m' + (i + 1) + '"><span class="mv">山海集</span><span class="my">' + esc(c) + '</span></div>'; }).join('') +
      '</div><div><h2 id="sH">' + esc((sec && sec.title) || '《山海集》') + '</h2><p>' + esc(S.text) + '</p><div class="btns">' +
      (S.buyUrl ? '<a class="btn" href="' + esc(S.buyUrl) + '" target="_blank" rel="noopener">' + esc(S.buyText || '購買') + '</a>' : '') +
      (S.blogUrl ? '<a class="btn ghost" href="' + esc(S.blogUrl) + '" target="_blank" rel="noopener">' + esc(S.blogText || '閱讀部落格') + '</a>' : '') +
      '</div></div></div></section>';
  }

  function renderHome() {
    setTitle('', C.description);
    $('#hero').hidden = false;
    playIntro();
    var needPosts = (C.sections || []).some(function (x) { return x.key === 'posts' && x.show; });
    var postsP = needPosts ? api('posts', { per_page: C.homePostCount || 4, _fields: LIST_FIELDS }) : Promise.resolve([]);
    // 文章讀不到時，首頁其他段落照常顯示
    Promise.all([postsP.catch(function () { return null; }), categoriesP.catch(function () { return []; })]).then(function (r) {
      var posts = r[0] && hideImported(r[0]), cats = r[1];
      view.innerHTML = (C.sections || []).filter(function (x) { return x.show; }).map(function (sec) {
        var k = sec.key;
        if (k === 'services') {
          var sv = servicesHtml(true);
          return sv ? '<section class="svc-home" id="services" aria-labelledby="svH"><div class="wrap svc-home-head"><div>' + secHead(k, 'svH', '協會的服務') + '</div>' +
            '<a class="more" href="?view=services">所有服務</a></div>' + sv + '<p class="wrap swipe-hint" aria-hidden="true">左右滑動看更多服務</p></section>' : '';
        }
        if (k === 'booking') return bookingBarHtml(k);
        if (k === 'events') return eventsHtml(k);
        if (k === 'explore') return exploreHtml(k);
        if (k === 'towns') {
          var tw = townsHtml();
          return tw ? '<section class="towns wrap" id="towns" aria-labelledby="tH">' + secHead(k, 'tH', '小鎮社區人文') + tw + '</section>' : '';
        }
        if (k === 'shanhaiji') return shanhaijiHtml(sec);
        if (k === 'videos') {
          var vids = shown(D.videos).slice(0, 3).map(videoCard).join('');
          return vids ? '<section class="videos wrap" id="videos" aria-labelledby="vdH">' + secHead(k, 'vdH', '影片精選') +
            '<div class="vid-grid">' + vids + '</div><p class="list-more"><a class="more" href="?view=videos">看所有影片</a></p></section>' : '';
        }
        if (k === 'posts') {
          if (posts === null) return '';
          return '<section class="journal wrap" id="journal" aria-labelledby="jH">' + secHead(k, 'jH', '活動紀錄與在地觀察') +
            '<div class="feed">' + listHtml(posts, cats) + '</div><div class="list-more"><a class="more" href="?view=archives">看所有文章</a></div></section>';
        }
        if (k === 'media') {
          var all = mediaSorted();
          if (!all.length) return '';
          return '<section class="journal media wrap" id="media" aria-labelledby="mdH">' + secHead(k, 'mdH', '媒體報導') +
            '<div class="feed">' + mediaListHtml(all.slice(0, sec.count || 3)) + '</div>' +
            (all.length > (sec.count || 3) ? '<div class="list-more"><a class="more" href="?view=media">看全部媒體報導（' + all.length + ' 則）</a></div>' : '') + '</section>';
        }
        if (k === 'visit') return visitHtml(k);
        return '';
      }).join('');
      updateOpenStatus();
      var rail = $('.svc-rail');
      if (rail && rail.scrollWidth <= rail.clientWidth + 4) { var h = $('.swipe-hint'); if (h) h.remove(); }
      if (location.hash) { var el = document.getElementById(location.hash.slice(1)); if (el) el.scrollIntoView(); }
    });
  }

  // 首頁開場：標題逐字出現，接著古厝大門打開。每次開啟瀏覽器只播放一次；系統設定減少動態時不播放
  function playIntro() {
    var hero = $('#hero'), gate = $('#gateFig');
    var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    var seen = false;
    try { seen = sessionStorage.getItem('fs30-intro') === '1'; sessionStorage.setItem('fs30-intro', '1'); } catch (e) { /* 忽略 */ }
    if (reduce || seen) { hero.classList.add('intro-done'); return; }
    var h = $('#heroName');
    h.innerHTML = Array.prototype.map.call(h.textContent, function (ch, i) { return '<span style="--i:' + i + '">' + esc(ch) + '</span>'; }).join('');
    hero.classList.add('intro');
    setTimeout(function () {
      gate.classList.add('is-open');
      var b = $('#gateBtn'); if (b) { b.setAttribute('aria-pressed', 'true'); b.setAttribute('aria-label', '關門'); }
    }, 1300);
    setTimeout(function () { hero.classList.add('intro-done'); }, 2400);
  }

  function upcomingEvents(service) {
    var today = taipeiToday();
    return (D.events || []).filter(function (e) {
      return e.title && e.date && (e.end || e.date) >= today && (!service || e.service === service);
    }).sort(function (a, b) { return a.date < b.date ? -1 : 1; });
  }

  function eventsListHtml(list) {
    return '<ul class="ev-list">' + list.map(function (e) {
      var d = e.date.split('-');
      var wd = '日一二三四五六'.charAt(new Date(e.date + 'T00:00:00+08:00').getUTCDay());
      var span = e.end && e.end !== e.date ? '–' + (+e.end.split('-')[1]) + ' 月 ' + (+e.end.split('-')[2]) + ' 日' : '';
      var sv = e.service && findBy(D.services, e.service);
      return '<li class="ev"><p class="ev-date">' + (+d[1]) + ' 月 ' + (+d[2]) + ' 日' + span +
        '<small>週' + wd + (e.time ? '　' + esc(e.time) : '') + '</small></p><div><h3>' +
        (e.link ? '<a href="' + esc(e.link) + '">' + esc(e.title) + '</a>' : esc(e.title)) + '</h3>' +
        (e.place || e.note ? '<p>' + esc([e.place, e.note].filter(Boolean).join('。')) + '</p>' : '') +
        (sv ? '<p class="ev-svc"><a href="' + serviceUrl(sv) + '">' + esc(sv.title) + '</a></p>' : '') + '</div></li>';
    }).join('') + '</ul>';
  }

  function eventsHtml(key) {
    var list = upcomingEvents();
    if (!list.length) return '';
    return '<section class="events wrap" id="events" aria-labelledby="evH">' + secHead(key, 'evH', '近期活動') + eventsListHtml(list) + '</section>';
  }

  function visitHtml(key) {
    var V = C.visit;
    var fmt = function (t) { return String(t || '').replace(/^0/, ''); };
    var map = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(V.address);
    return '<section class="visit wrap" id="visit" aria-labelledby="vH">' + secHead(key, 'vH', '到訪陳家古厝') + '<div class="visit-grid">' +
      '<div><p class="k">地址</p><p class="val"><a href="' + map + '" target="_blank" rel="noopener">' + esc(V.address.slice(0, 6)) + '<br>' + esc(V.address.slice(6)) + '</a></p>' +
      (V.transport ? '<p class="visit-note">' + esc(V.transport) + '</p>' : '') + '</div>' +
      '<div><p class="k">開放時間</p><p class="val">' + esc(V.openText) + '<br>' + fmt(V.open) + '–' + fmt(V.close) + '</p>' +
      '<p class="status" data-status aria-live="polite"><span class="dot"></span><span class="status-text"></span></p></div>' +
      '<div><p class="k">聯絡</p><p class="val">' +
      (V.phone ? '<a href="tel:' + esc(V.phone.replace(/[^\d+]/g, '')) + '">' + esc(V.phone) + '</a><br>' : '') +
      (V.email ? '<a href="mailto:' + esc(V.email) + '">' + esc(V.email) + '</a><br>' : '') +
      (V.facebookUrl ? '<a href="' + esc(V.facebookUrl) + '" target="_blank" rel="noopener">Facebook：' + esc(V.facebookLabel || '粉絲專頁') + '</a>' : '') +
      (V.bookingUrl ? '<br><a href="' + esc(V.bookingUrl) + '" target="_blank" rel="noopener">填寫預約表單</a>' : '') + '</p></div></div></section>';
  }

  // 依台北時間顯示現在是否開放
  function updateOpenStatus() {
    var els = $$('[data-status]');
    if (!els.length) return;
    var msg = '', open = false;
    try {
      var V = C.visit;
      var toMin = function (t) { var a = t.split(':'); return +a[0] * 60 + +a[1]; };
      var o = toMin(V.open), c = toMin(V.close);
      var parts = {};
      new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Taipei', weekday: 'short', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' })
        .formatToParts(new Date()).forEach(function (x) { parts[x.type] = x.value; });
      var d = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[parts.weekday];
      var m = (+parts.hour % 24) * 60 + +parts.minute;
      var names = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];
      var days = (V.openDays || []).map(Number);
      if (days.indexOf(d) >= 0 && m >= o && m < c) {
        open = true;
        msg = '現在開放中，今天到 ' + V.close.replace(/^0/, '');
      } else {
        for (var i = 0; i <= 7; i++) {
          var dd = (d + i) % 7;
          if (days.indexOf(dd) < 0 || (i === 0 && m >= o)) continue;
          msg = '目前休館，' + (i === 0 ? '今天' : i === 1 ? '明天' : names[dd]) + ' ' + V.open.replace(/^0/, '') + ' 開放';
          break;
        }
      }
    } catch (e) { msg = ''; }
    els.forEach(function (el) {
      if (!msg) { el.hidden = true; return; }
      el.classList.toggle('open', open);
      el.querySelector('.status-text').textContent = msg;
    });
  }

  /* ---------- 媒體報導 ---------- */

  function mediaUrl(x) { return q({ media: x.slug || x.title }); }
  function mediaSorted() {
    return shown(D.media).slice().sort(function (a, b) { return (b.date || '') < (a.date || '') ? -1 : 1; });
  }
  function mediaListHtml(list) {
    return list.map(function (x, i) {
      var src = img(x.cover, 480);
      return '<article class="post"><div class="p-date"><span>' + esc(dotDate(x.date || '')) + '</span>' + (x.outlet ? '<span>' + esc(x.outlet) + '</span>' : '') + '</div>' +
        '<div><h3><a href="' + mediaUrl(x) + '">' + esc(x.title) + '</a></h3>' + (x.summary ? '<p>' + esc(x.summary) + '</p>' : '') + '</div>' +
        '<div class="ph thumb t' + (i % 3 + 1) + '" aria-hidden="true">' + (src ? '<img data-ph="1" src="' + esc(src) + '" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">' : '') + '</div></article>';
    }).join('');
  }
  function renderMediaIndex() {
    var conf = sectionConf('media');
    var t = conf.title || '媒體報導';
    setTitle(t);
    var list = mediaSorted();
    view.innerHTML = '<div class="wrap list-page"><header class="list-head"><h1>' + esc(t) + '</h1>' +
      (conf.intro ? '<p>' + esc(conf.intro) + '</p>' : '') + '</header>' +
      (list.length ? '<div class="feed">' + mediaListHtml(list) + '</div>' : '<p class="c-empty">目前還沒有媒體報導。</p>') + '</div>';
  }
  function renderMediaDetail(slug) {
    var x = findBy(D.media, slug);
    if (!x) { var e = new Error('not found'); e.notFound = true; return showError(e, '報導'); }
    setTitle(x.title, x.summary || C.description);
    var cover = img(x.cover, 1600);
    var body = clean(x.body || '');
    var first = (body.match(/<img[^>]+src="([^"]+)"/) || [])[1];
    var share = location.origin + location.pathname + mediaUrl(x);
    view.innerHTML = '<article class="wrap art"><a class="back" href="?view=media">所有媒體報導</a><div class="art-grid">' +
      '<header class="art-head"><div class="meta"><span>媒體報導</span>' + (x.date ? '<time datetime="' + esc(x.date) + '">' + longDate(x.date) + '</time>' : '') +
      (x.outlet ? '<span>' + esc(x.outlet) + '</span>' : '') + '</div><h1>' + esc(x.title) + '</h1></header>' +
      (cover && imageKey(cover) !== imageKey(first) ? '<div class="art-cover"><div class="ph t2" style="aspect-ratio:16/9"><img data-ph="1" src="' + esc(cover) + '" alt="" decoding="async" referrerpolicy="no-referrer"></div></div>' : '') +
      '<div class="prose">' + (x.summary && !body ? '<p>' + esc(x.summary) + '</p>' : '') + '<div class="entry">' + body + '</div>' +
      (x.url ? '<p style="margin-top:28px"><a class="btn" href="' + esc(x.url) + '" target="_blank" rel="noopener">閱讀原始報導' + (x.outlet ? '（' + esc(x.outlet) + '）' : '') + '</a></p>' : '') +
      '<div class="art-foot">' + shareHtml(x.title, share) + '</div></div></div></article>';
  }

  /* ---------- 服務、社區、影片 ---------- */

  function galleryHtml(list) {
    list = (list || []).filter(Boolean);
    if (!list.length) return '';
    return '<div class="gallery-grid">' + list.map(function (u) {
      return '<figure><img src="' + esc(img(u, 800)) + '" data-full="' + esc(img(u, 2000)) + '" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer"></figure>';
    }).join('') + '</div>';
  }

  // 服務頁、社區頁下方的相關文章（依 WordPress 的分類或標籤）
  function loadRelatedPosts(x, box) {
    if (!x.relatedCategory && !x.relatedTag) return;
    var tagP = x.relatedTag ? api('tags', { slug: x.relatedTag, _fields: 'id' }).then(function (l) { return l[0] && l[0].id; }) : Promise.resolve(null);
    Promise.all([categoriesP, tagP]).then(function (r) {
      var cat = x.relatedCategory && r[0].filter(function (c) { return c.name === x.relatedCategory || c.slugText === x.relatedCategory; })[0];
      var query = { per_page: 6, _fields: LIST_FIELDS };
      if (r[1]) query.tags = r[1];
      else if (cat) query.categories = cat.id;
      else return;
      return api('posts', query).then(function (posts) {
        if (!posts.length) return;
        box.innerHTML = '<h2>相關紀錄</h2><div class="feed">' + listHtml(posts, r[0]) + '</div>' +
          '<p class="list-more"><a class="more" href="' + (r[1] ? q({ tag: x.relatedTag }) : catUrl(cat)) + '">看更多</a></p>';
        box.hidden = false;
      });
    }).catch(function () {});
  }

  function detailHtml(x, kind) {
    var cover = img(x.cover, 1600);
    var info = '';
    if (kind === 'service') {
      var rows = [['適合對象', x.audience], ['所需時間', x.duration], ['人數', x.capacity], ['費用', x.fee]].filter(function (r) { return r[1]; });
      var book = bookingUrl(x), V = C.visit;
      info = '<aside class="svc-info" aria-label="服務資訊">' +
        (rows.length ? '<dl>' + rows.map(function (r) { return '<dt>' + r[0] + '</dt><dd>' + esc(r[1]) + '</dd>'; }).join('') + '</dl>' : '') +
        '<div class="svc-book">' + bookingActs(x) +
        (V.email ? '<a class="more" href="mailto:' + esc(V.email) + '?subject=' + encodeURIComponent('詢問：' + x.title) + '">Email 詢問</a>' : '') +
        '</div></aside>';
    } else if (x.mapUrl) {
      info = '<aside class="svc-info"><div class="svc-book"><a class="btn" href="' + esc(x.mapUrl) + '" target="_blank" rel="noopener">在地圖上看</a></div></aside>';
    }
    var evs = kind === 'service' ? upcomingEvents(x.slug || x.title) : [];
    var back = kind === 'service' ? '<a class="back" href="?view=services">所有服務</a>' : '<a class="back" href="?view=towns">所有社區</a>';
    return '<article class="wrap detail">' + back +
      '<header class="detail-head"><p class="meta"><span>' + (kind === 'service' ? '協會服務' : '小鎮社區人文') + '</span></p><h1>' + esc(x.title) + '</h1>' +
      (x.summary ? '<p class="lead">' + esc(x.summary) + '</p>' : '') + '</header>' +
      (cover ? '<div class="art-cover"><div class="ph t2" style="aspect-ratio:16/9"><img data-ph="1" src="' + esc(cover) + '" alt="" decoding="async" referrerpolicy="no-referrer"></div></div>' : '') +
      '<div class="detail-grid"><div class="prose"><div class="entry">' + clean(x.body || '') + '</div>' + galleryHtml(x.gallery) + '</div>' + info + '</div>' +
      (evs.length ? '<section class="detail-sec" aria-labelledby="dEv"><h2 id="dEv">近期活動</h2>' + eventsListHtml(evs) + '</section>' : '') +
      '<section class="detail-sec" id="relPosts" hidden></section>' +
      (kind === 'service' ? '<div class="m-book" role="region" aria-label="預約">' + bookingActs(x, true) + '</div>' : '') +
      '</article>';
  }

  function renderDetail(kind, slug) {
    var x = findBy(kind === 'service' ? D.services : D.towns, slug);
    if (!x) { var e = new Error('not found'); e.notFound = true; return showError(e, kind === 'service' ? '服務' : '社區頁'); }
    setTitle(x.title, x.summary || C.description);
    view.innerHTML = detailHtml(x, kind);
    loadRelatedPosts(x, $('#relPosts'));
  }

  function renderIndex(kind) {
    var isSvc = kind === 'services';
    var conf = sectionConf(isSvc ? 'services' : 'towns');
    setTitle(conf.title || (isSvc ? '協會的服務' : '小鎮社區人文'));
    view.innerHTML = '<div class="wrap list-page"><header class="list-head"><h1>' + esc(conf.title || (isSvc ? '協會的服務' : '小鎮社區人文')) + '</h1>' +
      (conf.intro ? '<p>' + esc(conf.intro) + '</p>' : '') + '</header>' +
      ((isSvc ? servicesHtml(false) : townsHtml()) || '<p class="c-empty">目前沒有內容。</p>') + '</div>' +
      (isSvc ? bookingBarHtml('booking') : '');
    updateOpenStatus();
  }

  function renderVideos() {
    var conf = sectionConf('videos');
    setTitle(conf.title || '影片精選');
    var vids = shown(D.videos).map(videoCard).join('');
    view.innerHTML = '<div class="wrap list-page"><header class="list-head"><h1>' + esc(conf.title || '影片精選') + '</h1>' +
      (conf.intro ? '<p>' + esc(conf.intro) + '</p>' : '') + '</header>' +
      (vids ? '<div class="vid-grid">' + vids + '</div>' : '<p class="c-empty">目前還沒有影片。</p>') + '</div>';
  }

  /* ---------- 文章 ---------- */

  function renderPost(idOrSlug) {
    var getPost = /^\d+$/.test(idOrSlug)
      ? api('posts/' + idOrSlug, { _fields: POST_FIELDS })
      : api('posts', { slug: idOrSlug, _fields: POST_FIELDS }).then(function (l) {
          if (!l.length) { var e = new Error('not found'); e.notFound = true; throw e; }
          return l[0];
        });
    Promise.all([getPost, categoriesP]).then(function (r) {
      var p = r[0], cats = r[1];
      var cs = catsById(p.categories, cats);
      var t = title(p);
      setTitle(t, excerpt(p, 150));
      if (history.replaceState && !params.get('p')) history.replaceState(null, '', postUrl(p) + location.hash);

      var body = clean(p.content && p.content.rendered);
      var first = (body.match(/<img[^>]+src="([^"]+)"/) || [])[1];
      var cover = p.jetpack_featured_media_url;
      var coverHtml = cover && imageKey(cover) !== imageKey(first)
        ? '<div class="art-cover"><div class="ph t2" style="aspect-ratio:16/9"><img data-ph="1" src="' + esc(sized(cover, 1400)) +
          '" srcset="' + esc(sized(cover, 800)) + ' 800w, ' + esc(sized(cover, 1400)) + ' 1400w, ' + esc(sized(cover, 2000)) + ' 2000w" sizes="(max-width:1120px) 100vw, 1120px" alt="" decoding="async" referrerpolicy="no-referrer"></div></div>'
        : '';
      var share = location.origin + location.pathname + postUrl(p);

      view.innerHTML = '<article class="wrap art"><a class="back" href="./#journal">回到文章列表</a><div class="art-grid">' +
        '<header class="art-head"><div class="meta"><time datetime="' + esc(p.date) + '">' + longDate(p.date) + '</time>' +
        cs.map(function (c) { return '<a href="' + catUrl(c) + '">' + esc(c.name) + '</a>'; }).join('') + '</div><h1>' + esc(t) + '</h1></header>' +
        coverHtml +
        '<div class="prose"><div class="entry">' + body + '</div>' +
        '<div class="art-foot"><div class="tags" id="tags"></div>' + shareHtml(t, share) + '</div>' +
        '<section class="comments" aria-labelledby="chead"><h2 class="c-h" id="chead">留言</h2><div id="clist"><p class="loading">讀取留言…</p></div>' +
        (p.comment_status === 'open'
          ? '<div class="c-write"><a class="btn" href="' + esc(https(p.link)) + '#respond" target="_blank" rel="noopener">我要留言</a>' +
            '<p>會開啟原網站的留言表單，填暱稱和 Email 就能留言。送出後回到這裡重新整理，就會看到你的留言（有些留言需要審核後才會顯示）。</p></div>'
          : '<p class="c-off">這篇文章已關閉留言。</p>') +
        '</section><section class="related" id="related" aria-labelledby="relH" hidden></section></div></div>' +
        '<nav class="pn" id="pn" aria-label="上下篇"></nav></article>';

      loadComments(p.id);
      loadTags(p.tags);
      loadNeighbors(p);
      loadRelated(p);
      if (location.hash) setTimeout(function () { var el = document.getElementById(location.hash.slice(1)); if (el) el.scrollIntoView(); }, 300);
    }).catch(function (e) { showError(e, '文章'); });
  }

  function shareHtml(t, u) {
    var eu = encodeURIComponent(u), et = encodeURIComponent(t);
    return '<div class="share" role="group" aria-label="分享這篇文章"><p class="share-q">分享</p>' +
      '<a href="https://social-plugins.line.me/lineit/share?url=' + eu + '" target="_blank" rel="noopener">LINE</a>' +
      '<a href="https://www.facebook.com/sharer/sharer.php?u=' + eu + '" target="_blank" rel="noopener">Facebook</a>' +
      '<a href="https://twitter.com/intent/tweet?url=' + eu + '&text=' + et + '" target="_blank" rel="noopener">X</a>' +
      '<button type="button" data-copy="' + esc(u) + '">複製連結</button></div>';
  }

  function loadComments(postId) {
    allPages('comments', { post: postId, order: 'asc', _fields: 'id,parent,author_name,date,content' }).then(function (list) {
      var byId = {}, roots = [];
      list.forEach(function (c) { c.children = []; byId[c.id] = c; });
      list.forEach(function (c) { (c.parent && byId[c.parent] ? byId[c.parent].children : roots).push(c); });
      var tree = function (arr) {
        return '<ul class="c-list">' + arr.map(function (c) {
          return '<li class="c-item" id="comment-' + c.id + '"><div><span class="c-name">' + esc(text(c.author_name) || '訪客') + '</span>' +
            '<span class="c-time">' + longDate(c.date) + '</span></div><div class="c-body">' + clean(c.content && c.content.rendered, true) + '</div>' +
            (c.children.length ? tree(c.children) : '') + '</li>';
        }).join('') + '</ul>';
      };
      $('#chead').textContent = list.length ? '留言（' + list.length + '）' : '留言';
      $('#clist').innerHTML = list.length ? '<div class="old-c" style="margin-top:0">' + tree(roots) + '</div>' : '<p class="c-empty">還沒有人留言，留下第一則吧。</p>';
    }).catch(function () {
      $('#clist').innerHTML = '<p class="c-empty">暫時讀不到留言，請稍後重新整理。</p>';
    });
  }

  function loadTags(ids) {
    if (!ids || !ids.length) return;
    api('tags', { include: ids.join(','), _fields: 'id,name,slug' }).then(function (list) {
      $('#tags').innerHTML = list.map(function (t) {
        return '<a href="' + tagUrl({ slugText: decodeSlug(t.slug) }) + '">#' + esc(text(t.name)) + '</a>';
      }).join('');
    }).catch(function () {});
  }

  function loadNeighbors(p) {
    var f = { per_page: 1, _fields: 'id,title' };
    Promise.all([
      api('posts', Object.assign({ before: p.date }, f)).catch(function () { return []; }),
      api('posts', Object.assign({ after: p.date, order: 'asc' }, f)).catch(function () { return []; }),
    ]).then(function (r) {
      var older = r[0][0], newer = r[1][0];
      var link = function (x, label, rel) {
        return x ? '<a href="' + postUrl(x) + '" rel="' + rel + '"><small>' + label + '</small><span>' + esc(title(x)) + '</span></a>' : '<span></span>';
      };
      $('#pn').innerHTML = link(older, '較舊的文章', 'prev') + link(newer, '較新的文章', 'next');
    });
  }

  function loadRelated(p) {
    if (!p.categories || !p.categories.length) return;
    api('posts', { categories: p.categories[0], exclude: p.id, per_page: 3, _fields: 'id,date,title' }).then(function (list) {
      if (!list.length) return;
      var box = $('#related');
      box.innerHTML = '<h2 id="relH">相關文章</h2><ul>' + list.map(function (r) {
        return '<li><small>' + longDate(r.date) + '</small><a href="' + postUrl(r) + '">' + esc(title(r)) + '</a></li>';
      }).join('') + '</ul>';
      box.hidden = false;
    }).catch(function () {});
  }

  /* ---------- 頁面（協會服務、社區人文等） ---------- */

  function renderPage(idOrSlug) {
    var getPage = /^\d+$/.test(idOrSlug)
      ? api('pages/' + idOrSlug, { _fields: 'id,title,content,excerpt,parent,link' })
      : api('pages', { slug: idOrSlug, _fields: 'id,title,content,excerpt,parent,link' }).then(function (l) {
          if (!l.length) { var e = new Error('not found'); e.notFound = true; throw e; }
          return l[0];
        });
    Promise.all([getPage, pagesP.catch(function () { return []; })]).then(function (r) {
      var p = r[0], pages = r[1];
      var t = title(p);
      setTitle(t, excerpt(p, 150));
      if (history.replaceState && !params.get('page_id')) history.replaceState(null, '', pageUrl(p) + location.hash);
      var parent = pages.filter(function (x) { return x.id === p.parent; })[0];
      var kids = pages.filter(function (x) { return x.parent === p.id; }).sort(function (a, b) { return a.order - b.order; });
      view.innerHTML = '<article class="wrap art">' +
        (parent ? '<a class="back" href="' + pageUrl(parent) + '">回到「' + esc(parent.title) + '」</a>' : '<a class="back" href="./">回到首頁</a>') +
        '<div class="art-grid"><header class="art-head"><h1>' + esc(t) + '</h1></header>' +
        '<div class="prose"><div class="entry">' + clean(p.content && p.content.rendered) + '</div>' +
        (kids.length ? '<section class="related page-kids"><h2>這個單元的頁面</h2><ul>' +
          kids.map(function (k) { return '<li><a href="' + pageUrl(k) + '">' + esc(k.title) + '</a></li>'; }).join('') + '</ul></section>' : '') +
        '</div></div></article>';
    }).catch(function (e) {
      // 舊網址的代稱可能是文章而不是頁面，再試一次
      if (e.notFound && !/^\d+$/.test(idOrSlug)) renderPost(idOrSlug);
      else showError(e, '頁面');
    });
  }

  /* ---------- 列表：所有文章、分類、標籤、搜尋 ---------- */

  function renderList(opts) {
    var n = Math.max(1, parseInt(params.get('paged'), 10) || 1);
    var per = C.perPage;
    // 第 1 頁的列表接在首頁之後：首頁已經顯示了最新的幾篇
    var offset = (n - 1) * per;
    var query = Object.assign({ per_page: per + 1, offset: offset, _fields: LIST_FIELDS }, opts.query || {});
    Promise.all([api('posts', query), categoriesP]).then(function (r) {
      var posts = r[0], cats = r[1];
      var hasMore = posts.length > per;
      posts = posts.slice(0, per);
      setTitle(opts.title + (n > 1 ? '（第 ' + n + ' 頁）' : ''));
      view.innerHTML = '<div class="wrap list-page"><header class="list-head">' +
        (opts.label ? '<p class="meta"><span>' + esc(opts.label) + '</span></p>' : '') +
        '<h1>' + esc(opts.title) + '</h1>' + (opts.note ? '<p>' + opts.note + '</p>' : '') + '</header>' +
        (opts.form || '') + (opts.local && (parseInt(params.get('paged'), 10) || 1) === 1 ? opts.local : '') +
        (opts.showFilter ? filterHtml(cats, opts.catId) : '') +
        (opts.form && !posts.length ? (opts.local ? '' : '<p class="search-hint">找不到相關文章，換個關鍵字試試，或看 <a href="?view=archives">所有文章</a>。</p>')
          : '<div class="feed" style="margin-top:20px">' + listHtml(posts, cats, n) + '</div>') +
        pagerHtml(n, hasMore, opts.keep || {}) + '</div>';
    }).catch(function (e) { showError(e); });
  }

  function renderCategory(slug) {
    if (isMediaCat(slug)) return renderMediaIndex();
    categoriesP.then(function (cats) {
      var c = cats.filter(function (x) { return x.slugText === slug || x.slug === slug || String(x.id) === slug || x.name === slug; })[0];
      if (!c) { var e = new Error('not found'); e.notFound = true; throw e; }
      renderList({ title: c.name, label: '分類', note: '共 ' + c.count + ' 篇。', query: { categories: c.id }, keep: { category_name: c.slugText }, showFilter: true, catId: c.id });
    }).catch(function (e) { showError(e, '分類'); });
  }

  function renderTag(slug) {
    api('tags', { slug: slug, _fields: 'id,name,count' }).then(function (l) {
      var t = l[0];
      if (!t) { var e = new Error('not found'); e.notFound = true; throw e; }
      renderList({ title: text(t.name), label: '標籤', note: '共 ' + t.count + ' 篇。', query: { tags: t.id }, keep: { tag: slug } });
    }).catch(function (e) { showError(e, '標籤'); });
  }

  function searchForm(v) {
    return '<form class="search-form" role="search" action="./" method="get"><label class="sr" for="sq">搜尋關鍵字</label>' +
      '<input id="sq" name="s" type="search" value="' + esc(v || '') + '" placeholder="例如：金紙、慈裕宮、手抄紙" required>' +
      '<button class="btn" type="submit">搜尋</button></form>';
  }

  function renderSearch(term) {
    if (!term) {
      setTitle('搜尋');
      view.innerHTML = '<div class="wrap list-page"><header class="list-head"><h1>搜尋</h1><p>輸入關鍵字，找文章。</p></header>' + searchForm('') + '</div>';
      var i = $('#sq'); if (i) i.focus();
      return;
    }
    renderList({ title: '搜尋「' + term + '」', label: '搜尋結果', query: { search: term }, keep: { s: term }, form: searchForm(term), local: localMatches(term) });
  }

  // 在服務、社區、媒體報導、影片裡找關鍵字（這些內容不在 WordPress，WordPress 搜尋找不到）
  function localMatches(term) {
    var t = term.toLowerCase(), out = [];
    var tmp = document.createElement('div');
    var has = function (x) {
      tmp.innerHTML = x.body || '';
      return [x.title, x.summary, x.outlet, x.description, tmp.textContent].join(' ').toLowerCase().indexOf(t) >= 0;
    };
    shown(D.services).filter(has).forEach(function (x) { out.push(['協會服務', x.title, serviceUrl(x)]); });
    shown(D.towns).filter(has).forEach(function (x) { out.push(['社區人文', x.title, townUrl(x)]); });
    mediaSorted().filter(has).forEach(function (x) { out.push(['媒體報導', x.title, mediaUrl(x)]); });
    shown(D.videos).filter(has).forEach(function (x) { out.push(['影片', x.title, '?view=videos']); });
    if (!out.length) return '';
    return '<section class="related" style="margin:28px 0 8px"><h2>網站頁面</h2><ul>' + out.map(function (o) {
      return '<li><small>' + o[0] + '</small><a href="' + esc(o[2]) + '">' + esc(o[1]) + '</a></li>';
    }).join('') + '</ul></section>';
  }

  function renderArchives() {
    setTitle('所有文章');
    Promise.all([allPages('posts', { _fields: 'id,date,title,categories' }), categoriesP]).then(function (r) {
      var posts = hideImported(r[0]), cats = r[1];
      var years = {}, order = [];
      posts.forEach(function (p) {
        var y = p.date.slice(0, 4);
        if (!years[y]) { years[y] = []; order.push(y); }
        years[y].push(p);
      });
      view.innerHTML = '<div class="wrap list-page"><header class="list-head"><h1>所有文章</h1><p>共 ' + posts.length + ' 篇，由新到舊排列。</p>' +
        '<nav class="arch-cats" aria-label="分類">' + cats.filter(function (c) { return c.count > 0; }).sort(function (a, b) { return b.count - a.count; })
          .map(function (c) { return '<a href="' + catUrl(c) + '">' + esc(c.name) + '（' + c.count + '）</a>'; }).join('') + '</nav></header>' +
        order.map(function (y) {
          return '<section class="arch-year" aria-labelledby="y' + y + '"><h2 id="y' + y + '">' + y + '</h2><ul class="arch-list">' +
            years[y].map(function (p) {
              var c = catsById(p.categories, cats)[0];
              return '<li><time datetime="' + esc(p.date) + '">' + p.date.slice(5, 10).replace('-', '.') + '</time><a href="' + postUrl(p) + '">' + esc(title(p)) + '</a><span>' + (c ? esc(c.name) : '') + '</span></li>';
            }).join('') + '</ul></section>';
        }).join('') + '</div>';
    }).catch(function (e) { showError(e); });
  }

  /* ---------- 互動：照片、選單、分享、門 ---------- */

  function bindInteractions() {
    // 照片載入成功蓋掉花磚底紋；失敗就保留底紋
    document.addEventListener('load', function (e) {
      var t = e.target;
      if (t.tagName === 'IMG' && t.getAttribute('data-ph')) t.parentNode.classList.add('has-img');
    }, true);
    document.addEventListener('error', function (e) {
      var t = e.target;
      if (t.tagName === 'IMG' && t.getAttribute('data-ph')) t.remove();
    }, true);

    // 古厝大門：點一下開門
    var gb = $('#gateBtn'), gf = $('#gateFig');
    if (gb) gb.addEventListener('click', function () {
      var o = gf.classList.toggle('is-open');
      gb.setAttribute('aria-pressed', o ? 'true' : 'false');
      gb.setAttribute('aria-label', o ? '關門' : '開門');
    });

    document.addEventListener('click', function (e) {
      // 子選單：點外面收起
      $$('.nav details').forEach(function (d) { if (!d.contains(e.target)) d.open = false; });
      // 複製連結
      var b = e.target.closest && e.target.closest('[data-copy]');
      if (b) {
        var link = b.getAttribute('data-copy');
        var done = function () { b.textContent = '已複製連結'; setTimeout(function () { b.textContent = '複製連結'; }, 2400); };
        if (navigator.share && window.matchMedia('(pointer:coarse)').matches) navigator.share({ url: link, title: document.title }).catch(function () {});
        else if (navigator.clipboard) navigator.clipboard.writeText(link).then(done, function () { window.prompt('複製這個連結：', link); });
        else window.prompt('複製這個連結：', link);
      }
    });
    // 影片：點縮圖才載入 YouTube 播放器，頁面比較快
    document.addEventListener('click', function (e) {
      var v = e.target.closest && e.target.closest('[data-yt]');
      if (!v) return;
      var f = document.createElement('iframe');
      f.src = 'https://www.youtube-nocookie.com/embed/' + v.getAttribute('data-yt') + '?autoplay=1&rel=0';
      f.title = v.getAttribute('aria-label') || '影片';
      f.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
      f.allowFullscreen = true;
      v.replaceWith(f);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') $$('.nav details').forEach(function (d) { d.open = false; });
    });

    // 內文照片點一下放大
    var box = $('#lightbox'), big = box.querySelector('img'), list = [], idx = 0;
    var show = function (i) { idx = (i + list.length) % list.length; big.src = list[idx].getAttribute('data-full'); big.alt = list[idx].alt; };
    document.addEventListener('click', function (e) {
      var img = e.target.closest && e.target.closest('.prose img[data-full]');
      if (!img || !box.showModal) return;
      e.preventDefault();
      list = $$('.prose img[data-full]');
      show(list.indexOf(img));
      box.showModal();
    });
    box.addEventListener('click', function (e) {
      var b = e.target.closest('[data-lb]');
      var a = b && b.getAttribute('data-lb');
      if (a === 'prev') show(idx - 1);
      else if (a === 'next') show(idx + 1);
      else if (b || e.target === box || e.target === big) box.close();
    });
    box.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') show(idx - 1);
      if (e.key === 'ArrowRight') show(idx + 1);
    });
  }

  /* ---------- 依網址決定顯示哪一頁 ---------- */

  // 已經用管理程式搬過來的 WordPress 頁面，舊連結改顯示新頁面
  function importedTarget(idOrSlug) {
    var hit = function (x) { return x && (String(x.wpId) === idOrSlug || (x.wpSlug && decodeSlug(x.wpSlug) === idOrSlug)); };
    var m = shown(D.media).filter(hit)[0];
    if (m) return function () { renderMediaDetail(m.slug || m.title); };
    var s = shown(D.services).filter(hit)[0];
    if (s) return function () { renderDetail('service', s.slug || s.title); };
    var t = shown(D.towns).filter(hit)[0];
    if (t) return function () { renderDetail('town', t.slug || t.title); };
    if ((D.site.importedVideoPages || []).some(function (p) { return String(p.id) === idOrSlug || decodeSlug(p.slug || '') === idOrSlug; })) return renderVideos;
    return null;
  }

  function route() {
    var g = function (k) { return (params.get(k) || '').trim(); };
    if (g('service')) return renderDetail('service', g('service'));
    if (g('town')) return renderDetail('town', g('town'));
    if (g('view') === 'services') return renderIndex('services');
    if (g('view') === 'towns') return renderIndex('towns');
    if (g('view') === 'videos') return renderVideos();
    if (g('view') === 'shanhaiji') { setTitle('山海集'); view.innerHTML = shanhaijiHtml(sectionConf('shanhaiji')); return; }
    if (g('media')) return renderMediaDetail(g('media'));
    if (g('view') === 'media') return renderMediaIndex();
    var post = g('p') || g('name');
    if (post) { var mt = importedTarget(post); return mt ? mt() : renderPost(post); }
    var pg = g('page_id') || g('pagename').split('/').filter(Boolean).pop();
    if (pg) { var imp = importedTarget(pg); return imp ? imp() : renderPage(pg); }
    if (g('cat')) return renderCategory(g('cat'));
    if (g('category_name')) return renderCategory(g('category_name').split('/').filter(Boolean).pop());
    if (g('tag')) return renderTag(g('tag'));
    if (params.has('s')) return renderSearch(g('s'));
    if (g('view') === 'search') return renderSearch('');
    if (g('view') === 'archives') return renderArchives();
    if (g('view') === 'posts' || g('paged')) return renderList({ title: '所有文章', showFilter: true, keep: { view: 'posts' } });
    renderHome();
  }

  // 首頁精簡版（版面第 2 版）：服務為主，其他內容收進「探索更多」。管理程式發布後會把這個設定存起來
  function migrateLayout(s) {
    if ((s.layoutVersion || 1) >= 2) return;
    var old = {};
    (s.sections || []).forEach(function (x) { old[x.key] = x; });
    var def = [
      ['services', true, '協會的服務', '以陳家古厝為據點，提供導覽、展覽、課程與市集。'],
      ['booking', true, '預約與到訪', '團體導覽與手作課程請先預約。'],
      ['events', true, '近期活動', ''],
      ['explore', true, '探索更多', ''],
      ['posts', false, '活動紀錄與在地觀察', ''], ['media', false, '媒體報導', ''], ['towns', false, '小鎮社區人文', ''],
      ['shanhaiji', false, '《山海集》', ''], ['videos', false, '影片精選', ''], ['visit', false, '到訪陳家古厝', ''],
    ];
    s.sections = def.map(function (d) {
      var o = old[d[0]] || {};
      var x = { key: d[0], show: d[1], title: o.title || d[2], intro: o.intro != null && o.intro !== '' ? o.intro : d[3] };
      if (d[0] === 'media') x.count = o.count || 3;
      return x;
    });
    s.layoutVersion = 2;
  }

  // 讀取 data/ 資料夾。cache: 'no-cache' 讓瀏覽器每次都確認有沒有新版本，管理程式發布後很快就看得到
  function loadData() {
    var get = function (name) {
      return fetch('data/' + name + '.json', { cache: 'no-cache' }).then(function (r) {
        if (!r.ok) throw new Error(name + '.json HTTP ' + r.status);
        return r.json();
      });
    };
    var names = ['site', 'services', 'towns', 'videos', 'events', 'media'];
    return Promise.all(names.map(function (n) {
      return get(n).catch(function (e) { if (n === 'site') throw e; console.warn(e); return []; });
    })).then(function (r) { names.forEach(function (n, i) { D[n] = r[i]; }); });
  }

  bindInteractions();
  if (!window.fetch || !window.Promise) {
    view.innerHTML = '<div class="wrap err"><h1>瀏覽器版本太舊</h1><p>請更新瀏覽器後再開啟。</p></div>';
    return;
  }
  loading();
  loadData().then(function () {
    C = D.site;
    C.sections = C.sections || [];
    migrateLayout(C);
    if (shown(D.media).length && !C.sections.some(function (x) { return x.key === 'media'; })) {
      var at = C.sections.map(function (x) { return x.key; }).indexOf('posts') + 1;
      C.sections.splice(at || C.sections.length, 0, { key: 'media', show: true, title: '媒體報導', intro: '', count: 3 });
    }
    API = 'https://public-api.wordpress.com/wp/v2/sites/' + C.wordpressSite;
    OLD_HOSTS = [C.wordpressSite.toLowerCase()];
    startWordPress();
    renderChrome();
    route();
  }).catch(function (e) {
    console.error(e);
    view.innerHTML = '<div class="wrap err"><h1>網站資料讀取失敗</h1><p>請稍後重新整理。若一直出現這個畫面，可能是 data/site.json 格式有誤，請到管理程式的「版本紀錄」還原上一個版本。</p></div>';
  });
})();
