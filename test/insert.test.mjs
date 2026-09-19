import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { bundleInsertLogic, launchBrowser, loadModule, openFixture } from './helpers.mjs';

let browser;
let bundle;

before(async () => {
  [browser, bundle] = await Promise.all([launchBrowser(), bundleInsertLogic()]);
});

after(async () => {
  await browser?.close();
});

/** 开一个 fixture 页面并注入被测代码 */
async function open(name) {
  const context = await browser.newContext();
  const page = await openFixture(context, name);
  await page.addScriptTag({ content: bundle });
  return { context, page };
}

describe('ChatGPT / ProseMirror contenteditable', () => {
  it('空输入框插入后 ProseMirror 的 document state 同步更新', async () => {
    const { context, page } = await open('chatgpt');
    const outcome = await page.evaluate(() => CPH.insertPrompt('帮我总结这段话'));
    // 分开一次 evaluate，给 ProseMirror 的 MutationObserver 留一个 tick 回读 DOM
    const doc = await page.evaluate(() => window.__docText());

    assert.equal(outcome, 'ok');
    assert.equal(doc, '帮我总结这段话');
    await context.close();
  });

  it('输入框已有内容时空一行追加在后面', async () => {
    const { context, page } = await open('chatgpt');
    await page.evaluate(() => CPH.insertPrompt('第一条'));
    const outcome = await page.evaluate(() => CPH.insertPrompt('第二条'));
    const doc = await page.evaluate(() => window.__docText());

    assert.equal(outcome, 'ok');
    assert.equal(doc, '第一条\n\n第二条');
    await context.close();
  });

  it('多行 prompt 的换行被保留（每行变成一个段落）', async () => {
    const { context, page } = await open('chatgpt');
    await page.evaluate(() => CPH.insertPrompt('第一行\n第二行\n第三行'));
    const doc = await page.evaluate(() => window.__docText());
    const html = await page.evaluate(() => window.__view.dom.innerHTML);

    assert.equal(doc, '第一行\n第二行\n第三行');
    assert.equal(html, '<p>第一行</p><p>第二行</p><p>第三行</p>');
    await context.close();
  });

  it('插入后输入框保持聚焦', async () => {
    const { context, page } = await open('chatgpt');
    await page.evaluate(() => CPH.insertPrompt('x'));
    const activeId = await page.evaluate(() => document.activeElement?.id);

    assert.equal(activeId, 'prompt-textarea');
    await context.close();
  });

  it('插入之后还能继续手动打字，光标停在末尾', async () => {
    const { context, page } = await open('chatgpt');
    await page.evaluate(() => CPH.insertPrompt('帮我总结'));
    await page.keyboard.type('这段话');
    await page.waitForTimeout(100);

    assert.equal(await page.evaluate(() => window.__docText()), '帮我总结这段话');
    await context.close();
  });
});

describe('千问 / React 受控 textarea', () => {
  it('插入后 React state 同步，而不是只改了 DOM 的 value', async () => {
    const { context, page } = await open('qwen');
    const outcome = await page.evaluate(() => CPH.insertPrompt('翻译成英文'));
    const { state, dom } = await page.evaluate(() => ({
      state: window.__reactValue(),
      dom: document.querySelector('#chat-input').value,
    }));

    assert.equal(outcome, 'ok');
    assert.equal(state, '翻译成英文');
    assert.equal(dom, state);
    await context.close();
  });

  it('输入框已有内容时空一行追加在后面', async () => {
    const { context, page } = await open('qwen');
    await page.evaluate(() => CPH.insertPrompt('翻译成英文'));
    await page.evaluate(() => CPH.insertPrompt('润色一下'));
    const state = await page.evaluate(() => window.__reactValue());

    assert.equal(state, '翻译成英文\n\n润色一下');
    await context.close();
  });

  it('多行 prompt 的换行被保留', async () => {
    const { context, page } = await open('qwen');
    await page.evaluate(() => CPH.insertPrompt('A\nB'));
    const state = await page.evaluate(() => window.__reactValue());

    assert.equal(state, 'A\nB');
    await context.close();
  });

  it('插入之后还能继续手动打字，受控组件的 state 跟着走', async () => {
    const { context, page } = await open('qwen');
    await page.evaluate(() => CPH.insertPrompt('翻译成英文'));
    await page.keyboard.type('：下面这段');
    await page.waitForTimeout(100);

    assert.equal(await page.evaluate(() => window.__reactValue()), '翻译成英文：下面这段');
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'chat-input');
    await context.close();
  });
});

