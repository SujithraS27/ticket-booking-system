import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';

export function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-20 border-b border-slate-800 bg-slate-900/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link to="/" className="text-lg font-bold text-indigo-400">
          🎟️ TicketBook
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          {user?.role === 'ORG' && (
            <Link to="/organiser" className="text-slate-300 hover:text-white">
              Organiser
            </Link>
          )}
          {user?.role === 'ADMIN' && (
            <>
              <Link to="/organiser" className="text-slate-300 hover:text-white">
                Stats
              </Link>
              <Link to="/admin/venues" className="text-slate-300 hover:text-white">
                Venues
              </Link>
            </>
          )}
          {user && (
            <Link to="/bookings" className="text-slate-300 hover:text-white">
              My Bookings
            </Link>
          )}
          {user ? (
            <>
              <span className="rounded bg-slate-800 px-2 py-1 text-xs uppercase tracking-wide text-emerald-400">
                {user.role}
              </span>
              <button
                onClick={() => {
                  logout();
                  navigate('/');
                }}
                className="text-slate-400 hover:text-white"
              >
                Log out ({user.name.split(' ')[0]})
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="text-slate-300 hover:text-white">
                Login
              </Link>
              <Link
                to="/register"
                className="rounded-md bg-indigo-600 px-3 py-1.5 font-medium hover:bg-indigo-500"
              >
                Register
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}