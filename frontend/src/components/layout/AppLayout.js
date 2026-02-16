import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '@/App';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { LogOut, Menu, LayoutDashboard, Settings, Users, GitBranch, Tag, BarChart3, FileText, UserCheck, MessageSquare, Bell } from 'lucide-react';
import { useState } from 'react';
import { SheetTitle } from '@/components/ui/sheet';

const adminLinks = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/admin/rates', label: 'Rate Management', icon: Settings },
  { to: '/admin/branches', label: 'Branches', icon: GitBranch },
  { to: '/admin/users', label: 'Users', icon: Users },
  { to: '/admin/salespeople', label: 'Salespeople', icon: UserCheck },
  { to: '/admin/items', label: 'Item Names', icon: Tag },
  { to: '/admin/customers', label: 'Customers', icon: Users },
  { to: '/admin/bills', label: 'All Bills', icon: FileText },
  { to: '/admin/feedback', label: 'Feedback Qs', icon: MessageSquare },
  { to: '/admin/reports', label: 'Reports', icon: BarChart3 },
  { to: '/admin/notifications', label: 'Notifications', icon: Bell },
];

const managerLinks = [
  { to: '/manager', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/admin/reports', label: 'Reports', icon: BarChart3 },
  { to: '/admin/notifications', label: 'Notifications', icon: Bell },
];

const AppLogo = ({ size = 'default' }) => {
  const sizes = {
    sm: 'h-10',
    default: 'h-14',
    lg: 'h-20',
  };
  return (
    <div className="flex items-center gap-2">
      <img src="/ajpl-logo.png" alt="AJPL" className={`${sizes[size]} w-auto object-contain`} />
    </div>
  );
};

export { AppLogo };

export default function AppLayout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const links = user?.role === 'admin' ? adminLinks : user?.role === 'manager' ? managerLinks : [];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const NavContent = () => (
    <div className="flex flex-col h-full">
      <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
      <div className="p-5 border-b border-border flex items-center gap-3">
        <img src="/ajpl-logo.png" alt="AJPL" className="h-14 w-auto object-contain" />
        <div>
          <h1 className="heading text-lg font-bold text-primary tracking-wider leading-tight">AJPL Calculator</h1>
          <p className="text-[10px] text-muted-foreground capitalize">{user?.role} Panel</p>
        </div>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {links.map(link => {
          const Icon = link.icon;
          const isActive = location.pathname === link.to;
          return (
            <Link
              key={link.to}
              to={link.to}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors duration-200 ${
                isActive
                  ? 'bg-primary/10 text-primary border-l-2 border-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
              }`}
              data-testid={`nav-${link.label.toLowerCase().replace(/\s+/g, '-')}`}
            >
              <Icon size={18} />
              {link.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t border-border">
        <div className="flex items-center gap-3 px-3 py-2 mb-3">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary text-sm font-bold">
            {user?.full_name?.[0] || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user?.full_name}</p>
            <p className="text-xs text-muted-foreground capitalize">{user?.role}</p>
          </div>
        </div>
        <Button variant="ghost" className="w-full justify-start gap-2 text-muted-foreground hover:text-destructive" onClick={handleLogout} data-testid="logout-button">
          <LogOut size={16} /> Logout
        </Button>
      </div>
    </div>
  );

  if (user?.role === 'executive') {
    return (
      <div className="kintsugi-page">
        <div className="kintsugi-veins" />
        <div className="relative z-10">
          <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
            <div className="flex items-center justify-between px-3 sm:px-4 py-2 max-w-7xl mx-auto">
              <div className="flex items-center gap-2">
                <img src="/ajpl-logo.png" alt="AJPL" className="h-8 w-auto object-contain" />
                <span className="heading text-sm sm:text-base font-bold text-primary tracking-wider hidden sm:inline">AJPL Calculator</span>
              </div>
              <div className="flex items-center gap-2 sm:gap-3">
                <span className="text-xs sm:text-sm text-muted-foreground hidden sm:inline">{user?.full_name}</span>
                <Button variant="ghost" size="sm" onClick={handleLogout} data-testid="logout-button">
                  <LogOut size={16} />
                </Button>
              </div>
            </div>
          </header>
          <main className="px-3 sm:px-4 py-4 sm:py-6 max-w-7xl mx-auto">
            {children}
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="kintsugi-page">
      <div className="kintsugi-veins" />
      <div className="relative z-10 min-h-screen grid grid-cols-1 lg:grid-cols-[280px_1fr]">
        {/* Desktop sidebar */}
        <aside className="hidden lg:block border-r border-border bg-card/50 backdrop-blur-sm">
          <NavContent />
        </aside>
        {/* Mobile header */}
        <div className="lg:hidden border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
          <div className="flex items-center justify-between px-3 py-2">
            <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-11 w-11" data-testid="mobile-menu-button"><Menu size={24} /></Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[280px] p-0 bg-card border-border">
                <NavContent />
              </SheetContent>
            </Sheet>
            <div className="flex items-center gap-2">
              <img src="/ajpl-logo.png" alt="AJPL" className="h-10 w-auto object-contain" />
              <span className="heading text-base font-bold text-primary">AJPL Calculator</span>
            </div>
            <Button variant="ghost" size="icon" className="h-11 w-11" onClick={handleLogout} data-testid="mobile-logout-button"><LogOut size={18} /></Button>
          </div>
        </div>
        <main className="px-4 sm:px-6 lg:px-8 py-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
