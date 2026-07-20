import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import GeneratePage from './pages/GeneratePage';
import SolvePage from './pages/SolvePage';
import ResultsPage from './pages/ResultsPage';
import StatsPage from './pages/StatsPage';
import HistoryPage from './pages/HistoryPage';

import { ThemeProvider } from './contexts/ThemeContext';
import { ConcursoProvider } from './contexts/ConcursoContext';

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-container" style={{ minHeight: '100vh' }}>
        <div className="loading-spinner" />
      </div>
    );
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to="/" replace /> : <LoginPage />}
      />
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="gerar" element={<GeneratePage />} />
        <Route path="resolver" element={<SolvePage />} />
        <Route path="resultados" element={<ResultsPage />} />
        <Route path="estatisticas" element={<StatsPage />} />
        <Route path="historico" element={<HistoryPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <ConcursoProvider>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </ConcursoProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
