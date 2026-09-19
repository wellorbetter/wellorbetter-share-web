/**
 * 线上验收：跨子域的明暗选择。
 *
 * 手动跑，不进 CI —— 它打的是真线上（share / blog / 落地页三个 origin）。
 * 每次发布跟主题有关的改动之后跑一遍：
 *
 *     npm run verify:live-theme
 *
 * ── 为什么非得用真浏览器 ───────────────────────────────────────────────────
 * 这套东西的核心是一条 `Domain=.wellorbetterai.com` 的 cookie。cookie 的作用域
 * 是**浏览器**的行为，不是页面的行为：
 *   - 单测能证 cookie 串写对了，证不了浏览器真的跨 origin 带过去；
 *   - `vite preview` 是同源的，跨子域这一跳根本不存在；
 *   - `curl -H "Cookie: …"` 是我们自己把 cookie 塞进去的，等于假设了结论。
 * 所以这里开一个带 cookie jar 的 Chrome，点页面上真的那个按钮，再跨 origin 跳。
 *
 * 用 CDP 而不是 playwright：这个仓库没装 playwright，而 Node 自带 WebSocket，
 * speak CDP 一共就下面这点代码，不值得为它加一个几百兆的依赖。
 */
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CHROME =
  process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = Number(process.env.CDP_PORT ?? 9333);
const SHARE = "https://share.wellorbetterai.com/";
const BLOG = "https://blog.wellorbetterai.com/";
const LANDING = "https://wellorbetterai.com/";
/** 传 --shots=<dir> 就顺手存截图，默认不存。 */
const SHOT_DIR = process.argv.find((a) => a.startsWith("--shots="))?.slice(8);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── CDP 客户端 ────────────────────────────────────────────────────────────────

class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.waiters = [];
    ws.addEventListener("message", (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id !== undefined) {
        const p = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (!p) return;
        if (msg.error) p.reject(new Error(JSON.stringify(msg.error)));
        else p.resolve(msg.result);
        return;
      }
      for (const w of [...this.waiters]) {
        if (w.method === msg.method && (!w.sessionId || w.sessionId === msg.sessionId)) {
          this.waiters.splice(this.waiters.indexOf(w), 1);
          w.resolve(msg.params);
        }
      }
    });
  }

  send(method, params = {}, sessionId) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
  }

  once(method, sessionId, timeoutMs = 45000) {
    return new Promise((resolve, reject) => {
      const w = { method, sessionId, resolve };
      this.waiters.push(w);
      setTimeout(() => {
        const i = this.waiters.indexOf(w);
        if (i >= 0) {
          this.waiters.splice(i, 1);
          reject(new Error(`等 ${method} 超时`));
        }
      }, timeoutMs);
    });
  }
}

async function browserWsUrl() {
  for (let i = 0; i < 80; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (r.ok) return (await r.json()).webSocketDebuggerUrl;
    } catch {
      /* 端口还没开 */
    }
    await sleep(250);
  }
  throw new Error(`Chrome 的调试端口 ${PORT} 没起来（CHROME_PATH 对吗？）`);
}

// ── 断言 ──────────────────────────────────────────────────────────────────────

let failures = 0;
let checks = 0;

function check(label, actual, expected) {
  checks++;
  const ok = actual === expected;
  if (!ok) failures++;
  console.log(`  ${ok ? "✓" : "✗"} ${label}: ${actual}${ok ? "" : `  ← 期望 ${expected}`}`);
}

