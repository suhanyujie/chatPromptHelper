export interface SiteAdapter {
  id: string;
  /** 主机名，精确匹配或匹配其子域 */
  hosts: string[];
  /**
   * 输入框选择器，按顺序尝试，取第一个命中且可见的元素。
   * 优先写 id / 语义属性，尽量避开构建产物里的哈希类名（那些每次发版都会变）。
   */
  inputSelectors: string[];
}

/**
 * 所有站点共用的兜底选择器。放在每个适配器的专属选择器之后，
 * 站点改版导致专属选择器失效时还能靠它撑住。
 *
 * 面板自己的 textarea 在 shadow root 里，querySelector 不会穿透 shadow 边界，
 * 所以这里不会误选到我们自己的编辑框。
 */
const GENERIC_FALLBACKS = [
  'form [contenteditable="true"]',
  'form textarea:not([readonly]):not([disabled])',
  'main [contenteditable="true"]',
  'main textarea:not([readonly]):not([disabled])',
  '[contenteditable="true"]',
  'textarea:not([readonly]):not([disabled])',
];

export const ADAPTERS: SiteAdapter[] = [
  {
    id: 'chatgpt',
    hosts: ['chatgpt.com', 'chat.openai.com'],
    inputSelectors: [
      // ProseMirror 的 contenteditable div。id 沿用了很久，是最稳的一个。
      '#prompt-textarea',
      'div.ProseMirror[contenteditable="true"]',
      '[data-testid="prompt-textarea"]',
      // 更早期版本用的是真 textarea
      'textarea[data-id="root"]',
      ...GENERIC_FALLBACKS,
    ],
  },
  {
    id: 'qwen',
    // 千问换过域名，几套都留着：qianwen.com 是目前的主域名
    hosts: ['qianwen.com', 'chat.qwen.ai', 'qwen.ai', 'tongyi.com', 'tongyi.aliyun.com'],
    inputSelectors: [
      // qianwen.com 的输入框是 Slate 编辑器（实测其构建产物里有 data-slate-editor）
      '[data-slate-editor="true"]',
      '[data-slate-editor]',
      'textarea#chat-input',
      'textarea[id*="chat-input"]',
      'textarea[class*="chat-input"]',
      // 通义早期页面的输入区
      '.chat-input-wrapper textarea',
      ...GENERIC_FALLBACKS,
    ],
  },
];

function hostMatches(hostname: string, host: string): boolean {
  return hostname === host || hostname.endsWith(`.${host}`);
}

export function getAdapter(hostname: string = location.hostname): SiteAdapter | undefined {
  return ADAPTERS.find((a) => a.hosts.some((h) => hostMatches(hostname, h)));
}

/** 元素是否真的显示在页面上。不用 offsetParent —— position:fixed 的元素它恒为 null。 */
function isVisible(el: Element): boolean {
  if (!el.isConnected) return false;
  if (el.getClientRects().length === 0) return false;
  const style = getComputedStyle(el);
  return style.visibility !== 'hidden' && style.display !== 'none';
}

/**
 * 找到当前页面的输入框。
 * 必须在每次点击时现查，不能缓存 —— 这些站点都是 SPA，切换会话会重建输入框 DOM。
 */
export function findInputElement(adapter: SiteAdapter | undefined): HTMLElement | null {
  const selectors = adapter?.inputSelectors ?? GENERIC_FALLBACKS;
  for (const selector of selectors) {
    let candidates: NodeListOf<Element>;
    try {
      candidates = document.querySelectorAll(selector);
    } catch {
      continue; // 选择器写错了不要整条链挂掉
    }
    for (const el of candidates) {
      if (el instanceof HTMLElement && isVisible(el)) return el;
    }
  }
  return null;
}
