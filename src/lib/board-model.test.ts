import { describe, expect, it } from 'vitest'
import { dueInfo, matchesTask, normalizeTask, upcomingTasks } from './board-model'

const task = normalizeTask({ id: '1', title: 'Ship new feature', status: 'todo' })
describe('due dates', () => {
  it('distinguishes overdue, today, tomorrow, and the three-day warning boundary', () => {
    const due = (date: string) => dueInfo({ status: 'todo', due_date: date }, '2026-11-07')
    expect(due('2026-11-06')?.kind).toBe('overdue')
    expect(due('2026-11-07')?.label).toBe('Due today')
    expect(due('2026-11-08')?.label).toBe('Due tomorrow')
    expect(due('2026-11-10')?.kind).toBe('soon')
    expect(due('2026-11-11')?.kind).toBe('later')
  })
  it('does not mark completed or undated tasks overdue', () => {
    expect(dueInfo({ status: 'done', due_date: '2026-11-01' }, '2026-11-07')?.kind).toBe('complete')
    expect(dueInfo(task)).toBeNull()
  })
  it('uses calendar days across daylight-saving boundaries', () => {
    expect(dueInfo({ status: 'todo', due_date: '2026-11-02' }, '2026-10-31')?.days).toBe(2)
  })
  it('orders overdue before upcoming tasks and excludes completed tasks', () => {
    const tasks = [
      { ...task, id: 'later', due_date: '2026-11-10' },
      { ...task, id: 'done', due_date: '2026-11-01', status: 'done' as const },
      { ...task, id: 'late', due_date: '2026-11-06' }, task,
    ]
    expect(upcomingTasks(tasks, '2026-11-07').map(e => e.task.id)).toEqual(['late', 'later'])
  })
})
describe('task filtering', () => {
  const filters = { search: '', status: '', label: '', member: '', priority: '' }
  it('combines labels, multiple assignees, priority, status, and title search', () => {
    const assigned = { ...task, assignee_ids: ['alex', 'sam'], label_ids: ['feature', 'design'], priority: 'high' as const }
    expect(matchesTask(assigned, { search: 'FEATURE', status: 'todo', member: 'sam', label: 'design', priority: 'high' })).toBe(true)
    expect(matchesTask(assigned, { ...filters, label: 'bug' })).toBe(false)
    expect(matchesTask(assigned, { ...filters, member: 'other' })).toBe(false)
  })
  it('upgrades older demo tasks without losing their contents', () => {
    expect(normalizeTask({ id: 'old', title: 'Existing task', status: 'in_review' })).toMatchObject({ title: 'Existing task', description: '', priority: 'normal', due_date: null, assignee_ids: [], label_ids: [] })
  })
})
