import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';

export function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-50 border-b border-slate-800/70 bg-slate-950/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link to="/" className="flex items-center gap-2 text-xl font-extrabold tracking-tight text-white">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/30">
            <svg className="h-5 w-5 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" />
            </svg>
          </span>
          <span className="bg-gradient-to-r from-indigo-300 to-violet-300 bg-clip-text text-transparent">
            TicketBook
          </span>
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
              <span className="rounded-lg bg-slate-800 px-2 py-1 text-xs uppercase tracking-wide text-emerald-400">
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
                className="rounded-xl bg-indigo-600 px-4 py-1.5 font-semibold text-white shadow-lg shadow-indigo-600/25 transition hover:bg-indigo-500"
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