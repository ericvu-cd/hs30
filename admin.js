/* 番社參拾 管理程式
   直接透過 GitHub API 讀寫這個 repo 裡的 data/ 資料夾與 uploads/ 照片。
   不需要另外的伺服器；按「發布」會在 GitHub 上建立一次修改紀錄，GitHub Pages 隨後自動更新網站。 */
(function () {
  'use strict';

  var FILES = ['site', 'services', 'towns', 'videos', 'events', 'media'];
  var GH = 'https://api.github.com';
  var auth = null;          // { owner, repo, token, branch }
  var state = {};           // 目前編輯中的資料
  var saved = {};           // 上次載入或發布時的資料（用來判斷有沒有修改）
  var shas = {};            // 載入時各檔案在 GitHub 上的版本
  var headSha = '';
  var uploads = [];         // GitHub 上已有的照片路徑
  var pending = {};         // 還沒發布的新照片：路徑 → { b64, url }
  var removed = {};         // 要刪除的照片
  var wp = { cats: null, tags: null };
  var tab = 'services';
  var editing = null;       // { list: 'services', i: 0 }
  var pickerCb = null;

  /* ---------- 小工具 ---------- */

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function toast(msg, ms) {
    var t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._h);
    t._h = setTimeout(function () { t.classList.remove('show'); }, ms || 2600);
  }
  function getPath(obj, path) {
    return path.split('.').reduce(function (o, k) { return o == null ? undefined : o[k]; }, obj);
  }
  function setPath(obj, path, val) {
    var ks = path.split('.'), last = ks.pop();
    var o = ks.reduce(function (o, k) {
      if (o[k] == null) o[k] = /^\d+$/.test(k) ? [] : {};
      return o[k];
    }, obj);
    o[last] = val;
  }
  function today() { return new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10); }
  function fmtTime(iso) {
    var d = new Date(iso);
    return d.toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
  function b64ToText(b64) {
    var bin = atob(String(b64).replace(/\s/g, ''));
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder('utf-8').decode(bytes);
  }
  function imgSrc(u, w) {
    if (!u) return '';
    if (pending[u]) return pending[u].url;
    if (/^uploads\//.test(u)) return u;
    if (/wordpress\.com\/|wp\.com\/|\/wp-content\/uploads\//.test(u)) return u.replace(/\?.*$/, '') + '?w=' + (w || 400);
    return u;
  }

  /* ---------- GitHub API ---------- */

  function gh(path, opts) {
    opts = opts || {};
    return fetch(GH + path, {
      method: opts.method || 'GET',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: 'Bearer ' + auth.token,
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      cache: 'no-store',
    }).then(function (r) {
      if (r.status === 204) return null;
      return r.json().catch(function () { return {}; }).then(function (data) {
        if (!r.ok) {
          var e = new Error(data && data.message || ('HTTP ' + r.status));
          e.status = r.status;
          throw e;
        }
        return data;
      });
    });
  }
  function repoPath() { return '/repos/' + encodeURIComponent(auth.owner) + '/' + encodeURIComponent(auth.repo); }
  function ghError(e) {
    if (e.status === 401) return '權杖無效或已過期，請重新登入。';
    if (e.status === 403) return '權杖沒有權限。請確認權杖的 Contents 權限是「Read and write」，而且有選到這個 repo。';
    if (e.status === 404) return '找不到這個 repo，請確認帳號名稱、repo 名稱，以及權杖有選到這個 repo。';
    if (e.status === 409 || e.status === 422) return '有人剛好也在修改，請重新載入後再發布。';
    return '連線錯誤：' + e.message;
  }

  // 讀取 repo 目前的內容
  function loadAll() {
    return gh(repoPath()).then(function (repo) {
      auth.branch = repo.default_branch;
      return gh(repoPath() + '/git/ref/heads/' + encodeURIComponent(auth.branch));
    }).then(function (ref) {
      headSha = ref.object.sha;
      return gh(repoPath() + '/git/trees/' + headSha + '?recursive=1');
    }).then(function (tree) {
      shas = {};
      uploads = [];
      tree.tree.forEach(function (t) {
        if (t.type !== 'blob') return;
        if (/^data\/\w+\.json$/.test(t.path)) shas[t.path] = t.sha;
        if (/^uploads\/.+\.(jpe?g|png|gif|webp)$/i.test(t.path)) uploads.push(t.path);
      });
      uploads.sort().reverse();
      return Promise.all(FILES.map(function (f) {
        var p = 'data/' + f + '.json';
        if (!shas[p]) return f === 'site' ? Promise.reject(new Error('repo 裡找不到 data/site.json')) : Promise.resolve([]);
        return gh(repoPath() + '/git/blobs/' + shas[p]).then(function (b) { return JSON.parse(b64ToText(b.content)); });
      }));
    }).then(function (r) {
      FILES.forEach(function (f, i) { state[f] = r[i]; });
      saved = clone(state);
      normalize();   // 自動調整（例如舊版選單）會顯示成尚未發布的修改，按發布就會存回 GitHub
      pending = {};
      removed = {};
    });
  }

  // 補齊舊資料可能缺少的欄位
  function normalize() {
    var s = state.site;
    s.sections = s.sections || [];
    s.nav = s.nav || [];
    s.visit = s.visit || {};
    s.shanhaiji = s.shanhaiji || {};
    s.hero = s.hero || {};
    s.featuredCategories = s.featuredCategories || [];
    s.importedVideoPages = s.importedVideoPages || [];
    ['services', 'towns', 'videos', 'events', 'media'].forEach(function (k) { if (!Array.isArray(state[k])) state[k] = []; });
    // 媒體報導改由管理程式管理：舊的「WordPress 分類」選單項目換成新的媒體報導頁
    s.nav.forEach(function (n) { if (n.type === 'category' && n.target === '媒體報導') { n.type = 'media'; delete n.target; } });
    s.sections.forEach(function (x) { if (x.key === 'media') delete x.category; });
    s.featuredCategories = s.featuredCategories.filter(function (c) { return c !== '媒體報導'; });
    migrateLayout(s);
    state.services.concat(state.towns).forEach(function (x) { x.gallery = x.gallery || []; });
    // 舊版資料沒有「媒體報導」段落時補上
    if (!s.sections.some(function (x) { return x.key === 'media'; })) {
      var at = s.sections.map(function (x) { return x.key; }).indexOf('posts') + 1;
      s.sections.splice(at || s.sections.length, 0, { key: 'media', show: true, title: '媒體報導', intro: '', count: 3 });
    }
  }

  // 首頁精簡版（版面第 2 版）：和網站 app.js 的 migrateLayout 相同
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

  function isDirty() {
    return JSON.stringify(state) !== JSON.stringify(saved) || Object.keys(pending).length > 0 || Object.keys(removed).length > 0;
  }
  function markDirty() {
    var d = isDirty();
    $('#dirty').hidden = !d;
    $('#publishBtn').disabled = !d;
  }

  /* ---------- 發布 ---------- */

  function validate() {
    var errs = [];
    ['services', 'towns', 'media'].forEach(function (k) {
      var name = { services: '服務', towns: '社區', media: '媒體報導' }[k];
      var seen = {};
      state[k].forEach(function (x, i) {
        if (!x.title) errs.push(name + '第 ' + (i + 1) + ' 項沒有名稱。');
        x.slug = (x.slug || x.title || '').trim();
        if (seen[x.slug]) errs.push(name + '「' + x.title + '」的網址代稱和其他項目重複。');
        seen[x.slug] = 1;
      });
    });
    state.events.forEach(function (e, i) {
      if (!e.title) errs.push('第 ' + (i + 1) + ' 個活動沒有名稱。');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(e.date || '')) errs.push('活動「' + (e.title || i + 1) + '」的日期沒有填。');
      if (e.end && e.end < e.date) errs.push('活動「' + e.title + '」的結束日期早於開始日期。');
    });
    state.videos.forEach(function (v, i) {
      if (!/(youtu\.be\/|v=|embed\/|shorts\/|live\/)[\w-]{11}/.test(v.url || '')) errs.push('第 ' + (i + 1) + ' 部影片的 YouTube 網址看不懂。');
    });
    return errs;
  }

  function publish() {
    syncRich();
    var errs = validate();
    if (errs.length) {
      showDialog('還不能發布', '<p>請先修正以下問題：</p><ul>' + errs.map(function (e) { return '<li>' + esc(e) + '</li>'; }).join('') + '</ul>');
      return;
    }
    var btn = $('#publishBtn');
    btn.disabled = true;
    btn.textContent = '發布中…';
    var changed = FILES.filter(function (f) { return JSON.stringify(state[f]) !== JSON.stringify(saved[f]); });
    var cur, tree;
    gh(repoPath() + '/git/ref/heads/' + encodeURIComponent(auth.branch)).then(function (ref) {
      cur = ref.object.sha;
      if (cur === headSha) return null;
      // 其他人在你載入之後也發布過：檢查是不是改到同一個檔案
      return gh(repoPath() + '/git/trees/' + cur + '?recursive=1').then(function (t) {
        var clash = changed.filter(function (f) {
          var p = 'data/' + f + '.json';
          var now = t.tree.filter(function (x) { return x.path === p; })[0];
          return (now && now.sha) !== shas[p];
        });
        if (clash.length) {
          var e = new Error('conflict');
          e.conflict = clash;
          throw e;
        }
      });
    }).then(function () {
      return gh(repoPath() + '/git/commits/' + cur);
    }).then(function (commit) {
      var entries = changed.map(function (f) {
        return { path: 'data/' + f + '.json', mode: '100644', type: 'blob', content: JSON.stringify(state[f], null, 1) + '\n' };
      });
      var blobJobs = Object.keys(pending).map(function (p) {
        return gh(repoPath() + '/git/blobs', { method: 'POST', body: { content: pending[p].b64, encoding: 'base64' } }).then(function (b) {
          entries.push({ path: p, mode: '100644', type: 'blob', sha: b.sha });
        });
      });
      Object.keys(removed).forEach(function (p) { entries.push({ path: p, mode: '100644', type: 'blob', sha: null }); });
      return Promise.all(blobJobs).then(function () {
        return gh(repoPath() + '/git/trees', { method: 'POST', body: { base_tree: commit.tree.sha, tree: entries } });
      });
    }).then(function (t) {
      tree = t;
      var what = changed.map(function (f) { return { site: '網站設定', services: '服務', towns: '社區', videos: '影片', events: '活動', media: '媒體報導' }[f]; });
      if (Object.keys(pending).length) what.push('照片 ' + Object.keys(pending).length + ' 張');
      if (Object.keys(removed).length) what.push('刪除照片 ' + Object.keys(removed).length + ' 張');
      return gh(repoPath() + '/git/commits', { method: 'POST', body: { message: '管理程式：更新' + what.join('、'), tree: tree.sha, parents: [cur] } });
    }).then(function (c) {
      return gh(repoPath() + '/git/refs/heads/' + encodeURIComponent(auth.branch), { method: 'PATCH', body: { sha: c.sha } }).then(function () { return c; });
    }).then(function (c) {
      headSha = c.sha;
      tree.tree.forEach(function (t) { if (/^data\//.test(t.path)) shas[t.path] = t.sha; });
      Object.keys(pending).forEach(function (p) { if (uploads.indexOf(p) < 0) uploads.unshift(p); });
      uploads = uploads.filter(function (p) { return !removed[p]; });
      saved = clone(state);
      pending = {};
      removed = {};
      markDirty();
      render();
      showDialog('已發布', '<p class="notice ok">修改已存到 GitHub。網站通常在 1 到 2 分鐘內更新。</p><p id="buildStatus" class="muted">正在確認網站更新進度…</p>');
      watchBuild(c.sha);
    }).catch(function (e) {
      if (e.conflict) {
        showDialog('無法發布', '<p class="notice bad">你載入資料之後，有其他人也修改並發布了同樣的項目。為了不蓋掉對方的修改，這次沒有發布。</p>' +
          '<p>請先把你的修改記下來，按下面的按鈕重新載入最新資料，再改一次。</p><button class="btn primary" type="button" data-act="reload">重新載入最新資料</button>');
      } else {
        showDialog('發布失敗', '<p class="notice bad">' + esc(ghError(e)) + '</p><p>你的修改還在，可以再按一次發布。</p>');
      }
    }).then(function () {
      btn.textContent = '發布';
      markDirty();
    });
  }

  // 顯示 GitHub Pages 更新進度（權杖沒有 Pages 權限時略過）
  function watchBuild(sha) {
    var tries = 0;
    (function poll() {
      var el = $('#buildStatus');
      if (!el) return;
      gh(repoPath() + '/pages/builds/latest').then(function (b) {
        if (b.commit === sha && b.status === 'built') { el.textContent = '網站已更新完成。'; el.className = 'notice ok'; return; }
        if (b.commit === sha && b.status === 'errored') { el.textContent = '網站更新失敗，請到 GitHub 的 Actions 頁面查看。'; el.className = 'notice bad'; return; }
        el.textContent = '網站更新中…';
        if (++tries < 40) setTimeout(poll, 5000);
      }).catch(function () { el.textContent = '（無法取得更新進度，稍等一兩分鐘後重新整理網站即可。）'; });
    })();
  }

  /* ---------- 照片 ---------- */

  function resizeImage(file) {
    return new Promise(function (ok, fail) {
      var url = URL.createObjectURL(file);
      var im = new Image();
      im.onload = function () {
        var max = 1800, w = im.naturalWidth, h = im.naturalHeight;
        var k = Math.min(1, max / Math.max(w, h));
        var c = document.createElement('canvas');
        c.width = Math.round(w * k);
        c.height = Math.round(h * k);
        var ctx = c.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(im, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        var data = c.toDataURL('image/jpeg', 0.84);
        ok(data);
      };
      im.onerror = function () { URL.revokeObjectURL(url); fail(new Error('看不懂這個檔案，請用 JPG 或 PNG 照片。')); };
      im.src = url;
    });
  }
  function addUploads(files) {
    var d = new Date(Date.now() + 8 * 3600e3).toISOString();
    var dir = 'uploads/' + d.slice(0, 4) + '/' + d.slice(5, 7) + '/';
    return Promise.all(Array.prototype.map.call(files, function (f, i) {
      return resizeImage(f).then(function (dataUrl) {
        var name = d.slice(0, 10).replace(/-/g, '') + '-' + d.slice(11, 19).replace(/:/g, '') + '-' + i + Math.random().toString(36).slice(2, 6) + '.jpg';
        var p = dir + name;
        pending[p] = { b64: dataUrl.split(',')[1], url: dataUrl };
        return p;
      });
    })).then(function (paths) { markDirty(); return paths; });
  }
  function allImages() {
    return Object.keys(pending).concat(uploads.filter(function (p) { return !removed[p]; }));
  }
  function openPicker(cb, multi) {
    pickerCb = cb;
    var dlg = $('#picker');
    dlg.dataset.multi = multi ? '1' : '';
    drawPickerLib();
    dlg.showModal();
  }
  function drawPickerLib() {
    var list = allImages();
    $('#pickerLib').innerHTML = list.length
      ? list.map(function (p) { return '<button type="button" data-pick="' + esc(p) + '"><img src="' + esc(imgSrc(p)) + '" alt="" loading="lazy">' + (pending[p] ? '<figcaption>尚未發布</figcaption>' : '') + '</button>'; }).join('')
      : '<p class="muted">照片庫還是空的，按「上傳新照片」加入。</p>';
  }
  function usedImages() {
    var used = {};
    var walk = function (o) {
      if (typeof o === 'string') {
        (o.match(/uploads\/[^"'\s)<>]+/g) || []).forEach(function (p) { used[p] = 1; });
      } else if (o && typeof o === 'object') Object.keys(o).forEach(function (k) { walk(o[k]); });
    };
    walk(state);
    return used;
  }

  /* ---------- 內文編輯器 ---------- */

  var ALLOWED = { P: [], H2: [], H3: [], H4: [], STRONG: [], B: [], EM: [], I: [], U: [], A: ['href', 'target'], UL: [], OL: [], LI: [], BLOCKQUOTE: [], BR: [], HR: [],
    IMG: ['src', 'alt'], FIGURE: [], FIGCAPTION: [], IFRAME: ['src', 'allowfullscreen', 'title'], TABLE: [], THEAD: [], TBODY: [], TR: [], TD: ['colspan', 'rowspan'], TH: ['colspan', 'rowspan'] };
  function sanitize(html) {
    var t = document.createElement('template');
    t.innerHTML = html || '';
    (function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (n) {
        if (n.nodeType === 8) { n.remove(); return; }
        if (n.nodeType !== 1) return;
        var tag = n.tagName;
        if (/^(SCRIPT|STYLE|NOSCRIPT|OBJECT|EMBED|FORM|INPUT|BUTTON|SELECT|TEXTAREA|META|LINK)$/.test(tag)) { n.remove(); return; }
        walk(n);
        if (tag === 'IFRAME' && !/^https:\/\/(www\.)?(youtube\.com|youtube-nocookie\.com|player\.vimeo\.com|www\.google\.com\/maps)\//.test(n.getAttribute('src') || '')) { n.remove(); return; }
        if (tag === 'DIV' || tag === 'SPAN' || tag === 'SECTION' || tag === 'FONT' || !ALLOWED[tag]) {
          // 不支援的標籤只保留裡面的文字；區塊型的換成段落
          if (tag === 'DIV' && !n.querySelector('p,h2,h3,h4,ul,ol,figure,blockquote,table,iframe,div')) {
            var p = document.createElement('p');
            while (n.firstChild) p.appendChild(n.firstChild);
            n.replaceWith(p);
          } else {
            while (n.firstChild) n.parentNode.insertBefore(n.firstChild, n);
            n.remove();
          }
          return;
        }
        Array.prototype.slice.call(n.attributes).forEach(function (a) {
          if (ALLOWED[tag].indexOf(a.name) < 0 || /^\s*javascript:/i.test(a.value)) n.removeAttribute(a.name);
        });
      });
    })(t.content);
    var d = document.createElement('div');
    d.appendChild(t.content);
    return d.innerHTML.replace(/<p>(\s|&nbsp;|<br>)*<\/p>/g, '').trim();
  }
  function richHtml(path) {
    var v = getPath(state, path) || '';
    // 編輯器裡顯示尚未發布的照片
    var shownHtml = v.replace(/src="(uploads\/[^"]+)"/g, function (m, p) { return 'src="' + (pending[p] ? pending[p].url : p) + '" data-path="' + p + '"'; });
    return '<div class="rich-wrap"><div class="rich-bar" role="toolbar" aria-label="格式">' +
      '<button type="button" data-cmd="h2">大標題</button><button type="button" data-cmd="h3">小標題</button><button type="button" data-cmd="p">內文</button>' +
      '<button type="button" data-cmd="bold"><b>粗體</b></button><button type="button" data-cmd="ul">項目清單</button><button type="button" data-cmd="ol">編號清單</button>' +
      '<button type="button" data-cmd="quote">引言</button><button type="button" data-cmd="link">連結</button><button type="button" data-cmd="unlink">移除連結</button>' +
      '<button type="button" data-cmd="image">插入照片</button><button type="button" data-cmd="video">插入 YouTube</button><button type="button" data-cmd="clear">清除格式</button></div>' +
      '<div class="rich" contenteditable="true" data-rich="' + esc(path) + '">' + shownHtml + '</div></div>';
  }
  function richValue(el) {
    var c = el.cloneNode(true);
    $$('img[data-path]', c).forEach(function (im) { im.setAttribute('src', im.getAttribute('data-path')); im.removeAttribute('data-path'); });
    return sanitize(c.innerHTML);
  }
  function syncRich() {
    $$('[data-rich]').forEach(function (el) { setPath(state, el.getAttribute('data-rich'), richValue(el)); });
  }
  var lastRange = null;
  document.addEventListener('selectionchange', function () {
    var s = window.getSelection();
    if (s.rangeCount && s.anchorNode && s.anchorNode.parentElement && s.anchorNode.parentElement.closest('.rich')) lastRange = s.getRangeAt(0).cloneRange();
  });
  function restoreRange(ed) {
    ed.focus();
    if (lastRange && ed.contains(lastRange.startContainer)) {
      var s = window.getSelection();
      s.removeAllRanges();
      s.addRange(lastRange);
    }
  }
  function richCommand(btn) {
    var ed = btn.closest('.rich-wrap').querySelector('.rich');
    var cmd = btn.getAttribute('data-cmd');
    restoreRange(ed);
    var exec = function (c, v) { document.execCommand(c, false, v); };
    if (cmd === 'h2' || cmd === 'h3' || cmd === 'p') exec('formatBlock', cmd === 'p' ? 'P' : cmd.toUpperCase());
    else if (cmd === 'bold') exec('bold');
    else if (cmd === 'ul') exec('insertUnorderedList');
    else if (cmd === 'ol') exec('insertOrderedList');
    else if (cmd === 'quote') exec('formatBlock', 'BLOCKQUOTE');
    else if (cmd === 'unlink') exec('unlink');
    else if (cmd === 'clear') { exec('removeFormat'); exec('formatBlock', 'P'); }
    else if (cmd === 'link') {
      var u = window.prompt('連結網址（https:// 開頭）：', 'https://');
      if (u && /^(https?:|mailto:|tel:|\?|\.\/)/.test(u)) exec('createLink', u);
    } else if (cmd === 'image') {
      openPicker(function (paths) {
        restoreRange(ed);
        paths.forEach(function (p) {
          exec('insertHTML', '<figure><img src="' + esc(imgSrc(p)) + '" data-path="' + esc(/^uploads\//.test(p) ? p : '') + '" alt=""><figcaption>（照片說明，可刪除）</figcaption></figure><p><br></p>');
        });
        $$('img[data-path=""]', ed).forEach(function (im) { im.removeAttribute('data-path'); });
        setPath(state, ed.getAttribute('data-rich'), richValue(ed));
        markDirty();
      }, true);
      return;
    } else if (cmd === 'video') {
      var v = window.prompt('YouTube 影片網址：');
      var id = v && (v.match(/(?:youtu\.be\/|v=|embed\/|shorts\/|live\/)([\w-]{11})/) || [])[1];
      if (id) exec('insertHTML', '<p><iframe src="https://www.youtube-nocookie.com/embed/' + id + '" allowfullscreen title="YouTube 影片"></iframe></p><p><br></p>');
      else if (v) toast('看不懂這個 YouTube 網址');
    }
    setPath(state, ed.getAttribute('data-rich'), richValue(ed));
    markDirty();
  }

  /* ---------- WordPress（分類、標籤、匯入） ---------- */

  function wpApi(path) {
    return fetch('https://public-api.wordpress.com/wp/v2/sites/' + state.site.wordpressSite + '/' + path).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }
  function loadWpLists() {
    if (wp.cats) return;
    wp.cats = [];
    wp.tags = [];
    wpApi('categories?per_page=100&_fields=name,slug,count').then(function (l) {
      wp.cats = l.filter(function (c) { return c.count > 0; }).map(function (c) { return c.name.replace(/&amp;/g, '&'); });
      if (editing) render();
    }).catch(function () {});
    wpApi('tags?per_page=100&orderby=count&order=desc&_fields=name,slug').then(function (l) {
      wp.tags = l.map(function (t) { var s = t.slug; try { s = decodeURIComponent(s); } catch (e) { /* 保留 */ } return { name: t.name.replace(/&amp;/g, '&'), slug: s }; });
      if (editing) render();
    }).catch(function () {});
  }

  function importDialog(target) {
    var names = { services: '協會服務', towns: '社區人文', videos: '影片精選', media: '媒體報導' };
    showDialog('從 WordPress 匯入到「' + names[target] + '」', '<p class="muted">讀取 WordPress 上的' + (target === 'media' ? '文章' : '頁面') + '中…</p>');
    var listP = target !== 'media' ? wpApi('pages?per_page=100&_fields=id,slug,title,parent') :
      wpApi('categories?per_page=100&_fields=id,name').then(function (cats) {
        var c = cats.filter(function (x) { return x.name === '媒體報導'; })[0];
        return wpApi('posts?per_page=100&_fields=id,slug,title,date' + (c ? '&categories=' + c.id : '')).then(function (l) {
          return l.map(function (p) { p.parent = 0; p.dateText = p.date.slice(0, 10); return p; });
        });
      });
    listP.then(function (pages) {
      var done = {};
      state.services.concat(state.towns).forEach(function (x) { if (x.wpId) done[x.wpId] = 1; });
      state.site.importedVideoPages.forEach(function (p) { done[p.id] = 1; });
      state.media.forEach(function (x) { if (x.wpId) done[x.wpId] = 1; });
      var tmp = document.createElement('div');
      var t = function (h) { tmp.innerHTML = h; return tmp.textContent; };
      $('#dlgBody').innerHTML = '<p class="muted">' + (target === 'videos'
        ? '勾選含有影片的頁面，會把頁面裡的 YouTube 影片逐一加入影片清單。'
        : target === 'media'
        ? '下面是 WordPress「媒體報導」分類裡的文章，預設全部勾選。匯入後，這些文章會從網站的文章列表移到媒體報導，舊連結也會自動轉過來。已匯入的不能重複匯入。'
        : '勾選要搬過來的頁面。標題、內文、照片會一起帶進來，照片仍從 WordPress 載入。匯入後可以再修改。') + '</p>' +
        (target === 'media' && !pages.length ? '<p class="notice">WordPress 上找不到「媒體報導」分類的文章。</p>' : '') +
        '<div class="list" style="margin:14px 0">' + pages.map(function (p) {
          return '<label class="check item" style="grid-template-columns:auto 1fr"><input type="checkbox" value="' + p.id + '"' + (done[p.id] ? ' disabled' : target === 'media' ? ' checked' : '') + '> ' +
            (p.dateText ? '<span class="muted">' + p.dateText + '</span> ' : '') + esc(t(p.title.rendered)) + (done[p.id] ? ' <span class="badge">已匯入</span>' : '') + (p.parent ? ' <span class="badge">子頁面</span>' : '') + '</label>';
        }).join('') + '</div><button class="btn primary" type="button" data-act="doImport" data-target="' + target + '">匯入勾選的頁面</button>';
    }).catch(function () {
      $('#dlgBody').innerHTML = '<p class="notice bad">讀不到 WordPress 的頁面清單，請確認網路，或到「基本資料」確認 WordPress 網址。</p>';
    });
  }
  function doImport(target) {
    var ids = $$('#dlgBody input[type=checkbox]:checked').map(function (i) { return i.value; });
    if (!ids.length) { toast('請先勾選頁面'); return; }
    $('#dlgBody').innerHTML = '<p class="muted">匯入中…</p>';
    var type = target === 'media' ? 'posts/' : 'pages/';
    Promise.all(ids.map(function (id) { return wpApi(type + id + '?_fields=id,slug,date,title,content,excerpt,jetpack_featured_media_url'); })).then(function (list) {
      var tmp = document.createElement('div');
      var text = function (h) { tmp.innerHTML = h || ''; return (tmp.textContent || '').replace(/\s+/g, ' ').trim(); };
      var n = 0;
      list.forEach(function (p) {
        var html = p.content && p.content.rendered || '';
        var title = text(p.title.rendered);
        if (target === 'videos') {
          var seen = {};
          (html.match(/(?:youtube(?:-nocookie)?\.com\/(?:embed\/|watch\?v=)|youtu\.be\/)([\w-]{11})/g) || []).forEach(function (m) {
            var id = m.slice(-11);
            if (seen[id] || state.videos.some(function (v) { return (v.url || '').indexOf(id) >= 0; })) return;
            seen[id] = 1;
            state.videos.push({ title: title + '（' + (Object.keys(seen).length) + '）', url: 'https://www.youtube.com/watch?v=' + id, description: '', hidden: false });
            n++;
          });
          state.site.importedVideoPages.push({ id: p.id, slug: p.slug });
          return;
        }
        var first = (html.match(/<img[^>]+src="([^"]+)"/) || [])[1];
        var summary = text(p.excerpt && p.excerpt.rendered).replace(/\s*(\[…\]|繼續閱讀.*)$/, '');
        if (target === 'media') {
          // 內文裡第一個連到外部網站的連結，當作原始報導網址
          var site = state.site.wordpressSite;
          var ext = (html.match(/<a[^>]+href="(https?:\/\/[^"]+)"/g) || []).map(function (a) { return a.match(/href="([^"]+)"/)[1]; })
            .filter(function (u) { return u.indexOf(site) < 0 && !/wordpress\.com|wp\.com|\.(jpe?g|png|gif|webp)(\?|$)/i.test(u); })[0] || '';
          var sl = title;
          if (state.media.some(function (x) { return (x.slug || x.title) === sl; })) sl = title + '-' + (p.date || '').slice(0, 10);
          state.media.push({ slug: sl, title: title, outlet: '', date: (p.date || '').slice(0, 10), url: ext,
            summary: summary.length > 80 ? summary.slice(0, 80) + '…' : summary,
            cover: (p.jetpack_featured_media_url || first || '').replace(/\?.*$/, ''), body: sanitize(html), hidden: false, wpId: p.id, wpSlug: p.slug });
          n++;
          return;
        }
        var item = { slug: title, title: title, summary: summary.length > 60 ? summary.slice(0, 60) + '…' : summary,
          cover: (p.jetpack_featured_media_url || first || '').replace(/\?.*$/, ''), body: sanitize(html), gallery: [],
          relatedCategory: '', relatedTag: '', hidden: false, wpId: p.id, wpSlug: p.slug };
        if (target === 'services') { item.audience = ''; item.duration = ''; item.capacity = ''; item.fee = ''; item.bookingUrl = ''; }
        else item.mapUrl = '';
        // 同名的項目直接更新內容，其餘新增
        var same = state[target].filter(function (x) { return x.title === title; })[0];
        if (same) { Object.keys(item).forEach(function (k) { if (k !== 'slug' && (item[k] || k === 'body')) same[k] = item[k]; }); }
        else state[target].push(item);
        n++;
      });
      markDirty();
      render();
      $('#dlg').close();
      toast('已匯入 ' + n + ' 項，檢查無誤後按「發布」。', 4000);
    }).catch(function () {
      $('#dlgBody').innerHTML = '<p class="notice bad">匯入失敗，請稍後再試。</p>';
    });
  }

  /* ---------- 畫面 ---------- */

  var TABS = [
    ['services', '協會服務'], ['towns', '社區人文'], ['videos', '影片精選'], ['media', '媒體報導'], ['events', '近期活動'], ['sep'],
    ['home', '首頁'], ['nav', '選單'], ['visit', '到訪與預約'], ['shanhaiji', '山海集'], ['basic', '基本資料'], ['sep'],
    ['photos', '照片庫'], ['history', '版本紀錄'],
  ];

  function render() {
    $('#tabs').innerHTML = TABS.map(function (t) {
      return t[0] === 'sep' ? '<div class="sep"></div>' : '<button type="button" data-tab="' + t[0] + '"' + (tab === t[0] ? ' aria-current="page"' : '') + '>' + t[1] + '</button>';
    }).join('');
    var fn = { services: viewItems, towns: viewItems, media: viewItems, videos: viewVideos, events: viewEvents, home: viewHome, nav: viewNav,
      visit: viewVisit, shanhaiji: viewShanhaiji, basic: viewBasic, photos: viewPhotos, history: viewHistory }[tab];
    $('#main').innerHTML = fn();
    if (tab === 'history') loadHistory();
    markDirty();
  }

  function inp(path, label, opts) {
    opts = opts || {};
    var v = getPath(state, path);
    var tag;
    if (opts.textarea) tag = '<textarea data-bind="' + path + '"' + (opts.rows ? ' rows="' + opts.rows + '"' : '') + '>' + esc(v) + '</textarea>';
    else if (opts.lines) tag = '<textarea data-bind-lines="' + path + '" rows="' + (opts.rows || 4) + '">' + esc((v || []).join('\n')) + '</textarea>';
    else if (opts.select) tag = '<select data-bind="' + path + '">' + opts.select.map(function (o) {
      var val = typeof o === 'string' ? o : o[0], lab = typeof o === 'string' ? (o || '（不指定）') : o[1];
      return '<option value="' + esc(val) + '"' + (String(v || '') === String(val) ? ' selected' : '') + '>' + esc(lab) + '</option>';
    }).join('') + '</select>';
    else tag = '<input data-bind="' + path + '" type="' + (opts.type || 'text') + '" value="' + esc(v) + '"' + (opts.list ? ' list="' + opts.list + '"' : '') + (opts.placeholder ? ' placeholder="' + esc(opts.placeholder) + '"' : '') + '>';
    return '<label class="' + (opts.full ? 'field-full' : '') + '">' + esc(label) + (opts.hint ? '<span class="hint">' + esc(opts.hint) + '</span>' : '') + tag + '</label>';
  }
  function chk(path, label) {
    return '<label class="check"><input type="checkbox" data-bind="' + path + '"' + (getPath(state, path) ? ' checked' : '') + '> ' + esc(label) + '</label>';
  }
  function imgField(path, label) {
    var v = getPath(state, path);
    return '<div class="field-full"><label>' + esc(label) + '</label><div class="imgfield">' +
      (v ? '<img src="' + esc(imgSrc(v)) + '" alt="">' : '<div class="noimg">沒有照片</div>') +
      '<button class="btn" type="button" data-act="pickImg" data-path="' + path + '">選擇照片</button>' +
      (v ? '<button class="btn danger" type="button" data-act="clearImg" data-path="' + path + '">移除</button>' : '') + '</div></div>';
  }
  function galleryField(path) {
    var list = getPath(state, path) || [];
    return '<div class="field-full"><label>照片集<span class="hint">顯示在內文下方，點照片可放大</span></label><div class="gal">' +
      list.map(function (p, i) {
        return '<figure><img src="' + esc(imgSrc(p)) + '" alt=""><button class="btn icon small" type="button" title="移除" data-act="galDel" data-path="' + path + '" data-i="' + i + '">✕</button>' +
          '<span class="mv"><button class="btn small" type="button" data-act="galMove" data-d="-1" data-path="' + path + '" data-i="' + i + '">←</button>' +
          '<button class="btn small" type="button" data-act="galMove" data-d="1" data-path="' + path + '" data-i="' + i + '">→</button></span></figure>';
      }).join('') + '<button class="btn" type="button" data-act="galAdd" data-path="' + path + '">＋ 加入照片</button></div></div>';
  }
  function moveBtns(list, i) {
    return '<button class="btn icon small" type="button" title="上移" data-act="move" data-list="' + list + '" data-i="' + i + '" data-d="-1">↑</button>' +
      '<button class="btn icon small" type="button" title="下移" data-act="move" data-list="' + list + '" data-i="' + i + '" data-d="1">↓</button>';
  }
  function head(title, desc) { return '<h1>' + title + '</h1><p class="muted">' + desc + '</p>'; }

  // 協會服務、社區人文
  function viewItems() {
    var key = tab, isSvc = key === 'services', isMedia = key === 'media';
    var name = { services: '服務', towns: '社區', media: '報導' }[key];
    if (editing && editing.list === key && state[key][editing.i]) return viewItemForm(key, editing.i);
    editing = null;
    var list = state[key];
    return head({ services: '協會服務', towns: '社區人文', media: '媒體報導' }[key], {
        services: '網站的主軸。每一項服務都有自己的介紹頁，首頁與選單會依這裡的順序顯示。拖曳或按箭頭調整順序。',
        towns: '小鎮社區人文的各社區介紹頁。',
        media: '媒體對協會的報導。網站上依日期由新到舊排列，首頁顯示最新幾則（在「首頁」設定）。' }[key]) +
      '<div class="row-acts" style="margin:0 0 16px"><button class="btn primary" type="button" data-act="addItem">＋ 新增' + name + '</button>' +
      '<button class="btn" type="button" data-act="import" data-target="' + key + '">從 WordPress 匯入</button></div>' +
      (list.length ? '<div class="list">' + list.map(function (x, i) { return [x, i]; }).sort(function (a, b) {
        // 媒體報導依日期由新到舊顯示；其他依設定的順序
        return isMedia ? ((b[0].date || '') > (a[0].date || '') ? 1 : -1) : a[1] - b[1];
      }).map(function (row) {
        var x = row[0], i = row[1];
        var src = imgSrc(x.cover, 200);
        return (isMedia ? '<div class="item">' + '<span></span>' : '<div class="item" data-list="' + key + '" data-i="' + i + '"><span class="grip" draggable="true" title="拖曳調整順序">⋮⋮</span>') +
          '<div class="item-main">' + (src ? '<img class="thumb" src="' + esc(src) + '" alt="">' : '<span class="thumb"></span>') +
          '<div class="item-body"><div class="title">' + esc(x.title || '（未命名）') + (x.hidden ? '<span class="badge off">隱藏中</span>' : '') + '</div>' +
          '<div class="sub">' + (isMedia ? esc([x.date, x.outlet].filter(Boolean).join('　')) : esc(x.summary || '')) + '</div></div></div>' +
          '<div class="acts">' + (isMedia ? '' : moveBtns(key, i)) + '<button class="btn small" type="button" data-act="edit" data-i="' + i + '">編輯</button></div></div>';
      }).join('') + '</div>' : '<p class="empty">還沒有' + name + '，按「新增」或「從 WordPress 匯入」。</p>');
  }

  function viewItemForm(key, i) {
    loadWpLists();
    var isSvc = key === 'services', isMedia = key === 'media', p = key + '.' + i, x = state[key][i];
    var param = { services: 'service', towns: 'town', media: 'media' }[key];
    var tagOpts = (wp.tags || []).map(function (t) { return '<option value="' + esc(t.slug) + '">' + esc(t.name) + '</option>'; }).join('');
    var live = saved[key] && saved[key].some(function (s) { return (s.slug || s.title) === (x.slug || x.title); });
    return '<div class="row-acts" style="margin:0 0 12px"><button class="btn" type="button" data-act="back">← 回到清單</button>' +
      (live ? '<a class="btn" target="_blank" rel="noopener" href="./?' + param + '=' + encodeURIComponent(x.slug || x.title) + '">在網站上看</a>' : '') + '</div>' +
      '<h1>' + esc(x.title || '新的項目') + '</h1><p class="muted">修改會先暫存在這個畫面，按右上角「發布」才會更新網站。</p>' +
      '<div class="panel"><h2>基本</h2><div class="grid2">' +
      inp(p + '.title', isMedia ? '報導標題' : '名稱') +
      inp(p + '.slug', '網址代稱', { hint: '出現在網址裡。建立後盡量不要改，改了舊連結會失效。留空會用名稱。' }) +
      (isMedia ? inp(p + '.outlet', '媒體名稱', { placeholder: '例如：聯合報、客家電視台' }) + inp(p + '.date', '報導日期', { type: 'date' }) +
        inp(p + '.url', '原始報導網址（選填）', { full: true, hint: '有填的話，頁面上會出現「閱讀原始報導」按鈕。', placeholder: 'https://' }) : '') +
      inp(p + '.summary', isMedia ? '摘要' : '一句話介紹', { full: true, hint: isMedia ? '顯示在列表上，約 30 到 60 字。' : '顯示在首頁卡片與頁面標題下方，約 20 到 40 字。' }) +
      imgField(p + '.cover', '封面照片') + '</div>' +
      '<div class="row-acts">' + chk(p + '.hidden', '暫時隱藏（不在網站上顯示）') + '</div></div>' +
      (isMedia ? '' : isSvc ? '<div class="panel"><h2>服務資訊</h2><p class="muted">顯示在服務頁右側，沒有的可以留空。</p><div class="grid2">' +
        inp(p + '.audience', '適合對象', { placeholder: '例如：國小以上、團體 10 人起' }) +
        inp(p + '.duration', '所需時間', { placeholder: '例如：約 90 分鐘' }) +
        inp(p + '.capacity', '人數', { placeholder: '例如：10–40 人' }) +
        inp(p + '.fee', '費用', { placeholder: '例如：每人 200 元' }) +
        inp(p + '.bookingUrl', '預約表單網址', { full: true, hint: '留空會使用「到訪與預約」裡的預約表單。' }) + '</div></div>'
        : '<div class="panel"><h2>地點</h2>' + inp(p + '.mapUrl', 'Google 地圖連結', { hint: '在 Google 地圖找到地點 → 分享 → 複製連結' }) + '</div>') +
      '<div class="panel"><h2>內文</h2>' + richHtml(p + '.body') + '</div>' +
      (isMedia ? '' : '<div class="panel"><h2>照片集</h2>' + galleryField(p + '.gallery') + '</div>') +
      (isMedia ? '' : '<div class="panel"><h2>相關紀錄</h2><p class="muted">從 WordPress 自動列出相關文章。選分類或標籤其中一個即可，都不選就不顯示。</p><div class="grid2">' +
      inp(p + '.relatedCategory', 'WordPress 分類', { select: [''].concat(wp.cats || []).concat(x.relatedCategory && (wp.cats || []).indexOf(x.relatedCategory) < 0 ? [x.relatedCategory] : []) }) +
      inp(p + '.relatedTag', 'WordPress 標籤', { list: 'wpTags', hint: '輸入標籤，會出現建議', placeholder: '例如：導覽' }) +
      '<datalist id="wpTags">' + tagOpts + '</datalist></div></div>') +
      '<div class="row-acts"><button class="btn" type="button" data-act="back">← 回到清單</button><span class="spacer"></span>' +
      '<button class="btn danger" type="button" data-act="delItem" data-i="' + i + '">刪除這個' + { services: '服務', towns: '社區', media: '報導' }[key] + '</button></div>';
  }

  function viewVideos() {
    return head('影片精選', '貼上 YouTube 網址就好。首頁會顯示前 3 部，影片精選頁顯示全部。') +
      '<div class="row-acts" style="margin:0 0 16px"><button class="btn primary" type="button" data-act="addVideo">＋ 新增影片</button>' +
      '<button class="btn" type="button" data-act="import" data-target="videos">從 WordPress 匯入</button></div>' +
      (state.videos.length ? '<div class="list">' + state.videos.map(function (v, i) {
        var id = (String(v.url || '').match(/(?:youtu\.be\/|v=|embed\/|shorts\/|live\/)([\w-]{11})/) || [])[1];
        return '<div class="item" data-list="videos" data-i="' + i + '"><span class="grip" draggable="true" title="拖曳調整順序">⋮⋮</span>' +
          '<div class="item-main">' + (id ? '<img class="thumb" src="https://i.ytimg.com/vi/' + id + '/default.jpg" alt="">' : '<span class="thumb"></span>') +
          '<div class="item-body"><div class="title">' + esc(v.title || '（未命名）') + (v.hidden ? '<span class="badge off">隱藏中</span>' : '') + (id ? '' : '<span class="badge warn">網址待填</span>') + '</div></div></div>' +
          '<div class="acts">' + moveBtns('videos', i) + '<button class="btn danger small" type="button" data-act="delRow" data-list="videos" data-i="' + i + '">刪除</button></div>' +
          '<div class="item-form grid2">' + inp('videos.' + i + '.title', '標題') + inp('videos.' + i + '.url', 'YouTube 網址') +
          inp('videos.' + i + '.description', '說明（選填）', { full: true }) + chk('videos.' + i + '.hidden', '暫時隱藏') + '</div></div>';
      }).join('') + '</div>' : '<p class="empty">還沒有影片。</p>');
  }

  function viewEvents() {
    var t = today();
    var svc = [['', '（不指定）']].concat(state.services.map(function (s) { return [s.slug || s.title, s.title]; }));
    var past = state.events.filter(function (e) { return (e.end || e.date) < t; }).length;
    return head('近期活動', '活動結束後會自動從網站上消失。指定服務的話，活動也會出現在那個服務的頁面。') +
      '<div class="row-acts" style="margin:0 0 16px"><button class="btn primary" type="button" data-act="addEvent">＋ 新增活動</button>' +
      '<button class="btn" type="button" data-act="sortEvents">依日期排序</button>' +
      (past ? '<button class="btn danger" type="button" data-act="clearPast">刪除已結束的活動（' + past + '）</button>' : '') + '</div>' +
      (state.events.length ? '<div class="list">' + state.events.map(function (e, i) {
        var p = 'events.' + i;
        var over = e.date && (e.end || e.date) < t;
        return '<div class="item"><span></span><div class="item-body"><div class="title">' + esc(e.title || '（未命名）') + (over ? '<span class="badge">已結束</span>' : '') + '</div></div>' +
          '<div class="acts"><button class="btn danger small" type="button" data-act="delRow" data-list="events" data-i="' + i + '">刪除</button></div>' +
          '<div class="item-form grid3">' + inp(p + '.title', '活動名稱') + inp(p + '.date', '開始日期', { type: 'date' }) + inp(p + '.end', '結束日期（選填）', { type: 'date' }) +
          inp(p + '.time', '時間', { placeholder: '10:00–16:00' }) + inp(p + '.place', '地點') + inp(p + '.service', '屬於哪個服務', { select: svc }) +
          inp(p + '.note', '說明', { placeholder: '例如：免費入場' }) + inp(p + '.link', '報名或詳情連結（選填）', { placeholder: 'https://' }) + '</div></div>';
      }).join('') + '</div>' : '<p class="empty">目前沒有活動。</p>');
  }

  var SECTION_NAMES = { services: '協會的服務', booking: '預約與到訪', explore: '探索更多（社區、報導、影片、山海集、文章的入口）', events: '近期活動', towns: '小鎮社區人文', shanhaiji: '山海集', videos: '影片精選', posts: '最新文章（WordPress）', media: '媒體報導', visit: '到訪資訊' };
  function viewHome() {
    return head('首頁', '最上面固定是「番社參拾」封面與古厝大門，下面各段落可以調整順序、改標題，或暫時不顯示。首頁建議保持精簡，其他內容由「探索更多」進入。') +
      '<div class="panel"><h2>封面按鈕</h2><div class="grid2">' + inp('site.hero.primaryText', '第一個按鈕文字（連到服務項目）') +
      inp('site.hero.secondaryText', '第二個按鈕文字（連到預約）') + '</div></div>' +
      '<div class="panel"><h2>首頁段落</h2><div class="list">' + state.site.sections.map(function (s, i) {
        var p = 'site.sections.' + i;
        return '<div class="item" data-list="site.sections" data-i="' + i + '"><span class="grip" draggable="true" title="拖曳調整順序">⋮⋮</span>' +
          '<div class="item-body"><div class="title">' + esc(SECTION_NAMES[s.key] || s.key) + (s.show ? '' : '<span class="badge off">不顯示</span>') + '</div></div>' +
          '<div class="acts">' + moveBtns('site.sections', i) + '</div>' +
          '<div class="item-form grid2">' + chk(p + '.show', '在首頁顯示') + '<span></span>' + inp(p + '.title', '段落標題') + inp(p + '.intro', '段落說明（選填）') +
          (s.key === 'media' ? inp(p + '.count', '首頁顯示幾則', { type: 'number' }) : '') + '</div></div>';
      }).join('') + '</div></div>' +
      '<div class="panel"><h2>最新文章</h2><div class="grid2">' + inp('site.homePostCount', '首頁顯示幾篇', { type: 'number' }) + '</div></div>';
  }

  var NAV_TYPES = [['auto-services', '服務項目（自動列出所有服務）'], ['auto-towns', '社區人文（自動列出所有社區）'], ['service', '某一項服務'], ['town', '某一個社區'],
    ['videos', '影片精選'], ['media', '媒體報導'], ['posts', '所有文章'], ['visit', '到訪與預約'], ['search', '搜尋'], ['category', 'WordPress 分類'], ['url', '其他網址'], ['menu', '自訂下拉選單']];
  function navTarget(p, it) {
    if (it.type === 'service') return inp(p + '.target', '哪一項服務', { select: state.services.map(function (s) { return [s.slug || s.title, s.title]; }) });
    if (it.type === 'town') return inp(p + '.target', '哪一個社區', { select: state.towns.map(function (s) { return [s.slug || s.title, s.title]; }) });
    if (it.type === 'category') return inp(p + '.target', '分類名稱', { placeholder: '例如：媒體報導' });
    if (it.type === 'url') return inp(p + '.target', '網址', { placeholder: 'https://' });
    return '<span></span>';
  }
  function viewNav() {
    return head('選單', '網站最上方的選單。「服務項目」「社區人文」會自動列出所有項目，新增服務時不用再改選單。') +
      '<div class="row-acts" style="margin:0 0 16px"><button class="btn primary" type="button" data-act="addNav">＋ 新增選單項目</button></div>' +
      '<div class="list">' + state.site.nav.map(function (it, i) {
        var p = 'site.nav.' + i;
        return '<div class="item" data-list="site.nav" data-i="' + i + '"><span class="grip" draggable="true" title="拖曳調整順序">⋮⋮</span>' +
          '<div class="item-body"><div class="title">' + esc(it.label || '（未命名）') + '</div></div>' +
          '<div class="acts">' + moveBtns('site.nav', i) + '<button class="btn danger small" type="button" data-act="delRow" data-list="site.nav" data-i="' + i + '">刪除</button></div>' +
          '<div class="item-form grid3">' + inp(p + '.label', '顯示文字') + inp(p + '.type', '連到', { select: NAV_TYPES, rerender: true }) + navTarget(p, it) + '</div>' +
          (it.type === 'menu' ? '<div class="item-form"><p class="muted">下拉選單的項目：</p>' + (it.children || []).map(function (c, j) {
            var cp = p + '.children.' + j;
            return '<div class="grid3" style="margin-bottom:10px">' + inp(cp + '.label', '顯示文字') +
              inp(cp + '.type', '連到', { select: NAV_TYPES.filter(function (t) { return !/^(auto-|menu)/.test(t[0]); }) }) + navTarget(cp, c) +
              '<div class="field-full row-acts" style="margin-top:0">' + moveBtns(p + '.children', j) + '<button class="btn danger small" type="button" data-act="delRow" data-list="' + p + '.children" data-i="' + j + '">刪除</button></div></div>';
          }).join('') + '<button class="btn small" type="button" data-act="addNavChild" data-path="' + p + '.children">＋ 新增下拉項目</button></div>' : '') + '</div>';
      }).join('') + '</div>';
  }

  function viewVisit() {
    var days = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];
    var on = state.site.visit.openDays || [];
    return head('到訪與預約', '顯示在首頁「預約與到訪」「到訪陳家古厝」、服務頁與頁尾。') +
      '<div class="panel"><h2>開放時間</h2><label>開放日</label><div class="days" style="margin:6px 0 14px">' + days.map(function (d, i) {
        return '<label><input type="checkbox" data-day="' + i + '"' + (on.indexOf(i) >= 0 ? ' checked' : '') + '> ' + d + '</label>';
      }).join('') + '</div><div class="grid3">' + inp('site.visit.openText', '開放日文字', { placeholder: '週三至週日' }) +
      inp('site.visit.open', '開門時間', { type: 'time' }) + inp('site.visit.close', '關門時間', { type: 'time' }) + '</div>' +
      '<p class="muted">網站會依台北時間自動顯示「現在開放中」或「目前休館」。</p></div>' +
      '<div class="panel"><h2>地址與交通</h2><div class="grid2">' + inp('site.visit.address', '地址', { full: true }) +
      inp('site.visit.transport', '交通方式（選填）', { textarea: true, full: true, rows: 3 }) + '</div></div>' +
      '<div class="panel"><h2>聯絡與預約</h2><div class="grid2">' + inp('site.visit.phone', '電話') + inp('site.visit.email', 'Email', { type: 'email' }) +
      inp('site.visit.facebookLabel', 'Facebook 名稱') + inp('site.visit.facebookUrl', 'Facebook 網址') +
      inp('site.visit.line', 'LINE ID 或連結（選填）') + inp('site.visit.bookingUrl', '預約表單網址（選填）', { hint: '例如 Google 表單。沒有的話，預約按鈕會改成電話。' }) + '</div></div>';
  }

  function viewShanhaiji() {
    return head('山海集', '首頁《山海集》段落的內容。') +
      '<div class="panel"><div class="grid2">' + inp('site.shanhaiji.text', '介紹文字', { textarea: true, full: true, rows: 4 }) +
      inp('site.shanhaiji.covers', '封面上的期別（一行一期，最多顯示 3 期）', { lines: true, full: true, rows: 3 }) +
      inp('site.shanhaiji.buyText', '購買按鈕文字') + inp('site.shanhaiji.buyUrl', '購買網址') +
      inp('site.shanhaiji.blogText', '第二個按鈕文字') + inp('site.shanhaiji.blogUrl', '第二個按鈕網址') + '</div></div>';
  }

  function viewBasic() {
    return head('基本資料', '網站名稱與 WordPress 連線設定。') +
      '<div class="panel"><div class="grid2">' + inp('site.name', '網站名稱（封面大字）') + inp('site.tagline', '副標') +
      inp('site.org', '協會名稱（左上角）', { full: true }) +
      inp('site.description', '網站簡介', { textarea: true, full: true, rows: 3, hint: '搜尋引擎與分享時使用。' }) + '</div></div>' +
      '<div class="panel"><h2>WordPress</h2><div class="grid2">' + inp('site.wordpressSite', 'WordPress 網址', { hint: '不含 https://，例如 huansia30.home.blog' }) +
      inp('site.wordpressBlogId', 'WordPress 網站 ID（選填）', { hint: 'Email 訂閱用，留空會自動查詢。' }) +
      inp('site.featuredCategories', '文章列表篩選列要顯示的分類（一行一個）', { lines: true, full: true, rows: 5 }) +
      inp('site.perPage', '文章列表每頁幾篇', { type: 'number' }) + inp('site.goatcounter', 'GoatCounter 訪客統計代碼（選填）') + '</div></div>';
  }

  function viewPhotos() {
    var used = usedImages(), list = allImages();
    return head('照片庫', '所有上傳過的照片。沒有被使用的照片可以刪除，節省空間。') +
      '<label class="btn primary upload">上傳新照片<input type="file" accept="image/*" multiple hidden data-act="libUpload"></label>' +
      (list.length ? '<div class="lib">' + list.map(function (p) {
        return '<figure><img src="' + esc(imgSrc(p)) + '" alt="" loading="lazy"><figcaption>' +
          (pending[p] ? '<span class="badge warn">尚未發布</span>' : used[p] ? '<span class="badge">使用中</span>' : '<button class="btn danger small" type="button" data-act="delPhoto" data-path="' + esc(p) + '">刪除</button>') +
          '</figcaption></figure>';
      }).join('') + '</div>' : '<p class="empty" style="margin-top:16px">還沒有照片。</p>') +
      (Object.keys(removed).length ? '<p class="notice" style="margin-top:16px">已標記刪除 ' + Object.keys(removed).length + ' 張照片，按「發布」後才會真的刪除。</p>' : '');
  }

  function viewHistory() {
    return head('版本紀錄', '每次發布都會留下紀錄。改錯時，可以載入之前的版本，確認後再發布一次就能還原。') +
      '<div class="hist" id="hist"><p class="muted">讀取中…</p></div>';
  }
  function loadHistory() {
    gh(repoPath() + '/commits?path=data&per_page=30&sha=' + encodeURIComponent(auth.branch)).then(function (list) {
      $('#hist').innerHTML = list.map(function (c, i) {
        return '<div class="item"><div class="item-body"><div class="title">' + esc(c.commit.message.split('\n')[0]) + (i === 0 ? '<span class="badge">目前版本</span>' : '') + '</div>' +
          '<div class="sub">' + fmtTime(c.commit.author.date) + '　' + esc(c.commit.author.name) + '</div></div>' +
          '<div class="acts">' + (i > 0 ? '<button class="btn small" type="button" data-act="restore" data-sha="' + c.sha + '">載入這個版本</button>' : '') + '</div></div>';
      }).join('') || '<p class="muted">還沒有紀錄。</p>';
    }).catch(function (e) { $('#hist').innerHTML = '<p class="notice bad">' + esc(ghError(e)) + '</p>'; });
  }
  function restore(sha) {
    if (isDirty() && !window.confirm('目前有尚未發布的修改，載入舊版本會蓋掉這些修改。確定嗎？')) return;
    Promise.all(FILES.map(function (f) {
      return gh(repoPath() + '/contents/data/' + f + '.json?ref=' + sha).then(function (r) { return JSON.parse(b64ToText(r.content)); }).catch(function () { return clone(state[f]); });
    })).then(function (r) {
      FILES.forEach(function (f, i) { state[f] = r[i]; });
      normalize();
      editing = null;
      render();
      showDialog('已載入舊版本', '<p>舊版本的內容已載入到管理程式，<b>還沒有發布</b>。請到各項目檢查，確認無誤後按右上角「發布」，網站就會還原成這個版本。</p>');
    }).catch(function (e) { toast(ghError(e)); });
  }

  function showDialog(title, html) {
    $('#dlgTitle').textContent = title;
    $('#dlgBody').innerHTML = html;
    var d = $('#dlg');
    if (!d.open) d.showModal();
  }

  /* ---------- 事件 ---------- */

  function listAt(path) { return getPath(state, path); }
  function move(path, i, d) {
    var l = listAt(path), j = i + d;
    if (j < 0 || j >= l.length) return;
    var x = l.splice(i, 1)[0];
    l.splice(j, 0, x);
    render();
  }

  document.addEventListener('input', function (e) {
    var t = e.target;
    if (t.hasAttribute('data-bind')) {
      var v = t.type === 'checkbox' ? t.checked : t.type === 'number' ? (t.value === '' ? '' : Number(t.value)) : t.value;
      setPath(state, t.getAttribute('data-bind'), v);
      markDirty();
    } else if (t.hasAttribute('data-bind-lines')) {
      setPath(state, t.getAttribute('data-bind-lines'), t.value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean));
      markDirty();
    } else if (t.hasAttribute('data-day')) {
      state.site.visit.openDays = $$('[data-day]').filter(function (c) { return c.checked; }).map(function (c) { return +c.getAttribute('data-day'); });
      markDirty();
    } else if (t.hasAttribute('data-rich')) {
      setPath(state, t.getAttribute('data-rich'), richValue(t));
      markDirty();
    }
  });
  document.addEventListener('change', function (e) {
    var t = e.target;
    // 會影響畫面結構的欄位，改完重畫
    if (t.matches('select[data-bind$=".type"], input[type=checkbox][data-bind]')) render();
    if (t.getAttribute('data-act') === 'libUpload' && t.files.length) {
      addUploads(t.files).then(function () { render(); toast('已加入照片庫，發布後生效'); }, function (err) { toast(err.message); });
    }
  });
  document.addEventListener('focusout', function (e) {
    var t = e.target;
    if (t.hasAttribute && t.hasAttribute('data-rich')) {
      // 整理貼上的格式
      var clean = richValue(t);
      setPath(state, t.getAttribute('data-rich'), clean);
    }
    if (t.matches && t.matches('[data-bind$=".title"]') && editing) {
      var h = $('#main h1');
      if (h) h.textContent = t.value || '新的項目';
    }
  });
  document.addEventListener('paste', function (e) {
    var ed = e.target.closest && e.target.closest('.rich');
    if (!ed) return;
    var html = e.clipboardData.getData('text/html');
    var txt = e.clipboardData.getData('text/plain');
    e.preventDefault();
    if (html) document.execCommand('insertHTML', false, sanitize(html));
    else document.execCommand('insertHTML', false, esc(txt).split(/\n{2,}/).map(function (p) { return '<p>' + p.replace(/\n/g, '<br>') + '</p>'; }).join(''));
  });

  document.addEventListener('click', function (e) {
    var t = e.target.closest('button, [data-act]');
    if (!t) return;
    // 先把編輯器的內容存好，再做會改變清單順序的動作
    if (!t.hasAttribute('data-cmd')) syncRich();
    if (t.hasAttribute('data-tab')) { tab = t.getAttribute('data-tab'); editing = null; render(); window.scrollTo(0, 0); return; }
    if (t.hasAttribute('data-cmd')) { e.preventDefault(); richCommand(t); return; }
    if (t.hasAttribute('data-close')) { t.closest('dialog').close(); return; }
    if (t.hasAttribute('data-pick')) {
      var p = t.getAttribute('data-pick');
      $('#picker').close();
      if (pickerCb) pickerCb([p]);
      return;
    }
    var act = t.getAttribute('data-act');
    if (!act) return;
    var i = +t.getAttribute('data-i');
    var path = t.getAttribute('data-path');
    var blank = { slug: '', title: '', summary: '', cover: '', body: '', gallery: [], relatedCategory: '', relatedTag: '', hidden: false };
    switch (act) {
      case 'edit': editing = { list: tab, i: i }; render(); window.scrollTo(0, 0); break;
      case 'back': editing = null; render(); break;
      case 'addItem':
        var item = clone(blank);
        if (tab === 'services') { item.audience = ''; item.duration = ''; item.capacity = ''; item.fee = ''; item.bookingUrl = ''; }
        else if (tab === 'media') { item = { slug: '', title: '', outlet: '', date: today(), url: '', summary: '', cover: '', body: '', hidden: false }; }
        else item.mapUrl = '';
        state[tab].push(item);
        editing = { list: tab, i: state[tab].length - 1 };
        render();
        break;
      case 'delItem':
        if (!window.confirm('確定要刪除「' + (state[tab][i].title || '這個項目') + '」嗎？按發布後才會真的刪除。')) return;
        state[tab].splice(i, 1);
        editing = null;
        render();
        break;
      case 'delRow':
        if (!window.confirm('確定要刪除嗎？')) return;
        listAt(t.getAttribute('data-list')).splice(i, 1);
        render();
        break;
      case 'move': move(t.getAttribute('data-list'), i, +t.getAttribute('data-d')); break;
      case 'addVideo': state.videos.unshift({ title: '', url: '', description: '', hidden: false }); render(); break;
      case 'addEvent': state.events.unshift({ title: '', date: today(), end: '', time: '', place: '陳家古厝', note: '', link: '', service: '' }); render(); break;
      case 'sortEvents': state.events.sort(function (a, b) { return (a.date || '') < (b.date || '') ? -1 : 1; }); render(); break;
      case 'clearPast':
        if (!window.confirm('刪除所有已結束的活動？')) return;
        state.events = state.events.filter(function (ev) { return !ev.date || (ev.end || ev.date) >= today(); });
        render();
        break;
      case 'addNav': state.site.nav.push({ label: '新項目', type: 'url', target: '' }); render(); break;
      case 'addNavChild': listAt(path).push({ label: '', type: 'service', target: '' }); render(); break;
      case 'pickImg': openPicker(function (ps) { setPath(state, path, ps[0]); render(); }); break;
      case 'clearImg': setPath(state, path, ''); render(); break;
      case 'galAdd': openPicker(function (ps) { listAt(path).push.apply(listAt(path), ps); render(); }, true); break;
      case 'galDel': listAt(path).splice(i, 1); render(); break;
      case 'galMove': move(path, i, +t.getAttribute('data-d')); break;
      case 'import': importDialog(t.getAttribute('data-target')); break;
      case 'doImport': doImport(t.getAttribute('data-target')); break;
      case 'delPhoto':
        if (pending[path]) delete pending[path]; else removed[path] = 1;
        render();
        break;
      case 'restore': restore(t.getAttribute('data-sha')); break;
      case 'reload': $('#dlg').close(); boot(); break;
    }
    if (act !== 'edit' && act !== 'back') markDirty();
  });

  // 清單拖曳排序
  var drag = null;
  document.addEventListener('dragstart', function (e) {
    var it = e.target.closest && e.target.closest('.item[data-list]');
    if (!it || !e.target.classList || !e.target.classList.contains('grip')) return;
    drag = { list: it.getAttribute('data-list'), i: +it.getAttribute('data-i') };
    it.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
  });
  document.addEventListener('dragover', function (e) {
    var it = e.target.closest && e.target.closest('.item[data-list]');
    if (!drag || !it || it.getAttribute('data-list') !== drag.list) return;
    e.preventDefault();
    $$('.item.over').forEach(function (x) { x.classList.remove('over'); });
    it.classList.add('over');
  });
  document.addEventListener('drop', function (e) {
    var it = e.target.closest && e.target.closest('.item[data-list]');
    if (!drag || !it || it.getAttribute('data-list') !== drag.list) return;
    e.preventDefault();
    var to = +it.getAttribute('data-i');
    var l = listAt(drag.list);
    var x = l.splice(drag.i, 1)[0];
    l.splice(to, 0, x);
    drag = null;
    render();
  });
  document.addEventListener('dragend', function () {
    drag = null;
    $$('.dragging,.over').forEach(function (x) { x.classList.remove('dragging', 'over'); });
  });

  $('#pickerFile').addEventListener('change', function () {
    var input = this;
    if (!input.files.length) return;
    addUploads(input.files).then(function (paths) {
      input.value = '';
      $('#picker').close();
      if (pickerCb) pickerCb(paths);
    }, function (err) { toast(err.message); });
  });
  $('#publishBtn').addEventListener('click', publish);
  $('#logoutBtn').addEventListener('click', function () {
    if (isDirty() && !window.confirm('有尚未發布的修改，登出後會遺失。確定登出嗎？')) return;
    localStorage.removeItem('fs30-admin');
    sessionStorage.removeItem('fs30-admin');
    location.reload();
  });
  window.addEventListener('beforeunload', function (e) {
    if (auth && isDirty()) { e.preventDefault(); e.returnValue = ''; }
  });

  /* ---------- 登入與啟動 ---------- */

  function guessRepo() {
    var h = location.hostname, seg = location.pathname.split('/').filter(Boolean);
    if (/\.github\.io$/i.test(h)) {
      var owner = h.split('.')[0];
      var repo = seg.length && !/\.html$/.test(seg[0]) ? seg[0] : h;
      return { owner: owner, repo: repo };
    }
    return { owner: '', repo: '' };
  }

  function boot() {
    $('#boot').hidden = false;
    $('#boot').textContent = '從 GitHub 載入資料中…';
    loadAll().then(function () {
      $('#boot').hidden = true;
      $('#login').hidden = true;
      $('#app').hidden = false;
      render();
    }).catch(function (e) {
      $('#boot').hidden = true;
      $('#app').hidden = true;
      $('#login').hidden = false;
      var el = $('#lgErr');
      el.textContent = e.status ? ghError(e) : '載入失敗：' + e.message;
      el.hidden = false;
    });
  }

  $('#loginForm').addEventListener('submit', function (e) {
    e.preventDefault();
    auth = { owner: $('#lgOwner').value.trim(), repo: $('#lgRepo').value.trim(), token: $('#lgToken').value.trim() };
    var store = $('#lgRemember').checked ? localStorage : sessionStorage;
    localStorage.removeItem('fs30-admin');
    sessionStorage.removeItem('fs30-admin');
    store.setItem('fs30-admin', JSON.stringify(auth));
    $('#lgErr').hidden = true;
    boot();
  });

  (function start() {
    try { auth = JSON.parse(localStorage.getItem('fs30-admin') || sessionStorage.getItem('fs30-admin') || 'null'); } catch (e) { auth = null; }
    if (auth && auth.token) { boot(); return; }
    var g = guessRepo();
    $('#lgOwner').value = g.owner;
    $('#lgRepo').value = g.repo;
    $('#boot').hidden = true;
    $('#login').hidden = false;
  })();
})();
