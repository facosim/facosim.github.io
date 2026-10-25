/* Light and dark mode for the whole site.
   Load this in <head>, before the page's styles finish, so the right theme is
   on <html> before anything is drawn (no white flash on dark pages).
   The choice is kept in a small cookie, "faco-theme", for a year. With no
   cookie yet, the page follows the visitor's system setting. */
(function () {
  var COOKIE = 'faco-theme';
  var root = document.documentElement;

  function savedTheme() {
    var m = document.cookie.match(/(?:^|;\s*)faco-theme=(dark|light)\b/);
    return m ? m[1] : null;
  }

  function systemTheme() {
    return window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function apply(theme) {
    root.setAttribute('data-theme', theme);
    root.style.colorScheme = theme;
    api.isLight = theme === 'light';
    var buttons = document.querySelectorAll('.theme-toggle');
    for (var i = 0; i < buttons.length; i++) label(buttons[i], theme);
  }

  function label(button, theme) {
    var next = theme === 'dark' ? 'light' : 'dark';
    button.setAttribute('aria-label', 'Switch to ' + next + ' mode');
    button.setAttribute('title', 'Switch to ' + next + ' mode');
    button.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
  }

  function current() {
    return root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  }

  function set(theme) {
    theme = theme === 'dark' ? 'dark' : 'light';
    document.cookie = COOKIE + '=' + theme + '; path=/; max-age=31536000; SameSite=Lax' +
      (location.protocol === 'https:' ? '; Secure' : '');
    apply(theme);
  }

  function toggle() { set(current() === 'dark' ? 'light' : 'dark'); }

  // For pages that draw on a canvas: swap(table) gives a function that
  // returns a colour as is in dark mode, or its light-mode partner from the
  // table ({ '#0a0e13': '#f4f6f8', ... }). Works with '#rrggbb' strings and
  // 0xrrggbb numbers alike.
  function swap(table) {
    var light = {};
    for (var k in table) light[k.toLowerCase()] = table[k];
    return function (c) {
      if (!api.isLight) return c;
      if (typeof c === 'number') {
        var v = light['#' + ('00000' + c.toString(16)).slice(-6)];
        return v ? parseInt(v.slice(1), 16) : c;
      }
      return light[String(c).toLowerCase()] || c;
    };
  }

  var api = window.facoTheme = { toggle: toggle, set: set, get: current, swap: swap, isLight: false };

  apply(savedTheme() || systemTheme());

  // Until the visitor picks a theme, follow changes to the system setting.
  if (window.matchMedia) {
    var mq = matchMedia('(prefers-color-scheme: dark)');
    var onChange = function () { if (!savedTheme()) apply(systemTheme()); };
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else if (mq.addListener) mq.addListener(onChange);
  }

  // Moon and sun icons; CSS shows the one for the mode you would switch to.
  var ICONS =
    '<svg class="theme-icon-moon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z"/></svg>' +
    '<svg class="theme-icon-sun" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.2"/>' +
    '<path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/></svg>';

  function makeButton(extraClass) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'theme-toggle' + (extraClass ? ' ' + extraClass : '');
    b.innerHTML = ICONS;
    label(b, current());
    b.addEventListener('click', toggle);
    return b;
  }

  // Put a toggle on the page. A page can mark its own spot with
  // data-theme-toggle; site pages get one in the header beside Contact
  // (desktop) and beside the menu button (mobile); anything else gets a small
  // floating button, unless <html> has data-theme-no-button (pages that
  // switch the theme from their own settings).
  function placeButtons() {
    var spots = document.querySelectorAll('[data-theme-toggle]');
    var placed = false;
    for (var i = 0; i < spots.length; i++) {
      spots[i].appendChild(makeButton());
      placed = true;
    }
    var actions = document.querySelectorAll('.header-display-desktop .header-actions--right');
    for (i = 0; i < actions.length; i++) {
      actions[i].insertBefore(makeButton('theme-toggle--header'), actions[i].querySelector('.header-actions-action--cta'));
      placed = true;
    }
    var burgers = document.querySelectorAll('.header-display-mobile .header-burger');
    for (i = 0; i < burgers.length; i++) {
      burgers[i].parentNode.insertBefore(makeButton('theme-toggle--header theme-toggle--mobile'), burgers[i]);
      placed = true;
    }
    if (!placed && !root.hasAttribute('data-theme-no-button')) document.body.appendChild(makeButton('theme-toggle--floating'));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', placeButtons);
  else placeButtons();
})();
