import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { before, describe, it } from 'node:test';
import { EXTENSION_DIR, loadAdapters } from './helpers.mjs';

let ADAPTERS;
let getAdapter;
let manifest;
let matches;

before(async () => {
  ({ ADAPTERS, getAdapter } = await loadAdapters());
  // 需要先 wxt build —— matches 是构建期从 content.tsx 提取到 manifest 里的
  manifest = JSON.parse(await readFile(path.join(EXTENSION_DIR, 'manifest.json'), 'utf8'));
  // 现在有两份 content script：isolated world 的面板 UI 和 MAIN world 的插入器
  matches = [...new Set(manifest.content_scripts.flatMap((cs) => cs.matches))];
});

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** 按 Chrome 的 match pattern 语义转成正则。注意 `*.example.com` 也匹配裸的 example.com */
function patternToRegExp(pattern) {
  const parsed = /^(\*|https?):\/\/([^/]+)(\/.*)$/.exec(pattern);
  assert.ok(parsed, `无法解析 match pattern: ${pattern}`);
  const [, scheme, host, pathname] = parsed;
  const schemeRe = scheme === '*' ? 'https?' : scheme;
  const hostRe =
    host === '*'
      ? '[^/]+'
      : host.startsWith('*.')
        ? `(?:[^/]+\\.)?${escapeRe(host.slice(2))}`
        : escapeRe(host);
  const pathRe = pathname.split('*').map(escapeRe).join('.*');
  return new RegExp(`^${schemeRe}://${hostRe}${pathRe}$`);
}

const injectsInto = (url) => matches.some((p) => patternToRegExp(p).test(url));

describe('manifest 的 matches 与 adapters 的 hosts 不能漂移', () => {
  it('适配器认识的每个 host，manifest 都会在那里注入 content script', () => {
    for (const adapter of ADAPTERS) {
      for (const host of adapter.hosts) {
        // 适配器用的是后缀匹配（host 本身或它的子域），两种都得能注入
        assert.ok(injectsInto(`https://${host}/chat/abc`),
          `适配器 ${adapter.id} 声明了 ${host}，但 manifest 不会注入到 https://${host}/`);
        assert.ok(injectsInto(`https://www.${host}/chat/abc`),
          `适配器 ${adapter.id} 声明了 ${host}，但 manifest 不会注入到它的子域 www.${host}`);
      }
    }
  });

  it('manifest 注入的每个站点都有适配器认领', () => {
    for (const pattern of matches) {
      const host = /^https?:\/\/([^/]+)/.exec(pattern)[1];
      const sample = host.startsWith('*.') ? `sub.${host.slice(2)}` : host;
      assert.ok(getAdapter(sample),
        `manifest 会注入到 ${pattern}，但 utils/adapters.ts 里没有对应的适配器`);
    }
  });

  it('千问的新域名 qianwen.com 已覆盖', () => {
    // 这条是回归用例：最初漏了这个域名，面板在 www.qianwen.com 上完全不出现
    assert.ok(injectsInto('https://www.qianwen.com/chat/9cb9e79a5ffc432eb262ba57033ab173?pos=1'));
    assert.equal(getAdapter('www.qianwen.com')?.id, 'qwen');
  });

  it('不该注入到无关站点', () => {
    for (const url of ['https://example.com/', 'https://google.com/search', 'https://notqwen.ai/']) {
      assert.equal(injectsInto(url), false, `不应注入到 ${url}`);
    }
  });
});

describe('两份 content script 的注入范围必须一致', () => {
  it('面板 UI 在 isolated world，插入器在 MAIN world', () => {
    const worlds = manifest.content_scripts.map((cs) => cs.world ?? 'ISOLATED');
    assert.deepEqual(worlds.sort(), ['ISOLATED', 'MAIN']);

    const main = manifest.content_scripts.find((cs) => cs.world === 'MAIN');
    assert.deepEqual(main.js, ['content-scripts/inserter.js']);
  });

  it('两份脚本覆盖的站点完全相同 —— 少一份就会退化成插不进 Slate 编辑器', () => {
    const [a, b] = manifest.content_scripts.map((cs) => [...cs.matches].sort());
    assert.deepEqual(a, b);
  });
});

describe('manifest 的入口与权限', () => {
  it('工具栏图标配的是 popup，没有独立的 options 页', () => {
    assert.equal(manifest.action?.default_popup, 'popup.html');
    assert.equal(manifest.options_ui, undefined);
  });

  it('安装时只要 storage 和 scripting，站点权限按需申请', () => {
    assert.deepEqual([...manifest.permissions].sort(), ['scripting', 'storage']);
    assert.deepEqual(manifest.optional_host_permissions, ['https://*/*']);
    // 安装时就拿「所有网站」权限是明确不要的
    assert.equal(manifest.host_permissions, undefined);
  });
});

describe('图标', () => {
  it('manifest 声明的每个尺寸都有对应文件，且实际像素与声明一致', async () => {
    const sizes = Object.keys(manifest.icons ?? {});
    assert.deepEqual(sizes.map(Number).sort((a, b) => a - b), [16, 32, 48, 96, 128]);

    for (const [size, file] of Object.entries(manifest.icons)) {
      const png = await readFile(path.join(EXTENSION_DIR, file));
      // PNG 的 IHDR 块：宽高分别在第 16 和第 20 字节
      assert.equal(png.readUInt32BE(16), Number(size), `${file} 的宽度应为 ${size}`);
      assert.equal(png.readUInt32BE(20), Number(size), `${file} 的高度应为 ${size}`);
    }
  });
});
