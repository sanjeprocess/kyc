import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'

function JoinMeetingPage() {
  const navigate = useNavigate()
  const [yourName, setYourName] = useState('')
  const [meetingCode, setMeetingCode] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await api.post('/meetings/join', { meetingCode, password })
      sessionStorage.setItem('meeting', JSON.stringify(res.data))
      sessionStorage.setItem('participantName', yourName.trim())
      navigate('/policy')
    } catch (err: any) {
      setError(err.response?.data?.message || 'Unable to join meeting.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-2xl text-center"
      >
        <h1 className="text-xl font-bold text-slate-900">
          Customer Meeting Platform
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          You're invited to a meeting
        </p>

        {error && (
          <div className="mt-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600 text-left">
            {error}
          </div>
        )}

        <div className="mt-6 text-left">
          <label className="block text-sm font-medium text-slate-700">
            Your Name
          </label>
          <input
            type="text"
            value={yourName}
            onChange={(e) => setYourName(e.target.value)}
            required
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g. Kavindaya"
          />
        </div>

        <div className="mt-4 text-left">
          <label className="block text-sm font-medium text-slate-700">
            Meeting ID
          </label>
          <input
            type="text"
            value={meetingCode}
            onChange={(e) => setMeetingCode(e.target.value)}
            required
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 font-mono"
            placeholder="MTG-XXXXX"
          />
        </div>

        <div className="mt-4 text-left">
          <label className="block text-sm font-medium text-slate-700">
            Meeting Password
          </label>
          <input
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 font-mono"
            placeholder="••••••"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="mt-6 w-full rounded-lg bg-blue-600 px-4 py-2.5 font-semibold text-white hover:bg-blue-700 transition disabled:opacity-50"
        >
          {loading ? 'Checking...' : 'Continue'}
        </button>
      </form>
    </div>
  )
}

export default JoinMeetingPage