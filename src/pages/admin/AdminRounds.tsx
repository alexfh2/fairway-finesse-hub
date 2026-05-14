import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Star, Download, Check, Link2, FileSpreadsheet, Trash2, Globe, Loader2, Newspaper, Send, Upload, ChevronDown, Flag } from 'lucide-react';
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
import RoundResultsImport from '@/components/admin/RoundResultsImport';
import NewsGenerationDialog from '@/components/admin/NewsGenerationDialog';
import type { Tables, TablesInsert } from '@/integrations/supabase/types';
import type { Database } from '@/integrations/supabase/types';

type Round = Tables<'rounds'>;
type Season = Tables<'seasons'>;
type RoundStatus = Database['public']['Enums']['round_status'];

interface ParsedRound {
  round_number: number;
  name: string;
  club: string;
  sponsor: string;
  dates: string[];
  detail_url: string;
  image_url: string;
}

const statusColors: Record<RoundStatus, string> = {
  draft: 'bg-muted text-muted-foreground',
  imported: 'bg-blue-100 text-blue-800',
  review: 'bg-yellow-100 text-yellow-800',
  validated: 'bg-emerald-100 text-emerald-800',
  published: 'bg-accent text-accent-foreground',
};

const statusLabels: Record<RoundStatus, string> = {
  draft: 'Esborrany',
  imported: 'Importada',
  review: 'Revisió',
  validated: 'Validada',
  published: 'Publicada',
};

