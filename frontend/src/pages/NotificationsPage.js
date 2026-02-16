import { useState, useEffect } from 'react';
import { apiClient } from '@/App';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell, Check, Clock, Cake, Heart, Phone, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const res = await apiClient.get('/notifications');
      setNotifications(res.data);
    } catch (err) { toast.error('Failed to load'); }
    finally { setLoading(false); }
  };

  const markDone = async (id) => {
    try {
      await apiClient.put(`/notifications/${id}/done`);
      toast.success('Marked as done');
      load();
    } catch (err) { toast.error('Failed'); }
  };

  const markPending = async (id) => {
    try {
      await apiClient.put(`/notifications/${id}/pending`);
      toast.success('Marked as pending');
      load();
    } catch (err) { toast.error('Failed'); }
  };

  const filtered = filter === 'all' ? notifications :
    filter === 'pending' ? notifications.filter(n => n.status === 'pending') :
    notifications.filter(n => n.status === 'done');

  const pendingCount = notifications.filter(n => n.status === 'pending').length;

  const typeIcon = (type) => {
    switch(type) {
      case 'birthday': return <Cake size={16} className="text-pink-400" />;
      case 'anniversary': return <Heart size={16} className="text-red-400" />;
      default: return <Bell size={16} className="text-primary" />;
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="heading text-2xl sm:text-3xl font-bold">Notifications</h1>
            <p className="text-sm text-muted-foreground mt-1">Customer reminders and tasks</p>
          </div>
          <Button variant="secondary" size="sm" onClick={load} data-testid="refresh-notifications"><RefreshCw size={14} className="mr-1" /> Refresh</Button>
        </div>

        <div className="flex gap-2">
          {[
            { key: 'all', label: `All (${notifications.length})` },
            { key: 'pending', label: `Pending (${pendingCount})` },
            { key: 'done', label: `Done (${notifications.length - pendingCount})` },
          ].map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${filter === f.key ? 'bg-primary/20 text-primary border border-primary/30' : 'bg-secondary/50 text-muted-foreground'}`} data-testid={`notif-filter-${f.key}`}>{f.label}</button>
          ))}
        </div>

        <Card className="bg-card border-border">
          <CardContent className="p-0">
            {loading ? <p className="text-muted-foreground text-center py-8">Loading...</p> :
              filtered.length === 0 ? <p className="text-muted-foreground text-center py-8">No notifications</p> :
                <div className="divide-y divide-border">
                  {filtered.map(n => (
                    <div key={n.id} className="p-4 flex items-start gap-3" data-testid={`notification-${n.id}`}>
                      <div className="mt-0.5">{typeIcon(n.type)}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{n.message}</p>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <span className="text-xs text-muted-foreground">{n.customer_phone}</span>
                          {n.tier && <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/20 text-primary">{n.tier}</span>}
                          <span className="text-xs text-muted-foreground">{n.due_date}</span>
                        </div>
                        {n.completed_by && <p className="text-xs text-muted-foreground mt-1">Done by {n.completed_by}</p>}
                      </div>
                      <div className="shrink-0">
                        {n.status === 'pending' ? (
                          <Button size="sm" variant="secondary" className="h-8" onClick={() => markDone(n.id)} data-testid={`mark-done-${n.id}`}>
                            <Check size={14} className="mr-1" /> Done
                          </Button>
                        ) : (
                          <Button size="sm" variant="ghost" className="h-8 text-muted-foreground" onClick={() => markPending(n.id)} data-testid={`mark-pending-${n.id}`}>
                            <Clock size={14} className="mr-1" /> Reopen
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
            }
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
