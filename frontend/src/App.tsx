import { Routes, Route } from "react-router-dom"
import { LoginPage } from "@/features/auth"
import { DashboardPage } from "@/features/dashboard"
import { AppLayout } from "@/components/layout"

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/dashboard"
        element={
          <AppLayout>
            <DashboardPage />
          </AppLayout>
        }
      />
      <Route path="*" element={<LoginPage />} />
    </Routes>
  )
}

export default App;