const AdminRounds = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedSeason, setSelectedSeason] = useState<string>('');

  // Import state
  const [importUrl, setImportUrl] = useState('https://gastronomicgolf.com');
  const [importedRounds, setImportedRounds] = useState<ParsedRound[]>([]);
  const [showImport, setShowImport] = useState(false);
  const [importLoading, setImportLoading] = useState(false);

  // Edit dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRound, setEditingRound] = useState<Round | null>(null);
  const [resultsRound, setResultsRound] = useState<Round | null>(null);
  const [deletingRound, setDeletingRound] = useState<Round | null>(null);
  const [newsRound, setNewsRound] = useState<Round | null>(null);
  const [courseUrl, setCourseUrl] = useState('');
  const [extractingPar, setExtractingPar] = useState(false);
  const [courseFile, setCourseFile] = useState<File | null>(null);
  const [courseUrlWomen, setCourseUrlWomen] = useState('');
  const [courseFileWomen, setCourseFileWomen] = useState<File | null>(null);
  const [extractingWomen, setExtractingWomen] = useState(false);
  const [calendarFile, setCalendarFile] = useState<File | null>(null);
  const [form, setForm] = useState({
    name: '', round_number: '', date: '', end_date: '',
    club: '', course: '', sponsor: '', is_master: false,
    season_id: '',
    course_par: '' as string,
    course_handicap: '' as string,
    course_handicap_women: '' as string,
    has_women_handicap: false,
  });

  const { data: seasons } = useQuery({
    queryKey: ['admin-seasons-list'],
    queryFn: async () => {
      const { data, error } = await supabase.from('seasons').select('*').order('year', { ascending: false });
      if (error) throw error;
      return data as Season[];
    },
  });

  const activeSeasonId = selectedSeason || seasons?.[0]?.id || '';

  const { data: rounds, isLoading } = useQuery({
    queryKey: ['admin-rounds', activeSeasonId],
    enabled: !!activeSeasonId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rounds')
        .select('*')
        .eq('season_id', activeSeasonId)
        .order('round_number', { ascending: true });
      if (error) throw error;
      return data as Round[];
    },
  });

  // ─── IMPORT FROM URL ───
  const handleImport = async () => {
    if (!importUrl.trim()) return;
    setImportLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('parse-calendar', {
        body: { url: importUrl.trim() },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Error parsing');

      setImportedRounds(data.rounds as ParsedRound[]);
      toast({ title: `${data.rounds.length} jornades detectades`, description: 'Revisa i edita les dades abans de guardar.' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error desconegut';
      toast({ title: 'Error d\'importació', description: message, variant: 'destructive' });
    } finally {
      setImportLoading(false);
    }
  };

  const handleImportFromFile = async () => {
    if (!calendarFile) return;
    setImportLoading(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(calendarFile);
      });
      const { data, error } = await supabase.functions.invoke('parse-calendar', {
        body: { file: base64 },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Error parsing');
      setImportedRounds(data.rounds as ParsedRound[]);
      toast({ title: `${data.rounds.length} jornades detectades`, description: 'Revisa i edita les dades abans de guardar.' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error desconegut';
      toast({ title: "Error d'importació", description: message, variant: 'destructive' });
    } finally {
      setImportLoading(false);
    }
  };

  const updateImportedRound = (index: number, field: string, value: any) => {
    setImportedRounds((prev) =>
      prev.map((r, i) => (i === index ? { ...r, [field]: value } : r))
    );
  };

  const saveImportedRounds = useMutation({
    mutationFn: async () => {
      const payloads: TablesInsert<'rounds'>[] = importedRounds.map((r) => ({
        name: r.name,
        round_number: r.round_number,
        date: r.dates[0] || new Date().toISOString().split('T')[0],
        end_date: r.dates.length > 1 ? r.dates[r.dates.length - 1] : null,
        club: null,
        course: r.name || null,
        sponsor: r.sponsor || null,
        is_master: false,
        master_coefficient: 1.0,
        status: 'draft' as RoundStatus,
        season_id: activeSeasonId,
        external_links: r.detail_url ? [{ url: r.detail_url, label: 'Web' }] : [],
      }));

      const { error } = await supabase.from('rounds').insert(payloads);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-rounds'] });
      toast({ title: `${importedRounds.length} jornades importades!` });
      setImportedRounds([]);
      setShowImport(false);
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  // ─── MANUAL EDIT (always saves as current status, new rounds as draft) ───
  const saveMutation = useMutation({
    mutationFn: async () => {
      let coursePar: number[] | null = null;
      if (form.course_par.trim()) {
        coursePar = form.course_par.split(',').map(v => parseInt(v.trim())).filter(v => !isNaN(v));
        if (coursePar.length !== 18) {
          throw new Error('El par del camp ha de tenir exactament 18 valors');
        }
      }

      let courseHandicap: number[] | null = null;
      if (form.course_handicap.trim()) {
        courseHandicap = form.course_handicap.split(',').map(v => parseInt(v.trim())).filter(v => !isNaN(v));
        if (courseHandicap.length !== 18) {
          throw new Error('El handicap del camp ha de tenir exactament 18 valors');
        }
      }

      let courseHandicapWomen: number[] | null = null;
      if (form.has_women_handicap && form.course_handicap_women.trim()) {
        courseHandicapWomen = form.course_handicap_women.split(',').map(v => parseInt(v.trim())).filter(v => !isNaN(v));
        if (courseHandicapWomen.length !== 18) {
          throw new Error('El handicap femení ha de tenir exactament 18 valors');
        }
      }

      const payload: TablesInsert<'rounds'> = {
        name: form.name,
        round_number: parseInt(form.round_number),
        date: form.date,
        end_date: form.end_date || null,
        club: form.club || null,
        course: form.course || null,
        sponsor: form.sponsor || null,
        is_master: form.is_master,
        master_coefficient: form.is_master ? 1.25 : 1.0,
        status: editingRound ? editingRound.status : 'draft',
        season_id: form.season_id || activeSeasonId,
        course_par: coursePar,
        course_handicap: courseHandicap,
        course_handicap_women: courseHandicapWomen,
      } as any;
      if (editingRound) {
        const { error } = await supabase.from('rounds').update(payload).eq('id', editingRound.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('rounds').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-rounds'] });
      toast({ title: editingRound ? 'Jornada actualitzada' : 'Jornada creada' });
      setDialogOpen(false);
      setEditingRound(null);
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  // ─── PUBLISH ROUND ───
  const publishMutation = useMutation({
    mutationFn: async (roundId: string) => {
      const { error } = await supabase.from('rounds').update({ status: 'published' as RoundStatus }).eq('id', roundId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-rounds'] });
      toast({ title: 'Jornada publicada!' });
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  // ─── UNPUBLISH ROUND ───
  const unpublishMutation = useMutation({
    mutationFn: async (roundId: string) => {
      const { error } = await supabase.from('rounds').update({ status: 'draft' as RoundStatus }).eq('id', roundId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-rounds'] });
      toast({ title: 'Jornada despublicada' });
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const openEdit = (round: Round) => {
    setEditingRound(round);
    const parData = (round as any).course_par;
    const parStr = Array.isArray(parData) ? parData.join(', ') : '';
    const hcpData = (round as any).course_handicap;
    const hcpStr = Array.isArray(hcpData) ? hcpData.join(', ') : '';
    const hcpWomenData = (round as any).course_handicap_women;
    const hcpWomenStr = Array.isArray(hcpWomenData) ? hcpWomenData.join(', ') : '';
    setForm({
      name: round.name, round_number: String(round.round_number),
      date: round.date, end_date: round.end_date || '',
      club: round.club || '', course: round.course || '',
      sponsor: round.sponsor || '', is_master: round.is_master,
      season_id: round.season_id,
      course_par: parStr,
      course_handicap: hcpStr,
      course_handicap_women: hcpWomenStr,
      has_women_handicap: Array.isArray(hcpWomenData) && hcpWomenData.length > 0,
    });
    setDialogOpen(true);
  };

  const openCreate = () => {
    setEditingRound(null);
    const n = (rounds?.length ?? 0) + 1;
    setForm({
      name: `Jornada ${n}`, round_number: String(n),
      date: '', end_date: '', club: '', course: '', sponsor: '',
      is_master: false, season_id: activeSeasonId,
      course_par: '', course_handicap: '',
      course_handicap_women: '', has_women_handicap: false,
    });
    setDialogOpen(true);
  };

  const updateField = (key: string, value: string | boolean) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  // ─── DELETE ROUND ───
  const deleteMutation = useMutation({
    mutationFn: async (roundId: string) => {
      const { error: resError } = await supabase.from('results').delete().eq('round_id', roundId);
      if (resError) throw resError;
      const { error: logError } = await supabase.from('import_logs').delete().eq('round_id', roundId);
      if (logError) throw logError;
      const { error: photoError } = await supabase.from('photos').delete().eq('round_id', roundId);
      if (photoError) throw photoError;
      const { error: newsError } = await supabase.from('news_drafts').delete().eq('round_id', roundId);
      if (newsError) throw newsError;
      const { error } = await supabase.from('rounds').delete().eq('id', roundId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-rounds'] });
      toast({ title: 'Jornada eliminada' });
      setDeletingRound(null);
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  // ─── EXTRACT PAR + HANDICAP ───
  const handleExtract = async (source: 'url' | 'file') => {
    setExtractingPar(true);
    try {
      let body: any;
      if (source === 'url') {
        if (!courseUrl.trim()) return;
        body = { url: courseUrl.trim() };
      } else {
        if (!courseFile) return;
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(courseFile);
        });
        body = { file: base64 };
      }

      const { data, error } = await supabase.functions.invoke('extract-course-par', { body });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'No s\'ha pogut extreure les dades');

      const parArray: number[] = data.par;
      const hcpArray: number[] = data.handicap;
      updateField('course_par', parArray.join(', '));
      updateField('course_handicap', hcpArray.join(', '));
      toast({
        title: 'Dades extretes correctament',
        description: `Par ${parArray.reduce((a: number, b: number) => a + b, 0)} (${parArray.length} forats) + Handicap`,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error desconegut';
      toast({ title: 'Error extraient dades', description: message, variant: 'destructive' });
    } finally {
      setExtractingPar(false);
    }
  };

  // ─── EXTRACT WOMEN'S HANDICAP ───
  const handleExtractWomen = async (source: 'url' | 'file') => {
    setExtractingWomen(true);
    try {
      let body: any = { mode: 'women' };
      if (source === 'url') {
        if (!courseUrlWomen.trim()) return;
        body.url = courseUrlWomen.trim();
      } else {
        if (!courseFileWomen) return;
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(courseFileWomen);
        });
        body.file = base64;
      }

      const { data, error } = await supabase.functions.invoke('extract-course-par', { body });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'No s\'ha pogut extreure les dades');

      const hcpArray: number[] = data.handicap_women;
      updateField('course_handicap_women', hcpArray.join(', '));
      toast({
        title: 'Handicaps de dones extrets',
        description: `${hcpArray.length} forats`,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error desconegut';
      toast({ title: 'Error extraient handicaps de dones', description: message, variant: 'destructive' });
    } finally {
      setExtractingWomen(false);
    }
  };

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <h1 className="font-display text-2xl font-bold">Jornades</h1>
        <div className="flex items-center gap-2 flex-wrap">
          {seasons && seasons.length > 0 && (
            <Select value={activeSeasonId} onValueChange={setSelectedSeason}>
              <SelectTrigger className="w-[130px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {seasons.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.year}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button
            variant="outline"
            onClick={() => setShowImport(!showImport)}
            disabled={!activeSeasonId}
          >
            <Link2 className="h-4 w-4 mr-2" />
            Importar des d'URL
          </Button>
          <Button onClick={openCreate} disabled={!activeSeasonId}>
            <Plus className="h-4 w-4 mr-2" />
            Manual
          </Button>
        </div>
      </div>

      {/* Import panel */}
      {showImport && (
        <Card className="border-accent/40 bg-accent/5 mb-6">
          <CardContent className="pt-6 space-y-4">
            <div>
              <Label className="text-sm font-semibold">Importar calendari</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Enganxa l'URL de la pàgina del calendari o puja una imatge/PDF amb les jornades.
              </p>
              <div className="flex gap-2">
                <Input
                  value={importUrl}
                  onChange={(e) => setImportUrl(e.target.value)}
                  placeholder="https://gastronomicgolf.com"
                />
                <Button onClick={handleImport} disabled={importLoading}>
                  <Download className="h-4 w-4 mr-2" />
                  {importLoading ? 'Llegint...' : 'Llegir URL'}
                </Button>
              </div>
              <div className="flex gap-2 items-end">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">Imatge o PDF del calendari</Label>
                  <Input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.webp"
                    onChange={(e) => setCalendarFile(e.target.files?.[0] || null)}
                    className="text-xs"
                  />
                </div>
                <Button onClick={handleImportFromFile} disabled={importLoading || !calendarFile}>
                  <Upload className="h-4 w-4 mr-2" />
                  {importLoading ? 'Llegint...' : 'Llegir fitxer'}
                </Button>
              </div>
            </div>

            {importedRounds.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">{importedRounds.length} jornades detectades — revisa i edita:</p>
                  <Button
                    size="sm"
                    onClick={() => saveImportedRounds.mutate()}
                    disabled={saveImportedRounds.isPending}
                  >
                    <Check className="h-4 w-4 mr-2" />
                    {saveImportedRounds.isPending ? 'Guardant...' : 'Guardar totes'}
                  </Button>
            </div>

                {importedRounds.map((r, idx) => (
                  <Card key={idx} className="border-border/60">
                    <CardContent className="py-4 space-y-3">
                      <div className="flex items-start gap-3">
                        {r.image_url && (
                          <img src={r.image_url} alt="" className="w-16 h-20 object-cover rounded" />
                        )}
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">J{r.round_number}</Badge>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <div>
                              <Label className="text-xs">Camp</Label>
                              <Input value={r.name} onChange={(e) => updateImportedRound(idx, 'name', e.target.value)} className="h-8 text-sm" />
                            </div>
                            <div>
                              <Label className="text-xs">Data inici</Label>
                              <Input type="date" value={r.dates[0] || ''} onChange={(e) => {
                                const newDates = [...r.dates];
                                newDates[0] = e.target.value;
                                updateImportedRound(idx, 'dates', newDates as any);
                              }} className="h-8 text-sm" />
                            </div>
                            <div>
                              <Label className="text-xs">Data fi</Label>
                              <Input type="date" value={r.dates.length > 1 ? r.dates[r.dates.length - 1] : ''} onChange={(e) => {
                                const newDates = [r.dates[0] || '', e.target.value].filter(Boolean);
                                updateImportedRound(idx, 'dates', newDates as any);
                              }} className="h-8 text-sm" />
                            </div>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div>
                              <Label className="text-xs">Patrocinador</Label>
                              <Input value={r.sponsor} onChange={(e) => updateImportedRound(idx, 'sponsor', e.target.value)} className="h-8 text-sm" />
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Round list */}
      {!activeSeasonId ? (
        <Card className="border-border/60">
          <CardContent className="p-8 text-center text-muted-foreground">
            Crea primer una temporada per poder afegir jornades.
          </CardContent>
        </Card>
      ) : isLoading ? (
        <p className="text-muted-foreground">Carregant...</p>
      ) : !rounds?.length ? (
        <Card className="border-border/60">
          <CardContent className="p-8 text-center text-muted-foreground">
            No hi ha jornades en aquesta temporada. Importa des d'una URL o crea-les manualment.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {rounds.map((round) => (
            <Card key={round.id} className="border-border/60 overflow-hidden">
              <Collapsible>
                <CollapsibleTrigger className="w-full text-left group">
                  <CardHeader className="flex flex-row items-center justify-between py-4 hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-3 flex-wrap">
                      <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                      <CardTitle className="text-base font-semibold flex items-center gap-2">
                        {round.is_master && <Star className="h-4 w-4 text-accent fill-accent" />}
                        <Badge variant="outline" className="text-xs">J{round.round_number}</Badge>
                        {round.name}
                      </CardTitle>
                      <Badge className={statusColors[round.status]}>
                        {statusLabels[round.status]}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{round.date}</span>
                      {round.end_date && round.end_date !== round.date && (
                        <span className="text-xs text-muted-foreground">→ {round.end_date}</span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground hidden sm:inline-block mr-2">
                      Clica per gestionar
                    </span>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="border-t border-border/40 bg-muted/10 pt-5 pb-5 space-y-4">
                    <p className="text-xs text-muted-foreground">
                      Selecciona què vols fer amb aquesta jornada. Cada acció obre una finestra amb instruccions detallades.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {/* Fill course data */}
                      <button
                        onClick={() => openEdit(round)}
                        className="text-left p-4 rounded-lg border border-border bg-card hover:border-primary/50 hover:bg-primary/5 transition-all group"
                      >
                        <div className="flex items-start gap-3">
                          <div className="p-2 rounded-md bg-primary/10 text-primary group-hover:bg-primary/20">
                            <Flag className="h-5 w-5" />
                          </div>
                          <div className="flex-1">
                            <div className="font-semibold text-sm mb-1">Omplir dades del camp</div>
                            <div className="text-xs text-muted-foreground leading-relaxed">
                              Edita el nom, data, patrocinador i el par + handicap de cada forat (pots pujar foto/PDF de la tarjeta).
                            </div>
                          </div>
                        </div>
                      </button>

                      {/* Fill results */}
                      <button
                        onClick={() => setResultsRound(round)}
                        className="text-left p-4 rounded-lg border border-border bg-card hover:border-primary/50 hover:bg-primary/5 transition-all group"
                      >
                        <div className="flex items-start gap-3">
                          <div className="p-2 rounded-md bg-primary/10 text-primary group-hover:bg-primary/20">
                            <FileSpreadsheet className="h-5 w-5" />
                          </div>
                          <div className="flex-1">
                            <div className="font-semibold text-sm mb-1">Omplir resultats</div>
                            <div className="text-xs text-muted-foreground leading-relaxed">
                              Importa els resultats des d'un Excel, GolfDirecto o Teeone, o introdueix-los manualment.
                            </div>
                          </div>
                        </div>
                      </button>

                      {/* Generate news */}
                      <button
                        onClick={() => round.status === 'published' && setNewsRound(round)}
                        disabled={round.status !== 'published'}
                        className="text-left p-4 rounded-lg border border-border bg-card hover:border-primary/50 hover:bg-primary/5 transition-all group disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-border disabled:hover:bg-card"
                      >
                        <div className="flex items-start gap-3">
                          <div className="p-2 rounded-md bg-primary/10 text-primary group-hover:bg-primary/20 group-disabled:bg-muted group-disabled:text-muted-foreground">
                            <Newspaper className="h-5 w-5" />
                          </div>
                          <div className="flex-1">
                            <div className="font-semibold text-sm mb-1">Generar notícia amb IA</div>
                            <div className="text-xs text-muted-foreground leading-relaxed">
                              {round.status === 'published'
                                ? 'Crea automàticament un text en català i castellà destacant els guanyadors.'
                                : 'Disponible només quan la jornada estigui publicada.'}
                            </div>
                          </div>
                        </div>
                      </button>

                      {/* Publish / Unpublish */}
                      {round.status !== 'published' ? (
                        <button
                          onClick={() => publishMutation.mutate(round.id)}
                          disabled={publishMutation.isPending}
                          className="text-left p-4 rounded-lg border border-accent/40 bg-accent/5 hover:border-accent hover:bg-accent/10 transition-all group disabled:opacity-50"
                        >
                          <div className="flex items-start gap-3">
                            <div className="p-2 rounded-md bg-accent/20 text-accent-foreground group-hover:bg-accent/30">
                              <Send className="h-5 w-5" />
                            </div>
                            <div className="flex-1">
                              <div className="font-semibold text-sm mb-1">Publicar jornada</div>
                              <div className="text-xs text-muted-foreground leading-relaxed">
                                Fa visible la jornada al públic. Un cop publicada podràs generar la notícia.
                              </div>
                            </div>
                          </div>
                        </button>
                      ) : (
                        <button
                          onClick={() => unpublishMutation.mutate(round.id)}
                          disabled={unpublishMutation.isPending}
                          className="text-left p-4 rounded-lg border border-border bg-card hover:border-muted-foreground/40 transition-all group disabled:opacity-50"
                        >
                          <div className="flex items-start gap-3">
                            <div className="p-2 rounded-md bg-muted text-muted-foreground">
                              <Send className="h-5 w-5 rotate-180" />
                            </div>
                            <div className="flex-1">
                              <div className="font-semibold text-sm mb-1">Despublicar jornada</div>
                              <div className="text-xs text-muted-foreground leading-relaxed">
                                Torna la jornada a esborrany. Deixarà d'estar visible al públic.
                              </div>
                            </div>
                          </div>
                        </button>
                      )}

                      {/* Delete */}
                      <button
                        onClick={() => setDeletingRound(round)}
                        className="text-left p-4 rounded-lg border border-destructive/30 bg-destructive/5 hover:border-destructive hover:bg-destructive/10 transition-all group md:col-span-2"
                      >
                        <div className="flex items-start gap-3">
                          <div className="p-2 rounded-md bg-destructive/15 text-destructive group-hover:bg-destructive/25">
                            <Trash2 className="h-5 w-5" />
                          </div>
                          <div className="flex-1">
                            <div className="font-semibold text-sm mb-1 text-destructive">Eliminar jornada</div>
                            <div className="text-xs text-muted-foreground leading-relaxed">
                              Esborra la jornada i tots els seus resultats, fotos i notícies. Aquesta acció no es pot desfer.
                            </div>
                          </div>
                        </div>
                      </button>
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          ))}
        </div>
      )}

      {/* Edit/Create dialog — no status selector, just data */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">
              {editingRound ? 'Editar jornada' : 'Nova jornada'}
            </DialogTitle>
          </DialogHeader>
          {editingRound && (
            <Badge className={`${statusColors[editingRound.status]} w-fit`}>
              {statusLabels[editingRound.status]}
            </Badge>
          )}
          <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Nom</Label>
                <Input value={form.name} onChange={(e) => updateField('name', e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Número</Label>
                <Input type="number" min="1" value={form.round_number} onChange={(e) => updateField('round_number', e.target.value)} required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Data inici</Label>
                <Input type="date" value={form.date} onChange={(e) => updateField('date', e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Data fi (opcional)</Label>
                <Input type="date" value={form.end_date} onChange={(e) => updateField('end_date', e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Camp</Label>
              <Input value={form.course} onChange={(e) => updateField('course', e.target.value)} placeholder="Nom del camp de golf" />
            </div>
            <div className="space-y-2">
              <Label>Patrocinador</Label>
              <Input value={form.sponsor} onChange={(e) => updateField('sponsor', e.target.value)} />
            </div>
            <div className="space-y-3">
              <Label className="font-semibold">Dades del camp (par + handicap)</Label>
              <p className="text-xs text-muted-foreground">
                Puja una foto/PDF de la tarjeta del camp o enganxa la URL de la web per extreure automàticament el par i el handicap (stroke index) de cada forat.
              </p>
              <div className="flex gap-2 items-end">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">URL de la web del camp</Label>
                  <Input
                    value={courseUrl}
                    onChange={(e) => setCourseUrl(e.target.value)}
                    placeholder="https://web-del-camp.com/el-campo/"
                  />
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => handleExtract('url')} disabled={extractingPar || !courseUrl.trim()}>
                  {extractingPar ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Globe className="h-4 w-4 mr-1" />}
                  URL
                </Button>
              </div>
              <div className="flex gap-2 items-end">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">Foto o PDF de la tarjeta</Label>
                  <Input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.webp"
                    onChange={(e) => setCourseFile(e.target.files?.[0] || null)}
                    className="text-xs"
                  />
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => handleExtract('file')} disabled={extractingPar || !courseFile}>
                  {extractingPar ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Upload className="h-4 w-4 mr-1" />}
                  Fitxer
                </Button>
              </div>
              {/* Scorecard-style table for par + handicap */}
              {[0, 9].map((offset) => {
                const parArr = form.course_par ? form.course_par.split(',').map(v => v.trim()) : [];
                const hcpArr = form.course_handicap ? form.course_handicap.split(',').map(v => v.trim()) : [];
                const updateCell = (type: 'par' | 'hcp', hole: number, value: string) => {
                  const arr = type === 'par'
                    ? (form.course_par ? form.course_par.split(',').map(v => v.trim()) : Array(18).fill(''))
                    : (form.course_handicap ? form.course_handicap.split(',').map(v => v.trim()) : Array(18).fill(''));
                  while (arr.length < 18) arr.push('');
                  arr[hole] = value;
                  updateField(type === 'par' ? 'course_par' : 'course_handicap', arr.join(', '));
                };
                return (
                  <div key={offset} className="overflow-x-auto">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="bg-muted/50">
                          <th className="border border-border px-1 py-1 text-left font-semibold w-12">Forat</th>
                          {Array.from({ length: 9 }, (_, i) => (
                            <th key={i} className="border border-border px-1 py-1 text-center font-semibold w-8">
                              {offset + i + 1}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="border border-border px-1 py-1 font-semibold bg-muted/30">Par</td>
                          {Array.from({ length: 9 }, (_, i) => (
                            <td key={i} className="border border-border p-0">
                              <input
                                type="number"
                                min="3"
                                max="6"
                                className="w-full h-7 text-center text-xs bg-transparent focus:outline-none focus:bg-accent/20"
                                value={parArr[offset + i] || ''}
                                onChange={(e) => updateCell('par', offset + i, e.target.value)}
                                placeholder="–"
                              />
                            </td>
                          ))}
                        </tr>
                        <tr>
                          <td className="border border-border px-1 py-1 font-semibold bg-muted/30">HCP</td>
                          {Array.from({ length: 9 }, (_, i) => (
                            <td key={i} className="border border-border p-0">
                              <input
                                type="number"
                                min="1"
                                max="18"
                                className="w-full h-7 text-center text-xs bg-transparent focus:outline-none focus:bg-accent/20"
                                value={hcpArr[offset + i] || ''}
                                onChange={(e) => updateCell('hcp', offset + i, e.target.value)}
                                placeholder="–"
                              />
                            </td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </div>

            {/* Women's stroke-index distribution (optional) */}
            <div className="space-y-3 rounded-md border border-border/60 bg-muted/20 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Label className="font-semibold">Distribució handicaps específica per a dones</Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Activa-ho si el camp té una distribució de handicap per forat diferent per a jugadores femenines. Si està activada, s'utilitzarà aquesta tarjeta per calcular els punts Stableford de les dones.
                  </p>
                </div>
                <Switch
                  checked={form.has_women_handicap}
                  onCheckedChange={(v) => {
                    updateField('has_women_handicap', v);
                    if (!v) updateField('course_handicap_women', '');
                  }}
                />
              </div>

              {form.has_women_handicap && (
                <>
                  <div className="flex gap-2 items-end">
                    <div className="flex-1 space-y-1">
                      <Label className="text-xs">URL de la web del camp (handicap dones)</Label>
                      <Input
                        value={courseUrlWomen}
                        onChange={(e) => setCourseUrlWomen(e.target.value)}
                        placeholder="https://web-del-camp.com/el-campo/"
                      />
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={() => handleExtractWomen('url')} disabled={extractingWomen || !courseUrlWomen.trim()}>
                      {extractingWomen ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Globe className="h-4 w-4 mr-1" />}
                      URL
                    </Button>
                  </div>
                  <div className="flex gap-2 items-end">
                    <div className="flex-1 space-y-1">
                      <Label className="text-xs">Foto o PDF de la tarjeta (handicap dones)</Label>
                      <Input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png,.webp"
                        onChange={(e) => setCourseFileWomen(e.target.files?.[0] || null)}
                        className="text-xs"
                      />
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={() => handleExtractWomen('file')} disabled={extractingWomen || !courseFileWomen}>
                      {extractingWomen ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Upload className="h-4 w-4 mr-1" />}
                      Fitxer
                    </Button>
                  </div>
                </>
              )}

              {form.has_women_handicap && [0, 9].map((offset) => {
                const hcpWArr = form.course_handicap_women ? form.course_handicap_women.split(',').map(v => v.trim()) : [];
                const updateCellWomen = (hole: number, value: string) => {
                  const arr = form.course_handicap_women
                    ? form.course_handicap_women.split(',').map(v => v.trim())
                    : Array(18).fill('');
                  while (arr.length < 18) arr.push('');
                  arr[hole] = value;
                  updateField('course_handicap_women', arr.join(', '));
                };
                return (
                  <div key={`women-${offset}`} className="overflow-x-auto">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="bg-muted/50">
                          <th className="border border-border px-1 py-1 text-left font-semibold w-12">Forat</th>
                          {Array.from({ length: 9 }, (_, i) => (
                            <th key={i} className="border border-border px-1 py-1 text-center font-semibold w-8">
                              {offset + i + 1}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="border border-border px-1 py-1 font-semibold bg-muted/30">HCP ♀</td>
                          {Array.from({ length: 9 }, (_, i) => (
                            <td key={i} className="border border-border p-0">
                              <input
                                type="number"
                                min="1"
                                max="18"
                                className="w-full h-7 text-center text-xs bg-transparent focus:outline-none focus:bg-accent/20"
                                value={hcpWArr[offset + i] || ''}
                                onChange={(e) => updateCellWomen(offset + i, e.target.value)}
                                placeholder="–"
                              />
                            </td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center gap-3">
              <Switch checked={form.is_master} onCheckedChange={(v) => updateField('is_master', v)} />
              <Label>Prova MASTER (coef. ×1.25)</Label>
            </div>
            <Button type="submit" className="w-full" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Guardant...' : 'Guardar'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Results import dialog */}
      <Dialog open={!!resultsRound} onOpenChange={(open) => !open && setResultsRound(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">
              Importar resultats — {resultsRound?.name}
            </DialogTitle>
          </DialogHeader>
          {resultsRound && (
            <RoundResultsImport
              round={resultsRound}
              onClose={() => setResultsRound(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* News generation dialog */}
      {newsRound && (
        <NewsGenerationDialog
          round={newsRound}
          onClose={() => setNewsRound(null)}
        />
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deletingRound} onOpenChange={(open) => !open && setDeletingRound(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar {deletingRound?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              S'eliminaran tots els resultats, fotos i dades associades a aquesta jornada. Aquesta acció no es pot desfer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel·lar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingRound && deleteMutation.mutate(deletingRound.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? 'Eliminant...' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminRounds;
