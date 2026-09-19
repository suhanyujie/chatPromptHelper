import { storage } from '#imports';
import type { Prompt } from './types';
import { createBuiltinPrompts } from './builtin-prompts';
import { createDefaultRules, type SiteRule } from './site-rules';

/**
 * 注意用的是 init 而不是 fallback：
 * fallback 只在读取时兜底、不会落盘，那样用户删掉一条内置 prompt 之后，
 * 下次打开页面它又会冒出来。init 只在首次访问时写入一次。
 */
export const promptsItem = storage.defineItem<Prompt[]>('local:prompts', {
  init: () => createBuiltinPrompts(),
  version: 1,
});

/** 最近使用的 prompt id，MRU 顺序，队首最新 */
export const recentIdsItem = storage.defineItem<string[]>('local:recentIds', {
  fallback: [],
  version: 1,
});

/** 面板是展开还是收起，跨页面/跨标签页保持 */
export const panelOpenItem = storage.defineItem<boolean>('local:panelOpen', {
  fallback: false,
  version: 1,
});

/**
 * 域名白名单。只有命中其中某条启用规则的站点才会显示面板。
 * 同样用 init —— 用户删掉某个内置站点后不能下次又冒出来。
 */
export const siteRulesItem = storage.defineItem<SiteRule[]>('local:siteRules', {
  init: () => createDefaultRules(),
  version: 1,
});
