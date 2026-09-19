# Chat Prompt Helper

在 chat 类网页右侧注入一个可折叠面板，列出常用 prompt，点一下就填进页面的输入框（不自动发送）。输入框已有内容时空一行追加在后面。最近用过的 5 条单独显示在顶部。

面板只在**域名白名单**内的站点出现。内置放行 ChatGPT 和通义千问的几个域名，其余域名可以在设置页自己添加。

## 开发

```bash
pnpm install
pnpm dev        # 起开发服务并自动打开一个装好扩展的 Chrome
pnpm compile    # 类型检查
pnpm build      # 产出 .output/chrome-mv3
pnpm zip        # 打包
```

装到自己日常用的 Chrome：`pnpm build` 之后到 `chrome://extensions` 打开开发者模式，「加载已解压的扩展程序」选 `.output/chrome-mv3`。

> Chrome 137+ 已移除命令行的 `--load-extension`，用脚本自动装扩展不再可行，只能走上面的手动加载。

## 测试

```bash
pnpm test:setup   # 只需跑一次，下载 Playwright 自带的 Chromium
pnpm test         # 构建 + 跑全部测试
pnpm test:unit    # 只跑插入逻辑（headless，约 2 秒）
pnpm test:e2e     # 只跑扩展端到端
```

两层：

**`test/site-rules.test.mjs`** —— 域名规整与白名单匹配的纯函数，不开浏览器。

**`test/insert.test.mjs`** —— 在真实浏览器里验证 `utils/insert-text.ts`。fixture 里跑的是**真的 ProseMirror、真的 Slate、真的 React 19**（本地依赖打包，不联网），并通过路由拦截把页面挂到 `chatgpt.com` / `chat.qwen.ai` 域名下，所以走的是 `adapters.ts` 里真正的站点选择器。断言看的是 **ProseMirror / Slate 的文档模型和 React 的 state**，而不是 DOM 文本 —— 只改 DOM 不改框架模型的插入方式在这里会直接失败，这正是「文字进去了但发送按钮不亮」「插完就打不出字」的检测手段。每种编辑器都覆盖了「插入后继续手动打字」这一步。

**`test/extension.test.mjs`** —— 把 `.output/chrome-mv3` 真正加载进浏览器，跑完整用户路径：展开折叠、点击插入、最近使用 MRU、增删改、跨标签页同步、重开页面后的持久化。

**`test/popup.test.mjs`** —— 设置 popup 与白名单：默认放行哪些站点、开关如何实时作用到已打开的页面、删掉的内置站点不会复活、非法/重复域名的拒绝、以及「先落盘再申请权限」的行为。

**`test/manifest.test.mjs`** —— 交叉校验 manifest 的 `matches` 与 `adapters.ts` 的 `hosts`，防止两边漂移。

**没有自动覆盖的一段**：Chrome 的原生授权对话框 Playwright 点不动，所以测试只覆盖到「发起申请」为止 —— 规则已落盘、标为未授权、刷新后仍在。**同意授权之后**的那一段（动态注册 → 新域名上出现面板）需要手动验证一次。

已知约束：端到端测试必须 headed（Playwright 自带的 Chromium 在 headless 下不加载扩展），会短暂弹出浏览器窗口；在 CI 里需要 xvfb。插入逻辑那层是 headless 的，不受影响。

## 代码结构

| 路径 | 作用 |
| --- | --- |
| `entrypoints/content.tsx` | 面板 UI，isolated world，shadow root 挂载 |
| `entrypoints/inserter.content.ts` | 插入器，**MAIN world**，真正往输入框写字的那一半 |
| `utils/insert-bridge.ts` | 两个 world 之间的传话协议 |
| `entrypoints/popup/` | 工具栏 popup，域名白名单的增删改 |
| `components/SettingsApp.tsx` | 设置界面，popup 和标签页共用 |
| `entrypoints/background.ts` | 按白名单动态注册/注销 content script |
| `utils/site-rules.ts` | 白名单规则与域名规整（纯函数） |
| `utils/dynamic-scripts.ts` | 动态注册 content script 与权限查询 |
| `utils/adapters.ts` | 站点适配器：主机名 → 输入框选择器 |
| `utils/insert-text.ts` | 把文本塞进别人输入框的那套策略 |
| `utils/storage.ts` | `chrome.storage.local` 的三个数据项 |
| `utils/builtin-prompts.ts` | 内置预设 |
| `components/` | 面板 UI |

