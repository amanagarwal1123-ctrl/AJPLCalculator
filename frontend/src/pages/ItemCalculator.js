import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiClient } from '@/App';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Plus, Trash2, Save, Gem, CircleDot } from 'lucide-react';
import { toast } from 'sonner';

export default function ItemCalculator() {
  const { billId, itemIndex } = useParams();
  const navigate = useNavigate();
  const isEditing = itemIndex !== undefined;

  // Step: 'type' -> 'rate_mode' -> 'purity' -> 'calculate'
  const [step, setStep] = useState('type');
  const [itemType, setItemType] = useState(''); // gold or diamond
  const [rateMode, setRateMode] = useState(''); // normal, ajpl, manual
  const [selectedPurity, setSelectedPurity] = useState(null);
  const [diamondSubChoice, setDiamondSubChoice] = useState(''); // 'make_bill' or 'mrp'

  // Calculation fields
  const [itemName, setItemName] = useState('');
  const [tagNumber, setTagNumber] = useState('');
  const [rate, setRate] = useState('');
  const [grossWeight, setGrossWeight] = useState('');
  const [less, setLess] = useState('');
  const [makingCharges, setMakingCharges] = useState([]);
  const [stoneCharges, setStoneCharges] = useState([]);
  const [studdedCharges, setStuddedCharges] = useState([]);

  // Data
  const [purities, setPurities] = useState([]);
  const [rates, setRates] = useState([]);
  const [itemNames, setItemNames] = useState([]);
  const [bill, setBill] = useState(null);
  const [calculated, setCalculated] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [puritiesRes, ratesRes, itemNamesRes, billRes] = await Promise.all([
        apiClient.get('/purities'),
        apiClient.get('/rates'),
        apiClient.get('/item-names'),
        apiClient.get(`/bills/${billId}`),
      ]);
      setPurities(puritiesRes.data);
      setRates(ratesRes.data);
      setItemNames(itemNamesRes.data);
      setBill(billRes.data);

      // If editing, pre-fill
      if (isEditing && billRes.data.items?.[parseInt(itemIndex)]) {
        const item = billRes.data.items[parseInt(itemIndex)];
        setItemType(item.item_type || 'gold');
        setRateMode(item.rate_mode || 'normal');
        setSelectedPurity({ name: item.purity_name, percent: item.purity_percent });
        setItemName(item.item_name || '');
        setRate(String(item.rate_per_10g || ''));
        setGrossWeight(String(item.gross_weight || ''));
        setLess(String(item.less || ''));
        setMakingCharges(item.making_charges || []);
        setStoneCharges(item.stone_charges || []);
        setStuddedCharges(item.studded_charges || []);
        setStep('calculate');
      }
    } catch (err) {
      toast.error('Failed to load data');
    }
  };

  const getRateForPurity = (purityName, mode) => {
    const rateCard = rates.find(r => r.rate_type === mode);
    if (!rateCard) return 0;
    const purityRate = rateCard.purities?.find(p => p.purity_name === purityName);
    return purityRate?.rate_per_10g || 0;
  };

  const selectType = (type) => {
    setItemType(type);
    if (type === 'diamond') {
      setStep('diamond_choice');
    } else {
      setStep('rate_mode');
    }
  };

  const selectDiamondChoice = (choice) => {
    setDiamondSubChoice(choice);
    if (choice === 'mrp') {
      navigate(`/bill/${billId}/mrp`);
      return;
    }
    setStep('rate_mode');
  };

  const selectRateMode = (mode) => {
    setRateMode(mode);
    setStep('purity');
  };

  const selectPurity = (purity) => {
    setSelectedPurity(purity);
    if (rateMode !== 'manual') {
      const r = getRateForPurity(purity.name, rateMode);
      setRate(String(r));
    }
    setStep('calculate');
  };

  // Real-time calculation
  // Calculate studded less weight (L-type entries: 1 carat = 0.2 grams)
  const studdedLessGrams = itemType === 'diamond'
    ? studdedCharges.reduce((sum, sc) => {
        if (sc.less_type === 'L') {
          return sum + (parseFloat(sc.carats) || 0) * 0.2;
        }
        return sum;
      }, 0)
    : 0;
  
  const baseNetWeight = Math.max(0, (parseFloat(grossWeight) || 0) - (parseFloat(less) || 0));
  const netWeight = Math.max(0, baseNetWeight - studdedLessGrams);
  const rateNum = parseFloat(rate) || 0;
  const purityPercent = selectedPurity?.percent || 100;

  const goldValue = netWeight * rateNum / 10;

  // Calculate making charges total
  const calcMakingTotal = () => {
    let total = 0;
    for (const mc of makingCharges) {
      const val = parseFloat(mc.value) || 0;
      if (mc.type === 'percentage') {
        const rate24kt = rateNum / (purityPercent / 100);
        const perGram = (val / 100) * (rate24kt / 10);
        total += perGram * netWeight;
      } else if (mc.type === 'per_gram') {
        total += val * netWeight;
      } else if (mc.type === 'per_piece') {
        total += val * (parseFloat(mc.quantity) || 1);
      }
    }
    return total;
  };

  // Calculate stone charges total
  const calcStoneTotal = () => {
    let total = 0;
    for (const sc of stoneCharges) {
      const val = parseFloat(sc.value) || 0;
      if (sc.type === 'kundan') {
        total += val * (parseFloat(sc.quantity) || 1);
      } else if (sc.type === 'stone') {
        total += val * (parseFloat(less) || 0);
      } else if (sc.type === 'moti') {
        total += val;
      }
    }
    return total;
  };

  // Calculate studded charges total
  const calcStuddedTotal = () => {
    let total = 0;
    for (const sc of studdedCharges) {
      total += (parseFloat(sc.carats) || 0) * (parseFloat(sc.rate_per_carat) || 0);
    }
    return total;
  };

  const makingTotal = calcMakingTotal();
  const stoneTotal = calcStoneTotal();
  const studdedTotal = itemType === 'diamond' ? calcStuddedTotal() : 0;
  const itemTotal = goldValue + makingTotal + stoneTotal + studdedTotal;

  // Making charge helpers
  const addMakingCharge = (type) => {
    setMakingCharges([...makingCharges, { type, value: '', quantity: '1' }]);
  };

  const updateMakingCharge = (idx, field, value) => {
    const updated = [...makingCharges];
    updated[idx] = { ...updated[idx], [field]: value };
    setMakingCharges(updated);
  };

  const removeMakingCharge = (idx) => {
    setMakingCharges(makingCharges.filter((_, i) => i !== idx));
  };

  // Stone charge helpers
  const addStoneCharge = (type) => {
    setStoneCharges([...stoneCharges, { type, value: '', quantity: '1' }]);
  };

  const updateStoneCharge = (idx, field, value) => {
    const updated = [...stoneCharges];
    updated[idx] = { ...updated[idx], [field]: value };
    setStoneCharges(updated);
  };

  const removeStoneCharge = (idx) => {
    setStoneCharges(stoneCharges.filter((_, i) => i !== idx));
  };

  // Studded charge helpers
  const addStuddedCharge = (type) => {
    setStuddedCharges([...studdedCharges, { type, carats: '', rate_per_carat: '', less_type: 'NL' }]);
  };

  const updateStuddedCharge = (idx, field, value) => {
    const updated = [...studdedCharges];
    updated[idx] = { ...updated[idx], [field]: value };
    setStuddedCharges(updated);
  };

  const removeStuddedCharge = (idx) => {
    setStuddedCharges(studdedCharges.filter((_, i) => i !== idx));
  };

  // Get making per gram for percentage type
  const getMakingPerGram = (mc) => {
    const val = parseFloat(mc.value) || 0;
    if (mc.type === 'percentage') {
      const rate24kt = rateNum / (purityPercent / 100);
      return (val / 100) * (rate24kt / 10);
    }
    return 0;
  };

  const saveItem = async () => {
    if (!itemName) { toast.error('Please select an item name'); return; }
    if (!grossWeight) { toast.error('Please enter gross weight'); return; }
    if (makingCharges.length === 0) { toast.error('Please add at least one making charge'); return; }
    if (rateMode === 'manual' && !rate) { toast.error('Please enter gold rate'); return; }

    const itemData = {
      item_type: itemType,
      item_name: itemName,
      tag_number: tagNumber,
      rate_mode: rateMode,
      purity_name: selectedPurity?.name,
      purity_percent: selectedPurity?.percent,
      rate_per_10g: parseFloat(rate) || 0,
      gross_weight: parseFloat(grossWeight) || 0,
      less: parseFloat(less) || 0,
      making_charges: makingCharges.map(mc => ({
        type: mc.type,
        value: parseFloat(mc.value) || 0,
        quantity: parseFloat(mc.quantity) || 1,
      })),
      stone_charges: stoneCharges.map(sc => ({
        type: sc.type,
        value: parseFloat(sc.value) || 0,
        quantity: parseFloat(sc.quantity) || 1,
      })),
      studded_charges: itemType === 'diamond' ? studdedCharges.map(sc => ({
        type: sc.type,
        carats: parseFloat(sc.carats) || 0,
        rate_per_carat: parseFloat(sc.rate_per_carat) || 0,
        less_type: sc.less_type || 'NL',
      })) : [],
    };

    setSaving(true);
    try {
      const currentItems = [...(bill?.items || [])];
      if (isEditing) {
        currentItems[parseInt(itemIndex)] = itemData;
      } else {
        currentItems.push(itemData);
      }
      await apiClient.put(`/bills/${billId}`, {
        items: currentItems,
        external_charges: bill?.external_charges || [],
      });
      toast.success(isEditing ? 'Item updated!' : 'Item added!');
      navigate(`/bill/${billId}`);
    } catch (err) {
      toast.error('Failed to save item');
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (val) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(val || 0);

  return (
    <div className="kintsugi-page">
      <div className="kintsugi-veins" />
      <div className="relative z-10">
        <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
          <div className="flex items-center gap-3 px-4 py-3 max-w-5xl mx-auto">
            <Button variant="ghost" size="sm" onClick={() => {
              if (step === 'type') navigate(`/bill/${billId}`);
              else if (step === 'diamond_choice') setStep('type');
              else if (step === 'calculate') setStep('purity');
              else if (step === 'purity') setStep('rate_mode');
              else if (step === 'rate_mode') setStep(itemType === 'diamond' ? 'diamond_choice' : 'type');
              else setStep('type');
            }} data-testid="back-button">
              <ArrowLeft size={18} />
            </Button>
            <div>
              <h1 className="heading text-lg font-bold text-primary">{isEditing ? 'Edit Item' : 'Add Item'}</h1>
              <p className="text-xs text-muted-foreground">
                {step === 'type' && 'Select item type'}
                {step === 'diamond_choice' && 'Diamond - Choose mode'}
                {step === 'rate_mode' && `${itemType === 'diamond' ? 'Diamond' : 'Gold'} - Select rate mode`}
                {step === 'purity' && `${rateMode} rates - Select purity`}
                {step === 'calculate' && `${selectedPurity?.name} ${rateMode} - Calculate`}
              </p>
            </div>
          </div>
        </header>

        <main className="px-4 py-6 max-w-5xl mx-auto">
          {/* Step 1: Type Selection */}
          {step === 'type' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
              <button
                onClick={() => selectType('gold')}
                className="group p-8 rounded-2xl bg-card border-2 border-border hover:border-primary/50 transition-colors duration-200 text-center"
                data-testid="select-gold-button"
              >
                <div className="w-20 h-20 mx-auto rounded-full bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20">
                  <CircleDot className="w-10 h-10 text-primary" />
                </div>
                <h2 className="heading text-2xl font-bold">Gold</h2>
                <p className="text-sm text-muted-foreground mt-2">Gold jewellery items with making & stone charges</p>
              </button>
              <button
                onClick={() => selectType('diamond')}
                className="group p-8 rounded-2xl bg-card border-2 border-border hover:border-[hsl(196,70%,52%)]/50 transition-colors duration-200 text-center"
                data-testid="select-diamond-button"
              >
                <div className="w-20 h-20 mx-auto rounded-full bg-[hsl(196,70%,52%)]/10 flex items-center justify-center mb-4 group-hover:bg-[hsl(196,70%,52%)]/20">
                  <Gem className="w-10 h-10 text-[hsl(196,70%,52%)]" />
                </div>
                <h2 className="heading text-2xl font-bold">Diamond</h2>
                <p className="text-sm text-muted-foreground mt-2">Diamond studded items with gold + diamond charges</p>
              </button>
            </div>
          )}

          {/* Step 1.5: Diamond Sub-Choice (Make Bill vs MRP) */}
          {step === 'diamond_choice' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
              <button
                onClick={() => selectDiamondChoice('make_bill')}
                className="group p-8 rounded-2xl bg-card border-2 border-border hover:border-[hsl(196,70%,52%)]/50 transition-colors duration-200 text-center"
                data-testid="diamond-make-bill"
              >
                <div className="w-20 h-20 mx-auto rounded-full bg-[hsl(196,70%,52%)]/10 flex items-center justify-center mb-4 group-hover:bg-[hsl(196,70%,52%)]/20">
                  <Gem className="w-10 h-10 text-[hsl(196,70%,52%)]" />
                </div>
                <h2 className="heading text-2xl font-bold">Make Bill</h2>
                <p className="text-sm text-muted-foreground mt-2">Full calculation with gold value, making charges & diamond rates</p>
              </button>
              <button
                onClick={() => selectDiamondChoice('mrp')}
                className="group p-8 rounded-2xl bg-card border-2 border-border hover:border-primary/50 transition-colors duration-200 text-center"
                data-testid="diamond-mrp"
              >
                <div className="w-20 h-20 mx-auto rounded-full bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20">
                  <CircleDot className="w-10 h-10 text-primary" />
                </div>
                <h2 className="heading text-2xl font-bold">MRP</h2>
                <p className="text-sm text-muted-foreground mt-2">Tag-based MRP with discount calculation & GST breakdown</p>
              </button>
            </div>
          )}

          {/* Step 2: Rate Mode */}
          {step === 'rate_mode' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto">
              {['normal', 'ajpl', 'manual'].map(mode => (
                <button
                  key={mode}
                  onClick={() => selectRateMode(mode)}
                  className="group p-6 rounded-xl bg-card border-2 border-border hover:border-primary/50 transition-colors duration-200 text-center"
                  data-testid={`select-rate-${mode}`}
                >
                  <h3 className="heading text-xl font-bold capitalize">{mode === 'ajpl' ? 'AJPL' : mode} Rates</h3>
                  <p className="text-xs text-muted-foreground mt-2">
                    {mode === 'normal' && 'Standard market rates set by admin'}
                    {mode === 'ajpl' && 'AJPL special rates set by admin'}
                    {mode === 'manual' && 'Enter custom rates manually'}
                  </p>
                </button>
              ))}
            </div>
          )}

          {/* Step 3: Purity Selection */}
          {step === 'purity' && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 max-w-4xl mx-auto">
              {purities.map(p => {
                const pRate = rateMode !== 'manual' ? getRateForPurity(p.name, rateMode) : null;
                return (
                  <button
                    key={p.id}
                    onClick={() => selectPurity(p)}
                    className="group p-5 rounded-xl bg-card border-2 border-border hover:border-primary/50 transition-colors duration-200 text-center"
                    data-testid={`select-purity-${p.name}`}
                  >
                    <h3 className="heading text-2xl font-bold text-primary">{p.name}</h3>
                    <p className="text-xs text-muted-foreground mt-1">{p.percent}% purity</p>
                    {pRate !== null && <p className="mono text-sm mt-2 text-foreground">{formatCurrency(pRate)}/10g</p>}
                  </button>
                );
              })}
            </div>
          )}

          {/* Step 4: Calculation Form */}
          {step === 'calculate' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Form - 2/3 */}
              <div className="lg:col-span-2 space-y-4">
                {/* Item Name & Rate */}
                <Card className="bg-card border-border">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Item Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Tag Number</Label>
                        <Input value={tagNumber} onChange={e => setTagNumber(e.target.value)} placeholder="Tag #" className="h-11 bg-secondary/50 mono" data-testid="tag-number-input" />
                      </div>
                      <div className="space-y-2">
                        <Label>Item Name *</Label>
                        <Select value={itemName} onValueChange={setItemName}>
                          <SelectTrigger className="h-11 bg-secondary/50" data-testid="item-name-select">
                            <SelectValue placeholder="Select item" />
                          </SelectTrigger>
                          <SelectContent>
                            {itemNames.map(n => <SelectItem key={n.id} value={n.name}>{n.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Rate per 10g ({selectedPurity?.name})</Label>
                        <Input
                          type="number"
                          value={rate}
                          onChange={e => setRate(e.target.value)}
                          readOnly={rateMode !== 'manual'}
                          className={`h-11 mono ${rateMode !== 'manual' ? 'bg-muted/50 cursor-not-allowed' : 'bg-secondary/50'}`}
                          data-testid="rate-input"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Weight */}
                <Card className="bg-card border-border">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Weight Details</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Gross Weight (g)</Label>
                        <Input type="number" step="0.001" value={grossWeight} onChange={e => setGrossWeight(e.target.value)} className="h-11 mono bg-secondary/50" data-testid="gross-weight-input" />
                      </div>
                      <div className="space-y-2">
                        <Label>Less (g)</Label>
                        <Input type="number" step="0.001" value={less} onChange={e => setLess(e.target.value)} className="h-11 mono bg-secondary/50" data-testid="less-input" />
                      </div>
                      <div className="space-y-2">
                        <Label>Net Weight (g)</Label>
                        <div className="h-11 px-3 flex items-center rounded-md bg-muted/50 border border-border mono font-bold text-primary" data-testid="net-weight-display">
                          {netWeight.toFixed(3)}
                        </div>
                        {studdedLessGrams > 0 && (
                          <p className="text-xs text-primary mt-0.5" data-testid="studded-less-note">
                            Incl. diamond less: -{studdedLessGrams.toFixed(3)}g
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Making Charges */}
                <Card className="bg-card border-border">
                  <CardHeader className="pb-2 flex flex-row items-center justify-between">
                    <CardTitle className="text-base">Making Charges</CardTitle>
                    <div className="flex gap-1">
                      <Button variant="outline" size="sm" onClick={() => addMakingCharge('percentage')} className="text-xs h-7" data-testid="add-making-percentage">+ % Rate</Button>
                      <Button variant="outline" size="sm" onClick={() => addMakingCharge('per_gram')} className="text-xs h-7" data-testid="add-making-pergram">+ Per Gram</Button>
                      <Button variant="outline" size="sm" onClick={() => addMakingCharge('per_piece')} className="text-xs h-7" data-testid="add-making-perpiece">+ Per Piece</Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {makingCharges.length === 0 && <p className="text-sm text-muted-foreground text-center py-3">No making charges added</p>}
                    {makingCharges.map((mc, idx) => (
                      <div key={idx} className="flex items-end gap-3 p-3 rounded-lg bg-secondary/20 border border-border">
                        <div className="flex-1">
                          <Label className="text-xs text-muted-foreground capitalize">{mc.type === 'percentage' ? '% of 24KT Rate' : mc.type === 'per_gram' ? 'Per Gram (Rs.)' : 'Per Piece (Rs.)'}</Label>
                          <Input type="number" step="0.01" value={mc.value} onChange={e => updateMakingCharge(idx, 'value', e.target.value)} className="h-9 mono bg-secondary/50 mt-1" data-testid={`making-value-${idx}`} />
                        </div>
                        {mc.type === 'per_piece' && (
                          <div className="w-24">
                            <Label className="text-xs text-muted-foreground">Qty</Label>
                            <Input type="number" value={mc.quantity} onChange={e => updateMakingCharge(idx, 'quantity', e.target.value)} className="h-9 mono bg-secondary/50 mt-1" data-testid={`making-qty-${idx}`} />
                          </div>
                        )}
                        {mc.type === 'percentage' && (
                          <div className="text-xs text-muted-foreground">
                            <span className="mono">{formatCurrency(getMakingPerGram(mc))}/g</span>
                          </div>
                        )}
                        <Button variant="ghost" size="sm" className="h-9 w-9 p-0 text-destructive" onClick={() => removeMakingCharge(idx)}>
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                {/* Stone Charges */}
                <Card className="bg-card border-border">
                  <CardHeader className="pb-2 flex flex-row items-center justify-between">
                    <CardTitle className="text-base">Stone Charges</CardTitle>
                    <div className="flex gap-1">
                      <Button variant="outline" size="sm" onClick={() => addStoneCharge('kundan')} className="text-xs h-7" data-testid="add-stone-kundan">+ Kundan</Button>
                      <Button variant="outline" size="sm" onClick={() => addStoneCharge('stone')} className="text-xs h-7" data-testid="add-stone-stone">+ Stone</Button>
                      <Button variant="outline" size="sm" onClick={() => addStoneCharge('moti')} className="text-xs h-7" data-testid="add-stone-moti">+ Moti</Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {stoneCharges.length === 0 && <p className="text-sm text-muted-foreground text-center py-3">No stone charges added</p>}
                    {stoneCharges.map((sc, idx) => (
                      <div key={idx} className="flex items-end gap-3 p-3 rounded-lg bg-secondary/20 border border-border">
                        <div className="flex-1">
                          <Label className="text-xs text-muted-foreground capitalize">
                            {sc.type === 'kundan' ? 'Kundan - Per Piece (Rs.)' : sc.type === 'stone' ? 'Stone - Per Gram (Rs.)' : 'Moti - Total (Rs.)'}
                          </Label>
                          <Input type="number" step="0.01" value={sc.value} onChange={e => updateStoneCharge(idx, 'value', e.target.value)} className="h-9 mono bg-secondary/50 mt-1" data-testid={`stone-value-${idx}`} />
                        </div>
                        {sc.type === 'kundan' && (
                          <div className="w-24">
                            <Label className="text-xs text-muted-foreground">Pieces</Label>
                            <Input type="number" value={sc.quantity} onChange={e => updateStoneCharge(idx, 'quantity', e.target.value)} className="h-9 mono bg-secondary/50 mt-1" data-testid={`stone-qty-${idx}`} />
                          </div>
                        )}
                        <Button variant="ghost" size="sm" className="h-9 w-9 p-0 text-destructive" onClick={() => removeStoneCharge(idx)}>
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                {/* Studded Charges (Diamond only) */}
                {itemType === 'diamond' && (
                  <Card className="bg-card border-[hsl(196,70%,52%)]/30">
                    <CardHeader className="pb-2 flex flex-row items-center justify-between">
                      <CardTitle className="text-base text-[hsl(196,70%,52%)]">Studded (Diamond) Charges</CardTitle>
                      <div className="flex gap-1">
                        <Button variant="outline" size="sm" onClick={() => addStuddedCharge('diamond')} className="text-xs h-7" data-testid="add-studded-diamond">+ Diamond</Button>
                        <Button variant="outline" size="sm" onClick={() => addStuddedCharge('solitaire')} className="text-xs h-7" data-testid="add-studded-solitaire">+ Solitaire</Button>
                        <Button variant="outline" size="sm" onClick={() => addStuddedCharge('colored_stones')} className="text-xs h-7" data-testid="add-studded-colored">+ Colored</Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {studdedCharges.length === 0 && <p className="text-sm text-muted-foreground text-center py-3">No studded charges added</p>}
                      {studdedCharges.map((sc, idx) => (
                        <div key={idx} className="p-3 rounded-lg bg-[hsl(196,70%,52%)]/5 border border-[hsl(196,70%,52%)]/20">
                          <div className="flex items-end gap-3">
                            <div className="flex-1">
                              <Label className="text-xs text-muted-foreground capitalize">{sc.type.replace('_', ' ')} - Carats</Label>
                              <Input type="number" step="0.01" value={sc.carats} onChange={e => updateStuddedCharge(idx, 'carats', e.target.value)} className="h-9 mono bg-secondary/50 mt-1" data-testid={`studded-carats-${idx}`} />
                            </div>
                            <div className="flex-1">
                              <Label className="text-xs text-muted-foreground">Rate per Carat (Rs.)</Label>
                              <Input type="number" step="0.01" value={sc.rate_per_carat} onChange={e => updateStuddedCharge(idx, 'rate_per_carat', e.target.value)} className="h-9 mono bg-secondary/50 mt-1" data-testid={`studded-rate-${idx}`} />
                            </div>
                            <div className="text-sm mono font-medium text-[hsl(196,70%,52%)]">
                              {formatCurrency((parseFloat(sc.carats) || 0) * (parseFloat(sc.rate_per_carat) || 0))}
                            </div>
                            <Button variant="ghost" size="sm" className="h-9 w-9 p-0 text-destructive" onClick={() => removeStuddedCharge(idx)}>
                              <Trash2 size={14} />
                            </Button>
                          </div>
                          {/* L / NL Radio Buttons */}
                          <div className="flex items-center gap-4 mt-2 pt-2 border-t border-[hsl(196,70%,52%)]/10">
                            <span className="text-xs text-muted-foreground">Weight deduction:</span>
                            <label className="flex items-center gap-1.5 cursor-pointer" data-testid={`studded-nl-${idx}`}>
                              <input
                                type="radio"
                                name={`studded-less-${idx}`}
                                checked={sc.less_type !== 'L'}
                                onChange={() => updateStuddedCharge(idx, 'less_type', 'NL')}
                                className="w-4 h-4 accent-[hsl(196,70%,52%)]"
                              />
                              <span className="text-xs font-semibold">NL</span>
                              <span className="text-xs text-muted-foreground">(Not Less)</span>
                            </label>
                            <label className="flex items-center gap-1.5 cursor-pointer" data-testid={`studded-l-${idx}`}>
                              <input
                                type="radio"
                                name={`studded-less-${idx}`}
                                checked={sc.less_type === 'L'}
                                onChange={() => updateStuddedCharge(idx, 'less_type', 'L')}
                                className="w-4 h-4 accent-primary"
                              />
                              <span className="text-xs font-semibold text-primary">L</span>
                              <span className="text-xs text-muted-foreground">(Less)</span>
                            </label>
                            {sc.less_type === 'L' && (parseFloat(sc.carats) || 0) > 0 && (
                              <span className="text-xs mono text-primary font-medium ml-auto">
                                -{((parseFloat(sc.carats) || 0) * 0.2).toFixed(3)}g from net wt
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                      {studdedLessGrams > 0 && (
                        <div className="flex items-center justify-between p-2 rounded bg-primary/10 border border-primary/20 text-xs">
                          <span className="text-muted-foreground">Total studded deduction (L entries):</span>
                          <span className="mono font-bold text-primary">-{studdedLessGrams.toFixed(3)}g</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Summary Sidebar */}
              <div>
                <Card className="bg-card border-border shadow-[var(--shadow-elev-1)] sticky top-20">
                  <CardHeader className="pb-2">
                    <CardTitle className="heading text-lg">Item Summary</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="text-sm space-y-2">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Item</span>
                        <span className="font-medium">{itemName || '-'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Purity</span>
                        <span>{selectedPurity?.name} ({selectedPurity?.percent}%)</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Rate/10g</span>
                        <span className="mono">{formatCurrency(rateNum)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Net Weight</span>
                        <span className="mono">{netWeight.toFixed(3)}g</span>
                      </div>
                      {studdedLessGrams > 0 && (
                        <div className="flex justify-between text-xs">
                          <span className="text-primary">Diamond Less</span>
                          <span className="mono text-primary">-{studdedLessGrams.toFixed(3)}g</span>
                        </div>
                      )}
                    </div>

                    <Separator className="bg-border" />

                    <div className="text-sm space-y-2">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Gold Value</span>
                        <span className="mono text-primary">{formatCurrency(goldValue)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Making</span>
                        <span className="mono">{formatCurrency(makingTotal)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Stone</span>
                        <span className="mono">{formatCurrency(stoneTotal)}</span>
                      </div>
                      {itemType === 'diamond' && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Studded</span>
                          <span className="mono text-[hsl(196,70%,52%)]">{formatCurrency(studdedTotal)}</span>
                        </div>
                      )}
                    </div>

                    <Separator className="bg-primary/30" />

                    <div className="flex justify-between text-lg font-bold">
                      <span className="heading">Total</span>
                      <span className="mono text-primary">{formatCurrency(itemTotal)}</span>
                    </div>

                    <Button
                      className="w-full h-11 mt-4 text-base font-semibold rounded-xl"
                      onClick={saveItem}
                      disabled={saving}
                      data-testid="save-item-button"
                    >
                      <Save size={16} className="mr-2" />
                      {saving ? 'Saving...' : isEditing ? 'Update Item' : 'Save Item'}
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
