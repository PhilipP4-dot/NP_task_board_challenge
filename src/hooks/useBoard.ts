import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { normalizeTask, type Board, type Comment, type Draft, type Label, type Member, type Status, type Task } from '../lib/board-model'
import { sampleTasks } from '../lib/sample-data'

const empty: Board = { tasks: [], members: [], labels: [], comments: [] }
const storageKey = 'ramp-demo-board-v2'
function readDemo(): Board {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) ?? 'null')
    if (saved && ['tasks', 'members', 'labels', 'comments'].every(key => Array.isArray(saved[key]))) return { ...saved, tasks: saved.tasks.map(normalizeTask) }
    const old = JSON.parse(localStorage.getItem('ramp-demo-tasks') ?? 'null')
    if (Array.isArray(old)) return { ...empty, tasks: old.map(normalizeTask) }
  } catch { /* Storage can be unavailable; the workspace remains usable in memory. */ }
  return { ...empty, tasks: sampleTasks }
}
async function fetchBoard(userId: string): Promise<Board> {
  const client = supabase!
  const results = await Promise.all([
    client.from('tasks').select('*').eq('user_id', userId).order('created_at'),
    client.from('team_members').select('id,name,color').eq('user_id', userId).order('created_at'),
    client.from('labels').select('id,name,color').eq('user_id', userId).order('created_at'),
    client.from('comments').select('id,task_id,body,created_at').eq('user_id', userId).order('created_at').order('id'),
    client.from('task_assignees').select('task_id,member_id').eq('user_id', userId),
    client.from('task_labels').select('task_id,label_id').eq('user_id', userId),
  ])
  for (const result of results) if (result.error) throw new Error(`Couldn’t load the workspace. ${result.error.message}`)
  const [tasks, members, labels, comments, assignees, tags] = results.map(r => r.data!)
  return {
    tasks: tasks.map(t => normalizeTask({ ...t, assignee_ids: assignees.filter(a => a.task_id === t.id).map(a => a.member_id), label_ids: tags.filter(l => l.task_id === t.id).map(l => l.label_id) } as Task)),
    members: members as Member[], labels: labels as Label[], comments: comments as Comment[],
  }
}
export function useBoard(demo: boolean, userId?: string) {
  const [data, setData] = useState<Board>(() => demo ? readDemo() : empty)
  const [loading, setLoading] = useState(!demo), [saving, setSaving] = useState(false), [error, setError] = useState(''), [revision, setRevision] = useState(0)
  const busy = useRef(false)
  const owner = useRef(userId)
  owner.current = userId
  const dataRef = useRef(data)
  dataRef.current = data
  useEffect(() => {
    if (!demo) return
    try { localStorage.setItem(storageKey, JSON.stringify(data)) } catch { setError('Browser storage is unavailable. Changes will last only until you refresh.') }
  }, [data, demo])
  useEffect(() => {
    if (demo || !userId) return
    let active = true
    setData(empty); setLoading(true); setError('')
    fetchBoard(userId).then(board => { if (active) setData(board) }).catch(e => { if (active) setError(e.message) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [demo, userId, revision])
  const refresh = useCallback(() => setRevision(n => n + 1), [])
  async function mutate(operation: () => Promise<void>) {
    if (busy.current || loading || (!demo && !userId)) return false
    const startedAs = userId
    busy.current = true; setSaving(true); setError('')
    try { await operation(); return true }
    catch (e) { if (owner.current === startedAs) setError(e instanceof Error ? e.message : 'Couldn’t save. Please try again.'); return false }
    finally { busy.current = false; setSaving(false) }
  }
  async function saveTask(draft: Draft) {
    return mutate(async () => {
      if (!draft.title.trim()) throw new Error('Please enter a task name.')
      const id = draft.id ?? crypto.randomUUID()
      const task: Task = { ...draft, id, title: draft.title.trim(), assignee_id: draft.assignee_ids[0] ?? null }
      if (!demo) {
        const { error } = await supabase!.rpc('save_task', {
          p_task: { id, title: task.title, status: task.status, description: task.description, priority: task.priority, due_date: task.due_date },
          p_assignee_ids: task.assignee_ids, p_label_ids: task.label_ids,
        })
        if (error) throw new Error(error.message)
      }
      if (owner.current === userId) setData(current => ({ ...current, tasks: draft.id ? current.tasks.map(t => t.id === id ? task : t) : [...current.tasks, task] }))
    })
  }
  async function moveTask(id: string, status: Status) {
    const previous = dataRef.current.tasks.find(t => t.id === id)
    if (!previous || previous.status === status) return false
    return mutate(async () => {
      setData(current => ({ ...current, tasks: current.tasks.map(t => t.id === id ? { ...t, status } : t) }))
      if (!demo) {
        try {
          const { error } = await supabase!.from('tasks').update({ status }).eq('id', id).eq('user_id', userId!).select('id').single()
          if (error) throw error
        } catch {
          if (owner.current === userId) setData(current => ({ ...current, tasks: current.tasks.map(t => t.id === id ? previous : t) }))
          throw new Error('Couldn’t move the task. The change was undone; please try again.')
        }
      }
    })
  }
  async function addEntity(kind: 'members' | 'labels', name: string, color: string) {
    return mutate(async () => {
      const clean = name.trim()
      if (!clean) throw new Error('Please enter a name.')
      if (dataRef.current[kind].some(item => item.name.toLowerCase() === clean.toLowerCase())) throw new Error('That name already exists.')
      let entity: Member | Label = { id: crypto.randomUUID(), name: clean, color }
      if (!demo) {
        const result = await supabase!.from(kind === 'members' ? 'team_members' : 'labels').insert({ name: clean, color, user_id: userId }).select('id,name,color').single()
        if (result.error) throw new Error(result.error.message)
        entity = result.data
      }
      if (owner.current === userId) setData(current => ({ ...current, [kind]: [...current[kind], entity] }))
    })
  }
  async function addComment(taskId: string, body: string) {
    return mutate(async () => {
      if (!body.trim()) throw new Error('Write a comment first.')
      let comment: Comment = { id: crypto.randomUUID(), task_id: taskId, body: body.trim(), created_at: new Date().toISOString() }
      if (!demo) {
        const result = await supabase!.from('comments').insert({ task_id: taskId, body: body.trim(), user_id: userId }).select('id,task_id,body,created_at').single()
        if (result.error) throw new Error(result.error.message)
        comment = result.data
      }
      if (owner.current === userId) setData(current => ({ ...current, comments: [...current.comments, comment].sort((a,b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id)) }))
    })
  }
  return { ...data, loading, saving, error, refresh, saveTask, moveTask, addEntity, addComment }
}
