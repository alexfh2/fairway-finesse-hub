import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import LanguageSwitcher from './LanguageSwitcher';
import ThemeToggle from './ThemeToggle';
import logo from '@/assets/logo.png';

const navItems = [
  { key: 'overview', path: '/' },
  { key: 'rankings', path: '/ranquings' },
  { key: 'rounds', path: '/jornades' },
  { key: 'players', path: '/jugadors' },
  { key: 'stats', path: '/estadistiques' },
  { key: 'news', path: '/noticies' },
] as const;

const Navbar = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const isHome = location.pathname === '/';

  return (
    <header
      className={`${
        isHome ? 'absolute' : 'sticky'
      } top-0 left-0 right-0 z-50 transition-colors duration-300 ${
        isHome
          ? 'bg-transparent'
          : 'bg-background/95 backdrop-blur border-b border-border/40'
      }`}
    >
      <div className="container flex h-18 items-center justify-between py-4">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5">
          <img
            src={logo}
            alt="Gastronòmic Golf"
            className="h-10 w-auto opacity-90 dark:brightness-0 dark:invert"
          />
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden lg:flex items-center gap-0.5">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.key}
                to={item.path}
                className={`px-4 py-2 text-[13px] font-body font-semibold uppercase tracking-[0.15em] transition-colors ${
                  isActive
                    ? 'text-accent border border-accent/40 rounded-sm'
                    : isHome
                    ? 'text-foreground/60 hover:text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t(`nav.${item.key}`)}
              </Link>
            );
          })}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-3">
          <span className={`hidden sm:inline-flex text-[10px] font-body font-medium tracking-[0.2em] uppercase ${
            isHome ? 'text-foreground/40' : 'text-muted-foreground'
          }`}>
            Temporada 2026
          </span>
          <LanguageSwitcher />
          <ThemeToggle isHome={isHome} />

          {/* Mobile menu */}
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild className="lg:hidden">
              <Button variant="ghost" size="icon" className={isHome ? 'text-foreground/70 hover:text-foreground' : ''}>
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72 bg-background border-border">
              <SheetTitle className="flex items-center gap-2">
                <img src={logo} alt="Gastronòmic Golf" className="h-8 w-auto" />
              </SheetTitle>
              <nav className="mt-8 flex flex-col gap-0.5">
                {navItems.map((item) => {
                  const isActive = location.pathname === item.path;
                  return (
                    <Link
                      key={item.key}
                      to={item.path}
                      onClick={() => setOpen(false)}
                      className={`px-4 py-3 text-[13px] font-body font-semibold uppercase tracking-[0.12em] transition-colors ${
                        isActive
                          ? 'text-accent border-l-2 border-accent'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {t(`nav.${item.key}`)}
                    </Link>
                  );
                })}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
