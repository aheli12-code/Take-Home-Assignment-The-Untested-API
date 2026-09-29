const request = require('supertest');
const app = require('../src/app');
const svc = require('../src/services/taskService');

beforeEach(() => svc._reset());

const make = (body = {}) => request(app).post('/tasks').send({ title: 'T', ...body });

describe('POST /tasks', () => {
  test('creates a task (201)', async () => {
    const res = await make({ priority: 'high' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ title: 'T', priority: 'high', status: 'todo' });
  });
  test('400 on missing title', async () => {
    const res = await request(app).post('/tasks').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/title/);
  });
  test('400 on invalid priority', async () => {
    expect((await make({ priority: 'urgent' })).status).toBe(400);
  });
});

describe('GET /tasks', () => {
  beforeEach(async () => {
    await make({ title: 'A', status: 'todo' });
    await make({ title: 'B', status: 'done' });
    await make({ title: 'C', status: 'in_progress' });
  });

  test('lists all', async () => {
    const res = await request(app).get('/tasks');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(3);
  });
  test('filters by status', async () => {
    const res = await request(app).get('/tasks?status=done');
    expect(res.body.map((t) => t.title)).toEqual(['B']);
  });
  test('partial status does not match (regression)', async () => {
    expect((await request(app).get('/tasks?status=do')).body).toEqual([]);
  });
  test('paginates: page 1 is the first page (regression)', async () => {
    const res = await request(app).get('/tasks?page=1&limit=2');
    expect(res.body.map((t) => t.title)).toEqual(['A', 'B']);
  });
  test('paginates: page 2', async () => {
    const res = await request(app).get('/tasks?page=2&limit=2');
    expect(res.body.map((t) => t.title)).toEqual(['C']);
  });
  test('non-numeric page/limit fall back to defaults', async () => {
    const res = await request(app).get('/tasks?page=abc&limit=xyz');
    expect(res.body).toHaveLength(3);
  });
});

describe('PUT /tasks/:id', () => {
  test('updates a task', async () => {
    const { body: t } = await make();
    const res = await request(app).put(`/tasks/${t.id}`).send({ title: 'New', priority: 'low' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: t.id, title: 'New', priority: 'low' });
  });
  test('404 for unknown id', async () => {
    expect((await request(app).put('/tasks/nope').send({ title: 'x' })).status).toBe(404);
  });
  test('400 for invalid body', async () => {
    const { body: t } = await make();
    expect((await request(app).put(`/tasks/${t.id}`).send({ status: 'bogus' })).status).toBe(400);
  });
});

describe('DELETE /tasks/:id', () => {
  test('deletes (204)', async () => {
    const { body: t } = await make();
    const res = await request(app).delete(`/tasks/${t.id}`);
    expect(res.status).toBe(204);
    expect((await request(app).get('/tasks')).body).toHaveLength(0);
  });
  test('404 for unknown id', async () => {
    expect((await request(app).delete('/tasks/nope')).status).toBe(404);
  });
});

describe('PATCH /tasks/:id/complete', () => {
  test('completes and keeps priority', async () => {
    const { body: t } = await make({ priority: 'high' });
    const res = await request(app).patch(`/tasks/${t.id}/complete`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'done', priority: 'high' });
    expect(res.body.completedAt).not.toBeNull();
  });
  test('404 for unknown id', async () => {
    expect((await request(app).patch('/tasks/nope/complete')).status).toBe(404);
  });
});

describe('GET /tasks/stats', () => {
  test('returns counts + overdue', async () => {
    await make({ status: 'todo', dueDate: '2000-01-01' });
    await make({ status: 'done' });
    const res = await request(app).get('/tasks/stats');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ todo: 1, in_progress: 0, done: 1, overdue: 1 });
  });
});

describe('PATCH /tasks/:id/assign', () => {
  test('assigns and returns updated task', async () => {
    const { body: t } = await make();
    const res = await request(app).patch(`/tasks/${t.id}/assign`).send({ assignee: 'Alice' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: t.id, assignee: 'Alice' });
  });
  test('trims whitespace', async () => {
    const { body: t } = await make();
    const res = await request(app).patch(`/tasks/${t.id}/assign`).send({ assignee: '  Bob  ' });
    expect(res.body.assignee).toBe('Bob');
  });
  test('404 for unknown task', async () => {
    expect((await request(app).patch('/tasks/nope/assign').send({ assignee: 'Alice' })).status).toBe(404);
  });
  test.each([[{}], [{ assignee: '' }], [{ assignee: '   ' }], [{ assignee: 123 }]])('400 for %j', async (body) => {
    const { body: t } = await make();
    expect((await request(app).patch(`/tasks/${t.id}/assign`).send(body)).status).toBe(400);
  });
  test('reassigning an already-assigned task overwrites (200)', async () => {
    const { body: t } = await make();
    await request(app).patch(`/tasks/${t.id}/assign`).send({ assignee: 'Alice' });
    const res = await request(app).patch(`/tasks/${t.id}/assign`).send({ assignee: 'Bob' });
    expect(res.status).toBe(200);
    expect(res.body.assignee).toBe('Bob');
  });
});

describe('known bugs left unfixed (documented in BUG_REPORT.md)', () => {
  test.failing('PUT should not let clients overwrite id/createdAt', async () => {
    const { body: t } = await make();
    const res = await request(app).put(`/tasks/${t.id}`).send({ id: 'hacked', createdAt: '1999-01-01T00:00:00.000Z' });
    expect(res.body.id).toBe(t.id);
  });
  test.failing('PUT status=done should set completedAt', async () => {
    const { body: t } = await make();
    const res = await request(app).put(`/tasks/${t.id}`).send({ status: 'done' });
    expect(res.body.completedAt).not.toBeNull();
  });
  test.failing('negative page should be rejected with 400', async () => {
    await make();
    expect((await request(app).get('/tasks?page=-1&limit=2')).status).toBe(400);
  });
});
