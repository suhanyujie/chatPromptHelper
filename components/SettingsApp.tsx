import { useCallback, useEffect, useState } from 'react';
import { browser } from '#imports';
import { hasHostPermission } from '../utils/dynamic-scripts';
import { normalizeHost, originPattern, type SiteRule } from '../utils/site-rules';
import { siteRulesItem } from '../utils/storage';

export function SettingsApp() {
  const [rules, setRules] = useState<SiteRule[] | null>(null);
  const [granted, setGranted] = useState<Record<string, boolean>>({});
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    void siteRulesItem.getValue().then(setRules);
    return siteRulesItem.watch((value) => setRules(value ?? []));
  }, []);

  // 权限可能被用户在 chrome://extensions 里单独撤销，所以每次规则变化都重新查一遍实际状态
  useEffect(() => {
    if (!rules) return;
    let alive = true;
    void Promise.all(
      rules.filter((rule) => !rule.builtin).map(async (rule) => [rule.host, await hasHostPermission(rule.host)] as const),
    ).then((entries) => {
      if (alive) setGranted(Object.fromEntries(entries));
    });
    return () => {
      alive = false;
    };
  }, [rules]);

  // 先更新本地 state 再落盘：只等 storage 的 watch 回调的话，
  // 受控 checkbox 会在这一个往返里先弹回原状态，看得见的抖动
  const write = useCallback(async (next: SiteRule[]) => {
    setRules(next);
    await siteRulesItem.setValue(next);
  }, []);

  const handleAdd = useCallback(() => {
    setError(null);
    setNotice(null);

    const host = normalizeHost(draft);
    if (!host) {
      setError('域名格式不对，填成 example.com 这样，或者直接粘贴整条网址。');
      return;
    }
    if (rules?.some((rule) => rule.host === host)) {
      setError(`${host} 已经在白名单里了。`);
      return;
    }

    // 先落盘再申请权限。
    // 在 popup 里，Chrome 的授权对话框会抢焦点导致 popup 关闭、页面被卸载，
    // 写在 request().then() 里的代码就再也跑不到了 —— 所以状态必须先存下来。
    // 拿到权限后由 background 的 permissions.onAdded 补上动态注册。
    void write([
      ...(rules ?? []),
      { id: crypto.randomUUID(), host, enabled: true, builtin: false },
    ]).then(() => {
      setDraft('');
      setNotice(`已添加 ${host}，正在申请访问权限…`);
      void browser.permissions.request({ origins: [originPattern(host)] });
    });
  }, [draft, rules, write]);

  const toggle = useCallback(
    (rule: SiteRule) => {
      void write(
        (rules ?? []).map((r) => (r.id === rule.id ? { ...r, enabled: !r.enabled } : r)),
      );
    },
    [rules, write],
  );

  const remove = useCallback(
    (rule: SiteRule) => {
      void write((rules ?? []).filter((r) => r.id !== rule.id));
      if (!rule.builtin) {
        // 顺手把权限还回去，别留着不用的授权
        void browser.permissions.remove({ origins: [originPattern(rule.host)] }).catch(() => {});
      }
    },
    [rules, write],
  );

  const regrant = useCallback((rule: SiteRule) => {
    void browser.permissions.request({ origins: [originPattern(rule.host)] });
  }, []);

  return (
    <main className="page">
      <header className="page-header">
        <h1>常用 Prompt 设置</h1>
        <p className="muted">
          只有白名单里的域名会显示 prompt 面板。域名会连同它的所有子域一起匹配 ——
          填 <code>qianwen.com</code> 就同时覆盖 <code>www.qianwen.com</code>。
        </p>
      </header>

      <section className="card">
        <h2>添加域名</h2>
        <div className="add-row">
          <input
            className="input"
            value={draft}
            placeholder="qianwen.com，或直接粘贴一条网址"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAdd();
            }}
          />
          <button type="button" className="btn btn-primary" onClick={handleAdd}>
            添加
          </button>
        </div>
        {error && <p className="msg msg-error">{error}</p>}
        {notice && <p className="msg msg-ok">{notice}</p>}
        <p className="muted small">
          添加时 Chrome 会弹一次授权框，同意后该域名才会生效。扩展默认只持有内置站点的权限，
          不会读取其他网站。标着「未授权」的条目点右侧「授权」可以重新申请。
        </p>
      </section>

      <section className="card">
        <h2>白名单</h2>
        {rules === null ? (
          <p className="muted">加载中…</p>
        ) : rules.length === 0 ? (
          <p className="muted">白名单是空的，面板不会在任何站点显示。</p>
        ) : (
          <ul className="rule-list">
            {rules.map((rule) => {
              const missingPermission = !rule.builtin && granted[rule.host] === false;
              return (
                <li key={rule.id} className={`rule${rule.enabled ? '' : ' rule-off'}`}>
                  <label className="rule-toggle">
                    <input
                      type="checkbox"
                      checked={rule.enabled}
                      onChange={() => toggle(rule)}
                    />
                    <span className="rule-host">{rule.host}</span>
                  </label>

                  {rule.builtin && <span className="tag">内置</span>}
                  {missingPermission && <span className="tag tag-warn">未授权</span>}

                  <div className="rule-actions">
                    {missingPermission && (
                      <button type="button" className="btn btn-small" onClick={() => regrant(rule)}>
                        授权
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn-small btn-danger"
                      onClick={() => remove(rule)}
                    >
                      删除
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <p className="muted small">
          内置站点同样可以关掉或删除。开关会立刻作用到已经打开的页面；新添加的域名需要刷新页面。
        </p>
      </section>
    </main>
  );
}
