/**
 * 明暗选择的存储契约。四个站共用这一份。
 *
 * ── 为什么在 packages/design ────────────────────────────────────────────────
 * tokens.ts 里那三行定义了 data-theme 的**含义**：
 *
 *     :root { color-scheme: light dark; }
 *     :root[data-theme="light"] { color-scheme: light; }
 *     :root[data-theme="dark"]  { color-scheme: dark; }
 *
 * 属性没写 = 跟随系统。这个文件是那个契约的读写端，跟它放一起，别人改一边的
 * 时候另一边就在隔壁。
 *
 * ── 为什么是 cookie，不是 localStorage ──────────────────────────────────────
 * 这套品牌横跨 wellorbetterai.com（落地页 + vibecoding）、
 * share.wellorbetterai.com、blog.wellorbetterai.com。localStorage **按 origin
 * 隔离**，share 存的东西 blog 读不到，所以「在 share 上选了深色，翻到博客又
 * 变浅色」是必然的，不是 bug。只有 Domain=.wellorbetterai.com 的 cookie 能
 * 跨子域。博客那边（managed-blog-platform/packages/web/src/theme.ts）读的就
 * 是这个 cookie，而且是在服务端读、直接渲进 <html>。
 *
 * localStorage 仍然写 —— 但它的角色从「真相」降级成两件事：
 *   1. 迁移：老访客的选择存在 localStorage 里，cookie 还没有，不能让他们的
 *      选择在这次发布时被静默清空。
 *   2. 兜底：localhost / file:// 下 cookie 可能写不进去，本地调试不至于失效。
 * 读的时候 cookie 优先，因为只有它可能被别的子域更新过。
 *
 * ── 为什么 "system" 不能解析成具体值 ────────────────────────────────────────
 * 曾经的实现是 `dataset.theme = prefersDark ? "dark" : "light"`，即使访客
 * 从没点过切换。那等于把「跟随系统」变成「锁死在页面加载那一刻的系统值」：
 * 访客在页面开着的时候切了系统主题，页面不跟。而这套 token 明确写了属性没写
 * 才是跟随。所以 "system" 必须**删掉**属性，不是写一个猜出来的值。
 */

/** cookie 名，同时也是 localStorage 的 key。改名 = 所有访客的选择被清空一次。 */
export const THEME_KEY = "wb-theme";

/** 一年。明暗偏好不是会话级的东西。 */
const MAX_AGE_SECONDS = 31536000;

const APEX = "wellorbetterai.com";

export type ThemeChoice = "light" | "dark" | "system";

function normalize(value: string | null | undefined): ThemeChoice | undefined {
  return value === "light" || value === "dark" || value === "system" ? value : undefined;
}

/**
 * 从 `document.cookie` 那种 `a=1; b=2` 串里取出选择。
 *
 * 名字必须**整个**对上：用 includes / startsWith 的话 `my-wb-theme=dark` 会
 * 被当成我们的 cookie。
 */
export function parseThemeCookie(cookieString: string | null | undefined): ThemeChoice | undefined {
  if (!cookieString) return undefined;
  for (const pair of cookieString.split(";")) {
    const eq = pair.indexOf("=");
    if (eq < 0) continue;
    if (pair.slice(0, eq).trim() !== THEME_KEY) continue;
    return normalize(pair.slice(eq + 1).trim());
  }
  return undefined;
}

/**
 * 要写给 `document.cookie` 的那一行。纯函数，方便钉住 Domain / Secure 的判断。
 *
 * Domain 只在我们自己的域名下加 —— localhost 上加了浏览器会直接丢掉整条
 * cookie，本地就调不了。Secure 同理看协议。
 */
export function themeCookieString(choice: ThemeChoice, hostname: string, protocol: string): string {
  let cookie = `${THEME_KEY}=${choice}; Path=/; Max-Age=${MAX_AGE_SECONDS}; SameSite=Lax`;
  if (hostname === APEX || hostname.endsWith(`.${APEX}`)) cookie += `; Domain=.${APEX}`;
  if (protocol === "https:") cookie += "; Secure";
  return cookie;
}

/**
 * 读出当前选择：cookie 优先，然后 localStorage（迁移用），都没有就 "system"。
 *
 * cookie 优先是因为它是唯一可能被**别的子域**更新过的那份。share 每次写都会
 * 同时写两边，所以 localStorage 只会在「上次是在 blog 上改的」这种情况下过期，
 * 那正是 cookie 该赢的情况。
 */
export function readThemeChoice(): ThemeChoice {
  const fromCookie = typeof document === "undefined" ? undefined : parseThemeCookie(document.cookie);
  if (fromCookie !== undefined) return fromCookie;
  try {
    const stored = normalize(localStorage.getItem(THEME_KEY));
    if (stored !== undefined) return stored;
  } catch {
    /* storage 不可用（隐私模式等）—— 落到下面的默认值 */
  }
  return "system";
}

/** 写 cookie（跨子域）+ 镜像到 localStorage（迁移 / 兜底）。 */
export function writeThemeChoice(choice: ThemeChoice): void {
  try {
    document.cookie = themeCookieString(choice, location.hostname, location.protocol);
  } catch {
    /* 极少见（file:// 等）—— 下面的 localStorage 还能兜住本站 */
  }
  try {
    localStorage.setItem(THEME_KEY, choice);
  } catch {
    /* storage 不可用 —— 本次会话内主题仍然是对的 */
  }
}

/**
 * 把选择落到 `<html>` 上。"system" **删掉**属性 —— 见文件头那段。
 */
export function applyThemeChoice(choice: ThemeChoice): void {
  const root = document.documentElement;
  if (choice === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", choice);
}

/**
 * 当前实际显示的是明还是暗。给那种只有两态（太阳/月亮）的切换按钮用 —— 它得
 * 知道该画哪个图标，以及点下去要翻到哪一边。
 */
export function resolvedAppearance(choice: ThemeChoice): "light" | "dark" {
  if (choice !== "system") return choice;
  const prefersDark =
    typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches;
  return prefersDark ? "dark" : "light";
}
