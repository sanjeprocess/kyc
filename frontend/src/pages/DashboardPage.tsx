import { useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import api from '../services/api'
import logo from '../assets/logo.jpg'

interface Meeting {
  id: number
  meeting_code: string
  customer_name: string
  customer_email: string
  scheduled_date: string | null
  scheduled_time: string | null
  status: string
  password: string
}

type Tab = 'dashboard' | 'meetings' | 'settings'

function DashboardPage() {
  const navigate = useNavigate()
  const [userName, setUserName] = useState('')
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<Tab>('dashboard')

  useEffect(() => {
    const userStr = localStorage.getItem('user')
    const token = localStorage.getItem('token')

    if (!token || !userStr) {
      navigate('/')
      return
    }

    const user = JSON.parse(userStr)
    setUserName(user.name)

    fetchMeetings()
  }, [navigate])

  const fetchMeetings = async () => {
    try {
      const res = await api.get('/meetings')
      setMeetings(res.data)
    } catch (err) {
      console.error('Failed to load meetings', err)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    navigate('/')
  }

  const joinAsHost = (m: Meeting) => {
    sessionStorage.setItem('meeting', JSON.stringify(m))
    sessionStorage.setItem(
      'consent',
      JSON.stringify({ acceptedAt: new Date().toISOString(), items: ['host'] })
    )
    sessionStorage.setItem('isHost', 'true')
    navigate('/meeting-room')
  }

  const formatDate = (date: string | null) => {
    if (!date) return '—'
    return new Date(date).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  }

  const initials = (name: string) =>
    name
      .split(' ')
      .map((p) => p[0])
      .join('')
      .slice(0, 2)
      .toUpperCase()

  const filteredMeetings = meetings.filter(
    (m) =>
      m.customer_name.toLowerCase().includes(search.toLowerCase()) ||
      m.meeting_code.toLowerCase().includes(search.toLowerCase())
  )

  const today = new Date().toISOString().slice(0, 10)
  const todayCount = meetings.filter((m) => m.scheduled_date?.slice(0, 10) === today).length
  const upcomingCount = meetings.filter(
    (m) => m.scheduled_date && m.scheduled_date.slice(0, 10) > today
  ).length

  const pageTitle: Record<Tab, string> = {
    dashboard: `Good day, ${userName} 👋`,
    meetings: 'All Meetings',
    settings: 'Settings',
  }
  const pageSubtitle: Record<Tab, string> = {
    dashboard: "Here's what's happening with your meetings.",
    meetings: 'Manage and join your scheduled meetings.',
    settings: 'Manage your account preferences.',
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className="hidden md:flex w-64 flex-col bg-[#1b1140] text-white">
        <div className="flex items-center gap-3 px-6 py-6">
          <img src={logo} alt="WorkHub24" className="h-20 w-20 rounded-2xl object-cover" />
          <span className="font-semibold text-lg tracking-tight">WorkHub24</span>
        </div>

        <nav className="mt-4 flex-1 space-y-1 px-3">
          <SidebarItem
            icon="📊"
            label="Dashboard"
            active={activeTab === 'dashboard'}
            onClick={() => setActiveTab('dashboard')}
          />
          <SidebarItem
            icon="🎥"
            label="Meetings"
            active={activeTab === 'meetings'}
            onClick={() => setActiveTab('meetings')}
          />
          <SidebarItem
            icon="📅"
            label="Schedule"
            onClick={() => navigate('/create-meeting')}
          />
          <SidebarItem
            icon="⚙️"
            label="Settings"
            active={activeTab === 'settings'}
            onClick={() => setActiveTab('settings')}
          />
        </nav>

        <div className="px-3 pb-4">
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-300 hover:bg-white/5 hover:text-white transition"
          >
            <span>🚪</span>
            Logout
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">{pageTitle[activeTab]}</h1>
            <p className="text-sm text-slate-500">{pageSubtitle[activeTab]}</p>
          </div>

          <div className="flex items-center gap-3">
            {activeTab !== 'settings' && (
              <div className="hidden sm:flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <span className="text-slate-400">🔍</span>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search meetings..."
                  className="w-40 bg-transparent text-sm outline-none placeholder:text-slate-400"
                />
              </div>
            )}

            <button
              onClick={() => navigate('/create-meeting')}
              className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 transition"
            >
              <span>+</span>
              New Meeting
            </button>

            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-100 text-sm font-semibold text-violet-700">
              {initials(userName || 'U')}
            </div>
          </div>
        </header>

        {/* Body */}
        <main className="flex-1 overflow-y-auto p-6">
          {activeTab === 'settings' ? (
            <div className="max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="font-semibold text-slate-900">Account</h2>
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <span className="text-slate-500">Name</span>
                  <span className="font-medium text-slate-900">{userName}</span>
                </div>
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <span className="text-slate-500">Role</span>
                  <span className="font-medium text-slate-900">Admin</span>
                </div>
              </div>
              <p className="mt-6 text-xs text-slate-400">
                More settings (password change, notifications) coming soon.
              </p>
            </div>
          ) : (
            <>
              {activeTab === 'dashboard' && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <StatCard icon="📅" label="Today's Meetings" value={todayCount} tint="bg-violet-50" />
                  <StatCard icon="⏰" label="Upcoming" value={upcomingCount} tint="bg-amber-50" />
                  <StatCard icon="👥" label="Total Meetings" value={meetings.length} tint="bg-emerald-50" />
                </div>
              )}

              <div className="mt-8 rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                  <h2 className="font-semibold text-slate-900">
                    {activeTab === 'meetings' ? 'All Meetings' : 'Recent Meetings'}
                  </h2>
                  <span className="text-xs text-slate-400">{filteredMeetings.length} results</span>
                </div>

                {loading && (
                  <div className="px-6 py-10 text-center text-sm text-slate-400">Loading meetings...</div>
                )}

                {!loading && filteredMeetings.length === 0 && (
                  <div className="px-6 py-12 text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-xl">
                      🎥
                    </div>
                    <p className="mt-3 text-sm font-medium text-slate-600">No meetings found</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Click "New Meeting" to schedule your first one.
                    </p>
                  </div>
                )}

                <ul className="divide-y divide-slate-100">
                  {filteredMeetings.map((m) => (
                    <li
                      key={m.id}
                      className="flex items-center justify-between gap-4 px-6 py-4 hover:bg-slate-50 transition"
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-100 text-sm font-semibold text-violet-700">
                          {initials(m.customer_name)}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-900">{m.customer_name}</p>
                          <p className="truncate text-xs text-slate-400 font-mono">{m.meeting_code}</p>
                        </div>
                      </div>

                      <div className="hidden sm:flex flex-col items-end text-xs text-slate-500">
                        <span>{formatDate(m.scheduled_date)}</span>
                        <span>{m.scheduled_time || '—'}</span>
                      </div>

                      <span className="hidden sm:inline-block rounded-full bg-violet-50 px-3 py-1 text-xs font-medium text-violet-600">
                        {m.status}
                      </span>

                      <button
                        onClick={() => joinAsHost(m)}
                        className="flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition shrink-0"
                      >
                        Join →
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  )
}

function SidebarItem({
  icon,
  label,
  active,
  onClick,
}: {
  icon: string
  label: string
  active?: boolean
  onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
        active
          ? 'bg-violet-600 text-white'
          : 'text-slate-300 hover:bg-white/5 hover:text-white'
      }`}
    >
      <span>{icon}</span>
      {label}
    </button>
  )
}

function StatCard({
  icon,
  label,
  value,
  tint,
}: {
  icon: string
  label: string
  value: number
  tint: string
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl text-lg ${tint}`}>
          {icon}
        </div>
        <div>
          <p className="text-xs text-slate-500">{label}</p>
          <p className="text-2xl font-bold text-slate-900">{value}</p>
        </div>
      </div>
    </div>
  )
}

export default DashboardPage