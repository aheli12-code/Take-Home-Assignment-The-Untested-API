const { validateCreateTask, validateUpdateTask, validateAssign } = require('../src/utils/validators');

describe('validateCreateTask', () => {
  test('accepts valid body', () => {
    expect(validateCreateTask({ title: 'x', status: 'todo', priority: 'low', dueDate: '2030-01-01' })).toBeNull();
  });
  test.each([[{}], [{ title: '' }], [{ title: '   ' }], [{ title: 5 }]])('rejects bad title %j', (b) => {
    expect(validateCreateTask(b)).toMatch(/title/);
  });
  test('rejects bad status / priority / dueDate', () => {
    expect(validateCreateTask({ title: 'x', status: 'bogus' })).toMatch(/status/);
    expect(validateCreateTask({ title: 'x', priority: 'urgent' })).toMatch(/priority/);
    expect(validateCreateTask({ title: 'x', dueDate: 'not-a-date' })).toMatch(/dueDate/);
  });
});

describe('validateUpdateTask', () => {
  test('accepts empty body and valid fields', () => {
    expect(validateUpdateTask({})).toBeNull();
    expect(validateUpdateTask({ title: 'y', status: 'done', priority: 'high', dueDate: '2030-01-01' })).toBeNull();
  });
  test('rejects bad values', () => {
    expect(validateUpdateTask({ title: '' })).toMatch(/title/);
    expect(validateUpdateTask({ status: 'bogus' })).toMatch(/status/);
    expect(validateUpdateTask({ priority: 'urgent' })).toMatch(/priority/);
    expect(validateUpdateTask({ dueDate: 'nope' })).toMatch(/dueDate/);
  });
});

describe('validateAssign', () => {
  test('accepts a name', () => expect(validateAssign({ assignee: 'Alice' })).toBeNull());
  test.each([[undefined], [{}], [{ assignee: '' }], [{ assignee: '   ' }], [{ assignee: 42 }], [{ assignee: null }]])('rejects %j', (b) => {
    expect(validateAssign(b)).toMatch(/assignee/);
  });
  test('rejects over-long name', () => {
    expect(validateAssign({ assignee: 'a'.repeat(101) })).toMatch(/at most/);
  });
});
