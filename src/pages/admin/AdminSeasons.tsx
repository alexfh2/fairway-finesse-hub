import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil } from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';

type Season = Tables<'seasons'>;

const AdminSeasons = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSeason, setEditingSeason] = useState<Season | null>(null);
  const [year, setYear] = useState('');
  const [active, setActive] = useState(false);

  const { data: seasons, isLoading } = useQuery({
    queryKey: ['admin-seasons'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('seasons')
        .select('*')
        .order('year', { ascending: false });
      if (error) throw error;
      return data as Season[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editingSeason) {
        const { error } = await supabase
          .from('seasons')
          .update({ year: parseInt(year), active })
          .eq('id', editingSeason.id);
        if (error) throw error;
      } else {
        // Check if inheriting rules from previous season
        let rulesConfig = {};
        if (seasons && seasons.length > 0) {
          rulesConfig = (seasons[0].rules_config as object) ?? {};
        }
        const { error } = await supabase
          .from('seasons')
          .insert({ year: parseInt(year), active, rules_config: rulesConfig });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-seasons'] });
      toast({ title: editingSeason ? 'Temporada actualitzada' : 'Temporada creada' });
      closeDialog();
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const openCreate = () => {
    setEditingSeason(null);
    setYear(String(new Date().getFullYear()));
    setActive(false);
    setDialogOpen(true);
  };

  const openEdit = (season: Season) => {
    setEditingSeason(season);
    setYear(String(season.year));
    setActive(season.active);
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingSeason(null);
  };

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl font-bold">Temporades</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Nova temporada
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-display">
                {editingSeason ? 'Editar temporada' : 'Nova temporada'}
              </DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                saveMutation.mutate();
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="year">Any</Label>
                <Input
                  id="year"
                  type="number"
                  min="2020"
                  max="2099"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  required
                />
              </div>
              <div className="flex items-center gap-3">
                <Switch id="active" checked={active} onCheckedChange={setActive} />
                <Label htmlFor="active">Temporada activa</Label>
              </div>
              {!editingSeason && seasons && seasons.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Les regles s'heretaran de la temporada {seasons[0].year}.
                </p>
              )}
              <Button type="submit" className="w-full" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? 'Guardant...' : 'Guardar'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Carregant...</p>
      ) : !seasons?.length ? (
        <Card className="border-border/60">
          <CardContent className="p-8 text-center text-muted-foreground">
            No hi ha temporades. Crea la primera!
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {seasons.map((season) => (
            <Card key={season.id} className="border-border/60">
              <CardHeader className="flex flex-row items-center justify-between py-4">
                <div className="flex items-center gap-3">
                  <CardTitle className="font-display text-xl">{season.year}</CardTitle>
                  {season.active && (
                    <Badge variant="default" className="bg-accent text-accent-foreground">
                      Activa
                    </Badge>
                  )}
                </div>
                <Button variant="ghost" size="icon" onClick={() => openEdit(season)}>
                  <Pencil className="h-4 w-4" />
                </Button>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminSeasons;
