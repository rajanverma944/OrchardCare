# Skill: Backend development

**When:** adding/changing API endpoints, domain logic, or schema.

## Files you'll touch

| Change | File |
|---|---|
| New field/column | `sql/migrations/00N_*.sql` (new file) + `validation.ts` + route INSERT/UPDATE |
| New endpoint | new handler in the relevant `src/routes/*.ts` (+ zod schema) |
| New domain rule | `src/services/*.ts` **+ a vitest test in `tests/`** |
| New table | migration + ownership via `orchards.owner_id` chain |

## The pattern for a new authenticated route

```ts
treesRouter.post('/:treeId/something', asyncHandler(async (req, res) => {
  const body = somethingSchema.parse(req.body);            // 1. validate
  const { tree } = await getOwnedTree(param(req, 'treeId'), req.user!.id); // 2. ownership
  // 3. query(sql, params) — parameterised; 4. shape camelCase response
}));
```

Loop in `express` params → use the `param(req, name)` helper (Express 5 types params
`string | string[]`).

## Migration rules

- Name: `002_description.sql`. Inside: `CREATE TABLE/ALTER ... IF NOT EXISTS/IF EXISTS` where
  possible. Applied once, tracked in `schema_migrations`, transactional. Server applies at boot.
- Adding a column to trees? Mirror it in `treeCreateSchema`/`treeUpdateSchema`, the tree
  INSERT, the tree UPDATE, and `GET /trees/:treeId` mapping.

## Offline sync

New sync op = new branch in `routes/sync.ts` + `SyncChange` type in `validation.ts` + MUST use
the `client_*_id` dedupe pattern (GUARDRAILS #9-#10). Add a test in `tests/api.test.ts`
(see "offline sync" describe block for the template).

## Verify before committing

```powershell
cd C:\oc\backend
..\tools\node\npm run typecheck
..\tools\node\npm test
npm run build
node scripts\smoke.mjs   # server running
```
