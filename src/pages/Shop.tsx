import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, onSnapshot, addDoc, where, orderBy, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';
import { handleFirestoreError, OperationType } from '@/src/lib/errorHandlers';
import { useAuth } from '@/src/lib/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { ShoppingCart, IndianRupee, Package, Search, Filter, ShoppingBag, Minus, Plus, Trash2, X, Bird, Wrench, Wheat, LayoutGrid } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetFooter } from '@/components/ui/sheet';

const Shop: React.FC = () => {
  const { user, profile } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [orderQuantity, setOrderQuantity] = useState('1');
  const [checkoutStep, setCheckoutStep] = useState(1);
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash on Delivery');
  const [cart, setCart] = useState<any[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('farm_supply_cart');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          console.error('Failed to parse cart', e);
          return [];
        }
      }
    }
    return [];
  });
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [recentViews, setRecentViews] = useState<any[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('farm_supply_recent');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          console.error('Failed to parse recent views', e);
          return [];
        }
      }
    }
    return [];
  });
  const [reviews, setReviews] = useState<any[]>([]);

  const fixImageUrl = (url: string) => {
    if (!url) return '';
    let fixedUrl = url.trim();
    
    // Handle Google Drive links
    if (fixedUrl.includes('drive.google.com')) {
      const match = fixedUrl.match(/\/d\/(.+?)(\/|$)/) || 
                    fixedUrl.match(/id=(.+?)(&|$)/) ||
                    fixedUrl.match(/\/file\/d\/(.+?)(\/|$)/) ||
                    fixedUrl.match(/drive\.google\.com\/open\?id=(.+?)(&|$)/);
                    
      if (match && match[1]) {
        return `https://lh3.googleusercontent.com/u/0/d/${match[1]}=w1000`;
      }
    }
    
    return fixedUrl;
  };

  useEffect(() => {
    const q = query(collection(db, 'shopItems'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'shopItems');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (profile?.address) {
      setDeliveryAddress(profile.address);
    }
  }, [profile]);

  useEffect(() => {
    localStorage.setItem('farm_supply_cart', JSON.stringify(cart));
    
    // Sync to Firestore for abandoned cart tracking
    if (user) {
      const syncCart = async () => {
        try {
          if (cart.length > 0) {
            await setDoc(doc(db, 'carts', user.uid), {
              userId: user.uid,
              items: cart.map(item => ({
                id: item.id,
                name: item.name,
                quantity: item.quantity,
                price: item.price
              })),
              updatedAt: new Date().toISOString()
            });
          } else {
            // If cart is empty, we can either delete the doc or keep it empty
            // Deleting is cleaner for "abandoned" logic
            await deleteDoc(doc(db, 'carts', user.uid));
          }
        } catch (error) {
          console.error('Failed to sync cart to Firestore', error);
        }
      };
      syncCart();
    }
  }, [cart, user]);

  const addToCart = (product: any) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        toast.success(`Increased quantity of ${product.name}`);
        return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      toast.success(`Added ${product.name} to cart`);
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.id !== productId));
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === productId) {
        const newQty = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  const handlePlaceOrder = async () => {
    if (!user || cart.length === 0) return;
    
    if (!deliveryAddress.trim()) {
      toast.error('Please provide a delivery address');
      return;
    }

    try {
      // Create orders for each item or a single order with multiple items
      // For simplicity with existing schema, we'll create one order with items list
      await addDoc(collection(db, 'orders'), {
        userId: user.uid,
        items: cart.map(item => ({
          id: item.id,
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          unit: item.unit
        })),
        status: 'Pending',
        totalAmount: cartTotal,
        deliveryAddress: deliveryAddress.trim(),
        paymentMethod,
        paymentStatus: paymentMethod === 'Online Payment' ? 'Paid' : 'Pending',
        date: new Date().toISOString()
      });
      
      toast.success('Order placed successfully! We will contact you soon.');
      setCart([]);
      setIsCartOpen(false);
      setCheckoutStep(1);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'orders');
      toast.error('Failed to place order');
    }
  };

  const addToRecent = (product: any) => {
    setRecentViews(prev => {
      const filtered = prev.filter(p => p.id !== product.id);
      const updated = [product, ...filtered].slice(0, 5);
      localStorage.setItem('farm_supply_recent', JSON.stringify(updated));
      return updated;
    });
  };

  const buyNow = (product: any) => {
    addToCart(product);
    setIsCartOpen(true);
    setIsDetailsOpen(false);
  };

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = categoryFilter === 'All' || item.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [items, searchTerm, categoryFilter]);

  const ProductImage = ({ item, className, contain = false }: { item: any, className?: string, contain?: boolean }) => {
    const [activeIdx, setActiveIdx] = useState(0);
    const images = item.imageUrls && item.imageUrls.length > 0 ? item.imageUrls : [item.imageUrl].filter(Boolean);

    if (images.length === 0) {
      return (
        <div className={`w-full h-full flex items-center justify-center text-slate-300 bg-slate-100 ${className}`}>
          <Package size={32} />
        </div>
      );
    }

    return (
      <div className={`relative w-full h-full group/img ${className}`}>
        <img 
          src={fixImageUrl(images[activeIdx])} 
          alt={item.name} 
          className={`w-full h-full ${contain ? 'object-contain p-4' : 'object-cover'} transition-all duration-500`} 
          referrerPolicy="no-referrer" 
          loading="lazy"
          onError={(e) => {
            (e.target as HTMLImageElement).src = 'https://placehold.co/400x400?text=Image+Not+Found';
          }}
        />
        
        {images.length > 1 && (
          <>
            <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1 opacity-0 group-hover/img:opacity-100 transition-opacity z-10">
              {images.map((_, idx) => (
                <button
                  key={idx}
                  onClick={(e) => { e.stopPropagation(); setActiveIdx(idx); }}
                  className={`w-1.5 h-1.5 rounded-full transition-all ${idx === activeIdx ? 'bg-emerald-600 w-3' : 'bg-slate-300 hover:bg-slate-400'}`}
                />
              ))}
            </div>
            <div className="absolute top-1/2 -translate-y-1/2 left-2 right-2 flex justify-between opacity-0 group-hover/img:opacity-100 transition-opacity pointer-events-none">
              <Button 
                variant="secondary" 
                size="icon" 
                className="h-6 w-6 rounded-full bg-white/80 backdrop-blur-sm pointer-events-auto"
                onClick={(e) => { e.stopPropagation(); setActiveIdx(prev => (prev - 1 + images.length) % images.length); }}
              >
                <Minus size={12} />
              </Button>
              <Button 
                variant="secondary" 
                size="icon" 
                className="h-6 w-6 rounded-full bg-white/80 backdrop-blur-sm pointer-events-auto"
                onClick={(e) => { e.stopPropagation(); setActiveIdx(prev => (prev + 1) % images.length); }}
              >
                <Plus size={12} />
              </Button>
            </div>
          </>
        )}
      </div>
    );
  };

  const categories = [
    { id: 'All', name: 'All', icon: <LayoutGrid size={20} /> },
    { id: 'Feed', name: 'Feed', icon: <Wheat size={20} /> },
    { id: 'Medicine', name: 'Medicine', icon: <Plus size={20} /> },
    { id: 'Chicks', name: 'Chicks', icon: <Bird size={20} /> },
    { id: 'Equipment', name: 'Equipment', icon: <Wrench size={20} /> },
  ];

  return (
    <div className="space-y-10 pb-20">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-8 pt-4">
        <div className="space-y-2">
          <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">Farm Supply Shop</h1>
          <p className="text-slate-500 font-medium text-lg">Premium quality feed, medicine, and equipment for your farm</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <Input 
              placeholder="Search products..." 
              className="pl-12 h-12 rounded-2xl bg-white border-slate-200 shadow-sm focus:ring-emerald-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <Sheet open={isCartOpen} onOpenChange={setIsCartOpen}>
            <SheetTrigger render={
              <Button variant="outline" className="rounded-2xl relative bg-white border-slate-200 h-12 w-12 p-0 shadow-sm hover:bg-slate-50">
                <ShoppingCart size={24} className="text-slate-600" />
                {cart.length > 0 && (
                  <Badge className="absolute -top-2 -right-2 bg-emerald-600 text-white border-none h-6 w-6 flex items-center justify-center p-0 text-[10px] font-bold">
                    {cart.reduce((s, i) => s + i.quantity, 0)}
                  </Badge>
                )}
              </Button>
            } />
            <SheetContent className="w-full sm:max-w-md rounded-l-3xl p-0 flex flex-col border-none shadow-2xl">
                <SheetHeader className="p-6 border-b border-slate-100">
                  <SheetTitle className="text-2xl font-bold flex items-center gap-2">
                    <ShoppingCart className="text-emerald-600" />
                    Your Cart
                  </SheetTitle>
                </SheetHeader>
                
                <div className="flex-1 overflow-y-auto p-6">
                  {cart.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
                      <div className="bg-slate-50 w-20 h-20 rounded-full flex items-center justify-center text-slate-300">
                        <ShoppingBag size={40} />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900">Your cart is empty</h3>
                        <p className="text-sm text-slate-500">Add some products to get started</p>
                      </div>
                      <Button onClick={() => setIsCartOpen(false)} variant="outline" className="rounded-xl">
                        Browse Products
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {cart.map((item) => (
                        <div key={item.id} className="flex gap-4">
                          <div className="w-20 h-20 rounded-2xl bg-slate-100 overflow-hidden flex-shrink-0 border border-slate-50">
                            <ProductImage item={item} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start">
                              <h4 className="font-bold text-slate-900 truncate pr-2">{item.name}</h4>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-6 w-6 text-slate-400 hover:text-red-500"
                                onClick={() => removeFromCart(item.id)}
                              >
                                <Trash2 size={14} />
                              </Button>
                            </div>
                            <p className="text-xs text-slate-500 mb-2">₹{item.price.toLocaleString()} / {item.unit}</p>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden">
                                <button 
                                  className="p-1 hover:bg-slate-50 text-slate-600"
                                  onClick={() => updateQuantity(item.id, -1)}
                                >
                                  <Minus size={14} />
                                </button>
                                <span className="px-3 text-sm font-bold text-slate-900 min-w-[30px] text-center">
                                  {item.quantity}
                                </span>
                                <button 
                                  className="p-1 hover:bg-slate-50 text-slate-600"
                                  onClick={() => updateQuantity(item.id, 1)}
                                >
                                  <Plus size={14} />
                                </button>
                              </div>
                              <p className="font-bold text-slate-900">₹{(item.price * item.quantity).toLocaleString()}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {cart.length > 0 && (
                  <SheetFooter className="p-6 bg-slate-50 border-t border-slate-100 flex-col sm:flex-col gap-4">
                    <div className="w-full space-y-2">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-slate-500">Subtotal</span>
                        <span className="font-bold text-slate-900">₹{cartTotal.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-slate-500">Delivery</span>
                        <span className="text-emerald-600 font-bold uppercase text-[10px]">Free</span>
                      </div>
                      <div className="my-2 h-[1px] bg-slate-200" />
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-slate-900">Total</span>
                        <div className="text-xl font-bold text-emerald-600 flex items-center">
                          <IndianRupee size={18} />
                          <span>{cartTotal.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>

                    <Dialog>
                      <DialogTrigger render={
                        <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl py-6 shadow-lg shadow-emerald-900/10">
                          Checkout Now
                        </Button>
                      } />
                      <DialogContent className="rounded-3xl sm:max-w-[450px]">
                        <DialogHeader>
                          <DialogTitle className="text-2xl font-bold">Checkout</DialogTitle>
                          <CardDescription>Provide delivery and payment details</CardDescription>
                        </DialogHeader>
                        <div className="py-6 space-y-6">
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label htmlFor="address">Delivery Address</Label>
                              <Input 
                                id="address" 
                                value={deliveryAddress} 
                                onChange={e => setDeliveryAddress(e.target.value)}
                                placeholder="Enter full delivery address"
                                className="rounded-xl h-12"
                              />
                            </div>

                            <div className="space-y-2">
                              <Label>Payment Method</Label>
                              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                                <SelectTrigger className="rounded-xl h-12">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Cash on Delivery">Cash on Delivery</SelectItem>
                                  <SelectItem value="Online Payment">Online Payment (Simulated)</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          <div className="p-4 bg-slate-50 rounded-2xl">
                            <div className="flex justify-between items-center text-sm mb-4">
                              <span className="text-slate-500">Total Amount</span>
                              <div className="text-xl font-bold text-emerald-600 flex items-center">
                                <IndianRupee size={18} />
                                <span>{cartTotal.toLocaleString()}</span>
                              </div>
                            </div>
                            <Button 
                              onClick={handlePlaceOrder} 
                              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl py-6 shadow-lg shadow-emerald-900/10"
                            >
                              Confirm Order
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </SheetFooter>
                )}
              </SheetContent>
            </Sheet>
        </div>
      </header>

      {/* Categories Section */}
      <section className="space-y-4">
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Browse Categories</h2>
        <div className="flex gap-4 overflow-x-auto pb-2 no-scrollbar">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setCategoryFilter(cat.id)}
              className={`flex flex-col items-center gap-2 min-w-[80px] p-3 rounded-2xl transition-all duration-300 border-2 ${
                categoryFilter === cat.id 
                  ? 'bg-emerald-50 border-emerald-500 text-emerald-700 shadow-sm' 
                  : 'bg-white border-transparent text-slate-500 hover:bg-slate-50 hover:border-slate-100'
              }`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                categoryFilter === cat.id ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'
              }`}>
                {cat.icon}
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider">{cat.name}</span>
            </button>
          ))}
        </div>
      </section>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl overflow-hidden shadow-sm animate-pulse">
              <div className="h-32 sm:h-40 bg-slate-200" />
              <div className="p-3 space-y-2">
                <div className="h-4 bg-slate-200 rounded w-3/4" />
                <div className="h-3 bg-slate-100 rounded w-1/2" />
                <div className="pt-4 flex justify-between">
                  <div className="h-5 bg-slate-200 rounded w-1/3" />
                </div>
                <div className="h-9 bg-slate-100 rounded-xl w-full" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredItems.length === 0 ? (
        <Card className="border-none shadow-sm bg-white rounded-3xl p-12 text-center">
          <div className="bg-slate-50 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 text-slate-300">
            <ShoppingBag size={40} />
          </div>
          <h3 className="text-xl font-bold text-slate-900">No products found</h3>
          <p className="text-slate-500 mt-2">Try adjusting your search or filters</p>
        </Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filteredItems.map((item) => (
            <Card 
              key={item.id} 
              className="border-none shadow-sm bg-white rounded-2xl overflow-hidden group hover:shadow-md transition-all duration-300 flex flex-col cursor-pointer"
              onClick={() => { setSelectedItem(item); setIsDetailsOpen(true); addToRecent(item); }}
            >
              <div className="h-32 sm:h-40 bg-slate-100 relative overflow-hidden">
                <ProductImage item={item} />
                <div className="absolute top-2 left-2">
                  <Badge className="bg-white/90 backdrop-blur-sm text-slate-900 border-none rounded-md text-[8px] font-bold px-1.5 py-0.5 shadow-sm">
                    {item.category.toUpperCase()}
                  </Badge>
                </div>
              </div>
              <CardContent className="p-3 flex-1 flex flex-col">
                <h3 className="text-sm font-bold text-slate-900 mb-0.5 line-clamp-1">{item.name}</h3>
                <p className="text-[10px] text-slate-500 line-clamp-1 mb-2">{item.description || 'Quality supplies for your farm.'}</p>
                
                <div className="mt-auto">
                  <div className="flex items-baseline gap-1 mb-3">
                    <span className="text-emerald-600 font-bold text-base">₹{item.price.toLocaleString()}</span>
                    <span className="text-[10px] text-slate-400 font-medium">/ {item.unit}</span>
                  </div>

                  <Button 
                    variant="outline"
                    className="w-full border-emerald-100 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 rounded-xl py-4 h-9 text-xs font-bold flex items-center gap-2"
                    onClick={(e) => { e.stopPropagation(); addToCart(item); }}
                  >
                    <Plus size={14} />
                    <span>Add to Cart</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {recentViews.length > 0 && (
        <section className="space-y-4 pt-8">
          <h2 className="text-xl font-bold text-slate-900">Your Recent Views</h2>
          <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
            {recentViews.map((item) => (
              <Card 
                key={item.id} 
                className="min-w-[180px] border-none shadow-sm bg-white rounded-xl overflow-hidden cursor-pointer hover:shadow-md transition-all"
                onClick={() => { setSelectedItem(item); setIsDetailsOpen(true); }}
              >
                <div className="h-24 bg-slate-100">
                  <ProductImage item={item} />
                </div>
                <div className="p-3">
                  <h4 className="text-xs font-bold text-slate-900 truncate">{item.name}</h4>
                  <p className="text-[10px] text-emerald-600 font-bold mt-1">₹{item.price.toLocaleString()}</p>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Product Details Dialog */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="rounded-[2rem] sm:max-w-[800px] p-0 overflow-hidden border-none max-h-[95vh]">
          {selectedItem && (
            <div className="flex flex-col md:flex-row h-full overflow-hidden">
              <div className="w-full md:w-1/2 h-[300px] md:h-auto bg-slate-50 border-r border-slate-100">
                <ProductImage item={selectedItem} className="h-full" contain />
              </div>
              <div className="w-full md:w-1/2 p-6 md:p-8 flex flex-col overflow-y-auto">
                <div className="flex justify-between items-start mb-4">
                  <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-widest text-slate-400 border-slate-200">
                    {selectedItem.category}
                  </Badge>
                  <Badge className={`${selectedItem.inStock ? 'bg-emerald-500' : 'bg-red-500'} text-white border-none rounded-lg text-[10px] font-bold px-2 py-1`}>
                    {selectedItem.inStock ? 'IN STOCK' : 'OUT OF STOCK'}
                  </Badge>
                </div>
                
                <h2 className="text-2xl font-bold text-slate-900 mb-2">{selectedItem.name}</h2>
                <p className="text-slate-500 text-sm mb-6 leading-relaxed">{selectedItem.description || 'Quality supplies for your poultry farm.'}</p>
                
                <div className="space-y-1 mb-8">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 line-through text-sm">MRP: ₹{(selectedItem.price * 1.2).toLocaleString()}</span>
                    <Badge variant="secondary" className="bg-emerald-50 text-emerald-600 text-[10px] border-none font-bold">20% OFF</Badge>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-emerald-600">₹{selectedItem.price.toLocaleString()}</span>
                    <span className="text-sm text-slate-400 font-medium">/ {selectedItem.unit}</span>
                  </div>
                </div>
                
                <div className="flex gap-3 mb-8">
                  <Button 
                    variant="outline"
                    className="flex-1 border-emerald-600 text-emerald-600 hover:bg-emerald-50 rounded-2xl py-6 font-bold"
                    onClick={() => { addToCart(selectedItem); setIsDetailsOpen(false); }}
                    disabled={!selectedItem.inStock}
                  >
                    Add to Cart
                  </Button>
                  <Button 
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl py-6 font-bold shadow-lg shadow-emerald-900/10"
                    onClick={() => buyNow(selectedItem)}
                    disabled={!selectedItem.inStock}
                  >
                    Buy Now
                  </Button>
                </div>

                <div className="space-y-8">
                  {/* Cross-sell Section */}
                  <div className="space-y-4 pt-6 border-t border-slate-100">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">You May Also Like</h4>
                    <div className="grid grid-cols-2 gap-3">
                      {items
                        .filter(i => i.category === selectedItem.category && i.id !== selectedItem.id)
                        .slice(0, 2)
                        .map(item => (
                          <div 
                            key={item.id} 
                            className="p-2 bg-white border border-slate-100 rounded-xl flex gap-2 cursor-pointer hover:border-emerald-200 transition-colors"
                            onClick={() => setSelectedItem(item)}
                          >
                            <div className="w-10 h-10 rounded-lg bg-slate-50 overflow-hidden flex-shrink-0">
                              <ProductImage item={item} />
                            </div>
                            <div className="min-w-0">
                              <p className="text-[10px] font-bold text-slate-900 truncate">{item.name}</p>
                              <p className="text-[9px] text-emerald-600 font-bold">₹{item.price}</p>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>

                  {/* Recent/Recommended Section */}
                  <div className="space-y-4 pt-6 border-t border-slate-100">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Recommended for You</h4>
                    <div className="grid grid-cols-2 gap-3">
                      {recentViews
                        .filter(i => i.id !== selectedItem.id)
                        .slice(0, 2)
                        .map(item => (
                          <div 
                            key={item.id} 
                            className="p-2 bg-white border border-slate-100 rounded-xl flex gap-2 cursor-pointer hover:border-emerald-200 transition-colors"
                            onClick={() => setSelectedItem(item)}
                          >
                            <div className="w-10 h-10 rounded-lg bg-slate-50 overflow-hidden flex-shrink-0">
                              <ProductImage item={item} />
                            </div>
                            <div className="min-w-0">
                              <p className="text-[10px] font-bold text-slate-900 truncate">{item.name}</p>
                              <p className="text-[9px] text-emerald-600 font-bold">₹{item.price}</p>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>

                  {/* Reviews Section at Bottom */}
                  <div className="space-y-4 pt-6 border-t border-slate-100 pb-4">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Customer Reviews</h4>
                    <div className="space-y-3">
                      <div className="p-4 bg-slate-50 rounded-2xl">
                        <div className="flex items-center gap-1 text-amber-400 mb-2">
                          {[...Array(5)].map((_, i) => <Plus key={i} size={10} className="fill-current" />)}
                        </div>
                        <p className="text-xs text-slate-600 font-medium leading-relaxed">"The quality of this {selectedItem.category.toLowerCase()} is outstanding. My farm productivity has improved significantly since I started using it."</p>
                        <div className="flex items-center gap-2 mt-3">
                          <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center text-[10px] font-bold text-emerald-700">RK</div>
                          <p className="text-[10px] text-slate-400">— Rahul K., Verified Farmer</p>
                        </div>
                      </div>
                      <div className="p-4 bg-slate-50 rounded-2xl">
                        <div className="flex items-center gap-1 text-amber-400 mb-2">
                          {[...Array(4)].map((_, i) => <Plus key={i} size={10} className="fill-current" />)}
                        </div>
                        <p className="text-xs text-slate-600 font-medium leading-relaxed">"Fast delivery and very well packaged. The price is also very competitive compared to local markets."</p>
                        <div className="flex items-center gap-2 mt-3">
                          <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-[10px] font-bold text-blue-700">AS</div>
                          <p className="text-[10px] text-slate-400">— Amit S., Verified Farmer</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Shop;
