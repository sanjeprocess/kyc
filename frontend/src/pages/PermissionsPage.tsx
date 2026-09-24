import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

function PermissionsPage() {
  const navigate = useNavigate()
  const videoRef = useRef<HTMLVideoElement>(null)
  const [cameraReady, setCameraReady] = useState(false)
  const [micReady, setMicReady] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const consent = sessionStorage.getItem('consent')
    if (!consent) {
      navigate('/policy')
      return
    }

    requestPermissions()

    return () => {
      const stream = videoRef.current?.srcObject as MediaStream | null
      stream?.getTracks().forEach((t) => t.stop())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate])

  const requestPermissions = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      })

      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }

      setCameraReady(true)
      setMicReady(true)
    } catch (err) {
      setError('Camera/microphone access was denied. Please allow access to continue.')
    }
  }

  const handleJoin = () => {
    const stream = videoRef.current?.srcObject as MediaStream | null
    stream?.getTracks().forEach((t) => t.stop())
    navigate('/waiting-room')
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-2xl text-center">
        <h1 className="text-xl font-bold text-slate-900">
          Prepare for your meeting
        </h1>

        <div className="mt-4 aspect-video w-full overflow-hidden rounded-lg bg-slate-900">
          <video ref={videoRef} autoPlay muted playsInline className="h-full w-full object-cover" />
        </div>

        {error && (
          <div className="mt-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600 text-left">
            {error}
          </div>
        )}

        <div className="mt-4 space-y-2 text-left">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-700">🎥 Camera</span>
            <span className={cameraReady ? 'text-green-600 font-medium' : 'text-slate-400'}>
              {cameraReady ? '✓ Ready' : 'Waiting...'}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-700">🎙️ Microphone</span>
            <span className={micReady ? 'text-green-600 font-medium' : 'text-slate-400'}>
              {micReady ? '✓ Ready' : 'Waiting...'}
            </span>
          </div>
        </div>

        <button
          onClick={handleJoin}
          disabled={!cameraReady || !micReady}
          className="mt-6 w-full rounded-lg bg-blue-600 px-4 py-2.5 font-semibold text-white hover:bg-blue-700 transition disabled:opacity-40"
        >
          Join Meeting
        </button>
      </div>
    </div>
  )
}

export default PermissionsPage