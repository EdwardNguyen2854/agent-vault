import { describe, expect, it } from 'vitest';
import {
  TASK_ID_MARKER_REGEX,
  buildCommentTree,
  buildTaskLine,
  createComment,
  defaultTaskDetail,
  emptyTaskDetailsStore,
  ensureTaskIdOnLine,
  extractTaskIdFromLine,
  isTaskDetail,
  isTaskDetailsStore,
  mergeTaskDetail,
  parseTaskDetailsJson,
  replaceTaskIdOnLine,
  serializeTaskDetailsJson,
} from './taskDetails';

describe('taskDetails', () => {
  it('round-trips JSON via serialize/parse', () => {
    const store = emptyTaskDetailsStore();
    const detail = defaultTaskDetail('t_1');
    detail.title = 'Hello';
    detail.labels = ['urgent'];
    const merged = mergeTaskDetail(store, detail);
    const text = serializeTaskDetailsJson(merged);
    const restored = parseTaskDetailsJson(text);
    expect(restored.tasks.t_1.title).toBe('Hello');
    expect(restored.tasks.t_1.labels).toEqual(['urgent']);
  });

  it('rejects malformed stores', () => {
    expect(isTaskDetailsStore(null)).toBe(false);
    expect(isTaskDetailsStore({ version: 1, tasks: {} })).toBe(true);
    expect(isTaskDetailsStore({ version: 2, tasks: {} })).toBe(false);
    expect(isTaskDetailsStore({ version: 1, tasks: { x: 'bad' } })).toBe(false);
  });

  it('rejects malformed details', () => {
    expect(isTaskDetail(null)).toBe(false);
    const good = defaultTaskDetail('t_2');
    expect(isTaskDetail(good)).toBe(true);
    expect(isTaskDetail({ ...good, status: 'pending' })).toBe(false);
    expect(isTaskDetail({ ...good, priority: 'urgent' })).toBe(false);
  });

  it('extracts and replaces the hidden task id marker', () => {
    const line = '- [ ] Build widget <!-- agent-vault:task-id=t_42 -->';
    expect(extractTaskIdFromLine(line)).toBe('t_42');
    const replaced = replaceTaskIdOnLine(line, 't_99');
    expect(replaced).toContain('task-id=t_99');
    expect(replaced.match(TASK_ID_MARKER_REGEX)?.[1]).toBe('t_99');
  });

  it('appends marker when missing', () => {
    const line = '- [ ] Build widget';
    const ensured = ensureTaskIdOnLine(line, 't_77');
    expect(extractTaskIdFromLine(ensured)).toBe('t_77');
  });

  it('builds lines with marker', () => {
    const line = buildTaskLine({ completed: true, text: 'Refactor', taskId: 't_x' });
    expect(line.startsWith('- [x] Refactor')).toBe(true);
    expect(extractTaskIdFromLine(line)).toBe('t_x');
  });

  it('builds threaded comment trees', () => {
    const root1 = createComment('user_1', 'You', 'root 1');
    const reply1 = { ...createComment('user_1', 'You', 'reply 1', root1.id), createdAt: '2024-01-01T00:00:01Z' };
    const reply2 = { ...createComment('agent_1', 'Bot', 'reply 2', root1.id), createdAt: '2024-01-01T00:00:02Z' };
    const tree = buildCommentTree([reply2, reply1, root1]);
    expect(tree).toHaveLength(1);
    expect(tree[0].comment.id).toBe(root1.id);
    expect(tree[0].replies.map((r) => r.id)).toEqual([reply1.id, reply2.id]);
  });
});