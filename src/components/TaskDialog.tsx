import { useEffect, useRef, useState } from 'react'
import { columns, dueInfo, initials, toggleId, type Comment, type Draft, type Label, type Member, type Priority, type Status } from '../lib/board-model'
import { Icon } from './Icons'

export function Avatar({ member }: { member: Member }) {
  return <span className="member-avatar" style={{ background: member.color }} title={member.name} aria-label={member.name}>{initials(member.name)}</span>
}
export function TaskDialog({ initial, members, labels, comments, busy, error, onSave, onComment, onManage, onClose }: {
  initial: Draft; members: Member[]; labels: Label[]; comments: Comment[]; busy: boolean; error: string;
  onSave: (draft: Draft) => Promise<boolean>; onComment: (id: string, body: string) => Promise<boolean>; onManage: (kind: string) => void; onClose: () => void
}) {
  const [draft, setDraft] = useState(initial), [body, setBody] = useState(''), [posting, setPosting] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => { dialog.current?.showModal(); dialog.current?.querySelector('input')?.focus() }, [])
  const due = dueInfo(draft)
  const taskComments = comments.filter(c => c.task_id === initial.id)
  return <dialog ref={dialog} className="task-dialog" aria-labelledby="task-dialog-title" onCancel={e => { if (busy) e.preventDefault(); else onClose() }}>
    <div className="dialog-heading"><h2 id="task-dialog-title">{initial.id ? 'Task details' : 'New task'}</h2><button aria-label="Close task" disabled={busy} onClick={onClose}><Icon name="close"/></button></div>
    <form onSubmit={async e => { e.preventDefault(); if (await onSave(draft)) onClose() }}>
      <fieldset disabled={busy} className="editor-fields">
        <label htmlFor="task-title">Task name</label><input id="task-title" autoFocus required maxLength={500} placeholder="What needs to be done?" value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })}/>
        <label htmlFor="task-description">Description (optional)</label><textarea id="task-description" rows={3} maxLength={10000} placeholder="Add details, requirements, or links…" value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })}/>
        <div className="field-row"><label>Status<select aria-label="Task status" value={draft.status} onChange={e => setDraft({ ...draft, status: e.target.value as Status })}>{columns.map(c => <option key={c.status} value={c.status}>{c.title}</option>)}</select></label><label>Priority<select aria-label="Task priority" value={draft.priority} onChange={e => setDraft({ ...draft, priority: e.target.value as Priority })}><option value="low">Low</option><option value="normal">Medium</option><option value="high">High</option></select></label></div>
        <label htmlFor="task-due">Due date (optional) {due && <span className={`due-badge ${due.kind}`}>{due.label}</span>}</label><input id="task-due" type="date" value={draft.due_date ?? ''} onInput={e => { const value = e.currentTarget.value; setDraft(current => ({ ...current, due_date: value || null })) }} onChange={e => { const value = e.target.value; setDraft(current => ({ ...current, due_date: value || null })) }}/>
        <div className="field-heading"><span>Assignees</span><button type="button" onClick={() => onManage('Team members')}>+ Add member</button></div>
        <div className="choice-list">{members.length ? members.map(member => <label className="choice" key={member.id}><input type="checkbox" aria-label={member.name} checked={draft.assignee_ids.includes(member.id)} onChange={() => setDraft({ ...draft, assignee_ids: toggleId(draft.assignee_ids, member.id) })}/><Avatar member={member}/>{member.name}</label>) : <p className="field-empty">Add a member to assign this task.</p>}</div>
        <div className="field-heading"><span>Labels</span><button type="button" onClick={() => onManage('Labels')}>+ Create label</button></div>
        <div className="choice-list label-choices">{labels.length ? labels.map(label => <label className="choice" key={label.id}><input type="checkbox" checked={draft.label_ids.includes(label.id)} onChange={() => setDraft({ ...draft, label_ids: toggleId(draft.label_ids, label.id) })}/><span className="label-chip" style={{ color: label.color, background: `${label.color}15` }}>{label.name}</span></label>) : <p className="field-empty">Create a label.</p>}</div>
      </fieldset>
      {error && <p className="form-error" role="alert">{error}</p>}
      <footer><button type="submit" className="primary" disabled={!draft.title.trim() || busy}>{busy && !posting ? 'Saving…' : initial.id ? 'Save changes' : 'Create task'}</button></footer>
    </form>
    <section className="comments-section" aria-label="Task comments"><h3><Icon name="chat" size={17}/>Comments <span>{taskComments.length}</span></h3>
      {!initial.id ? <p className="field-empty">Create this task to start the conversation.</p> : <>
        <div className="comment-list">{taskComments.length ? taskComments.map(comment => <article className="comment" key={comment.id}><span className="comment-avatar">G</span><div><header><strong>You</strong><time dateTime={comment.created_at}>{new Date(comment.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</time></header><p>{comment.body}</p></div></article>) : <p className="field-empty">Share an update or leave a note.</p>}</div>
        <form className="comment-form" onSubmit={async e => { e.preventDefault(); setPosting(true); try { if (await onComment(initial.id!, body)) setBody('') } finally { setPosting(false) } }}><label htmlFor="comment-body">Write a comment</label><textarea id="comment-body" rows={2} maxLength={5000} value={body} onChange={e => setBody(e.target.value)} placeholder="Write a comment…" disabled={busy}/><button type="submit" className="primary" disabled={busy || !body.trim()}>{posting ? 'Posting…' : 'Post comment'}</button></form>
      </>}
    </section>
  </dialog>
}
