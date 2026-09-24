import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { io, Socket } from 'socket.io-client'

function WaitingRoomPage() {
  const navigate = useNavigate()
  const socketRef = useRef<Socket | null>(null)
  const [meeting, setMeeting] = useState<any>(null)
  const [status, setStatus] = useState<'waiting' | 'rejected'>('waiting')

  useEffect(() => {
    const meetingStr = sessionStorage.getItem('meeting')
    const consent = sessionStorage.getItem('consent')
    const participantName = sessionStorage.getItem('participantName') || 'Guest'
    if (!meetingStr || !consent) {
      navigate('/join')
      return
    }
    const m = JSON.parse(meetingStr)
    setMeeting(m)

    const socket = io('http://localhost:5000')
    socketRef.current = socket

    socket.on('connect', () => {
      socket.emit('request-to-join', { roomId: m.meeting_code, userName: participantName })
    })

    socket.on('join-approved', () => {
      navigate('/meeting-room')
    })

    socket.on('join-rejected', () => {
      setStatus('rejected')
    })

    return () => {
      socket.disconnect()
    }
  }, [navigate])

  if (!meeting) return null

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-2xl text-center">
        {status === 'waiting' ? (
          <>
            <div className="text-4xl animate-pulse">⏳</div>
            <h1 className="mt-3 text-xl font-bold text-slate-900">
              You're in the waiting room
            </h1>
            <p className="mt-2 text-slate-500">
              Please wait for the host to admit you.
            </p>
            <p className="mt-4 inline-flex items-center gap-2 text-sm text-green-600">
              <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" /> Connected
            </p>
          </>
        ) : (
          <>
            <div className="text-4xl">🚫</div>
            <h1 className="mt-3 text-xl font-bold text-slate-900">Access Denied</h1>
            <p className="mt-2 text-slate-500">
              The host did not admit you to this meeting.
            </p>
            <button
              onClick={() => navigate('/join')}
              className="mt-6 w-full rounded-lg bg-blue-600 px-4 py-2.5 font-semibold text-white hover:bg-blue-700 transition"
            >
              Back to Join
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default WaitingRoomPage