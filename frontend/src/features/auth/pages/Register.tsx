import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '@/src/lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { LayoutDashboard } from 'lucide-react';

const Register: React.FC = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    farmName: '',
    address: '',
    city: '',
    district: '',
    state: '',
    farmArea: '',
    birdCapacity: '',
    farmType: '',
    managerIdentifier: '', // Manager ID or Phone
  });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    if (!formData.farmType) {
      toast.error('Please select a Farm Type');
      setLoading(false);
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match');
      setLoading(false);
      return;
    }

    try {
      // Find manager if identifier provided
      let managerId = '';
      if (formData.managerIdentifier) {
        try {
          const { collection, query, where, getDocs } = await import('firebase/firestore');
          const qPhone = query(collection(db, 'users'), where('phone', '==', formData.managerIdentifier), where('role', 'in', ['manager', 'admin', 'sub-admin']));
          const qCode = query(collection(db, 'users'), where('managerCode', '==', formData.managerIdentifier.toUpperCase()), where('role', 'in', ['manager', 'admin', 'sub-admin']));
          
          const [snapPhone, snapCode] = await Promise.all([getDocs(qPhone), getDocs(qCode)]);
          
          if (!snapPhone.empty) {
            managerId = snapPhone.docs[0].id;
          } else if (!snapCode.empty) {
            managerId = snapCode.docs[0].id;
          }
        } catch (e) {
          console.error("Error looking up manager:", e);
        }
      }

      const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
      const user = userCredential.user;

      // Create user profile in Firestore
      try {
        await setDoc(doc(db, 'users', user.uid), {
          uid: user.uid,
          name: formData.name,
          email: formData.email,
          farmName: formData.farmName,
          address: formData.address,
          city: formData.city,
          district: formData.district,
          state: formData.state,
          farmArea: Number(formData.farmArea),
          birdCapacity: Number(formData.birdCapacity),
          farmType: formData.farmType,
          managerId: managerId,
          assignedManagerId: managerId,
          role: 'farmer', // Default role
          createdAt: new Date().toISOString(),
        });
      } catch (fsError) {
        throw handleFirestoreError(fsError, OperationType.WRITE, `users/${user.uid}`);
      }

      toast.success('Account created successfully');
      navigate('/dashboard');
    } catch (error: any) {
      console.error("Registration error:", error);
      let message = error.message || 'Failed to register';
      try {
        // Try to parse JSON error if it's from our handler
        const parsed = JSON.parse(error.message);
        message = parsed.error;
      } catch (e) {
        // Not a JSON error
      }
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 py-12">
      <Card className="w-full max-w-lg border-none shadow-xl">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="bg-emerald-600 p-3 rounded-2xl">
              <LayoutDashboard className="text-white" size={32} />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">Create an account</CardTitle>
          <CardDescription>
            Join PoultryPro and manage your farm efficiently
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleRegister} className="max-h-[80vh] overflow-y-auto">
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input 
                  id="name" 
                  required 
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input 
                  id="email" 
                  type="email" 
                  required 
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="rounded-xl"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input 
                  id="password" 
                  type="password" 
                  required 
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input 
                  id="confirmPassword" 
                  type="password" 
                  required 
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  className="rounded-xl"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="managerIdentifier">Manager ID or Phone (Optional)</Label>
              <Input 
                id="managerIdentifier" 
                placeholder="Enter Manager ID or Mobile Number"
                value={formData.managerIdentifier}
                onChange={(e) => setFormData({ ...formData, managerIdentifier: e.target.value })}
                className="rounded-xl"
              />
              <p className="text-[10px] text-slate-400 px-1">Mapping under a specific manager allows better support.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="farmName">Farm Name</Label>
                <Input 
                  id="farmName" 
                  required 
                  value={formData.farmName}
                  onChange={(e) => setFormData({ ...formData, farmName: e.target.value })}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="farmType">Farm Type</Label>
                <Select onValueChange={(value: string) => setFormData({ ...formData, farmType: value })}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Gavthi Farm">Gavthi Farm</SelectItem>
                    <SelectItem value="Sonali Farm">Sonali Farm</SelectItem>
                    <SelectItem value="Broiler Farm">Broiler Farm</SelectItem>
                    <SelectItem value="Layer Farm">Layer Farm</SelectItem>
                    <SelectItem value="Hatchery">Hatchery</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Address / Village</Label>
              <Input 
                id="address" 
                required 
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="rounded-xl"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input 
                  id="city" 
                  required 
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="district">District</Label>
                <Input 
                  id="district" 
                  required 
                  value={formData.district}
                  onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">State</Label>
                <Input 
                  id="state" 
                  required 
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  className="rounded-xl"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="farmArea">Farm Area (Acres)</Label>
                <Input 
                  id="farmArea" 
                  type="number" 
                  required 
                  value={formData.farmArea}
                  onChange={(e) => setFormData({ ...formData, farmArea: e.target.value })}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="birdCapacity">Bird Capacity</Label>
                <Input 
                  id="birdCapacity" 
                  type="number" 
                  required 
                  value={formData.birdCapacity}
                  onChange={(e) => setFormData({ ...formData, birdCapacity: e.target.value })}
                  className="rounded-xl"
                />
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 rounded-xl py-6 text-lg" disabled={loading}>
              {loading ? 'Creating account...' : 'Register Now'}
            </Button>
            <p className="text-sm text-center text-slate-500">
              Already have an account?{' '}
              <Link to="/login" className="text-emerald-600 font-semibold hover:underline">
                Sign In
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};

export default Register;