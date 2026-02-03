import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { ProgrammingPage } from '@/pages/ProgrammingPage'
import { ScoringPage } from '@/pages/ScoringPage'
import { ProfilesPage } from '@/pages/ProfilesPage'
import { HistoryPage } from '@/pages/HistoryPage'
import { LogsPage } from '@/pages/LogsPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { SchedulingPage } from '@/pages/SchedulingPage'
import { JobsNotification } from '@/components/common/JobsNotification'
import { sseService } from '@/services/sse'

function App() {
  // Initialize SSE connection for job updates
  useEffect(() => {
    sseService.connect()
    return () => {
      sseService.disconnect()
    }
  }, [])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AdminLayout />}>
          <Route index element={<Navigate to="/programming" replace />} />
          <Route path="programming" element={<ProgrammingPage />} />
          <Route path="scoring" element={<ScoringPage />} />
          <Route path="schedules" element={<SchedulingPage />} />
          <Route path="profiles" element={<ProfilesPage />} />
          <Route path="history" element={<HistoryPage />} />
          <Route path="logs" element={<LogsPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
      <JobsNotification />
    </BrowserRouter>
  )
}

export default App
