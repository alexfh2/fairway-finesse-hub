import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard,
  Calendar,
  Trophy,
  LogOut,
  ChevronLeft,
  Users,
  FileText,
} from 'lucide-react';

const sidebarLinks = [
  { path: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { path: '/admin/temporades', label: 'Temporades', icon: Trophy, end: false },
  { path: '/admin/jornades', label: 'Jornades', icon: Calendar, end: false },
  { path: '/admin/jugadors', label: 'Jugadors', icon: Users, end: false },
  { path: '/admin/noticies', label: 'Notícies', icon: FileText, end: false },
  { path: '/admin/admins', label: 'Administradors', icon: Users, end: false },
];

const AdminLayout = () => {
  const { signOut, user } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/admin/login');
  };

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="hidden md:flex w-64 flex-col bg-primary text-primary-foreground border-r border-border/20">
        <div className="p-4 border-b border-primary-foreground/10">
          <h2 className="font-display text-lg font-semibold">Admin</h2>
          <p className="text-xs text-primary-foreground/60 truncate mt-0.5">
            {user?.email}
          </p>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {sidebarLinks.map((link) => (
            <NavLink
              key={link.path}
              to={link.path}
              end={link.end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-primary-foreground/15 text-primary-foreground'
                    : 'text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10'
                }`
              }
            >
              <link.icon className="h-4 w-4" />
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-primary-foreground/10 space-y-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10"
            onClick={() => navigate('/')}
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            Tornar al lloc
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10"
            onClick={handleSignOut}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Tancar sessió
          </Button>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-primary text-primary-foreground p-3 flex items-center justify-between">
        <span className="font-display text-sm font-semibold">Admin</span>
        <div className="flex gap-1">
          {sidebarLinks.map((link) => (
            <NavLink
              key={link.path}
              to={link.path}
              end={link.end}
              className={({ isActive }) =>
                `p-2 rounded-md ${isActive ? 'bg-primary-foreground/15' : 'text-primary-foreground/70'}`
              }
            >
              <link.icon className="h-4 w-4" />
            </NavLink>
          ))}
          <Button variant="ghost" size="icon" className="text-primary-foreground/70 h-8 w-8" onClick={handleSignOut}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Main content */}
      <main className="flex-1 bg-background md:pt-0 pt-14">
        <div className="p-6 lg:p-8 max-w-6xl">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default AdminLayout;
