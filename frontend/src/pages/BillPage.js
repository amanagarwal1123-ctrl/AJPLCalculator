import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth, apiClient } from '@/App';

const IMG_BASE = process.env.REACT_APP_BACKEND_URL || window.location.origin;
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import { Plus, Trash2, Send, Printer, Download, ArrowLeft, Edit, CheckCircle, Clock, History, Layers, ChevronRight, User, Camera, X, ZoomIn, Percent } from 'lucide-react';
import { toast } from 'sonner';

export default function BillPage() {
  const { billId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [bill, setBill] = useState(null);
  const [loading, setLoading] = useState(true);
  const [extChargeName, setExtChargeName] = useState('');
  const [extChargeAmount, setExtChargeAmount] = useState('');
  const [showExtChargeForm, setShowExtChargeForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(null);
  const [lightboxImg, setLightboxImg] = useState(null);
  const [execBills, setExecBills] = useState([]);
  const [switcherOpen, setSwitcherOpen] = useState(false);

  useEffect(() => { loadBill(); }, [billId]);

  useEffect(() => {
    if (user?.role === 'executive') loadExecBills();
  }, [user]);

  const loadBill = async () => {
    try {
      const res = await apiClient.get(`/bills/${billId}`);
      setBill(res.data);
    } catch (err) { toast.error('Failed to load bill'); }
    finally { setLoading(false); }
  };

  const loadExecBills = async () => {
    try {
      const res = await apiClient.get('/bills');
      setExecBills(res.data.filter(b => b.status === 'draft'));
    } catch (err) { console.error(err); }
  };

  const goHome = () => {
    if (user?.role === 'admin') navigate('/admin');
    else if (user?.role === 'manager') navigate('/manager');
    else navigate('/sales');
  };

  const goBack = () => {
    if (window.history.state && window.history.state.idx > 0) {
      navigate(-1);
    } else {
      goHome();
    }
  };

  const isAdmin = user?.role === 'admin';

  // Calculate making_per_gram for percentage type if not present
  const getMakingPerGram = (mc, item) => {
    if (mc.making_per_gram) return mc.making_per_gram;
    if (mc.type === 'percentage' && item.purity_percent && item.rate_per_10g) {
      const rate24kt = item.rate_per_10g / (item.purity_percent / 100);
      return (mc.value / 100) * (rate24kt / 10);
    }
    if (mc.type === 'per_gram') return mc.value;
    if (mc.type === 'per_piece' && item.net_weight > 0 && mc.calculated_amount) {
      return mc.calculated_amount / item.net_weight;
    }
    return null;
  };

  // Only return percentage for actual percentage type charges
  const getMakingPercent = (mc) => {
    if (mc.type === 'percentage') return mc.value;
    return null;
  };

  const handlePhotoUpload = async (index, file) => {
    if (!file) return;
    setUploading(index);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const uploadRes = await apiClient.post('/upload/photo', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      const photoUrl = uploadRes.data.url;
      const newItems = [...bill.items];
      if (!newItems[index].photos) newItems[index].photos = [];
      newItems[index].photos.push(photoUrl);
      const res = await apiClient.put(`/bills/${billId}`, { items: newItems, external_charges: bill.external_charges });
      setBill(res.data);
      toast.success('Photo added');
    } catch (err) { toast.error('Failed to upload photo'); }
    finally { setUploading(null); }
  };

  const removePhoto = async (itemIdx, photoIdx) => {
    try {
      const res = await apiClient.delete(`/bills/${billId}/items/${itemIdx}/photos/${photoIdx}`);
      setBill(res.data);
      toast.success('Photo removed');
    } catch (err) { toast.error('Failed to remove photo'); }
  };

  const canEdit = () => {
    if (!bill) return false;
    if (bill.status === 'draft') return true;
    if (bill.status !== 'draft' && (user?.role === 'admin' || user?.role === 'manager')) return true;
    return false;
  };

  const removeItem = async (index) => {
    if (!canEdit()) return;
    const newItems = [...bill.items];
    newItems.splice(index, 1);
    try {
      setSaving(true);
      const res = await apiClient.put(`/bills/${billId}`, { items: newItems, external_charges: bill.external_charges });
      setBill(res.data);
      toast.success('Item removed');
    } catch (err) { toast.error('Failed to remove item'); }
    finally { setSaving(false); }
  };

  const addExternalCharge = async () => {
    if (!extChargeName.trim() || !extChargeAmount) { toast.error('Enter charge name and amount'); return; }
    const newCharges = [...(bill.external_charges || []), { name: extChargeName, amount: parseFloat(extChargeAmount) }];
    try {
      setSaving(true);
      const res = await apiClient.put(`/bills/${billId}`, { external_charges: newCharges });
      setBill(res.data);
      setExtChargeName(''); setExtChargeAmount(''); setShowExtChargeForm(false);
      toast.success('Charge added');
    } catch (err) { toast.error('Failed to add charge'); }
    finally { setSaving(false); }
  };

  const removeExternalCharge = async (index) => {
    const newCharges = [...(bill.external_charges || [])];
    newCharges.splice(index, 1);
    try {
      setSaving(true);
      const res = await apiClient.put(`/bills/${billId}`, { external_charges: newCharges });
      setBill(res.data);
      toast.success('Charge removed');
    } catch (err) { toast.error('Failed to remove charge'); }
    finally { setSaving(false); }
  };

  const sendToManager = async () => {
    if (!window.confirm('Send this bill to the manager? It will become uneditable for you.')) return;
    try {
      await apiClient.put(`/bills/${billId}/send`);
      toast.success('Bill sent to manager!');
      navigate(`/bill/${billId}/feedback`);
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to send'); }
  };

  const approveBill = async () => {
    if (!window.confirm('Approve this bill?')) return;
    try {
      await apiClient.put(`/bills/${billId}/approve`);
      toast.success('Bill approved!');
      goHome();
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to approve'); }
  };

  const downloadPdf = async () => {
    try {
      const res = await apiClient.get(`/bills/${billId}/pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${bill?.bill_number || 'bill'}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) { toast.error('Failed to generate PDF'); }
  };

  const editItem = (idx) => {
    const item = bill.items[idx];
    if (item.item_type === 'mrp') {
      navigate(`/bill/${billId}/edit-mrp/${idx}`);
    } else {
      navigate(`/bill/${billId}/edit-item/${idx}`);
    }
  };

  const formatCurrency = (val) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(val || 0);

  const getPrimaryAction = () => {
    if (!bill) return null;
    if (bill.status === 'draft' && user?.role === 'executive') return { label: 'Send to Manager', icon: Send, action: sendToManager, variant: 'default' };
    if ((bill.status === 'sent' || bill.status === 'edited') && (user?.role === 'admin' || user?.role === 'manager')) return { label: 'Approve Bill', icon: CheckCircle, action: approveBill, variant: 'approve' };
    return null;
  };

  const primaryAction = getPrimaryAction();
  const otherDraftBills = execBills.filter(b => b.id !== billId);

  if (loading) return <div className="kintsugi-page flex items-center justify-center min-h-screen"><div className="kintsugi-veins" /><p className="relative z-10 heading text-xl text-primary">Loading bill...</p></div>;
  if (!bill) return <div className="kintsugi-page flex items-center justify-center min-h-screen"><div className="kintsugi-veins" /><p className="relative z-10 text-destructive">Bill not found</p></div>;

  return (
    <div className="kintsugi-page">
      <div className="kintsugi-veins" />
      <div className="relative z-10">
        <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50 no-print">
          <div className="flex items-center justify-between px-3 sm:px-4 py-3 max-w-6xl mx-auto">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <Button variant="ghost" size="sm" className="shrink-0" onClick={goBack} data-testid="bill-back-button"><ArrowLeft size={18} /></Button>
              <div className="min-w-0">
                <h1 className="heading text-sm sm:text-lg font-bold text-primary truncate">{bill.bill_number}</h1>
                <p className="text-xs text-muted-foreground truncate">{bill.customer_name} | {bill.customer_phone}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {user?.role === 'executive' && otherDraftBills.length > 0 && (
                <Sheet open={switcherOpen} onOpenChange={setSwitcherOpen}>
                  <SheetTrigger asChild>
                    <Button variant="secondary" size="sm" className="relative" data-testid="bill-switcher">
                      <Layers size={16} className="mr-1" />
                      <span className="hidden sm:inline">Bills</span>
                      <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-primary/20 text-primary font-bold">{execBills.length}</span>
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="right" className="w-[320px] p-0 bg-card border-border">
                    <SheetTitle className="sr-only">Active Bills</SheetTitle>
                    <div className="p-4 border-b border-border">
                      <h2 className="heading text-lg font-bold text-primary">Active Drafts</h2>
                    </div>
                    <div className="p-3 space-y-2 overflow-y-auto max-h-[calc(100vh-120px)]">
                      <div className="p-3 rounded-lg bg-primary/10 border border-primary/30">
                        <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-primary animate-pulse" /><span className="text-xs text-primary font-medium">Current</span></div>
                        <p className="font-medium mt-1 text-sm">{bill.customer_name}</p>
                        <p className="text-xs text-muted-foreground mono">{bill.bill_number}</p>
                        <p className="text-sm mono text-primary font-bold mt-1">{formatCurrency(bill.grand_total)}</p>
                      </div>
                      {otherDraftBills.map(b => (
                        <button key={b.id} onClick={() => { setSwitcherOpen(false); navigate(`/bill/${b.id}`); }} className="w-full p-3 rounded-lg bg-secondary/40 border border-border hover:border-primary/30 transition-colors text-left" data-testid={`bill-switcher-item-${b.id}`}>
                          <div className="flex items-center justify-between">
                            <div className="min-w-0"><p className="font-medium text-sm truncate">{b.customer_name}</p><p className="text-xs text-muted-foreground mono">{b.bill_number}</p></div>
                            <div className="flex items-center gap-2 shrink-0"><span className="text-sm mono font-bold text-primary">{formatCurrency(b.grand_total)}</span><ChevronRight size={14} className="text-muted-foreground" /></div>
                          </div>
                        </button>
                      ))}
                      <Button variant="secondary" className="w-full mt-2 border-dashed border-2" onClick={() => { setSwitcherOpen(false); navigate('/sales'); }} data-testid="bill-switcher-new-bill"><Plus size={16} className="mr-2" /> New Bill</Button>
                    </div>
                  </SheetContent>
                </Sheet>
              )}
              <span className={`px-2 sm:px-3 py-1 rounded-full text-[10px] sm:text-xs font-medium ${
                bill.status === 'draft' ? 'bg-yellow-500/20 text-yellow-400' :
                bill.status === 'sent' ? 'bg-blue-500/20 text-blue-400' :
                bill.status === 'edited' ? 'bg-orange-500/20 text-orange-400' :
                'bg-green-500/20 text-green-400'
              }`} data-testid="bill-status-badge">{bill.status.toUpperCase()}</span>
            </div>
          </div>
        </header>

        <main className="px-3 sm:px-4 py-4 sm:py-6 max-w-6xl mx-auto pb-32 lg:pb-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
            <div className="lg:col-span-2 space-y-4">
              {/* Customer Info */}
              <Card className="bg-card border-border">
                <CardContent className="p-3 sm:p-4">
                  <div className="grid grid-cols-2 gap-2 sm:gap-3 text-sm">
                    <div><span className="text-muted-foreground text-xs">Customer:</span> <span className="font-medium block sm:inline">{bill.customer_name}</span></div>
                    <div><span className="text-muted-foreground text-xs">Phone:</span> <span className="mono block sm:inline">{bill.customer_phone}</span></div>
                    <div><span className="text-muted-foreground text-xs">Location:</span> <span className="block sm:inline">{bill.customer_location || '-'}</span></div>
                    <div><span className="text-muted-foreground text-xs">Reference:</span> <span className="block sm:inline">{bill.customer_reference || '-'}</span></div>
                    {bill.salesperson_name && <div><span className="text-muted-foreground text-xs">Salesperson:</span> <span className="block sm:inline">{bill.salesperson_name}</span></div>}
                    {bill.narration && <div className="col-span-2"><span className="text-muted-foreground text-xs">Narration:</span> <span className="block sm:inline italic text-muted-foreground">{bill.narration}</span></div>}
                  </div>
                  <Button variant="secondary" size="sm" className="mt-2 h-8 text-xs" onClick={() => navigate(`/customer/${bill.customer_phone}`)} data-testid="view-customer-profile">
                    <User size={12} className="mr-1" /> Customer Profile
                  </Button>
                </CardContent>
              </Card>

              {/* Items */}
              <Card className="bg-card border-border shadow-[var(--shadow-elev-1)]">
                <CardHeader className="pb-3 flex flex-row items-center justify-between">
                  <CardTitle className="heading text-lg sm:text-xl">Items ({bill.items?.length || 0})</CardTitle>
                  {canEdit() && (
                    <Button size="sm" onClick={() => navigate(`/bill/${billId}/add-item`)} data-testid="add-item-button"><Plus size={16} className="mr-1" /> Add Item</Button>
                  )}
                </CardHeader>
                <CardContent className="px-3 sm:px-6">
                  {(!bill.items || bill.items.length === 0) ? (
                    <div className="text-center py-8 sm:py-12">
                      <p className="text-muted-foreground mb-4">No items added yet</p>
                      {canEdit() && <Button onClick={() => navigate(`/bill/${billId}/add-item`)} data-testid="add-first-item-button"><Plus size={16} className="mr-2" /> Add First Item</Button>}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {bill.items.map((item, idx) => (
                        <div key={idx} className="p-3 sm:p-4 rounded-lg bg-secondary/30 border border-border" data-testid={`bill-item-${idx}`}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                                {item.tag_number && <span className="mono text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">{item.tag_number}</span>}
                                <span className="font-medium text-sm sm:text-base">{item.item_name}</span>
                                <span className={`px-1.5 sm:px-2 py-0.5 rounded text-[10px] sm:text-xs ${
                                  item.item_type === 'diamond' ? 'bg-blue-500/20 text-blue-400' : item.item_type === 'mrp' ? 'bg-purple-500/20 text-purple-400' : 'bg-primary/20 text-primary'
                                }`}>{item.item_type === 'diamond' ? 'Diamond' : item.item_type === 'mrp' ? 'MRP' : 'Gold'}</span>
                                {item.purity_name && <span className="text-[10px] sm:text-xs text-muted-foreground">{item.purity_name}</span>}
                              </div>
                              {item.item_type === 'mrp' ? (
                                <div className="mt-2 text-xs text-muted-foreground space-y-1">
                                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-2">
                                    <span>Gross: <span className="text-foreground">{item.gross_weight}g</span></span>
                                    <span>Net: <span className="mono text-foreground font-medium">{item.net_weight}g</span></span>
                                    <span>MRP: <span className="mono text-foreground">{formatCurrency(item.mrp)}</span></span>
                                    {item.total_discount > 0 && <span>Disc: <span className="mono text-destructive">-{formatCurrency(item.total_discount)}</span></span>}
                                  </div>
                                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                                    <span>After Disc: <span className="mono text-foreground">{formatCurrency(item.after_discount)}</span></span>
                                    <span>Excl GST: <span className="mono text-primary">{formatCurrency(item.amount_without_gst)}</span></span>
                                    <span>GST: <span className="mono">{formatCurrency(item.gst_amount)}</span></span>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-2 mt-2 text-xs text-muted-foreground">
                                    <span>Gross: <span className="text-foreground">{item.gross_weight}g</span></span>
                                    <span>Less: <span className="text-foreground">{item.less}g</span></span>
                                    <span>Net: <span className="mono text-foreground font-medium">{item.net_weight}g</span>{item.studded_less_grams > 0 && <span className="text-primary ml-1">(-{item.studded_less_grams}g)</span>}</span>
                                    <span>Rate: <span className="mono text-foreground">{formatCurrency(item.rate_per_10g)}/10g</span></span>
                                  </div>
                                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-2 mt-1 text-xs">
                                    <span>Gold: <span className="mono text-primary">{formatCurrency(item.gold_value)}</span></span>
                                    <span>Making: <span className="mono">{formatCurrency(item.total_making)}</span></span>
                                    <span>Stone: <span className="mono">{formatCurrency(item.total_stone)}</span></span>
                                    {item.item_type === 'diamond' && <span>Studded: <span className="mono">{formatCurrency(item.total_studded)}</span></span>}
                                  </div>
                                  {/* Making charge details */}
                                  {item.making_charges?.length > 0 && (
                                    <div className="mt-1.5 text-[10px] text-muted-foreground">
                                      Making: {item.making_charges.map((mc, mi) => {
                                        const mpg = getMakingPerGram(mc, item);
                                        const pct = getMakingPercent(mc);
                                        return (
                                          <span key={mi} className="mr-2">
                                            {mc.type === 'percentage' ? (
                                              isAdmin ? (
                                                <>{pct?.toFixed(1)}% <sub className="text-primary">{mpg ? `₹${Number(mpg).toFixed(0)}/g` : ''}</sub></>
                                              ) : (
                                                <>{mpg ? `₹${Number(mpg).toFixed(0)}/g` : `${mc.value}%`}</>
                                              )
                                            ) : mc.type === 'per_gram' ? (
                                              <>₹{mc.value}/g</>
                                            ) : (
                                              <>₹{mc.value} x{mc.quantity}pc</>
                                            )}
                                          </span>
                                        );
                                      })}
                                    </div>
                                  )}
                                </>
                              )}
                              {/* Photos */}
                              {item.photos && item.photos.length > 0 && (
                                <div className="flex gap-2 mt-2 flex-wrap">
                                  {item.photos.map((p, pi) => (
                                    <div key={pi} className="relative group">
                                      <img
                                        src={`${IMG_BASE}${p}`}
                                        alt=""
                                        className="w-14 h-14 rounded object-cover border border-border cursor-pointer hover:opacity-80"
                                        onClick={() => setLightboxImg(`${IMG_BASE}${p}`)}
                                        onError={(e) => { e.target.style.opacity = '0.4'; }}
                                        data-testid={`photo-thumb-${idx}-${pi}`}
                                      />
                                      {canEdit() && (
                                        <button
                                          onClick={(e) => { e.stopPropagation(); removePhoto(idx, pi); }}
                                          className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-destructive text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                          data-testid={`remove-photo-${idx}-${pi}`}
                                        ><X size={10} /></button>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div className="flex flex-col items-end gap-1 shrink-0">
                              <span className="mono text-base sm:text-lg font-bold text-primary">{formatCurrency(item.total_amount)}</span>
                              {canEdit() && (
                                <div className="flex gap-1">
                                  <label className="h-8 w-8 p-0 flex items-center justify-center cursor-pointer text-muted-foreground hover:text-foreground">
                                    <Camera size={14} />
                                    <input type="file" accept="image/*" capture="environment" className="hidden" onChange={e => handlePhotoUpload(idx, e.target.files?.[0])} data-testid={`photo-upload-${idx}`} />
                                  </label>
                                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => editItem(idx)} data-testid={`edit-item-${idx}`}><Edit size={14} /></Button>
                                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive" onClick={() => removeItem(idx)} data-testid={`remove-item-${idx}`}><Trash2 size={14} /></Button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Summary Sidebar */}
            <div className="space-y-4">
              <Card className="bg-card border-border shadow-[var(--shadow-elev-1)] lg:sticky lg:top-20">
                <CardHeader className="pb-3"><CardTitle className="heading text-lg">Bill Summary</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Items Total</span><span className="mono font-medium">{formatCurrency(bill.items_total)}</span></div>
                  {/* Admin: Show making charge breakdown per item */}
                  {isAdmin && bill.items?.some(item => item.making_charges?.length > 0 && item.item_type !== 'mrp') && (
                    <div className="space-y-1.5 pl-2 border-l-2 border-primary/20">
                      {bill.items.map((item, idx) => {
                        if (item.item_type === 'mrp' || !item.making_charges?.length) return null;
                        return item.making_charges.map((mc, mi) => {
                          const mpg = getMakingPerGram(mc, item);
                          const pct = getMakingPercent(mc);
                          return (
                            <div key={`${idx}-${mi}`} className="text-[11px] text-muted-foreground" data-testid={`summary-making-${idx}-${mi}`}>
                              <span className="truncate">{item.item_name}: </span>
                              {pct != null && <span className="text-primary font-medium">{pct.toFixed(1)}%</span>}
                              {mpg != null && <span className="mono ml-1">₹{Number(mpg).toFixed(0)}/g</span>}
                              {mc.type === 'per_piece' && <span className="mono">₹{mc.value} x{mc.quantity}pc</span>}
                            </div>
                          );
                        });
                      })}
                    </div>
                  )}
                  <Separator className="bg-border" />
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-muted-foreground">External Charges</span>
                      {canEdit() && <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setShowExtChargeForm(!showExtChargeForm)} data-testid="add-external-charge-button"><Plus size={12} className="mr-1" /> Add</Button>}
                    </div>
                    {(bill.external_charges || []).map((ec, idx) => (
                      <div key={idx} className="flex items-center justify-between text-sm py-1">
                        <span className="text-muted-foreground">{ec.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="mono">{formatCurrency(ec.amount)}</span>
                          {canEdit() && <Button variant="ghost" size="sm" className="h-5 w-5 p-0 text-destructive" onClick={() => removeExternalCharge(idx)}><Trash2 size={10} /></Button>}
                        </div>
                      </div>
                    ))}
                    {showExtChargeForm && (
                      <div className="mt-2 space-y-2 p-3 bg-secondary/30 rounded-lg">
                        <Input placeholder="Charge name" value={extChargeName} onChange={e => setExtChargeName(e.target.value)} className="h-9 text-sm bg-secondary/50" data-testid="ext-charge-name" />
                        <Input placeholder="Amount" type="number" value={extChargeAmount} onChange={e => setExtChargeAmount(e.target.value)} className="h-9 text-sm bg-secondary/50 mono" data-testid="ext-charge-amount" />
                        <Button size="sm" className="w-full h-8" onClick={addExternalCharge} data-testid="ext-charge-save">Add Charge</Button>
                      </div>
                    )}
                  </div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Ext. Charges Total</span><span className="mono">{formatCurrency(bill.external_charges_total)}</span></div>
                  <Separator className="bg-border" />
                  <div className="flex justify-between text-sm font-medium"><span>Subtotal (without GST)</span><span className="mono">{formatCurrency(bill.subtotal_without_gst)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">GST (3%)</span><span className="mono">{formatCurrency(bill.gst_amount)}</span></div>
                  <Separator className="bg-primary/30" />
                  <div className="flex justify-between text-lg font-bold"><span className="heading">Grand Total</span><span className="mono text-primary">{formatCurrency(bill.grand_total)}</span></div>
                  <Separator className="bg-border" />

                  <div className="space-y-2 pt-2">
                    <div className="grid grid-cols-2 gap-2">
                      <Button variant="secondary" className="h-10" onClick={() => navigate(`/bill/${billId}/print`)} data-testid="bill-print-button"><Printer size={14} className="mr-1" /> Print</Button>
                      <Button variant="secondary" className="h-10" onClick={downloadPdf} data-testid="bill-pdf-button"><Download size={14} className="mr-1" /> PDF</Button>
                    </div>
                    {bill.status === 'draft' && user?.role === 'executive' && (
                      <Button className="w-full h-11 text-base font-semibold rounded-xl" onClick={sendToManager} data-testid="send-to-manager-button"><Send size={16} className="mr-2" /> Send to Manager</Button>
                    )}
                    {(bill.status === 'sent' || bill.status === 'edited') && (user?.role === 'admin' || user?.role === 'manager') && (
                      <Button className="w-full h-11 text-base font-semibold rounded-xl bg-[hsl(160,52%,46%)] hover:bg-[hsl(160,52%,40%)] text-white" onClick={approveBill} data-testid="approve-bill-button"><CheckCircle size={16} className="mr-2" /> Approve Bill</Button>
                    )}
                  </div>

                  {bill.change_log && bill.change_log.length > 0 && (
                    <>
                      <Separator className="bg-border" />
                      <div>
                        <div className="flex items-center gap-2 mb-2"><History size={14} className="text-muted-foreground" /><span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Change Log</span></div>
                        <div className="space-y-2 max-h-40 overflow-y-auto">
                          {bill.change_log.slice().reverse().map((log, idx) => (
                            <div key={idx} className="text-xs p-2 rounded bg-secondary/30 border border-border">
                              <div className="flex items-center justify-between">
                                <span className="font-medium">{log.user}</span>
                                <span className={`px-1.5 py-0.5 rounded text-[10px] capitalize ${log.action === 'approved' ? 'bg-green-500/20 text-green-400' : 'bg-orange-500/20 text-orange-400'}`}>{log.action}</span>
                              </div>
                              <p className="text-muted-foreground mt-0.5">{log.timestamp?.slice(0, 16).replace('T', ' ')}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                  {bill.last_modified_by && <p className="text-xs text-muted-foreground text-center pt-1">Last modified by: {bill.last_modified_by}</p>}
                </CardContent>
              </Card>
            </div>
          </div>
        </main>

        {/* Mobile Bottom Bar */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-[100] no-print" data-testid="mobile-bottom-bar" style={{paddingBottom: 'env(safe-area-inset-bottom, 0px)'}}>
          <div className="bg-card border-t-2 border-primary/40 px-4 pt-3 pb-4 shadow-[0_-4px_20px_rgba(0,0,0,0.5)]">
            <div className="flex items-center gap-3 max-w-6xl mx-auto">
              <div className="flex-1 min-w-0">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Grand Total</p>
                <p className="mono text-lg font-bold text-primary truncate">{formatCurrency(bill.grand_total)}</p>
              </div>
              {primaryAction ? (
                <Button className={`h-12 px-5 text-sm font-semibold rounded-xl shrink-0 ${primaryAction.variant === 'approve' ? 'bg-[hsl(160,52%,46%)] hover:bg-[hsl(160,52%,40%)] text-white' : ''}`} onClick={primaryAction.action} data-testid="mobile-primary-action">
                  <primaryAction.icon size={18} className="mr-2" />{primaryAction.label}
                </Button>
              ) : (
                <div className="flex gap-2 shrink-0">
                  <Button variant="secondary" size="sm" className="h-11 px-3" onClick={() => navigate(`/bill/${billId}/print`)} data-testid="mobile-print-action"><Printer size={16} /></Button>
                  <Button variant="secondary" size="sm" className="h-11 px-3" onClick={downloadPdf} data-testid="mobile-pdf-action"><Download size={16} /></Button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Photo Lightbox - Simple overlay instead of Dialog to avoid ErrorBoundary crashes */}
        {lightboxImg && (
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 cursor-pointer"
            onClick={() => setLightboxImg(null)}
            data-testid="photo-lightbox"
          >
            <button
              className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-white/20 hover:bg-white/40 flex items-center justify-center text-white transition-colors"
              onClick={(e) => { e.stopPropagation(); setLightboxImg(null); }}
              data-testid="lightbox-close"
            >
              <X size={20} />
            </button>
            <img
              src={lightboxImg}
              alt="Item photo"
              className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