## 打开设置

点扩展工具栏图标弹出设置（popup）。面板标题栏上的齿轮会把同一个页面开在新标签页里 —— content script 没法从页面里弹开 popup。

## 加一个新站点

**临时用：** 直接在设置页添加域名。Chrome 会弹一次授权框，同意后 background 会为这个域名动态注册 content script。这条路子不需要改代码，但输入框只能靠通用兜底选择器去猜。

**要长期支持：** 往 `utils/adapters.ts` 的 `ADAPTERS` 里加一个对象，同时往 `entrypoints/content.tsx` 的 `matches` 里加一条 URL 模式：

```ts
{
  id: 'deepseek',
  hosts: ['chat.deepseek.com'],
  inputSelectors: ['textarea#chat-input', ...GENERIC_FALLBACKS],
}
```

两边漏了任何一边，`test/manifest.test.mjs` 会报错 —— 之前就是因为 `qianwen.com` 只写了一半（其实是两边都没写），面板在千问新域名上完全不出现。

## 白名单是怎么生效的

有两道闸门，缺一不可：

1. **注入闸门** —— content script 能不能在这个页面跑。内置站点靠 manifest 的 `matches` 静态声明；用户自己加的域名靠 `chrome.scripting.registerContentScripts()` 动态注册（需要先通过 `chrome.permissions.request()` 拿到 host 权限）。

   添加域名时是**先把规则写进 storage，再发起权限申请**。因为在 popup 里，Chrome 的授权对话框会抢焦点导致 popup 关闭、页面被卸载，写在 `request().then()` 之后的代码根本跑不到。授权通过后由 background 的 `permissions.onAdded` 补上动态注册。
2. **渲染闸门** —— 即使脚本跑起来了，域名不在启用中的白名单里也不挂载面板。设置页里开关某个站点，已经打开的页面会立刻跟着变，不用刷新。

扩展装上时只持有内置站点的权限，不会要「所有网站」。

## 为什么插入这件事这么麻烦

这些站点的输入框都由框架托管状态，直接改 `.value` / `.textContent` 会绕过框架自己的模型。按编辑器分三种情况：

| 站点 | 输入框 | 用什么插入 |
| --- | --- | --- |
| ChatGPT | ProseMirror contenteditable | `execCommand('insertText')` |
| chat.qwen.ai | React 受控 textarea | `execCommand`，失败退回原生 setter + 手动派发 input |
| qianwen.com | **Slate** contenteditable | 合成 `beforeinput` 事件 |

前两种用 `execCommand('insertText')`：它会派发真实的 `beforeinput` / `input` 事件，框架能正常接收。虽然标了 deprecated，目前仍是最可靠的做法。

**Slate 是个例外，也是这套代码里最绕的一段。** 它持有自己的文档模型并拿模型去校正 DOM，`execCommand` 会在 DOM 层面「成功」但模型仍是空的 —— 表现是文字看着进去了，一敲键盘就消失、甚至打不出字。它的 `onDOMBeforeInput` 靠 `event.getTargetRanges()` 定位插入点，而合成事件的这个方法恒返回空数组，必须用 `defineProperty` 盖掉。

**这就是为什么插入逻辑跑在 MAIN world。** 跨 world 的事件对象是各自独立的包装，isolated world 里给事件打的补丁页面根本看不见。所以面板 UI 留在 isolated world（它要用 `browser.storage`），插入交给 `entrypoints/inserter.content.ts`，两边用 CustomEvent 传话。MAIN world 脚本没应答时会退回本 world 直插 —— 这条退路对 textarea 和 ProseMirror 仍然有效。

还有几个坑：

- Slate 把 placeholder 渲染在可编辑元素**内部**，直接读 `innerText` 会把空输入框判成有内容。
- 光标必须落在最后一个文本节点末尾，而不是元素级末尾 —— 后者会被 Slate 解析成覆盖整段的范围，插入时把原文替换掉。
- **插入的文本末尾不能留空白。** 光标停在最后一个空行上时 Chrome 不会画光标，空行还会把输入框撑出滚动条，用户看到的就是「文字被截断、找不到光标在哪」。所以 `insertPrompt` 会先 `replace(/\s+$/, '')`，内置预设也不留尾部换行（有测试守着这条）。

详见 `utils/insert-text.ts` 和 `utils/insert-bridge.ts`。
