import EditCompetencyPage from './pages/EditCompetencyPage.jsx'
import { AuthProvider, useAuth } from './hooks/auth-context.jsx'
import LoginModern from './pages/LoginModern.jsx'
import AdminDashboard from './pages/AdminDashboard.jsx'
import AdminReports from './pages/AdminReports.jsx'
import AdminUserActivity from './pages/AdminUserActivity.jsx'
import AdminUserProfile from './pages/AdminUserProfile.jsx'
import ManagerDashboard from './pages/ManagerDashboard.jsx'
import ExamQuestions from './pages/ExamQuestions.jsx'
import EmployeeExamQuestions from './pages/EmployeeExamQuestions.jsx'
import EmployeeDashboardModern from './pages/EmployeeDashboardModern.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import NavBar from './components/NavBar.jsx'
import Toasts from './components/Toasts.jsx'
import ContactFab from './components/ContactFab.jsx'
import { Routes, Route, Navigate } from 'react-router-dom'
import CompetencyPage from './pages/CompetencyPage.jsx'
import AssessmentSessionPage from './pages/AssessmentSessionPage.jsx'
import ExamReviewPage from './pages/ExamReviewPage.jsx'

function AppContent() {
  const { user } = useAuth()
  let dashboardElement = null
  if (user?.role === 'ADMIN') {
    dashboardElement = <ProtectedRoute roles={["ADMIN"]}><AdminDashboard /></ProtectedRoute>
  } else if (user?.role === 'MANAGER') {
    dashboardElement = <ProtectedRoute roles={["MANAGER"]}><ManagerDashboard /></ProtectedRoute>
  } else if (user?.role === 'EMPLOYEE') {
    dashboardElement = <ProtectedRoute roles={["EMPLOYEE"]}><EmployeeDashboardModern /></ProtectedRoute>;
  } else {
    dashboardElement = <Navigate to={user ? '/login' : '/login'} replace />
  }

  return (
    <div className="app-shell">
      {user && <NavBar />}
      <Toasts />
      {/* Floating Contact button - visible on every page when logged in */}
      {user && <ContactFab />}
      <Routes>
        <Route path="/login" element={<LoginModern />} />
        <Route path="/admin" element={<ProtectedRoute roles={["ADMIN"]}><AdminDashboard /></ProtectedRoute>} />
        <Route path="/admin/reports" element={<ProtectedRoute roles={["ADMIN"]}><AdminReports /></ProtectedRoute>} />
        <Route path="/admin/user/:id" element={<ProtectedRoute roles={["ADMIN"]}><AdminUserActivity /></ProtectedRoute>} />
        <Route path="/admin/user-profile/:id" element={<ProtectedRoute roles={["ADMIN","MANAGER"]}><AdminUserProfile /></ProtectedRoute>} />
        <Route path="/manager" element={<ProtectedRoute roles={["MANAGER"]}><ManagerDashboard /></ProtectedRoute>} />
        <Route path="/manager/user/:id" element={<ProtectedRoute roles={["MANAGER", "ADMIN"]}><AdminUserActivity /></ProtectedRoute>} />
        <Route path="/manager/exams/:id/questions" element={<ProtectedRoute roles={["MANAGER"]}><ExamQuestions /></ProtectedRoute>} />
        <Route path="/manager/competencies/:id/edit" element={<ProtectedRoute roles={["MANAGER"]}><EditCompetencyPage /></ProtectedRoute>} />
        <Route path="/employee/exams/:id/questions" element={<ProtectedRoute roles={["EMPLOYEE"]}><EmployeeExamQuestions /></ProtectedRoute>} />
        <Route path="/assessment/:examId" element={<ProtectedRoute roles={["EMPLOYEE"]}><AssessmentSessionPage /></ProtectedRoute>} />
        <Route path="/competency/:id" element={<ProtectedRoute><CompetencyPage /></ProtectedRoute>} />
        <Route path="/exam/review/:sessionId" element={<ProtectedRoute><ExamReviewPage /></ProtectedRoute>} />
        <Route path="/" element={dashboardElement} />
        <Route path="*" element={<Navigate to={user ? '/' : '/login'} replace />} />
      </Routes>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}
