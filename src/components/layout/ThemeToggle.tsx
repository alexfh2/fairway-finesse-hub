import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/hooks/useTheme';

interface ThemeToggleProps {
  isHome?: boolean;
}

const ThemeToggle = ({ isHome }: ThemeToggleProps) => {
  const { theme, toggleTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      aria-label={theme === 'dark' ? 'Activar mode dia' : 'Activar mode nit'}
      className={`h-9 w-9 ${isHome ? 'text-foreground/70 hover:text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
    >
      {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
};

export default ThemeToggle;
