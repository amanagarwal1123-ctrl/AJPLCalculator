import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '@/App';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { FileText, Eye, Trash2, Printer, Edit, Search, Filter } from 'lucide-react';
import { toast } from 'sonner';

export default function AllBillsPage() {
  const navigate = useNavigate();
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  useEffect(() => { loadBills(); }, []);

  const loadBills = async () => {
    try {
      const res = await apiClient.get('/bills');
      setBills(res.data);
    } catch (err) {
      toast.error('Failed to load bills');
    } finally {
      setLoading(false);
    }
  };

  const deleteBill = async (billId) => {
    try {
      await apiClient.delete(`/bills/${billId}`);
      toast.success('Bill deleted');
      setDeleteConfirm(null);
      loadBills();
    } catch (err) {
      toast.error('Failed to delete bill');
    }
  };

  const formatCurrency = (val) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val || 0);

  const statusColor = (s) => {
    switch(s) {
      case 'approved': return 'bg-[hsl(160,52%,46%)]/20 text-[hsl(160,52%,46%)]';
      case 'sent': return 'bg-[hsl(196,70%,52%)]/20 text-[hsl(196,70%,52%)]';
      case 'edited': return 'bg-[hsl(38,85%,55%)]/20 text-[hsl(38,85%,55%)]';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const filtered = bills.filter(b => {
    const matchesSearch = !search || 
      (b.bill_number || '').toLowerCase().includes(search.toLowerCase()) ||
      (b.customer_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (b.customer_phone || '').includes(search) ||
      (b.executive_name || '').toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || b.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="heading text-3xl font-bold">All Bills</h1>
            <p className="text-muted-foreground mt-1">Complete bill history in chronological order</p>
          </div>
          <div className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-1.5">
            <FileText size={16} className="text-primary" />
            <span className="mono text-lg font-bold text-primary" data-testid="total-bills-count">{bills.length}</span>
          </div>
        </div>

        {/* Filters */}
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-end gap-4">
              <div className="flex-1 relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Search bill #, customer, phone, executive..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 h-10 bg-secondary/50" data-testid="bills-search" />
              </div>
              <div className="w-48">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-10 bg-secondary/50" data-testid="bills-status-filter">
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="sent">Sent</SelectItem>
                    <SelectItem value="edited">Edited</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bills Table */}
        <Card className="bg-card border-border">
          <CardContent className="p-0">
            {loading ? (
              <p className="text-muted-foreground text-center py-12">Loading bills...</p>
            ) : filtered.length === 0 ? (
              <p className="text-muted-foreground text-center py-12">No bills found</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border">
                      <TableHead className="text-xs uppercase tracking-widest text-muted-foreground w-[50px] text-center">S.No</TableHead>
                      <TableHead className="text-xs uppercase tracking-widest text-muted-foreground">Bill #</TableHead>
                      <TableHead className="text-xs uppercase tracking-widest text-muted-foreground">Date</TableHead>
                      <TableHead className="text-xs uppercase tracking-widest text-muted-foreground">Customer</TableHead>
                      <TableHead className="text-xs uppercase tracking-widest text-muted-foreground">Phone</TableHead>
                      <TableHead className="text-xs uppercase tracking-widest text-muted-foreground">Executive</TableHead>
                      <TableHead className="text-xs uppercase tracking-widest text-muted-foreground">Items</TableHead>
                      <TableHead className="text-xs uppercase tracking-widest text-muted-foreground">Status</TableHead>
                      <TableHead className="text-xs uppercase tracking-widest text-muted-foreground text-right">Subtotal</TableHead>
                      <TableHead className="text-xs uppercase tracking-widest text-muted-foreground text-right">GST</TableHead>
                      <TableHead className="text-xs uppercase tracking-widest text-muted-foreground text-right">Grand Total</TableHead>
                      <TableHead className="text-xs uppercase tracking-widest text-muted-foreground text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((bill, i) => (
                      <TableRow key={bill.id} className="border-border hover:bg-secondary/20" data-testid={`all-bill-row-${i}`}>
                        <TableCell className="mono text-center font-bold text-primary">{bill.daily_serial || '-'}</TableCell>
                        <TableCell className="mono text-xs">{bill.bill_number}</TableCell>
                        <TableCell className="mono text-sm">{bill.created_at?.slice(0, 10)}</TableCell>
                        <TableCell className="font-medium">{bill.customer_name}</TableCell>
                        <TableCell className="mono text-sm">{bill.customer_phone}</TableCell>
                        <TableCell className="text-muted-foreground">{bill.executive_name}</TableCell>
                        <TableCell>
                          <div className="space-y-0.5">
                            {(bill.items || []).map((item, idx) => (
                              <div key={idx} className="text-xs">
                                <span className="font-medium">{item.item_name}</span>
                                <span className="text-muted-foreground"> {item.purity_name} {item.net_weight?.toFixed(2)}g</span>
                                <span className="mono text-primary ml-1">{formatCurrency(item.total_amount)}</span>
                              </div>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColor(bill.status)}`}>
                            {bill.status}
                          </span>
                        </TableCell>
                        <TableCell className="mono text-right text-sm">{formatCurrency(bill.subtotal_without_gst)}</TableCell>
                        <TableCell className="mono text-right text-sm text-muted-foreground">{formatCurrency(bill.gst_amount)}</TableCell>
                        <TableCell className="mono text-right font-bold text-primary">{formatCurrency(bill.grand_total)}</TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-1">
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => navigate(`/bill/${bill.id}`)} data-testid={`edit-bill-${i}`}>
                              <Edit size={13} />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => navigate(`/bill/${bill.id}/print`)}>
                              <Printer size={13} />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => setDeleteConfirm(bill.id)} data-testid={`delete-bill-all-${i}`}>
                              <Trash2 size={13} />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>Delete Bill?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">This action cannot be undone. The bill will be permanently removed.</p>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteBill(deleteConfirm)} data-testid="confirm-delete-bill-all">Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
