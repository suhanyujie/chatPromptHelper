// 仿 qianwen.com 的输入框：Slate 编辑器。
// 选它是因为实测 qianwen.com 的 chunk 里有 data-slate-editor —— Slate 持有自己的文档模型，
// 直接改 DOM 会让模型失同步，是这套插入逻辑最难对付的一类编辑器。
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createEditor } from 'slate';
import { Editable, Slate, withReact } from 'slate-react';

const INITIAL = [{ type: 'paragraph', children: [{ text: '' }] }];

function App() {
  const [editor] = useState(() => withReact(createEditor()));
  const [value, setValue] = useState(INITIAL);

  // 暴露 Slate 的文档模型，而不是 DOM 文本 —— 模型没同步的话这里会露馅
  window.__slateText = () =>
    value.map((node) => node.children.map((child) => child.text).join('')).join('\n');

  return React.createElement(
    Slate,
    { editor, initialValue: INITIAL, onChange: setValue },
    React.createElement(Editable, { id: 'chat-input', placeholder: '有什么可以帮您的？' }),
  );
}

createRoot(document.getElementById('root')).render(React.createElement(App));
window.__ready = true;
