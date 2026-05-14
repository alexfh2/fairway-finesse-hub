import { useState, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Copy, Sparkles, ImagePlus, X, Instagram, MessageCircle } from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';

type Round = Tables<'rounds'>;

interface NewsGenerationDialogProps {
  round: Round;
  onClose: () => void;
}

interface GeneratedNews {
  title: string;
  subtitle: string;
  body: string;
  highlights: string[];
  seo_excerpt: string;
}

const MAX_IMAGES = 5;

const NewsGenerationDialog = ({ round, onClose }: NewsGenerationDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [specialMention, setSpecialMention] = useState('');
  const [confirmSponsor, setConfirmSponsor] = useState(true);
  // Weather conditions per day (optional)
  const [weatherFri, setWeatherFri] = useState('');
  const [weatherSat, setWeatherSat] = useState('');
  const [weatherSun, setWeatherSun] = useState('');
  const [greenSpeed, setGreenSpeed] = useState('');
  const [windConditions, setWindConditions] = useState('');
  const [language, setLanguage] = useState<'ca' | 'es'>('ca');
  const [tone, setTone] = useState<'press' | 'whatsapp' | 'instagram'>('press');
  const [generatedNews, setGeneratedNews] = useState<GeneratedNews | null>(null);
  const [generatedInstagram, setGeneratedInstagram] = useState<string | null>(null);
  const [generatedWhatsapp, setGeneratedWhatsapp] = useState<string | null>(null);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);

  const { data: existingDraft } = useQuery({
    queryKey: ['news-draft', round.id, language],
    queryFn: async () => {
      const { data } = await supabase
        .from('news_drafts')
        .select('*')
        .eq('round_id', round.id)
        .eq('language', language)
        .maybeSingle();
      return data;
    },
  });

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const remaining = MAX_IMAGES - imageFiles.length;
    const toAdd = files.slice(0, remaining);

    setImageFiles(prev => [...prev, ...toAdd]);

    toAdd.forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setImagePreviews(prev => [...prev, ev.target?.result as string]);
      };
      reader.readAsDataURL(file);
    });

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeImage = (index: number) => {
    setImageFiles(prev => prev.filter((_, i) => i !== index));
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
  };

  const uploadImages = async (): Promise<string[]> => {
    if (imageFiles.length === 0) return [];
    setUploadingImages(true);
    const urls: string[] = [];

    try {
      for (const file of imageFiles) {
        const ext = file.name.split('.').pop() || 'jpg';
        const path = `news/${round.id}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from('photos').upload(path, file);
        if (error) throw error;
        const { data: urlData } = supabase.storage.from('photos').getPublicUrl(path);
        urls.push(urlData.publicUrl);
      }
    } finally {
      setUploadingImages(false);
    }
    return urls;
  };

  const generateMutation = useMutation({
    mutationFn: async () => {
      if (tone === 'instagram') {
        const { data, error } = await supabase.functions.invoke('generate-instagram', {
          body: { round_id: round.id, language },
        });
        if (error) throw error;
        if (!data?.success) throw new Error(data?.error || 'Error generant el post');
        return { type: 'instagram' as const, post: data.post as string };
      }
      if (tone === 'whatsapp') {
        const { data, error } = await supabase.functions.invoke('generate-whatsapp', {
          body: { round_id: round.id, language },
        });
        if (error) throw error;
        if (!data?.success) throw new Error(data?.error || 'Error generant el missatge');
        return { type: 'whatsapp' as const, message: data.message as string };
      }
      // Press
      const weather_conditions = {
        friday: weatherFri || null,
        saturday: weatherSat || null,
        sunday: weatherSun || null,
        green_speed: greenSpeed || null,
        wind: windConditions || null,
      };
      const { data, error } = await supabase.functions.invoke('generate-news', {
        body: {
          round_id: round.id,
          language,
          tone,
          sponsor: confirmSponsor ? round.sponsor : null,
          special_mention: specialMention || null,
          weather_conditions,
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Error generant la notícia');
      return { type: 'press' as const, news: data.news as GeneratedNews };
    },
    onSuccess: (result) => {
      if (result.type === 'instagram') {
        setGeneratedInstagram(result.post);
        setGeneratedNews(null);
        setGeneratedWhatsapp(null);
      } else if (result.type === 'whatsapp') {
        setGeneratedWhatsapp(result.message);
        setGeneratedNews(null);
        setGeneratedInstagram(null);
      } else {
        setGeneratedNews(result.news);
        setGeneratedInstagram(null);
        setGeneratedWhatsapp(null);
      }
      toast({ title: 'Contingut generat!' });
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (publish: boolean = false) => {
      if (!generatedNews) throw new Error('No hi ha notícia generada');

      // Upload images first
      const imageUrls = await uploadImages();

      // Save photos to photos table
      if (imageUrls.length > 0) {
        const photoPayloads = imageUrls.map((url, i) => ({
          round_id: round.id,
          type: 'news',
          url,
          category: 'news',
          sort_order: i,
        }));
        const { error: photoError } = await supabase.from('photos').insert(photoPayloads);
        if (photoError) throw photoError;
      }

      const payload: any = {
        round_id: round.id,
        language,
        tone,
        title: generatedNews.title,
        subtitle: generatedNews.subtitle,
        body: generatedNews.body,
        highlights: generatedNews.highlights as any,
        seo_excerpt: generatedNews.seo_excerpt,
        special_mention: specialMention || null,
        status: publish ? 'published' : 'draft',
        published_at: publish ? new Date().toISOString() : null,
      };

      if (existingDraft) {
        const { error } = await supabase.from('news_drafts').update(payload).eq('id', existingDraft.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('news_drafts').insert(payload);
        if (error) throw error;
      }
      return publish;
    },
    onSuccess: (published) => {
      queryClient.invalidateQueries({ queryKey: ['news-draft'] });
      queryClient.invalidateQueries({ queryKey: ['admin-news'] });
      queryClient.invalidateQueries({ queryKey: ['public-news'] });
      toast({ title: published ? 'Notícia publicada' : 'Notícia guardada com a esborrany' });
      if (published) onClose();
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });




  const copyToClipboard = () => {
    if (!generatedNews) return;
    const text = `${generatedNews.title}\n\n${generatedNews.subtitle}\n\n${generatedNews.body}`;
    navigator.clipboard.writeText(text);
    toast({ title: 'Copiat al portapapers!' });
  };

  const copyInstagram = () => {
    if (!generatedInstagram) return;
    navigator.clipboard.writeText(generatedInstagram);
    toast({ title: 'Post d\'Instagram copiat!' });
  };

  const copyWhatsapp = () => {
    if (!generatedWhatsapp) return;
    navigator.clipboard.writeText(generatedWhatsapp);
    toast({ title: 'Missatge de WhatsApp copiat!' });
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">
            Generar notícia — {round.name}
          </DialogTitle>
          <DialogDescription>
            Configura les opcions i genera la notícia automàticament amb IA.
          </DialogDescription>
        </DialogHeader>

        {(!generatedNews && !generatedInstagram && !generatedWhatsapp) ? (
          <div className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Switch checked={confirmSponsor} onCheckedChange={setConfirmSponsor} />
                <Label>
                  Mencionar patrocinador: <strong>{round.sponsor || '(cap)'}</strong>
                </Label>
              </div>

              <div className="space-y-2">
                <Label>Menció especial (opcional)</Label>
                <Input
                  value={specialMention}
                  onChange={(e) => setSpecialMention(e.target.value)}
                  placeholder="p. ex. homenatge a un jugador, agraïment especial..."
                />
              </div>

              {/* Meteorology / course conditions */}
              {(() => {
                const start = round.date ? new Date(round.date) : null;
                const end = round.end_date ? new Date(round.end_date) : start;
                const days = new Set<number>();
                if (start && end) {
                  const cur = new Date(start);
                  while (cur <= end) {
                    days.add(cur.getDay()); // 0=Sun, 5=Fri, 6=Sat
                    cur.setDate(cur.getDate() + 1);
                  }
                }
                const showFri = days.has(5);
                const showSat = days.has(6);
                const showSun = days.has(0);
                const anyDay = showFri || showSat || showSun;
                return (
                  <div className="space-y-3 border border-border/50 rounded-md p-3 bg-muted/20">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Condicions meteorològiques (opcional)
                    </p>
                    {anyDay ? (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {showFri && (
                          <div className="space-y-1">
                            <Label className="text-xs">Divendres</Label>
                            <Input
                              value={weatherFri}
                              onChange={(e) => setWeatherFri(e.target.value)}
                              placeholder="p. ex. sol, 22°C"
                            />
                          </div>
                        )}
                        {showSat && (
                          <div className="space-y-1">
                            <Label className="text-xs">Dissabte</Label>
                            <Input
                              value={weatherSat}
                              onChange={(e) => setWeatherSat(e.target.value)}
                              placeholder="p. ex. núvol, pluja fluixa"
                            />
                          </div>
                        )}
                        {showSun && (
                          <div className="space-y-1">
                            <Label className="text-xs">Diumenge</Label>
                            <Input
                              value={weatherSun}
                              onChange={(e) => setWeatherSun(e.target.value)}
                              placeholder="p. ex. sol i calor"
                            />
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <Label className="text-xs">Temps</Label>
                        <Input
                          value={weatherSat}
                          onChange={(e) => setWeatherSat(e.target.value)}
                          placeholder="p. ex. sol, 22°C"
                        />
                      </div>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Velocitat dels greens</Label>
                        <Input
                          value={greenSpeed}
                          onChange={(e) => setGreenSpeed(e.target.value)}
                          placeholder="p. ex. ràpids (11 stimp), mitjans..."
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Vent</Label>
                        <Input
                          value={windConditions}
                          onChange={(e) => setWindConditions(e.target.value)}
                          placeholder="p. ex. fort de tramuntana, suau..."
                        />
                      </div>
                    </div>
                  </div>
                );
              })()}

              <div className="space-y-2">
                <Label>Idioma</Label>
                <div className="flex gap-2">
                  <Button type="button" variant={language === 'ca' ? 'default' : 'outline'} size="sm" onClick={() => setLanguage('ca')}>Català</Button>
                  <Button type="button" variant={language === 'es' ? 'default' : 'outline'} size="sm" onClick={() => setLanguage('es')}>Castellà</Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>To</Label>
                <div className="flex gap-2 flex-wrap">
                  <Button type="button" variant={tone === 'press' ? 'default' : 'outline'} size="sm" onClick={() => setTone('press')}>Nota de premsa</Button>
                  <Button type="button" variant={tone === 'whatsapp' ? 'default' : 'outline'} size="sm" onClick={() => setTone('whatsapp')}>
                    <MessageCircle className="h-4 w-4 mr-1" />
                    WhatsApp
                  </Button>
                  <Button type="button" variant={tone === 'instagram' ? 'default' : 'outline'} size="sm" onClick={() => setTone('instagram')}>
                    <Instagram className="h-4 w-4 mr-1" />
                    Instagram
                  </Button>
                </div>
              </div>

              {/* Image upload section */}
              <div className="space-y-2">
                <Label>Imatges (opcional, màx. {MAX_IMAGES})</Label>
                <p className="text-xs text-muted-foreground">
                  Puja fotos de la jornada per acompanyar la notícia.
                </p>
                <p className="text-[11px] text-muted-foreground/80 italic">
                  Consell: afegeix una foto <strong>horitzontal</strong> per fer-la servir com a capçalera (no es retallarà). Les <strong>verticals</strong> apareixeran a sota a la galeria. Si no n'hi ha cap d'horitzontal, la notícia no tindrà capçalera.
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageSelect}
                  className="hidden"
                />
                {imagePreviews.length > 0 && (
                  <div className="flex gap-2 flex-wrap">
                    {imagePreviews.map((preview, i) => (
                      <div key={i} className="relative group">
                        <img src={preview} alt="" className="w-20 h-20 object-cover rounded border border-border" />
                        <button
                          type="button"
                          onClick={() => removeImage(i)}
                          className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {imageFiles.length < MAX_IMAGES && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <ImagePlus className="h-4 w-4 mr-1" />
                    {imageFiles.length === 0 ? 'Afegir imatges' : `Afegir més (${imageFiles.length}/${MAX_IMAGES})`}
                  </Button>
                )}
              </div>
            </div>

            {existingDraft && (
              <Badge variant="outline" className="text-xs">
                Ja existeix un esborrany en {language === 'ca' ? 'català' : 'castellà'} — es sobreescriurà
              </Badge>
            )}

            <Button
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
              className="w-full"
            >
              {generateMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Generant...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  {tone === 'press' ? 'Generar nota de premsa' : tone === 'whatsapp' ? 'Generar missatge WhatsApp' : 'Generar post Instagram'}
                </>
              )}
            </Button>
          </div>
        ) : generatedNews ? (
          <div className="space-y-4">
            <Tabs defaultValue="preview">
              <TabsList>
                <TabsTrigger value="preview">Vista prèvia</TabsTrigger>
                <TabsTrigger value="edit">Editar</TabsTrigger>
              </TabsList>

              <TabsContent value="preview" className="space-y-3">
                {imagePreviews.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {imagePreviews.map((preview, i) => (
                      <img key={i} src={preview} alt="" className="h-32 rounded object-cover border border-border" />
                    ))}
                  </div>
                )}
                <div className="bg-muted/30 rounded-lg p-4 space-y-3">
                  <h2 className="font-display text-xl font-bold">{generatedNews.title}</h2>
                  <p className="text-muted-foreground italic">{generatedNews.subtitle}</p>
                  <div className="prose prose-sm max-w-none whitespace-pre-wrap">{generatedNews.body}</div>
                  {generatedNews.highlights?.length > 0 && (
                    <div className="pt-2 border-t border-border">
                      <p className="text-xs font-semibold text-muted-foreground mb-1">Destacats:</p>
                      <ul className="text-sm space-y-1">
                        {generatedNews.highlights.map((h, i) => (
                          <li key={i}>• {h}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  <strong>SEO:</strong> {generatedNews.seo_excerpt}
                </p>
              </TabsContent>

              <TabsContent value="edit" className="space-y-3">
                <div className="space-y-2">
                  <Label>Títol</Label>
                  <Input value={generatedNews.title} onChange={(e) => setGeneratedNews({ ...generatedNews, title: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Subtítol</Label>
                  <Input value={generatedNews.subtitle} onChange={(e) => setGeneratedNews({ ...generatedNews, subtitle: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Cos</Label>
                  <Textarea value={generatedNews.body} onChange={(e) => setGeneratedNews({ ...generatedNews, body: e.target.value })} rows={12} />
                </div>
                <div className="space-y-2">
                  <Label>Extracte SEO</Label>
                  <Input value={generatedNews.seo_excerpt} onChange={(e) => setGeneratedNews({ ...generatedNews, seo_excerpt: e.target.value })} />
                </div>
              </TabsContent>
            </Tabs>

            <div className="flex gap-2">
              <Button onClick={copyToClipboard} variant="outline" size="sm">
                <Copy className="h-4 w-4 mr-1" />
                Copiar
              </Button>
              <Button
                onClick={() => saveMutation.mutate(false)}
                disabled={saveMutation.isPending || uploadingImages}
                variant="outline"
                size="sm"
              >
                {saveMutation.isPending || uploadingImages ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    {uploadingImages ? 'Pujant imatges...' : 'Guardant...'}
                  </>
                ) : (
                  `Guardar esborrany${imageFiles.length > 0 ? ` (${imageFiles.length} foto${imageFiles.length > 1 ? 's' : ''})` : ''}`
                )}
              </Button>
              <Button
                onClick={() => saveMutation.mutate(true)}
                disabled={saveMutation.isPending || uploadingImages}
                size="sm"
              >
                {saveMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    Publicant...
                  </>
                ) : (
                  'Publicar ara'
                )}
              </Button>
              <Button onClick={() => { setGeneratedNews(null); }} variant="ghost" size="sm">
                Regenerar
              </Button>
            </div>
          </div>
        ) : (generatedInstagram || generatedWhatsapp) ? (
          <div className="space-y-4">
            <div className="bg-muted/30 rounded-lg p-4 max-h-[50vh] overflow-y-auto">
              <pre className="text-sm whitespace-pre-wrap font-sans">{generatedInstagram || generatedWhatsapp}</pre>
            </div>
            <div className="flex gap-2">
              <Button onClick={generatedInstagram ? copyInstagram : copyWhatsapp} variant="outline" size="sm">
                <Copy className="h-4 w-4 mr-1" />
                Copiar
              </Button>
              <Button onClick={() => { setGeneratedInstagram(null); setGeneratedWhatsapp(null); }} variant="ghost" size="sm">
                Regenerar
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
};

export default NewsGenerationDialog;
