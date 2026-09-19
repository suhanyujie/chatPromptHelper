// 仿千问的输入框：React 受控 textarea。
// 用真的 React 19，才能测出「直接改 .value 会被 React 的 value tracker 吃掉」这类问题。
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';

function App() {
  const [value, setValue] = useState('');
  // 暴露 React state 本身，而不是 DOM 的 .value
  window.__reactValue = () => value;
  return React.createElement('textarea', {
    id: 'chat-input',
    value,
    onChange: (e) => setValue(e.target.value),
  });
}

createRoot(document.getElementById('root')).render(React.createElement(App));
window.__ready = true;
