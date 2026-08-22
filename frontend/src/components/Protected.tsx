import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth';
import type { Role } from '../types';

export function Protected({ roles, children }: { roles?: Role[]; children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return <div className="p-10 text-center text-slate-400">Loading…</div>;
  }
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) {
    return (
      <div className="p-10 text-center text-slate-400">
        You do not have access to this page ({roles.join(', ')} only).
      </div>
    );
  }
  return <>{children}</>;
}