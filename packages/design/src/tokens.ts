/**
 * wellorbetter 设计系统：CSS 变量（light/dark）+ 品牌资产。
 *
 * 暖中性「纸与墨」调色板。替换掉原先的 Material 3 蓝色种子（#445E91），
 * 但**保留全部 M3 变量名** —— apps/share/src/styles.css 的 1086 行全是
 * 这些名字的消费者，改名会静默失效（AvatarDropdown.css 每个 var() 都带
 * 硬编码 hex 兜底，改名不会报错，只会悄悄变回蓝色）。
 *
 * 中性色 chroma <= 0.02：暖，但绝不发灰蓝。
 * 强调色只有两个：terracotta（唯一吸引注意力的颜色）+ moss（只用于
 * 已发布/在线状态）。详见 opendesign/design-systems/wellorbetter-brand/。
 *
 * ── 为什么是一份而不是四份 ──────────────────────────────────────────
 * 旧版把 light 写了两遍（:root 和 [data-theme="light"]）、dark 写了两遍
 * （@media prefers-color-scheme 和 [data-theme="dark"]）。四份副本必须
 * 手动保持同步，而这种结构已经在本项目的另一处咬过人：opendesign 的第一版
 * 同样是两份 dark 副本，它们漂移了 —— media 那份留着过期的 moss chroma、
 * 还整个漏掉了 --accent-*-ink，导致所有「系统深色 + 没点过切换按钮」的访客
 * 拿到 1.93:1 的状态标签。用切换按钮做的检查永远发现不了，因为点击会写上
 * data-theme，走的是另一个分支。
 *
 * 现在每个颜色只有一条 light-dark() 声明，没有第二份可以漂移。
 * color-scheme 是唯一的开关；light-dark() 读的就是它。
 * 需要 Chrome 123+ / Safari 17.5+ / Firefox 120+（2024 年起 Baseline）。
 */

/** 品牌资产。terracotta 主色的 sRGB 近似，供 <meta name="theme-color"> 等场合。 */
export const BRAND = {
  accent: "#B0552F",
  accentHover: "#95441F",
};

