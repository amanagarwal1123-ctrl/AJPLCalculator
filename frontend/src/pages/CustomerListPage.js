import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '@/App';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, Search, Eye, ArrowUpDown } from 'lucide-react';
import { toast } from 'sonner';

const VISIT_FILTERS = [
  { key: 'all', label: 'All' },
  { key: '1', label: '1 visit' },
  { key: '2-4', label: '2-4 visits' },
  { key: '5+', label: '5+ visits' },
];

const SORT_OPTIONS = [
  { value: 'last_visit_desc', label: 'Last purchase (newest)' },
  { value: 'last_visit_asc', label: 'Last purchase (oldest)' },
  { value: 'first_visit_desc', label: 'First purchase (newest)' },
  { value: 'first_visit_asc', label: 'First purchase (oldest)' },
  { value: 'spent_desc', label: 'Total spent (high → low)' },
  { value: 'visits_desc', label: 'Visit count (high → low)' },
];

function fmtDate(iso) {
  if (!iso) return '-';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return '-'; }
}

function timeKey(iso) {
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  return isNaN(t) ? 0 : t;
}

export default function CustomerListPage() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [visitFilter, setVisitFilter] = useState('all');
  const [sortBy, setSortBy] = useState('last_visit_desc');

  useEffect(() => { loadCustomers(); }, []);

  const loadCustomers = async () => {
    try {
      const res = await apiClient.get('/analytics/customers');
      setCustomers(res.data);
    } catch (err) {
      toast.error('Failed to load customers');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (val) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val || 0);

  const filteredCustomers = useMemo(() => {
    const s = search.toLowerCase().trim();
    const list = customers.filter(c => {
      if (s && !((c.name || '').toLowerCase().includes(s) || (c.phone || '').includes(s))) return false;
      const visits = c.total_visits || 1;
      if (visitFilter === '1') return visits === 1;
      if (visitFilter === '2-4') return visits >= 2 && visits <= 4;
      if (visitFilter === '5+') return visits >= 5;
      return true;
    });
    const cmp = {
      last_visit_desc: (a, b) => timeKey(b.last_visit) - timeKey(a.last_visit),
      last_visit_asc: (a, b) => timeKey(a.last_visit) - timeKey(b.last_visit),
      first_visit_desc: (a, b) => timeKey(b.first_visit) - timeKey(a.first_visit),
      first_visit_asc: (a, b) => timeKey(a.first_visit) - timeKey(b.first_visit),
      spent_desc: (a, b) => (b.total_spent || 0) - (a.total_spent || 0),
      visits_desc: (a, b) => (b.total_visits || 1) - (a.total_visits || 1),
    }[sortBy] || ((a, b) => 0);
    return [...list].sort(cmp);
  }, [customers, search, visitFilter, sortBy]);

  const visitCounts = useMemo(() => ({
    all: customers.length,
    '1': customers.filter(c => (c.total_visits || 1) === 1).length,
    '2-4': customers.filter(c => (c.total_visits || 1) >= 2 && (c.total_visits || 1) <= 4).length,
    '5+': customers.filter(c => (c.total_visits || 1) >= 5).length,
  }), [customers]);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="heading text-3xl font-bold">Customers</h1>
            <p className="text-muted-foreground mt-1">View customer profiles and bill history</p>
          </div>
          <div className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-1.5">
            <Users size={16} className="text-primary" />
            <span className="mono text-lg font-bold text-primary" data-testid="total-customers">{customers.length}</span>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-3 lg:items-center">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name or phone..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10 h-11 bg-card border-border"
              data-testid="customer-search"
            />
          </div>
          <div className="flex items-center gap-2 min-w-fit">
            <ArrowUpDown size={14} className="text-muted-foreground shrink-0" />
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[220px] h-11 bg-card border-border" data-testid="customer-sort-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map(o => (
                  <SelectItem key={o.value} value={o.value} data-testid={`sort-opt-${o.value}`}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5" data-testid="customer-visit-filters">
          {VISIT_FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setVisitFilter(f.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors border ${
                visitFilter === f.key
                  ? 'bg-primary/20 text-primary border-primary/30'
                  : 'bg-secondary/50 text-muted-foreground border-transparent hover:bg-secondary'
              }`}
              data-testid={`visit-filter-${f.key}`}
            >
              {f.label} ({visitCounts[f.key] || 0})
            </button>
          ))}
        </div>

        <Card className="bg-card border-border">
          <CardContent className="p-0">
            {loading ? (
              <p className="text-muted-foreground text-center py-12">Loading customers...</p>
            ) : filteredCustomers.length === 0 ? (
              <p className="text-muted-foreground text-center py-12">No customers found</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border">
                      <TableHead className="text-xs uppercase tracking-widest text-muted-foreground">Name</TableHead>
                      <TableHead className="text-xs uppercase tracking-widest text-muted-foreground">Phone</TableHead>
                      <TableHead className="text-xs uppercase tracking-widest text-muted-foreground">Location</TableHead>
                      <TableHead className="text-xs uppercase tracking-widest text-muted-foreground min-w-[220px]">Reference / Visits</TableHead>
                      <TableHead className="text-xs uppercase tracking-widest text-muted-foreground text-right">Total Spent</TableHead>
                      <TableHead className="text-xs uppercase tracking-widest text-muted-foreground text-right">Last Visit</TableHead>
                      <TableHead className="text-xs uppercase tracking-widest text-muted-foreground text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCustomers.map((c, i) => {
                      const visits = c.total_visits || 1;
                      const initialRef = (c.initial_reference || c.reference || '').trim() || 'Unknown';
                      const firstDate = fmtDate(c.first_visit);
                      const lastDate = fmtDate(c.last_visit);
                      const hasMultiple = visits > 1 && firstDate !== lastDate && c.first_visit && c.last_visit;
                      return (
                        <TableRow
                          key={c.id || i}
                          className="border-border hover:bg-secondary/30 cursor-pointer"
                          onClick={() => navigate(`/admin/customers/${c.id}`)}
                          data-testid={`customer-row-${i}`}
                        >
                          <TableCell className="font-medium">{c.name}</TableCell>
                          <TableCell className="mono text-sm">{c.phone}</TableCell>
                          <TableCell className="text-muted-foreground">{c.location || '-'}</TableCell>
                          <TableCell className="py-3" data-testid={`customer-ref-cell-${i}`}>
                            <div className="flex flex-col gap-0.5 leading-tight">
                              <div className="flex items-baseline gap-1.5 flex-wrap">
                                <span className="text-sm font-medium text-foreground capitalize" data-testid={`customer-origin-${i}`}>{initialRef}</span>
                                <span className="text-[11px] text-muted-foreground">·</span>
                                <span className="mono text-[11px] text-[hsl(160,52%,46%)] font-medium" data-testid={`customer-visits-${i}`}>
                                  {visits} {visits === 1 ? 'visit' : 'visits'}
                                </span>
                              </div>
                              <div className="mono text-[11px] text-muted-foreground" data-testid={`customer-dates-${i}`}>
                                {hasMultiple
                                  ? <>{firstDate} <span className="opacity-50">→</span> {lastDate}</>
                                  : firstDate}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="mono text-right font-medium text-primary">{formatCurrency(c.total_spent)}</TableCell>
                          <TableCell className="mono text-right">
                            <span className={`px-2 py-0.5 rounded text-xs ${
                              c.days_since_last_visit > 30 ? 'bg-destructive/20 text-[hsl(0,72%,60%)]' :
                              c.days_since_last_visit > 14 ? 'bg-[hsl(38,85%,55%)]/20 text-[hsl(38,85%,55%)]' :
                              'bg-[hsl(160,52%,46%)]/20 text-[hsl(160,52%,46%)]'
                            }`}>{c.days_since_last_visit ?? '-'}d ago</span>
                          </TableCell>
                          <TableCell className="text-center">
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" data-testid={`view-customer-${i}`}>
                              <Eye size={14} />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
