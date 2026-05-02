import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, doc, updateDoc, deleteDoc, addDoc, query, orderBy } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { handleFirestoreError, OperationType } from '@/src/lib/errorHandlers';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Trash2, Edit2, Video, PlayCircle, ExternalLink, Search, BarChart3, Tag } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

const AdminLearningVideos: React.FC = () => {
  const [activeTab, setActiveTab] = useState('videos');
  const [videos, setVideos] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Video Form
  const [isAddingVideo, setIsAddingVideo] = useState(false);
  const [isEditingVideo, setIsEditingVideo] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<any>(null);
  const [videoForm, setVideoForm] = useState({
    title: '',
    description: '',
    videoUrl: '',
    thumbnailUrl: '',
    categoryId: 'none'
  });

  // Category Form
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [categoryForm, setCategoryForm] = useState({ name: '', description: '' });

  useEffect(() => {
    const vUnsub = onSnapshot(query(collection(db, 'learningVideos'), orderBy('createdAt', 'desc')), (snapshot) => {
      setVideos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'learningVideos'));

    const cUnsub = onSnapshot(query(collection(db, 'learningCategories'), orderBy('createdAt', 'desc')), (snapshot) => {
      setCategories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'learningCategories'));

    const aUnsub = onSnapshot(query(collection(db, 'videoAnalytics'), orderBy('lastWatchedAt', 'desc')), (snapshot) => {
      setAnalytics(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'videoAnalytics'));

    return () => {
      vUnsub();
      cUnsub();
      aUnsub();
    };
  }, []);

  const handleSaveVideo = async () => {
    if (!videoForm.title || !videoForm.videoUrl) return toast.error('Title and URL are required');
    try {
      if (isEditingVideo && selectedVideo) {
        await updateDoc(doc(db, 'learningVideos', selectedVideo.id), { ...videoForm, updatedAt: new Date().toISOString() });
        toast.success('Video updated');
      } else {
        await addDoc(collection(db, 'learningVideos'), { ...videoForm, createdAt: new Date().toISOString() });
        toast.success('Video added');
      }
      setIsAddingVideo(false);
      setIsEditingVideo(false);
    } catch (e) { toast.error('Failed to save video'); }
  };

  const handleSaveCategory = async () => {
    if (!categoryForm.name) return toast.error('Name is required');
    try {
      await addDoc(collection(db, 'learningCategories'), { ...categoryForm, createdAt: new Date().toISOString() });
      toast.success('Category added');
      setIsAddingCategory(false);
      setCategoryForm({ name: '', description: '' });
    } catch (e) { toast.error('Failed to save category'); }
  };

  const deleteEntity = async (collectionName: string, id: string) => {
    if (!window.confirm('Are you sure?')) return;
    try {
      await deleteDoc(doc(db, collectionName, id));
      toast.success('Deleted successfully');
    } catch (e) { toast.error('Delete failed'); }
  };

  const getYoutubeId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  return (
    <div className="space-y-8 pb-20">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight italic uppercase">Learning Center</h1>
          <p className="text-slate-500 font-bold italic">Educate farmers and track their progress</p>
        </div>
      </div>

      <Tabs defaultValue="videos" className="w-full" onValueChange={setActiveTab}>
        <TabsList className="bg-white p-1 rounded-2xl shadow-sm border border-slate-100 h-14 flex items-center gap-1 w-fit mb-6">
          <TabsTrigger value="videos" className="rounded-xl px-8 h-full font-black italic uppercase text-xs data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-emerald-200">
             <Video size={16} className="mr-2" /> Videos
          </TabsTrigger>
          <TabsTrigger value="categories" className="rounded-xl px-8 h-full font-black italic uppercase text-xs data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-emerald-200">
             <Tag size={16} className="mr-2" /> Categories
          </TabsTrigger>
          <TabsTrigger value="analytics" className="rounded-xl px-8 h-full font-black italic uppercase text-xs data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-emerald-200">
             <BarChart3 size={16} className="mr-2" /> Analytics
          </TabsTrigger>
        </TabsList>

        {/* VIDEOS CONTENT */}
        <TabsContent value="videos" className="space-y-6">
          <div className="flex justify-between items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <Input placeholder="Search videos..." className="pl-12 h-12 rounded-2xl border-none shadow-sm" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
            <Button onClick={() => { setIsAddingVideo(true); setIsEditingVideo(false); setVideoForm({ title: '', description: '', videoUrl: '', thumbnailUrl: '', categoryId: 'none' }); }} className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl h-12 px-6 font-black italic uppercase text-xs shadow-lg shadow-emerald-200">
              <Plus size={18} className="mr-2" /> Add Video
            </Button>
          </div>

          <Card className="rounded-[2.5rem] border-none shadow-sm shadow-slate-200/50 overflow-hidden bg-white">
            <Table>
              <TableHeader className="bg-slate-50/50">
                <TableRow className="border-slate-50 hover:bg-transparent">
                  <TableHead className="px-8 font-black italic text-[10px] text-slate-400 uppercase tracking-widest">VIDEO</TableHead>
                  <TableHead className="font-black italic text-[10px] text-slate-400 uppercase tracking-widest">CATEGORY</TableHead>
                  <TableHead className="font-black italic text-[10px] text-slate-400 uppercase tracking-widest">DATE</TableHead>
                  <TableHead className="text-right px-8 font-black italic text-[10px] text-slate-400 uppercase tracking-widest">ACTIONS</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {videos.filter(v => v.title.toLowerCase().includes(searchTerm.toLowerCase())).map(video => (
                  <TableRow key={video.id} className="border-slate-50 group">
                    <TableCell className="px-8 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-16 aspect-video rounded-lg overflow-hidden bg-slate-100 shadow-sm border border-slate-200">
                           <img src={video.thumbnailUrl || (getYoutubeId(video.videoUrl) ? `https://img.youtube.com/vi/${getYoutubeId(video.videoUrl)}/default.jpg` : '')} alt="" className="w-full h-full object-cover" />
                        </div>
                        <span className="font-black italic text-slate-700 uppercase line-clamp-1 text-xs">{video.title}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-[10px] font-black italic uppercase text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md">
                        {categories.find(c => c.id === video.categoryId)?.name || 'Misc'}
                      </span>
                    </TableCell>
                    <TableCell className="text-[10px] font-bold text-slate-400 italic">
                      {video.createdAt ? format(new Date(video.createdAt), 'MMM dd, yy') : '-'}
                    </TableCell>
                    <TableCell className="text-right px-8">
                       <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="rounded-full h-8 w-8 text-slate-400 hover:text-emerald-600" onClick={() => {
                            setSelectedVideo(video);
                            setVideoForm({ title: video.title, description: video.description, videoUrl: video.videoUrl, thumbnailUrl: video.thumbnailUrl || '', categoryId: video.categoryId || 'none' });
                            setIsEditingVideo(true);
                            setIsAddingVideo(true);
                          }}><Edit2 size={14} /></Button>
                          <Button variant="ghost" size="icon" className="rounded-full h-8 w-8 text-slate-400 hover:text-red-600" onClick={() => deleteEntity('learningVideos', video.id)}><Trash2 size={14} /></Button>
                       </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* CATEGORIES CONTENT */}
        <TabsContent value="categories" className="space-y-6">
           <div className="flex justify-end">
              <Button onClick={() => setIsAddingCategory(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl h-12 px-6 font-black italic uppercase text-xs shadow-lg shadow-emerald-200">
                <Plus size={18} className="mr-2" /> New Category
              </Button>
           </div>
           
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {categories.map(cat => (
                <Card key={cat.id} className="rounded-[2rem] border-none shadow-sm bg-white p-6 relative group overflow-hidden">
                   <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="text-red-400 hover:text-red-600" onClick={() => deleteEntity('learningCategories', cat.id)}><Trash2 size={18} /></Button>
                   </div>
                   <h3 className="text-xl font-black italic text-slate-800 uppercase mb-2">{cat.name}</h3>
                   <p className="text-xs font-bold text-slate-400 italic line-clamp-2">{cat.description || 'No description'}</p>
                   <div className="mt-4 pt-4 border-t border-slate-50 flex items-center justify-between">
                      <span className="text-[10px] font-black italic text-emerald-600 uppercase">
                        {videos.filter(v => v.categoryId === cat.id).length} Videos
                      </span>
                      <span className="text-[10px] text-slate-300 font-bold italic">{format(new Date(cat.createdAt), 'MMM dd')}</span>
                   </div>
                </Card>
              ))}
           </div>
        </TabsContent>

        {/* ANALYTICS CONTENT */}
        <TabsContent value="analytics" className="space-y-6">
          <Card className="rounded-[2.5rem] border-none shadow-sm shadow-slate-200/50 overflow-hidden bg-white">
            <Table>
              <TableHeader className="bg-slate-50/50">
                <TableRow className="border-slate-50 hover:bg-transparent">
                  <TableHead className="px-8 font-black italic text-[10px] text-slate-400 uppercase tracking-widest">FARMER</TableHead>
                  <TableHead className="font-black italic text-[10px] text-slate-400 uppercase tracking-widest">VIDEO</TableHead>
                  <TableHead className="font-black italic text-[10px] text-slate-400 uppercase tracking-widest">WATCH TIME</TableHead>
                  <TableHead className="font-black italic text-[10px] text-slate-400 uppercase tracking-widest">PLAYS</TableHead>
                  <TableHead className="font-black italic text-[10px] text-slate-400 uppercase tracking-widest">LAST SEEN</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {analytics.map(item => (
                  <TableRow key={item.id} className="border-slate-50 hover:bg-slate-50/30">
                    <TableCell className="px-8 py-4">
                      <div className="flex flex-col">
                        <span className="font-black italic text-slate-700 uppercase text-xs">{item.userName}</span>
                        <span className="text-[9px] font-bold text-slate-400 italic">Farmer</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-bold text-slate-600 text-xs line-clamp-1">{item.videoTitle || 'Unknown Video'}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-black italic text-emerald-600 text-xs">
                          {Math.floor(item.watchTime / 60)}m {item.watchTime % 60}s
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-black italic text-slate-400 text-xs">{item.playCount || 1}</span>
                    </TableCell>
                    <TableCell className="text-[10px] font-bold text-slate-400 italic">
                      {item.lastWatchedAt ? format(new Date(item.lastWatchedAt), 'MMM dd, HH:mm') : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      {/* VIDEO MODAL */}
      <Dialog open={isAddingVideo} onOpenChange={(o) => { if(!o) { setIsAddingVideo(false); setIsEditingVideo(false); } }}>
        <DialogContent className="max-w-md rounded-[2.5rem]">
          <DialogHeader>
            <DialogTitle className="font-black italic uppercase text-slate-900 border-b border-slate-100 pb-4">
              {isEditingVideo ? 'Edit' : 'Add'} Learning Video
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label className="font-black italic uppercase text-[10px] text-slate-400">Category</Label>
              <Select value={videoForm.categoryId} onValueChange={v => setVideoForm({...videoForm, categoryId: v})}>
                <SelectTrigger className="rounded-xl border-slate-100 bg-slate-50 shadow-none">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-none shadow-xl">
                  <SelectItem value="none">Uncategorized</SelectItem>
                  {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="font-black italic uppercase text-[10px] text-slate-400">Title</Label>
              <Input value={videoForm.title} onChange={e => setVideoForm({...videoForm, title: e.target.value})} placeholder="Lesson title" className="rounded-xl bg-slate-50 border-none h-11" />
            </div>
            <div className="space-y-1.5">
              <Label className="font-black italic uppercase text-[10px] text-slate-400">Video Link (YouTube/Drive)</Label>
              <Input value={videoForm.videoUrl} onChange={e => setVideoForm({...videoForm, videoUrl: e.target.value})} placeholder="https://..." className="rounded-xl bg-slate-50 border-none h-11" />
            </div>
            <div className="space-y-1.5">
              <Label className="font-black italic uppercase text-[10px] text-slate-400">Description</Label>
              <Textarea value={videoForm.description} onChange={e => setVideoForm({...videoForm, description: e.target.value})} placeholder="Brief details" className="rounded-xl bg-slate-50 border-none min-h-[80px]" />
            </div>
          </div>
          <DialogFooter className="border-t border-slate-100 pt-4">
            <Button onClick={handleSaveVideo} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-11 font-black italic uppercase text-xs shadow-lg shadow-emerald-100">
              Save Video
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CATEGORY MODAL */}
      <Dialog open={isAddingCategory} onOpenChange={setIsAddingCategory}>
        <DialogContent className="max-w-sm rounded-[2.5rem]">
          <DialogHeader>
            <DialogTitle className="font-black italic uppercase text-slate-900 border-b border-slate-100 pb-4 flex items-center gap-2">
              <Tag size={18} className="text-emerald-500" /> New Playlist
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label className="font-black italic uppercase text-[10px] text-slate-400">Playlist Name</Label>
              <Input value={categoryForm.name} onChange={e => setCategoryForm({...categoryForm, name: e.target.value})} placeholder="e.g. Vaccination Guides" className="rounded-xl bg-slate-50 border-none h-11" />
            </div>
            <div className="space-y-1.5">
              <Label className="font-black italic uppercase text-[10px] text-slate-400">Description</Label>
              <Textarea value={categoryForm.description} onChange={e => setCategoryForm({...categoryForm, description: e.target.value})} placeholder="Brief summary" className="rounded-xl bg-slate-50 border-none min-h-[60px]" />
            </div>
          </div>
          <DialogFooter className="border-t border-slate-100 pt-4">
            <Button onClick={handleSaveCategory} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-11 font-black italic uppercase text-xs shadow-lg shadow-emerald-100">
              Create Playlist
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminLearningVideos;
