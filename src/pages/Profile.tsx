import React, { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { handleFirestoreError, OperationType } from '@/src/lib/errorHandlers';
import { useAuth } from '@/src/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { User, LogOut, Save, Building2, MapPin, Maximize2, Users } from 'lucide-react';

const Profile: React.FC = () => {
  const { profile, signOut } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: profile?.name || '',
    farmName: profile?.farmName || '',
    address: profile?.address || '',
    farmArea: profile?.farmArea?.toString() || '',
    birdCapacity: profile?.birdCapacity?.toString() || '',
    farmType: profile?.farmType || '',
  });

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setLoading(true);
    try {
      await updateDoc(doc(db, 'users', profile.uid), {
        ...formData,
        farmArea: Number(formData.farmArea),
        birdCapacity: Number(formData.birdCapacity),
      });
      toast.success('Profile updated successfully');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${profile.uid}`);
      toast.error('Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Profile</h1>
          <p className="text-slate-500">Manage your personal and farm details</p>
        </div>
        <Button 
          variant="outline" 
          className="text-red-600 border-red-200 hover:bg-red-50 rounded-xl gap-2"
          onClick={() => signOut()}
        >
          <LogOut size={18} />
          <span>Logout</span>
        </Button>
      </header>

      <div className="flex flex-col items-center gap-4 mb-8">
        <div className="w-24 h-24 bg-emerald-100 rounded-3xl flex items-center justify-center text-emerald-600">
          <User size={48} />
        </div>
        <div className="text-center">
          <h2 className="text-xl font-bold text-slate-900">{profile?.name}</h2>
          <p className="text-slate-500">{profile?.email}</p>
          <div className="mt-2">
            <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full uppercase tracking-wider">
              {profile?.role}
            </span>
          </div>
        </div>
      </div>

      <Card className="border-none shadow-sm">
        <CardHeader>
          <CardTitle>Farm Information</CardTitle>
          <CardDescription>Update your farm details to keep your records accurate</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpdate} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="name" className="flex items-center gap-2">
                  <User size={16} className="text-slate-400" />
                  Full Name
                </Label>
                <Input 
                  id="name" 
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="farmName" className="flex items-center gap-2">
                  <Building2 size={16} className="text-slate-400" />
                  Farm Name
                </Label>
                <Input 
                  id="farmName" 
                  value={formData.farmName}
                  onChange={e => setFormData({...formData, farmName: e.target.value})}
                  className="rounded-xl"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address" className="flex items-center gap-2">
                <MapPin size={16} className="text-slate-400" />
                Address
              </Label>
              <Input 
                id="address" 
                value={formData.address}
                onChange={e => setFormData({...formData, address: e.target.value})}
                className="rounded-xl"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="farmArea" className="flex items-center gap-2">
                  <Maximize2 size={16} className="text-slate-400" />
                  Farm Area (Acres)
                </Label>
                <Input 
                  id="farmArea" 
                  type="number"
                  value={formData.farmArea}
                  onChange={e => setFormData({...formData, farmArea: e.target.value})}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="birdCapacity" className="flex items-center gap-2">
                  <Users size={16} className="text-slate-400" />
                  Bird Capacity
                </Label>
                <Input 
                  id="birdCapacity" 
                  type="number"
                  value={formData.birdCapacity}
                  onChange={e => setFormData({...formData, birdCapacity: e.target.value})}
                  className="rounded-xl"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="farmType">Farm Type</Label>
              <Select 
                value={formData.farmType} 
                onValueChange={(value) => setFormData({ ...formData, farmType: value })}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Gavthi Farm">Gavthi Farm</SelectItem>
                  <SelectItem value="Sonali Farm">Sonali Farm</SelectItem>
                  <SelectItem value="Broiler Farm">Broiler Farm</SelectItem>
                  <SelectItem value="Layer Farm">Layer Farm</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button 
              type="submit" 
              className="w-full bg-emerald-600 hover:bg-emerald-700 rounded-xl py-6 gap-2"
              disabled={loading}
            >
              <Save size={20} />
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Profile;
