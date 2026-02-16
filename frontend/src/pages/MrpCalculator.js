import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiClient } from '@/App';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Plus, Trash2, Save, Tag } from 'lucide-react';
import { toast } from 'sonner';

export default function MrpCalculator() {
  const { billId } = useParams();
  const navigate = useNavigate();

  const [tagNumber, setTagNumber] = useState('');
  const [itemName, setItemName] = useState('');
  const [grossWeight, setGrossWeight] = useState('');
  const [studdedWeights, setStuddedWeights] = useState([]);
  const [mrp, setMrp] = useState('');
  const [discounts, setDiscounts] = useState([]);
  const [itemNames, setItemNames] = useState([]);
  const [saving, setSaving] = useState(false);
  const [bill, setBill] = useState(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [itemsRes, billRes] = await Promise.all([
        apiClient.get('/item-names'),
        apiClient.get(`/bills/${billId}`),
      ]);
      setItemNames(itemsRes.data);
      setBill(billRes.data);
    } catch (err) { toast.error('Failed to load data'); }
  };

  // Calculations — studded weights entered in carats, convert to grams (1 ct = 0.2g)
  const totalStuddedCarats = studdedWeights.reduce((s, w) => s + (parseFloat(w.weight) || 0), 0);
  const totalStuddedGrams = totalStuddedCarats * 0.2;
  const netWeight = Math.max(0, (parseFloat(grossWeight) || 0) - totalStuddedGrams);
  const mrpNum = parseFloat(mrp) || 0;

  let totalDiscount = 0;
  for (const d of discounts) {
    if (d.type === 'percentage') {
      totalDiscount += mrpNum * (parseFloat(d.value) || 0) / 100;
    } else {
      totalDiscount += parseFloat(d.value) || 0;
    }
  }

  const afterDiscount = Math.max(0, mrpNum - totalDiscount);
  const amountWithoutGst = afterDiscount / 1.03;
  const gstAmount = afterDiscount - amountWithoutGst;

  const addStuddedWeight = (type) => {
    setStuddedWeights([...studdedWeights, { type, weight: '' }]);
  };

  const updateStuddedWeight = (idx, value) => {
    const updated = [...studdedWeights];
    updated[idx] = { ...updated[idx], weight: value };
    setStuddedWeights(updated);
  };

  const removeStuddedWeight = (idx) => {
    setStuddedWeights(studdedWeights.filter((_, i) => i !== idx));
  };

  const addDiscount = (type) => {
    setDiscounts([...discounts, { type, value: '' }]);
  };

  const updateDiscount = (idx, value) => {
    const updated = [...discounts];
    updated[idx] = { ...updated[idx], value };
    setDiscounts(updated);
  };

  const removeDiscount = (idx) => {
    setDiscounts(discounts.filter((_, i) => i !== idx));
  };

  const formatCurrency = (val) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(val || 0);

  const saveItem = async () => {
    if (!itemName) { toast.error('Select an item name'); return; }
    if (!grossWeight) { toast.error('Enter gross weight'); return; }
    if (!mrp) { toast.error('Enter MRP'); return; }

    const itemData = {
      item_type: 'mrp',
      item_name: itemName,
      tag_number: tagNumber,
      gross_weight: parseFloat(grossWeight) || 0,
      studded_weights: studdedWeights.map(sw => ({ type: sw.type, weight: parseFloat(sw.weight) || 0 })),
      mrp: mrpNum,
      discounts: discounts.map(d => ({ type: d.type, value: parseFloat(d.value) || 0 })),
    };

    setSaving(true);
    try {
      // Calculate via backend
      const calcRes = await apiClient.post('/calculate/mrp-item', itemData);
      const calculatedItem = calcRes.data;

      const currentItems = [...(bill?.items || [])];
      currentItems.push(calculatedItem);
      await apiClient.put(`/bills/${billId}`, {
        items: currentItems,
        external_charges: bill?.external_charges || [],
      });
      toast.success('MRP item added!');
      navigate(`/bill/${billId}`);
    } catch (err) {
      toast.error('Failed to save item');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="kintsugi-page">
      <div className="kintsugi-veins" />
      <div className="relative z-10">
        <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
          <div className="flex items-center gap-3 px-4 py-3 max-w-5xl mx-auto">
            <Button variant="ghost" size="sm" onClick={() => navigate(`/bill/${billId}`)} data-testid="mrp-back-btn"><ArrowLeft size={18} /></Button>
            <div>
              <h1 className="heading text-lg font-bold text-primary">MRP Calculator</h1>
              <p className="text-xs text-muted-foreground">Add MRP-based item</p>
            </div>
          </div>
        </header>

        <main className="px-4 py-6 max-w-5xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              {/* Item Details */}
              <Card className="bg-card border-border">
                <CardHeader className="pb-2"><CardTitle className="text-base">Item Details</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Tag Number</Label>
                      <Input value={tagNumber} onChange={e => setTagNumber(e.target.value)} placeholder="Tag #" className="h-11 bg-secondary/50 mono" data-testid="mrp-tag-number" />
                    </div>
                    <div className="space-y-2">
                      <Label>Item Name *</Label>
                      <Select value={itemName} onValueChange={setItemName}>
                        <SelectTrigger className="h-11 bg-secondary/50" data-testid="mrp-item-name"><SelectValue placeholder="Select item" /></SelectTrigger>
                        <SelectContent>
                          {itemNames.map(n => <SelectItem key={n.id} value={n.name}>{n.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Gross Weight (g) *</Label>
                      <Input type="number" step="0.001" value={grossWeight} onChange={e => setGrossWeight(e.target.value)} className="h-11 mono bg-secondary/50" data-testid="mrp-gross-weight" />
                    </div>
                    <div className="space-y-2">
                      <Label>Net Weight (g)</Label>
                      <div className="h-11 px-3 flex items-center rounded-md bg-muted/50 border border-border mono font-bold text-primary" data-testid="mrp-net-weight">{netWeight.toFixed(3)}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Studded Weights */}
              <Card className="bg-card border-[hsl(196,70%,52%)]/30">
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <CardTitle className="text-base text-[hsl(196,70%,52%)]">Studded Weights in Carats (deducted from gross)</CardTitle>
                  <div className="flex gap-1">
                    <Button variant="outline" size="sm" onClick={() => addStuddedWeight('diamond')} className="text-xs h-7" data-testid="mrp-add-diamond">+ Diamond</Button>
                    <Button variant="outline" size="sm" onClick={() => addStuddedWeight('solitaire')} className="text-xs h-7">+ Solitaire</Button>
                    <Button variant="outline" size="sm" onClick={() => addStuddedWeight('colored_stones')} className="text-xs h-7">+ Colored</Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {studdedWeights.length === 0 && <p className="text-sm text-muted-foreground text-center py-3">No studded weights added</p>}
                  {studdedWeights.map((sw, idx) => (
                    <div key={idx} className="flex items-end gap-3 p-3 rounded-lg bg-[hsl(196,70%,52%)]/5 border border-[hsl(196,70%,52%)]/20">
                      <div className="flex-1">
                        <Label className="text-xs text-muted-foreground capitalize">{sw.type.replace('_', ' ')} (carats)</Label>
                        <Input type="number" step="0.001" value={sw.weight} onChange={e => updateStuddedWeight(idx, e.target.value)} className="h-9 mono bg-secondary/50 mt-1" data-testid={`mrp-sw-${idx}`} />
                      </div>
                      <Button variant="ghost" size="sm" className="h-9 w-9 p-0 text-destructive" onClick={() => removeStuddedWeight(idx)}>
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* MRP & Discounts */}
              <Card className="bg-card border-border">
                <CardHeader className="pb-2"><CardTitle className="text-base">MRP & Discounts</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>MRP (Rs.) *</Label>
                    <Input type="number" value={mrp} onChange={e => setMrp(e.target.value)} className="h-11 mono bg-secondary/50 text-lg" data-testid="mrp-price" />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-sm text-muted-foreground">Discounts</Label>
                    <div className="flex gap-1">
                      <Button variant="outline" size="sm" onClick={() => addDiscount('percentage')} className="text-xs h-7" data-testid="mrp-add-pct-discount">+ % Off</Button>
                      <Button variant="outline" size="sm" onClick={() => addDiscount('flat')} className="text-xs h-7" data-testid="mrp-add-flat-discount">+ Flat Off</Button>
                    </div>
                  </div>
                  {discounts.map((d, idx) => (
                    <div key={idx} className="flex items-end gap-3 p-3 rounded-lg bg-secondary/20 border border-border">
                      <div className="flex-1">
                        <Label className="text-xs text-muted-foreground">{d.type === 'percentage' ? 'Discount (%)' : 'Flat Discount (Rs.)'}</Label>
                        <Input type="number" value={d.value} onChange={e => updateDiscount(idx, e.target.value)} className="h-9 mono bg-secondary/50 mt-1" data-testid={`mrp-discount-${idx}`} />
                      </div>
                      {d.type === 'percentage' && mrpNum > 0 && (
                        <span className="text-xs mono text-muted-foreground pb-2">= {formatCurrency(mrpNum * (parseFloat(d.value) || 0) / 100)}</span>
                      )}
                      <Button variant="ghost" size="sm" className="h-9 w-9 p-0 text-destructive" onClick={() => removeDiscount(idx)}>
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            {/* Summary */}
            <div>
              <Card className="bg-card border-border shadow-[var(--shadow-elev-1)] sticky top-20">
                <CardHeader className="pb-2"><CardTitle className="heading text-lg">MRP Summary</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-sm space-y-2">
                    <div className="flex justify-between"><span className="text-muted-foreground">Item</span><span className="font-medium">{itemName || '-'}</span></div>
                    {tagNumber && <div className="flex justify-between"><span className="text-muted-foreground">Tag #</span><span className="mono">{tagNumber}</span></div>}
                    <div className="flex justify-between"><span className="text-muted-foreground">Gross Wt</span><span className="mono">{(parseFloat(grossWeight) || 0).toFixed(3)}g</span></div>
                    {totalStuddedCarats > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Studded</span><span className="mono text-[hsl(196,70%,52%)]">{totalStuddedCarats.toFixed(2)} ct ({totalStuddedGrams.toFixed(3)}g)</span></div>}
                    <div className="flex justify-between"><span className="text-muted-foreground">Net Wt</span><span className="mono font-bold">{netWeight.toFixed(3)}g</span></div>
                  </div>
                  <Separator className="bg-border" />
                  <div className="text-sm space-y-2">
                    <div className="flex justify-between"><span className="text-muted-foreground">MRP</span><span className="mono">{formatCurrency(mrpNum)}</span></div>
                    {totalDiscount > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Total Discount</span><span className="mono text-destructive">-{formatCurrency(totalDiscount)}</span></div>}
                    <div className="flex justify-between"><span className="text-muted-foreground">After Discount</span><span className="mono">{formatCurrency(afterDiscount)}</span></div>
                  </div>
                  <Separator className="bg-border" />
                  <div className="text-sm space-y-2">
                    <div className="flex justify-between font-medium"><span>Amount (excl. GST)</span><span className="mono text-primary">{formatCurrency(amountWithoutGst)}</span></div>
                    <div className="flex justify-between text-xs"><span className="text-muted-foreground">GST (3%)</span><span className="mono">{formatCurrency(gstAmount)}</span></div>
                    <div className="flex justify-between text-xs"><span className="text-muted-foreground">Amount (incl. GST)</span><span className="mono">{formatCurrency(afterDiscount)}</span></div>
                  </div>
                  <Separator className="bg-primary/30" />
                  <div className="flex justify-between text-lg font-bold">
                    <span className="heading">Item Total</span>
                    <span className="mono text-primary">{formatCurrency(amountWithoutGst)}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground text-center">*Amount without GST shown in items. 3% GST added at bill total.</p>
                  <Button className="w-full h-11 mt-4 text-base font-semibold rounded-xl" onClick={saveItem} disabled={saving} data-testid="save-mrp-item-btn">
                    <Save size={16} className="mr-2" /> {saving ? 'Saving...' : 'Save MRP Item'}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
