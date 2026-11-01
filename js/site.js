(function () {
  var root = document.documentElement;
  var body = document.body;
  var header = document.getElementById('header');

  if (header) {
    var setHeaderHeight = function () {
      root.style.setProperty('--header-height', header.getBoundingClientRect().height + 'px');
    };
    setHeaderHeight();
    if (window.ResizeObserver) {
      new ResizeObserver(setHeaderHeight).observe(header);
    }
    window.addEventListener('load', setHeaderHeight);
  }

  var menu = document.querySelector('.header-menu');
  var burgers = document.querySelectorAll('.header-burger-btn');
  var folders = menu ? menu.querySelectorAll('.header-menu-nav-folder') : [];
  var rootFolder = menu ? menu.querySelector('[data-folder="root"]') : null;
  var headerTheme = header ? header.getAttribute('data-section-theme') : null;
  var menuTheme = menu ? menu.getAttribute('data-section-theme') : null;

  function setHeaderTheme(theme) {
    if (!header || !theme) {
      return;
    }
    header.classList.remove(headerTheme, menuTheme);
    header.classList.add(theme);
    header.setAttribute('data-section-theme', theme);
  }

  function showFolder(name) {
    folders.forEach(function (folder) {
      var isRoot = folder === rootFolder;
      var active = isRoot ? !name : folder.getAttribute('data-folder') === name;
      folder.classList.toggle('header-menu-nav-folder--active', active || isRoot);
      folder.classList.toggle('header-menu-nav-folder--open', isRoot && !!name);
      folder.inert = !active;
    });
  }

  function setMenuOpen(open) {
    body.classList.toggle('header--menu-open', open);
    setHeaderTheme(open ? menuTheme : headerTheme);
    burgers.forEach(function (button) {
      button.classList.toggle('burger--active', open);
      button.setAttribute('aria-expanded', open ? 'true' : 'false');
      button.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    });
    if (!open) {
      showFolder(null);
    }
  }

  burgers.forEach(function (button) {
    button.addEventListener('click', function () {
      setMenuOpen(!body.classList.contains('header--menu-open'));
    });
  });

  if (menu) {
    showFolder(null);
    menu.addEventListener('click', function (event) {
      var link = event.target.closest('a');
      if (!link) {
        return;
      }
      if (link.hasAttribute('data-folder-id')) {
        event.preventDefault();
        showFolder(link.getAttribute('data-folder-id'));
      } else if (link.getAttribute('data-action') === 'back') {
        event.preventDefault();
        showFolder(null);
      }
    });
  }

  var folderButtons = document.querySelectorAll('.header-nav-folder-title');

  function closeDropdowns(except) {
    folderButtons.forEach(function (button) {
      if (button !== except) {
        button.setAttribute('aria-expanded', 'false');
      }
    });
  }

  folderButtons.forEach(function (button) {
    button.addEventListener('click', function () {
      var open = button.getAttribute('aria-expanded') !== 'true';
      closeDropdowns(button);
      button.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  });

  document.addEventListener('click', function (event) {
    if (!event.target.closest('.header-nav-item--folder')) {
      closeDropdowns(null);
    }
  });

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') {
      closeDropdowns(null);
      if (body.classList.contains('header--menu-open')) {
        setMenuOpen(false);
      }
    }
  });
})();
