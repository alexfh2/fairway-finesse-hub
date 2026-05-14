import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Send, Undo2, Trash2, Calendar } from 'lucide-react';
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
import { useState } from 'react';

const AdminNews = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: news, isLoading } = useQuery({
    queryKey: ['admin-news'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('news_drafts')
        .select('*, rounds(name, course, date)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const publishMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('news_drafts')
        .update({ status: 'published', published_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-news'] });
      toast({ title: 'Notícia publicada' });
    },
  });

  const unpublishMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('news_drafts')
        .update({ status: 'draft', published_at: null })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-news'] });
      toast({ title: 'Notícia despublicada' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('news_drafts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-news'] });
      toast({ title: 'Notícia eliminada' });
      setDeleteId(null);
    },
  });

  return (
    <div className="animate-fade-in">
      <h1 className="font-display text-2xl font-bold mb-6">Notícies</h1>

      <Card className="border-border/60">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Títol</TableHead>
                <TableHead>Jornada</TableHead>
                <TableHead>Estat</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="text-right">Accions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Carregant...
                  </TableCell>
                </TableRow>
              ) : !news?.length ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No hi ha notícies. Genera-les des de les jornades.
                  </TableCell>
                </TableRow>
              ) : (
                news.map((article) => {
                  const round = article.rounds as any;
                  return (
                    <TableRow key={article.id}>
                      <TableCell className="font-medium max-w-[200px] truncate">
                        {article.title || 'Sense títol'}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {round?.name || '—'}
                      </TableCell>
                      <TableCell>
                        {article.status === 'published' ? (
                          <Badge variant="default">Publicada</Badge>
                        ) : (
                          <Badge variant="secondary">Borrador</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {article.published_at
                            ? new Date(article.published_at).toLocaleDateString('ca-ES')
                            : new Date(article.created_at).toLocaleDateString('ca-ES')}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {article.status === 'draft' ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => publishMutation.mutate(article.id)}
                              disabled={publishMutation.isPending}
                            >
                              <Send className="h-3 w-3 mr-1" /> Publicar
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => unpublishMutation.mutate(article.id)}
                              disabled={unpublishMutation.isPending}
                            >
                              <Undo2 className="h-3 w-3 mr-1" /> Despublicar
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setDeleteId(article.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar notícia?</AlertDialogTitle>
            <AlertDialogDescription>
              Aquesta acció no es pot desfer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel·lar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminNews;
