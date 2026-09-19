import { findInputElement, getAdapter } from './adapters';

export type InsertOutcome = 'ok' | 'no-input' | 'failed';

function isTextarea(el: HTMLElement): el is HTMLTextAreaElement {
  return el instanceof HTMLTextAreaElement;
}

/**
 * 编辑器渲染在可编辑元素「内部」的占位提示。
 * Slate 就是这么干的，直接读 innerText 会把占位文案当成用户已输入的内容，
 * 于是空输入框也被判成「已有内容」，凭空多出两个空行。
 */
const PLACEHOLDER_SELECTOR =
  '[data-slate-placeholder], [data-placeholder], [class*="placeholder" i]';

function isPlaceholderNode(node: Node): boolean {
  return Boolean(node.parentElement?.closest(PLACEHOLDER_SELECTOR));
}

/** 输入框里是否已经有用户输入的内容，用来决定是「直接填入」还是「追加在后面」 */
function hasExistingText(el: HTMLElement): boolean {
  if (isTextarea(el)) return el.value.trim() !== '';

  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (!isPlaceholderNode(node) && (node.textContent ?? '').trim() !== '') return true;
  }
  return false;
}

/** 可编辑元素里最后一个真实文本节点（跳过占位提示） */
function lastTextNode(el: HTMLElement): Text | null {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let last: Text | null = null;
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    if (!isPlaceholderNode(node)) last = node;
  }
  return last;
}

function moveCaretToEnd(el: HTMLElement): void {
  if (isTextarea(el)) {
    const end = el.value.length;
    el.setSelectionRange(end, end);
    return;
  }

  const selection = window.getSelection();
  if (!selection) return;

  const range = document.createRange();
  const tail = lastTextNode(el);
  if (tail) {
    // 落在最后一个文本节点的末尾，而不是元素级的末尾 ——
    // 元素级位置会被 Slate 解析成覆盖整段的范围，插入时把原有内容整个替换掉
    range.setStart(tail, tail.length);
    range.collapse(true);
  } else {
    range.selectNodeContents(el);
    range.collapse(false);
  }
  selection.removeAllRanges();
  selection.addRange(range);
}

/**
 * contenteditable 的首选路径：派发一个合成的 beforeinput 事件，让框架编辑器自己去应用这次输入。
 *
 * 为什么需要它：Slate（qianwen.com 用的就是它）持有自己的文档模型并拿模型校正 DOM。
 * execCommand 会在 DOM 层面「成功」，但 Slate 的模型仍是空的，之后每次敲键它都把 DOM 覆盖回去 ——
 * 表现就是「有光标但打不出字」，而且插入的内容会凭空消失。
 *
 * 关键点是 getTargetRanges()：Slate 的 onDOMBeforeInput 靠它定位插入点，
 * 而合成事件的这个方法恒返回空数组，不补上的话它会直接放弃。
 *
 * 返回 defaultPrevented 作为「框架已接管」的信号：
 *   - Slate 会 preventDefault 并把内容写进自己的模型 → true
 *   - ProseMirror（ChatGPT）不处理合成的 insertText，也不 preventDefault → false，交给下面的 execCommand
 *   - 没有框架接管的裸 contenteditable → false，同样走 execCommand
 */
function insertViaBeforeInput(el: HTMLElement, text: string): boolean {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return false;

  try {
    const range = selection.getRangeAt(0);
    const targetRange = new StaticRange({
      startContainer: range.startContainer,
      startOffset: range.startOffset,
      endContainer: range.endContainer,
      endOffset: range.endOffset,
    });

    const event = new InputEvent('beforeinput', {
      inputType: 'insertText',
      data: text,
      bubbles: true,
      cancelable: true,
    });
    Object.defineProperty(event, 'getTargetRanges', { value: () => [targetRange] });

    el.dispatchEvent(event);
    return event.defaultPrevented;
  } catch {
    return false;
  }
}

/**
 * textarea 的主路径，也是 contenteditable 在没有框架接管时的路径。
 * execCommand 虽然标记了 deprecated，但它会派发真实的 beforeinput / input 事件，
 * ProseMirror（ChatGPT）和受控 React textarea 都能正常接收到并同步自己的状态。
 * 直接改 .value 或 .textContent 做不到这一点 —— 表现就是文字进去了但发送按钮不亮。
 */
function insertViaExecCommand(text: string): boolean {
  try {
    return document.execCommand('insertText', false, text);
  } catch {
    return false;
  }
}

/** 降级一：textarea 走原型上的原生 setter，再手动派发 input 事件让 React 感知 */
function insertViaNativeSetter(el: HTMLTextAreaElement, text: string): boolean {
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
  if (!setter) return false;
  const next = el.value + text;
  setter.call(el, next);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.setSelectionRange(next.length, next.length);
  return true;
}

/** 降级二：contenteditable 构造一个合成 paste 事件，编辑器一般都实现了粘贴处理 */
function insertViaPaste(el: HTMLElement, text: string): boolean {
  try {
    const data = new DataTransfer();
    data.setData('text/plain', text);
    el.dispatchEvent(
      new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }),
    );
    // 编辑器处理了 paste 会调 preventDefault（dispatchEvent 返回 false），
    // 没处理也可能只是不 preventDefault，两种情况区分不了，这里统一当作已尝试。
    return true;
  } catch {
    return false;
  }
}

/**
 * 把 prompt 填进当前页面的输入框。不发送。
 * 输入框已有内容时空一行追加在后面。
 */
export function insertPrompt(content: string): InsertOutcome {
  const el = findInputElement(getAdapter());
  if (!el) return 'no-input';

  // 去掉结尾的空白：prompt 末尾若留着换行，光标会停在最后一个空行上 ——
  // Chrome 不在那个位置画光标，输入框还会被空行撑出滚动条，
  // 用户看到的就是「文字被截断、找不到光标在哪」。
  const trimmed = content.replace(/\s+$/, '');
  if (!trimmed) return 'ok';

  const text = hasExistingText(el) ? `\n\n${trimmed}` : trimmed;

  el.focus();
  moveCaretToEnd(el);

  // contenteditable 先给框架编辑器一次自己接管的机会，它比 execCommand 更懂怎么改自己的模型
  if (!isTextarea(el) && insertViaBeforeInput(el, text)) return 'ok';

  if (insertViaExecCommand(text)) return 'ok';
  if (isTextarea(el)) return insertViaNativeSetter(el, text) ? 'ok' : 'failed';
  return insertViaPaste(el, text) ? 'ok' : 'failed';
}
