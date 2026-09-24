import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'

function CreateMeetingPage() {
  const navigate = useNavigate()
  const [customerName, setCustomerName] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [scheduledDate, setScheduledDate] = useState('')
  const [scheduledTime, setScheduledTime] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [created, setCreated] = useState<any>(null)
  const [copied, setCopied] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const userStr = localStorage.getItem('user')
      const user = userStr ? JSON.parse(userStr) : null

      const res = await api.post('/meetings', {
        hostId: user?.id,
        customerName,
        customerEmail,
        customerPhone,
        scheduledDate,
        scheduledTime,
      })

      setCreated(res.data)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create meeting.')
    } finally {
      setLoading(false)
    }
  }

  const buildInvitationText = () => {
    if (!created) return ''
    const joinLink = `${window.location.origin}/join`
    const dateText = created.scheduled_date
      ? new Date(created.scheduled_date).toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        })
      : ''
    const timeText = created.scheduled_time || ''

    return [
      `You are invited to a customer meeting.`,
      ``,
      `Join here: ${joinLink}`,
      `Meeting ID: ${created.meeting_code}`,
      `Password: ${created.password}`,
      dateText || timeText ? `Scheduled: ${dateText} ${timeText}`.trim() : '',
    ]
      .filter(Boolean)
      .join('\n')
  }

  const sendViaWhatsApp = () => {
    const text = buildInvitationText()
    const phone = customerPhone.replace(/[^0-9]/g, '') // digits only
    const url = phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`
    window.open(url, '_blank')
  }

  const sendViaEmail = () => {
    const text = buildInvitationText()
    const subject = `Meeting Invitation - ${created.meeting_code}`
    const url = `mailto:${customerEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`
    window.location.href = url
  }

  const copyInvitation = async () => {
    const text = buildInvitationText()
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Copy failed', err)
    }
  }

  if (created) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl text-center">
          <div className="text-4xl">✅</div>
          <h1 className="mt-3 text-xl font-bold text-slate-900">
            Meeting Created Successfully
          </h1>

          <div className="mt-6 text-left space-y-3">
            <div>
              <p className="text-xs font-medium text-slate-500">Meeting ID</p>
              <p className="font-mono text-lg font-semibold text-blue-600">
                {created.meeting_code}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Customer</p>
              <p className="text-slate-900">{created.customer_name}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Meeting Password</p>
              <p className="font-mono text-slate-900">{created.password}</p>
            </div>
          </div>

          <div className="mt-6 border-t border-slate-200 pt-6">
            <p className="text-sm font-medium text-slate-700 mb-3 text-left">
              Send invitation to customer
            </p>

            <div className="space-y-2">
              <button
                onClick={sendViaWhatsApp}
                className="w-full rounded-lg bg-green-600 px-4 py-2.5 font-semibold text-white hover:bg-green-700 transition flex items-center justify-center gap-2"
              >
                💬 Send via WhatsApp
              </button>

              <button
                onClick={sendViaEmail}
                disabled={!customerEmail}
                className="w-full rounded-lg bg-blue-600 px-4 py-2.5 font-semibold text-white hover:bg-blue-700 transition disabled:opacity-40 flex items-center justify-center gap-2"
              >
                📧 Send via Email
              </button>

              <button
                onClick={copyInvitation}
                className="w-full rounded-lg border border-slate-300 px-4 py-2.5 font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                {copied ? '✓ Copied!' : '📋 Copy Invitation Text'}
              </button>
            </div>

            {!customerEmail && (
              <p className="mt-2 text-xs text-slate-400 text-left">
                Email button disabled — no customer email was entered.
              </p>
            )}
          </div>

          <button
            onClick={() => navigate('/dashboard')}
            className="mt-6 w-full rounded-lg bg-slate-200 px-4 py-2.5 font-semibold text-slate-700 hover:bg-slate-300 transition"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl"
      >
        <h1 className="text-xl font-bold text-slate-900">Create New Meeting</h1>

        {error && (
          <div className="mt-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">
            {error}
          </div>
        )}

        <div className="mt-6">
          <label className="block text-sm font-medium text-slate-700">Customer Name</label>
          <input
            type="text"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            required
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="ABC Company"
          />
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium text-slate-700">Customer Email</label>
          <input
            type="email"
            value={customerEmail}
            onChange={(e) => setCustomerEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="customer@email.com"
          />
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium text-slate-700">Customer Phone (with country code)</label>
          <input
            type="text"
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="94771234567"
          />
          <p className="mt-1 text-xs text-slate-400">
            e.g. 94771234567 (no + or leading 0) — used for WhatsApp
          </p>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-slate-700">Date</label>
            <input
              type="date"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Time</label>
            <input
              type="time"
              value={scheduledTime}
              onChange={(e) => setScheduledTime(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="flex-1 rounded-lg border border-slate-300 px-4 py-2.5 font-semibold text-slate-700 hover:bg-slate-50 transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 font-semibold text-white hover:bg-blue-700 transition disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Create Meeting'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default CreateMeetingPage