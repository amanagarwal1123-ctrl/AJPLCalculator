import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth, apiClient } from '@/App';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Plus, Trash2, Send, Printer, Download, ArrowLeft, Edit, CheckCircle, Clock, History } from 'lucide-react';
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

  useEffect(() => { loadBill(); }, [billId]);

  const loadBill = async () => {
    try {
      const res = await apiClient.get(`/bills/${billId}`);
      setBill(res.data);
    } catch (err) {
      toast.error('Failed to load bill');
    } finally {
      setLoading(false);
    }
  };

  const canEdit = () => {
    if (!bill) return false;
    if (bill.status === 'draft' && (user?.role === 'executive' || user?.role === 'admin' || user?.role === 'manager')) return true;
    if (bill.status !== 'draft' && (user?.role === 'admin' || user?.role === 'manager')) return true;
    return false;
  };

  const removeItem = async (index) => {
    if (!canEdit()) return;
    const newItems = [...bill.items];
    newItems.splice(index, 1);
    try {
      setSaving(true);
      const res = await apiClient.put(`/bills/${billId}`, {
        items: newItems,
        external_charges: bill.external_charges,
      });
      setBill(res.data);
      toast.success('Item removed');
    } catch (err) {
      toast.error('Failed to remove item');
    } finally {
      setSaving(false);
    }
  };

  const addExternalCharge = async () => {
    if (!extChargeName.trim() || !extChargeAmount) {
      toast.error('Enter charge name and amount');
      return;
    }
    const newCharges = [...(bill.external_charges || []), { name: extChargeName, amount: parseFloat(extChargeAmount) }];
    try {
      setSaving(true);
      const res = await apiClient.put(`/bills/${billId}`, {
        external_charges: newCharges,
      });
      setBill(res.data);
      setExtChargeName('');
      setExtChargeAmount('');
      setShowExtChargeForm(false);
      toast.success('Charge added');
    } catch (err) {
      toast.error('Failed to add charge');
    } finally {
      setSaving(false);
    }
  };

  const removeExternalCharge = async (index) => {
    const newCharges = [...(bill.external_charges || [])];
    newCharges.splice(index, 1);
    try {
      setSaving(true);
      const res = await apiClient.put(`/bills/${billId}`, { external_charges: newCharges });
      setBill(res.data);
      toast.success('Charge removed');
    } catch (err) {
      toast.error('Failed to remove charge');
    } finally {
      setSaving(false);
    }
  };

  const sendToManager = async () => {
    if (!window.confirm('Send this bill to the manager? It will become uneditable for you.')) return;
    try {
      await apiClient.put(`/bills/${billId}/send`);
      toast.success('Bill sent to manager!');
      loadBill();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to send');
    }
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
    } catch (err) {
      toast.error('Failed to generate PDF');
    }
  };

  const formatCurrency = (val) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(val || 0);

  if (loading) return <div className="kintsugi-page flex items-center justify-center min-h-screen"><div className="kintsugi-veins" /><p className="relative z-10 heading text-xl text-primary">Loading bill...</p></div>;
  if (!bill) return <div className="kintsugi-page flex items-center justify-center min-h-screen"><div className="kintsugi-veins" /><p className="relative z-10 text-destructive">Bill not found</p></div>;

  return (
    <div className="kintsugi-page">
      <div className="kintsugi-veins" />
      <div className="relative z-10">
        {/* Header */}
        <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50 no-print">
          <div className="flex items-center justify-between px-4 py-3 max-w-6xl mx-auto">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={() => navigate(-1)}><ArrowLeft size={18} /></Button>
              <div>
                <h1 className="heading text-lg font-bold text-primary">{bill.bill_number}</h1>
                <p className="text-xs text-muted-foreground">{bill.customer_name} | {bill.customer_phone}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                bill.status === 'draft' ? 'bg-yellow-500/20 text-yellow-400' :
                bill.status === 'sent' ? 'bg-blue-500/20 text-blue-400' :
                bill.status === 'edited' ? 'bg-orange-500/20 text-orange-400' :
                bill.status === 'approved' ? 'bg-green-500/20 text-green-400' :
                'bg-green-500/20 text-green-400'
              }`}>{bill.status.toUpperCase()}</span>
            </div>
          </div>
        </header>

        <main className="px-4 py-6 max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Items List - 2/3 width */}
            <div className="lg:col-span-2 space-y-4">
              {/* Customer Info */}
              <Card className="bg-card border-border">
                <CardContent className="p-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div><span className="text-muted-foreground">Customer:</span> <span className="font-medium">{bill.customer_name}</span></div>
                    <div><span className="text-muted-foreground">Phone:</span> <span className="mono">{bill.customer_phone}</span></div>
                    <div><span className="text-muted-foreground">Location:</span> <span>{bill.customer_location || '-'}</span></div>
                    <div><span className="text-muted-foreground">Reference:</span> <span>{bill.customer_reference || '-'}</span></div>
                  </div>
                </CardContent>
              </Card>

              {/* Items */}
              <Card className="bg-card border-border shadow-[var(--shadow-elev-1)]">
                <CardHeader className="pb-3 flex flex-row items-center justify-between">
                  <CardTitle className="heading text-xl">Items ({bill.items?.length || 0})</CardTitle>
                  {canEdit() && (
                    <Button size="sm" onClick={() => navigate(`/bill/${billId}/add-item`)} data-testid="add-item-button">
                      <Plus size={16} className="mr-1" /> Add Item
                    </Button>
                  )}
                </CardHeader>
                <CardContent>
                  {(!bill.items || bill.items.length === 0) ? (
                    <div className="text-center py-12">
                      <p className="text-muted-foreground mb-4">No items added yet</p>
                      {canEdit() && (
                        <Button onClick={() => navigate(`/bill/${billId}/add-item`)} data-testid="add-first-item-button">
                          <Plus size={16} className="mr-2" /> Add First Item
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {bill.items.map((item, idx) => (
                        <div key={idx} className="p-4 rounded-lg bg-secondary/30 border border-border">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{item.item_name}</span>
                                <span className={`px-2 py-0.5 rounded text-xs ${
                                  item.item_type === 'diamond' ? 'bg-blue-500/20 text-blue-400' : 'bg-primary/20 text-primary'
                                }`}>{item.item_type === 'diamond' ? 'Diamond' : 'Gold'}</span>
                                <span className="text-xs text-muted-foreground">{item.purity_name} | {item.rate_mode}</span>
                              </div>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2 text-xs text-muted-foreground">
                                <span>Gross: {item.gross_weight}g</span>
                                <span>Less: {item.less}g</span>
                                <span>Net: <span className="mono text-foreground">{item.net_weight}g</span></span>
                                <span>Rate: <span className="mono">{formatCurrency(item.rate_per_10g)}/10g</span></span>
                              </div>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-1 text-xs">
                                <span>Gold: <span className="mono text-primary">{formatCurrency(item.gold_value)}</span></span>
                                <span>Making: <span className="mono">{formatCurrency(item.total_making)}</span></span>
                                <span>Stone: <span className="mono">{formatCurrency(item.total_stone)}</span></span>
                                {item.item_type === 'diamond' && <span>Studded: <span className="mono">{formatCurrency(item.total_studded)}</span></span>}
                              </div>
                            </div>
                            <div className="flex items-center gap-1 ml-3">
                              <span className="mono text-lg font-bold text-primary">{formatCurrency(item.total_amount)}</span>
                              {canEdit() && (
                                <div className="flex flex-col gap-1 ml-2">
                                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => navigate(`/bill/${billId}/edit-item/${idx}`)} data-testid={`edit-item-${idx}`}>
                                    <Edit size={12} />
                                  </Button>
                                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => removeItem(idx)} data-testid={`remove-item-${idx}`}>
                                    <Trash2 size={12} />
                                  </Button>
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

            {/* Summary Sidebar - 1/3 width */}
            <div className="space-y-4">
              <Card className="bg-card border-border shadow-[var(--shadow-elev-1)] sticky top-20">
                <CardHeader className="pb-3">
                  <CardTitle className="heading text-lg">Bill Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Items Total</span>
                    <span className="mono font-medium">{formatCurrency(bill.items_total)}</span>
                  </div>

                  {/* External Charges */}
                  <Separator className="bg-border" />
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-muted-foreground">External Charges</span>
                      {canEdit() && (
                        <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setShowExtChargeForm(!showExtChargeForm)} data-testid="add-external-charge-button">
                          <Plus size={12} className="mr-1" /> Add
                        </Button>
                      )}
                    </div>
                    {(bill.external_charges || []).map((ec, idx) => (
                      <div key={idx} className="flex items-center justify-between text-sm py-1">
                        <span className="text-muted-foreground">{ec.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="mono">{formatCurrency(ec.amount)}</span>
                          {canEdit() && (
                            <Button variant="ghost" size="sm" className="h-5 w-5 p-0 text-destructive" onClick={() => removeExternalCharge(idx)}>
                              <Trash2 size={10} />
                            </Button>
                          )}
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

                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Ext. Charges Total</span>
                    <span className="mono">{formatCurrency(bill.external_charges_total)}</span>
                  </div>

                  <Separator className="bg-border" />

                  <div className="flex justify-between text-sm font-medium">
                    <span>Subtotal (without GST)</span>
                    <span className="mono">{formatCurrency(bill.subtotal_without_gst)}</span>
                  </div>

                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">GST (3%)</span>
                    <span className="mono">{formatCurrency(bill.gst_amount)}</span>
                  </div>

                  <Separator className="bg-primary/30" />

                  <div className="flex justify-between text-lg font-bold">
                    <span className="heading">Grand Total</span>
                    <span className="mono text-primary">{formatCurrency(bill.grand_total)}</span>
                  </div>

                  <Separator className="bg-border" />

                  {/* Actions */}
                  <div className="space-y-2 pt-2">
                    <div className="grid grid-cols-2 gap-2">
                      <Button variant="secondary" className="h-10" onClick={() => navigate(`/bill/${billId}/print`)} data-testid="bill-print-button">
                        <Printer size={14} className="mr-1" /> Print
                      </Button>
                      <Button variant="secondary" className="h-10" onClick={downloadPdf} data-testid="bill-pdf-button">
                        <Download size={14} className="mr-1" /> PDF
                      </Button>
                    </div>
                    {bill.status === 'draft' && user?.role === 'executive' && (
                      <Button className="w-full h-11 text-base font-semibold rounded-xl" onClick={sendToManager} data-testid="send-to-manager-button">
                        <Send size={16} className="mr-2" /> Send to Manager
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
