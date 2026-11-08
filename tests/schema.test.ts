import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { readFile } from 'node:fs/promises'

const a = '10000000-0000-4000-8000-000000000001', b = '10000000-0000-4000-8000-000000000002'
const memberA = '20000000-0000-4000-8000-000000000001', memberB = '20000000-0000-4000-8000-000000000002', memberA2 = '20000000-0000-4000-8000-000000000003'
const labelA = '30000000-0000-4000-8000-000000000001', labelB = '30000000-0000-4000-8000-000000000002'
const taskA = '40000000-0000-4000-8000-000000000001', taskB = '40000000-0000-4000-8000-000000000002'
const bootstrap = `
  create role anon; create role authenticated;
  create schema auth; create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema public, auth to authenticated, anon;
  grant execute on function auth.uid() to authenticated, anon;
  insert into auth.users values ('${a}'), ('${b}');
`
const db = new PGlite()
const asUser = async (id: string) => { await db.exec('reset role'); await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id]); await db.exec('set role authenticated') }
const save = (id: string, title: string, members: string[], labels: string[]) => db.query('select public.save_task($1::jsonb, $2::uuid[], $3::uuid[])', [JSON.stringify({ id, title, status: 'todo', description: 'Design details', priority: 'high', due_date: '2026-11-08' }), members, labels])

beforeAll(async () => {
  await db.exec(bootstrap)
  await db.exec(await readFile('supabase/schema.sql', 'utf8'))
  await asUser(a)
  await db.query('insert into public.team_members(id,name) values ($1,$2),($3,$4)', [memberA, 'Alex', memberA2, 'Sam'])
  await db.query('insert into public.labels(id,name) values ($1,$2)', [labelA, 'Feature'])
  await save(taskA, 'Owner A task', [memberA, memberA2], [labelA])
  await db.query('insert into public.comments(task_id,body) values ($1,$2)', [taskA, 'First comment'])
  await asUser(b)
  await db.query('insert into public.team_members(id,name) values ($1,$2)', [memberB, 'Other member'])
  await db.query('insert into public.labels(id,name) values ($1,$2)', [labelB, 'Other label'])
  await save(taskB, 'Owner B task', [memberB], [labelB])
}, 30000)
afterAll(async () => { await db.close() })

describe('Supabase schema and RLS in local PostgreSQL', () => {
  it('persists bonus fields, primary and multiple assignees, labels, and comments', async () => {
    await asUser(a)
    const { rows } = await db.query('select description,priority,due_date::text,assignee_id from public.tasks where id=$1', [taskA])
    expect(rows[0]).toMatchObject({ description: 'Design details', priority: 'high', due_date: '2026-11-08', assignee_id: memberA })
    expect((await db.query('select * from public.task_assignees')).rows).toHaveLength(2)
    expect((await db.query('select * from public.task_labels')).rows).toHaveLength(1)
    expect((await db.query('select * from public.comments')).rows).toHaveLength(1)
  })
  it('isolates every feature table between guest users', async () => {
    await asUser(b)
    for (const table of ['tasks', 'team_members', 'labels', 'task_assignees', 'task_labels', 'comments']) {
      expect((await db.query(`select * from public.${table} where user_id=$1`, [a])).rows).toEqual([])
    }
    expect((await db.query('update public.tasks set title=$1 where id=$2 returning id', ['Intrusion', taskA])).rows).toEqual([])
    await expect(save(taskA, 'Intrusion', [memberB], [labelB])).rejects.toThrow()
    await expect(db.query('insert into public.comments(task_id,body) values ($1,$2)', [taskA, 'Intrusion'])).rejects.toThrow()
  })
  it('rejects foreign members and labels without partially saving task edits', async () => {
    await asUser(a)
    await expect(save(taskA, 'Should not save', [memberB], [labelA])).rejects.toThrow('Invalid assignee')
    await expect(save(taskA, 'Should not save', [memberA], [labelB])).rejects.toThrow('Invalid label')
    expect((await db.query<{title:string}>('select title from public.tasks where id=$1', [taskA])).rows[0].title).toBe('Owner A task')
    expect((await db.query('select * from public.task_assignees')).rows).toHaveLength(2)
    await expect(db.query('insert into public.task_assignees(task_id,member_id) values ($1,$2)', [taskA, memberB])).rejects.toThrow()
    await expect(db.query('insert into public.task_labels(task_id,label_id) values ($1,$2)', [taskA, labelB])).rejects.toThrow()
  })
  it('clears associations and primary assignee when selections are removed', async () => {
    await asUser(a)
    await save(taskA, 'Owner A task', [], [])
    expect((await db.query<{assignee_id:string|null}>('select assignee_id from public.tasks where id=$1', [taskA])).rows[0].assignee_id).toBeNull()
    expect((await db.query('select * from public.task_assignees')).rows).toEqual([])
    expect((await db.query('select * from public.task_labels')).rows).toEqual([])
  })
  it('rejects ownership changes and unauthenticated access', async () => {
    await asUser(a)
    await expect(db.query('update public.tasks set user_id=$1 where id=$2', [b, taskA])).rejects.toThrow()
    await db.exec('reset role; set role anon')
    await expect(db.query('select * from public.tasks')).rejects.toThrow()
    await expect(save(taskA, 'Intrusion', [], [])).rejects.toThrow()
  })
})
