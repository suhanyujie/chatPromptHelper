import { useState } from 'react';
import type { Prompt } from '../utils/types';

interface PromptEditorProps {
  /** 传了是编辑，不传是新增 */
  editing?: Prompt;
  onSave: (title: string, content: string) => void;
  onCancel: () => void;
}

export function PromptEditor({ editing, onSave, onCancel }: PromptEditorProps) {
  const [title, setTitle] = useState(editing?.title ?? '');
  const [content, setContent] = useState(editing?.content ?? '');

  const canSave = title.trim().length > 0 && content.trim().length > 0;

  return (
    <div className="cph-editor">
      <div className="cph-editor-body">
        <div>
          <div className="cph-field-label">标题</div>
          <input
            className="cph-input"
            value={title}
            placeholder="列表里显示的名字"
            autoFocus
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div className="cph-field-label">正文</div>
        <textarea
          className="cph-textarea"
          value={content}
          placeholder="点击这条时填入输入框的内容"
          onChange={(e) => setContent(e.target.value)}
        />
      </div>
      <div className="cph-editor-footer">
        <button type="button" className="cph-btn" onClick={onCancel}>
          取消
        </button>
        <button
          type="button"
          className="cph-btn cph-btn-primary"
          disabled={!canSave}
          onClick={() => onSave(title, content)}
        >
          保存
        </button>
      </div>
    </div>
  );
}
