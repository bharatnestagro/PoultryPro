import React from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { LogIn, UserPlus, Info } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
}

const LoginModal: React.FC<LoginModalProps> = ({ 
  isOpen, 
  onClose, 
  title = "Authentication Required",
  description = "You need to be logged in to use this feature. Access your account to manage your flocks, view analytics and more."
}) => {
  const navigate = useNavigate();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-white rounded-[2rem] p-8 border-none shadow-2xl">
        <DialogHeader className="space-y-4">
          <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 mx-auto">
            <Info size={32} />
          </div>
          <DialogTitle className="text-2xl font-bold text-center text-slate-900">{title}</DialogTitle>
          <DialogDescription className="text-center text-slate-500 font-medium leading-relaxed">
            {description}
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-6 flex flex-col gap-3">
          <Button 
            className="h-14 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold text-lg gap-3 shadow-lg shadow-emerald-100"
            onClick={() => navigate('/login')}
          >
            <LogIn size={20} /> Login to Account
          </Button>
          <Button 
            variant="outline"
            className="h-14 border-slate-100 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-2xl font-bold text-lg gap-3"
            onClick={() => navigate('/register')}
          >
            <UserPlus size={20} /> Create New Account
          </Button>
        </div>

        <DialogFooter className="justify-center border-t border-slate-50 pt-6">
          <button 
            onClick={onClose}
            className="text-xs font-bold text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors"
          >
            Not now, just browsing
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default LoginModal;