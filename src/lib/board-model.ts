export type Status = 'todo' | 'in_progress' | 'in_review' | 'done'
export type Priority = 'low' | 'normal' | 'high'
export type Task = { id: string; title: string; status: Status; description: string; priority: Priority; due_date: string | null; assignee_id: string | null; assignee_ids: string[]; label_ids: string[] }
export type Member = { id: string; name: string; color: string }
export type Label = { id: string; name: string; color: string }
export type Comment = { id: string; task_id: string; body: string; created_at: string }
export type Board = { tasks: Task[]; members: Member[]; labels: Label[]; comments: Comment[] }
export type Draft = Omit<Task, 'id'> & { id?: string }
export const columns: { title: string; status: Status; color: string }[] = [
  { title: 'To Do', status: 'todo', color: 'purple' }, { title: 'In Progress', status: 'in_progress', color: 'yellow' },
  { title: 'In Review', status: 'in_review', color: 'blue' }, { title: 'Done', status: 'done', color: 'green' },
]
export const colors = ['#7e6bc4', '#4597ce', '#cc7972', '#589878', '#c7983d', '#c273a8']
export const colorNames: Record<string, string> = { '#7e6bc4': 'Purple', '#4597ce': 'Blue', '#cc7972': 'Coral', '#589878': 'Green', '#c7983d': 'Gold', '#c273a8': 'Pink' }
export function normalizeTask(task: Partial<Task> & Pick<Task, 'id' | 'title' | 'status'>): Task {
  return { description: '', priority: 'normal', due_date: null, assignee_id: null, assignee_ids: task.assignee_id ? [task.assignee_id] : [], label_ids: [], ...task }
}
export function newDraft(status: Status = 'todo'): Draft {
  const { id: _, ...draft } = normalizeTask({ id: '', title: '', status })
  return draft
}
export function dateKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
export function dueInfo(task: Pick<Task, 'due_date' | 'status'>, today = dateKey()) {
  if (!task.due_date) return null
  const days = Math.round((Date.parse(`${task.due_date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000)
  const date = new Date(`${task.due_date}T12:00:00`)
  if (!Number.isFinite(days)) return null
  const formatted = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  if (task.status === 'done') return { kind: 'complete', label: formatted, days }
  return { kind: days < 0 ? 'overdue' : days <= 3 ? 'soon' : 'later', label: days < 0 ? `Overdue · ${formatted}` : days === 0 ? 'Due today' : days === 1 ? 'Due tomorrow' : formatted, days }
}
export function upcomingTasks(tasks: Task[], today = dateKey()) {
  return tasks.filter(t => t.due_date && t.status !== 'done').sort((a, b) => a.due_date!.localeCompare(b.due_date!) || a.title.localeCompare(b.title)).map(task => ({ task, due: dueInfo(task, today)! }))
}
export function initials(name: string) { return name.trim().split(/\s+/).slice(0, 2).map(s => s[0]).join('').toUpperCase() }
export function toggleId(ids: string[], id: string) { return ids.includes(id) ? ids.filter(value => value !== id) : [...ids, id] }
export function matchesTask(task: Task, filters: { search: string; status: string; label: string; member: string; priority: string }) {
  return task.title.toLowerCase().includes(filters.search.toLowerCase()) && (!filters.status || task.status === filters.status) && (!filters.label || task.label_ids.includes(filters.label)) && (!filters.member || task.assignee_ids.includes(filters.member)) && (!filters.priority || task.priority === filters.priority)
}