/** 深浅得从**算出来的背景色**上看。只看属性的话，属性对、调色板没动也算过。 */
function appearanceOf(bodyBg) {
  const lightness = /oklch\(\s*([\d.]+)/.exec(bodyBg);
  if (lightness) return Number(lightness[1]) < 0.5 ? "dark" : "light";
  const rgb = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(bodyBg);
  if (rgb) return (Number(rgb[1]) + Number(rgb[2]) + Number(rgb[3])) / 3 < 128 ? "dark" : "light";
  return `无法判断(${bodyBg})`;
}

// ── 页面探针 ──────────────────────────────────────────────────────────────────

/**
 * 一次问清楚：<html> 上的属性、cookie、以及两个站各自控件显示的当前项。
 * 控件的当前项很关键 —— 它证明**页面自己**也读到了同一个选择，而不只是
 * 属性被写对了。博客那个 data-choice 是服务端渲染出来的。
 */
const PROBE = `(() => {
  const el = document.documentElement;
  const seg = [...document.querySelectorAll('[role="radiogroup"][aria-label="主题"] button')]
    .find((b) => b.getAttribute("aria-checked") === "true");
  const blogBtn = document.getElementById("theme-toggle");
  return {
    attr: el.hasAttribute("data-theme") ? el.getAttribute("data-theme") : "(无属性)",
    cookie: /wb-theme=([^;]*)/.exec(document.cookie)?.[1] ?? "(无 cookie)",
    shareSegment: seg ? seg.textContent.trim() : null,
    blogChoice: blogBtn ? blogBtn.getAttribute("data-choice") : null,
    bodyBg: getComputedStyle(document.body).backgroundColor,
  };
})()`;

// ── 跑 ────────────────────────────────────────────────────────────────────────

const profile = mkdtempSync(join(tmpdir(), "wb-live-theme-"));
const chrome = spawn(
  CHROME,
  [
    "--headless=new",
    `--remote-debugging-port=${PORT}`,
    // 持久 profile 才有 cookie jar。注意这个参数在一次性 --screenshot 模式下会卡死，
    // 但 --headless=new + 调试端口下是正常的，而且是这个脚本成立的前提。
    `--user-data-dir=${profile}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-gpu",
    "--hide-scrollbars",
    "--window-size=1280,900",
    "about:blank",
  ],
  { stdio: "ignore" },
);

let cdp;
let session;

async function go(url) {
  const loaded = cdp.once("Page.loadEventFired", session);
  await cdp.send("Page.navigate", { url }, session);
  await loaded;
  await sleep(1200); // 等 React 挂上并跑完 effect
}

async function evaluate(expression) {
  const r = await cdp.send(
    "Runtime.evaluate",
    { expression, returnByValue: true, awaitPromise: true },
    session,
  );
  if (r.exceptionDetails) throw new Error(`页面里报错: ${JSON.stringify(r.exceptionDetails)}`);
  return r.result.value;
}

const probe = () => evaluate(PROBE);

async function shot(name) {
  if (!SHOT_DIR) return;
  const r = await cdp.send("Page.captureScreenshot", { format: "png" }, session);
  const path = join(SHOT_DIR, name);
  writeFileSync(path, Buffer.from(r.data, "base64"));
  console.log(`    [截图] ${path}`);
}

/** 点 share 的分段控件。返回点到了没有。 */
const clickShare = (label) => `(() => {
  const b = [...document.querySelectorAll('[role="radiogroup"][aria-label="主题"] button')]
    .find((x) => x.textContent.trim() === ${JSON.stringify(label)});
  if (!b) return "找不到按钮";
  b.click();
  return "clicked";
})()`;

/** 博客的按钮是循环的（system → light → dark），点到想要的那一档。 */
const clickBlogUntil = (want) => `(() => {
  const b = document.getElementById("theme-toggle");
  if (!b) return "找不到 #theme-toggle";
  for (let i = 0; i < 4 && b.getAttribute("data-choice") !== ${JSON.stringify(want)}; i++) b.click();
  return b.getAttribute("data-choice");
})()`;

/** 落地页是两态按钮，没有文字，按 aria-label / title 找。 */
const CLICK_LANDING = `(() => {
  const b = [...document.querySelectorAll("button")].find((x) =>
    /主题|明暗|深色|浅色|theme|dark|light/i.test(
      (x.getAttribute("aria-label") || "") + (x.title || "") + (x.textContent || ""),
    ),
  );
  if (!b) return "找不到主题按钮";
  b.click();
  return "clicked";
})()`;

try {
  const ws = new WebSocket(await browserWsUrl());
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve);
    ws.addEventListener("error", () => reject(new Error("连不上 CDP")));
  });
  cdp = new Cdp(ws);

  const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
  session = (await cdp.send("Target.attachToTarget", { targetId, flatten: true })).sessionId;
  await cdp.send("Page.enable", {}, session);
  await cdp.send("Runtime.enable", {}, session);

  console.log("\n① 全新 profile 打开 share —— 没选过就该是「跟随系统」");
  await go(SHARE);
  let s = await probe();
  check("没有 cookie", s.cookie, "(无 cookie)");
  check("没有 data-theme 属性", s.attr, "(无属性)");
  check("控件显示", s.shareSegment, "系统");

  console.log("\n② 在 share 上点真的那个「深色」");
  check("点到了", await evaluate(clickShare("深色")), "clicked");
  await sleep(600);
  s = await probe();
  check("cookie 写了", s.cookie, "dark");
  check("属性写了", s.attr, "dark");
  check("控件跟上", s.shareSegment, "深色");
  check("调色板真的变了", appearanceOf(s.bodyBg), "dark");
  await shot("live-share-dark.png");

  console.log("\n③ share → blog：同一个浏览器换 origin，服务端读 cookie 渲染");
  await go(BLOG);
  s = await probe();
  check("cookie 跨过来了", s.cookie, "dark");
  check("服务端渲染的属性", s.attr, "dark");
  check("服务端渲染的控件状态", s.blogChoice, "dark");
  check("调色板", appearanceOf(s.bodyBg), "dark");
  await shot("live-blog-dark.png");

  console.log("\n④ blog → share 反向：在博客上切回「跟随系统」");
  check("点到 system", await evaluate(clickBlogUntil("system")), "system");
  await sleep(400);
  s = await probe();
  check("博客自己删掉了属性", s.attr, "(无属性)");
  await go(SHARE);
  s = await probe();
  check("share 收到了", s.cookie, "system");
  check("share 也没有属性 —— system 不能写成具体值", s.attr, "(无属性)");
  check("share 控件显示", s.shareSegment, "系统");

  console.log("\n⑤ blog → 落地页：落地页读同一个 cookie");
  await go(BLOG);
  check("先在博客上点到 dark", await evaluate(clickBlogUntil("dark")), "dark");
  await go(LANDING);
  s = await probe();
  check("落地页 cookie", s.cookie, "dark");
  check("落地页属性", s.attr, "dark");
  check("落地页调色板", appearanceOf(s.bodyBg), "dark");
  await shot("live-landing-dark.png");

  console.log("\n⑥ 落地页 → blog：落地页切浅色，博客跟随");
  check("点到了", await evaluate(CLICK_LANDING), "clicked");
  await sleep(500);
  s = await probe();
  check("落地页写了 light", s.cookie, "light");
  check("落地页调色板", appearanceOf(s.bodyBg), "light");
  await shot("live-landing-light.png");
  await go(BLOG);
  s = await probe();
  check("博客跟随", s.attr, "light");
  check("博客控件", s.blogChoice, "light");
  check("博客调色板", appearanceOf(s.bodyBg), "light");
  await shot("live-blog-light.png");
} catch (err) {
  failures++;
  console.error(`\n跑挂了: ${err.message}`);
} finally {
  chrome.kill("SIGKILL");
}

console.log(
  failures === 0
    ? `\n${checks} 项全过：一条 cookie 管住了 share / blog / 落地页三个 origin。\n`
    : `\n${checks} 项里 ${failures} 项没过。\n`,
);
process.exit(failures === 0 ? 0 : 1);
