import { useState, useEffect, useCallback } from 'react';
import { useAuth, apiClient } from '@/App';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Plus, FileText, Eye, ArrowRight, Clock, Send, CheckCircle, Layers, LogOut, UserCheck, Search, Phone, UserPlus, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

export default function SalesExecDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  
  // Phone-first flow state
  const [customerPhone, setCustomerPhone] = useState('');
  const [lookupState, setLookupState] = useState('idle'); // idle, searching, found, not_found
  const [foundCustomer, setFoundCustomer] = useState(null);
  
  // Customer details (editable)
  const [customerName, setCustomerName] = useState('');
  const [customerLocation, setCustomerLocation] = useState('');
  const [customerReference, setCustomerReference] = useState('');
  const [narration, setNarration] = useState('');
  
  // Add new phone to existing customer
  const [showAddPhone, setShowAddPhone] = useState(false);
  const [newPhone, setNewPhone] = useState('');
  const [addingPhone, setAddingPhone] = useState(false);
  
  const [myBills, setMyBills] = useState([]);
  const [creating, setCreating] = useState(false);
  const [branches, setBranches] = useState([]);
  const [activeFilter, setActiveFilter] = useState('all');
  const [salespeople, setSalespeople] = useState([]);
  const [salesperson, setSalesperson] = useState('');
  const [buybackRates, setBuybackRates] = useState(null);

  useEffect(() => {
    loadBills();
    loadBranches();
    loadSalespeople();
    loadBuybackRates();
  }, []);

  const loadBuybackRates = async () => {
    try {
      const res = await apiClient.get('/rates/buyback');
      setBuybackRates(res.data);
    } catch (err) { /* buyback rates may not exist yet */ }
  };

  const loadBills = async () => {
    try {
      const res = await apiClient.get('/bills');
      setMyBills(res.data);
    } catch (err) { console.error(err); }
  };

  const loadBranches = async () => {
    try {
      const res = await apiClient.get('/branches');
      setBranches(res.data);
    } catch (err) { console.error(err); }
  };

  const loadSalespeople = async () => {
    try {
      const res = await apiClient.get('/salespeople');
      setSalespeople(res.data);
    } catch (err) { console.error(err); }
  };

  const userBranch = branches.find(b => b.id === user?.branch_id);

  // Phone lookup - auto-trigger when 10 digits entered
  const lookupPhone = useCallback(async (phone) => {
    if (phone.length !== 10) {
      setLookupState('idle');
      setFoundCustomer(null);
      setCustomerName('');
      setCustomerLocation('');
      setCustomerReference('');
      setNarration('');
      setShowAddPhone(false);
      setNewPhone('');
      return;
    }
    setLookupState('searching');
    try {
      const res = await apiClient.get(`/customers/lookup-phone?phone=${phone}`);
      if (res.data.found) {
        setLookupState('found');
        setFoundCustomer(res.data.customer);
        setCustomerName(res.data.customer.name || '');
        setCustomerLocation(res.data.customer.location || '');
        setCustomerReference('Repeat Customer');
      } else {
        setLookupState('not_found');
        setFoundCustomer(null);
        setCustomerName('');
        setCustomerLocation('');
        setCustomerReference('');
      }
    } catch (err) {
      setLookupState('not_found');
      setFoundCustomer(null);
    }
  }, []);

  const handlePhoneChange = (val) => {
    const cleaned = val.replace(/\D/g, '').slice(0, 10);
    setCustomerPhone(cleaned);
    if (cleaned.length === 10) {
      lookupPhone(cleaned);
    } else {
      setLookupState('idle');
      setFoundCustomer(null);
    }
  };

  const handleAddPhone = async () => {
    if (!foundCustomer || newPhone.length !== 10) return;
    setAddingPhone(true);
    try {
      const res = await apiClient.post(`/customers/${foundCustomer.id}/add-phone`, { phone: newPhone });
      if (res.data.status === 'added') {
        toast.success(`Phone ${newPhone} added to ${foundCustomer.name}`);
        setNewPhone('');
        setShowAddPhone(false);
      } else {
        toast.info(res.data.message || 'Phone already exists');
      }
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to add phone');
    } finally {
      setAddingPhone(false);
    }
  };

  const resetForm = () => {
    setCustomerPhone('');
    setCustomerName('');
    setCustomerLocation('');
    setCustomerReference('');
    setNarration('');
    setLookupState('idle');
    setFoundCustomer(null);
    setShowAddPhone(false);
    setNewPhone('');
    setSalesperson('');
  };

  const handleMakeBill = async () => {
    if (!customerPhone.trim() || customerPhone.length !== 10) { toast.error('Valid 10-digit phone number is required'); return; }
    if (!customerName.trim()) { toast.error('Customer Name is mandatory'); return; }
    if (!customerLocation.trim()) { toast.error('Location is mandatory'); return; }
    if (!customerReference) { toast.error('Reference is mandatory'); return; }
    if (!salesperson) { toast.error('Please select a salesperson'); return; }
    setCreating(true);
    try {
      const res = await apiClient.post('/bills', {
        customer_name: customerName,
        customer_phone: customerPhone,
        customer_location: customerLocation,
        customer_reference: customerReference,
        salesperson_name: salesperson,
        narration: narration,
        items: [],
        external_charges: [],
      });
      toast.success('Bill created! Add items now.');
      resetForm();
      navigate(`/bill/${res.data.id}`);
    } catch (err) {
      toast.error('Failed to create bill');
    } finally {
      setCreating(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const formatCurrency = (val) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val || 0);

  const references = ['Instagram', 'Facebook', 'Friends', 'Family', 'Repeat Customer', 'Walk-in', 'Google', 'Newspaper', 'TV', 'Other'];

  const draftBills = myBills.filter(b => b.status === 'draft');
  const sentBills = myBills.filter(b => b.status === 'sent');
  const approvedBills = myBills.filter(b => b.status === 'approved' || b.status === 'edited');

  const getFilteredBills = () => {
    switch (activeFilter) {
      case 'draft': return draftBills;
      case 'sent': return sentBills;
      case 'approved': return approvedBills;
      default: return myBills;
    }
  };

  const filteredBills = getFilteredBills();

  const statusConfig = {
    draft: { label: 'Draft', classes: 'bg-yellow-500/20 text-yellow-400', icon: Clock },
    sent: { label: 'Sent', classes: 'bg-blue-500/20 text-blue-400', icon: Send },
    edited: { label: 'Edited', classes: 'bg-orange-500/20 text-orange-400', icon: FileText },
    approved: { label: 'Approved', classes: 'bg-green-500/20 text-green-400', icon: CheckCircle },
  };

  return (
    <div className="kintsugi-page">
      <div className="kintsugi-veins" />
      <div className="relative z-10">
        <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
          <div className="flex items-center justify-between px-3 sm:px-4 py-3 max-w-5xl mx-auto">
            <div className="min-w-0 flex items-center gap-2">
              <img src="/ajpl-logo.png" alt="AJPL" className="h-10 w-auto object-contain" />
              <div>
                <h1 className="heading text-base sm:text-lg font-bold text-primary tracking-wider leading-tight">AJPL Calculator</h1>
                <p className="text-[10px] text-muted-foreground truncate">{userBranch?.name || 'Branch'} &middot; {user?.full_name}</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={handleLogout} data-testid="logout-button" className="shrink-0">
              <LogOut size={16} className="mr-1" /> <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </header>

        <main className="px-3 sm:px-4 py-4 sm:py-6 max-w-5xl mx-auto space-y-4 sm:space-y-6">

          {/* Multi-Bill Tab Bar */}
          {draftBills.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-1 px-1" data-testid="multi-bill-tabs">
              {draftBills.map(bill => (
                <button
                  key={bill.id}
                  onClick={() => navigate(`/bill/${bill.id}`)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-t-lg text-xs font-medium whitespace-nowrap bg-card border border-border border-b-0 hover:border-primary/30 transition-colors"
                  data-testid={`tab-bill-${bill.id}`}
                >
                  <span className="w-2 h-2 rounded-full bg-yellow-400 shrink-0" />
                  <span className="truncate max-w-[100px]">{bill.customer_name}</span>
                  <span className="mono text-[10px] text-muted-foreground">{formatCurrency(bill.grand_total)}</span>
                </button>
              ))}
              <div className="px-2 py-2 rounded-t-lg text-xs font-medium bg-primary/10 border border-primary/30 border-b-0 text-primary">
                <Plus size={14} className="inline mr-1" /> New
              </div>
            </div>
          )}

          {/* Active Drafts - Quick Access */}
          {draftBills.length > 0 && (
            <div data-testid="active-drafts-section">
              <div className="flex items-center gap-2 mb-3">
                <Layers size={16} className="text-primary" />
                <h2 className="heading text-lg sm:text-xl font-bold">Active Drafts</h2>
                <span className="px-2 py-0.5 rounded-full text-xs bg-yellow-500/20 text-yellow-400 font-medium">{draftBills.length}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {draftBills.map(bill => (
                  <Card
                    key={bill.id}
                    className="bg-card/90 border-border hover:border-primary/30 transition-colors duration-200 cursor-pointer"
                    onClick={() => navigate(`/bill/${bill.id}`)}
                    data-testid={`draft-bill-card-${bill.id}`}
                  >
                    <CardContent className="p-3 sm:p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm sm:text-base truncate">{bill.customer_name}</p>
                          <p className="text-xs text-muted-foreground mono">{bill.bill_number}</p>
                          <p className="text-xs text-muted-foreground mt-1">{bill.items?.length || 0} items</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="mono text-base sm:text-lg font-bold text-primary">{formatCurrency(bill.grand_total)}</p>
                          <span className="text-[10px] text-yellow-400">DRAFT</span>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        className="w-full mt-3 h-10 font-medium rounded-lg"
                        data-testid={`continue-bill-${bill.id}`}
                      >
                        Continue <ArrowRight size={14} className="ml-1" />
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Buyback Rates Display */}
          {buybackRates?.purities?.some(p => p.rate_per_10g > 0) && (
            <div className="rounded-xl border border-border bg-card/60 backdrop-blur-sm p-3 sm:p-4" data-testid="buyback-rates-display">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2 font-medium">Buyback Rates <span className="text-[9px] opacity-60">(per 10g)</span></p>
              <div className="flex flex-wrap gap-2 sm:gap-3">
                {buybackRates.purities.filter(p => p.rate_per_10g > 0).map(p => (
                  <div key={p.purity_id} className="flex items-baseline gap-1.5 px-2.5 py-1.5 rounded-lg bg-secondary/40 border border-border/50">
                    <span className="text-xs font-semibold text-primary">{p.purity_name}</span>
                    <span className="mono text-sm font-bold text-foreground">{new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(p.rate_per_10g)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Customer Capture - Phone First Flow */}
          <Card className="bg-card/90 backdrop-blur-sm border-border shadow-[var(--shadow-elev-1)]">
            <CardHeader className="pb-3">
              <CardTitle className="heading text-xl sm:text-2xl">New Bill</CardTitle>
              <p className="text-xs sm:text-sm text-muted-foreground">Enter phone number to start</p>
            </CardHeader>
            <CardContent>
              {/* Step 1: Phone Number */}
              <div className="space-y-2 mb-4">
                <Label htmlFor="cphone" className="text-sm flex items-center gap-2">
                  <Phone size={14} className="text-primary" /> Phone Number * (10 digits)
                </Label>
                <div className="relative">
                  <Input
                    id="cphone"
                    placeholder="Enter 10-digit phone number"
                    value={customerPhone}
                    onChange={e => handlePhoneChange(e.target.value)}
                    className={`h-12 bg-secondary/50 text-lg mono pr-10 ${
                      lookupState === 'found' ? 'border-[hsl(160,52%,46%)] ring-1 ring-[hsl(160,52%,46%)]/30' :
                      lookupState === 'not_found' && customerPhone.length === 10 ? 'border-[hsl(196,70%,52%)] ring-1 ring-[hsl(196,70%,52%)]/30' : ''
                    }`}
                    data-testid="customer-phone-input"
                    inputMode="numeric"
                    maxLength={10}
                    autoFocus
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {lookupState === 'searching' && <Loader2 size={18} className="animate-spin text-muted-foreground" />}
                    {lookupState === 'found' && <UserCheck size={18} className="text-[hsl(160,52%,46%)]" />}
                    {lookupState === 'not_found' && <UserPlus size={18} className="text-[hsl(196,70%,52%)]" />}
                  </div>
                </div>
                {/* Lookup Status */}
                {lookupState === 'found' && foundCustomer && (
                  <div className="p-3 rounded-lg bg-[hsl(160,52%,46%)]/10 border border-[hsl(160,52%,46%)]/30" data-testid="customer-found-banner">
                    <div className="flex items-center gap-2">
                      <UserCheck size={16} className="text-[hsl(160,52%,46%)] shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-[hsl(160,52%,46%)]">
                          Returning Customer: <span className="text-foreground">{foundCustomer.name}</span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {foundCustomer.total_visits || 1} visit{(foundCustomer.total_visits || 1) > 1 ? 's' : ''} 
                          {foundCustomer.location ? ` | ${foundCustomer.location}` : ''}
                          {foundCustomer.all_phones?.length > 1 ? ` | ${foundCustomer.all_phones.length} phone numbers` : ''}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                {lookupState === 'not_found' && customerPhone.length === 10 && (
                  <div className="p-3 rounded-lg bg-[hsl(196,70%,52%)]/10 border border-[hsl(196,70%,52%)]/30" data-testid="new-customer-banner">
                    <div className="flex items-center gap-2">
                      <UserPlus size={16} className="text-[hsl(196,70%,52%)]" />
                      <p className="text-sm font-medium text-[hsl(196,70%,52%)]">New Customer — fill in details below</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Step 2: Customer Details (shown after phone lookup) */}
              {(lookupState === 'found' || lookupState === 'not_found') && (
                <div className="space-y-4 border-t border-border/50 pt-4" data-testid="customer-details-section">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="cname" className="text-sm">Customer Name *</Label>
                      <Input
                        id="cname"
                        placeholder="Customer name"
                        value={customerName}
                        onChange={e => setCustomerName(e.target.value)}
                        className="h-11 bg-secondary/50"
                        data-testid="customer-name-input"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cloc" className="text-sm">Location *</Label>
                      <Input
                        id="cloc"
                        placeholder="City / Area"
                        value={customerLocation}
                        onChange={e => setCustomerLocation(e.target.value)}
                        className="h-11 bg-secondary/50"
                        data-testid="customer-location-input"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cref" className="text-sm">Reference *</Label>
                      {lookupState === 'found' ? (
                        <div className="h-11 flex items-center px-3 rounded-md bg-secondary/30 border border-border text-sm" data-testid="reference-locked">
                          <span className="text-muted-foreground">Repeat Customer</span>
                        </div>
                      ) : (
                        <Select value={customerReference} onValueChange={setCustomerReference}>
                          <SelectTrigger className="h-11 bg-secondary/50" data-testid="customer-reference-select">
                            <SelectValue placeholder="How did they find us?" />
                          </SelectTrigger>
                          <SelectContent>
                            {references.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="csp" className="text-sm">Salesperson *</Label>
                      <Select value={salesperson} onValueChange={setSalesperson}>
                        <SelectTrigger className="h-11 bg-secondary/50" data-testid="salesperson-select">
                          <SelectValue placeholder="Select salesperson" />
                        </SelectTrigger>
                        <SelectContent>
                          {salespeople.map(sp => <SelectItem key={sp.id} value={sp.name}>{sp.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Narration (optional) */}
                  <div className="space-y-2">
                    <Label htmlFor="narration" className="text-sm text-muted-foreground">Narration (optional)</Label>
                    <Input
                      id="narration"
                      placeholder="e.g. Actual buyer name, purpose, notes..."
                      value={narration}
                      onChange={e => setNarration(e.target.value)}
                      className="h-10 bg-secondary/30 text-sm"
                      data-testid="narration-input"
                    />
                  </div>

                  {/* Add another phone (for returning customers) */}
                  {lookupState === 'found' && foundCustomer && (
                    <div className="space-y-2">
                      {!showAddPhone ? (
                        <button
                          onClick={() => setShowAddPhone(true)}
                          className="text-xs text-primary hover:underline flex items-center gap-1"
                          data-testid="add-phone-toggle"
                        >
                          <Plus size={12} /> Add another phone number for this customer
                        </button>
                      ) : (
                        <div className="flex items-end gap-2 p-3 rounded-lg bg-secondary/20 border border-border/50">
                          <div className="flex-1 space-y-1">
                            <Label className="text-xs">New Phone for {foundCustomer.name}</Label>
                            <Input
                              placeholder="10-digit number"
                              value={newPhone}
                              onChange={e => setNewPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                              className="h-9 bg-secondary/50 mono"
                              inputMode="numeric"
                              maxLength={10}
                              data-testid="new-phone-input"
                            />
                          </div>
                          <Button size="sm" className="h-9" onClick={handleAddPhone} disabled={newPhone.length !== 10 || addingPhone} data-testid="add-phone-button">
                            {addingPhone ? <Loader2 size={14} className="animate-spin" /> : 'Add'}
                          </Button>
                          <Button size="sm" variant="ghost" className="h-9" onClick={() => { setShowAddPhone(false); setNewPhone(''); }}>Cancel</Button>
                        </div>
                      )}
                    </div>
                  )}

                  <Button
                    className="w-full sm:w-auto h-12 px-8 text-base font-semibold rounded-xl"
                    onClick={handleMakeBill}
                    disabled={creating}
                    data-testid="make-bill-button"
                  >
                    <Plus size={18} className="mr-2" />
                    {creating ? 'Creating...' : 'Make Bill'}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* My Bills */}
          <Card className="bg-card/90 backdrop-blur-sm border-border shadow-[var(--shadow-elev-1)]">
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <CardTitle className="heading text-lg sm:text-xl">My Bills ({myBills.length})</CardTitle>
                {/* Mobile-friendly filter chips */}
                <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1" data-testid="bill-filter-chips">
                  {[
                    { key: 'all', label: 'All', count: myBills.length },
                    { key: 'draft', label: 'Draft', count: draftBills.length },
                    { key: 'sent', label: 'Sent', count: sentBills.length },
                    { key: 'approved', label: 'Done', count: approvedBills.length },
                  ].map(f => (
                    <button
                      key={f.key}
                      onClick={() => setActiveFilter(f.key)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors duration-200 ${
                        activeFilter === f.key
                          ? 'bg-primary/20 text-primary border border-primary/30'
                          : 'bg-secondary/50 text-muted-foreground border border-transparent hover:bg-secondary'
                      }`}
                      data-testid={`filter-${f.key}`}
                    >
                      {f.label} ({f.count})
                    </button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {filteredBills.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No bills found</p>
              ) : (
                <>
                  {/* Mobile Card View */}
                  <div className="md:hidden space-y-3" data-testid="bills-mobile-list">
                    {filteredBills.map(bill => {
                      const sc = statusConfig[bill.status] || statusConfig.draft;
                      return (
                        <div
                          key={bill.id}
                          className="p-3 rounded-lg bg-secondary/20 border border-border hover:border-primary/20 transition-colors duration-200"
                          data-testid={`mobile-bill-${bill.id}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-sm truncate">{bill.customer_name}</p>
                              <p className="text-[10px] text-muted-foreground mono mt-0.5">{bill.bill_number}</p>
                            </div>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium shrink-0 ${sc.classes}`}>{sc.label}</span>
                          </div>
                          <div className="flex items-center justify-between mt-2">
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <span>{bill.items?.length || 0} items</span>
                              <span>{bill.created_at?.slice(0, 10)}</span>
                            </div>
                            <span className="mono text-sm font-bold text-primary">{formatCurrency(bill.grand_total)}</span>
                          </div>
                          <Button
                            variant="secondary"
                            size="sm"
                            className="w-full mt-2.5 h-10"
                            onClick={() => navigate(`/bill/${bill.id}`)}
                            data-testid={`exec-view-bill-${bill.id}`}
                          >
                            <Eye size={14} className="mr-1.5" /> {bill.status === 'draft' ? 'Continue' : 'View'}
                          </Button>
                        </div>
                      );
                    })}
                  </div>

                  {/* Desktop Table View */}
                  <div className="hidden md:block overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-border">
                          <TableHead className="text-xs uppercase tracking-widest text-muted-foreground">Bill #</TableHead>
                          <TableHead className="text-xs uppercase tracking-widest text-muted-foreground">Customer</TableHead>
                          <TableHead className="text-xs uppercase tracking-widest text-muted-foreground">Status</TableHead>
                          <TableHead className="text-xs uppercase tracking-widest text-muted-foreground text-right">Total</TableHead>
                          <TableHead className="text-xs uppercase tracking-widest text-muted-foreground">Date</TableHead>
                          <TableHead className="text-xs uppercase tracking-widest text-muted-foreground">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredBills.map(bill => (
                          <TableRow key={bill.id} className="border-border hover:bg-secondary/50">
                            <TableCell className="mono text-sm">{bill.bill_number}</TableCell>
                            <TableCell>{bill.customer_name}</TableCell>
                            <TableCell>
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                (statusConfig[bill.status] || statusConfig.draft).classes
                              }`}>{bill.status}</span>
                            </TableCell>
                            <TableCell className="mono text-right font-medium">{formatCurrency(bill.grand_total)}</TableCell>
                            <TableCell className="text-muted-foreground text-sm">{bill.created_at?.slice(0, 10)}</TableCell>
                            <TableCell>
                              <Button variant="ghost" size="sm" onClick={() => navigate(`/bill/${bill.id}`)} data-testid={`exec-view-bill-${bill.id}`}>
                                <Eye size={14} className="mr-1" /> View
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
}
