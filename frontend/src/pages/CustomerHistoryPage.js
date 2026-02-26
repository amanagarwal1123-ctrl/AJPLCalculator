import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiClient } from '@/App';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ArrowLeft, Eye, Trash2, Printer, Phone, MapPin, Calendar, ShoppingBag, Edit } from 'lucide-react';
import { toast } from 'sonner';

export default function CustomerHistoryPage() {
  const { customerId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  useEffect(() => { loadData(); }, [customerId]);

  const loadData = async () => {
    try {
      const res = await apiClient.get(`/customers/${customerId}/bills`);
      setData(res.data);
    } catch (err) {
      toast.error('Failed to load customer history');
    } finally {
      setLoading(false);
    }
  };

  const deleteBill = async (billId) => {
    try {
      await apiClient.delete(`/bills/${billId}`);
      toast.success('Bill deleted');
      setDeleteConfirm(null);
      loadData();
    } catch (err) {
      toast.error('Failed to delete bill');
    }
  };

  const formatCurrency = (val) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(val || 0);

  const statusColor = (s) => {
    switch(s) {
      case 'approved': return 'bg-[hsl(160,52%,46%)]/20 text-[hsl(160,52%,46%)]';
      case 'sent': return 'bg-[hsl(196,70%,52%)]/20 text-[hsl(196,70%,52%)]';
      case 'edited': return 'bg-[hsl(38,85%,55%)]/20 text-[hsl(38,85%,55%)]';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  if (loading) return <AppLayout><p className="text-center py-12 text-muted-foreground">Loading...</p></AppLayout>;
  if (!data) return <AppLayout><p className="text-center py-12 text-muted-foreground">Customer not found</p></AppLayout>;

  const { customer, bills } = data;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate('/admin/customers')} data-testid="back-to-customers">
              <ArrowLeft size={18} />
            </Button>
            <div>
              <h1 className="heading text-3xl font-bold" data-testid="customer-name">{customer.name}</h1>
              <p className="text-muted-foreground mt-1">Customer History & Bill Records</p>
            </div>
          </div>
          <Button variant="secondary" size="sm" onClick={() => navigate(`/customer/${customer.phone || customerId}`)} data-testid="edit-customer-details-btn">
            <Edit size={14} className="mr-1" /> Edit Details
          </Button>
        </div>

        {/* Customer Profile Card */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Phone size={14} className="text-muted-foreground" />
                <p className="text-xs uppercase tracking-widest text-muted-foreground">Phone</p>
              </div>
              <p className="mono text-sm font-medium" data-testid="customer-phone">{customer.phone}</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <MapPin size={14} className="text-muted-foreground" />
                <p className="text-xs uppercase tracking-widest text-muted-foreground">Location</p>
              </div>
              <p className="text-sm font-medium">{customer.location || '-'}</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Total Visits</p>
              <p className="mono text-2xl font-bold text-[hsl(196,70%,52%)]" data-testid="customer-visits">{customer.total_visits || bills.length}</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Total Spent</p>
              <p className="mono text-xl font-bold text-primary" data-testid="customer-spent">{formatCurrency(data.total_spent)}</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Reference</p>
              <p className="text-sm font-medium">{customer.reference || '-'}</p>
            </CardContent>
          </Card>
        </div>

        {/* Bills History */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <ShoppingBag size={16} className="text-primary" />
              Bill History ({bills.length} bills)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {bills.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No bills found for this customer</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border">
                      <TableHead className="text-xs uppercase tracking-widest text-muted-foreground">Bill #</TableHead>
                      <TableHead className="text-xs uppercase tracking-widest text-muted-foreground">Date</TableHead>
                      <TableHead className="text-xs uppercase tracking-widest text-muted-foreground">Executive</TableHead>
                      <TableHead className="text-xs uppercase tracking-widest text-muted-foreground">Items</TableHead>
                      <TableHead className="text-xs uppercase tracking-widest text-muted-foreground">Status</TableHead>
                      <TableHead className="text-xs uppercase tracking-widest text-muted-foreground text-right">Grand Total</TableHead>
                      <TableHead className="text-xs uppercase tracking-widest text-muted-foreground text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bills.map((bill, i) => (
                      <TableRow key={bill.id} className="border-border" data-testid={`bill-row-${i}`}>
                        <TableCell className="mono text-xs">{bill.bill_number}</TableCell>
                        <TableCell className="mono text-sm">{bill.created_at?.slice(0, 10)}</TableCell>
                        <TableCell>{bill.executive_name}</TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {(bill.items || []).map((item, idx) => (
                              <div key={idx} className="text-xs">
                                <span className="font-medium">{item.item_name}</span>
                                <span className="text-muted-foreground"> ({item.purity_name}, {item.net_weight?.toFixed(3)}g)</span>
                              </div>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColor(bill.status)}`}>
                            {bill.status}
                          </span>
                        </TableCell>
                        <TableCell className="mono text-right font-bold text-primary">{formatCurrency(bill.grand_total)}</TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-1">
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => navigate(`/bill/${bill.id}`)} data-testid={`view-bill-${i}`}>
                              <Eye size={13} />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => navigate(`/bill/${bill.id}/print`)} data-testid={`print-bill-${i}`}>
                              <Printer size={13} />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => setDeleteConfirm(bill.id)} data-testid={`delete-bill-${i}`}>
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

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>Delete Bill?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">This action cannot be undone. The bill will be permanently removed.</p>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteBill(deleteConfirm)} data-testid="confirm-delete-bill">Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
