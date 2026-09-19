import { defineContentScript } from '#imports';
import {
  INSERT_REQUEST,
  INSERT_RESULT,
  type InsertRequest,
  type InsertResult,
} from '../utils/insert-bridge';
import { insertPrompt } from '../utils/insert-text';

export default defineContentScript({
  matches: [
    'https://*.chatgpt.com/*',
    'https://*.chat.openai.com/*',
    'https://*.qianwen.com/*',
    'https://*.qwen.ai/*',
    'https://*.tongyi.com/*',
    'https://*.tongyi.aliyun.com/*',
  ],
  // 跑在页面自己的 JS 世界里 —— 见 utils/insert-bridge.ts 的说明
  world: 'MAIN',
  runAt: 'document_idle',

  main() {
    document.addEventListener(INSERT_REQUEST, (event) => {
      let request: InsertRequest;
      try {
        request = JSON.parse((event as CustomEvent<string>).detail);
      } catch {
        return;
      }

      const outcome = insertPrompt(request.content);
      document.dispatchEvent(
        new CustomEvent(INSERT_RESULT, {
          detail: JSON.stringify({ id: request.id, outcome } satisfies InsertResult),
        }),
      );
    });
  },
});
