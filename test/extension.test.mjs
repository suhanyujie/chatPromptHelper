import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { launchWithExtension, openFixture } from './helpers.mjs';

let ext;

before(async () => {
  ext = await launchWithExtension();
});

after(async () => {
  await ext?.close();
});

/** 面板的展开状态是持久化的，用例之间会互相影响，所以不能假定当前是收起态 */
async function openPanel(page) {
  await page.locator('.cph-handle, .cph-panel').first().waitFor({ timeout: 15000 });
  if ((await page.locator('.cph-handle').count()) > 0) {
    await page.locator('.cph-handle').click();
  }
  await page.locator('.cph-panel').waitFor({ timeout: 5000 });
}

/** 取某个分区标题之后的第 n 个列表项（n 从 1 开始） */
function sectionItem(page, label, n) {
  return page
    .locator('.cph-section-label', { hasText: label })
    .locator(`xpath=following-sibling::div[contains(@class,"cph-item")][${n}]`);
}

/**
 * 这一组是有先后依赖的一条完整用户路径（装扩展 → 用 → 改 → 重开），
 * 共用同一个浏览器 profile，所以刻意按顺序断言，不拆成互相独立的用例。
 */
describe('ChatGPT 站点上的完整流程', () => {
  let page;

  it('扩展注入 shadow host，默认收起并把手柄贴在右边缘', async () => {
    page = await openFixture(ext.context, 'chatgpt');

    assert.equal(await page.locator('chat-prompt-helper').count(), 1);
    const handle = page.locator('.cph-handle');
    await handle.waitFor({ timeout: 15000 });
    assert.equal((await handle.textContent())?.trim(), 'Prompt');

    const box = await handle.boundingBox();
    const viewportWidth = await page.evaluate(() => window.innerWidth);
    assert.ok(box && Math.abs(box.x + box.width - viewportWidth) < 2,
      `手柄右边缘 ${box?.x + box?.width} 应贴合视口宽度 ${viewportWidth}`);
  });

  it('点手柄展开，内置预设已写入并渲染，初始没有「最近使用」', async () => {
    await page.locator('.cph-handle').click();
    await page.locator('.cph-panel').waitFor({ timeout: 5000 });

    assert.equal(await page.locator('.cph-header-title').textContent(), '常用 Prompt');
    assert.equal(await page.locator('.cph-panel .cph-item').count(), 15);
    assert.equal(await page.locator('.cph-section-label', { hasText: '最近使用' }).count(), 0);
  });

  it('点击 prompt → 内容进入 ProseMirror 的 document state', async () => {
    await page.locator('.cph-item-main').first().click();
    await page.waitForTimeout(200);

    const doc = await page.evaluate(() => window.__docText());
    assert.ok(doc.startsWith('把下面的内容翻译成简体中文'), `doc=${JSON.stringify(doc.slice(0, 40))}`);
    // 文档非空，在真实站点上即对应发送按钮变为可用
    assert.ok(await page.evaluate(() => window.__view.state.doc.content.size > 2));
  });

  it('「最近使用」区域出现，内容是刚点的那条', async () => {
    await page.locator('.cph-section-label', { hasText: '最近使用' }).waitFor({ timeout: 5000 });

    const recentFirst = await sectionItem(page, '最近使用', 1).locator('.cph-item-main').textContent();
    assert.equal(recentFirst, '翻译成中文');
  });

  it('再点一条 → 空一行追加，原内容保留；最近使用按 MRU 重排', async () => {
    const second = sectionItem(page, '全部', 2).locator('.cph-item-main');
    const secondTitle = await second.textContent();
    await second.click();
    await page.waitForTimeout(200);

    const doc = await page.evaluate(() => window.__docText());
    assert.ok(doc.includes('把下面的内容翻译成简体中文'), '原有内容应保留');
    assert.ok(doc.includes('\n\n'), '两条之间应空一行');
    assert.ok(doc.includes('地道的英文'), '新内容应被追加');

    const recentFirst = await sectionItem(page, '最近使用', 1).locator('.cph-item-main').textContent();
    assert.equal(recentFirst, secondTitle, '最新用过的应排在最前');
  });

  it('新增 prompt：标题或正文为空时保存禁用，保存后出现在列表最前', async () => {
    await page.locator('.cph-add-btn').click();
    await page.locator('.cph-editor').waitFor({ timeout: 5000 });

    const save = page.locator('.cph-btn-primary');
    assert.equal(await save.isDisabled(), true);

    await page.locator('.cph-input').fill('我的自定义');
    await page.locator('.cph-textarea').fill('自定义正文内容');
    assert.equal(await save.isEnabled(), true);

    await save.click();
    await page.waitForTimeout(300);
    const first = await sectionItem(page, '全部', 1).locator('.cph-item-main').textContent();
    assert.equal(first, '我的自定义');
  });

  it('编辑 prompt：改完之后插入的是新内容', async () => {
    const item = page.locator('.cph-item', {
      has: page.locator('.cph-item-main', { hasText: '我的自定义' }),
    }).first();
    await item.hover();
    await item.locator('.cph-icon-btn[title="编辑"]').click();
    await page.locator('.cph-editor').waitFor({ timeout: 5000 });

    await page.locator('.cph-textarea').fill('改过之后的正文');
    await page.locator('.cph-btn-primary').click();
    await page.waitForTimeout(300);

    // 清空编辑器再插入，验证拿到的是新正文
    await page.evaluate(() => {
      const { state } = window.__view;
      window.__view.dispatch(state.tr.delete(0, state.doc.content.size));
    });
    await page.locator('.cph-item-main', { hasText: '我的自定义' }).first().click();
    await page.waitForTimeout(300);

    assert.equal(await page.evaluate(() => window.__docText()), '改过之后的正文');
  });

  it('面板标题栏的齿轮会在新标签页打开设置页', async () => {
    const [settings] = await Promise.all([
      ext.context.waitForEvent('page', { timeout: 10000 }),
      page.locator('.cph-icon-btn[title="设置"]').click(),
    ]);
    await settings.waitForLoadState('domcontentloaded');
    assert.match(settings.url(), /\/popup\.html$/);
    await settings.locator('.rule').first().waitFor({ timeout: 10000 });
    await settings.close();
  });

  it('新开页面时展开状态、新增的 prompt 和最近使用都还在', async () => {
    const page2 = await openFixture(ext.context, 'chatgpt');
    await page2.locator('.cph-panel').waitFor({ timeout: 15000 });

    assert.ok(await page2.locator('.cph-item-main', { hasText: '我的自定义' }).count() > 0);
    assert.equal(await page2.locator('.cph-section-label', { hasText: '最近使用' }).count(), 1);

    // 顺便验证多标签页同步：在新页面里加一条，旧页面应自动出现
    await page2.locator('.cph-add-btn').click();
    await page2.locator('.cph-input').fill('跨标签页测试');
    await page2.locator('.cph-textarea').fill('内容');
    await page2.locator('.cph-btn-primary').click();

    await page.locator('.cph-item-main', { hasText: '跨标签页测试' })
      .first().waitFor({ timeout: 5000 });
    await page2.close();
  });

  it('删除内置 prompt 后，重开页面不会复活（用 init 而非 fallback 的效果）', async () => {
    const target = page.locator('.cph-item', {
      has: page.locator('.cph-item-main', { hasText: '写 SQL' }),
    }).first();
    await target.hover();
    await target.locator('.cph-icon-btn[title="删除"]').click();
    // 删除是两步确认，防误触
    await target.locator('.cph-icon-btn[title="确认删除"]').click();
    await page.waitForTimeout(300);
    assert.equal(await page.locator('.cph-item-main', { hasText: '写 SQL' }).count(), 0);

    const page3 = await openFixture(ext.context, 'chatgpt');
    await page3.locator('.cph-panel').waitFor({ timeout: 15000 });
    assert.equal(await page3.locator('.cph-item-main', { hasText: '写 SQL' }).count(), 0);
    await page3.close();
  });

  it('收起状态同样跨页面保持，且宿主页面没被撑出横向滚动条', async () => {
    await page.locator('.cph-icon-btn[title="收起"]').click();
    await page.locator('.cph-handle').waitFor({ timeout: 5000 });

    const page4 = await openFixture(ext.context, 'chatgpt');
    await page4.locator('.cph-handle').waitFor({ timeout: 15000 });
    assert.equal(await page4.locator('.cph-panel').count(), 0);

    const noOverflow = await page4.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    );
    assert.ok(noOverflow, '固定定位的面板不应把宿主页面撑宽');
    await page4.close();
    await page.close();
  });
});

