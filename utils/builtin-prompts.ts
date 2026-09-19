import type { Prompt } from './types';

interface BuiltinSeed {
  id: string;
  title: string;
  content: string;
}

/**
 * 内置预设。只在扩展首次读取 storage 时写入一次（见 utils/storage.ts 的 init），
 * 之后用户的增删改都不会被这里的改动覆盖。
 * id 用固定字符串而非随机 UUID，方便日后按 id 做数据迁移。
 */
const SEEDS: BuiltinSeed[] = [
  {
    id: 'builtin-translate-zh',
    title: '翻译成中文',
    content: '把下面的内容翻译成简体中文。保持原有的段落结构和代码块不变，专业术语在首次出现时用括号保留英文原文。只输出译文，不要解释。',
  },
  {
    id: 'builtin-translate-en',
    title: '翻译成英文',
    content: '把下面的内容翻译成地道的英文，语气保持中性专业，不要逐字直译。只输出译文，不要解释。',
  },
  {
    id: 'builtin-polish',
    title: '润色文字',
    content: '润色下面这段文字：让表达更清晰简洁，去掉冗余和空话，但不要改变原意、不要加入新信息、不要拔高语气。先给出润色后的版本，再用三五条列出你改了什么以及为什么。',
  },
  {
    id: 'builtin-summarize',
    title: '总结要点',
    content: '用不超过 5 条要点总结下面的内容，每条一句话，按重要性排序。如果原文有明确结论或待办事项，单独列在最后。',
  },
  {
    id: 'builtin-explain-concept',
    title: '解释概念',
    content: '解释一下这个概念：\n\n\n\n请按这个顺序讲：1) 一句话定义；2) 它要解决什么问题、没有它的时候人们怎么做；3) 一个具体例子；4) 最容易被误解的地方。避免堆砌术语。',
  },
  {
    id: 'builtin-code-review',
    title: '代码 review',
    content: '帮我 review 下面这段代码。重点看：正确性 bug、边界条件、错误处理、并发/竞态问题、以及可以简化的地方。按严重程度排序，每条指出具体行号、说明会在什么输入下出问题，并给出修改建议。不要为了凑数而提无关紧要的风格问题。',
  },
  {
    id: 'builtin-explain-code',
    title: '解释代码',
    content: '逐段解释下面这段代码在做什么，说明整体思路和关键实现细节，指出其中不明显的地方（隐式约定、副作用、为什么必须这么写）。',
  },
  {
    id: 'builtin-refactor',
    title: '重构代码',
    content: '重构下面这段代码，目标是更易读、更易测试，保持外部行为完全不变。给出重构后的完整代码，并说明每一处改动的理由。如果你认为不需要重构，直接说明理由。',
  },
  {
    id: 'builtin-debug',
    title: '排查报错',
    content: '我遇到了下面的报错。请先分析最可能的根因（不要只看表面的报错信息），列出 2~3 个候选原因并说明如何逐个验证，然后给出修复方案。\n\n报错信息：\n\n\n复现步骤：\n\n\n相关代码：',
  },
  {
    id: 'builtin-write-tests',
    title: '写单元测试',
    content: '为下面的代码写单元测试。覆盖正常路径、边界值和错误分支，每个用例的名字要说清它在验证什么。只测公开行为，不要测内部实现细节。',
  },
  {
    id: 'builtin-commit-message',
    title: '写 commit message',
    content: '根据下面的 diff 写一条 commit message。第一行是不超过 72 字符的祈使句摘要，空一行后用正文说明「为什么这么改」而不是复述「改了什么」。',
  },
  {
    id: 'builtin-regex',
    title: '写正则表达式',
    content: '帮我写一个正则表达式，需求是：\n\n\n\n请给出正则本体，逐部分拆解它的含义，并列出几个应该匹配和不应该匹配的例子。说明使用的正则方言（JS / Python / PCRE）。',
  },
  {
    id: 'builtin-sql',
    title: '写 SQL',
    content: '帮我写一条 SQL。先说明你对表结构和字段含义的理解，再给出 SQL，最后指出可能的性能问题和需要的索引。\n\n表结构：\n\n\n需求：',
  },
  {
    id: 'builtin-critique',
    title: '找问题 / 唱反调',
    content: '不要附和我。针对下面这个方案，扮演一个挑剔的评审：指出其中的漏洞、被忽略的前提、以及在什么情况下会失败。如果你认为方案本身没问题，也要说明它的适用边界在哪里。',
  },
  {
    id: 'builtin-step-by-step',
    title: '拆解步骤',
    content: '把下面这件事拆成可执行的步骤。每一步说明做什么、产出是什么、以及怎么验证这一步做对了。标出哪些步骤之间有依赖、哪些可以并行。',
  },
];

export function createBuiltinPrompts(): Prompt[] {
  const now = Date.now();
  return SEEDS.map((seed) => ({
    ...seed,
    builtin: true,
    createdAt: now,
    updatedAt: now,
  }));
}
