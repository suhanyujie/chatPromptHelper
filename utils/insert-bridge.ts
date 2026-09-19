import type { InsertOutcome } from './insert-text';

/**
 * 面板 UI 跑在 isolated world（需要 browser.storage），但插入必须在页面自己的 JS 世界里做。
 *
 * 原因：Slate 这类编辑器靠 beforeinput 事件的 getTargetRanges() 定位插入点，
 * 而合成事件的这个方法恒返回空数组、必须用 defineProperty 盖掉 ——
 * 跨 world 的事件对象是各自独立的包装，isolated world 里打的补丁页面根本看不见。
 *
 * 所以由 entrypoints/inserter.content.ts（world: 'MAIN'）执行真正的插入，这里只负责传话。
 * detail 一律用字符串，跨 world 传对象不可靠。
 */
export const INSERT_REQUEST = 'cph:insert-request';
export const INSERT_RESULT = 'cph:insert-result';

export interface InsertRequest {
  id: string;
  content: string;
}

export interface InsertResult {
  id: string;
  outcome: InsertOutcome;
}

/** MAIN world 脚本没能应答时的等待上限 */
const TIMEOUT_MS = 2000;

export function requestInsert(content: string): Promise<InsertOutcome | 'no-bridge'> {
  return new Promise((resolve) => {
    const id = crypto.randomUUID();

    const finish = (outcome: InsertOutcome | 'no-bridge') => {
      clearTimeout(timer);
      document.removeEventListener(INSERT_RESULT, onResult);
      resolve(outcome);
    };

    const onResult = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail;
      let result: InsertResult;
      try {
        result = JSON.parse(detail);
      } catch {
        return;
      }
      if (result.id === id) finish(result.outcome);
    };

    const timer = setTimeout(() => finish('no-bridge'), TIMEOUT_MS);
    document.addEventListener(INSERT_RESULT, onResult);
    document.dispatchEvent(
      new CustomEvent(INSERT_REQUEST, {
        detail: JSON.stringify({ id, content } satisfies InsertRequest),
      }),
    );
  });
}
