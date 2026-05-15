import React, { useEffect, useState, useRef } from 'react';
import { collection, query, orderBy, onSnapshot, doc, setDoc, getDoc, updateDoc, increment, arrayUnion } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '@/src/lib/firebase';
import { useAuth } from '@/src/lib/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PlayCircle, Video, Search, Filter, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertTriangle } from 'lucide-react';

interface LearningVideo {
  id: string;
  title: string;
  description: string;
  videoUrl: string;
  thumbnailUrl?: string;
  categoryId?: string;
  createdAt: string;
}

interface Category {
  id: string;
  name: string;
}

const Learn: React.FC = () => {
  const { user } = useAuth();
  const [videos, setVideos] = useState<LearningVideo[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVideo, setSelectedVideo] = useState<LearningVideo | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  
  // Tracking
  const watchTimerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    // Fetch Categories
    const catUnsub = onSnapshot(query(collection(db, 'learningCategories'), orderBy('createdAt', 'desc')), (snapshot) => {
      setCategories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category)));
    });

    // Fetch Videos
    const videoUnsub = onSnapshot(query(collection(db, 'learningVideos'), orderBy('createdAt', 'desc')), (snapshot) => {
      setVideos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LearningVideo)));
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'learningVideos'));

    return () => {
      catUnsub();
      videoUnsub();
    };
  }, []);

  const trackWatch = async (video: LearningVideo, isEnd: boolean = false) => {
    if (!user) return;
    const watchDuration = Math.floor((Date.now() - startTimeRef.current) / 1000);
    if (watchDuration < 2 && !isEnd) return; // Don't track very short bursts unless it's closing

    const analyticsId = `${user.uid}_${video.id}`;
    const analyticsRef = doc(db, 'videoAnalytics', analyticsId);

    try {
      const snap = await getDoc(analyticsRef);
      if (snap.exists()) {
        await updateDoc(analyticsRef, {
          watchTime: increment(watchDuration),
          lastWatchedAt: new Date().toISOString(),
          playCount: isEnd ? increment(1) : increment(0)
        });
      } else {
        await setDoc(analyticsRef, {
          userId: user.uid,
          userName: user.displayName || 'Farmer',
          videoId: video.id,
          videoTitle: video.title,
          watchTime: watchDuration,
          playCount: 1,
          lastWatchedAt: new Date().toISOString(),
          status: 'Partial'
        });
      }
      // Reset start time for next segment
      startTimeRef.current = Date.now();
    } catch (e) {
      console.error("Watch tracking error:", e);
    }
  };

  useEffect(() => {
    if (selectedVideo) {
      startTimeRef.current = Date.now();
      watchTimerRef.current = setInterval(() => trackWatch(selectedVideo), 15000); // Track every 15s
    } else {
      if (watchTimerRef.current) {
        clearInterval(watchTimerRef.current);
        // Track the final segment before closing
        // Note: selectedVideo might be null here, so we'd need to store last video in a ref
      }
    }
    return () => {
      if (watchTimerRef.current) clearInterval(watchTimerRef.current);
    };
  }, [selectedVideo]);

  const getEmbedUrl = (url: string) => {
    if (!url) return '';
    try {
      const urlObj = new URL(url);
      if (urlObj.hostname.includes('youtube.com') || urlObj.hostname.includes('youtu.be')) {
        let videoId = '';
        if (urlObj.hostname.includes('youtu.be')) videoId = urlObj.pathname.substring(1);
        else if (urlObj.searchParams.has('v')) videoId = urlObj.searchParams.get('v') || '';
        else if (urlObj.pathname.includes('/embed/')) videoId = urlObj.pathname.split('/embed/')[1];
        if (videoId.includes('?')) videoId = videoId.split('?')[0];
        if (videoId.includes('&')) videoId = videoId.split('&')[0];
        return `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`;
      }
      if (urlObj.hostname.includes('drive.google.com')) {
        const fileIdMatch = urlObj.pathname.match(/\/d\/([^/]+)/);
        if (fileIdMatch && fileIdMatch[1]) return `https://drive.google.com/file/d/${fileIdMatch[1]}/preview`;
      }
      return url;
    } catch (e) { return url; }
  };

  const getYoutubeId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  const filteredVideos = videos.filter(v => {
    const matchesSearch = v.title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = activeCategory === 'all' || v.categoryId === activeCategory;
    return matchesSearch && matchesCategory;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  const handleCloseAttempt = () => {
    setShowCloseConfirm(true);
  };

  const confirmClose = () => {
    if (selectedVideo) {
      trackWatch(selectedVideo, true);
    }
    setSelectedVideo(null);
    setShowCloseConfirm(false);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight italic">LEARN</h1>
          <p className="text-slate-500 font-bold italic text-sm">Grow your farm knowledge</p>
        </div>
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <Input 
            placeholder="Search lessons..." 
            className="pl-10 h-11 bg-white border-none rounded-2xl shadow-sm focus-visible:ring-emerald-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {categories.length > 0 && (
        <div className="overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
          <div className="flex gap-2">
            <Button 
               variant={activeCategory === 'all' ? 'default' : 'secondary'}
               className={`rounded-full px-6 font-black italic uppercase text-[10px] ${activeCategory === 'all' ? 'bg-emerald-600 text-white' : 'bg-white text-slate-500'}`}
               onClick={() => setActiveCategory('all')}
            >
              All
            </Button>
            {categories.map(cat => (
              <Button 
                key={cat.id}
                variant={activeCategory === cat.id ? 'default' : 'secondary'}
                className={`rounded-full px-6 font-black italic uppercase text-[10px] whitespace-nowrap ${activeCategory === cat.id ? 'bg-emerald-600 text-white' : 'bg-white text-slate-500'}`}
                onClick={() => setActiveCategory(cat.id)}
              >
                {cat.name}
              </Button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredVideos.map((video) => {
          const ytId = getYoutubeId(video.videoUrl);
          const thumb = video.thumbnailUrl || (ytId ? `https://img.youtube.com/vi/${ytId}/mqdefault.jpg` : '');
          const category = categories.find(c => c.id === video.categoryId);
          
          return (
            <Card 
              key={video.id} 
              className="rounded-3xl border-none shadow-sm shadow-slate-200/50 overflow-hidden group cursor-pointer hover:shadow-md transition-all bg-white"
              onClick={() => setSelectedVideo(video)}
            >
              <CardContent className="p-0 flex items-stretch h-32">
                <div className="relative w-40 shrink-0 overflow-hidden bg-slate-50">
                  {thumb ? (
                     <img src={thumb} alt={video.title} className="w-full h-full object-cover" />
                  ) : (
                     <div className="w-full h-full flex items-center justify-center">
                        <Video size={24} className="text-slate-200" />
                     </div>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/10 group-hover:bg-black/30 transition-colors">
                     <PlayCircle className="text-white opacity-80 group-hover:scale-110 transition-transform" size={24} />
                  </div>
                </div>
                <div className="p-4 flex flex-col justify-center flex-1 min-w-0">
                  <div className="flex flex-col gap-1">
                    {category && (
                      <span className="text-[8px] font-black italic uppercase text-emerald-600 bg-emerald-50 w-fit px-2 py-0.5 rounded-full">
                        {category.name}
                      </span>
                    )}
                    <h3 className="text-[13px] font-black italic text-slate-800 leading-tight uppercase line-clamp-2">{video.title}</h3>
                  </div>
                  <div className="mt-auto flex items-center justify-between">
                    <span className="text-[9px] font-black italic text-slate-300 uppercase">Watch Lesson</span>
                    <PlayCircle size={14} className="text-emerald-500 opacity-50" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredVideos.length === 0 && (
        <div className="text-center py-20 bg-white rounded-[2rem] border-2 border-dashed border-slate-100">
           <Video className="text-slate-200 mx-auto mb-3" size={32} />
           <p className="text-slate-400 font-bold italic uppercase text-xs">No lessons found</p>
        </div>
      )}

      <Dialog open={!!selectedVideo} onOpenChange={(open) => {
        if (!open) {
          handleCloseAttempt();
        }
      }}>
        <DialogContent 
          className="max-w-4xl p-0 overflow-hidden bg-black border-none rounded-[2rem]"
          showCloseButton={false}
        >
          <div className="relative pt-[56.25%] w-full h-0">
            {selectedVideo && (
              <iframe
                className="absolute top-0 left-0 w-full h-full"
                src={getEmbedUrl(selectedVideo.videoUrl)}
                title={selectedVideo.title}
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
                allowFullScreen={true}
              ></iframe>
            )}
            <Button 
                variant="secondary" 
                size="icon" 
                onClick={handleCloseAttempt} 
                className="absolute top-4 right-4 rounded-full bg-white/20 hover:bg-white/40 text-white border-none z-50 backdrop-blur-md"
              >
                 <X size={20} />
              </Button>
          </div>
          {selectedVideo && (
            <div className="p-6 bg-white">
               <div className="flex justify-between items-start gap-4">
                  <div>
                    <h2 className="text-lg font-black italic text-slate-900 uppercase leading-none">{selectedVideo.title}</h2>
                    <p className="text-slate-500 font-bold italic mt-2 text-xs">{selectedVideo.description}</p>
                  </div>
               </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Close Confirmation Dialog */}
      <Dialog open={showCloseConfirm} onOpenChange={setShowCloseConfirm}>
        <DialogContent className="max-w-xs rounded-3xl p-6">
          <DialogHeader>
            <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center text-amber-600 mb-4">
              <AlertTriangle size={24} />
            </div>
            <DialogTitle className="text-xl font-black italic text-slate-900 uppercase">Want to Close?</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm font-bold text-slate-500 italic">Are you sure you want to stop watching this lesson?</p>
          </div>
          <DialogFooter className="flex gap-2 sm:justify-start">
            <Button 
              variant="default" 
              className="flex-1 rounded-2xl bg-red-600 hover:bg-red-700 font-black italic uppercase text-xs"
              onClick={confirmClose}
            >
              Yes, Close
            </Button>
            <Button 
              variant="secondary" 
              className="flex-1 rounded-2xl bg-slate-100 font-black italic uppercase text-xs"
              onClick={() => setShowCloseConfirm(false)}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Learn;
