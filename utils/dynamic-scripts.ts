import { browser } from '#imports';
import { originPattern, type SiteRule } from './site-rules';

const SCRIPT_ID_PREFIX = 'cph-site-';

/**
 * 每个站点要注册两份：isolated world 的面板 UI，和 MAIN world 的插入器。
 * 后者必须跑在页面自己的 JS 世界里，原因见 utils/insert-bridge.ts。
 * 构建产物里的路径 dev 和 prod 一致。
 */
const SCRIPT_PARTS = [
  { suffix: 'ui', js: 'content-scripts/content.js', world: 'ISOLATED' as const },
  { suffix: 'main', js: 'content-scripts/inserter.js', world: 'MAIN' as const },
];

export const scriptIdsFor = (host: string) =>
  SCRIPT_PARTS.map((part) => `${SCRIPT_ID_PREFIX}${host}-${part.suffix}`);

export function hasHostPermission(host: string): Promise<boolean> {
  return browser.permissions.contains({ origins: [originPattern(host)] });
}

/**
 * 让动态注册的 content script 与白名单保持一致。
 * 只处理非内置的条目 —— 内置站点由 manifest 静态注入，不归这里管。
 * 幂等，可以随便重复调用。
 */
export async function reconcileDynamicScripts(rules: SiteRule[]): Promise<void> {
  const wanted: SiteRule[] = [];
  for (const rule of rules) {
    if (rule.builtin || !rule.enabled) continue;
    // 权限可能被用户在 chrome://extensions 里单独撤销，每次都得实际查一下
    if (await hasHostPermission(rule.host)) wanted.push(rule);
  }

  const registered = await browser.scripting.getRegisteredContentScripts();
  const registeredIds = new Set(
    registered.map((script) => script.id).filter((id) => id.startsWith(SCRIPT_ID_PREFIX)),
  );
  const wantedIds = new Set(wanted.flatMap((rule) => scriptIdsFor(rule.host)));

  const stale = [...registeredIds].filter((id) => !wantedIds.has(id));
  if (stale.length > 0) {
    await browser.scripting.unregisterContentScripts({ ids: stale });
  }

  const missing = wanted.flatMap((rule) =>
    SCRIPT_PARTS.map((part) => ({
      id: `${SCRIPT_ID_PREFIX}${rule.host}-${part.suffix}`,
      matches: [originPattern(rule.host)],
      js: [part.js],
      world: part.world,
      runAt: 'document_idle' as const,
      persistAcrossSessions: true,
    })),
  ).filter((script) => !registeredIds.has(script.id));

  if (missing.length > 0) {
    await browser.scripting.registerContentScripts(missing);
  }
}
