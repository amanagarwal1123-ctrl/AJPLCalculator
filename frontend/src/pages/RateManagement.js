import { useState, useEffect } from 'react';
import { useAuth, apiClient } from '@/App';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import NumericInput from '@/components/NumericInput';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Save, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export default function RateManagement() {
  const [rates, setRates] = useState({ normal: null, ajpl: null, buyback: null });
  const [purities, setPurities] = useState([]);
  const [newPurityName, setNewPurityName] = useState('');
  const [newPurityPercent, setNewPurityPercent] = useState('');
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('normal');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [ratesRes, puritiesRes] = await Promise.all([
        apiClient.get('/rates'),
        apiClient.get('/purities'),
      ]);
      const allPurities = puritiesRes.data;
      setPurities(allPurities);

      // Build rates map, syncing purities from the purities collection
      const ratesMap = {};
      ratesRes.data.forEach(r => {
        const ratePurities = r.purities || [];
        // If rate card has no purities or fewer than collection, re-sync
        if (ratePurities.length === 0 && allPurities.length > 0) {
          r.purities = allPurities.map(p => ({
            purity_id: p.id,
            purity_name: p.name,
            purity_percent: p.percent,
            rate_per_10g: 0,
          }));
        } else if (ratePurities.length < allPurities.length) {
          // Add missing purities that exist in collection but not in rate card
          const existingNames = new Set(ratePurities.map(p => p.purity_name));
          allPurities.forEach(p => {
            if (!existingNames.has(p.name)) {
              r.purities.push({
                purity_id: p.id,
                purity_name: p.name,
                purity_percent: p.percent,
                rate_per_10g: 0,
              });
            }
          });
        }
        ratesMap[r.rate_type] = r;
      });
      setRates(ratesMap);
    } catch (err) {
      toast.error('Failed to load rates');
    }
  };

  const saveRates = async (rateType) => {
    setSaving(true);
    try {
      const purities = rates[rateType]?.purities || [];
      await apiClient.put(`/rates/${rateType}`, {
        rate_type: rateType,
        purities: purities.map(p => ({
          purity_id: p.purity_id,
          purity_name: p.purity_name,
          purity_percent: p.purity_percent,
          rate_per_10g: p.rate_per_10g || 0,
        })),
      });
      toast.success(`${rateType.toUpperCase()} rates saved!`);
      loadData();
    } catch (err) {
      toast.error('Failed to save rates');
    } finally {
      setSaving(false);
    }
  };

  const updateRate = (rateType, purityIdx, value) => {
    setRates(prev => {
      const rateCard = prev[rateType];
      if (!rateCard?.purities?.[purityIdx]) return prev;
      const newPurities = rateCard.purities.map((p, i) =>
        i === purityIdx ? { ...p, rate_per_10g: parseFloat(value) || 0 } : p
      );
      return { ...prev, [rateType]: { ...rateCard, purities: newPurities } };
    });
  };

  const addPurity = async () => {
    if (!newPurityName.trim() || !newPurityPercent) {
      toast.error('Enter name and percentage');
      return;
    }
    try {
      await apiClient.post('/purities', { name: newPurityName, percent: parseFloat(newPurityPercent) });
      setNewPurityName('');
      setNewPurityPercent('');
      toast.success('Purity added!');
      loadData();
    } catch (err) {
      toast.error('Failed to add purity');
    }
  };

  const deletePurity = async (id) => {
    if (!window.confirm('Delete this purity?')) return;
    try {
      await apiClient.delete(`/purities/${id}`);
      toast.success('Purity deleted');
      loadData();
    } catch (err) {
      toast.error('Failed to delete purity');
    }
  };

  const formatCurrency = (val) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val || 0);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="heading text-3xl font-bold">Rate Management</h1>
          <p className="text-muted-foreground mt-1">Set gold rates for Normal, AJPL, and Buyback categories</p>
        </div>

        {/* Purity Management */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Purities</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3 mb-4">
              {purities.map(p => (
                <div key={p.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary/50 border border-border">
                  <span className="font-medium text-primary">{p.name}</span>
                  <span className="text-xs text-muted-foreground">({p.percent}%)</span>
                  <Button variant="ghost" size="sm" className="h-5 w-5 p-0 text-destructive" onClick={() => deletePurity(p.id)}>
                    <Trash2 size={10} />
                  </Button>
                </div>
              ))}
            </div>
            <div className="flex gap-3 items-end">
              <div className="space-y-1">
                <Label className="text-xs">Purity Name</Label>
                <Input placeholder="e.g. 16KT" value={newPurityName} onChange={e => setNewPurityName(e.target.value)} className="h-9 w-32 bg-secondary/50" data-testid="new-purity-name" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Percent</Label>
                <NumericInput placeholder="e.g. 66" value={newPurityPercent} onChange={e => setNewPurityPercent(e.target.value)} label="Purity Percent" className="h-9 w-24 mono bg-secondary/50" data-testid="new-purity-percent" />
              </div>
              <Button size="sm" onClick={addPurity} data-testid="add-purity-button">
                <Plus size={14} className="mr-1" /> Add
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Rate Cards */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-secondary">
            <TabsTrigger value="normal" data-testid="normal-rates-tab">Normal Rates</TabsTrigger>
            <TabsTrigger value="ajpl" data-testid="ajpl-rates-tab">AJPL Rates</TabsTrigger>
            <TabsTrigger value="buyback" data-testid="buyback-rates-tab">Buyback Rates</TabsTrigger>
          </TabsList>

          {['normal', 'ajpl', 'buyback'].map(rateType => (
            <TabsContent key={rateType} value={rateType}>
              <Card className="bg-card border-border">
                <CardHeader className="pb-3 flex flex-row items-center justify-between">
                  <CardTitle className="heading text-xl capitalize">{rateType === 'ajpl' ? 'AJPL' : rateType === 'buyback' ? 'Buyback' : 'Normal'} Rates</CardTitle>
                  <Button onClick={() => saveRates(rateType)} disabled={saving} data-testid={`save-${rateType}-rates`}>
                    <Save size={16} className="mr-2" /> {saving ? 'Saving...' : 'Save Rates'}
                  </Button>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground mb-4">Enter rate per 10 grams for each purity</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
                    {rates[rateType]?.purities?.map((p, idx) => (
                      <div key={idx} className="p-4 md:p-5 rounded-xl bg-secondary/20 border border-border">
                        <div className="flex items-center justify-between mb-3">
                          <span className="font-semibold text-primary text-base md:text-lg">{p.purity_name}</span>
                          <span className="text-xs md:text-sm text-muted-foreground">{p.purity_percent}%</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm md:text-base text-muted-foreground">Rs.</span>
                          <NumericInput
                            value={p.rate_per_10g || ''}
                            onChange={e => updateRate(rateType, idx, e.target.value)}
                            placeholder="0"
                            label={`${p.purity_name} Rate/10g`}
                            className="h-12 md:h-14 mono bg-secondary/50 text-base md:text-lg"
                            data-testid={`rate-${rateType}-${p.purity_name}`}
                          />
                          <span className="text-xs text-muted-foreground">/10g</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  {rates[rateType]?.updated_at && (
                    <p className="text-xs text-muted-foreground mt-4">Last updated: {rates[rateType].updated_at?.slice(0, 10)} by {rates[rateType].updated_by}</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </AppLayout>
  );
}
