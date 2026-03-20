import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Loader2, Image, Wand2, Eraser, ZoomIn, Sparkles,
  RefreshCw, ExternalLink, Copy, Newspaper, Share2, Palette
} from 'lucide-react';
import { toast } from 'sonner';

const PROMPT_GENERATORS = [
  { id: 'image-prompts',        label: 'Image Prompts' },
  { id: 'blog-topics',          label: 'Blog Topics' },
  { id: 'social-captions',      label: 'Social Captions' },
  { id: 'business-names',       label: 'Business Names' },
  { id: 'product-descriptions', label: 'Product Desc.' },
  { id: 'job-titles',           label: 'Job Titles' },
];

const BLOG_ASSET_TYPES = [
  { id: 'header',      label: 'Header Image' },
  { id: 'thumbnail',   label: 'Thumbnail' },
  { id: 'illustration',label: 'Illustration' },
  { id: 'infographic', label: 'Infographic' },
];

const SOCIAL_PLATFORMS = [
  { id: 'instagram', label: '📸 Instagram' },
  { id: 'linkedin',  label: '💼 LinkedIn' },
  { id: 'twitter',   label: '🐦 Twitter/X' },
  { id: 'facebook',  label: '👥 Facebook' },
  { id: 'pinterest', label: '📌 Pinterest' },
  { id: 'youtube',   label: '▶️ YouTube' },
];

const VISUAL_TYPES = [
  { id: 'logo',       label: 'Logo' },
  { id: 'banner',     label: 'Banner' },
  { id: 'poster',     label: 'Poster' },
  { id: 'icon',       label: 'Icon Set' },
  { id: 'mockup',     label: 'Mockup' },
  { id: 'background', label: 'Background' },
];

async function call(action, payload) {
  const res = await base44.functions.invoke('aiCreativeEngine', { action, payload });
  return res.data;
}

function ImageResult({ url, label = 'Result' }) {
  if (!url) return null;
  return (
    <div className="mt-3 space-y-2">
      <img src={url} alt={label} className="w-full rounded-lg border border-slate-600 max-h-72 object-contain bg-slate-800" />
      <div className="flex gap-2">
        <a href={url} target="_blank" rel="noopener noreferrer" className="flex-1">
          <Button variant="outline" size="sm" className="w-full text-xs border-slate-600 text-slate-300">
            <ExternalLink className="w-3 h-3 mr-1" /> Open Full
          </Button>
        </a>
        <Button variant="outline" size="sm" className="text-xs border-slate-600 text-slate-300"
          onClick={() => { navigator.clipboard.writeText(url); toast.success('URL copied!'); }}>
          <Copy className="w-3 h-3 mr-1" /> Copy URL
        </Button>
      </div>
    </div>
  );
}

