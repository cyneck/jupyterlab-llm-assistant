/**
 * 会话持久化逻辑单元测试（纯 TypeScript，不依赖 DOM/React）
 *
 * 测试的纯函数逻辑（从 AgentPanel 中提取）：
 * - loadSession / saveSession / clearSession
 * - loadHistory / saveHistory（MAX_HISTORY_ITEMS 限制）
 * - sessionSummary（摘要截断）
 * - archiveAndClear（归档逻辑）
 * - handleDeleteHistory（删除逻辑）
 */

// ─── 模拟 localStorage ─────────────────────────────────────────────────────

class MockStorage {
  private store: Record<string, string> = {};

  getItem(key: string): string | null {
    return Object.prototype.hasOwnProperty.call(this.store, key)
      ? this.store[key]
      : null;
  }
  setItem(key: string, value: string): void {
    this.store[key] = value;
  }
  removeItem(key: string): void {
    delete this.store[key];
  }
  clear(): void {
    this.store = {};
  }
  get length(): number {
    return Object.keys(this.store).length;
  }
}

// Polyfill global localStorage for Node.js
const mockStorage = new MockStorage();
(global as any).localStorage = mockStorage;

// ─── 从 AgentPanel 复制的被测逻辑 ─────────────────────────────────────────

const STORAGE_KEY_SESSION = 'jlab-llm-agent-session';
const STORAGE_KEY_HISTORY = 'jlab-llm-agent-history';
const MAX_HISTORY_ITEMS = 20;

interface AgentDisplayMessage {
  id: string;
  type: 'user' | 'agent_text' | 'tool_call';
  content?: string;
  timestamp: number;
}

interface PersistedSession {
  messages: AgentDisplayMessage[];
  history: Array<{ role: string; content: string }>;
  rootDir: string;
  savedAt: number;
}

interface HistoryItem {
  id: string;
  summary: string;
  savedAt: number;
  messages: AgentDisplayMessage[];
  history: Array<{ role: string; content: string }>;
  rootDir: string;
}

function loadSession(): PersistedSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SESSION);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveSession(session: PersistedSession) {
  try {
    localStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify(session));
  } catch { /* ignore */ }
}

function clearSession() {
  localStorage.removeItem(STORAGE_KEY_SESSION);
}

function loadHistory(): HistoryItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_HISTORY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveHistory(items: HistoryItem[]) {
  try {
    localStorage.setItem(
      STORAGE_KEY_HISTORY,
      JSON.stringify(items.slice(0, MAX_HISTORY_ITEMS))
    );
  } catch { /* ignore */ }
}

function sessionSummary(messages: AgentDisplayMessage[]): string {
  const first = messages.find(m => m.type === 'user');
  return first?.content?.slice(0, 80) || 'Empty session';
}

// ─── 测试工具 ─────────────────────────────────────────────────────────────

let passCount = 0;
let failCount = 0;
const failures: string[] = [];

function assert(name: string, condition: boolean, detail?: string): void {
  if (condition) {
    console.log(`  \x1b[32m✔\x1b[0m  ${name}`);
    passCount++;
  } else {
    console.log(`  \x1b[31m✘\x1b[0m  ${name}${detail ? ` (${detail})` : ''}`);
    failCount++;
    failures.push(name);
  }
}

function makeMsg(type: AgentDisplayMessage['type'], content: string): AgentDisplayMessage {
  return { id: `id-${Date.now()}-${Math.random()}`, type, content, timestamp: Date.now() };
}

function makeHistoryItem(summary: string): HistoryItem {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    summary,
    savedAt: Date.now(),
    messages: [makeMsg('user', summary)],
    history: [],
    rootDir: '',
  };
}

// ─── 测试用例 ─────────────────────────────────────────────────────────────

console.log('\n========================================');
console.log('  会话持久化 & 历史面板 逻辑测试');
console.log('========================================');

// ── Group 1: loadSession / saveSession / clearSession
console.log('\n[1] loadSession / saveSession / clearSession');

mockStorage.clear();
assert('初始 loadSession 返回 null', loadSession() === null);

const session: PersistedSession = {
  messages: [makeMsg('user', 'Hello agent')],
  history: [{ role: 'user', content: 'Hello agent' }],
  rootDir: '/tmp/project',
  savedAt: Date.now(),
};
saveSession(session);
const loaded = loadSession();
assert('saveSession 后 loadSession 有数据', loaded !== null);
assert('恢复的消息数量正确', loaded?.messages.length === 1);
assert('恢复的 rootDir 正确', loaded?.rootDir === '/tmp/project');
assert('恢复的 history 正确', loaded?.history.length === 1);

clearSession();
assert('clearSession 后 loadSession 返回 null', loadSession() === null);

