(function (root) {
  'use strict';
  var DAY = 86400000, OFFSET = 8 * 3600000;
  function parse(value) {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value || '')) return NaN;
    var n = Date.parse(value + ':00+08:00');
    return isFinite(n) && new Date(n + OFFSET).toISOString().slice(0, 16) === value ? n : NaN;
  }
  function validate(visit) {
    var errors = [];
    (visit.closures || []).forEach(function (x, i) {
      var a = parse(x.start), b = parse(x.end), prefix = '休館設定第 ' + (i + 1) + ' 項：';
      if (!isFinite(a) || !isFinite(b)) errors.push(prefix + '請填寫有效的開始與結束日期時間。');
      else if (b <= a) errors.push(prefix + '結束時間必須晚於開始時間。');
    });
    return errors;
  }
  function status(visit, now) {
    now = now == null ? Date.now() : +now;
    var ranges = (visit.closures || []).map(function (x) {
      return {start:parse(x.start), end:parse(x.end), reason:String(x.reason || '').trim()};
    }).filter(function (x) { return isFinite(x.start) && x.end > x.start; })
      .sort(function (a, b) { return a.start - b.start; });
    var emergency = visit.temporaryClosure || {};
    if (emergency.active) return {open:false, exceptional:true, reason:String(emergency.reason || '').trim(), next:null};
    var active = ranges.filter(function (x) { return now >= x.start && now < x.end; });
    var reason = active.map(function (x) { return x.reason; }).filter(function (s, i, a) { return s && a.indexOf(s) === i; }).join('；');
    var today = Math.floor((now + OFFSET) / DAY) * DAY - OFFSET;
    var days = (visit.openDays || []).map(Number);
    function minute(s) { var m = /^(\d{2}):(\d{2})$/.exec(s || ''); return m ? +m[1]*60 + +m[2] : NaN; }
    var open = minute(visit.open), close = minute(visit.close);
    var result = {open:false, exceptional:active.length > 0, reason:reason, next:null};
    if (!isFinite(open) || close <= open || close > 1440 || !days.length) return result;
    // Search whole intervals rather than just opening instants: a partial closure may end at noon.
    var horizon = Math.max(today + 370 * DAY, ranges.reduce(function (m, r) { return Math.max(m, r.end + 8 * DAY); }, today));
    for (var day = today; day <= horizon; day += DAY) {
      if (days.indexOf(new Date(day + OFFSET).getUTCDay()) < 0) continue;
      var start = Math.max(now, day + open * 60000), end = day + close * 60000;
      if (start >= end) continue;
      for (var i = 0; i < ranges.length; i++) {
        var r = ranges[i];
        if (r.end <= start) continue;
        if (r.start >= end || r.start > start) break;
        start = Math.max(start, r.end);
        if (start >= end) break;
      }
      if (start >= end) continue;
      if (start === now) {
        result.open = true;
        result.until = ranges.reduce(function (m, r) { return r.start > now ? Math.min(m, r.start) : m; }, end);
      } else result.next = start;
      return result;
    }
    return result;
  }
  root.VisitHours = {parse:parse, validate:validate, status:status};
}(typeof window !== 'undefined' ? window : globalThis));
