import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth';
import { Navbar } from './components/Navbar';
import { Protected } from './components/Protected';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { ShowDetailPage } from './pages/ShowDetailPage';
import { MyBookingsPage } from './pages/MyBookingsPage';
import { OfferPage } from './pages/OfferPage';
import { OrganiserDashboardPage } from './pages/OrganiserDashboardPage';
import { AdminVenuesPage } from './pages/AdminVenuesPage';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="min-h-screen">
          <Navbar />
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/shows/:id" element={<ShowDetailPage />} />
            <Route
              path="/bookings"
              element={
                <Protected>
                  <MyBookingsPage />
                </Protected>
              }
            />
            <Route path="/offers/:token" element={<OfferPage />} />
            <Route
              path="/organiser"
              element={
                <Protected roles={['ORG', 'ADMIN']}>
                  <OrganiserDashboardPage />
                </Protected>
              }
            />
            <Route
              path="/admin/venues"
              element={
                <Protected roles={['ADMIN']}>
                  <AdminVenuesPage />
                </Protected>
              }
            />
            <Route path="*" element={<div className="p-16 text-center text-slate-400">Page not found.</div>} />
          </Routes>
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}