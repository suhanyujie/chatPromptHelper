import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Chat Prompt Helper',
    description: '在 ChatGPT / 通义千问页面右侧显示常用 prompt 列表，点击即可填入输入框。',
    // storage 存 prompt 和白名单；scripting 用来给用户自己加的域名动态注册 content script
    permissions: ['storage', 'scripting'],
    // 用户在设置页添加域名时才按需申请，安装时不会要「所有网站」权限
    optional_host_permissions: ['https://*/*'],
  },
});
