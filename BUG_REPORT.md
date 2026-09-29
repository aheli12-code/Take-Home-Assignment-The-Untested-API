# Bug Report & Submission Notes

## Bugs found

### 1. Status filter uses substring matching — FIXED
- **Where:** `src/services/taskService.js`, `getByStatus`
- **Expected:** `GET /tasks?status=todo` returns only tasks whose status is exactly `todo`.
- **Actual:** the code did `t.status.includes(status)`, so `?status=do` matched both `todo` and `done`.
- **Found by:** unit test asserting `getByStatus('do')` returns `[]`.
- **Fix:** `t.status === status`.

### 2. Pagination skips the first page — FIXED
- **Where:** `src/services/taskService.js`, `getPaginated`
- **Expected:** `?page=1&limit=10` returns items 1–10.
- **Actual:** `offset = page * limit` made page 1 start at item 11, so the first page was unreachable.
- **Found by:** creating 5 tasks and asserting page 1 / limit 2 returns the first two.
- **Fix:** `offset = (page - 1) * limit`.

### 3. Completing a task silently resets priority — FIXED
- **Where:** `src/services/taskService.js`, `completeTask`
- **Expected:** completing changes only `status` and `completedAt`.
- **Actual:** it also overwrote `priority` with `'medium'`, losing the user's data.
- **Found by:** creating a `high` priority task, completing it, checking priority.
- **Fix:** removed the `priority: 'medium'` line.

### 4. PUT allows overwriting server-controlled fields — NOT FIXED
- **Where:** `update` in `taskService.js` (`{ ...tasks[index], ...fields }`); the validator doesn't whitelist fields.
- **Actual:** a client can change `id`, `createdAt`, `completedAt`, or add arbitrary keys.
- **Fix:** whitelist `title, description, status, priority, dueDate` before merging.
- Covered by `test.failing` in the tests.

### 5. PUT with `status: "done"` doesn't set `completedAt` — NOT FIXED
- **Where:** `update` in `taskService.js`. Only `completeTask` sets `completedAt`, so data becomes inconsistent (done but no timestamp).
- **Fix:** set/clear `completedAt` inside `update` when status changes to/from `done`.

### 6. Weak pagination input validation — NOT FIXED
- **Where:** `src/routes/tasks.js`, `GET /`
- Negative or zero values give odd results (negative offsets in `slice`). Also, `status` and `page/limit` can't be combined: the status branch returns early and ignores pagination.
- **Fix:** validate positive integers (400 otherwise) and apply filter then paginate.

### Minor observations
- Validators skip falsy values, so `status: ""` passes validation on create/update (`if (body.status && ...)`).
- `description` type isn't validated.
- The README's task shape (`pending | in-progress | completed`) doesn't match the code (`todo | in_progress | done`).

## New feature: `PATCH /tasks/:id/assign`
Design decisions:
- `assignee` must be a non-empty string after trimming, max 100 chars; otherwise **400**.
- Unknown task → **404**. (Body is validated before lookup, so a bad body on a missing id returns 400.)
- Value is trimmed before storing so `"  Alice "` and `"Alice"` are the same.
- **Already-assigned tasks can be reassigned** (200, overwrite). I chose this because reassignment is a normal workflow; a 409 would force an unassign step that doesn't exist. It's a product decision I'd confirm.
- The `assignee` field only exists on tasks once assigned (not added to `create` defaults), to leave existing responses unchanged.

## Note for the reviewer
- **Test next:** concurrency/ordering isn't relevant in-memory, but I'd add tests for large paginated lists, invalid JSON bodies, and status+pagination combined once bug 6 is fixed.
- **Surprises:** the README/ASSIGNMENT task-shape mismatch, and how subtle the `page * limit` bug is — it looks plausible when read quickly.
- **Questions before production:** Should assignees be validated against a user list? Should completed tasks be reopenable? Is a persistent store planned? Do we need auth?
