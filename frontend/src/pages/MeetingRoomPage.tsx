import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { io, Socket } from 'socket.io-client'

interface RemotePeer {
  socketId: string
  userName: string
  stream?: MediaStream
}

interface JoinRequest {
  socketId: string
  userName: string
}

const DB_NAME = 'cmp-recording-db'
const STORE_NAME = 'handles'
const FOLDER_KEY = 'recordingFolder'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)

    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME)
    }

    req.onsuccess = () => resolve(req.result)

    req.onerror = () => reject(req.error)
  })
}

async function saveFolderHandle(handle: FileSystemDirectoryHandle) {
  const db = await openDb()

  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')

    tx.objectStore(STORE_NAME).put(handle, FOLDER_KEY)

    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

async function loadFolderHandle(): Promise<FileSystemDirectoryHandle | null> {
  const db = await openDb()

  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readonly')

    const req = tx.objectStore(STORE_NAME).get(FOLDER_KEY)

    req.onsuccess = () => resolve(req.result || null)
    req.onerror = () => resolve(null)
  })
}

function MeetingRoomPage() {
  const navigate = useNavigate()

  const localVideoRef = useRef<HTMLVideoElement | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const cameraTrackRef = useRef<MediaStreamTrack | null>(null)
  const screenStreamRef = useRef<MediaStream | null>(null)

  const socketRef = useRef<Socket | null>(null)
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map())

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafIdRef = useRef<number | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const recordedChunksRef = useRef<Blob[]>([])

  const audioContextRef = useRef<AudioContext | null>(null)
  const audioDestRef = useRef<MediaStreamAudioDestinationNode | null>(null)

  const remoteVideoElsRef = useRef<Map<string, HTMLVideoElement>>(new Map())

  const folderHandleRef = useRef<FileSystemDirectoryHandle | null>(null)

  const [meeting, setMeeting] = useState<any>(null)
  const [isHost, setIsHost] = useState(false)

  const [remotePeers, setRemotePeers] = useState<Map<string, RemotePeer>>(
    new Map()
  )

  const [micOn, setMicOn] = useState(true)
  const [camOn, setCamOn] = useState(true)

  const [isScreenSharing, setIsScreenSharing] = useState(false)

  const [isRecording, setIsRecording] = useState(false)
  const [recordSeconds, setRecordSeconds] = useState(0)

  const [folderName, setFolderName] = useState<string>('')
  const [saveStatus, setSaveStatus] = useState<string>('')

  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([])

  const recordTimerRef = useRef<number | null>(null)

  
  const setLocalVideoEl = useCallback((el: HTMLVideoElement | null) => {
    localVideoRef.current = el

    if (el) {
      el.srcObject = screenStreamRef.current || localStreamRef.current
    }
  }, [])

  useEffect(() => {
    const meetingStr = sessionStorage.getItem('meeting')
    const consent = sessionStorage.getItem('consent')

    if (!meetingStr || !consent) {
      navigate('/join')
      return
    }

    const m = JSON.parse(meetingStr)

    const hostFlag = sessionStorage.getItem('isHost') === 'true'

    setMeeting(m)
    setIsHost(hostFlag)

    const participantName =
      sessionStorage.getItem('participantName') || m.customer_name

    setupRoom(m.meeting_code, hostFlag ? 'Host' : participantName, hostFlag)

    restoreFolder()

    return () => {
      cleanup()
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const restoreFolder = async () => {
    const handle = await loadFolderHandle()

    if (!handle) return

    const perm = await (handle as any).queryPermission({
      mode: 'readwrite',
    })

    if (perm === 'granted') {
      folderHandleRef.current = handle
      setFolderName(handle.name)
    } else {
      setFolderName(handle.name + ' (click "Choose Folder" to re-allow)')
    }
  }

  const chooseFolder = async () => {
    if (!('showDirectoryPicker' in window)) {
      alert(
        'Your browser does not support choosing a folder. Recordings will download to your Downloads folder instead.'
      )
      return
    }

    try {
      const handle = await (window as any).showDirectoryPicker({
        mode: 'readwrite',
      })

      folderHandleRef.current = handle

      setFolderName(handle.name)

      await saveFolderHandle(handle)
    } catch (err) {
      // User cancelled
    }
  }

  const setupRoom = async (
    roomId: string,
    userName: string,
    hostFlag: boolean
  ) => {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    })

    localStreamRef.current = stream

    cameraTrackRef.current = stream.getVideoTracks()[0] || null

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream
    }

    const socket = io('http://localhost:5000')

    socketRef.current = socket

    socket.on('connect', () => {
      socket.emit('join-room', {
        roomId,
        userName,
        isHost: hostFlag,
      })
    })

    socket.on(
      'existing-users',
      (users: { socketId: string; userName: string }[]) => {
        users.forEach((u) => createPeerConnection(u.socketId, u.userName, true))
      }
    )

    socket.on(
      'user-joined',
      ({ socketId, userName }: { socketId: string; userName: string }) => {
        createPeerConnection(socketId, userName, false)
      }
    )

    socket.on('join-request', ({ socketId, userName }: JoinRequest) => {
      setJoinRequests((prev) => [...prev, { socketId, userName }])
    })

    socket.on(
      'signal',
      async ({ from, signal }: { from: string; signal: any }) => {
        const pc = peersRef.current.get(from)

        if (!pc) return

        if (signal.type === 'offer') {
          await pc.setRemoteDescription(new RTCSessionDescription(signal))

          const answer = await pc.createAnswer()

          await pc.setLocalDescription(answer)

          socket.emit('signal', {
            to: from,
            from: socket.id,
            signal: pc.localDescription,
          })
        } else if (signal.type === 'answer') {
          await pc.setRemoteDescription(new RTCSessionDescription(signal))
        } else if (signal.candidate) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(signal))
          } catch (e) {
            console.error('ICE candidate error', e)
          }
        }
      }
    )

    socket.on('user-left', ({ socketId }: { socketId: string }) => {
      peersRef.current.get(socketId)?.close()

      peersRef.current.delete(socketId)

      remoteVideoElsRef.current.delete(socketId)

      setRemotePeers((prev) => {
        const next = new Map(prev)

        next.delete(socketId)

        return next
      })
    })
  }

  const admitRequest = (req: JoinRequest) => {
    socketRef.current?.emit('admit', {
      roomId: meeting.meeting_code,
      socketId: req.socketId,
    })

    setJoinRequests((prev) => prev.filter((r) => r.socketId !== req.socketId))
  }

  const rejectRequest = (req: JoinRequest) => {
    socketRef.current?.emit('reject', {
      roomId: meeting.meeting_code,
      socketId: req.socketId,
    })

    setJoinRequests((prev) => prev.filter((r) => r.socketId !== req.socketId))
  }

  const createPeerConnection = (
    socketId: string,
    userName: string,
    isInitiator: boolean
  ) => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    })

    localStreamRef.current?.getTracks().forEach((track) => {
      pc.addTrack(track, localStreamRef.current!)
    })

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current?.emit('signal', {
          to: socketId,
          from: socketRef.current.id,
          signal: event.candidate,
        })
      }
    }

    pc.ontrack = (event) => {
      setRemotePeers((prev) => {
        const next = new Map(prev)

        next.set(socketId, {
          socketId,
          userName,
          stream: event.streams[0],
        })

        return next
      })

      if (audioContextRef.current && audioDestRef.current) {
        try {
          const src = audioContextRef.current.createMediaStreamSource(
            event.streams[0]
          )

          src.connect(audioDestRef.current)
        } catch (e) {
          console.error('Could not mix remote audio', e)
        }
      }
    }

    peersRef.current.set(socketId, pc)

    setRemotePeers((prev) => {
      const next = new Map(prev)

      if (!next.has(socketId)) {
        next.set(socketId, { socketId, userName })
      }

      return next
    })

    if (isInitiator) {
      pc.createOffer().then((offer) => {
        pc.setLocalDescription(offer)

        socketRef.current?.emit('signal', {
          to: socketId,
          from: socketRef.current!.id,
          signal: offer,
        })
      })
    }

    return pc
  }

  const cleanup = () => {
    stopRecording()

    if (isScreenSharing) {
      screenStreamRef.current?.getTracks().forEach((t) => t.stop())
    }

    localStreamRef.current?.getTracks().forEach((t) => t.stop())

    peersRef.current.forEach((pc) => pc.close())

    socketRef.current?.disconnect()

    sessionStorage.removeItem('isHost')
  }

  const toggleMic = () => {
    const track = localStreamRef.current?.getAudioTracks()[0]

    if (track) {
      track.enabled = !track.enabled

      setMicOn(track.enabled)
    }
  }

  const toggleCam = () => {
    const track = localStreamRef.current?.getVideoTracks()[0]

    if (track) {
      track.enabled = !track.enabled

      setCamOn(track.enabled)
    }
  }

  // ---------- SCREEN SHARING ----------

  const replaceVideoTrackForAllPeers = (newTrack: MediaStreamTrack) => {
    peersRef.current.forEach((pc) => {
      const sender = pc
        .getSenders()
        .find((s) => s.track && s.track.kind === 'video')

      if (sender) {
        sender.replaceTrack(newTrack)
      }
    })
  }

  const startScreenShare = async () => {
    try {
      const screenStream = await (
        navigator.mediaDevices as any
      ).getDisplayMedia({
        video: true,
        audio: false,
      })

      const screenTrack = screenStream.getVideoTracks()[0]

      screenStreamRef.current = screenStream

      replaceVideoTrackForAllPeers(screenTrack)

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = screenStream
      }

      screenTrack.onended = () => {
        stopScreenShare()
      }

      setIsScreenSharing(true)
    } catch (err) {
      console.error('Screen share cancelled or failed', err)
    }
  }

  const stopScreenShare = () => {
    screenStreamRef.current?.getTracks().forEach((t) => t.stop())

    screenStreamRef.current = null

    if (cameraTrackRef.current) {
      replaceVideoTrackForAllPeers(cameraTrackRef.current)

      if (localVideoRef.current && localStreamRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current
      }
    }

    setIsScreenSharing(false)
  }

  const toggleScreenShare = () => {
    if (isScreenSharing) {
      stopScreenShare()
    } else {
      startScreenShare()
    }
  }

  // ---------- RECORDING ----------

  const drawFrame = () => {
    const canvas = canvasRef.current

    if (!canvas) return

    const ctx = canvas.getContext('2d')

    if (!ctx) return

    const allVideos: HTMLVideoElement[] = []

    if (localVideoRef.current) {
      allVideos.push(localVideoRef.current)
    }

    remoteVideoElsRef.current.forEach((v) => allVideos.push(v))

    const cols = Math.ceil(Math.sqrt(allVideos.length || 1))

    const rows = Math.ceil((allVideos.length || 1) / cols)

    const tileW = canvas.width / cols

    const tileH = canvas.height / rows

    ctx.fillStyle = '#0f172a'

    ctx.fillRect(0, 0, canvas.width, canvas.height)

    allVideos.forEach((video, i) => {
      const x = (i % cols) * tileW

      const y = Math.floor(i / cols) * tileH

      if (video.videoWidth > 0) {
        ctx.drawImage(video, x, y, tileW, tileH)
      }
    })

    rafIdRef.current = requestAnimationFrame(drawFrame)
  }

  const startRecording = async () => {
    const canvas = canvasRef.current

    if (!canvas || !localStreamRef.current) {
      return
    }

    canvas.width = 1280
    canvas.height = 720

    drawFrame()

    const audioCtx = new AudioContext()

    const dest = audioCtx.createMediaStreamDestination()

    audioContextRef.current = audioCtx

    audioDestRef.current = dest

    if (localStreamRef.current.getAudioTracks().length > 0) {
      const localSrc = audioCtx.createMediaStreamSource(
        new MediaStream(localStreamRef.current.getAudioTracks())
      )

      localSrc.connect(dest)
    }

    remotePeers.forEach((peer) => {
      if (peer.stream) {
        try {
          const src = audioCtx.createMediaStreamSource(peer.stream)

          src.connect(dest)
        } catch (e) {
          console.error(e)
        }
      }
    })

    const canvasStream = canvas.captureStream(30)

    const combinedStream = new MediaStream([
      ...canvasStream.getVideoTracks(),
      ...dest.stream.getAudioTracks(),
    ])

    const recorder = new MediaRecorder(combinedStream, {
      mimeType: 'video/webm;codecs=vp9,opus',
    })

    recordedChunksRef.current = []

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        recordedChunksRef.current.push(e.data)
      }
    }

    recorder.onstop = async () => {
      const blob = new Blob(recordedChunksRef.current, {
        type: 'video/webm',
      })

      await saveRecording(blob)
    }

    recorder.start(1000)

    mediaRecorderRef.current = recorder

    setIsRecording(true)

    setRecordSeconds(0)

    setSaveStatus('')

    recordTimerRef.current = window.setInterval(() => {
      setRecordSeconds((s) => s + 1)
    }, 1000)
  }

  const stopRecording = () => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== 'inactive'
    ) {
      mediaRecorderRef.current.stop()
    }

    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current)
    }

    if (recordTimerRef.current) {
      window.clearInterval(recordTimerRef.current)
    }

    audioContextRef.current?.close()

    audioContextRef.current = null
    audioDestRef.current = null

    setIsRecording(false)
  }

  const saveRecording = async (blob: Blob) => {
    const fileName = `meeting-${
      meeting?.meeting_code || 'recording'
    }-${Date.now()}.webm`

    if (folderHandleRef.current) {
      try {
        const perm = await (folderHandleRef.current as any).queryPermission({
          mode: 'readwrite',
        })

        let granted = perm === 'granted'

        if (perm === 'prompt') {
          const req = await (folderHandleRef.current as any).requestPermission({
            mode: 'readwrite',
          })

          granted = req === 'granted'
        }

        if (granted) {
          const fileHandle = await folderHandleRef.current.getFileHandle(
            fileName,
            { create: true }
          )

          const writable = await fileHandle.createWritable()

          await writable.write(blob)

          await writable.close()

          setSaveStatus(
            `✅ Saved to "${folderHandleRef.current.name}" folder as ${fileName}`
          )

          return
        }
      } catch (err) {
        console.error('Direct folder save failed', err)
      }
    }

    if ('showSaveFilePicker' in window) {
      try {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: fileName,
          types: [
            {
              description: 'WebM Video',
              accept: { 'video/webm': ['.webm'] },
            },
          ],
        })

        const writable = await handle.createWritable()

        await writable.write(blob)

        await writable.close()

        setSaveStatus(`✅ Saved as ${fileName}`)

        return
      } catch (err) {
        // User cancelled
      }
    }

    const url = URL.createObjectURL(blob)

    const a = document.createElement('a')

    a.href = url
    a.download = fileName

    document.body.appendChild(a)

    a.click()

    a.remove()

    URL.revokeObjectURL(url)

    setSaveStatus(`✅ Downloaded ${fileName} to your Downloads folder`)
  }

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60)
      .toString()
      .padStart(2, '0')

    const s = (secs % 60).toString().padStart(2, '0')

    return `${m}:${s}`
  }

  const leaveMeeting = () => {
    cleanup()
    navigate('/dashboard')
  }

  if (!meeting) return null

  const remoteList = Array.from(remotePeers.values())

  const totalTiles = remoteList.length + 1

  const localLabel = `You${isHost ? ' (Host)' : ''}${
    isScreenSharing ? ' — sharing screen' : ''
  }`

  const gridCols = Math.ceil(Math.sqrt(totalTiles))

  const bindRemote = (peer: RemotePeer) => (el: HTMLVideoElement | null) => {
    if (el) {
      remoteVideoElsRef.current.set(peer.socketId, el)
    } else {
      remoteVideoElsRef.current.delete(peer.socketId)
    }
  }

  return (
    <div className="h-screen max-h-screen bg-slate-950 flex flex-col relative overflow-hidden">
      <canvas ref={canvasRef} className="hidden" />

      {isHost && joinRequests.length > 0 && (
        <div className="absolute top-20 right-4 z-50 w-72 space-y-2">
          {joinRequests.map((req) => (
            <div
              key={req.socketId}
              className="rounded-xl bg-white p-4 shadow-2xl"
            >
              <p className="text-sm font-medium text-slate-900">
                👤 {req.userName}
              </p>

              <p className="text-xs text-slate-500">wants to join the meeting</p>

              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => admitRequest(req)}
                  className="flex-1 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700"
                >
                  Admit
                </button>

                <button
                  onClick={() => rejectRequest(req)}
                  className="flex-1 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* HEADER */}
      <header className="shrink-0 flex flex-col gap-2 px-6 py-3 bg-slate-900 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="inline-flex items-center gap-2 text-sm">
              <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
              LIVE
            </span>

            <span className="text-sm text-slate-400">
              Meeting: {meeting.meeting_code}
            </span>

            {isHost && (
              <span className="rounded-full bg-blue-600/20 px-3 py-1 text-xs font-medium text-blue-400">
                HOST
              </span>
            )}

            {isScreenSharing && (
              <span className="inline-flex items-center gap-2 rounded-full bg-blue-600/20 px-3 py-1 text-xs font-medium text-blue-400">
                🖥️ Sharing Screen
              </span>
            )}

            {isRecording && (
              <span className="inline-flex items-center gap-2 rounded-full bg-red-600/20 px-3 py-1 text-xs font-medium text-red-400">
                🔴 Recording {formatTime(recordSeconds)}
              </span>
            )}
          </div>

          <span className="text-sm text-slate-400">
            {totalTiles} participant(s)
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span>💾 Save folder: {folderName || 'Not set (will use Downloads)'}</span>

          <button
            onClick={chooseFolder}
            className="rounded bg-slate-700 px-2 py-1 text-xs text-white hover:bg-slate-600"
          >
            Choose Folder
          </button>

          {saveStatus && <span className="text-green-400">{saveStatus}</span>}
        </div>
      </header>

      {/* VIDEO AREA */}
      <main className="flex-1 min-h-0 p-3 overflow-hidden relative">
        {/* 1) Kenek witharai (oya) */}
        {remoteList.length === 0 && (
          <div className="relative h-full w-full rounded-xl overflow-hidden bg-slate-800">
            <video
              ref={setLocalVideoEl}
              autoPlay
              muted
              playsInline
              className="h-full w-full object-cover"
            />

            <span className="absolute bottom-3 left-3 rounded bg-black/60 px-2 py-1 text-xs text-white">
              {localLabel}
            </span>

            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span className="rounded-full bg-black/50 px-4 py-2 text-sm text-slate-200">
                Waiting for others to join...
              </span>
            </div>
          </div>
        )}

        
        {remoteList.length === 1 && (
          <>
            <div className="h-full w-full">
              <RemoteVideo
                key={remoteList[0].socketId}
                peer={remoteList[0]}
                onRef={bindRemote(remoteList[0])}
              />
            </div>

            <div className="absolute bottom-6 right-6 w-40 sm:w-56 aspect-video rounded-xl overflow-hidden bg-slate-800 shadow-2xl ring-2 ring-white/20 z-10">
              <video
                ref={setLocalVideoEl}
                autoPlay
                muted
                playsInline
                className="h-full w-full object-cover"
              />

              <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
                You {isScreenSharing ? '📺' : ''}
              </span>
            </div>
          </>
        )}

        {/* 3) 3+ kenek: hamotama wenama wenama box (floating nahe) */}
        {remoteList.length >= 2 && (
          <div
            className="grid gap-3 h-full w-full"
            style={{
              gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))`,
              gridAutoRows: 'minmax(0, 1fr)',
            }}
          >
            {/* Me (local) tile */}
            <div className="relative rounded-xl overflow-hidden bg-slate-800 min-h-0">
              <video
                ref={setLocalVideoEl}
                autoPlay
                muted
                playsInline
                className="h-full w-full object-cover"
              />

              <span className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-1 text-xs text-white">
                {localLabel}
              </span>
            </div>

            {/* Remote tiles */}
            {remoteList.map((peer) => (
              <RemoteVideo
                key={peer.socketId}
                peer={peer}
                onRef={bindRemote(peer)}
              />
            ))}
          </div>
        )}
      </main>

      {/* FOOTER */}
      <footer className="shrink-0 flex flex-wrap items-center justify-center gap-4 bg-slate-900 py-4 px-4">
        <button
          onClick={toggleMic}
          className={`rounded-full px-4 py-2 text-sm font-medium ${
            micOn ? 'bg-slate-700 text-white' : 'bg-red-600 text-white'
          }`}
        >
          {micOn ? '🎙️ Mic On' : '🔇 Mic Off'}
        </button>

        <button
          onClick={toggleCam}
          disabled={isScreenSharing}
          className={`rounded-full px-4 py-2 text-sm font-medium disabled:opacity-40 ${
            camOn ? 'bg-slate-700 text-white' : 'bg-red-600 text-white'
          }`}
        >
          {camOn ? '🎥 Cam On' : '📷 Cam Off'}
        </button>

        <button
          onClick={toggleScreenShare}
          className={`rounded-full px-4 py-2 text-sm font-medium ${
            isScreenSharing
              ? 'bg-blue-600 text-white'
              : 'bg-slate-700 text-white'
          }`}
        >
          {isScreenSharing ? '🖥️ Stop Sharing' : '🖥️ Share Screen'}
        </button>

        {!isRecording && (
          <button
            onClick={startRecording}
            className="rounded-full bg-red-600 px-5 py-2 text-sm font-semibold text-white hover:bg-red-700"
          >
            ⏺ Start Recording
          </button>
        )}

        <button
          onClick={leaveMeeting}
          className="rounded-full bg-red-600 px-6 py-2 text-sm font-semibold text-white hover:bg-red-700"
        >
          Leave Meeting
        </button>
      </footer>
    </div>
  )
}

function RemoteVideo({
  peer,
  onRef,
}: {
  peer: RemotePeer
  onRef: (el: HTMLVideoElement | null) => void
}) {
  const ref = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (ref.current && peer.stream) {
      ref.current.srcObject = peer.stream
    }

    onRef(ref.current)

    return () => onRef(null)

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [peer.stream])

  return (
    <div className="relative h-full w-full rounded-xl overflow-hidden bg-slate-800 min-h-0">
      {peer.stream ? (
        <video
          ref={ref}
          autoPlay
          playsInline
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-slate-400 text-sm">
          Connecting...
        </div>
      )}

      <span className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-1 text-xs text-white">
        {peer.userName}
      </span>
    </div>
  )
}

export default MeetingRoomPage