import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trophy, Calendar, Users, FileText, ArrowRight, AlertTriangle, RotateCcw } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ReauthConfirmDialog } from '@/components/admin/ReauthConfirmDialog';
import { useToast } from '@/hooks/use-toast';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [resetWarnOpen, setResetWarnOpen] = useState(false);
  const [resetReauthOpen, setResetReauthOpen] = useState(false);

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
    { label: 'Temporadas', value: seasonCount ?? 0, icon: Trophy, path: '/admin/temporades' },
    { label: 'Jornadas', value: roundCount ?? 0, icon: Calendar, path: '/admin/jornades' },
    { label: 'Jugadores', value: playerCount ?? 0, icon: Users, path: '/admin/jugadors' },
    { label: 'Noticias', value: newsStats?.total ?? 0, icon: FileText, path: '/admin/noticies', extra: newsStats },
  ];

  const performReset = async () => {
    // Wipe all demo data. Keep user_roles and admin users intact.
    const tables = ['results', 'import_logs', 'photos', 'news_drafts', 'rounds', 'players', 'seasons'] as const;
    for (const table of tables) {
      const { error } = await supabase
        .from(table)
        .delete()
        .gte('created_at', '1900-01-01');
      if (error) throw new Error(`No se pudo limpiar ${table}: ${error.message}`);
    }
    await queryClient.invalidateQueries();
    toast({
      title: 'Base de datos reiniciada',
      description: 'Se han eliminado temporadas, jornadas, jugadores, resultados, fotos y noticias.',
    });
  };

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
                <div className="flex flex-wrap gap-1.5 mt-2 -ml-0.5">
                  <Badge variant="secondary" className="text-xs">
                    {stat.extra.drafts} borrador{stat.extra.drafts !== 1 ? 'es' : ''}
                  </Badge>
                  <Badge variant="default" className="text-xs">
                    {stat.extra.published} publicad{stat.extra.published !== 1 ? 'as' : 'a'}
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

      <div className="mt-10 border border-destructive/30 bg-destructive/5 rounded-lg p-5">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-md bg-destructive/15 text-destructive">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h2 className="font-display text-lg font-semibold text-destructive">
              Resetear base de datos (modo demo)
            </h2>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
              Elimina todas las jornadas, resultados, jugadores, fotos y noticias para empezar
              una demo desde cero. Las temporadas y los usuarios administradores se mantienen.
              Esta acción no se puede deshacer y requiere confirmar tu usuario y contraseña.
            </p>
            <Button
              variant="destructive"
              className="mt-4"
              onClick={() => setResetWarnOpen(true)}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Resetear base de datos
            </Button>
          </div>
        </div>
      </div>

      <AlertDialog open={resetWarnOpen} onOpenChange={setResetWarnOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Resetear toda la base de datos?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminarán <strong>todas las jornadas, resultados, jugadores, fotos y
              noticias</strong>. Las temporadas y los administradores se conservarán.
              <br /><br />
              Por seguridad, deberás confirmar tu usuario y contraseña en el siguiente paso.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setResetWarnOpen(false);
                setResetReauthOpen(true);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Continuar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ReauthConfirmDialog
        open={resetReauthOpen}
        onOpenChange={setResetReauthOpen}
        title="Resetear base de datos"
        description="Confirma tu usuario y contraseña para borrar todos los datos de la demo."
        confirmLabel="Resetear definitivamente"
        destructive
        onConfirmed={performReset}
      />
    </div>
  );
};

export default AdminDashboard;
