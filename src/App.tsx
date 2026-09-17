import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import { AppLayout } from './layouts/AppLayout'
import { LoginGate } from './pages/LoginGate'
import { DashboardPage } from './pages/DashboardPage'
import { CalendarPage } from './pages/CalendarPage'
import { ContentPage } from './pages/ContentPage'
import { AssetsPage } from './pages/AssetsPage'
import { TelegramPage } from './pages/TelegramPage'
import { StudioPage } from './pages/StudioPage'
import { IdeasPage } from './pages/IdeasPage'
import { ProjectsPage } from './pages/ProjectsPage'
import { CampaignsPage } from './pages/CampaignsPage'
import { TeamPage } from './pages/TeamPage'
import { AnalyticsPage } from './pages/AnalyticsPage'
import { SettingsPage } from './pages/SettingsPage'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <LoginGate>
          <Routes>
            <Route element={<AppLayout />}>
              <Route index element={<DashboardPage />} />
              <Route path="calendar" element={<CalendarPage />} />
              <Route path="content" element={<ContentPage />} />
              <Route path="ideas" element={<IdeasPage />} />
              <Route path="assets" element={<AssetsPage />} />
              <Route path="telegram" element={<TelegramPage />} />
              <Route path="projects" element={<ProjectsPage />} />
              <Route path="campaigns" element={<CampaignsPage />} />
              <Route path="studio" element={<StudioPage />} />
              <Route path="team" element={<TeamPage />} />
              <Route path="analytics" element={<AnalyticsPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </LoginGate>
      </BrowserRouter>
    </AuthProvider>
  )
}
