import { ADAPTERS } from './adapters';

export interface SiteRule {
  id: string;
  /** 域名。匹配它自身以及所有子域，例如 qianwen.com 覆盖 www.qianwen.com */
  host: string;
  enabled: boolean;
  /** 内置站点：manifest 里已静态声明，不需要额外申请权限 */
  builtin: boolean;
}

/** 某个域名对应的 host 权限 / 注入范围 */
export function originPattern(host: string): string {
  return `https://*.${host}/*`;
}

/** 去掉被其他条目覆盖的域名，例如已有 qwen.ai 时 chat.qwen.ai 是多余的 */
export function dedupeHosts(hosts: string[]): string[] {
  const unique = [...new Set(hosts)];
  return unique.filter((host) => !unique.some((other) => other !== host && host.endsWith(`.${other}`)));
}

/**
 * 默认白名单直接从适配器推导，保证「适配器认识的站点」和「默认放行的站点」不会各说各话。
 */
export function createDefaultRules(): SiteRule[] {
  return dedupeHosts(ADAPTERS.flatMap((adapter) => adapter.hosts)).map((host) => ({
    id: `builtin-${host}`,
    host,
    enabled: true,
    builtin: true,
  }));
}

export function hostMatches(hostname: string, host: string): boolean {
  return hostname === host || hostname.endsWith(`.${host}`);
}

/** 当前域名是否被某条启用中的白名单规则命中 */
export function findEnabledRule(hostname: string, rules: SiteRule[]): SiteRule | undefined {
  return rules.find((rule) => rule.enabled && hostMatches(hostname, rule.host));
}

/**
 * 把用户输入规整成域名。
 * 接受 `qianwen.com`、`www.qianwen.com`、`https://www.qianwen.com/chat/xxx?a=1` 等写法。
 * 前缀 www. 会被去掉 —— 反正是后缀匹配，留着只会让白名单显得啰嗦。
 */
export function normalizeHost(input: string): string | null {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return null;

  let url: URL;
  try {
    url = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;

  const host = url.hostname.replace(/^www\./, '');
  // 至少要有一个点，且不能是 IP 或带端口的怪东西
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host)) return null;
  if (/^\d+(\.\d+)+$/.test(host)) return null;
  return host;
}
