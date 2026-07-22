(function () {
  var _data = null;
  var _callbacks = [];

  function _ready(fn) {
    if (_data) { fn(); } else { _callbacks.push(fn); }
  }

  fetch('/js/data/tech-db.json')
    .then(function (r) { return r.json(); })
    .then(function (d) {
      _data = d;
      _callbacks.forEach(function (fn) { fn(); });
      _callbacks = [];
    });

  Object.defineProperty(window, '_techDB', {
    value: {
      lookup: function (pin) {
        var k = String(pin || '').replace(/[\s\-]/g, '').toUpperCase();
        return _data ? (_data[k] || null) : null;
      },
      has: function (pin) {
        return !!this.lookup(pin);
      },
      ready: _ready
    },
    enumerable: false,
    configurable: false,
    writable: false
  });
})();
