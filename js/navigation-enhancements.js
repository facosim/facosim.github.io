(function () {
  // Pages listed under Learning in the Training menu. Paths are relative to
  // the site root; they are resolved from this script's URL so the links work
  // from pages in subfolders too.
  var learningPages = [
    { path: 'learning/od.html', label: 'Of The Day' },
    { path: 'brief/lines.html', label: 'Combat Lines Debrief' },
    { path: 'brief/instruments.html', label: 'Flight Instruments' },
    { path: 'brief/e6b.html', label: 'E6B Calculator' }
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

    // Pages that already have the submenu in their HTML get it rebuilt, so
    // every page shows the same, correctly resolved links.
    var submenu = item.querySelector('.learning-submenu');
    if (!submenu) {
      submenu = document.createElement('div');
      submenu.className = 'learning-submenu';
      item.appendChild(submenu);
    }
    fillSubmenu(submenu);
  });
})();