export default function AICreativeStudio() {
  const [tab, setTab] = useState('blog');

  // Blog Assets
  const [blogTopic, setBlogTopic] = useState('');
  const [blogAssetType, setBlogAssetType] = useState('header');
  const [blogStyle, setBlogStyle] = useState('modern');
  const [blogResult, setBlogResult] = useState(null);
  const [blogLoading, setBlogLoading] = useState(false);

  // Social Media
  const [socialTopic, setSocialTopic] = useState('');
  const [socialPlatform, setSocialPlatform] = useState('instagram');
  const [socialStyle, setSocialStyle] = useState('professional');
  const [socialResult, setSocialResult] = useState(null);
  const [socialLoading, setSocialLoading] = useState(false);

  // Creative Visuals
  const [visualConcept, setVisualConcept] = useState('');
  const [visualType, setVisualType] = useState('logo');
  const [visualIndustry, setVisualIndustry] = useState('tech');
  const [visualColors, setVisualColors] = useState('auto');
  const [visualResult, setVisualResult] = useState(null);
  const [visualLoading, setVisualLoading] = useState(false);

  // Custom Generate
  const [imgPrompt, setImgPrompt] = useState('');
  const [imgResult, setImgResult] = useState(null);
  const [imgLoading, setImgLoading] = useState(false);

  // Edit / Tools
  const [editUrl, setEditUrl] = useState('');
  const [editPrompt, setEditPrompt] = useState('');
  const [editResult, setEditResult] = useState(null);
  const [editLoading, setEditLoading] = useState(false);
  const [toolUrl, setToolUrl] = useState('');
  const [toolResult, setToolResult] = useState(null);
  const [toolLoading, setToolLoading] = useState(false);

  // Prompt Generator
  const [pcGenerator, setPcGenerator] = useState('blog-topics');
  const [pcCount, setPcCount] = useState(5);
  const [pcResults, setPcResults] = useState([]);
  const [pcLoading, setPcLoading] = useState(false);

  async function handleBlogAsset() {
    if (!blogTopic.trim()) return toast.error('Enter a blog topic');
    setBlogLoading(true); setBlogResult(null);
    const data = await call('generate_blog_asset', { topic: blogTopic, style: blogStyle, asset_type: blogAssetType });
    setBlogResult(data);
    setBlogLoading(false);
  }

  async function handleSocialImage() {
    if (!socialTopic.trim()) return toast.error('Enter a topic or campaign idea');
    setSocialLoading(true); setSocialResult(null);
    const data = await call('generate_social_image', { topic: socialTopic, platform: socialPlatform, style: socialStyle });
    setSocialResult(data);
    setSocialLoading(false);
  }

  async function handleCreativeVisual() {
    if (!visualConcept.trim()) return toast.error('Enter a concept or brand name');
    setVisualLoading(true); setVisualResult(null);
    const data = await call('generate_creative_visual', { concept: visualConcept, visual_type: visualType, industry: visualIndustry, color_scheme: visualColors });
    setVisualResult(data);
    setVisualLoading(false);
  }

  async function handleGenerateImage() {
    if (!imgPrompt.trim()) return toast.error('Enter a prompt');
    setImgLoading(true); setImgResult(null);
    const data = await call('generate_image', { prompt: imgPrompt });
    setImgResult(data);
    setImgLoading(false);
  }

  async function handleEditImage() {
    if (!editUrl.trim() || !editPrompt.trim()) return toast.error('Enter image URL and edit prompt');
    setEditLoading(true); setEditResult(null);
    const data = await call('edit_image', { image_url: editUrl, style_prompt: editPrompt });
    setEditResult(data);
    setEditLoading(false);
  }

  async function handleTool(action) {
    if (!toolUrl.trim()) return toast.error('Enter an image URL');
    setToolLoading(true); setToolResult(null);
    const data = await call(action, { image_url: toolUrl });
    setToolResult(data);
    setToolLoading(false);
  }

  async function handlePerchance() {
    setPcLoading(true); setPcResults([]);
    const data = await call('perchance_generate', { generator: pcGenerator, count: pcCount });
    setPcResults(data.results || []);
    setPcLoading(false);
  }

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="w-5 h-5 text-purple-400" />
        <h2 className="text-white font-semibold text-lg">AI Creative Studio</h2>
        <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-xs">DALL-E Powered · All Features Live</Badge>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-slate-800 border border-slate-700 mb-4 w-full grid grid-cols-6 h-auto">
          <TabsTrigger value="blog"    className="text-xs py-1.5 flex-col gap-0.5"><Newspaper className="w-3.5 h-3.5" /><span>Blog</span></TabsTrigger>
          <TabsTrigger value="social"  className="text-xs py-1.5 flex-col gap-0.5"><Share2 className="w-3.5 h-3.5" /><span>Social</span></TabsTrigger>
          <TabsTrigger value="visual"  className="text-xs py-1.5 flex-col gap-0.5"><Palette className="w-3.5 h-3.5" /><span>Visuals</span></TabsTrigger>
          <TabsTrigger value="image"   className="text-xs py-1.5 flex-col gap-0.5"><Image className="w-3.5 h-3.5" /><span>Custom</span></TabsTrigger>
          <TabsTrigger value="tools"   className="text-xs py-1.5 flex-col gap-0.5"><Wand2 className="w-3.5 h-3.5" /><span>Edit</span></TabsTrigger>
          <TabsTrigger value="prompts" className="text-xs py-1.5 flex-col gap-0.5"><Sparkles className="w-3.5 h-3.5" /><span>Prompts</span></TabsTrigger>
        </TabsList>

        {/* ── BLOG ASSETS ── */}
        <TabsContent value="blog" className="space-y-3">
          <p className="text-slate-400 text-xs">Generate header images, thumbnails, and illustrations for blog posts.</p>
          <Input
            className="bg-slate-800 border-slate-600 text-white text-sm"
            placeholder="Blog topic (e.g. 'AI automation for freelancers')"
            value={blogTopic}
            onChange={e => setBlogTopic(e.target.value)}
          />
          <div className="flex flex-wrap gap-1.5">
            {BLOG_ASSET_TYPES.map(t => (
              <button key={t.id} onClick={() => setBlogAssetType(t.id)}
                className={`px-3 py-1 rounded-lg text-xs border transition-colors ${blogAssetType === t.id ? 'bg-purple-600 border-purple-500 text-white' : 'bg-slate-800 border-slate-600 text-slate-400 hover:border-slate-500'}`}>
                {t.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2 items-center">
            <span className="text-slate-400 text-xs shrink-0">Style:</span>
            {['modern', 'minimal', 'bold', 'illustrative'].map(s => (
              <button key={s} onClick={() => setBlogStyle(s)}
                className={`px-2.5 py-1 rounded text-xs border capitalize ${blogStyle === s ? 'bg-slate-600 border-slate-400 text-white' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>
                {s}
              </button>
            ))}
          </div>
          <Button onClick={handleBlogAsset} disabled={blogLoading} className="w-full bg-purple-600 hover:bg-purple-700">
            {blogLoading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Generating...</> : <><Newspaper className="w-4 h-4 mr-2" />Generate Blog Asset</>}
          </Button>
          <ImageResult url={blogResult?.image_url} label="Blog Asset" />
        </TabsContent>

        {/* ── SOCIAL MEDIA ── */}
        <TabsContent value="social" className="space-y-3">
          <p className="text-slate-400 text-xs">Create platform-optimized social media images for any campaign or post.</p>
          <Input
            className="bg-slate-800 border-slate-600 text-white text-sm"
            placeholder="Campaign topic or post idea (e.g. 'launch week sale')"
            value={socialTopic}
            onChange={e => setSocialTopic(e.target.value)}
          />
          <div className="grid grid-cols-3 gap-1.5">
            {SOCIAL_PLATFORMS.map(p => (
              <button key={p.id} onClick={() => setSocialPlatform(p.id)}
                className={`px-2 py-1.5 rounded-lg text-xs border transition-colors ${socialPlatform === p.id ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-800 border-slate-600 text-slate-400 hover:border-slate-500'}`}>
                {p.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2 items-center">
            <span className="text-slate-400 text-xs shrink-0">Style:</span>
            {['professional', 'vibrant', 'minimal', 'lifestyle'].map(s => (
              <button key={s} onClick={() => setSocialStyle(s)}
                className={`px-2.5 py-1 rounded text-xs border capitalize ${socialStyle === s ? 'bg-slate-600 border-slate-400 text-white' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>
                {s}
              </button>
            ))}
          </div>
          <Button onClick={handleSocialImage} disabled={socialLoading} className="w-full bg-blue-600 hover:bg-blue-700">
            {socialLoading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Generating...</> : <><Share2 className="w-4 h-4 mr-2" />Generate Social Image</>}
          </Button>
          <ImageResult url={socialResult?.image_url} label="Social Image" />
        </TabsContent>

        {/* ── CREATIVE VISUALS ── */}
        <TabsContent value="visual" className="space-y-3">
          <p className="text-slate-400 text-xs">Generate logos, banners, posters, mockups, and brand visuals.</p>
          <Input
            className="bg-slate-800 border-slate-600 text-white text-sm"
            placeholder="Brand / concept name (e.g. 'NexaFlow AI')"
            value={visualConcept}
            onChange={e => setVisualConcept(e.target.value)}
          />
          <div className="flex flex-wrap gap-1.5">
            {VISUAL_TYPES.map(t => (
              <button key={t.id} onClick={() => setVisualType(t.id)}
                className={`px-3 py-1 rounded-lg text-xs border transition-colors ${visualType === t.id ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-slate-800 border-slate-600 text-slate-400 hover:border-slate-500'}`}>
                {t.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-slate-500 text-xs mb-1">Industry</p>
              <Input className="bg-slate-800 border-slate-600 text-white text-xs h-8"
                placeholder="tech, finance, health..."
                value={visualIndustry}
                onChange={e => setVisualIndustry(e.target.value)} />
            </div>
            <div>
              <p className="text-slate-500 text-xs mb-1">Colors (optional)</p>
              <Input className="bg-slate-800 border-slate-600 text-white text-xs h-8"
                placeholder="e.g. dark blue and gold"
                value={visualColors === 'auto' ? '' : visualColors}
                onChange={e => setVisualColors(e.target.value || 'auto')} />
            </div>
          </div>
          <Button onClick={handleCreativeVisual} disabled={visualLoading} className="w-full bg-emerald-600 hover:bg-emerald-700">
            {visualLoading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Generating...</> : <><Palette className="w-4 h-4 mr-2" />Generate Visual</>}
          </Button>
          <ImageResult url={visualResult?.image_url} label="Creative Visual" />
        </TabsContent>

        {/* ── CUSTOM GENERATE ── */}
        <TabsContent value="image" className="space-y-3">
          <p className="text-slate-400 text-xs">Full custom image generation — describe exactly what you want.</p>
          <textarea
            className="w-full bg-slate-800 border border-slate-600 rounded-lg p-3 text-white text-sm resize-none h-20 focus:outline-none focus:border-purple-500"
            placeholder="Describe the image in detail: style, subject, lighting, mood, composition..."
            value={imgPrompt}
            onChange={e => setImgPrompt(e.target.value)}
          />
          <Button onClick={handleGenerateImage} disabled={imgLoading} className="w-full bg-purple-600 hover:bg-purple-700">
            {imgLoading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Generating...</> : <><Image className="w-4 h-4 mr-2" />Generate Image</>}
          </Button>
          <ImageResult url={imgResult?.image_url} label="Generated Image" />
        </TabsContent>

        {/* ── EDIT / TOOLS ── */}
        <TabsContent value="tools" className="space-y-4">
          {/* Image Edit */}
          <div className="space-y-2">
            <p className="text-slate-300 text-xs font-medium">✏️ Edit / Restyle Image</p>
            <Input className="bg-slate-800 border-slate-600 text-white text-sm" placeholder="Paste source image URL..." value={editUrl} onChange={e => setEditUrl(e.target.value)} />
            <Input className="bg-slate-800 border-slate-600 text-white text-sm" placeholder="Describe the edit (e.g. 'make it look like a watercolor painting')" value={editPrompt} onChange={e => setEditPrompt(e.target.value)} />
            <Button onClick={handleEditImage} disabled={editLoading} className="w-full bg-blue-600 hover:bg-blue-700">
              {editLoading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Editing...</> : <><Wand2 className="w-4 h-4 mr-2" />Edit Image</>}
            </Button>
            <ImageResult url={editResult?.image_url} label="Edited Image" />
          </div>

          {/* Bg Remove / Upscale */}
          <div className="border-t border-slate-700 pt-4 space-y-2">
            <p className="text-slate-300 text-xs font-medium">🔧 Transform Image</p>
            <Input className="bg-slate-800 border-slate-600 text-white text-sm" placeholder="Paste image URL to transform..." value={toolUrl} onChange={e => setToolUrl(e.target.value)} />
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={() => handleTool('remove_background')} disabled={toolLoading} className="bg-rose-600 hover:bg-rose-700 text-sm">
                {toolLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Eraser className="w-4 h-4 mr-2" />Remove BG</>}
              </Button>
              <Button onClick={() => handleTool('upscale_image')} disabled={toolLoading} className="bg-emerald-600 hover:bg-emerald-700 text-sm">
                {toolLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><ZoomIn className="w-4 h-4 mr-2" />Enhance</>}
              </Button>
            </div>
            <ImageResult url={toolResult?.image_url} label="Transformed" />
          </div>
        </TabsContent>

        {/* ── PROMPT GENERATOR ── */}
        <TabsContent value="prompts" className="space-y-3">
          <p className="text-slate-400 text-xs">AI-generated content ideas: blog topics, social captions, business names & more.</p>
          <div className="flex flex-wrap gap-1.5">
            {PROMPT_GENERATORS.map(g => (
              <button key={g.id} onClick={() => setPcGenerator(g.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${pcGenerator === g.id ? 'bg-amber-600 border-amber-500 text-white' : 'bg-slate-800 border-slate-600 text-slate-400 hover:border-slate-500'}`}>
                {g.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-xs">Count:</span>
            {[3, 5, 10].map(n => (
              <button key={n} onClick={() => setPcCount(n)}
                className={`px-2 py-1 rounded text-xs border ${pcCount === n ? 'bg-amber-600 border-amber-500 text-white' : 'bg-slate-800 border-slate-600 text-slate-400'}`}>{n}</button>
            ))}
          </div>
          <Button onClick={handlePerchance} disabled={pcLoading} className="w-full bg-amber-600 hover:bg-amber-700">
            {pcLoading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Generating...</> : <><RefreshCw className="w-4 h-4 mr-2" />Generate Ideas</>}
          </Button>
          {pcResults.length > 0 && (
            <div className="space-y-1.5 mt-2">
              {pcResults.map((r, i) => (
                <div key={i} className="flex items-start justify-between bg-slate-800 rounded-lg px-3 py-2 gap-2">
                  <span className="text-slate-200 text-sm flex-1">{r}</span>
                  <button onClick={() => { navigator.clipboard.writeText(r); toast.success('Copied!'); }} className="text-slate-500 hover:text-slate-300 shrink-0">
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}