import { useState, useRef, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Check, X, AlertTriangle, Search, Plus, Trash2, Upload, FileSpreadsheet } from 'lucide-react';
import { DialogDescription } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { parseExcelResults, type ExcelParsedResult, type ExcelParseOutput } from '@/lib/parseExcelResults';
import type { Tables } from '@/integrations/supabase/types';

type Round = Tables<'rounds'>;

interface ParsedResult {
  position: number;
  name: string;
  license: string;
  gender: string;
  handicap: number | null;
  handicap_play: number | null;
  age: number | null;
  stableford_points: number | null;
  scratch_score: number | null;
  scores: (number | null)[];
  source_url: string;
  _selected: boolean;
  _matched_player_id?: string;
  _url_index?: number;
  _is_np?: boolean;
  _is_senior?: boolean;
}

interface Props {
  round: Round;
  onClose: () => void;
}

const SENIOR_AGE = 65;

const RoundResultsImport = ({ round, onClose }: Props) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [urls, setUrls] = useState<string[]>(['']);
  const [format, setFormat] = useState('stableford');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ParsedResult[]>([]);
  const [source, setSource] = useState('');
  const [warnings, setWarnings] = useState<string[]>([]);
  const [importTab, setImportTab] = useState('url');
  const [deleteExisting, setDeleteExisting] = useState(false);
  const [existingCount, setExistingCount] = useState<number | null>(null);
  const [needsSeniorFile, setNeedsSeniorFile] = useState(false);
  const seniorFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.from('results').select('id', { count: 'exact', head: true })
      .eq('round_id', round.id)
      .then(({ count }) => setExistingCount(count ?? 0));
  }, [round.id]);

  const addUrl = () => setUrls(prev => [...prev, '']);
  const removeUrl = (idx: number) => setUrls(prev => prev.filter((_, i) => i !== idx));
  const updateUrl = (idx: number, value: string) =>
    setUrls(prev => prev.map((u, i) => i === idx ? value : u));

  const matchPlayers = async (parsed: ParsedResult[]) => {
    const { data: players } = await supabase.from('players').select('id, name, license');
    const w: string[] = [];

    const matched = parsed.map(r => {
      const match = players?.find(
        p => (r.license && p.license === r.license) ||
          p.name.toLowerCase() === r.name.toLowerCase()
      );
      if (!match && !r._is_np) w.push(`"${r.name}" no trobat a la base de dades`);
      return { ...r, _matched_player_id: match?.id };
    });

    setResults(matched);
    if (w.length > 0) setWarnings(w);
    return matched;
  };

  // --- Senior file cross-reference (Excel or PDF) ---
  const handleSeniorFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const isPdf = file.name.toLowerCase().endsWith('.pdf');
      let seniorLicenses = new Set<string>();
      let seniorNames = new Set<string>();
      let seniorCount = 0;

      if (isPdf) {
        // Send PDF to edge function to extract senior names
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            resolve(result.split(',')[1]);
          };
          reader.readAsDataURL(file);
        });

        const { data, error } = await supabase.functions.invoke('parse-senior-pdf', {
          body: { pdf_base64: base64 },
        });
        if (error) throw new Error(error.message);

        const players: { name: string; license: string }[] = data?.players || [];
        seniorCount = players.length;
        for (const p of players) {
          if (p.license) seniorLicenses.add(p.license.trim().toUpperCase());
          if (p.name) seniorNames.add(p.name.trim().toUpperCase());
        }
      } else {
        // Excel
        const buffer = await file.arrayBuffer();
        const { results: seniorRows } = parseExcelResults(buffer);
        seniorCount = seniorRows.length;
        for (const sr of seniorRows) {
          if (sr.license) seniorLicenses.add(sr.license.trim().toUpperCase());
          if (sr.name) seniorNames.add(sr.name.trim().toUpperCase());
        }
      }

      // Cross-reference with main results
      let matched = 0;
      setResults(prev => prev.map(r => {
        const matchByLic = r.license && seniorLicenses.has(r.license.trim().toUpperCase());
        const matchByName = seniorNames.has(r.name.trim().toUpperCase());
        const isSenior = !!(matchByLic || matchByName);
        if (isSenior) matched++;
        return { ...r, _is_senior: isSenior };
      }));

      setNeedsSeniorFile(false);
      toast({
        title: `${matched} jugadors sènior identificats`,
        description: `${seniorCount} jugadors al fitxer sènior, ${matched} coincidències amb els resultats.`,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error desconegut';
      toast({ title: "Error llegint fitxer sènior", description: message, variant: 'destructive' });
    } finally {
      if (seniorFileRef.current) seniorFileRef.current.value = '';
    }
  };

  // --- Excel import ---
  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setWarnings([]);
    setResults([]);
    setNeedsSeniorFile(false);

    try {
      const buffer = await file.arrayBuffer();
      const { results: excelResults, hasSeniorInfo } = parseExcelResults(buffer);

      const parsed: ParsedResult[] = excelResults
        .filter(r => !r.is_np)
        .map(r => ({
          position: r.position,
          name: r.name,
          license: r.license,
          gender: r.gender,
          handicap: r.handicap_exact,
          handicap_play: r.handicap_play,
          age: r.age,
          stableford_points: r.stableford_points,
          scratch_score: r.scratch_score,
          scores: r.scores,
          source_url: `excel:${file.name}`,
          _selected: true,
          _is_np: false,
          _is_senior: r.age != null ? r.age >= SENIOR_AGE : r.is_senior,
        }));

      setSource(`Excel: ${file.name}`);
      const matched = await matchPlayers(parsed);

      if (!hasSeniorInfo) {
        setNeedsSeniorFile(true);
      }

      toast({
        title: `${matched.length} resultats importats des d'Excel`,
        description: `${excelResults.filter(r => r.is_np).length} N.P exclosos.${!hasSeniorInfo ? ' Cal pujar classificació sènior.' : ''} Revisa abans de guardar.`,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error desconegut';
      toast({ title: "Error llegint Excel", description: message, variant: 'destructive' });
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // --- URL import ---
  const handleFetch = async () => {
    const validUrls = urls.filter(u => u.trim());
    if (validUrls.length === 0) return;
    setLoading(true);
    setWarnings([]);
    setResults([]);

    try {
      const responses = await Promise.all(
        validUrls.map(async (url, urlIdx) => {
          const { data, error } = await supabase.functions.invoke('parse-results', {
            body: { url: url.trim(), format },
          });
          if (error) throw new Error(`Error URL ${urlIdx + 1}: ${error.message}`);
          if (!data?.success) throw new Error(data?.error || `Error parsing URL ${urlIdx + 1}`);
          return { ...data, urlIdx };
        })
      );

      const seen = new Map<string, ParsedResult>();
      let detectedSource = '';

      for (const resp of responses) {
        detectedSource = detectedSource || resp.source;
        for (const r of resp.results as ParsedResult[]) {
          const key = (r.license || r.name).toLowerCase();
          const existing = seen.get(key);
          if (existing) {
            if (r.stableford_points != null && existing.stableford_points != null) {
              if (r.stableford_points > existing.stableford_points) seen.set(key, { ...r, _selected: true, _url_index: resp.urlIdx });
            } else if (r.scratch_score != null && existing.scratch_score != null) {
              if (r.scratch_score < existing.scratch_score) seen.set(key, { ...r, _selected: true, _url_index: resp.urlIdx });
            }
          } else {
            seen.set(key, { ...r, _selected: true, _url_index: resp.urlIdx });
          }
        }
      }

      const parsed = Array.from(seen.values()).sort((a, b) => a.position - b.position);
      setSource(detectedSource);
      await matchPlayers(parsed);

      const totalResults = responses.reduce((sum, r) => sum + (r.count || 0), 0);
      toast({
        title: `${parsed.length} resultats únics (${totalResults} total de ${validUrls.length} URL${validUrls.length > 1 ? 's' : ''})`,
        description: `Font: ${detectedSource}. Revisa abans de guardar.`,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error desconegut';
      toast({ title: "Error d'importació", description: message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const toggleResult = (idx: number) => {
    setResults(prev => prev.map((r, i) =>
      i === idx ? { ...r, _selected: !r._selected } : r
    ));
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      // Delete existing results if requested
      if (deleteExisting) {
        const { error: delError } = await supabase
          .from('results')
          .delete()
          .eq('round_id', round.id);
        if (delError) throw new Error(`Error eliminant resultats existents: ${delError.message}`);
      }

      const selected = results.filter(r => r._selected);
      const newPlayers: string[] = [];

      for (const r of selected) {
        if (r._matched_player_id) continue;

        const birthYear = r.age != null ? new Date().getFullYear() - Math.floor(r.age) : null;
        const isSenior = r._is_senior ?? (r.age != null ? r.age >= SENIOR_AGE : false);

        const { data: newPlayer, error } = await supabase
          .from('players')
          .insert({
            name: r.name,
            license: r.license || `AUTO-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            current_handicap: r.handicap,
            initial_handicap: r.handicap,
            gender: r.gender === 'F' ? 'F' : r.gender === 'M' ? 'M' : null,
            is_senior: isSenior,
            birth_year: birthYear,
          } as any)
          .select('id')
          .single();

        if (error) throw new Error(`Error creant jugador "${r.name}": ${error.message}`);
        r._matched_player_id = newPlayer.id;
        newPlayers.push(r.name);
      }

      const payloads = selected.map(r => ({
        round_id: round.id,
        player_id: r._matched_player_id!,
        stableford_points: r.stableford_points,
        scratch_score: r.scratch_score,
        handicap_at_round: r.handicap,
        source_url: r.source_url,
        scorecard: r.scores.length > 0 ? { scores: r.scores, handicap_play: r.handicap_play } : null,
      }));

      const { error } = await supabase.from('results').insert(payloads);
      if (error) throw error;

      for (const r of selected) {
        if (r._matched_player_id) {
          const updates: Record<string, any> = {};
          if (r.handicap != null) updates.current_handicap = r.handicap;
          if (r.gender === 'F' || r.gender === 'M') updates.gender = r.gender;
          if (r._is_senior != null) updates.is_senior = r._is_senior;
          if (r.age != null) {
            updates.birth_year = new Date().getFullYear() - Math.floor(r.age);
            updates.is_senior = r.age >= SENIOR_AGE;
          }
          if (Object.keys(updates).length > 0) {
            await supabase
              .from('players')
              .update(updates as any)
              .eq('id', r._matched_player_id);
          }
        }
      }

      await supabase.from('import_logs').insert({
        round_id: round.id,
        source: source || (importTab === 'excel' ? 'excel' : 'url'),
        source_url: importTab === 'excel' ? source : urls.filter(u => u.trim()).join(' | '),
        records_imported: selected.length,
        records_skipped: results.length - selected.length,
        skipped_records: results.filter(r => !r._selected).map(r => ({ name: r.name, reason: 'deselected' })),
        status: 'completed',
      });

      return { imported: selected.length, newPlayers };
    },
    onSuccess: ({ imported, newPlayers }) => {
      queryClient.invalidateQueries({ queryKey: ['admin-rounds'] });
      const msg = newPlayers.length > 0
        ? `${imported} resultats importats. ${newPlayers.length} jugadors nous creats.`
        : `${imported} resultats importats.`;
      toast({ title: 'Importació completada', description: msg });
      onClose();
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  return (
    <div className="space-y-4">
      <DialogDescription className="text-sm text-muted-foreground">
        Importa resultats des d'un fitxer Excel o des d'URLs (GolfDirecto / Teeone).
      </DialogDescription>

      {existingCount != null && existingCount > 0 && (
        <div className="flex items-center gap-2 p-3 border rounded-md bg-muted/30">
          <Checkbox
            id="delete-existing"
            checked={deleteExisting}
            onCheckedChange={(checked) => setDeleteExisting(checked === true)}
          />
          <label htmlFor="delete-existing" className="text-sm cursor-pointer">
            <span className="font-medium">Eliminar {existingCount} resultats existents</span>
            <span className="text-muted-foreground ml-1">abans d'importar (substituir)</span>
          </label>
        </div>
      )}

      <Tabs value={importTab} onValueChange={(v) => { setImportTab(v); setResults([]); setWarnings([]); }}>
        <TabsList className="w-full">
          <TabsTrigger value="excel" className="flex-1 gap-1">
            <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
          </TabsTrigger>
          <TabsTrigger value="url" className="flex-1 gap-1">
            <Search className="h-3.5 w-3.5" /> URL
          </TabsTrigger>
        </TabsList>

        <TabsContent value="excel" className="space-y-3 mt-3">
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Fitxer Excel amb resultats (.xlsx)</Label>
            <p className="text-xs text-muted-foreground">
              Puja l'Excel amb les columnes: Pos, Licencia, Nombre, Hex, NVH, Niv, Edad, Sex, Cat, Hpu, Total, H1-H18, Totalx.
              Els jugadors N.P s'exclouran automàticament. Sènior = edat ≥ 65 o Niv = S.
            </p>
            <div className="flex gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleExcelUpload}
                className="hidden"
              />
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
                className="w-full"
              >
                <Upload className="h-4 w-4 mr-2" />
                {loading ? 'Llegint Excel...' : 'Seleccionar fitxer Excel'}
              </Button>
            </div>
          </div>

          {/* Senior classification upload fallback */}
          {needsSeniorFile && results.length > 0 && (
            <Card className="border-amber-300 bg-amber-50/50">
              <CardContent className="py-3 space-y-2">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-amber-800">
                      No s'ha detectat informació de sènior (ni Edat ni Niv)
                    </p>
                    <p className="text-xs text-amber-700">
                      Puja la classificació sènior per identificar automàticament els jugadors sènior.
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <input
                    ref={seniorFileRef}
                    type="file"
                    accept=".xlsx,.xls,.pdf"
                    onChange={handleSeniorFileUpload}
                    className="hidden"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => seniorFileRef.current?.click()}
                    className="w-full"
                  >
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    Pujar classificació sènior
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* URL tab */}
        <TabsContent value="url" className="space-y-3 mt-3">
          <div className="space-y-2">
            <Label className="text-sm font-semibold">URLs dels resultats</Label>
            <p className="text-xs text-muted-foreground">
              Afegeix una URL per cada dia de joc. Els resultats es fusionaran automàticament (millor resultat per jugador).
            </p>
            {urls.map((url, idx) => (
              <div key={idx} className="flex gap-2">
                <Input
                  value={url}
                  onChange={(e) => updateUrl(idx, e.target.value)}
                  placeholder={`URL dia ${idx + 1} — https://www.golfdirecto.com/micro/game/...`}
                  className="flex-1"
                />
                {urls.length > 1 && (
                  <Button variant="ghost" size="icon" onClick={() => removeUrl(idx)}>
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                )}
              </div>
            ))}
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={addUrl}>
                <Plus className="h-3 w-3 mr-1" /> Afegir URL
              </Button>
              <Select value={format} onValueChange={setFormat}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="stableford">Stableford</SelectItem>
                  <SelectItem value="medal">Medal</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={handleFetch} disabled={loading || urls.every(u => !u.trim())} className="ml-auto">
                <Search className="h-4 w-4 mr-2" />
                {loading ? 'Llegint...' : 'Llegir resultats'}
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Warnings */}
      {warnings.length > 0 && (
        <Card className="border-yellow-300 bg-yellow-50">
          <CardContent className="py-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-yellow-800 mb-1">
                  {warnings.length} avisos — jugadors nous es crearan automàticament
                </p>
                <ul className="text-xs text-yellow-700 space-y-0.5 max-h-24 overflow-y-auto">
                  {warnings.map((w, i) => (
                    <li key={i}>• {w}</li>
                  ))}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results preview */}
      {results.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">
              {results.filter(r => r._selected).length} / {results.length} resultats seleccionats
              {source && <Badge variant="outline" className="ml-2 text-xs">{source}</Badge>}
            </p>
            <Button
              size="sm"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || results.filter(r => r._selected).length === 0}
            >
              <Check className="h-4 w-4 mr-2" />
              {saveMutation.isPending ? 'Guardant...' : 'Guardar resultats'}
            </Button>
          </div>

          <div className="border rounded-md overflow-hidden overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/50 border-b">
                  <th className="p-2 text-left w-8"></th>
                  <th className="p-2 text-left">Pos</th>
                  <th className="p-2 text-left">Jugador</th>
                  <th className="p-2 text-left">Llicència</th>
                  <th className="p-2 text-right">Hcp</th>
                  <th className="p-2 text-right">Hpu</th>
                  <th className="p-2 text-right">Stb</th>
                  <th className="p-2 text-right">Scr</th>
                  {importTab === 'excel' && <th className="p-2 text-center">Edat</th>}
                  <th className="p-2 text-center">Estat</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, idx) => (
                  <tr
                    key={idx}
                    className={`border-b last:border-0 ${!r._selected ? 'opacity-40' : ''} ${r._matched_player_id ? '' : 'bg-yellow-50/50'}`}
                  >
                    <td className="p-2">
                      <button
                        onClick={() => toggleResult(idx)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        {r._selected ? <Check className="h-3 w-3 text-emerald-600" /> : <X className="h-3 w-3" />}
                      </button>
                    </td>
                    <td className="p-2 font-mono">{r.position}</td>
                    <td className="p-2 font-medium">
                      {r.name}
                      {r.gender && <span className="text-muted-foreground ml-1">({r.gender})</span>}
                      {r._is_senior && <Badge variant="outline" className="ml-1 text-[10px] px-1 py-0">Sènior</Badge>}
                    </td>
                    <td className="p-2 font-mono text-muted-foreground">{r.license || '—'}</td>
                    <td className="p-2 text-right font-mono">{r.handicap ?? '—'}</td>
                    <td className="p-2 text-right font-mono">{r.handicap_play ?? '—'}</td>
                    <td className="p-2 text-right font-mono font-bold">{r.stableford_points ?? '—'}</td>
                    <td className="p-2 text-right font-mono text-muted-foreground">{r.scratch_score ?? '—'}</td>
                    {importTab === 'excel' && (
                      <td className="p-2 text-center font-mono text-muted-foreground">{r.age ?? '—'}</td>
                    )}
                    <td className="p-2 text-center">
                      {r._matched_player_id ? (
                        <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700">Trobat</Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700">Nou</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default RoundResultsImport;
