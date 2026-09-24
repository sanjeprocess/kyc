import { BrowserRouter, Routes, Route } from 'react-router-dom'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import CreateMeetingPage from './pages/CreateMeetingPage'
import JoinMeetingPage from './pages/JoinMeetingPage'
import PolicyPage from './pages/PolicyPage'
import PermissionsPage from './pages/PermissionsPage'
import WaitingRoomPage from './pages/WaitingRoomPage'
import MeetingRoomPage from './pages/MeetingRoomPage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/create-meeting" element={<CreateMeetingPage />} />
        <Route path="/join" element={<JoinMeetingPage />} />
        <Route path="/policy" element={<PolicyPage />} />
        <Route path="/permissions" element={<PermissionsPage />} />
        <Route path="/waiting-room" element={<WaitingRoomPage />} />
        <Route path="/meeting-room" element={<MeetingRoomPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App