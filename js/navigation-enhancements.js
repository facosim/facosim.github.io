(function () {
  var learningPages = [
    { path: 'learning/od.html', label: 'Of The Day' },
    { path: 'brief/lines.html', label: 'Briefing Lines' },
    { path: 'brief/instruments.html', label: 'Flight Instruments' },
    { path: 'brief/e6b.html', label: 'Flight Calculator' }
  ];

  var scriptUrl = document.currentScript && document.currentScript.src;
  function pageUrl(path) {
    return scriptUrl ? new URL('../' + path, scriptUrl).href : path;
  }

  function fillSubmenu(submenu) {
    submenu.textContent = '';
    learningPages.forEach(function (page) {
      var link = document.createElement('a');
      link.href = pageUrl(page.path);
      link.textContent = page.label;
      submenu.appendChild(link);
    });
  }

  var learningLinks = document.querySelectorAll(
    '.header-nav-folder-content a[href$="learning.html"]'
  );

  learningLinks.forEach(function (learningLink) {
    var item = learningLink.closest('.header-nav-folder-item');
    if (!item) {
      return;
    }

    var submenu = item.querySelector('.learning-submenu');
    if (!submenu) {
      submenu = document.createElement('div');
      submenu.className = 'learning-submenu';
      item.appendChild(submenu);
    }
    fillSubmenu(submenu);
  });
})();
