import { useState } from 'react';
import type { Prompt } from '../utils/types';
import { CheckIcon, CloseIcon, EditIcon, TrashIcon } from './Icons';

interface PromptItemProps {
  prompt: Prompt;
  onUse: (prompt: Prompt) => void;
  /** 传了才显示编辑/删除按钮。「最近使用」区域是纯快捷入口，不给这两个操作 */
  onEdit?: (prompt: Prompt) => void;
  onDelete?: (prompt: Prompt) => void;
}

export function PromptItem({ prompt, onUse, onEdit, onDelete }: PromptItemProps) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  return (
    <div className="cph-item">
      <button
        type="button"
        className="cph-item-main"
        title={prompt.content}
        onClick={() => onUse(prompt)}
      >
        {prompt.title}
      </button>

      {confirmingDelete ? (
        <div className="cph-item-actions" style={{ opacity: 1 }}>
          <button
            type="button"
            className="cph-icon-btn"
            title="确认删除"
            onClick={() => {
              setConfirmingDelete(false);
              onDelete?.(prompt);
            }}
          >
            <CheckIcon />
          </button>
          <button
            type="button"
            className="cph-icon-btn"
            title="取消"
            onClick={() => setConfirmingDelete(false)}
          >
            <CloseIcon />
          </button>
        </div>
      ) : (
        (onEdit || onDelete) && (
          <div className="cph-item-actions">
            {onEdit && (
              <button
                type="button"
                className="cph-icon-btn"
                title="编辑"
                onClick={() => onEdit(prompt)}
              >
                <EditIcon />
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                className="cph-icon-btn"
                title="删除"
                onClick={() => setConfirmingDelete(true)}
              >
                <TrashIcon />
              </button>
            )}
          </div>
        )
      )}
    </div>
  );
}
