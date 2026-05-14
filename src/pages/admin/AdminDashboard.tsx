import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, Calendar, Users, FileText, ArrowRight } from 'lucide-react';

const AdminDashboard = () => {
  const navigate = useNavigate();

  const { data: seasonCount } = useQuery({
    queryKey: ['admin-seasons-count'],
    queryFn: async () => {
      const { count } = await supabase.from('seasons').select('*', { count: 'exact', head: true });
      return count ?? 0;
    },
  });

  const { data: roundCount } = useQuery({
    queryKey: ['admin-rounds-count'],
    queryFn: async () => {
      const { count } = await supabase.from('rounds').select('*', { count: 'exact', head: true });
      return count ?? 0;
    },
  });

  const { data: playerCount } = useQuery({
    queryKey: ['admin-players-count'],
    queryFn: async () => {
      const { count } = await supabase.from('players').select('*', { count: 'exact', head: true });
      return count ?? 0;
    },
  });

  const { data: newsStats } = useQuery({
    queryKey: ['admin-news-stats'],
    queryFn: async () => {
      const { data } = await supabase.from('news_drafts').select('status');
      const drafts = data?.filter(n => n.status === 'draft').length ?? 0;
      const published = data?.filter(n => n.status === 'published').length ?? 0;
      return { total: (data?.length ?? 0), drafts, published };
    },
  });

  const stats = [
    { label: 'Temporades', value: seasonCount ?? 0, icon: Trophy, path: '/admin/temporades' },
    { label: 'Jornades', value: roundCount ?? 0, icon: Calendar, path: '/admin/jornades' },
    { label: 'Jugadors', value: playerCount ?? 0, icon: Users, path: '/admin/jugadors' },
    { label: 'Notícies', value: newsStats?.total ?? 0, icon: FileText, path: '/admin/noticies', extra: newsStats },
  ];

  return (
    <div className="animate-fade-in">
      <h1 className="font-display text-2xl font-bold mb-6">Dashboard</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card
            key={stat.label}
            className="border-border/60 cursor-pointer hover:border-primary/40 hover:shadow-md transition-all group"
            onClick={() => navigate(stat.path)}
          >
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.label}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-display font-bold">{stat.value}</p>
              {stat.extra && (
                <div className="flex gap-2 mt-2">
                  <Badge variant="secondary" className="text-xs">
                    {stat.extra.drafts} borrador{stat.extra.drafts !== 1 ? 's' : ''}
                  </Badge>
                  <Badge variant="default" className="text-xs">
                    {stat.extra.published} publicad{stat.extra.published !== 1 ? 'es' : 'a'}
                  </Badge>
                </div>
              )}
              <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground group-hover:text-primary transition-colors">
                Gestionar <ArrowRight className="h-3 w-3" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default AdminDashboard;
