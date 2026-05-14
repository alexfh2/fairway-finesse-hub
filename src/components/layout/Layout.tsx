import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';

const Layout = () => {
  return (
    <div className="relative flex min-h-screen flex-col">
      {/* Global ambient gradient — same tonal palette as hero, no golfer */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background:
            'radial-gradient(circle at 20% 10%, hsl(var(--accent) / 0.08), transparent 28%),' +
            'radial-gradient(circle at 80% 15%, hsl(var(--primary) / 0.15), transparent 25%),' +
            'linear-gradient(180deg, hsl(var(--background)) 0%, hsl(var(--background)) 60%, hsl(var(--background)) 100%)',
        }}
      />
      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
};

export default Layout;
