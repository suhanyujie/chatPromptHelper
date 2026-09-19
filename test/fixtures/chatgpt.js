// 仿 ChatGPT 的输入框：ProseMirror 的 contenteditable，id 挂在 contenteditable 本身上。
// 用真的 ProseMirror（本地依赖，不走 CDN），这样测的才是真实的编辑器行为。
import { EditorState } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { schema } from 'prosemirror-schema-basic';

const view = new EditorView(document.getElementById('editor-host'), {
  state: EditorState.create({ schema }),
});
view.dom.id = 'prompt-textarea';

window.__view = view;
/**
 * 读 ProseMirror 的 document state（不是 DOM）。
 * 这才是决定发送按钮亮不亮的东西 —— 只改 DOM 不改 state 的插入方式在这里会露馅。
 * 注意 ProseMirror 通过 MutationObserver 异步回读 DOM，插入后要等一个 tick 再读。
 */
window.__docText = () => view.state.doc.textBetween(0, view.state.doc.content.size, '\n', '\n');
window.__ready = true;
