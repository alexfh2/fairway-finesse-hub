import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Pencil, Check, X, Phone } from 'lucide-react';

type EditState = {
  name: string;
  club: string;
  phone: string;
  current_handicap: string;
  gender: string;
  is_senior: boolean;
};

const AdminPlayers = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [edit, setEdit] = useState<EditState | null>(null);

  const { data: players, isLoading } = useQuery({
    queryKey: ['admin-players'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('players')
        .select('*')
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<EditState> }) => {
      const payload: any = {
        name: patch.name?.trim(),
        club: patch.club?.trim() || null,
        phone: patch.phone?.trim() || null,
        gender: patch.gender || null,
        is_senior: patch.is_senior,
        current_handicap:
          patch.current_handicap === '' || patch.current_handicap == null
            ? null
            : Number(patch.current_handicap),
      };
      const { error } = await supabase.from('players').update(payload).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-players'] });
      toast({ title: 'Jugador actualitzat' });
      setEditingId(null);
      setEdit(null);
    },
    onError: (err: Error) =>
      toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const startEdit = (p: any) => {
    setEditingId(p.id);
    setEdit({
      name: p.name ?? '',
      club: p.club ?? '',
      phone: p.phone ?? '',
      current_handicap: p.current_handicap?.toString() ?? '',
      gender: p.gender ?? '',
      is_senior: !!p.is_senior,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEdit(null);
  };

  const saveEdit = () => {
    if (!editingId || !edit) return;
    updateMutation.mutate({ id: editingId, patch: edit });
  };

  return (
    <div className="animate-fade-in">
      <h1 className="font-display text-2xl font-bold mb-6">Jugadors</h1>

      <Card className="border-border/60">
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Llicència</TableHead>
                <TableHead>Club</TableHead>
                <TableHead>Telèfon</TableHead>
                <TableHead>Últim HCP</TableHead>
                <TableHead>Gènere</TableHead>
                <TableHead>Sènior</TableHead>
                <TableHead className="text-right">Accions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Carregant...
                  </TableCell>
                </TableRow>
              ) : !players?.length ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No hi ha jugadors registrats
                  </TableCell>
                </TableRow>
              ) : (
                players.map((player: any) => {
                  const isEditing = editingId === player.id;
                  return (
                    <TableRow key={player.id}>
                      <TableCell className="font-medium min-w-[180px]">
                        {isEditing ? (
                          <Input
                            value={edit!.name}
                            onChange={(e) => setEdit({ ...edit!, name: e.target.value })}
                            className="h-8"
                          />
                        ) : (
                          player.name
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{player.license}</TableCell>
                      <TableCell className="text-muted-foreground min-w-[140px]">
                        {isEditing ? (
                          <Input
                            value={edit!.club}
                            onChange={(e) => setEdit({ ...edit!, club: e.target.value })}
                            className="h-8"
                          />
                        ) : (
                          player.club || '—'
                        )}
                      </TableCell>
                      <TableCell className="min-w-[160px]">
                        {isEditing ? (
                          <Input
                            type="tel"
                            placeholder="+34..."
                            value={edit!.phone}
                            onChange={(e) => setEdit({ ...edit!, phone: e.target.value })}
                            className="h-8"
                          />
                        ) : player.phone ? (
                          <span className="inline-flex items-center gap-1 text-sm">
                            <Phone className="h-3 w-3 text-muted-foreground" />
                            {player.phone}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="min-w-[90px]">
                        {isEditing ? (
                          <Input
                            type="number"
                            step="0.1"
                            value={edit!.current_handicap}
                            onChange={(e) =>
                              setEdit({ ...edit!, current_handicap: e.target.value })
                            }
                            className="h-8 w-20"
                          />
                        ) : (
                          player.current_handicap ?? '—'
                        )}
                      </TableCell>
                      <TableCell>
                        {isEditing ? (
                          <select
                            value={edit!.gender}
                            onChange={(e) => setEdit({ ...edit!, gender: e.target.value })}
                            className="h-8 rounded border border-border bg-background px-2 text-sm"
                          >
                            <option value="">—</option>
                            <option value="M">M</option>
                            <option value="F">F</option>
                          </select>
                        ) : player.gender === 'F' ? (
                          <Badge variant="secondary">Femenina</Badge>
                        ) : (
                          <span className="text-muted-foreground">M</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {isEditing ? (
                          <input
                            type="checkbox"
                            checked={edit!.is_senior}
                            onChange={(e) =>
                              setEdit({ ...edit!, is_senior: e.target.checked })
                            }
                          />
                        ) : player.is_senior ? (
                          <Badge variant="outline">Sènior</Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {isEditing ? (
                          <div className="flex justify-end gap-1">
                            <Button
                              size="sm"
                              variant="default"
                              onClick={saveEdit}
                              disabled={updateMutation.isPending}
                            >
                              <Check className="h-3 w-3" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={cancelEdit}>
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <Button size="sm" variant="ghost" onClick={() => startEdit(player)}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminPlayers;
