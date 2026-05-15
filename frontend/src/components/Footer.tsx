import React, { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { 
  Facebook, 
  Instagram, 
  Twitter, 
  Linkedin, 
  Youtube, 
  Mail, 
  Phone, 
  MapPin,
  ExternalLink
} from 'lucide-react';
import { Link } from 'react-router-dom';

const Footer = () => {
  const [footerData, setFooterData] = useState<any>(null);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'system', 'settings'), (doc) => {
      if (doc.exists()) {
        setFooterData(doc.data().footer);
      }
    });
    return () => unsub();
  }, []);

  if (!footerData) return null;

  const socialIcons: any = {
    facebook: <Facebook size={18} />,
    instagram: <Instagram size={18} />,
    twitter: <Twitter size={18} />,
    linkedin: <Linkedin size={18} />,
    youtube: <Youtube size={18} />
  };

  return (
    <footer className="bg-white border-t border-slate-100 pt-16 pb-8 mt-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-12">
          {/* Logo & About */}
          <div className="space-y-6">
            {footerData.logo ? (
              <img src={footerData.logo} alt="Logo" className="h-10 object-contain" />
            ) : (
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white font-bold text-xl">P</div>
                <span className="text-xl font-bold text-slate-900 tracking-tight">PoultryPro</span>
              </div>
            )}
            <p className="text-sm text-slate-500 leading-relaxed font-medium">
              {footerData.footerText || "Empowering farmers with modern technology and smart management solutions."}
            </p>
            <div className="flex items-center gap-3">
              {Object.entries(footerData.socialLinks || {}).map(([platform, url]: [any, any]) => (
                url && (
                  <a 
                    key={platform}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 transition-all"
                  >
                    {socialIcons[platform]}
                  </a>
                )
              ))}
            </div>
          </div>

          {/* Quick Links */}
          <div className="space-y-6">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Resources</h4>
            {footerData.pages && footerData.pages.length > 0 ? (
              <ul className="space-y-3">
                {footerData.pages.map((page: any) => (
                  <li key={page.id}>
                    <Link 
                      to={`/page/${page.slug}`} 
                      className="text-sm font-bold text-slate-600 hover:text-emerald-600 transition-colors flex items-center gap-2 group"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-200 group-hover:bg-emerald-400 transition-colors"></span>
                      {page.title}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-slate-400 font-medium italic">No resources added</p>
            )}
          </div>

          {/* Contact Info */}
          <div className="space-y-6">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Connect</h4>
            <ul className="space-y-4">
              {footerData.contactEmail && (
                <li className="flex items-start gap-3">
                  <div className="mt-1 text-emerald-600">
                    <Mail size={18} />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Email Us</p>
                    <p className="text-sm font-bold text-slate-900">{footerData.contactEmail}</p>
                  </div>
                </li>
              )}
              {footerData.contactNumber && (
                <li className="flex items-start gap-3">
                  <div className="mt-1 text-emerald-600">
                    <Phone size={18} />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Call Us</p>
                    <p className="text-sm font-bold text-slate-900">{footerData.contactNumber}</p>
                  </div>
                </li>
              )}
            </ul>
          </div>

          {/* Location */}
          <div className="space-y-6">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Office</h4>
            <div className="flex items-start gap-3">
              <div className="mt-1 text-emerald-600">
                <MapPin size={18} />
              </div>
              <p className="text-sm font-bold text-slate-900 leading-relaxed">
                {footerData.address || "123 Farm Street, Agrotech Nagar"}
              </p>
            </div>
            <div className="pt-2">
              <button className="w-full h-11 bg-emerald-50 rounded-xl text-emerald-600 text-xs font-bold flex items-center justify-center gap-2 hover:bg-emerald-100 transition-all">
                View on Google Maps <ExternalLink size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* Bottom */}
        <div className="pt-8 border-t border-slate-50 flex flex-col md:flex-row items-center justify-center text-center">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest text-center">
            {footerData.copyrightText || `© ${new Date().getFullYear()} PoultryPro Management System. All rights reserved.`}
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
