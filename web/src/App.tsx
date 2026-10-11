import { useEffect, useState, type FormEvent } from 'react'
import {
  ArrowDownWideNarrow,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  CheckCheck,
  Circle,
  Clock3,
  LogOut,
  Plus,
  Repeat2,
  Search,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'
import './App.css'

type Recurrence = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly'
type View = 'today' | 'upcoming' | 'all' | 'completed' | 'calendar'

type Task = {
  id: string
  title: string
  description: string | null
  completed: boolean
  start_date: string | null
  due_date: string | null
  priority: number
  recurrence: Recurrence
  repeat_until: string | null
}

type Draft = Omit<Task, 'id'>

const emptyDraft: Draft = {
  title: '',
  description: '',
  completed: false,
  start_date: '',
  due_date: '',
  priority: 2,
  recurrence: 'none',
  repeat_until: '',
}

const views: { id: View; label: string; icon: typeof Clock3 }[] = [
  { id: 'today', label: 'Today', icon: Clock3 },
  { id: 'upcoming', label: 'Upcoming', icon: ArrowDownWideNarrow },
  { id: 'all', label: 'All tasks', icon: Circle },
  { id: 'completed', label: 'Completed', icon: CheckCheck },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays },
]

const priorityNames: Record<number, string> = {
  1: 'Urgent',
  2: 'High',
  3: 'Normal',
  4: 'Low',
}

async function request<T>(path: string, token: string | null, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: token } : {}),
      ...init.headers,
    },
  })

  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string }
    throw new Error(body.error ?? 'Something went wrong. Please try again.')
  }

  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function localToday() {
  return dateKey(new Date())
}

function displayDate(value: string | null) {
  if (!value) return 'No date'
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(`${value.slice(0, 10)}T12:00:00`))
}