describe('qianwen.com / Slate 编辑器', () => {
  // Slate 持有自己的文档模型并拿它校正 DOM。execCommand 会在 DOM 层面「成功」，
  // 但模型仍是空的，之后每次敲键都把 DOM 覆盖回去 —— 表现就是有光标却打不出字、
  // 插入的内容还会凭空消失。所以这里断言的一律是 Slate 的模型，不是 DOM 文本。
  it('插入后 Slate 的文档模型同步更新', async () => {
    const { context, page } = await open('qianwen');
    const outcome = await page.evaluate(() => CPH.insertPrompt('翻译成英文'));
    await page.waitForTimeout(150);

    assert.equal(outcome, 'ok');
    assert.equal(await page.evaluate(() => window.__slateText()), '翻译成英文');
    await context.close();
  });

  it('插入之后还能继续手动打字，内容不会丢', async () => {
    const { context, page } = await open('qianwen');
    await page.evaluate(() => CPH.insertPrompt('翻译成英文'));
    await page.waitForTimeout(150);
    await page.keyboard.type('：下面这段');
    await page.waitForTimeout(150);

    assert.equal(await page.evaluate(() => window.__slateText()), '翻译成英文：下面这段');
    await context.close();
  });

  it('输入框已有内容时空一行追加在后面', async () => {
    const { context, page } = await open('qianwen');
    await page.locator('[data-slate-editor]').click(); // 先聚焦，否则 keyboard.type 打不进编辑器
    await page.keyboard.type('先手打一句');
    await page.waitForTimeout(150);
    await page.evaluate(() => CPH.insertPrompt('润色一下'));
    await page.waitForTimeout(150);

    assert.equal(await page.evaluate(() => window.__slateText()), '先手打一句\n\n润色一下');
    await context.close();
  });

  it('prompt 末尾的换行会被去掉，光标必须落在可见位置', async () => {
    const { context, page } = await open('qianwen');
    await page.evaluate(() => CPH.insertPrompt('帮我总结这段话。\n\n'));
    await page.waitForTimeout(200);

    assert.equal(await page.evaluate(() => window.__slateText()), '帮我总结这段话。');

    // 末尾留着换行的话，光标会停在最后一个空行上，Chrome 不在那里画光标，
    // 空行还会把输入框撑出滚动条 —— 用户看到的就是「文字被截断、找不到光标」
    const caret = await page.evaluate(() => {
      const selection = window.getSelection();
      if (!selection?.rangeCount) return null;
      const rect = selection.getRangeAt(0).getBoundingClientRect();
      const box = document.querySelector('[data-slate-editor]').getBoundingClientRect();
      return {
        有效: rect.top > 0 || rect.height > 0,
        在编辑器内: rect.top >= box.top - 2 && rect.bottom <= box.bottom + 2,
      };
    });
    assert.deepEqual(caret, { 有效: true, 在编辑器内: true });
    await context.close();
  });

  it('命中的是 Slate 的可编辑元素', async () => {
    const { context, page } = await open('qianwen');
    await page.evaluate(() => CPH.insertPrompt('x'));
    const active = await page.evaluate(() => ({
      slate: document.activeElement?.hasAttribute('data-slate-editor'),
      editable: document.activeElement?.isContentEditable,
    }));

    assert.deepEqual(active, { slate: true, editable: true });
    await context.close();
  });
});

describe('找不到输入框时的行为', () => {
  const EMPTY_PAGE = '<!doctype html><html><body>没有输入框的页面</body></html>';

  it('页面上没有输入框 → 返回 no-input 而不是抛异常', async () => {
    const context = await browser.newContext();
    const page = await openFixture(context, 'chatgpt', { html: EMPTY_PAGE });
    await page.addScriptTag({ content: bundle });

    assert.equal(await page.evaluate(() => CPH.insertPrompt('x')), 'no-input');
    await context.close();
  });

  it('隐藏的 textarea 会被跳过', async () => {
    const context = await browser.newContext();
    const page = await openFixture(context, 'chatgpt', { html: EMPTY_PAGE });
    await page.addScriptTag({ content: bundle });

    const outcome = await page.evaluate(() => {
      const hidden = document.createElement('textarea');
      hidden.style.display = 'none';
      document.body.appendChild(hidden);
      return CPH.insertPrompt('x');
    });

    assert.equal(outcome, 'no-input');
    await context.close();
  });

  it('站点没有专属适配器时退回通用选择器', async () => {
    const context = await browser.newContext();
    const page = await openFixture(context, 'chatgpt', {
      html: '<!doctype html><html><body><textarea id="whatever"></textarea></body></html>',
    });
    await page.addScriptTag({ content: bundle });

    const outcome = await page.evaluate(() => CPH.insertPrompt('兜底'));
    const value = await page.evaluate(() => document.querySelector('#whatever').value);

    assert.equal(outcome, 'ok');
    assert.equal(value, '兜底');
    await context.close();
  });
});

describe('内置预设的内容约束', () => {
  it('没有一条以空白结尾 —— 尾部换行会让光标停在空行上、Chrome 不画光标', async () => {
    const { createBuiltinPrompts } = await loadModule('utils/builtin-prompts.ts');
    const offenders = createBuiltinPrompts()
      .filter((p) => p.content !== p.content.replace(/\s+$/, ''))
      .map((p) => p.title);

    assert.deepEqual(offenders, []);
  });

  it('每条都有标题和正文', async () => {
    const { createBuiltinPrompts } = await loadModule('utils/builtin-prompts.ts');
    for (const prompt of createBuiltinPrompts()) {
      assert.ok(prompt.title.trim(), `${prompt.id} 缺标题`);
      assert.ok(prompt.content.trim(), `${prompt.id} 缺正文`);
    }
  });
});
