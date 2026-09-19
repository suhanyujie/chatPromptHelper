import ReactDOM from 'react-dom/client';
import { createShadowRootUi, defineContentScript } from '#imports';
import { PromptPanel } from '../components/PromptPanel';
import { findEnabledRule } from '../utils/site-rules';
import { siteRulesItem } from '../utils/storage';
// 内联进 JS 而不是运行时去 fetch web_accessible_resources ——
// WAR 的 matches 只覆盖 manifest 里的站点，用户自己加的域名会拿不到样式，面板变成裸 button
import panelCss from '../assets/panel.css?raw';

export default defineContentScript({
  // 内置站点的静态注入范围。用户在设置页添加的域名走 background 的动态注册。
  // 必须是字面量数组 —— WXT 在构建期静态提取这段配置。
  matches: [
    'https://*.chatgpt.com/*',
    'https://*.chat.openai.com/*',
    'https://*.qianwen.com/*',
    'https://*.qwen.ai/*',
    'https://*.tongyi.com/*',
    'https://*.tongyi.aliyun.com/*',
  ],
  // 样式自己往 shadow root 里塞，不让 WXT 去 fetch css 文件
  cssInjectionMode: 'manual',
  runAt: 'document_idle',

  async main(ctx) {
    const ui = await createShadowRootUi(ctx, {
      name: 'chat-prompt-helper',
      position: 'inline',
      anchor: 'body',
      onMount: (container, shadow) => {
        // 挂到 shadow root 上而不是 container 里 ——
        // createRoot().render() 会清空 container 的既有子节点，塞在里面的 <style> 会被冲掉
        const style = document.createElement('style');
        style.textContent = panelCss;
        shadow.append(style);

        const root = ReactDOM.createRoot(container);
        root.render(<PromptPanel />);
        return root;
      },
      onRemove: (root) => {
        root?.unmount();
      },
    });

    // 白名单是最终闸门：即使 content script 被注入了，不在白名单里也不渲染面板
    let mounted = false;
    const apply = (rules: Parameters<typeof findEnabledRule>[1]) => {
      const allowed = Boolean(findEnabledRule(location.hostname, rules));
      if (allowed && !mounted) {
        ui.mount();
        mounted = true;
      } else if (!allowed && mounted) {
        ui.remove();
        mounted = false;
      }
    };

    apply(await siteRulesItem.getValue());
    // 在设置页开关某个站点时，已经开着的页面立刻跟着变，不用刷新
    siteRulesItem.watch((rules) => apply(rules ?? []));
  },
});
