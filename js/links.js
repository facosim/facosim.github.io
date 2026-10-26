// Links page: keep the local and Zulu clocks at the top of the page current.
(function () {
  var local = document.getElementById('efb-local');
  var zulu = document.getElementById('efb-zulu');
  if (!local || !zulu) {
    return;
  }

  function pad(n) {
    return (n < 10 ? '0' : '') + n;
  }

  function tick() {
    var now = new Date();
    local.textContent = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    zulu.textContent = pad(now.getUTCHours()) + pad(now.getUTCMinutes()) + 'Z';
    // run again just after the next minute starts
    setTimeout(tick, 60000 - (now.getSeconds() * 1000 + now.getMilliseconds()) + 50);
  }

  tick();
})();
