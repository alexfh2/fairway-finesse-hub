import logo from '@/assets/logo.png';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

const Footer = () => {
  return (
    <footer className="border-t border-border/40 bg-background">
      {/* Brand CTA */}
      <div className="border-b border-border/40">
        <div className="container py-14 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex items-center gap-5">
            <div className="h-12 w-12 rounded-sm border border-accent/30 flex items-center justify-center">
              <span className="text-accent font-display text-xl">✦</span>
            </div>
            <div>
              <p className="font-display text-xl text-foreground italic">
                Més que un circuit. Una experiència.
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Gastronomia, esport i exclusivitat als millors camps.
              </p>
            </div>
          </div>
          <Link
            to="/jornades"
            className="flex items-center gap-2 px-6 py-3 border border-foreground/20 text-xs font-body font-medium uppercase tracking-[0.2em] text-foreground hover:border-accent hover:text-accent transition-colors"
          >
            Descobreix el circuit
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="container py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <img
          src={logo}
          alt="Gastronòmic Golf"
          className="h-7 w-auto opacity-40"
        />
        <p className="text-[10px] text-muted-foreground/60 tracking-[0.15em] uppercase">
          Circuit privat de golf — Classificació oficial
        </p>
        <p className="text-[10px] text-muted-foreground/40">
          © {new Date().getFullYear()}
        </p>
      </div>
    </footer>
  );
};

export default Footer;
