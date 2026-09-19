import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';
import { chromium } from 'playwright';

export const ROOT = fileURLToPath(new URL('../', import.meta.url));
export const EXTENSION_DIR = path.join(ROOT, '.output', 'chrome-mv3');

/** 把一个源文件打成能直接塞进 <script> 的 IIFE */
async function bundleToIife(relPath, globalName) {
  const result = await esbuild.build({
    entryPoints: [path.join(ROOT, relPath)],
    bundle: true,
    format: 'iife',
    globalName,
    platform: 'browser',
    target: 'chrome120',
    define: { 'process.env.NODE_ENV': '"production"' },
    write: false,
    logLevel: 'warning',
  });
  return result.outputFiles[0].text;
}

/** 把被测的插入逻辑打包成页面里的全局 CPH */
export function bundleInsertLogic() {
  return bundleToIife('utils/insert-text.ts', 'CPH');
}

const FIXTURES = {
  chatgpt: {
    origin: 'https://chatgpt.com',
    body: '<form><div id="editor-host"></div></form>',
    entry: 'test/fixtures/chatgpt.js',
  },
  qwen: {
    origin: 'https://chat.qwen.ai',
    body: '<div id="root"></div>',
    entry: 'test/fixtures/qwen.js',
  },
  qianwen: {
    origin: 'https://www.qianwen.com',
    body: '<div id="root"></div>',
    entry: 'test/fixtures/qianwen.js',
  },
};

const htmlCache = new Map();

async function fixtureHtml(name) {
  if (!htmlCache.has(name)) {
    const { body, entry } = FIXTURES[name];
    const script = await bundleToIife(entry);
    htmlCache.set(
      name,
      `<!doctype html><html><head><meta charset="utf-8"><title>${name} fixture</title></head>` +
        `<body>${body}<script>${script}<\/script></body></html>`,
    );
  }
  return htmlCache.get(name);
}

export function fixtureOrigin(name) {
  return FIXTURES[name].origin;
}

/**
 * 打开一个伪装成真实站点的 fixture 页面。
 * 用路由拦截把页面挂到 chatgpt.com / chat.qwen.ai 下，location.hostname 才是真的，
 * 这样测到的是 utils/adapters.ts 里真正的站点选择器，而不是通用兜底。
 */
export async function openFixture(context, name, { html } = {}) {
  const { origin } = FIXTURES[name];
  const body = html ?? (await fixtureHtml(name));
  const page = await context.newPage();
  await page.route('**/*', (route) => {
    const url = route.request().url();
    if (url.startsWith(origin)) {
      return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body });
    }
    // 扩展自己要 fetch chrome-extension:// 下的 shadow root CSS，不能拦
    if (!/^https?:/i.test(url)) return route.continue();
    // fixture 是自足的，不该有任何外部 http 请求
    return route.abort();
  });
  await page.goto(`${origin}/`, { waitUntil: 'domcontentloaded' });
  if (html === undefined) {
    await page.waitForFunction(() => window.__ready === true, null, { timeout: 20000 });
  }
  return page;
}

/** 不装扩展的普通浏览器，用来单测插入逻辑 */
export function launchBrowser() {
  return chromium.launch();
}

/**
 * 装上构建产物的浏览器。
 * 必须 headed —— Chrome 137+ 移除了 --load-extension，只有 Playwright 自带的 Chromium
 * 还支持加载解压扩展，而且它在 headless 下不加载扩展。
 */
export async function launchWithExtension() {
  const userDataDir = await mkdtemp(path.join(tmpdir(), 'cph-profile-'));
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: [
      `--disable-extensions-except=${EXTENSION_DIR}`,
      `--load-extension=${EXTENSION_DIR}`,
    ],
  });
  return {
    context,
    async close() {
      await context.close();
      await rm(userDataDir, { recursive: true, force: true });
    },
  };
}

/**
 * 把一个纯 TS 模块打成 ESM 再 import 进来，让 Node 侧的测试能直接调它。
 * 走 data: URL，不落临时文件。只适用于不依赖 `#imports` 的模块。
 */
export async function loadModule(relPath) {
  const result = await esbuild.build({
    entryPoints: [path.join(ROOT, relPath)],
    bundle: true,
    format: 'esm',
    platform: 'neutral',
    write: false,
    logLevel: 'warning',
  });
  const base64 = Buffer.from(result.outputFiles[0].text).toString('base64');
  return import(`data:text/javascript;base64,${base64}`);
}

export const loadAdapters = () => loadModule('utils/adapters.ts');
export const loadSiteRules = () => loadModule('utils/site-rules.ts');

/** 从 background service worker 的 URL 里取扩展 id */
export async function extensionId(context) {
  const [worker] = context.serviceWorkers();
  const sw = worker ?? (await context.waitForEvent('serviceworker', { timeout: 15000 }));
  return new URL(sw.url()).host;
}
