import { browser, defineBackground } from '#imports';
import { reconcileDynamicScripts } from '../utils/dynamic-scripts';
import { siteRulesItem } from '../utils/storage';

export default defineBackground(() => {
  const sync = async () => {
    await reconcileDynamicScripts(await siteRulesItem.getValue());
  };

  // MV3 的 service worker 随时会被回收，这些监听器负责把它唤醒并重新对齐一次
  browser.runtime.onInstalled.addListener(() => void sync());
  browser.runtime.onStartup.addListener(() => void sync());
  siteRulesItem.watch(() => void sync());
  browser.permissions.onAdded.addListener(() => void sync());
  browser.permissions.onRemoved.addListener(() => void sync());

  // 工具栏图标由 popup 接管（manifest 里有 default_popup 时 action.onClicked 不会触发）。
  // 面板上的齿轮没法从 content script 里弹开 popup，改成在标签页打开同一个设置页面。
  browser.runtime.onMessage.addListener((message) => {
    if ((message as { type?: string })?.type === 'open-settings') {
      void browser.tabs.create({ url: browser.runtime.getURL('/popup.html') });
    }
  });
});
