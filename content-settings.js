(function (root) {
  'use strict';
  function imagePath(value) {
    var input = String(value || '').trim().replace(/\\/g, '/');
    if (!input) return '';
    if (/^https?:\/\//i.test(input)) {
      var url;
      try { url = new URL(input); } catch (e) { return ''; }
      if (!/(^|\.)(github\.io|github\.com|githubusercontent\.com)$/i.test(url.hostname)) return '';
      input = url.pathname;
    } else if (/^[a-z][a-z\d+.-]*:|^\/\//i.test(input)) return '';
    if (input.charAt(0) === '/') {
      var index = input.indexOf('/uploads/');
      if (index < 0) return '';
      input = input.slice(index + 1);
    }
    input = input.replace(/^\.\//, '').split(/[?#]/)[0];
    try { input = decodeURIComponent(input); } catch (e) { return ''; }
    if (!/^uploads\/.+\.(jpe?g|png|gif|webp|avif|svg)$/i.test(input)) return '';
    if (input.split('/').some(function (part) { return part === '..' || part === '.' || !part; })) return '';
    if (/[<>"'`\x00-\x1f]/.test(input)) return '';
    return input;
  }
  function linkPath(value, base) {
    var input = String(value || '').trim();
    if (!input) return '';
    if (/^[?#]/.test(input)) return input;
    if (/^(mailto:|tel:)/i.test(input)) return input;
    if (/^\/\//.test(input)) input = 'https:' + input;
    if (/^https?:\/\//i.test(input)) {
      try {
        var url = new URL(input), current = new URL(base || (root.location && root.location.href) || 'https://example.invalid/');
        var folder = new URL('.', current).pathname;
        if (url.origin === current.origin && url.pathname.indexOf(folder) === 0) return './' + url.pathname.slice(folder.length) + url.search + url.hash;
        if (/\.github\.io$/i.test(url.hostname) && /[?&](p|name|view|service|town|media|page_id|category_name|tag|s)=/.test(url.search)) return url.search + url.hash;
        return url.href;
      } catch (e) { return ''; }
    }
    if (/^[a-z][a-z\d+.-]*:/i.test(input) || /[<>"'`\x00-\x1f]/.test(input)) return '';
    if (input.charAt(0) === '/') return './' + input.replace(/^\/+/, '');
    if (input.split(/[?#]/)[0].split('/').indexOf('..') >= 0) return '';
    return input;
  }
  function isImageKey(key, parent) {
    return /^(cover|image|illustration|icon|logo|thumbnail|videoFallback|playIcon|placeholderImage)$/.test(key) || parent === 'exploreImages';
  }
  function normalizeData(data) {
    function walk(obj, parent) {
      if (!obj || typeof obj !== 'object') return;
      Object.keys(obj).forEach(function (key) {
        var value = obj[key];
        if (typeof value === 'string' && isImageKey(key, parent)) {
          var path = imagePath(value); if (path) obj[key] = path;
        } else if (key === 'gallery' && Array.isArray(value)) {
          obj[key] = value.map(function (path) { return typeof path === 'string' ? imagePath(path) || path : (walk(path, key), path); });
        } else if (key === 'body' && typeof value === 'string') {
          obj[key] = value.replace(/(<img\b[^>]*\bsrc\s*=\s*)(["'])(.*?)\2/gi, function (all, before, quote, src) {
            return before + quote + (imagePath(src) || src) + quote;
          });
        } else if (/^(href|link|bookingUrl|mapUrl|buyUrl|blogUrl|url)$/.test(key) && typeof value === 'string') {
          obj[key] = linkPath(value);
        } else walk(value, key);
      });
    }
    walk(data, ''); return data;
  }
  function imageIssues(data) {
    var errors = [];
    function check(value, path) {
      if (value && (typeof value !== 'string' || imagePath(value) !== value)) errors.push(path + '：請從照片庫選圖，圖片需使用 uploads/ 開頭的相對路徑。');
    }
    function walk(obj, parent, path) {
      if (!obj || typeof obj !== 'object') return;
      Object.keys(obj).forEach(function (key) {
        var value = obj[key], at = path ? path + '.' + key : key;
        if (typeof value === 'string' && isImageKey(key, parent)) check(value, at);
        else if (key === 'gallery' && Array.isArray(value)) value.forEach(function (src, i) { if (typeof src === 'string') check(src, at + '.' + i); else walk(src, key, at + '.' + i); });
        else if (key === 'body' && typeof value === 'string') {
          var exp = /<img\b[^>]*\bsrc\s*=\s*(["'])(.*?)\1/gi, match;
          while ((match = exp.exec(value))) check(match[2], at);
        } else walk(value, key, at);
      });
    }
    walk(data, '', ''); return errors;
  }
  var settings = { imagePath: imagePath, linkPath: linkPath, normalizeData: normalizeData, imageIssues: imageIssues };
  root.ContentSettings = settings;
  if (typeof module !== 'undefined' && module.exports) module.exports = settings;
})(typeof window !== 'undefined' ? window : globalThis);

ContentSettings.uiFields=[["serviceMore", "服務入口按鈕", "了解與預約"], ["allServices", "所有服務返回連結", "所有服務"], ["allTowns", "所有社區返回連結", "所有社區"], ["allMedia", "所有報導返回連結", "所有媒體報導"], ["allPosts", "所有文章連結", "看所有文章"], ["allVideos", "所有影片連結", "看所有影片"], ["mediaOriginal", "原始報導按鈕", "閱讀原始報導"], ["more", "更多內容按鈕", "看更多"], ["related", "相關紀錄標題", "相關紀錄"], ["bookingNotes", "預約須知標題", "預約須知"], ["upcoming", "近期場次標題", "近期場次"], ["otherServices", "其他服務標題", "其他服務"], ["audience", "服務資訊：對象", "適合對象"], ["duration", "服務資訊：時間", "所需時間"], ["capacity", "服務資訊：人數", "人數"], ["fee", "服務資訊：費用", "費用"], ["bookOnline", "預約按鈕", "線上預約"], ["phone", "電話按鈕", "打電話"], ["facebook", "Facebook 按鈕", "Facebook 私訊"], ["line", "LINE 按鈕", "LINE 詢問"], ["email", "Email 按鈕", "Email 詢問"], ["map", "地圖按鈕", "在地圖上看"], ["address", "地址標籤", "地址"], ["hours", "時間標籤", "開放時間"], ["contact", "聯絡標籤", "聯絡"], ["bookingForm", "預約表單按鈕", "填寫預約表單"], ["menu", "手機選單按鈕", "選單"], ["close", "關閉按鈕", "關閉"], ["search", "搜尋按鈕", "搜尋"], ["empty", "空白頁說明", "目前沒有內容。"], ["emptyMedia", "無報導說明", "目前還沒有媒體報導。"], ["emptyVideos", "無影片說明", "目前還沒有影片。"], ["openStatus", "開放中說明", "現在開放中，今天到 {time}"], ["closedStatus", "休館說明", "目前休館，{day} {time} 開放"], ["playVideo", "播放影片提示", "播放：{title}"], ["previousImage", "上一張照片按鈕", "上一張"], ["nextImage", "下一張照片按鈕", "下一張"], ["share", "分享標籤", "分享"], ["copyLink", "複製連結按鈕", "複製連結"], ["comments", "留言標題", "留言"], ["writeComment", "留言按鈕", "我要留言"], ["commentHint", "留言說明", "會開啟原網站的留言表單，填暱稱和 Email 就能留言。送出後回到這裡重新整理，就會看到你的留言（有些留言需要審核後才會顯示）。"], ["commentsClosed", "留言關閉說明", "這篇文章已關閉留言。"], ["noComments", "尚無留言說明", "還沒有人留言，留下第一則吧。"], ["commentUnavailable", "留言載入失敗說明", "暫時讀不到留言，請稍後重新整理。"]];

ContentSettings.defaults={"brand": {"logo": "", "logoAlt": "番社參拾", "icon": "uploads/2026/10/site-icon.svg"}, "visuals": {"playIcon": "", "videoFallback": "uploads/2026/10/video-placeholder.svg", "placeholders": [{"image": "uploads/2026/10/placeholder-1.svg"}, {"image": "uploads/2026/10/placeholder-2.svg"}, {"image": "uploads/2026/10/placeholder-3.svg"}]}, "exploreCards": [{"key": "towns", "title": "社區人文", "description": "{towns} 個社區", "href": "?view=towns", "cover": "uploads/2026/10/wp-41d8fa39bacd9c4085a5.jpg", "coverAlt": "社區人文", "icon": "", "hidden": false}, {"key": "media", "title": "媒體報導", "description": "{media} 則報導", "href": "?view=media", "cover": "uploads/2026/10/wp-6623701479baf71c4662.jpg", "coverAlt": "媒體報導", "icon": "", "hidden": false}, {"key": "videos", "title": "影片精選", "description": "{videos} 部影片", "href": "?view=videos", "cover": "uploads/2026/10/video-oVmCUXji8nA.jpg", "coverAlt": "影片精選", "icon": "", "hidden": false}, {"key": "shanhaiji", "title": "《山海集》", "description": "協會的地方刊物", "href": "?view=shanhaiji", "cover": "uploads/2026/10/explore-shanhaiji.jpg", "coverAlt": "《山海集》2022 秋季號封面", "icon": "", "hidden": false}, {"key": "archives", "title": "紀錄文章", "description": "活動紀錄與在地觀察", "href": "?view=archives", "cover": "uploads/2026/10/explore-archives.jpg", "coverAlt": "在地文化紀錄", "icon": "", "hidden": false}], "footer": {"subscribeTitle": "訂閱新文章", "subscribeIntro": "留下 Email，有新文章時會寄信通知你。", "subscribeHint": "訂閱由 WordPress.com 處理，需要到信箱點確認信。", "subscribeButton": "訂閱", "subscribePlaceholder": "你的 Email", "contactTitle": "聯絡協會", "copyright": "© {year} {org}"}, "ui": {"serviceMore": "了解與預約", "allServices": "所有服務", "allTowns": "所有社區", "allMedia": "所有媒體報導", "allPosts": "看所有文章", "allVideos": "看所有影片", "mediaOriginal": "閱讀原始報導", "more": "看更多", "related": "相關紀錄", "bookingNotes": "預約須知", "upcoming": "近期場次", "otherServices": "其他服務", "audience": "適合對象", "duration": "所需時間", "capacity": "人數", "fee": "費用", "bookOnline": "線上預約", "phone": "打電話", "facebook": "Facebook 私訊", "line": "LINE 詢問", "email": "Email 詢問", "map": "在地圖上看", "address": "地址", "hours": "開放時間", "contact": "聯絡", "bookingForm": "填寫預約表單", "menu": "選單", "close": "關閉", "search": "搜尋", "empty": "目前沒有內容。", "emptyMedia": "目前還沒有媒體報導。", "emptyVideos": "目前還沒有影片。", "openStatus": "現在開放中，今天到 {time}", "closedStatus": "目前休館，{day} {time} 開放", "playVideo": "播放：{title}", "previousImage": "上一張", "nextImage": "下一張", "share": "分享", "copyLink": "複製連結", "comments": "留言", "writeComment": "我要留言", "commentHint": "會開啟原網站的留言表單，填暱稱和 Email 就能留言。送出後回到這裡重新整理，就會看到你的留言（有些留言需要審核後才會顯示）。", "commentsClosed": "這篇文章已關閉留言。", "noComments": "還沒有人留言，留下第一則吧。", "commentUnavailable": "暫時讀不到留言，請稍後重新整理。", "skip": "跳到主要內容", "footerFacebook": "Facebook", "footerBooking": "預約導覽", "footerServices": "服務項目", "footerPosts": "所有文章"}, "hero": {"illustration": "uploads/2026/10/chen-house-place.png", "illustrationLabels": true, "illustrationAlt": "陳家古厝，灰綠色正廳雙門、灰色中庭與門外紅磚地。", "entryText": "走進陳家古厝 · 讀老屋的故事", "entryHref": "?p=3320", "note": "文化導覽、展覽與工藝體驗，從這座老屋出發。", "lintel": "潁川堂", "leftPlaque": "陳家古厝", "rightPlaque": "蕃社參拾", "leftYear": "2015", "rightYear": "1937", "primaryHref": "?view=services", "secondaryHref": "", "photoAlt": "陳家古厝文化推廣據點"}, "shanhaiji": {"issues": [{"title": "2022 秋季號", "image": "uploads/2026/10/wp-32d101824e627fc1a7b4.jpg", "alt": "山海集2022秋季號封面", "href": "?media=2022%E5%B1%B1%E6%B5%B7%E9%9B%86%E7%A7%8B%E5%AD%A3%E8%99%9F"}, {"title": "2024 小鎮眾神會", "image": "uploads/2026/10/wp-6623701479baf71c4662.jpg", "alt": "山海集2024小鎮眾神會封面", "href": "?media=2024%E5%B1%B1%E6%B5%B7%E9%9B%86-%E5%B0%8F%E9%8E%AE%E7%9C%BE%E7%A5%9E%E6%9C%83"}]}};
ContentSettings.applyDefaults = function(site) {
  function fill(target, defaults) { Object.keys(defaults).forEach(function(key) {
    if (target[key] == null) target[key] = JSON.parse(JSON.stringify(defaults[key]));
    else if (defaults[key] && typeof defaults[key] === 'object' && !Array.isArray(defaults[key])) fill(target[key],defaults[key]);
  }); }
  fill(site,ContentSettings.defaults); return site;
};

ContentSettings.uiFields.push.apply(ContentSettings.uiFields,[["skip", "跳到內容連結", "跳到主要內容"], ["footerFacebook", "頁尾 Facebook 連結", "Facebook"], ["footerBooking", "頁尾預約連結", "預約導覽"], ["footerServices", "頁尾服務連結", "服務項目"], ["footerPosts", "頁尾文章連結", "所有文章"]]);

ContentSettings.uiFields.push.apply(ContentSettings.uiFields,[["searchIntro", "搜尋頁說明", "輸入關鍵字，找文章。"], ["searchPlaceholder", "搜尋欄位範例", "例如：金紙、慈裕宮、手抄紙"], ["searchLabel", "搜尋欄位替代標籤", "搜尋關鍵字"], ["searchResultsTitle", "搜尋結果標題（{term} 為關鍵字）", "搜尋「{term}」"], ["searchResultsLabel", "搜尋結果標籤", "搜尋結果"], ["localResultsTitle", "站內搜尋結果標題", "網站頁面"], ["archivesIntro", "文章總覽說明（{count} 為篇數）", "共 {count} 篇，由新到舊排列。"], ["subscriptionFallback", "訂閱備用連結文字", "到 WordPress 訂閱 Email 通知"], ["copyDone", "複製成功提示", "已複製連結"], ["postEmpty", "尚無文章說明", "這裡目前沒有文章。"]]);
ContentSettings.defaults.ui={"serviceMore": "了解與預約", "allServices": "所有服務", "allTowns": "所有社區", "allMedia": "所有媒體報導", "allPosts": "看所有文章", "allVideos": "看所有影片", "mediaOriginal": "閱讀原始報導", "more": "看更多", "related": "相關紀錄", "bookingNotes": "預約須知", "upcoming": "近期場次", "otherServices": "其他服務", "audience": "適合對象", "duration": "所需時間", "capacity": "人數", "fee": "費用", "bookOnline": "線上預約", "phone": "打電話", "facebook": "Facebook 私訊", "line": "LINE 詢問", "email": "Email 詢問", "map": "在地圖上看", "address": "地址", "hours": "開放時間", "contact": "聯絡", "bookingForm": "填寫預約表單", "menu": "選單", "close": "關閉", "search": "搜尋", "empty": "目前沒有內容。", "emptyMedia": "目前還沒有媒體報導。", "emptyVideos": "目前還沒有影片。", "openStatus": "現在開放中，今天到 {time}", "closedStatus": "目前休館，{day} {time} 開放", "playVideo": "播放：{title}", "previousImage": "上一張", "nextImage": "下一張", "share": "分享", "copyLink": "複製連結", "comments": "留言", "writeComment": "我要留言", "commentHint": "會開啟原網站的留言表單，填暱稱和 Email 就能留言。送出後回到這裡重新整理，就會看到你的留言（有些留言需要審核後才會顯示）。", "commentsClosed": "這篇文章已關閉留言。", "noComments": "還沒有人留言，留下第一則吧。", "commentUnavailable": "暫時讀不到留言，請稍後重新整理。", "skip": "跳到主要內容", "footerFacebook": "Facebook", "footerBooking": "預約導覽", "footerServices": "服務項目", "footerPosts": "所有文章", "searchIntro": "輸入關鍵字，找文章。", "searchPlaceholder": "例如：金紙、慈裕宮、手抄紙", "searchLabel": "搜尋關鍵字", "searchResultsTitle": "搜尋「{term}」", "searchResultsLabel": "搜尋結果", "localResultsTitle": "網站頁面", "archivesIntro": "共 {count} 篇，由新到舊排列。", "subscriptionFallback": "到 WordPress 訂閱 Email 通知", "copyDone": "已複製連結", "postEmpty": "這裡目前沒有文章。"};
