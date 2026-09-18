/**
 * 首屏主题引导：在第一次绘制前把存好的主题/背景写到 <html> 上。
 *
 * 这段代码以前内联在 index.html 里，而 index.html 自己声明了
 * `script-src 'self'`（没有 'unsafe-inline'）—— 所以它从来没跑过。浏览器
 * 静默拦掉它，只在 console 里留一条 CSP 报告，页面看上去还是好的：React
 * 挂载后 applyAppearance() 会把主题补上，于是 bug 的表现只是「深色用户每次
 * 打开都先闪一下浅色」，而那正是这段代码存在的唯一目的。
 *
 * 搬成外部文件而不是给 CSP 加 sha256 白名单，是因为哈希会漂：改一个字符就
 * 得同步哈希，忘了就又变成静默失效 —— 跟刚修掉的这个 bug 一模一样的失败
 * 方式。外部文件走 'self'，改动不需要任何人记得同步什么。
 *
 * 这里的渐变字面量是 lib/appearance.ts 里 BACKGROUND_PRESETS 的副本：这段
 * 代码跑在 bundle 存在之前，import 不了。这份重复是必要的，由
 * __tests__/t306-bootstrap-parity.test.ts 钉住，漂了就会红。
 */
(function () {
  try {
    var t = localStorage.getItem("wb-theme");
    var dark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    var attr = t === "light" || t === "dark" ? t : dark ? "dark" : "light";
    document.documentElement.dataset.theme = attr;
    var bg = localStorage.getItem("wb-bg");
    var map = {
      aurora:
        "radial-gradient(1200px 600px at 10% -10%, color-mix(in srgb, var(--primary) 22%, transparent), transparent 60%),radial-gradient(1000px 500px at 110% 20%, color-mix(in srgb, var(--secondary) 18%, transparent), transparent 55%)",
      mesh:
        "radial-gradient(600px 400px at 85% 15%, color-mix(in srgb, var(--primary) 14%, transparent), transparent 55%),radial-gradient(700px 500px at 15% 85%, color-mix(in srgb, var(--success) 10%, transparent), transparent 55%),radial-gradient(500px 400px at 60% 110%, color-mix(in srgb, var(--warning) 10%, transparent), transparent 50%)",
      veil: "linear-gradient(180deg, color-mix(in srgb, var(--primary) 8%, transparent), transparent 40%)"
    };
    if (bg && map[bg]) document.documentElement.style.setProperty("--app-bg-image", map[bg]);
  } catch (e) {}
})();
