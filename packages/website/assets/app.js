/* 官网脚本:主题切换 + 复制安装命令。无依赖。 */
(function () {
  var KEY = 'pinterest-collect-site-theme';
  var root = document.documentElement;
  var isZh = (root.lang || '').toLowerCase().indexOf('zh') === 0;
  var toggle = document.querySelector('[data-theme-toggle]');

  try {
    var saved = localStorage.getItem(KEY);
    if (saved === 'light' || saved === 'dark') root.setAttribute('data-theme', saved);
  } catch (error) {
    /* 隐私模式下忽略 */
  }

  function currentTheme() {
    var explicit = root.getAttribute('data-theme');
    if (explicit === 'light' || explicit === 'dark') return explicit;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  var SUN =
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2M5.4 5.4l1.6 1.6M17 17l1.6 1.6M18.6 5.4 17 7M7 17l-1.6 1.6"/></svg>';
  var MOON =
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.6 14.2A8.4 8.4 0 0 1 9.8 3.4a8.6 8.6 0 1 0 10.8 10.8Z"/></svg>';

  function renderToggle() {
    if (!toggle) return;
    var dark = currentTheme() === 'dark';
    toggle.innerHTML = dark ? SUN : MOON;
    var label = dark ? (isZh ? '切换到浅色模式' : 'Switch to light mode') : isZh ? '切换到深色模式' : 'Switch to dark mode';
    toggle.setAttribute('aria-label', label);
    toggle.setAttribute('title', label);
    toggle.setAttribute('aria-pressed', dark ? 'true' : 'false');
  }

  if (toggle) {
    toggle.addEventListener('click', function () {
      var next = currentTheme() === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try {
        localStorage.setItem(KEY, next);
      } catch (error) {
        /* 忽略 */
      }
      renderToggle();
    });
    renderToggle();
  }

  var buttons = document.querySelectorAll('[data-copy]');
  for (var i = 0; i < buttons.length; i += 1) {
    buttons[i].addEventListener('click', function (event) {
      var button = event.currentTarget;
      var target = document.querySelector(button.getAttribute('data-copy'));
      if (!target) return;
      var text = target.innerText || target.textContent || '';
      var done = button.getAttribute('data-copied') || (isZh ? '已复制' : 'Copied');
      var back = button.getAttribute('data-copy-label') || (isZh ? '复制' : 'Copy');
      function finish() {
        button.textContent = done;
        window.setTimeout(function () {
          button.textContent = back;
        }, 1600);
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(finish, finish);
      } else {
        var area = document.createElement('textarea');
        area.value = text;
        document.body.appendChild(area);
        area.select();
        try {
          document.execCommand('copy');
        } catch (error) {
          /* 忽略 */
        }
        document.body.removeChild(area);
        finish();
      }
    });
  }
})();
