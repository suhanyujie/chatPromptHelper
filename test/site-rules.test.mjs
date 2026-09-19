import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import { loadSiteRules } from './helpers.mjs';

let m;
before(async () => {
  m = await loadSiteRules();
});

describe('normalizeHost：把用户的各种写法规整成域名', () => {
  it('接受裸域名、带 www、以及整条网址', () => {
    assert.equal(m.normalizeHost('qianwen.com'), 'qianwen.com');
    assert.equal(m.normalizeHost('www.qianwen.com'), 'qianwen.com');
    assert.equal(m.normalizeHost('  QianWen.COM  '), 'qianwen.com');
    assert.equal(
      m.normalizeHost('https://www.qianwen.com/chat/9cb9e79a5ffc432eb262ba57033ab173?pos=1'),
      'qianwen.com',
    );
    assert.equal(m.normalizeHost('chat.deepseek.com'), 'chat.deepseek.com');
  });

  it('拒绝不成立的输入', () => {
    for (const bad of ['', '   ', 'localhost', 'not a domain', '1.2.3.4', 'ftp://x.com', '.com']) {
      assert.equal(m.normalizeHost(bad), null, `${JSON.stringify(bad)} 不该被接受`);
    }
  });
});

describe('域名匹配', () => {
  it('规则同时覆盖域名自身和它的子域', () => {
    assert.equal(m.hostMatches('qianwen.com', 'qianwen.com'), true);
    assert.equal(m.hostMatches('www.qianwen.com', 'qianwen.com'), true);
    assert.equal(m.hostMatches('a.b.qianwen.com', 'qianwen.com'), true);
    // 不能被后缀骗过去
    assert.equal(m.hostMatches('notqianwen.com', 'qianwen.com'), false);
    assert.equal(m.hostMatches('qianwen.com.evil.net', 'qianwen.com'), false);
  });

  it('只有启用中的规则才算命中', () => {
    const rules = [
      { id: '1', host: 'qianwen.com', enabled: false, builtin: true },
      { id: '2', host: 'chatgpt.com', enabled: true, builtin: true },
    ];
    assert.equal(m.findEnabledRule('www.qianwen.com', rules), undefined);
    assert.equal(m.findEnabledRule('chatgpt.com', rules)?.id, '2');
    assert.equal(m.findEnabledRule('example.com', rules), undefined);
  });
});

describe('默认白名单', () => {
  it('去掉被其他条目覆盖的子域', () => {
    assert.deepEqual(
      m.dedupeHosts(['qwen.ai', 'chat.qwen.ai', 'tongyi.com', 'tongyi.aliyun.com']),
      ['qwen.ai', 'tongyi.com', 'tongyi.aliyun.com'],
    );
  });

  it('默认放行的站点就是适配器认识的那些，且全部启用', () => {
    const rules = m.createDefaultRules();
    assert.ok(rules.length > 0);
    assert.ok(rules.every((r) => r.enabled && r.builtin));
    assert.ok(rules.some((r) => r.host === 'chatgpt.com'));
    assert.ok(rules.some((r) => r.host === 'qianwen.com'));
    // 子域被去重掉了，不该重复出现
    assert.equal(rules.some((r) => r.host === 'chat.qwen.ai'), false);
  });

  it('权限申请用的 origin pattern 覆盖子域', () => {
    assert.equal(m.originPattern('qianwen.com'), 'https://*.qianwen.com/*');
  });
});