// ── Group 2: loadHistory / saveHistory
console.log('\n[2] loadHistory / saveHistory');

mockStorage.clear();
assert('初始 loadHistory 返回空数组', loadHistory().length === 0);

const items: HistoryItem[] = Array.from({ length: 5 }, (_, i) =>
  makeHistoryItem(`Task ${i + 1}`)
);
saveHistory(items);
const hist = loadHistory();
assert('保存 5 条历史', hist.length === 5);
assert('历史顺序保持', hist[0].summary === 'Task 1');
assert('历史内容完整', hist[4].summary === 'Task 5');

// MAX_HISTORY_ITEMS 限制
const tooMany: HistoryItem[] = Array.from({ length: 25 }, (_, i) =>
  makeHistoryItem(`Session ${i + 1}`)
);
saveHistory(tooMany);
const capped = loadHistory();
assert(`超出 ${MAX_HISTORY_ITEMS} 条时被截断`, capped.length === MAX_HISTORY_ITEMS);
assert('截断后保留最早（前 20 条）', capped[0].summary === 'Session 1');

// ── Group 3: sessionSummary
console.log('\n[3] sessionSummary');

assert('空消息列表返回 "Empty session"',
  sessionSummary([]) === 'Empty session');

assert('从第一条 user 消息提取摘要',
  sessionSummary([
    makeMsg('agent_text', 'agent reply'),
    makeMsg('user', 'My first task'),
  ]) === 'My first task');

const longMsg = 'A'.repeat(120);
assert('长消息截断到 80 字符',
  sessionSummary([makeMsg('user', longMsg)]).length === 80);

assert('无 user 消息返回 "Empty session"',
  sessionSummary([makeMsg('agent_text', 'no user here')]) === 'Empty session');

// ── Group 4: archiveAndClear 逻辑
console.log('\n[4] archiveAndClear 归档逻辑');

mockStorage.clear();

// 模拟 archiveAndClear 行为
function archiveAndClear(currentMessages: AgentDisplayMessage[], rootDir: string): HistoryItem[] {
  if (currentMessages.length > 0) {
    const item: HistoryItem = {
      id: `${Date.now()}-archive`,
      summary: sessionSummary(currentMessages),
      savedAt: Date.now(),
      messages: currentMessages,
      history: [],
      rootDir,
    };
    const updated = [item, ...loadHistory()].slice(0, MAX_HISTORY_ITEMS);
    saveHistory(updated);
    return updated;
  }
  return loadHistory();
}

const msgs1 = [makeMsg('user', 'First session task')];
archiveAndClear(msgs1, '/project1');
let h = loadHistory();
assert('归档后历史有 1 条', h.length === 1);
assert('归档摘要正确', h[0].summary === 'First session task');

const msgs2 = [makeMsg('user', 'Second session task')];
archiveAndClear(msgs2, '/project2');
h = loadHistory();
assert('两次归档后历史有 2 条', h.length === 2);
assert('新归档在首位', h[0].summary === 'Second session task');

// 空消息不归档
archiveAndClear([], '/project3');
h = loadHistory();
assert('空消息不归档（数量不变）', h.length === 2);

// ── Group 5: handleDeleteHistory
console.log('\n[5] handleDeleteHistory 删除逻辑');

mockStorage.clear();
const deleteItems: HistoryItem[] = [
  makeHistoryItem('Keep A'),
  makeHistoryItem('Delete B'),
  makeHistoryItem('Keep C'),
];
saveHistory(deleteItems);

// 模拟删除中间项
const idToDelete = deleteItems[1].id;
const afterDelete = deleteItems.filter(h => h.id !== idToDelete);
saveHistory(afterDelete);
const remaining = loadHistory();
assert('删除指定项后剩余 2 条', remaining.length === 2);
assert('被删除项不在结果中', !remaining.some(h => h.id === idToDelete));
assert('其余项保持原序', remaining[0].summary === 'Keep A' && remaining[1].summary === 'Keep C');

// 删除不存在的 id（幂等）
const afterDeleteMissing = remaining.filter(h => h.id !== 'nonexistent-id');
saveHistory(afterDeleteMissing);
assert('删除不存在 id 后数量不变', loadHistory().length === 2);

// ─── 汇总 ─────────────────────────────────────────────────────────────────

console.log('\n========================================');
console.log(`  结果汇总: ${passCount}/${passCount + failCount} 通过  |  ${failCount} 失败`);
console.log('========================================');

if (failCount > 0) {
  console.log('\n失败用例:');
  failures.forEach(f => console.log(`  ✘  ${f}`));
  process.exit(1);
} else {
  console.log('\n所有测试通过 ✔');
}
