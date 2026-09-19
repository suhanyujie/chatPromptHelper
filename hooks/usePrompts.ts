import { useCallback, useEffect, useMemo, useState } from 'react';
import { promptsItem, recentIdsItem } from '../utils/storage';
import { RECENT_LIMIT, type Prompt } from '../utils/types';

export interface UsePromptsResult {
  /** null 表示首次读取还没完成 */
  prompts: Prompt[] | null;
  /** 最近使用，已按 MRU 排好序并剔除掉已删除的条目 */
  recent: Prompt[];
  addPrompt: (title: string, content: string) => Promise<void>;
  updatePrompt: (id: string, title: string, content: string) => Promise<void>;
  deletePrompt: (id: string) => Promise<void>;
  markUsed: (id: string) => Promise<void>;
}

export function usePrompts(): UsePromptsResult {
  const [prompts, setPrompts] = useState<Prompt[] | null>(null);
  const [recentIds, setRecentIds] = useState<string[]>([]);

  useEffect(() => {
    let alive = true;
    void Promise.all([promptsItem.getValue(), recentIdsItem.getValue()]).then(([p, r]) => {
      if (!alive) return;
      setPrompts(p ?? []);
      setRecentIds(r ?? []);
    });

    // 订阅 storage 变化，同一站点开多个标签页时保持一致
    const unwatchPrompts = promptsItem.watch((value) => setPrompts(value ?? []));
    const unwatchRecent = recentIdsItem.watch((value) => setRecentIds(value ?? []));

    return () => {
      alive = false;
      unwatchPrompts();
      unwatchRecent();
    };
  }, []);

  const recent = useMemo(() => {
    if (!prompts) return [];
    const byId = new Map(prompts.map((p) => [p.id, p]));
    return recentIds
      .map((id) => byId.get(id))
      .filter((p): p is Prompt => p !== undefined)
      .slice(0, RECENT_LIMIT);
  }, [prompts, recentIds]);

  // 所有写操作都先从 storage 重新读一遍再写回，避免用陈旧的 React state 覆盖掉其他标签页的改动
  const addPrompt = useCallback(async (title: string, content: string) => {
    const now = Date.now();
    const created: Prompt = {
      id: crypto.randomUUID(),
      title: title.trim(),
      content,
      builtin: false,
      createdAt: now,
      updatedAt: now,
    };
    const current = (await promptsItem.getValue()) ?? [];
    await promptsItem.setValue([created, ...current]);
  }, []);

  const updatePrompt = useCallback(async (id: string, title: string, content: string) => {
    const current = (await promptsItem.getValue()) ?? [];
    await promptsItem.setValue(
      current.map((p) =>
        p.id === id
          ? { ...p, title: title.trim(), content, builtin: false, updatedAt: Date.now() }
          : p,
      ),
    );
  }, []);

  const deletePrompt = useCallback(async (id: string) => {
    const current = (await promptsItem.getValue()) ?? [];
    await promptsItem.setValue(current.filter((p) => p.id !== id));
    // 顺手把它从最近使用里摘掉，否则会白占一个位置
    const ids = (await recentIdsItem.getValue()) ?? [];
    if (ids.includes(id)) {
      await recentIdsItem.setValue(ids.filter((x) => x !== id));
    }
  }, []);

  const markUsed = useCallback(async (id: string) => {
    const ids = (await recentIdsItem.getValue()) ?? [];
    await recentIdsItem.setValue([id, ...ids.filter((x) => x !== id)].slice(0, RECENT_LIMIT));
  }, []);

  return { prompts, recent, addPrompt, updatePrompt, deletePrompt, markUsed };
}
