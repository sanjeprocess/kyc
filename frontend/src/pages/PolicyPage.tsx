import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

interface PolicyItem {
  id: string
  label: string
}

const POLICIES: PolicyItem[] = [
  { id: 'camera', label: 'I consent to my camera being turned ON and my video being visible during this meeting.' },
  { id: 'microphone', label: 'I consent to my microphone being turned ON and my audio being captured during this meeting.' },
  { id: 'recording', label: 'I understand this meeting will be recorded in full (video and audio) for quality and compliance purposes.' },
  { id: 'privacy', label: 'I have read and agree to the Privacy Policy regarding how my data will be stored and used.' },
]

function PolicyPage() {
  const navigate = useNavigate()
  const [meeting, setMeeting] = useState<any>(null)
  const [checked, setChecked] = useState<Record<string, boolean>>({})

  useEffect(() => {
    const meetingStr = sessionStorage.getItem('meeting')
    if (!meetingStr) {
      navigate('/join')
      return
    }
    setMeeting(JSON.parse(meetingStr))
  }, [navigate])

  const toggle = (id: string) => {
    setChecked((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const allAccepted = POLICIES.every((p) => checked[p.id])

  const handleAccept = () => {
    if (!allAccepted) return

    sessionStorage.setItem(
      'consent',
      JSON.stringify({
        acceptedAt: new Date().toISOString(),
        items: POLICIES.map((p) => p.id),
      })
    )

    navigate('/permissions')
  }

  if (!meeting) return null

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-lg rounded-2xl bg-white p-8 shadow-2xl">
        <h1 className="text-xl font-bold text-slate-900 text-center">
          Meeting Consent Required
        </h1>
        <p className="mt-1 text-sm text-slate-500 text-center">
          Please review and accept the following before joining
        </p>

        <div className="mt-4 rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600">
          <p><span className="font-medium text-slate-800">Meeting:</span> {meeting.meeting_code}</p>
          <p><span className="font-medium text-slate-800">Host:</span> {meeting.customer_name}</p>
        </div>

        <div className="mt-6 space-y-3">
          {POLICIES.map((policy) => (
            <label
              key={policy.id}
              className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 cursor-pointer hover:bg-slate-50 transition"
            >
              <input
                type="checkbox"
                checked={!!checked[policy.id]}
                onChange={() => toggle(policy.id)}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-slate-700">{policy.label}</span>
            </label>
          ))}
        </div>

        <p className="mt-4 text-xs text-slate-400 text-center">
          You must accept all items above to continue. You cannot proceed to the meeting without granting camera, audio, and recording consent.
        </p>

        <button
          onClick={handleAccept}
          disabled={!allAccepted}
          className="mt-6 w-full rounded-lg bg-blue-600 px-4 py-2.5 font-semibold text-white hover:bg-blue-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Accept & Continue
        </button>
      </div>
    </div>
  )
}

export default PolicyPage