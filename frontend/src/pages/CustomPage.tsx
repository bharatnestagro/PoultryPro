import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { Button } from '@/components/ui/button';
import { ArrowLeft, FileText } from 'lucide-react';
import Markdown from 'react-markdown';

const CustomPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const [pageData, setPageData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'system', 'settings'), (snapshot) => {
      if (snapshot.exists()) {
        const footer = snapshot.data().footer;
        const page = footer?.pages?.find((p: any) => p.slug === slug);
        setPageData(page);
      }
      setLoading(false);
    });
    return () => unsub();
  }, [slug]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  if (!pageData) {
    return (
      <div className="max-w-3xl mx-auto py-20 px-6 text-center">
        <div className="w-20 h-20 bg-slate-100 rounded-3xl flex items-center justify-center text-slate-400 mx-auto mb-6">
          <FileText size={40} />
        </div>
        <h1 className="text-3xl font-bold text-slate-900 mb-4">Page Not Found</h1>
        <p className="text-slate-500 mb-8">The page you are looking for doesn't exist or has been moved.</p>
        <Link to="/dashboard">
          <Button className="bg-emerald-600 hover:bg-emerald-700 rounded-xl px-8 h-12 font-bold">
            Back to Dashboard
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-12 px-6">
      <Link to="/dashboard">
        <Button variant="ghost" className="mb-8 gap-2 text-slate-500 hover:text-emerald-600 rounded-xl">
          <ArrowLeft size={18} /> Back to Dashboard
        </Button>
      </Link>

      <div className="bg-white rounded-[2.5rem] p-8 sm:p-12 shadow-sm border border-slate-100">
        <h1 className="text-4xl font-black text-slate-900 mb-8 leading-tight">{pageData.title}</h1>
        
        <div className="prose prose-slate max-w-none prose-headings:font-black prose-headings:text-slate-900 prose-p:text-slate-600 prose-p:leading-relaxed prose-strong:text-slate-900 prose-a:text-emerald-600 font-medium">
          <Markdown>{pageData.content}</Markdown>
        </div>
      </div>

      <div className="mt-12 pt-8 border-t border-slate-100 text-center">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
          Last updated on {new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>
    </div>
  );
};

export default CustomPage;