describe('qianwen.com（Slate 编辑器）', () => {
  it('面板出现，点击 prompt 后 Slate 的文档模型同步且能继续打字', async () => {
    const page = await openFixture(ext.context, 'qianwen');
    assert.equal(await page.locator('chat-prompt-helper').count(), 1);

    await openPanel(page);
    await page.locator('.cph-item-main', { hasText: '翻译成英文' }).first().click();
    await page.waitForTimeout(300);

    const inserted = await page.evaluate(() => window.__slateText());
    assert.ok(inserted.startsWith('把下面的内容翻译成地道的英文'), `model=${JSON.stringify(inserted.slice(0, 24))}`);

    // 用户报的就是这一步：插入之后敲键盘没反应、内容还会丢
    await page.keyboard.type('测试');
    await page.waitForTimeout(300);
    assert.equal(await page.evaluate(() => window.__slateText()), `${inserted}测试`);
    await page.close();
  });
});

describe('千问站点', () => {
  it('同样注入面板，点击 prompt 后 React state 同步且输入框保持聚焦', async () => {
    const page = await openFixture(ext.context, 'qwen');
    assert.equal(await page.locator('chat-prompt-helper').count(), 1);

    await openPanel(page);
    await page.locator('.cph-item-main', { hasText: '翻译成英文' }).first().click();
    await page.waitForTimeout(300);

    const state = await page.evaluate(() => window.__reactValue());
    assert.ok(state.startsWith('把下面的内容翻译成地道的英文'), `state=${JSON.stringify(state.slice(0, 24))}`);
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'chat-input');
    await page.close();
  });
});
