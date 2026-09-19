import { useCallback, useEffect, useRef, useState } from 'react';
import { usePanelOpen } from '../hooks/usePanelOpen';
import { usePrompts } from '../hooks/usePrompts';
import { requestInsert } from '../utils/insert-bridge';
import { insertPrompt } from '../utils/insert-text';
import type { Prompt } from '../utils/types';
import { browser } from '#imports';
import { ChevronRightIcon, GearIcon } from './Icons';
import { PromptEditor } from './PromptEditor';
import { PromptItem } from './PromptItem';

type EditorState = { mode: 'create' } | { mode: 'edit'; prompt: Prompt } | null;

export function PromptPanel() {
  const [open, toggleOpen] = usePanelOpen();
  const { prompts, recent, addPrompt, updatePrompt, deletePrompt, markUsed } = usePrompts();
  const [editor, setEditor] = useState<EditorState>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  const handleUse = useCallback(
    async (prompt: Prompt) => {
      // 交给 MAIN world 的脚本去插入；它没应答时退回本 world 直插，
      // 这条退路对 textarea 和 ProseMirror 仍然有效，只有 Slate 这类编辑器会失败
      let outcome = await requestInsert(prompt.content);
      if (outcome === 'no-bridge') outcome = insertPrompt(prompt.content);

      if (outcome === 'ok') {
        void markUsed(prompt.id);
        return;
      }
      showToast(
        outcome === 'no-input'
          ? '没找到页面的输入框。请先点一下输入框，或到会话页面再试。'
          : '插入失败，这个页面的输入框暂不支持。',
      );
    },
    [markUsed, showToast],
  );

  const handleSave = useCallback(
    (title: string, content: string) => {
      if (editor?.mode === 'edit') {
        void updatePrompt(editor.prompt.id, title, content);
      } else {
        void addPrompt(title, content);
      }
      setEditor(null);
    },
    [editor, addPrompt, updatePrompt],
  );

  return (
    <div className="cph-root">
      {open ? (
        <div className="cph-panel">
          <div className="cph-header">
            <span className="cph-header-title">常用 Prompt</span>
            <div className="cph-header-actions">
              <button
                type="button"
                className="cph-icon-btn"
                title="设置"
                onClick={() => void browser.runtime.sendMessage({ type: 'open-settings' })}
              >
                <GearIcon />
              </button>
              <button type="button" className="cph-icon-btn" title="收起" onClick={toggleOpen}>
                <ChevronRightIcon />
              </button>
            </div>
          </div>

          <div className="cph-body">
            {prompts === null ? (
              <div className="cph-empty">加载中…</div>
            ) : (
              <>
                {recent.length > 0 && (
                  <>
                    <div className="cph-section-label">最近使用</div>
                    {recent.map((prompt) => (
                      <PromptItem key={`recent-${prompt.id}`} prompt={prompt} onUse={(p) => void handleUse(p)} />
                    ))}
                    <div className="cph-divider" />
                  </>
                )}

                {prompts.length === 0 ? (
                  <div className="cph-empty">还没有 prompt，点下面新增一条。</div>
                ) : (
                  <>
                    <div className="cph-section-label">全部</div>
                    {prompts.map((prompt) => (
                      <PromptItem
                        key={prompt.id}
                        prompt={prompt}
                        onUse={(p) => void handleUse(p)}
                        onEdit={(p) => setEditor({ mode: 'edit', prompt: p })}
                        onDelete={(p) => void deletePrompt(p.id)}
                      />
                    ))}
                  </>
                )}
              </>
            )}
          </div>

          <div className="cph-footer">
            <button
              type="button"
              className="cph-add-btn"
              onClick={() => setEditor({ mode: 'create' })}
            >
              ＋ 新增 prompt
            </button>
          </div>

          {editor && (
            <PromptEditor
              editing={editor.mode === 'edit' ? editor.prompt : undefined}
              onSave={handleSave}
              onCancel={() => setEditor(null)}
            />
          )}
        </div>
      ) : (
        <button type="button" className="cph-handle" title="常用 Prompt" onClick={toggleOpen}>
          Prompt
        </button>
      )}

      {toast && <div className="cph-toast">{toast}</div>}
    </div>
  );
}
