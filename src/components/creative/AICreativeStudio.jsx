import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Loader2, Image, Wand2, Eraser, ZoomIn, Sparkles, RefreshCw, ExternalLink, Copy } from 'lucide-react';
import { toast } from 'sonner';

const PROMPT_GENERATORS = [
  { id: 'ai-character', label: 'AI Character' },
  { id: 'image-prompts', label: 'Image Prompts' },
  { id: 'story-ideas', label: 'Story Ideas' },
  { id: 'job-titles', label: 'Job Titles' },
  { id: 'business-names', label: 'Business Names' },
  { id: 'product-descriptions', label: 'Product Desc.' },
];

const IMAGE_STYLES = [
  { id: 'hd', label: 'HD Photo' },
  { id: 'anime', label: 'Anime Portrait' },
];

export default function AICreativeStudio() {
  const [tab, setTab] = useState('image');

  // Image Gen state
  const [imgPrompt, setImgPrompt] = useState('');
  const [imgStyle, setImgStyle] = useState('hd');
  const [imgResult, setImgResult] = useState(null);
  const [imgLoading, setImgLoading] = useState(false);

  // Image Edit state
  const [editUrl, setEditUrl] = useState('');
  const [editPrompt, setEditPrompt] = useState('');
  const [editResult, setEditResult] = useState(null);
  const [editLoading, setEditLoading] = useState(false);

  // BG Remove / Upscale state
  const [toolUrl, setToolUrl] = useState('');
  const [toolResult, setToolResult] = useState(null);
  const [toolLoading, setToolLoading] = useState(false);

  // Perchance state
  const [pcGenerator, setPcGenerator] = useState('ai-character');
  const [pcCount, setPcCount] = useState(5);
  const [pcResults, setPcResults] = useState([]);
  const [pcLoading, setPcLoading] = useState(false);

  // Creative Brief state
  const [briefType, setBriefType] = useState('logo');
  const [briefCategory, setBriefCategory] = useState('freelance');
  const [briefResult, setBriefResult] = useState(null);
  const [briefLoading, setBriefLoading] = useState(false);

  async function call(action, payload) {
    const res = await base44.functions.invoke('aiCreativeEngine', { action, payload });
    return res.data;
  }

  async function handleGenerateImage() {
    if (!imgPrompt.trim()) return toast.error('Enter a prompt');
    setImgLoading(true);
    setImgResult(null);
    const data = await call('generate_image', { prompt: imgPrompt, style: imgStyle });
    setImgResult(data);
    setImgLoading(false);
  }

  async function handleEditImage() {
    if (!editUrl.trim() || !editPrompt.trim()) return toast.error('Enter image URL and edit prompt');
    setEditLoading(true);
    setEditResult(null);
    const data = await call('edit_image', { image_url: editUrl, style_prompt: editPrompt });
    setEditResult(data);
    setEditLoading(false);
  }

  async function handleTool(action) {
    if (!toolUrl.trim()) return toast.error('Enter an image URL');
    setToolLoading(true);
    setToolResult(null);
    const data = await call(action, { image_url: toolUrl });
    setToolResult(data);
    setToolLoading(false);
  }

  async function handlePerchance() {
    setPcLoading(true);
    setPcResults([]);
    const data = await call('perchance_generate', { generator: pcGenerator, count: pcCount });
    setPcResults(data.results || []);
    setPcLoading(false);
  }

  async function handleBrief() {
    setBriefLoading(true);
    setBriefResult(null);
    const data = await call('generate_creative_brief', { type: briefType, category: briefCategory });
    setBriefResult(data);
    setBriefLoading(false);
  }

  function copyText(text) {
    navigator.clipboard.writeText(text);
    toast.success('Copied!');
  }

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="w-5 h-5 text-purple-400" />
        <h2 className="text-white font-semibold text-lg">AI Creative Studio</h2>
        <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30 text-xs">DeepAI + OpenAI</Badge>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-slate-800 border border-slate-700 mb-4 w-full grid grid-cols-5">
          <TabsTrigger value="image" className="text-xs">🎨 Generate</TabsTrigger>
          <TabsTrigger value="edit" className="text-xs">✏️ Edit</TabsTrigger>
          <TabsTrigger value="tools" className="text-xs">🔧 Tools</TabsTrigger>
          <TabsTrigger value="perchance" className="text-xs">🎲 Prompts</TabsTrigger>
          <TabsTrigger value="brief" className="text-xs">⚡ Brief</TabsTrigger>
        </TabsList>

        {/* ── IMAGE GENERATION ── */}
        <TabsContent value="image" className="space-y-3">
          <p className="text-slate-400 text-xs">Generate images from text using DeepAI</p>
          <textarea
            className="w-full bg-slate-800 border border-slate-600 rounded-lg p-3 text-white text-sm resize-none h-20 focus:outline-none focus:border-purple-500"
            placeholder="Describe the image you want to create..."
            value={imgPrompt}
            onChange={e => setImgPrompt(e.target.value)}
          />
          <div className="flex gap-2">
            {IMAGE_STYLES.map(s => (
              <button
                key={s.id}
                onClick={() => setImgStyle(s.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${imgStyle === s.id ? 'bg-purple-600 border-purple-500 text-white' : 'bg-slate-800 border-slate-600 text-slate-400 hover:border-slate-500'}`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <Button onClick={handleGenerateImage} disabled={imgLoading} className="w-full bg-purple-600 hover:bg-purple-700">
            {imgLoading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Generating...</> : <><Image className="w-4 h-4 mr-2" />Generate Image</>}
          </Button>
          {imgResult?.image_url && (
            <div className="mt-3 space-y-2">
              <img src={imgResult.image_url} alt="Generated" className="w-full rounded-lg border border-slate-600 max-h-80 object-contain" />
              <div className="flex gap-2">
                <a href={imgResult.image_url} target="_blank" rel="noopener noreferrer" className="flex-1">
                  <Button variant="outline" size="sm" className="w-full text-xs border-slate-600">
                    <ExternalLink className="w-3 h-3 mr-1" /> Open Full
                  </Button>
                </a>
                <Button variant="outline" size="sm" className="text-xs border-slate-600" onClick={() => copyText(imgResult.image_url)}>
                  <Copy className="w-3 h-3 mr-1" /> Copy URL
                </Button>
              </div>
            </div>
          )}
        </TabsContent>

        {/* ── IMAGE EDIT ── */}
        <TabsContent value="edit" className="space-y-3">
          <p className="text-slate-400 text-xs">Edit an existing image with AI using DeepAI Image Editor</p>
          <Input
            className="bg-slate-800 border-slate-600 text-white text-sm"
            placeholder="Paste image URL to edit..."
            value={editUrl}
            onChange={e => setEditUrl(e.target.value)}
          />
          <Input
            className="bg-slate-800 border-slate-600 text-white text-sm"
            placeholder="Describe the edit (e.g. 'make it look like a watercolor painting')"
            value={editPrompt}
            onChange={e => setEditPrompt(e.target.value)}
          />
          <Button onClick={handleEditImage} disabled={editLoading} className="w-full bg-blue-600 hover:bg-blue-700">
            {editLoading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Editing...</> : <><Wand2 className="w-4 h-4 mr-2" />Edit Image</>}
          </Button>
          {editResult?.image_url && (
            <div className="mt-3">
              <img src={editResult.image_url} alt="Edited" className="w-full rounded-lg border border-slate-600 max-h-80 object-contain" />
              <a href={editResult.image_url} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm" className="mt-2 w-full text-xs border-slate-600"><ExternalLink className="w-3 h-3 mr-1" /> Open Full</Button>
              </a>
            </div>
          )}
        </TabsContent>

        {/* ── TOOLS (bg remove / upscale) ── */}
        <TabsContent value="tools" className="space-y-3">
          <p className="text-slate-400 text-xs">Background removal & super-resolution upscaling via DeepAI</p>
          <Input
            className="bg-slate-800 border-slate-600 text-white text-sm"
            placeholder="Paste image URL..."
            value={toolUrl}
            onChange={e => setToolUrl(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={() => handleTool('remove_background')} disabled={toolLoading} className="bg-rose-600 hover:bg-rose-700 text-sm">
              {toolLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Eraser className="w-4 h-4 mr-2" />Remove BG</>}
            </Button>
            <Button onClick={() => handleTool('upscale_image')} disabled={toolLoading} className="bg-emerald-600 hover:bg-emerald-700 text-sm">
              {toolLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><ZoomIn className="w-4 h-4 mr-2" />Upscale</>}
            </Button>
          </div>
          {toolResult?.image_url && (
            <div className="mt-3">
              <img src={toolResult.image_url} alt="Result" className="w-full rounded-lg border border-slate-600 max-h-80 object-contain" />
              <a href={toolResult.image_url} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm" className="mt-2 w-full text-xs border-slate-600"><ExternalLink className="w-3 h-3 mr-1" /> Open Full</Button>
              </a>
            </div>
          )}
        </TabsContent>

        {/* ── PROMPT GENERATOR ── */}
        <TabsContent value="perchance" className="space-y-3">
          <p className="text-slate-400 text-xs">Generate creative prompts & content ideas using AI</p>
          <div className="flex flex-wrap gap-2">
            {PROMPT_GENERATORS.map(g => (
              <button
                key={g.id}
                onClick={() => setPcGenerator(g.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${pcGenerator === g.id ? 'bg-amber-600 border-amber-500 text-white' : 'bg-slate-800 border-slate-600 text-slate-400 hover:border-slate-500'}`}
              >
                {g.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-xs">Count:</span>
            {[3, 5, 10].map(n => (
              <button key={n} onClick={() => setPcCount(n)}
                className={`px-2 py-1 rounded text-xs border ${pcCount === n ? 'bg-amber-600 border-amber-500 text-white' : 'bg-slate-800 border-slate-600 text-slate-400'}`}
              >{n}</button>
            ))}
          </div>
          <Button onClick={handlePerchance} disabled={pcLoading} className="w-full bg-amber-600 hover:bg-amber-700">
            {pcLoading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Generating...</> : <><RefreshCw className="w-4 h-4 mr-2" />Generate Prompts</>}
          </Button>
          {pcResults.length > 0 && (
            <div className="space-y-2 mt-2">
              {pcResults.map((r, i) => (
                <div key={i} className="flex items-start justify-between bg-slate-800 rounded-lg px-3 py-2 gap-2">
                  <span className="text-slate-200 text-sm flex-1">{r}</span>
                  <button onClick={() => copyText(r)} className="text-slate-500 hover:text-slate-300 shrink-0">
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── CREATIVE BRIEF ── */}
        <TabsContent value="brief" className="space-y-3">
          <p className="text-slate-400 text-xs">Auto-generate a visual creative brief: AI prompt → DeepAI image</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-slate-400 text-xs mb-1">Asset Type</p>
              <div className="flex flex-wrap gap-1.5">
                {['logo','banner','avatar','product'].map(t => (
                  <button key={t} onClick={() => setBriefType(t)}
                    className={`px-2.5 py-1 rounded text-xs border capitalize ${briefType === t ? 'bg-purple-600 border-purple-500 text-white' : 'bg-slate-800 border-slate-600 text-slate-400'}`}
                  >{t}</button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-slate-400 text-xs mb-1">Category</p>
              <Input
                className="bg-slate-800 border-slate-600 text-white text-sm h-8"
                value={briefCategory}
                onChange={e => setBriefCategory(e.target.value)}
                placeholder="e.g. freelance, design..."
              />
            </div>
          </div>
          <Button onClick={handleBrief} disabled={briefLoading} className="w-full bg-gradient-to-r from-purple-600 to-amber-600 hover:opacity-90">
            {briefLoading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Creating Brief...</> : <><Sparkles className="w-4 h-4 mr-2" />Generate Creative Brief</>}
          </Button>
          {briefResult && (
            <div className="mt-3 space-y-2">
              {briefResult.prompt_used && (
                <div className="flex items-start justify-between bg-slate-800 rounded-lg px-3 py-2 gap-2">
                  <div>
                    <p className="text-slate-500 text-xs mb-0.5">Prompt Used</p>
                    <p className="text-slate-200 text-sm">{briefResult.prompt_used}</p>
                  </div>
                  <button onClick={() => copyText(briefResult.prompt_used)} className="text-slate-500 hover:text-slate-300 shrink-0">
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              {briefResult.image_url && (
                <div>
                  <img src={briefResult.image_url} alt="Brief" className="w-full rounded-lg border border-slate-600 max-h-80 object-contain" />
                  <div className="flex gap-2 mt-2">
                    <a href={briefResult.image_url} target="_blank" rel="noopener noreferrer" className="flex-1">
                      <Button variant="outline" size="sm" className="w-full text-xs border-slate-600"><ExternalLink className="w-3 h-3 mr-1" /> Open Full</Button>
                    </a>
                    <Button variant="outline" size="sm" className="text-xs border-slate-600" onClick={() => copyText(briefResult.image_url)}>
                      <Copy className="w-3 h-3 mr-1" /> Copy URL
                    </Button>
                  </div>
                </div>
              )}
              {briefResult.image_error && <p className="text-red-400 text-xs">Image error: {briefResult.image_error}</p>}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}