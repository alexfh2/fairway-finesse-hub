import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';

const LanguageSwitcher = () => {
  const { i18n } = useTranslation();
  const currentLang = i18n.language;

  const toggleLanguage = () => {
    i18n.changeLanguage(currentLang === 'ca' ? 'es' : 'ca');
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggleLanguage}
      className="font-body text-xs tracking-widest uppercase"
    >
      {currentLang === 'ca' ? 'ES' : 'CAT'}
    </Button>
  );
};

export default LanguageSwitcher;
