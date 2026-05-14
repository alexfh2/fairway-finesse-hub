import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const Compare = () => {
  const { t } = useTranslation();

  return (
    <div className="container py-8 lg:py-12 animate-fade-in">
      <h1 className="font-display text-3xl font-bold mb-2">{t('compare.title')}</h1>
      <p className="text-muted-foreground mb-8">{t('compare.selectPlayers')}</p>

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-lg">{t('compare.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">{t('common.noData')}</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Compare;
