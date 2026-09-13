(function () {
  var scriptUrl = document.currentScript && document.currentScript.src;
  var dailyUrl = scriptUrl
    ? new URL('../learning/od.html', scriptUrl).href
    : 'learning/od.html';
  var learningLinks = document.querySelectorAll(
    '.header-nav-folder-content a[href$="learning.html"]'
  );

  learningLinks.forEach(function (learningLink) {
    var item = learningLink.closest('.header-nav-folder-item');
    if (!item || item.querySelector('.learning-submenu')) {
      return;
    }

    var submenu = document.createElement('div');
    submenu.className = 'learning-submenu';
    submenu.innerHTML = '<a href="' + dailyUrl + '">Of The Day</a>';
    item.appendChild(submenu);
  });

  document.querySelectorAll('.learning-submenu a').forEach(function (link) {
    link.href = dailyUrl;
  });
})();
