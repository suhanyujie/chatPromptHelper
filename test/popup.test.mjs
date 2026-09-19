import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { extensionId, launchWithExtension, openFixture } from './helpers.mjs';

let ext;
let popupUrl;

before(async () => {
  ext = await launchWithExtension();
  popupUrl = `chrome-extension://${await extensionId(ext.context)}/popup.html`;
});

after(async () => {
  await ext?.close();
});

const ruleRow = (page, host) =>
  page.locator('.rule').filter({ has: page.locator('.rule-host', { hasText: host }) });

describe('设置页（popup）与域名白名单', () => {
  let chatPage;
  let options;

  it('设置页列出默认白名单，全部是内置且默认启用', async () => {
    chatPage = await openFixture(ext.context, 'chatgpt');
    await chatPage.locator('.cph-handle').waitFor({ timeout: 15000 });

    options = await ext.context.newPage();
    await options.goto(popupUrl);
    await options.locator('.rule').first().waitFor({ timeout: 10000 });

    const hosts = await options.locator('.rule-host').allTextContents();
    assert.deepEqual(hosts.sort(), [
      'chat.openai.com',
      'chatgpt.com',
      'qianwen.com',
      'qwen.ai',
      'tongyi.aliyun.com',
      'tongyi.com',
    ]);
    assert.equal(await options.locator('.rule input[type="checkbox"]:checked').count(), 6);
    assert.equal(await options.locator('.tag', { hasText: '内置' }).count(), 6);
  });

  it('关掉某个域名 → 已经打开的页面上面板立刻消失，不用刷新', async () => {
    await ruleRow(options, 'chatgpt.com').locator('input[type="checkbox"]').uncheck();

    await chatPage.locator('chat-prompt-helper').waitFor({ state: 'detached', timeout: 5000 });
    assert.equal(await chatPage.locator('.cph-handle').count(), 0);
  });

  it('重新打开 → 面板立刻回来', async () => {
    await ruleRow(options, 'chatgpt.com').locator('input[type="checkbox"]').check();

    await chatPage.locator('.cph-handle').waitFor({ timeout: 5000 });
    assert.equal(await chatPage.locator('.cph-handle').count(), 1);
  });

  it('关掉的站点在新开的页面上同样不显示面板', async () => {
    await ruleRow(options, 'chatgpt.com').locator('input[type="checkbox"]').uncheck();

    const fresh = await openFixture(ext.context, 'chatgpt');
    await fresh.waitForTimeout(800);
    assert.equal(await fresh.locator('chat-prompt-helper').count(), 0);
    await fresh.close();

    await ruleRow(options, 'chatgpt.com').locator('input[type="checkbox"]').check();
  });

  it('删除内置域名后不会复活', async () => {
    await ruleRow(options, 'tongyi.com').locator('.btn-danger').click();
    await options.waitForTimeout(300);
    assert.equal(await ruleRow(options, 'tongyi.com').count(), 0);

    await options.reload();
    await options.locator('.rule').first().waitFor({ timeout: 10000 });
    assert.equal(await ruleRow(options, 'tongyi.com').count(), 0);
    assert.equal(await options.locator('.rule').count(), 5);
  });

  it('域名格式不对时给出提示，且不会发起权限申请', async () => {
    await options.locator('.input').fill('这不是域名');
    await options.locator('.btn-primary').click();

    await options.locator('.msg-error').waitFor({ timeout: 3000 });
    assert.match(await options.locator('.msg-error').textContent(), /格式不对/);
    assert.equal(await options.locator('.rule').count(), 5, '不该新增任何条目');
  });

  it('重复添加已有域名时直接拒绝', async () => {
    await options.locator('.input').fill('https://www.qianwen.com/chat/abc');
    await options.locator('.btn-primary').click();

    await options.locator('.msg-error').waitFor({ timeout: 3000 });
    assert.match(await options.locator('.msg-error').textContent(), /已经在白名单里/);
    assert.equal(await options.locator('.rule').count(), 5);
  });

  it('添加域名是先落盘再申请权限，没拿到权限的条目也留在列表里并标为未授权', async () => {
    await options.locator('.input').fill('chat.deepseek.com');
    await options.locator('.btn-primary').click();

    const row = ruleRow(options, 'chat.deepseek.com');
    await row.locator('.tag-warn').waitFor({ timeout: 5000 });
    assert.match(await options.locator('.msg-ok').textContent(), /已添加/);

    // 在 popup 里，Chrome 的授权对话框会抢焦点导致 popup 关闭、页面被卸载，
    // 写在 request().then() 之后的代码根本跑不到。规则必须在发起申请之前就落盘，
    // 重新打开页面它应该还在。
    await options.reload();
    await options.locator('.rule').first().waitFor({ timeout: 10000 });
    assert.equal(await ruleRow(options, 'chat.deepseek.com').count(), 1);
  });

  it('白名单清空后面板在任何站点都不显示', async () => {
    for (const host of ['chatgpt.com', 'chat.openai.com', 'qianwen.com', 'qwen.ai', 'tongyi.aliyun.com', 'chat.deepseek.com']) {
      await ruleRow(options, host).locator('.btn-danger').click();
      await options.waitForTimeout(150);
    }
    assert.equal(await options.locator('.rule').count(), 0);

    await chatPage.locator('chat-prompt-helper').waitFor({ state: 'detached', timeout: 5000 });
    await chatPage.close();
    await options.close();
  });
});

describe('动态注册链路', () => {
  it('background 里 scripting / permissions 两个 API 都可用，未授权时注册表为空', async () => {
    const [worker] = ext.context.serviceWorkers();
    const result = await worker.evaluate(async () => ({
      // chrome.scripting 为 undefined 就说明 manifest 少了 scripting 权限
      registered: (await chrome.scripting.getRegisteredContentScripts()).length,
      granted: await chrome.permissions.contains({ origins: ['https://*.example.com/*'] }),
    }));

    assert.equal(result.granted, false, '没申请过的域名不该有权限');
    assert.equal(result.registered, 0, '没有授权域名时不该有动态注册的 content script');
  });
});