/** 完整 CSS 变量。一份调色板，light-dark() 承载明暗。 */
export const cssVariables = `
/* color-scheme 是唯一的明暗开关：属性没写 = 跟随系统。
   只有访客真的点过切换才会写上 data-theme，所以首次访问和禁用 JS 时
   系统偏好仍然有效。 */
:root { color-scheme: light dark; }
:root[data-theme="light"] { color-scheme: light; }
:root[data-theme="dark"] { color-scheme: dark; }

:root {
  /* ── 暖中性阶梯 ────────────────────────────────────────────────
     share 里这四级各有明确职责（grep 过真实用法，不是照搬 M3 阶梯）：
       --bg                        页面底色
       --surface-container-low     卡片、feed 卡、面板 —— 浮起来（light 更亮）
       --surface-container-high    分段控件、信息块、对话框
       --surface-container-highest 进度条轨道、媒体占位、图片井 —— 陷下去
     light 模式下 low 比 bg 亮、high/highest 比 bg 暗，是故意的非单调：
     纸片浮起、凹槽陷落。M3 的单调阶梯在这里没有意义，何况
     --surface-container 和 --surface-variant 在 share 中根本没被用到。 */
  --bg: light-dark(oklch(0.968 0.008 78), oklch(0.185 0.012 62));
  --surface: light-dark(oklch(0.985 0.006 78), oklch(0.225 0.012 62));
  --surface-container-low: light-dark(oklch(0.985 0.006 78), oklch(0.225 0.012 62));
  --surface-container: light-dark(oklch(0.942 0.010 76), oklch(0.265 0.012 62));
  --surface-container-high: light-dark(oklch(0.942 0.010 76), oklch(0.265 0.012 62));
  --surface-container-highest: light-dark(oklch(0.910 0.012 75), oklch(0.305 0.012 62));
  --surface-variant: light-dark(oklch(0.942 0.010 76), oklch(0.265 0.012 62));

  /* ── 文字 ──────────────────────────────────────────────────────
     --text-muted 是全表用得最多的 token（37 处），落在 bg / low / high
     三种底色上都必须过 4.5:1，所以它不能再淡。 */
  --text: light-dark(oklch(0.235 0.014 55), oklch(0.945 0.008 80));
  --text-muted: light-dark(oklch(0.505 0.012 60), oklch(0.735 0.010 76));
  --on-surface-variant: light-dark(oklch(0.505 0.012 60), oklch(0.735 0.010 76));

  /* ── 描边 ──────────────────────────────────────────────────────
     两档描边的职责不同，对比度要求也不同：

     --outline-variant  卡片发丝线、分隔线（23 处）。装饰性，刻意保持很淡：
                        1.41:1 / 1.49:1，低于 WCAG 1.4.11 的 3:1。这是「纸感
                        发丝线」的取舍 —— 卡片靠底色和阴影也能认出来。

     --outline          输入框、outlined 按钮、拖放区的边框（styles.css:190
                        是所有文本框的边框）。这些是可交互控件的边界，3:1 是
                        真的适用：1.7:1 的输入框边框不是审美问题，它是唯一
                        告诉你「这里能打字」的线索。所以这一档实测到 3:1 以上。

     取值是扫出来的，不是猜的。约束最紧的是「深色模式下压在卡片上」那一组：
     light L=0.61 → 3.47(页) / 3.66(卡片) / 3.22(凹槽)
     dark  L=0.55 → 3.82(页) / 3.50(卡片) / 3.14(凹槽) */
  --border: light-dark(oklch(0.855 0.010 76), oklch(0.325 0.012 64));
  --outline-variant: light-dark(oklch(0.855 0.010 76), oklch(0.325 0.012 64));
  --outline: light-dark(oklch(0.61 0.012 76), oklch(0.55 0.012 64));

  /* ── terracotta：唯一吸引注意力的颜色 ──────────────────────────
     链接、主按钮、当前导航、进度填充。dark 模式抬高 L 保证对比度，
     同时略降 C，免得在深底上发光。 */
  --primary: light-dark(oklch(0.55 0.135 42), oklch(0.70 0.125 45));
  /* 不写 var(--surface)：那样在 dark 下会解析成深色纸，
     等于把近黑的字放到中亮的强调色上。两个模式都直接写明。 */
  --on-primary: light-dark(oklch(0.985 0.006 78), oklch(0.185 0.012 62));
  --primary-container: light-dark(oklch(0.93 0.035 46), oklch(0.32 0.045 44));
  --on-primary-container: light-dark(oklch(0.32 0.090 42), oklch(0.90 0.050 45));

  /* secondary 在 share 里只服务「当前导航项」。刻意复用 terracotta 而不是
     引入第二个色相 —— 一个强调色的纪律比配齐 M3 色板重要。 */
  --secondary: light-dark(oklch(0.505 0.012 60), oklch(0.735 0.010 76));
  --on-secondary: light-dark(oklch(0.985 0.006 78), oklch(0.185 0.012 62));
  --secondary-container: light-dark(oklch(0.93 0.035 46), oklch(0.32 0.045 44));
  --on-secondary-container: light-dark(oklch(0.50 0.135 42), oklch(0.70 0.125 45));

  /* ── 语义色 ────────────────────────────────────────────────────
     error 推到 hue 18 并抬高 chroma，好跟 hue 42 的 terracotta 区分开；
     只差十几度会认错。-container 上的文字用更深的一档，因为
     强调色本身在自己的浅底上到不了 4.5:1（标签字号需要 4.5:1）。 */
  --error: light-dark(oklch(0.49 0.190 18), oklch(0.76 0.150 22));
  --on-error: light-dark(oklch(0.985 0.006 78), oklch(0.185 0.012 62));
  --error-container: light-dark(oklch(0.94 0.040 20), oklch(0.33 0.060 20));
  --on-error-container: light-dark(oklch(0.45 0.190 18), oklch(0.85 0.110 22));

  /* moss 只表示已发布/在线。不是通用第二色，不是 hover 态。 */
  --success: light-dark(oklch(0.47 0.135 148), oklch(0.70 0.125 150));
  --success-container: light-dark(oklch(0.93 0.035 150), oklch(0.32 0.045 150));
  --on-success-container: light-dark(oklch(0.47 0.135 148), oklch(0.82 0.110 150));

  --warning: light-dark(oklch(0.50 0.110 72), oklch(0.80 0.130 85));
  --warning-container: light-dark(oklch(0.94 0.050 82), oklch(0.32 0.050 80));
  --on-warning-container: light-dark(oklch(0.44 0.110 72), oklch(0.88 0.120 85));

  /* Project 状态色（ui-system.md：draft=neutral / pending=warning /
     published=success / hidden·removed=error-muted / unreviewed=warning）。
     状态系统不配自己的色板，全部映射到上面两个强调色加中性色。 */
  --status-draft: var(--on-surface-variant);
  --status-draft-bg: var(--surface-container-high);
  --status-pending: var(--on-warning-container);
  --status-pending-bg: var(--warning-container);
  --status-published: var(--on-success-container);
  --status-published-bg: var(--success-container);
  --status-hidden: var(--on-error-container);
  --status-hidden-bg: var(--error-container);
  --status-removed: var(--on-error-container);
  --status-removed-bg: var(--error-container);
  --status-unreviewed: var(--on-warning-container);
  --status-unreviewed-bg: var(--warning-container);

  /* 可替换背景（token 替换，不绑定版权图片；默认无背景图）。
     预设的渐变是用 color-mix 从 --primary 等算出来的，所以会跟着
     调色板自动重新着色，不需要在 appearance.ts 里改任何东西。 */
  --app-bg-image: none;
  --app-bg-attachment: fixed;
  --app-bg-opacity: 1;

  /* ── 反向与状态层 ──────────────────────────────────────────────── */
  --inverse-surface: light-dark(oklch(0.265 0.012 62), oklch(0.945 0.008 80));
  --inverse-on-surface: light-dark(oklch(0.968 0.008 78), oklch(0.225 0.012 62));
  --inverse-primary: light-dark(oklch(0.70 0.125 45), oklch(0.55 0.135 42));
  --state-hover: light-dark(oklch(0.55 0.135 42 / 0.08), oklch(0.70 0.125 45 / 0.10));
  --state-pressed: light-dark(oklch(0.55 0.135 42 / 0.12), oklch(0.70 0.125 45 / 0.16));
  --state-focus: light-dark(oklch(0.55 0.135 42 / 0.12), oklch(0.70 0.125 45 / 0.16));

  /* ── 形状 ──────────────────────────────────────────────────────
     小圆角读作印刷品，大圆角读作 2021 年的 SaaS 模板。
     --shape-pill 保持 999px：它同时用在头像和进度条填充上，
     全局改小会把头像切成方块。按钮的去胶囊化属于组件层的事。 */
  --radius: 8px;
  --radius-sm: 5px;
  --radius-xs: 3px;
  --shape-pill: 999px;

  /* ── 排版 ──────────────────────────────────────────────────────
     --font-display 用 Georgia + 思源宋：真正的 editorial 衬线，且零网络
     请求。品牌指定的 Fraunces 需要自托管字体子集（Google Fonts 从国内
     访问本身就慢，而路由问题还没解决），等子集上了 R2 再换这一行。 */
  --font-display: Georgia, "Songti SC", "Noto Serif SC", "Source Han Serif SC", serif;
  --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC",
    "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
  --font-mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;

  /* ── 阴影 ──────────────────────────────────────────────────────
     暖色调、低、克制。原先是 rgba(0,0,0,0.3) 的 M3 elevation，在暖纸底上
     读作一个洞。dark 保留暖色相并抬高 alpha —— 纯黑同样读作洞。 */
  --elevation-1: 0 1px 2px light-dark(oklch(0.235 0.014 55 / 0.05), oklch(0.12 0.012 60 / 0.34));
  --elevation-2: 0 2px 8px light-dark(oklch(0.235 0.014 55 / 0.07), oklch(0.12 0.012 60 / 0.40));
  --elevation-3: 0 8px 28px light-dark(oklch(0.235 0.014 55 / 0.09), oklch(0.12 0.012 60 / 0.48));

  /* 对话框遮罩。暖色，跟纸底同一个色相家族。 */
  --scrim: light-dark(oklch(0.235 0.014 55 / 0.44), oklch(0.12 0.012 60 / 0.60));
}
`;

/** 通用样式基元（reset + 常用类） */
export const baseStyles = `
*, *::before, *::after { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
html { -webkit-text-size-adjust: 100%; }
body {
  font-family: var(--font-sans);
  background: var(--bg);
  color: var(--text);
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}
a { color: var(--primary); text-decoration: none; }
a:hover { text-decoration: underline; }
button {
  font-family: inherit;
  cursor: pointer;
}
input, select, textarea { font-family: inherit; }
:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }
::selection { background: var(--primary-container); color: var(--on-primary-container); }
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation: none !important; transition: none !important; }
}
`;

/** 极简 reset + 主题注入（落地页与分享页通用） */
export const themeStyle = cssVariables + "\n" + baseStyles;
