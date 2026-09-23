/* 番社參拾網站程式
   訪客打開網頁時，直接向 WordPress.com 讀取文章、照片與留言，再用新版面顯示。
   一般維護不需要改這個檔案；文字與選單請改 config.js。

   網址對照（沿用 WordPress 的參數寫法，舊網站的 ?p=123 短網址也能用）：
     ./                      首頁
     ?p=123                  文章（依編號）
     ?name=代稱               文章（依網址代稱）
     ?page_id=45             頁面（依編號）
     ?pagename=代稱           頁面（依網址代稱）
     ?category_name=代稱      分類
     ?tag=代稱                標籤
     ?s=關鍵字                搜尋結果
     ?view=archives          所有文章
     ?view=search            搜尋頁
     ?paged=2                列表第 2 頁（可和分類、標籤、搜尋一起用）
*/
(function () {
  'use strict';

  var C = window.SITE_CONFIG;
  var API = 'https://public-api.wordpress.com/wp/v2/sites/' + C.wordpressSite;
  var OLD_HOSTS = [C.wordpressSite];
  var POST_FIELDS = 'id,date,slug,link,title,content,excerpt,categories,tags,comment_status,jetpack_featured_media_url,sticky';
  var LIST_FIELDS = 'id,date,link,title,excerpt,categories,jetpack_featured_media_url,sticky';
  var view = document.getElementById('view');
  var params = new URLSearchParams(location.search);

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
  function catUrl(c) { return q({ category_name: c.slugText }); }
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
  var categoriesP = cached('fs30-cats', function () {
    return allPages('categories', { _fields: 'id,name,slug,count,parent' }).then(function (list) {
      return list.map(function (c) { return { id: c.id, name: text(c.name), slug: c.slug, slugText: decodeSlug(c.slug), count: c.count }; });
    });
  });
  var pagesP = cached('fs30-pages', function () {
    return allPages('pages', { _fields: 'id,slug,title,parent,menu_order,link' }).then(function (list) {
      return list.map(function (p) { return { id: p.id, slug: p.slug, title: title(p), parent: p.parent, order: p.menu_order, link: p.link }; });
    });
  });
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

  function listHtml(posts, cats, offset) {
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

  // 依連結寫法找出網址（頁面標題、分類名稱或網址）
  function resolve(item, pages, cats) {
    if (item.href) return item.href;
    if (item.pageTitle) {
      var p = pages.filter(function (x) { return x.title.indexOf(item.pageTitle) >= 0; })[0];
      if (p) return pageUrl(p);
    }
    if (item.category) {
      var c = cats.filter(function (x) { return x.name === item.category || x.slugText === item.category; })[0];
      if (c) return catUrl(c);
    }
    if (window.console) console.warn('[連結] 找不到「' + item.label + '」對應的頁面，改連到搜尋。請檢查 config.js。');
    return q({ s: item.label });
  }

  /* ---------- 頁首、頁尾 ---------- */

  function renderChrome() {
    $('#brand').textContent = C.org;
    $('#heroName').textContent = C.name;
    $('#heroTag').textContent = C.tagline;
    $('#copy').textContent = '© ' + new Date().getFullYear() + ' ' + C.org;
    var V = C.visit;
    $('#contact').innerHTML = '<p>' + esc(V.address) + '</p><div class="foot-links">' +
      '<a href="tel:' + esc(V.phone.replace(/-/g, '')) + '">' + esc(V.phone) + '</a>' +
      '<a href="mailto:' + esc(V.email) + '">' + esc(V.email) + '</a>' +
      '<a href="' + esc(V.facebook.url) + '" target="_blank" rel="noopener">Facebook</a>' +
      (V.bookingForm ? '<a href="' + esc(V.bookingForm) + '" target="_blank" rel="noopener">預約導覽</a>' : '') +
      '<a href="?view=archives">所有文章</a><a href="?view=search">搜尋</a></div>';

    // 選單先用暫時的連結顯示，讀到頁面清單後再換成正確網址
    function draw(pages, cats) {
      $('#nav').innerHTML = C.nav.map(function (n) {
        if (n.children && n.children.length) {
          var top = n.pageTitle || n.category ? resolve(n, pages, cats) : '';
          return '<details><summary>' + esc(n.label) + '</summary><div class="sub">' +
            (top && top.indexOf('?s=') !== 0 ? '<a href="' + esc(top) + '">' + esc(n.label) + '總覽</a>' : '') +
            n.children.map(function (c) { return '<a href="' + esc(resolve(c, pages, cats)) + '">' + esc(c.label) + '</a>'; }).join('') +
            '</div></details>';
        }
        return '<a href="' + esc(resolve(n, pages, cats)) + '">' + esc(n.label) + '</a>';
      }).join('');
      var here = location.search;
      $$('#nav > a').forEach(function (a) { if (here && a.getAttribute('href') === here) a.setAttribute('aria-current', 'page'); });
    }
    draw([], []);
    Promise.all([pagesP, categoriesP]).then(function (r) { draw(r[0], r[1]); }).catch(function () {});

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

  function renderHome() {
    setTitle('', C.description);
    $('#hero').hidden = false;
    var n = C.homePostCount + 1;
    Promise.all([
      api('posts', { per_page: n, _fields: LIST_FIELDS }),
      api('posts', { sticky: true, per_page: 1, _fields: LIST_FIELDS }).catch(function () { return []; }),
      categoriesP, pagesP.catch(function () { return []; }),
    ]).then(function (r) {
      var posts = r[0], cats = r[2], pages = r[3];
      var cover = r[1][0] || posts[0];
      var rest = posts.filter(function (p) { return !cover || p.id !== cover.id; }).slice(0, C.homePostCount);
      var html = C.homeSections.map(function (s) {
        if (s === 'cover' && cover) {
          var cc = catsById(cover.categories, cats)[0];
          return '<section class="cover wrap" aria-labelledby="coverH"><div class="cover-grid">' +
            '<h2 id="coverH"><a href="' + postUrl(cover) + '">' + esc(title(cover)) + '</a></h2><div>' +
            '<div class="meta"><span>' + longDate(cover.date) + '</span>' + (cc ? '<span>' + esc(cc.name) + '</span>' : '') + '</div>' +
            '<p>' + esc(excerpt(cover)) + '</p><a class="more" href="' + postUrl(cover) + '">閱讀全文</a></div></div></section>';
        }
        if (s === 'journal') {
          return '<section class="journal wrap" id="journal" aria-labelledby="jH"><div class="j-head"><h2 class="sec-h" id="jH">文章</h2>' +
            filterHtml(cats) + '</div><div class="feed">' + listHtml(rest, cats) + '</div>' +
            '<div class="list-more"><a class="more" href="?paged=2">看更多文章</a><a class="more" href="?view=archives">依年份瀏覽全部文章</a></div></section>';
        }
        if (s === 'events') return eventsHtml();
        if (s === 'shanhaiji') {
          var S = C.shanhaiji;
          return '<section class="band" id="shanhaiji" aria-labelledby="sH"><div class="wrap band-in"><div class="covers" aria-hidden="true">' +
            S.covers.slice(0, 3).map(function (c, i) { return '<div class="mag m' + (i + 1) + '"><span class="mv">山海集</span><span class="my">' + esc(c) + '</span></div>'; }).join('') +
            '</div><div><h2 id="sH">《山海集》</h2><p>' + esc(S.text) + '</p><div class="btns">' +
            '<a class="btn" href="' + esc(S.buy) + '" target="_blank" rel="noopener">到好事集市購買</a>' +
            '<a class="btn ghost" href="' + esc(S.blog) + '" target="_blank" rel="noopener">閱讀部落格</a></div></div></div></section>';
        }
        if (s === 'services') {
          return '<section class="services wrap" id="services" aria-labelledby="svH"><div class="svc-grid"><div class="svc-side">' +
            '<h2 class="sec-h" id="svH">協會的服務</h2><p>' + esc(C.services.intro) + '</p></div><div>' +
            C.services.items.map(function (it) { return '<article class="svc"><h3>' + esc(it.title) + '</h3><p>' + esc(it.text) + '</p></article>'; }).join('') +
            '</div></div></section>';
        }
        if (s === 'towns') {
          return '<section class="towns wrap" id="towns" aria-labelledby="tH"><h2 class="sec-h" id="tH">小鎮社區人文</h2><div class="town-list">' +
            C.towns.map(function (t) { return '<a href="' + esc(resolve(t, pages, cats)) + '">' + esc(t.label) + '</a>'; }).join('') + '</div></section>';
        }
        if (s === 'visit') return visitHtml();
        return '';
      }).join('');
      view.innerHTML = html;
      updateOpenStatus();
      if (location.hash) { var el = document.getElementById(location.hash.slice(1)); if (el) el.scrollIntoView(); }
    }).catch(function (e) { showError(e); });
  }

  function eventsHtml() {
    var today = taipeiToday();
    var list = (C.events || []).filter(function (e) { return e.title && (e.end || e.date) >= today; })
      .sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    if (!list.length) return '';
    return '<section class="events wrap" id="events" aria-labelledby="evH"><h2 class="sec-h" id="evH">近期活動</h2><ul class="ev-list">' +
      list.map(function (e) {
        var d = e.date.split('-');
        var wd = '日一二三四五六'.charAt(new Date(e.date + 'T00:00:00+08:00').getUTCDay());
        var span = e.end && e.end !== e.date ? '–' + (+e.end.split('-')[1]) + ' 月 ' + (+e.end.split('-')[2]) + ' 日' : '';
        return '<li class="ev"><p class="ev-date" style="margin:0">' + (+d[1]) + ' 月 ' + (+d[2]) + ' 日' + span +
          '<small>週' + wd + (e.time ? '　' + esc(e.time) : '') + '</small></p><div><h3>' +
          (e.link ? '<a href="' + esc(e.link) + '">' + esc(e.title) + '</a>' : esc(e.title)) + '</h3>' +
          (e.place || e.note ? '<p>' + esc([e.place, e.note].filter(Boolean).join('。')) + '</p>' : '') + '</div></li>';
      }).join('') + '</ul></section>';
  }

  function visitHtml() {
    var V = C.visit;
    var fmt = function (t) { return t.replace(/^0/, ''); };
    var map = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(V.address);
    return '<section class="visit wrap" id="visit" aria-labelledby="vH"><h2 class="sec-h" id="vH">到訪陳家古厝</h2><div class="visit-grid">' +
      '<div><p class="k">地址</p><p class="val"><a href="' + map + '" target="_blank" rel="noopener">' + esc(V.address.slice(0, 6)) + '<br>' + esc(V.address.slice(6)) + '</a></p></div>' +
      '<div><p class="k">開放時間</p><p class="val">' + esc(V.openText) + '<br>' + fmt(V.open) + '–' + fmt(V.close) + '</p>' +
      '<p class="status" id="status" aria-live="polite"><span class="dot"></span><span id="statusText"></span></p></div>' +
      '<div><p class="k">聯絡</p><p class="val"><a href="tel:' + esc(V.phone.replace(/-/g, '')) + '">' + esc(V.phone) + '</a><br>' +
      '<a href="mailto:' + esc(V.email) + '">' + esc(V.email) + '</a><br><a href="' + esc(V.facebook.url) + '" target="_blank" rel="noopener">Facebook：' + esc(V.facebook.label) + '</a>' +
      (V.bookingForm ? '<br><a href="' + esc(V.bookingForm) + '" target="_blank" rel="noopener">填寫預約表單</a>' : '') + '</p></div></div></section>';
  }

  // 依台北時間顯示現在是否開放
  function updateOpenStatus() {
    var el = $('#status'), tx = $('#statusText');
    if (!el) return;
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
      if (V.openDays.indexOf(d) >= 0 && m >= o && m < c) {
        el.classList.add('open');
        tx.textContent = '現在開放中，今天到 ' + V.close.replace(/^0/, '');
        return;
      }
      for (var i = 0; i <= 7; i++) {
        var dd = (d + i) % 7;
        if (V.openDays.indexOf(dd) < 0 || (i === 0 && m >= o)) continue;
        tx.textContent = '目前休館，' + (i === 0 ? '今天' : i === 1 ? '明天' : names[dd]) + ' ' + V.open.replace(/^0/, '') + ' 開放';
        return;
      }
    } catch (e) { el.hidden = true; }
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
    var base = opts.all ? C.homePostCount + 1 : 0;
    var offset = base + (opts.all ? (n - 2) * per : (n - 1) * per);
    if (opts.all && n === 1) { location.replace('./#journal'); return; }
    var query = Object.assign({ per_page: per + 1, offset: offset, _fields: LIST_FIELDS }, opts.query || {});
    Promise.all([api('posts', query), categoriesP]).then(function (r) {
      var posts = r[0], cats = r[1];
      var hasMore = posts.length > per;
      posts = posts.slice(0, per);
      setTitle(opts.title + (n > 1 ? '（第 ' + n + ' 頁）' : ''));
      view.innerHTML = '<div class="wrap list-page"><header class="list-head">' +
        (opts.label ? '<p class="meta"><span>' + esc(opts.label) + '</span></p>' : '') +
        '<h1>' + esc(opts.title) + '</h1>' + (opts.note ? '<p>' + opts.note + '</p>' : '') + '</header>' +
        (opts.form || '') +
        (opts.showFilter ? filterHtml(cats, opts.catId) : '') +
        (opts.form && !posts.length ? '<p class="search-hint">找不到相關文章，換個關鍵字試試，或看 <a href="?view=archives">所有文章</a>。</p>'
          : '<div class="feed" style="margin-top:20px">' + listHtml(posts, cats, n) + '</div>') +
        pagerHtml(n, hasMore, opts.keep || {}) + '</div>';
    }).catch(function (e) { showError(e); });
  }

  function renderCategory(slug) {
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
    renderList({ title: '搜尋「' + term + '」', label: '搜尋結果', query: { search: term }, keep: { s: term }, form: searchForm(term) });
  }

  function renderArchives() {
    setTitle('所有文章');
    Promise.all([allPages('posts', { _fields: 'id,date,title,categories' }), categoriesP]).then(function (r) {
      var posts = r[0], cats = r[1];
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

  function route() {
    var g = function (k) { return (params.get(k) || '').trim(); };
    if (g('p')) return renderPost(g('p'));
    if (g('name')) return renderPost(g('name'));
    if (g('page_id')) return renderPage(g('page_id'));
    if (g('pagename')) return renderPage(g('pagename').split('/').filter(Boolean).pop());
    if (g('cat')) return renderCategory(g('cat'));
    if (g('category_name')) return renderCategory(g('category_name').split('/').filter(Boolean).pop());
    if (g('tag')) return renderTag(g('tag'));
    if (params.has('s')) return renderSearch(g('s'));
    if (g('view') === 'search') return renderSearch('');
    if (g('view') === 'archives') return renderArchives();
    if (g('paged')) return renderList({ title: '所有文章', all: true, showFilter: true });
    renderHome();
  }

  renderChrome();
  bindInteractions();
  if (!window.fetch || !window.Promise) {
    view.innerHTML = '<div class="wrap err"><h1>瀏覽器版本太舊</h1><p>請更新瀏覽器，或到 <a href="https://' + esc(C.wordpressSite) + '/">原網站</a> 閱讀。</p></div>';
    return;
  }
  loading();
  route();
})();