function App() {
  const [token, setToken] = useState(() => localStorage.getItem('taeski-token'))
  const [username, setUsername] = useState(() => localStorage.getItem('taeski-username') ?? '')
  const [tasks, setTasks] = useState<Task[]>([])
  const [activeView, setActiveView] = useState<View>('today')
  const [query, setQuery] = useState('')
  const [showEditor, setShowEditor] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [selectedDate, setSelectedDate] = useState('')
  const [month, setMonth] = useState(() => new Date())
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(() => Boolean(localStorage.getItem('taeski-token')))

  useEffect(() => {
    if (!token) return
    let cancelled = false
    request<Task[]>('/api/tasks', token)
      .then((data) => { if (!cancelled) setTasks(data) })
      .catch((error: Error) => { if (!cancelled) setNotice(error.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [token])

  const today = localToday()
  const visibleTasks = tasks.filter((task) => {
    const matchesText = `${task.title} ${task.description ?? ''}`.toLowerCase().includes(query.toLowerCase())
    if (!matchesText) return false
    if (activeView === 'completed') return task.completed
    if (task.completed) return false
    if (activeView === 'today') return (!task.start_date || task.start_date <= today) && (!task.due_date || task.due_date <= today || Boolean(task.start_date && task.start_date <= today))
    if (activeView === 'upcoming') return task.start_date ? task.start_date > today : Boolean(task.due_date && task.due_date > today)
    return activeView === 'all' || activeView === 'calendar'
  }).sort((a, b) => a.priority - b.priority || (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999'))

  const counts: Record<View, number> = {
    today: tasks.filter((task) => !task.completed && (!task.start_date || task.start_date <= today) && (!task.due_date || task.due_date <= today || Boolean(task.start_date && task.start_date <= today))).length,
    upcoming: tasks.filter((task) => !task.completed && (task.due_date ? task.due_date > today : Boolean(task.start_date && task.start_date > today))).length,
    all: tasks.filter((task) => !task.completed).length,
    completed: tasks.filter((task) => task.completed).length,
    calendar: 0,
  }

  async function reloadTasks() {
    setTasks(await request<Task[]>('/api/tasks', token))
  }

  async function handleAuth(event: FormEvent<HTMLFormElement>, mode: 'login' | 'signup') {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const name = String(form.get('username') ?? '').trim()
    const password = String(form.get('password') ?? '')
    try {
      const result = await request<{ token: string }>(`/api/auth/${mode}`, null, {
        method: 'POST',
        body: JSON.stringify({ username: name, password }),
      })
      localStorage.setItem('taeski-token', result.token)
      localStorage.setItem('taeski-username', name)
      setUsername(name)
      setLoading(true)
      setToken(result.token)
      setNotice('')
    } catch (error) {
      setNotice((error as Error).message)
    }
  }

  async function saveTask(draft: Draft) {
    const path = editingTask ? `/api/tasks/${editingTask.id}` : '/api/tasks'
    const saved = await request<Task>(path, token, {
      method: editingTask ? 'PUT' : 'POST',
      body: JSON.stringify({
        ...draft,
        description: draft.description || null,
        start_date: draft.start_date || null,
        due_date: draft.due_date || null,
        repeat_until: draft.repeat_until || null,
      }),
    })
    if (editingTask) setTasks((current) => current.map((task) => task.id === saved.id ? saved : task))
    else setTasks((current) => [...current, saved])
    setEditingTask(null)
    setShowEditor(false)
  }

  async function toggleTask(task: Task) {
    try {
      await request<Task>(`/api/tasks/${task.id}`, token, {
        method: 'PUT',
        body: JSON.stringify({ ...task, completed: !task.completed }),
      })
      await reloadTasks()
    } catch (error) {
      setNotice((error as Error).message)
    }
  }

  async function deleteTask(task: Task) {
    try {
      await request<void>(`/api/tasks/${task.id}`, token, { method: 'DELETE' })
      setTasks((current) => current.filter((item) => item.id !== task.id))
    } catch (error) {
      setNotice((error as Error).message)
    }
  }

  function signOut() {
    localStorage.removeItem('taeski-token')
    localStorage.removeItem('taeski-username')
    setToken(null)
    setTasks([])
  }

  if (!token) {
    return <AuthScreen onSubmit={handleAuth} notice={notice} />
  }

  const activeLabel = views.find((view) => view.id === activeView)?.label ?? 'Today'

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#today" onClick={() => setActiveView('today')}>
          <span className="brand-mark"><Sparkles size={18} /></span>
          <span>Täski<span className="brand-period">.</span></span>
        </a>
              <button className="new-task-button" onClick={() => { setEditingTask(null); setSelectedDate(''); setShowEditor(true) }}>
          <Plus size={18} /> <span>New task</span> <kbd>N</kbd>
        </button>
        <div className="nav-label">Workspace</div>
        <nav className="side-nav" aria-label="Task views">
          {views.map(({ id, label, icon: Icon }) => (
            <button key={id} className={`nav-item ${activeView === id ? 'active' : ''}`} onClick={() => setActiveView(id)}>
              <Icon size={17} strokeWidth={1.8} />
              <span>{label}</span>
              {counts[id] > 0 && <span className="nav-count">{counts[id]}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="account-row">
            <span className="avatar">{username.slice(0, 1).toUpperCase()}</span>
            <span className="account-name">{username}</span>
            <button className="icon-button signout-button" title="Sign out" aria-label="Sign out" onClick={signOut}><LogOut size={16} /></button>
          </div>
          <div className="sidebar-footnote">A little more room to think.</div>
        </div>
      </aside>

      <section className="main-panel">
        <header className="topbar">
          <div className="breadcrumbs"><span>My tasks</span><span className="crumb-slash">/</span><strong>{activeLabel}</strong></div>
          <label className="search-box">
            <Search size={16} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a task" aria-label="Find a task" />
            <kbd>/</kbd>
          </label>
        </header>

        <div className="content-wrap">
          <div className="page-heading">
            <div>
              <div className="eyebrow">{activeView === 'today' ? new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date()) : 'YOUR WORKSPACE'}</div>
              <h1>{activeView === 'today' ? 'Today' : activeLabel}</h1>
              <p>{activeView === 'today' ? 'Make space for what matters.' : `${visibleTasks.length} ${visibleTasks.length === 1 ? 'task' : 'tasks'} in this view`}</p>
            </div>
            {activeView !== 'calendar' && (
              <button className="primary-button" onClick={() => { setEditingTask(null); setSelectedDate(''); setShowEditor(true) }}><Plus size={17} /> Add task</button>
            )}
          </div>

          {notice && <div className="notice" role="status"><span>{notice}</span><button onClick={() => setNotice('')} aria-label="Dismiss message"><X size={16} /></button></div>}

          {activeView === 'calendar' ? (
            <CalendarView tasks={tasks.filter((task) => !task.completed)} month={month} onMonthChange={setMonth} onSelectDate={(date) => {
              setEditingTask(null)
              setSelectedDate(date)
              setShowEditor(true)
            }} onEdit={(task) => { setEditingTask(task); setShowEditor(true) }} />
          ) : (
            <TaskList
              tasks={visibleTasks}
              loading={loading}
              view={activeView}
              onToggle={toggleTask}
              onEdit={(task) => { setEditingTask(task); setShowEditor(true) }}
              onDelete={deleteTask}
              onAdd={() => { setEditingTask(null); setSelectedDate(''); setShowEditor(true) }}
            />
          )}
          <footer className="work-footer"><span><Check size={14} /> Synced to your workspace</span><span>{tasks.filter((task) => !task.completed).length} open tasks</span></footer>
        </div>
      </section>

      {showEditor && <TaskEditor initial={editingTask} initialDate={selectedDate} onClose={() => { setShowEditor(false); setEditingTask(null); setSelectedDate('') }} onSave={saveTask} />}
    </main>
  )
}

function AuthScreen({ onSubmit, notice }: { onSubmit: (event: FormEvent<HTMLFormElement>, mode: 'login' | 'signup') => void; notice: string }) {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  return (
    <main className="auth-screen">
      <section className="auth-aside">
        <a className="brand auth-brand" href="#home"><span className="brand-mark"><Sparkles size={18} /></span><span>Täski<span className="brand-period">.</span></span></a>
        <div className="auth-note"><span className="auth-index">01 / MAKE ROOM</span><h1>Small steps.<br /><em>Clear mind.</em></h1><p>Keep the moving pieces together, and give your attention back to the work in front of you.</p></div>
        <div className="auth-decoration"><span>PLAN</span><span>DO</span><span>RESET</span><div className="orbit orbit-one" /><div className="orbit orbit-two" /></div>
        <span className="auth-copyright">A calmer way to get things done.</span>
      </section>
      <section className="auth-main">
        <div className="auth-form-wrap">
          <span className="eyebrow">YOUR PERSONAL WORKSPACE</span>
          <h2>{mode === 'login' ? 'Welcome back' : 'Create your space'}</h2>
          <p className="auth-subtitle">{mode === 'login' ? 'Pick up where you left off.' : 'A fresh start for everything on your list.'}</p>
          <div className="auth-tabs" role="tablist" aria-label="Account access">
            <button role="tab" aria-selected={mode === 'login'} className={mode === 'login' ? 'selected' : ''} onClick={() => setMode('login')}>Sign in</button>
            <button role="tab" aria-selected={mode === 'signup'} className={mode === 'signup' ? 'selected' : ''} onClick={() => setMode('signup')}>Create account</button>
          </div>
          <form className="auth-form" onSubmit={(event) => onSubmit(event, mode)}>
            <label>Username<input name="username" required autoComplete="username" placeholder="Your username" /></label>
            <label>Password<input name="password" type="password" required autoComplete={mode === 'login' ? 'current-password' : 'new-password'} placeholder="Your password" /></label>
            {notice && <div className="form-error" role="alert">{notice}</div>}
            <button className="primary-button auth-submit" type="submit">{mode === 'login' ? 'Sign in' : 'Create account'} <ArrowRight size={17} /></button>
          </form>
        </div>
      </section>
    </main>
  )
}

function TaskList({ tasks, loading, view, onToggle, onEdit, onDelete, onAdd }: {
  tasks: Task[]; loading: boolean; view: View; onToggle: (task: Task) => void; onEdit: (task: Task) => void; onDelete: (task: Task) => void; onAdd: () => void
}) {
  if (loading) return <div className="list-state">Gathering your tasks<span className="loading-dots">...</span></div>
  if (!tasks.length) {
    return <div className="empty-state"><span className="empty-icon"><CheckCheck size={23} /></span><h2>{view === 'completed' ? 'Nothing completed yet' : 'All clear for now'}</h2><p>{view === 'today' ? 'A little breathing room. Add a task whenever you are ready.' : 'Your tasks will show up here when they match this view.'}</p>{view !== 'completed' && <button className="text-button" onClick={onAdd}><Plus size={16} /> Add a task</button>}</div>
  }
  const groups = view === 'completed'
    ? [{ label: 'Finished', tasks }]
    : [{ label: view === 'today' ? 'ON YOUR LIST' : 'TASKS', tasks: tasks.filter((task) => !task.completed) }, { label: 'COMPLETED', tasks: tasks.filter((task) => task.completed) }].filter((group) => group.tasks.length)
  return <div className="task-groups">{groups.map((group) => <section className="task-group" key={group.label}>
    <div className="group-heading"><span>{group.label}</span><span className="group-rule" /><span className="group-count">{group.tasks.length}</span></div>
    <div className="task-list">{group.tasks.map((task) => <article className={`task-row ${task.completed ? 'is-complete' : ''}`} key={task.id}>
      <button className={`task-check ${task.completed ? 'checked' : ''}`} onClick={() => onToggle(task)} aria-label={task.completed ? `Reopen ${task.title}` : `Complete ${task.title}`}>{task.completed && <Check size={13} />}</button>
      <button className="task-copy" onClick={() => onEdit(task)}>
        <span className="task-title">{task.title}</span>
        {task.description && <span className="task-description">{task.description}</span>}
      </button>
      <div className="task-meta">
        <span className={`priority-dot priority-${task.priority}`} title={`${priorityNames[task.priority]} priority`} />
        <span className="priority-label">{priorityNames[task.priority]}</span>
        {task.recurrence !== 'none' && <span className="repeat-label" title={`Repeats ${task.recurrence}`}><Repeat2 size={13} /></span>}
        <span className="task-date">{displayDate(task.due_date ?? task.start_date)}</span>
      </div>
      <div className="task-actions"><button className="icon-button" title="Edit task" aria-label={`Edit ${task.title}`} onClick={() => onEdit(task)}><ArrowRight size={15} /></button><button className="icon-button delete-action" title="Delete task" aria-label={`Delete ${task.title}`} onClick={() => onDelete(task)}><Trash2 size={15} /></button></div>
    </article>)}</div>
  </section>)}</div>
}

function CalendarView({ tasks, month, onMonthChange, onSelectDate, onEdit }: {
  tasks: Task[]; month: Date; onMonthChange: (date: Date) => void; onSelectDate: (date: string) => void; onEdit: (task: Task) => void
}) {
  const year = month.getFullYear()
  const monthIndex = month.getMonth()
  const firstDay = new Date(year, monthIndex, 1).getDay()
  const dayCount = new Date(year, monthIndex + 1, 0).getDate()
  const cells = Array.from({ length: Math.ceil((firstDay + dayCount) / 7) * 7 }, (_, index) => {
    const day = index - firstDay + 1
    return day > 0 && day <= dayCount ? day : null
  })
  const monthLabel = new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' }).format(month)
  return <div className="calendar-panel">
    <div className="calendar-toolbar"><div><span className="eyebrow">PLAN AHEAD</span><h2>{monthLabel}</h2></div><div className="calendar-controls"><button className="icon-button" title="Previous month" aria-label="Previous month" onClick={() => onMonthChange(new Date(year, monthIndex - 1, 1))}><ArrowLeft size={17} /></button><button className="today-button" onClick={() => onMonthChange(new Date())}>Today</button><button className="icon-button" title="Next month" aria-label="Next month" onClick={() => onMonthChange(new Date(year, monthIndex + 1, 1))}><ArrowRight size={17} /></button></div></div>
    <div className="calendar-grid calendar-weekdays">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <span key={day}>{day}</span>)}</div>
    <div className="calendar-grid calendar-days">{cells.map((day, index) => {
      const key = day ? dateKey(new Date(year, monthIndex, day)) : ''
      const dayTasks = tasks.filter((task) => task.due_date === key || (!task.due_date && task.start_date === key))
      return <div className={`calendar-cell ${day ? '' : 'outside'} ${key === localToday() ? 'is-today' : ''}`} key={`${key}-${index}`}>
        {day && <><button className="calendar-day-number" onClick={() => onSelectDate(key)} aria-label={`Add task on ${key}`}>{day}</button><div className="calendar-cell-tasks">{dayTasks.slice(0, 3).map((task) => <button className={`calendar-task priority-bg-${task.priority}`} key={task.id} onClick={() => onEdit(task)}>{task.title}</button>)}{dayTasks.length > 3 && <span className="more-tasks">+{dayTasks.length - 3} more</span>}</div></>}
      </div>
    })}</div>
    <div className="calendar-hint"><span className="priority-dot priority-1" /> Urgent <span className="priority-dot priority-2" /> High <span className="priority-dot priority-3" /> Normal <span className="priority-dot priority-4" /> Low</div>
  </div>
}

function TaskEditor({ initial, initialDate, onClose, onSave }: { initial: Task | null; initialDate: string; onClose: () => void; onSave: (draft: Draft) => Promise<void> }) {
  const [draft, setDraft] = useState<Draft>(() => initial ? {
    title: initial.title,
    description: initial.description ?? '',
    completed: initial.completed,
    start_date: initial.start_date?.slice(0, 10) ?? '',
    due_date: initial.due_date?.slice(0, 10) ?? '',
    priority: initial.priority,
    recurrence: initial.recurrence,
    repeat_until: initial.repeat_until?.slice(0, 10) ?? '',
  } : { ...emptyDraft, start_date: initialDate })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try { await onSave(draft) } catch (saveError) { setError((saveError as Error).message) } finally { setSaving(false) }
  }

  function update<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section className="task-editor" role="dialog" aria-modal="true" aria-labelledby="editor-title">
      <header className="editor-header"><div><span className="eyebrow">TASK DETAILS</span><h2 id="editor-title">{initial ? 'Edit task' : 'Make a plan'}</h2></div><button className="icon-button" onClick={onClose} title="Close" aria-label="Close"><X size={19} /></button></header>
      <form onSubmit={submit} className="editor-form">
        <label className="field-label">Task name<input autoFocus required maxLength={255} value={draft.title} onChange={(event) => update('title', event.target.value)} placeholder="What needs doing?" /></label>
        <label className="field-label">Notes <span className="optional">OPTIONAL</span><textarea rows={3} value={draft.description ?? ''} onChange={(event) => update('description', event.target.value)} placeholder="Add a little context" /></label>
        <div className="form-row"><label className="field-label">Start date<input id="task-start-date" type="date" value={draft.start_date ?? ''} onChange={(event) => update('start_date', event.target.value)} /></label><label className="field-label">End date<input type="date" value={draft.due_date ?? ''} min={draft.start_date ?? undefined} onChange={(event) => update('due_date', event.target.value)} /></label></div>
        <div className="form-row"><label className="field-label">Priority<select value={draft.priority} onChange={(event) => update('priority', Number(event.target.value))}><option value={1}>Urgent</option><option value={2}>High</option><option value={3}>Normal</option><option value={4}>Low</option></select></label><label className="field-label">Repeat<select value={draft.recurrence} onChange={(event) => update('recurrence', event.target.value as Recurrence)}><option value="none">Does not repeat</option><option value="daily">Every day</option><option value="weekly">Every week</option><option value="monthly">Every month</option><option value="yearly">Every year</option></select></label></div>
        {draft.recurrence !== 'none' && <label className="field-label">Repeat until <span className="optional">OPTIONAL</span><input type="date" value={draft.repeat_until ?? ''} onChange={(event) => update('repeat_until', event.target.value)} /></label>}
        {error && <div className="form-error" role="alert">{error}</div>}
        <footer className="editor-footer"><button className="cancel-button" type="button" onClick={onClose}>Cancel</button><button className="primary-button" type="submit" disabled={saving}>{saving ? 'Saving...' : initial ? 'Save changes' : 'Add task'} <ArrowRight size={16} /></button></footer>
      </form>
    </section>
  </div>
}

export default App