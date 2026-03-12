import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/App';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Shield, Download, Upload, FileText, Clock, HardDrive, Eye, AlertTriangle, CheckCircle, Lock, RefreshCw, X } from 'lucide-react';
import { toast } from 'sonner';

export default function DataSafetyPage() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exportModal, setExportModal] = useState(null); // 'dat' | 'excel' | null
  const [importModal, setImportModal] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [exporting, setExporting] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importPassword, setImportPassword] = useState('');
  const [importMode, setImportMode] = useState('merge');
  const [importPreview, setImportPreview] = useState(null);
  const [importing, setImporting] = useState(false);
  const [previewing, setPreviewing] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      const res = await apiClient.get('/admin/backup/status');
      setStatus(res.data);
    } catch { toast.error('Failed to load backup status'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  const handleExportDat = async () => {
    if (password.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    if (password !== confirmPassword) { toast.error('Passwords do not match'); return; }
    setExporting(true);
    try {
      const res = await apiClient.post('/admin/backup/export', { password }, { responseType: 'blob' });
      const fname = res.headers['content-disposition']?.match(/filename="(.+)"/)?.[1] || 'backup.dat';
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a'); a.href = url; a.download = fname; a.click();
      URL.revokeObjectURL(url);
      toast.success('Encrypted backup exported');
      setExportModal(null); setPassword(''); setConfirmPassword('');
      loadStatus();
    } catch (e) { toast.error(e.response?.data?.detail || 'Export failed'); }
    finally { setExporting(false); }
  };

  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const res = await apiClient.post('/admin/backup/export-excel', {}, { responseType: 'blob' });
      const fname = res.headers['content-disposition']?.match(/filename="(.+)"/)?.[1] || 'snapshot.xlsx';
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a'); a.href = url; a.download = fname; a.click();
      URL.revokeObjectURL(url);
      toast.success('Excel snapshot exported');
      setExportModal(null);
      loadStatus();
    } catch (e) { toast.error(e.response?.data?.detail || 'Excel export failed'); }
    finally { setExporting(false); }
  };

  const handleDecodeInstructions = async () => {
    try {
      const res = await apiClient.get('/admin/backup/decode-instructions', { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a'); a.href = url; a.download = 'DECODE_INSTRUCTIONS.txt'; a.click();
      URL.revokeObjectURL(url);
    } catch { toast.error('Failed to download'); }
  };

  const handleImportPreview = async () => {
    if (!importFile) { toast.error('Select a .dat file'); return; }
    if (!importPassword) { toast.error('Enter the backup password'); return; }
    setPreviewing(true);
    try {
      const fd = new FormData();
      fd.append('file', importFile);
      fd.append('password', importPassword);
      fd.append('mode', importMode);
      const res = await apiClient.post('/admin/backup/import/preview', fd);
      setImportPreview(res.data);
    } catch (e) { toast.error(e.response?.data?.detail || 'Preview failed'); }
    finally { setPreviewing(false); }
  };

  const handleImportApply = async () => {
    if (!importFile || !importPassword) return;
    if (!window.confirm('This will modify your database. Are you sure?')) return;
    setImporting(true);
    try {
      const fd = new FormData();
      fd.append('file', importFile);
      fd.append('password', importPassword);
      fd.append('mode', importMode);
      const res = await apiClient.post('/admin/backup/import/apply', fd);
      toast.success('Import completed successfully');
      setImportModal(false); setImportFile(null); setImportPassword('');
      setImportPreview(null); setImportMode('merge');
      loadStatus();
    } catch (e) { toast.error(e.response?.data?.detail || 'Import failed'); }
    finally { setImporting(false); }
  };

  const resetImport = () => {
    setImportModal(false); setImportFile(null); setImportPassword('');
    setImportPreview(null); setImportMode('merge');
  };

  const fmtDate = (s) => {
    if (!s) return '—';
    try { return new Date(s).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }); } catch { return s; }
  };

  return (
    <AppLayout>
      <div className="space-y-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="heading text-2xl sm:text-3xl font-bold flex items-center gap-2"><Shield size={24} className="text-primary" /> Data Safety Backup</h1>
            <p className="text-muted-foreground mt-1 text-sm">Encrypted backups with disaster recovery support</p>
          </div>
          <Button variant="ghost" size="sm" onClick={loadStatus} data-testid="refresh-backup-status"><RefreshCw size={14} /></Button>
        </div>

        {/* Status Card */}
        <Card className="bg-card border-border shadow-[var(--shadow-elev-1)]" data-testid="backup-status-card">
          <CardHeader className="pb-3">
            <CardTitle className="heading text-lg flex items-center gap-2"><Clock size={16} className="text-primary" /> Backup Status</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <p className="text-muted-foreground text-sm">Loading...</p> : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Last Export</p>
                  <p className="text-sm font-medium mt-1" data-testid="last-export-time">{status?.last_export ? fmtDate(status.last_export.created_at) : 'Never'}</p>
                  {status?.last_export?.filename && <p className="text-xs text-muted-foreground mono mt-0.5">{status.last_export.filename}</p>}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Backup Period</p>
                  <p className="text-sm font-medium mt-1" data-testid="backup-period">{fmtDate(status?.period_start_ist)} — {fmtDate(status?.period_end_ist)}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Action Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card className="bg-card border-border shadow-[var(--shadow-elev-1)]">
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0"><Lock size={20} className="text-primary" /></div>
                <div className="flex-1">
                  <h3 className="font-semibold text-sm">Encrypted Backup (.dat)</h3>
                  <p className="text-xs text-muted-foreground mt-1">AES-256 encrypted with password protection. Full database snapshot.</p>
                  <Button size="sm" className="mt-3 h-8 text-xs" onClick={() => setExportModal('dat')} data-testid="export-dat-btn">
                    <Download size={12} className="mr-1" /> Export Secure Backup
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border shadow-[var(--shadow-elev-1)]">
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-[hsl(160,52%,46%)]/15 flex items-center justify-center flex-shrink-0"><FileText size={20} className="text-[hsl(160,52%,46%)]" /></div>
                <div className="flex-1">
                  <h3 className="font-semibold text-sm">Excel Snapshot (.xlsx)</h3>
                  <p className="text-xs text-muted-foreground mt-1">Human-readable spreadsheet. One sheet per collection.</p>
                  <Button size="sm" variant="secondary" className="mt-3 h-8 text-xs" onClick={() => setExportModal('excel')} data-testid="export-excel-btn">
                    <Download size={12} className="mr-1" /> Export Excel
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border shadow-[var(--shadow-elev-1)]">
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-[hsl(196,70%,52%)]/15 flex items-center justify-center flex-shrink-0"><Upload size={20} className="text-[hsl(196,70%,52%)]" /></div>
                <div className="flex-1">
                  <h3 className="font-semibold text-sm">Import Backup (.dat)</h3>
                  <p className="text-xs text-muted-foreground mt-1">Restore from encrypted backup. Preview before applying.</p>
                  <Button size="sm" variant="secondary" className="mt-3 h-8 text-xs" onClick={() => setImportModal(true)} data-testid="import-dat-btn">
                    <Upload size={12} className="mr-1" /> Import Backup
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border shadow-[var(--shadow-elev-1)]">
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-[hsl(270,35%,66%)]/15 flex items-center justify-center flex-shrink-0"><HardDrive size={20} className="text-[hsl(270,35%,66%)]" /></div>
                <div className="flex-1">
                  <h3 className="font-semibold text-sm">Decode Instructions</h3>
                  <p className="text-xs text-muted-foreground mt-1">Disaster recovery guide. Python script to decrypt without app.</p>
                  <Button size="sm" variant="secondary" className="mt-3 h-8 text-xs" onClick={handleDecodeInstructions} data-testid="decode-instructions-btn">
                    <Download size={12} className="mr-1" /> Download Instructions
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Daily Workflow */}
        <Card className="bg-card border-primary/20 shadow-[var(--shadow-elev-1)]">
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              <AlertTriangle size={18} className="text-primary mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-sm">Daily Backup Workflow</h3>
                <p className="text-xs text-muted-foreground mt-1">At night, click <strong>Export Secure Backup</strong>, save the .dat file in a local folder, and keep the password written separately. This ensures full recovery even if the server goes down.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Export Modal */}
      {exportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" data-testid="export-modal">
          <Card className="bg-card border-border w-full max-w-md shadow-xl">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="heading text-lg">{exportModal === 'dat' ? 'Export Encrypted Backup' : 'Export Excel Snapshot'}</CardTitle>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => { setExportModal(null); setPassword(''); setConfirmPassword(''); }}><X size={14} /></Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {exportModal === 'dat' ? (
                <>
                  <div>
                    <Label className="text-xs">Encryption Password</Label>
                    <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Min 6 characters" className="mt-1" data-testid="export-password" />
                  </div>
                  <div>
                    <Label className="text-xs">Confirm Password</Label>
                    <Input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Re-enter password" className="mt-1" data-testid="export-confirm-password" />
                  </div>
                  {password && confirmPassword && password !== confirmPassword && (
                    <p className="text-xs text-destructive">Passwords do not match</p>
                  )}
                  <Button className="w-full" onClick={handleExportDat} disabled={exporting || password.length < 6 || password !== confirmPassword} data-testid="confirm-export-dat">
                    {exporting ? 'Encrypting & Exporting...' : 'Export Secure Backup'}
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">Export a human-readable Excel snapshot with all business data. No encryption — handle with care.</p>
                  <Button className="w-full" onClick={handleExportExcel} disabled={exporting} data-testid="confirm-export-excel">
                    {exporting ? 'Exporting...' : 'Export Excel Snapshot'}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Import Modal */}
      {importModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" data-testid="import-modal">
          <Card className="bg-card border-border w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="heading text-lg">Import Secure Backup</CardTitle>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={resetImport}><X size={14} /></Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-xs">Backup File (.dat)</Label>
                <Input type="file" accept=".dat" onChange={e => { setImportFile(e.target.files?.[0] || null); setImportPreview(null); }} className="mt-1" data-testid="import-file" />
              </div>
              <div>
                <Label className="text-xs">Backup Password</Label>
                <Input type="password" value={importPassword} onChange={e => setImportPassword(e.target.value)} placeholder="Password used during export" className="mt-1" data-testid="import-password" />
              </div>
              <div>
                <Label className="text-xs">Import Mode</Label>
                <div className="flex gap-2 mt-1">
                  <button className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${importMode === 'merge' ? 'bg-primary/15 border-primary/30 text-primary' : 'bg-secondary/30 border-border text-muted-foreground'}`} onClick={() => { setImportMode('merge'); setImportPreview(null); }} data-testid="import-mode-merge">
                    Merge (Upsert)
                  </button>
                  <button className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${importMode === 'replace_current_year_data' ? 'bg-primary/15 border-primary/30 text-primary' : 'bg-secondary/30 border-border text-muted-foreground'}`} onClick={() => { setImportMode('replace_current_year_data'); setImportPreview(null); }} data-testid="import-mode-replace">
                    Replace Year Data
                  </button>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  {importMode === 'merge' ? 'Upserts records by ID. Existing records updated, new ones added.' : 'Removes current-year transactions, loads from backup. Master data is merged.'}
                </p>
              </div>

              {!importPreview && (
                <Button className="w-full" variant="secondary" onClick={handleImportPreview} disabled={previewing || !importFile || !importPassword} data-testid="import-preview-btn">
                  <Eye size={12} className="mr-1" /> {previewing ? 'Analyzing...' : 'Preview Changes (Dry Run)'}
                </Button>
              )}

              {importPreview && (
                <div className="space-y-3" data-testid="import-preview-results">
                  <div className="flex items-center gap-2">
                    <CheckCircle size={14} className="text-[hsl(160,52%,46%)]" />
                    <p className="text-sm font-medium">Dry Run Preview — Mode: {importPreview.mode}</p>
                  </div>
                  <div className="rounded-lg border border-border overflow-hidden">
                    <table className="w-full text-xs">
                      <thead><tr className="bg-secondary/30"><th className="px-3 py-2 text-left">Collection</th><th className="px-2 py-2 text-right">Insert</th><th className="px-2 py-2 text-right">Update</th><th className="px-2 py-2 text-right">Delete</th></tr></thead>
                      <tbody>
                        {Object.entries(importPreview.collections).map(([col, counts]) => (
                          <tr key={col} className="border-t border-border">
                            <td className="px-3 py-1.5 font-medium">{col}</td>
                            <td className="px-2 py-1.5 text-right text-[hsl(160,52%,46%)]">{counts.insert > 0 ? `+${counts.insert}` : '—'}</td>
                            <td className="px-2 py-1.5 text-right text-[hsl(196,70%,52%)]">{counts.update > 0 ? counts.update : '—'}</td>
                            <td className="px-2 py-1.5 text-right text-destructive">{counts.delete > 0 ? `-${counts.delete}` : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex gap-2">
                    <Button className="flex-1" onClick={handleImportApply} disabled={importing} data-testid="import-apply-btn">
                      {importing ? 'Applying...' : 'Apply Import'}
                    </Button>
                    <Button variant="secondary" onClick={() => setImportPreview(null)}>Cancel</Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </AppLayout>
  );
}
