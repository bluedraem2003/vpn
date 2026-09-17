import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './layouts/AppLayout'
import { DashboardPage } from './pages/DashboardPage'
import { CalendarPage } from './pages/CalendarPage'
import { ContentPage } from './pages/ContentPage'
import { AssetsPage } from './pages/AssetsPage'
import { TelegramPage } from './pages/TelegramPage'
import { StudioPage } from './pages/StudioPage'
import { PlaceholderPage } from './pages/PlaceholderPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="content" element={<ContentPage />} />
          <Route
            path="ideas"
            element={
              <PlaceholderPage
                title="ایده‌ها"
                description="بانک ایده با قابلیت Convert to Content — فاز بعد"
              />
            }
          />
          <Route path="assets" element={<AssetsPage />} />
          <Route path="telegram" element={<TelegramPage />} />
          <Route
            path="projects"
            element={<PlaceholderPage title="پروژه‌ها" description="ساختار کلاینت / پروژه — فاز بعد" />}
          />
          <Route
            path="campaigns"
            element={<PlaceholderPage title="کمپین‌ها" description="کمپین و بازه زمانی — فاز بعد" />}
          />
          <Route path="studio" element={<StudioPage />} />
          <Route
            path="team"
            element={<PlaceholderPage title="تیم" description="نقش‌ها و عضویت ورک‌اسپیس — فاز بعد" />}
          />
          <Route
            path="analytics"
            element={<PlaceholderPage title="آنالیتیکس" description="آرشیو و عملکرد — فاز بعد" />}
          />
          <Route
            path="settings"
            element={
              <PlaceholderPage title="تنظیمات" description="Workspace، تلگرام، و محیط اجرا — فاز بعد" />
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
