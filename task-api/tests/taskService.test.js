const svc = require('../src/services/taskService');

beforeEach(() => svc._reset());

describe('taskService', () => {
  test('create applies defaults', () => {
    const t = svc.create({ title: 'A' });
    expect(t).toMatchObject({ title: 'A', description: '', status: 'todo', priority: 'medium', dueDate: null, completedAt: null });
    expect(t.id).toBeDefined();
    expect(new Date(t.createdAt).toString()).not.toBe('Invalid Date');
  });

  test('getAll returns a copy of the list', () => {
    svc.create({ title: 'A' });
    const list = svc.getAll();
    list.pop();
    expect(svc.getAll()).toHaveLength(1);
  });

  test('findById finds and misses', () => {
    const t = svc.create({ title: 'A' });
    expect(svc.findById(t.id)).toEqual(t);
    expect(svc.findById('nope')).toBeUndefined();
  });

  describe('getByStatus', () => {
    test('returns exact matches', () => {
      svc.create({ title: 'A', status: 'todo' });
      svc.create({ title: 'B', status: 'done' });
      expect(svc.getByStatus('todo').map((t) => t.title)).toEqual(['A']);
    });

    test('does not do substring matching (regression)', () => {
      svc.create({ title: 'A', status: 'todo' });
      svc.create({ title: 'B', status: 'done' });
      expect(svc.getByStatus('do')).toEqual([]);
    });
  });

  describe('getPaginated', () => {
    beforeEach(() => {
      for (let i = 1; i <= 5; i++) svc.create({ title: `T${i}` });
    });

    test('page 1 returns the first items (regression)', () => {
      expect(svc.getPaginated(1, 2).map((t) => t.title)).toEqual(['T1', 'T2']);
    });

    test('page 3 returns the remainder', () => {
      expect(svc.getPaginated(3, 2).map((t) => t.title)).toEqual(['T5']);
    });

    test('page past the end returns empty', () => {
      expect(svc.getPaginated(10, 2)).toEqual([]);
    });
  });

  describe('getStats', () => {
    test('counts by status and overdue', () => {
      const past = new Date(Date.now() - 86400000).toISOString();
      const future = new Date(Date.now() + 86400000).toISOString();
      svc.create({ title: 'a', status: 'todo', dueDate: past });
      svc.create({ title: 'b', status: 'in_progress', dueDate: past });
      svc.create({ title: 'c', status: 'done', dueDate: past });
      svc.create({ title: 'd', status: 'todo', dueDate: future });
      svc.create({ title: 'e', status: 'todo' });
      expect(svc.getStats()).toEqual({ todo: 3, in_progress: 1, done: 1, overdue: 2 });
    });

    test('empty store', () => {
      expect(svc.getStats()).toEqual({ todo: 0, in_progress: 0, done: 0, overdue: 0 });
    });
  });

  describe('update', () => {
    test('merges fields', () => {
      const t = svc.create({ title: 'A' });
      const u = svc.update(t.id, { title: 'B', priority: 'high' });
      expect(u).toMatchObject({ id: t.id, title: 'B', priority: 'high' });
      expect(svc.findById(t.id).title).toBe('B');
    });

    test('returns null for unknown id', () => {
      expect(svc.update('nope', { title: 'x' })).toBeNull();
    });
  });

  describe('remove', () => {
    test('removes existing', () => {
      const t = svc.create({ title: 'A' });
      expect(svc.remove(t.id)).toBe(true);
      expect(svc.getAll()).toHaveLength(0);
    });
    test('false for unknown id', () => {
      expect(svc.remove('nope')).toBe(false);
    });
  });

  describe('completeTask', () => {
    test('sets done + completedAt', () => {
      const t = svc.create({ title: 'A' });
      const c = svc.completeTask(t.id);
      expect(c.status).toBe('done');
      expect(new Date(c.completedAt).toString()).not.toBe('Invalid Date');
    });

    test('preserves priority (regression)', () => {
      const t = svc.create({ title: 'A', priority: 'high' });
      expect(svc.completeTask(t.id).priority).toBe('high');
    });

    test('null for unknown id', () => {
      expect(svc.completeTask('nope')).toBeNull();
    });
  });

  describe('assign', () => {
    test('stores trimmed assignee', () => {
      const t = svc.create({ title: 'A' });
      expect(svc.assign(t.id, '  Alice ').assignee).toBe('Alice');
      expect(svc.findById(t.id).assignee).toBe('Alice');
    });
    test('null for unknown id', () => {
      expect(svc.assign('nope', 'Alice')).toBeNull();
    });
  });
});
