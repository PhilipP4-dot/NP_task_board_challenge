import { useEffect, useRef, useState, type ReactNode } from 'react'
import { DndContext, PointerSensor, useSensor, useSensors, useDraggable, useDroppable, type DragEndEvent } from '@dnd-kit/core'
import { useGuestSession } from './hooks/useGuestSession'
import { useBoard } from './hooks/useBoard'
import { columns, colors, colorNames, dateKey, dueInfo, matchesTask, newDraft, upcomingTasks, type Draft, type Label, type Member, type Status, type Task } from './lib/board-model'
import { Icon } from './components/Icons'
import { Avatar, TaskDialog } from './components/TaskDialog'

function Card({ task, members, labels, commentCount, onEdit, disabled, today }: { task: Task; members: Member[]; labels: Label[]; commentCount: number; onEdit: () => void; disabled: boolean; today: string }) {
  const { listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id, disabled })
  const due = dueInfo(task, today)
  const assigned = members.filter(m => task.assignee_ids.includes(m.id)), tagged = labels.filter(l => task.label_ids.includes(l.id))
  return <button ref={setNodeRef} className={`task-card ${isDragging ? 'dragging' : ''}`} style={transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined} {...listeners} onClick={onEdit} disabled={disabled} aria-label={`Open task: ${task.title}`}>
    {tagged.length > 0 && <span className="card-labels">{tagged.map(label => <span key={label.id} className="label-chip" style={{ color: label.color, background: `${label.color}15` }}>{label.name}</span>)}</span>}
    <span className="card-title">{task.title}</span>
    {task.description && <span className="card-description">{task.description}</span>}
    {(due || assigned.length > 0 || task.priority !== 'normal' || commentCount > 0) && <span className="card-meta">
      {task.priority !== 'normal' && <span className={`priority-badge ${task.priority}`}>{task.priority === 'high' ? '↑ High' : '↓ Low'}</span>}
      {due && <span className={`due-badge ${due.kind}`}><Icon name="calendar" size={12}/>{due.label}</span>}
      {commentCount > 0 && <span className="comment-count" title={`${commentCount} ${commentCount === 1 ? 'comment' : 'comments'}`}><Icon name="chat" size={13}/>{commentCount}</span>}
      <span className="card-avatars">{assigned.map(member => <Avatar member={member} key={member.id}/>)}</span>
    </span>}
  </button>
}
function Column({ column, tasks, members, labels, comments, onNew, onEdit, busy, today }: { column: typeof columns[number]; tasks: Task[]; members: Member[]; labels: Label[]; comments: {task_id: string}[]; onNew: () => void; onEdit: (task: Task) => void; busy: boolean; today: string }) {
  const { setNodeRef, isOver } = useDroppable({ id: column.status, disabled: busy })
  return <section ref={setNodeRef} className={`column ${column.color} ${isOver ? 'drop-over' : ''}`} aria-label={column.title}>
    <header className="column-heading"><h2><span className="status-dot"/>{column.title}</h2><span className="task-count">{tasks.length}</span></header>
    <div className="task-list">{tasks.map(task => <Card key={task.id} task={task} members={members} labels={labels} commentCount={comments.filter(c => c.task_id === task.id).length} onEdit={() => onEdit(task)} disabled={busy} today={today}/>)}</div>
    <button className="new-page" onClick={onNew} disabled={busy}><Icon name="plus" size={16}/>Add task</button>
  </section>
}
function Panel({ title, children, onClose, busy }: { title: string; children: ReactNode; onClose: () => void; busy: boolean }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => { ref.current?.showModal() }, [])
  return <dialog className="side-dialog" ref={ref} aria-label={title} onCancel={e => { if (busy) e.preventDefault(); else onClose() }}><div className="dialog-heading"><h2>{title}</h2><button aria-label="Close panel" disabled={busy} onClick={onClose}><Icon name="close"/></button></div>{children}</dialog>
}
export default function App() {
  const auth = useGuestSession(), demo = auth.status === 'setup'
  const board = useBoard(demo, auth.session?.user.id)
  const [searchOpen, setSearchOpen] = useState(false), [search, setSearch] = useState('')
  const [filter, setFilter] = useState(''), [labelFilter, setLabelFilter] = useState(''), [memberFilter, setMemberFilter] = useState(''), [priorityFilter, setPriorityFilter] = useState('')
  const [filterOpen, setFilterOpen] = useState(false), [sort, setSort] = useState(false), [panel, setPanel] = useState('')
  const [modal, setModal] = useState<Draft | null>(null), [entityName, setEntityName] = useState(''), [entityColor, setEntityColor] = useState(colors[0])
  const [today, setToday] = useState(dateKey())
  const [sidebarHidden, setSidebarHidden] = useState(false)
  useEffect(() => { const timer = setInterval(() => setToday(dateKey()), 60000); const update = () => setToday(dateKey()); window.addEventListener('focus', update); return () => { clearInterval(timer); window.removeEventListener('focus', update) } }, [])
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 7 } }))
  const busy = board.saving || board.loading || (!demo && auth.status !== 'ready')
  const visibleTasks = demo || auth.status === 'ready' ? board.tasks : []
  const events = upcomingTasks(visibleTasks, today), overdueCount = events.filter(e => e.due.kind === 'overdue').length
  const filtered = visibleTasks.filter(task => matchesTask(task, { search, status: filter, label: labelFilter, member: memberFilter, priority: priorityFilter }))
  if (sort) filtered.sort((a, b) => a.title.localeCompare(b.title))
  const tool = (name: string, label: string, action: () => void, active = false) => <button className={`icon-button ${active ? 'active' : ''}`} aria-label={label} title={label} onClick={action}><Icon name={name}/></button>
  const clearFilters = () => { setSearch(''); setFilter(''); setLabelFilter(''); setMemberFilter(''); setPriorityFilter('') }
  const openPanel = (name: string) => { setEntityName(''); setEntityColor(colors[0]); setPanel(name) }
  const editTask = (task: Task) => { setPanel(''); setModal(task) }
  async function moveTask(event: DragEndEvent) {
    const status = event.over?.id as Status | undefined
    if (status && columns.some(c => c.status === status)) await board.moveTask(String(event.active.id), status)
  }
  async function addEntity(e: React.FormEvent) {
    e.preventDefault()
    if (await board.addEntity(panel === 'Team members' ? 'members' : 'labels', entityName, entityColor)) setEntityName('')
  }
  const eventList = (all = false) => (all ? events : events.slice(0, 5)).map(({ task, due }) => <button key={task.id} className={`event-item ${due.kind}`} onClick={() => editTask(task)}><span className="event-square"/><span className="event-name">{task.title}</span><time dateTime={task.due_date!}>{due.days < 0 ? 'Overdue' : due.days === 0 ? 'Today' : due.days === 1 ? 'Tomorrow' : due.label}</time></button>)
  return <div className={`workspace ${sidebarHidden ? 'wide' : ''}`}>
    <aside className="sidebar" aria-label="Workspace navigation">
      <nav className="quick-nav"><button className="home" onClick={clearFilters}><Icon name="home"/>Home</button>{tool('chat', 'View all comments', () => openPanel('Comments'))}</nav>
      <section className="sidebar-section events"><div className="sidebar-heading"><h2>Upcoming events</h2>{overdueCount > 0 && <span className="overdue-count">{overdueCount} overdue</span>}</div>{events.length ? eventList() : <p className="sidebar-empty">Add a due date to a task.</p>}<button className="sidebar-more" aria-label="View all upcoming events" onClick={() => openPanel('Upcoming events')}>View all <span>→</span></button></section>
      <section className="sidebar-section teamspaces"><div className="sidebar-heading"><h2>Team members</h2><button className="icon-button" aria-label="Manage team members" title="Manage team members" onClick={() => openPanel('Team members')}><Icon name="sliders" size={16}/></button></div>
        {board.members.length ? board.members.map(member => <button key={member.id} className={memberFilter === member.id ? 'member-selected' : ''} onClick={() => { setMemberFilter(v => v === member.id ? '' : member.id); setFilterOpen(true) }}><Avatar member={member}/><span className="member-name">{member.name}</span><span className="member-task-count">{visibleTasks.filter(t => t.assignee_ids.includes(member.id)).length}</span></button>) : <p className="sidebar-empty">Add a team member.</p>}
        <button className="sidebar-add" onClick={() => openPanel('Team members')} disabled={busy}><Icon name="plus" size={18}/>Add member</button>
      </section>
    </aside>
    <main id="board">
      <div className="board-content"><div className="page-title"><h1>Kanban Task Board</h1></div>
        <div className="board-toolbar"><div className="board-tools">{tool('sort', 'Sort tasks A–Z', () => setSort(v => !v), sort)}{tool('filter', 'Filter tasks', () => setFilterOpen(v => !v), !!(filter || labelFilter || memberFilter || priorityFilter))}{tool('notes', 'Manage labels', () => openPanel('Labels'))}{tool('search', 'Search board', () => setSearchOpen(v => !v), searchOpen)}{tool('expand', sidebarHidden ? 'Show sidebar' : 'Hide sidebar', () => setSidebarHidden(v => !v))}<div className="new-button"><button onClick={() => setModal(newDraft())} disabled={busy}>New task</button><button aria-label="Choose a column for the new task" title="Choose a column for the new task" onClick={() => openPanel('New task')} disabled={busy}><Icon name="chevron" size={16}/></button></div></div></div>
        <div className="mobile-workspace-tools"><button onClick={() => openPanel('Team members')}><Icon name="team" size={15}/>Team members</button><button onClick={() => openPanel('Upcoming events')}><Icon name="calendar" size={15}/>Upcoming events {overdueCount > 0 && `(${overdueCount} overdue)`}</button></div>
        {(searchOpen || filterOpen) && <div className="filter-bar">{searchOpen && <label><Icon name="search" size={17}/><input aria-label="Search tasks" autoFocus placeholder="Search tasks…" value={search} onChange={e => setSearch(e.target.value)}/><button aria-label="Clear search" onClick={() => { setSearch(''); setSearchOpen(false) }}><Icon name="close" size={15}/></button></label>}{filterOpen && <>
          <select aria-label="Filter task status" value={filter} onChange={e => setFilter(e.target.value)}><option value="">All statuses</option>{columns.map(c => <option key={c.status} value={c.status}>{c.title}</option>)}</select>
          <select aria-label="Filter by label" value={labelFilter} onChange={e => setLabelFilter(e.target.value)}><option value="">All labels</option>{board.labels.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select>
          <select aria-label="Filter by assignee" value={memberFilter} onChange={e => setMemberFilter(e.target.value)}><option value="">All assignees</option>{board.members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
          <select aria-label="Filter by priority" value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}><option value="">All priorities</option><option value="low">Low</option><option value="normal">Medium</option><option value="high">High</option></select>
          {(filter || labelFilter || memberFilter || priorityFilter || search) && <button className="clear-filters" onClick={clearFilters}>Clear filters</button>}
        </>}</div>}
        {(board.error || auth.status === 'error') && <div className="error-banner" role="alert">{board.error || auth.message}<button onClick={() => auth.status === 'error' ? auth.retry() : board.refresh()}>Try again</button></div>}
        <DndContext sensors={sensors} onDragEnd={moveTask}><div className="board-grid" aria-label="Task board" aria-busy={board.loading || auth.status === 'loading'}>{columns.map(column => <Column key={column.status} column={column} tasks={filtered.filter(t => t.status === column.status)} members={board.members} labels={board.labels} comments={board.comments} onNew={() => setModal(newDraft(column.status))} onEdit={setModal} busy={busy} today={today}/>)}</div></DndContext>
        {!filtered.length && !busy && !board.error && auth.status !== 'error' && <p className="board-empty">{visibleTasks.length ? 'No tasks match these filters.' : 'Create your first task.'}</p>}
      </div>
    </main>
    {modal && <TaskDialog key={modal.id ?? 'new'} initial={modal} members={board.members} labels={board.labels} comments={board.comments} busy={busy} error={board.error} onSave={board.saveTask} onComment={board.addComment} onManage={openPanel} onClose={() => setModal(null)}/>}
    {panel && <Panel key={panel} title={panel} onClose={() => setPanel('')} busy={board.saving}>
      {(panel === 'Team members' || panel === 'Labels') ? <>
        <p className="panel-intro">{panel === 'Team members' ? 'Add team members, then assign them to tasks.' : 'Create labels to organize and filter tasks.'}</p>
        <div className="entity-list">{(panel === 'Team members' ? board.members : board.labels).map(item => <div key={item.id}>{panel === 'Team members' ? <Avatar member={item}/> : <span className="label-chip" style={{ color: item.color, background: `${item.color}15` }}>{item.name}</span>}{panel === 'Team members' && <span>{item.name}</span>}</div>)}</div>
        <form className="entity-form" onSubmit={addEntity}><fieldset disabled={busy}><label htmlFor="entity-name">{panel === 'Team members' ? 'Member name' : 'Label name'}</label><input id="entity-name" required maxLength={80} value={entityName} placeholder={panel === 'Team members' ? 'Enter a member’s name' : 'e.g. Bug, Feature, Design'} onChange={e => setEntityName(e.target.value)}/><label htmlFor="entity-color">{panel === 'Team members' ? 'Avatar color' : 'Label color'}</label><div className="color-picker"><input id="entity-color" type="color" value={entityColor} onChange={e => setEntityColor(e.target.value)}/>{colors.map(color => <button type="button" key={color} aria-label={`Choose ${colorNames[color]} color`} title={colorNames[color]} aria-pressed={entityColor === color} style={{ background: color }} onClick={() => setEntityColor(color)}/>)}</div><button className="primary" type="submit" disabled={busy || !entityName.trim()}>{board.saving ? (panel === 'Team members' ? 'Adding member…' : 'Creating label…') : panel === 'Team members' ? 'Add member' : 'Create label'}</button></fieldset></form>
      </> : panel === 'Upcoming events' ? <div className="sidebar-section events panel-events"><p className="panel-intro">Unfinished tasks, ordered by deadline.</p>{events.length ? eventList(true) : <p className="field-empty">Add a due date to a task to see it here.</p>}</div>
      : panel === 'Comments' ? <div className="all-comments">{board.comments.length ? [...board.comments].reverse().map(c => <button key={c.id} onClick={() => { const task = board.tasks.find(t => t.id === c.task_id); if (task) editTask(task) }}><strong>{board.tasks.find(t => t.id === c.task_id)?.title}</strong><span>{c.body}</span><time dateTime={c.created_at}>{new Date(c.created_at).toLocaleString()}</time></button>) : <p className="field-empty">No comments...</p>}</div>
      : panel === 'New task' ? <div className="status-menu">{columns.map(c => <button key={c.status} onClick={() => { setPanel(''); setModal(newDraft(c.status)) }}><span className={`menu-dot ${c.color}`}/>{c.title}</button>)}</div>
      : <div className="status-menu"><button onClick={() => { setSort(v => !v); setPanel('') }}>Toggle alphabetical sorting</button><button onClick={() => { setFilterOpen(true); setPanel('') }}>Filter tasks</button><button onClick={() => openPanel('Labels')}>Manage labels</button></div>}
      {board.error && <p className="form-error" role="alert">{board.error}</p>}
    </Panel>}
  </div>
}
