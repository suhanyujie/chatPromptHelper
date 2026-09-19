export interface Prompt {
  id: string;
  /** 列表里显示的短标题 */
  title: string;
  /** 点击后真正插入输入框的正文 */
  content: string;
  /** 是否来自内置预设。用户编辑过之后置为 false，表示已被接管 */
  builtin: boolean;
  createdAt: number;
  updatedAt: number;
}

/** 「最近使用」区域最多显示几条 */
export const RECENT_LIMIT = 5;
