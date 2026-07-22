(function () {
  var _copper = null;
  var _fibre = null;
  var _callbacks = [];

  function _ready(fn) {
    if (_copper) { fn(); } else { _callbacks.push(fn); }
  }

  fetch('/js/data/directory-map.json')
    .then(function (r) { return r.json(); })
    .then(function (d) {
      _copper = d.copper;
      _fibre = d.fibre;
      _callbacks.forEach(function (fn) { fn(); });
      _callbacks = [];
    });

  function _map(workstack) {
    return workstack === 'fibre' ? _fibre : _copper;
  }

  function lookup(workstack, rawCode) {
    var map = _map(workstack);
    if (!map) return null;
    var key = (rawCode || '').trim().toUpperCase();
    return Object.prototype.hasOwnProperty.call(map, key) ? map[key] : null;
  }

  function prefixList(workstack) {
    var map = _map(workstack);
    if (!map) return [];
    var set = {};
    Object.keys(map).forEach(function (k) {
      var dash = k.indexOf('-');
      if (dash > 0) set[k.substring(0, dash)] = true;
    });
    return Object.keys(set);
  }

  function oucList(workstack) {
    var map = _map(workstack);
    if (!map) return [];
    var set = {};
    Object.keys(map).forEach(function (k) { if (map[k].ouc) set[map[k].ouc] = true; });
    return Object.keys(set).sort();
  }

  function pwaList(workstack) {
    var map = _map(workstack);
    if (!map) return [];
    var set = {};
    Object.keys(map).forEach(function (k) { if (map[k].pwa) set[map[k].pwa] = true; });
    return Object.keys(set).sort();
  }

  function pwasForOucs(workstack, oucs) {
    var map = _map(workstack);
    if (!map) return [];
    var oucSet = {};
    oucs.forEach(function (o) { oucSet[o] = true; });
    var set = {};
    Object.keys(map).forEach(function (k) {
      var e = map[k];
      if (oucSet[e.ouc] && e.pwa) set[e.pwa] = true;
    });
    return Object.keys(set).sort();
  }

  Object.defineProperty(window, '_dm', {
    value: Object.freeze({ lookup: lookup, prefixes: prefixList, oucList: oucList, pwaList: pwaList, pwasForOucs: pwasForOucs, ready: _ready }),
    enumerable: false,
    configurable: false,
    writable: false
  });
})();
