import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiClient } from '@/App';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Printer, Download } from 'lucide-react';
import { toast } from 'sonner';

export default function BillPrintView() {
  const { billId } = useParams();
  const navigate = useNavigate();
  const [bill, setBill] = useState(null);
  const printRef = useRef();

  useEffect(() => {
    apiClient.get(`/bills/${billId}`).then(res => setBill(res.data)).catch(() => toast.error('Failed to load bill'));
  }, [billId]);

  const handlePrint = () => window.print();

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
    } catch (err) {
      toast.error('Failed to generate PDF');
    }
  };

  const formatCurrency = (val) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(val || 0);

  const hasDiamond = bill?.items?.some(i => i.item_type === 'diamond');

  if (!bill) return <div className="kintsugi-page flex items-center justify-center min-h-screen"><div className="kintsugi-veins" /><p className="relative z-10 heading text-xl text-primary">Loading...</p></div>;

  return (
    <div>
      {/* Action bar - no print */}
      <div className="no-print bg-card border-b border-border p-4 flex items-center justify-between sticky top-0 z-50">
        <Button variant="ghost" onClick={() => navigate(`/bill/${billId}`)} data-testid="back-from-print"><ArrowLeft size={18} className="mr-2" /> Back</Button>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={handlePrint} data-testid="print-action-button"><Printer size={16} className="mr-2" /> Print</Button>
          <Button onClick={downloadPdf} data-testid="pdf-download-button"><Download size={16} className="mr-2" /> Download PDF</Button>
        </div>
      </div>

      {/* Print Sheet */}
      <div ref={printRef} className="print-sheet bill-print-view max-w-4xl mx-auto my-8 p-4">
        <div className="bill-border">
          {/* Header */}
          <div className="text-center mb-6">
            <h1 className="bill-header" style={{ fontFamily: 'Cormorant Garamond, serif' }}>AJPL JEWELLERY</h1>
            <p style={{ fontFamily: 'Cormorant Garamond, serif', letterSpacing: '0.15em', fontSize: '1rem', color: '#666', marginTop: '4px' }}>INVOICE</p>
            <div style={{ height: '2px', background: 'linear-gradient(90deg, transparent, #C5A55A, transparent)', margin: '12px auto', maxWidth: '300px' }} />
            <p className="text-sm" style={{ color: '#666' }}>Bill No: <strong>{bill.bill_number}</strong></p>
            <p className="text-sm" style={{ color: '#666' }}>Date: {bill.created_at?.slice(0, 10)}</p>
          </div>

          {/* Customer Info */}
          <div className="mb-6 p-4 rounded" style={{ background: '#f5f0e8' }}>
            <h3 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '1.1rem', fontWeight: 600, marginBottom: '8px', letterSpacing: '0.05em' }}>Customer Details</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div><strong>Name:</strong> {bill.customer_name}</div>
              <div><strong>Phone:</strong> {bill.customer_phone}</div>
              <div><strong>Location:</strong> {bill.customer_location || '-'}</div>
              <div><strong>Reference:</strong> {bill.customer_reference || '-'}</div>
              <div><strong>Executive:</strong> {bill.executive_name}</div>
              <div><strong>Status:</strong> {(bill.status || 'draft').toUpperCase()}</div>
            </div>
          </div>

          {/* Items Table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: '4%' }} />
                <col style={{ width: hasDiamond ? '12%' : '14%' }} />
                <col style={{ width: '5%' }} />
                <col style={{ width: '8%' }} />
                <col style={{ width: '7%' }} />
                <col style={{ width: '8%' }} />
                <col style={{ width: hasDiamond ? '11%' : '13%' }} />
                <col style={{ width: hasDiamond ? '11%' : '13%' }} />
                <col style={{ width: hasDiamond ? '9%' : '11%' }} />
                <col style={{ width: hasDiamond ? '8%' : '10%' }} />
                {hasDiamond && <col style={{ width: '8%' }} />}
                <col style={{ width: hasDiamond ? '9%' : '11%' }} />
              </colgroup>
              <thead>
                <tr style={{ background: '#f0ebe0' }}>
                  <th style={{ padding: '8px 3px', textAlign: 'left', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#666', borderBottom: '2px solid #C5A55A', fontWeight: 700 }}>#</th>
                  <th style={{ padding: '8px 3px', textAlign: 'left', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#666', borderBottom: '2px solid #C5A55A', fontWeight: 700 }}>Item</th>
                  <th style={{ padding: '8px 3px', textAlign: 'left', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#666', borderBottom: '2px solid #C5A55A', fontWeight: 700 }}>KT</th>
                  <th style={{ padding: '8px 3px', textAlign: 'right', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#666', borderBottom: '2px solid #C5A55A', fontWeight: 700 }}>Gross(g)</th>
                  <th style={{ padding: '8px 3px', textAlign: 'right', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#666', borderBottom: '2px solid #C5A55A', fontWeight: 700 }}>Less(g)</th>
                  <th style={{ padding: '8px 3px', textAlign: 'right', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#666', borderBottom: '2px solid #C5A55A', fontWeight: 700 }}>Net(g)</th>
                  <th style={{ padding: '8px 3px', textAlign: 'right', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#666', borderBottom: '2px solid #C5A55A', fontWeight: 700 }}>Rate/10g</th>
                  <th style={{ padding: '8px 3px', textAlign: 'right', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#666', borderBottom: '2px solid #C5A55A', fontWeight: 700 }}>Gold Val</th>
                  <th style={{ padding: '8px 3px', textAlign: 'right', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#666', borderBottom: '2px solid #C5A55A', fontWeight: 700 }}>Making</th>
                  <th style={{ padding: '8px 3px', textAlign: 'right', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#666', borderBottom: '2px solid #C5A55A', fontWeight: 700 }}>Stone</th>
                  {hasDiamond && <th style={{ padding: '8px 3px', textAlign: 'right', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#666', borderBottom: '2px solid #C5A55A', fontWeight: 700 }}>Studded</th>}
                  <th style={{ padding: '8px 3px', textAlign: 'right', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#666', borderBottom: '2px solid #C5A55A', fontWeight: 700 }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {bill.items?.map((item, idx) => (
                  <tr key={idx} style={{ background: idx % 2 === 1 ? '#faf8f3' : 'transparent' }}>
                    <td style={{ padding: '6px 3px', fontSize: '0.8rem', borderBottom: '1px solid #eee', color: '#666' }}>{idx + 1}</td>
                    <td style={{ padding: '6px 3px', fontSize: '0.8rem', borderBottom: '1px solid #eee', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.item_name}</td>
                    <td style={{ padding: '6px 3px', fontSize: '0.8rem', borderBottom: '1px solid #eee', color: '#8B6914', fontWeight: 600 }}>{item.purity_name}</td>
                    <td style={{ textAlign: 'right', padding: '6px 3px', fontSize: '0.8rem', borderBottom: '1px solid #eee', fontFamily: 'IBM Plex Mono, monospace', color: '#555' }}>{(item.gross_weight || 0).toFixed(3)}</td>
                    <td style={{ textAlign: 'right', padding: '6px 3px', fontSize: '0.8rem', borderBottom: '1px solid #eee', fontFamily: 'IBM Plex Mono, monospace', color: '#888' }}>{(item.less || 0).toFixed(3)}</td>
                    <td style={{ textAlign: 'right', padding: '6px 3px', fontSize: '0.8rem', borderBottom: '1px solid #eee', fontFamily: 'IBM Plex Mono, monospace', fontWeight: 600 }}>{(item.net_weight || 0).toFixed(3)}</td>
                    <td style={{ textAlign: 'right', padding: '6px 3px', fontSize: '0.8rem', borderBottom: '1px solid #eee', fontFamily: 'IBM Plex Mono, monospace' }}>{formatCurrency(item.rate_per_10g)}</td>
                    <td style={{ textAlign: 'right', padding: '6px 3px', fontSize: '0.8rem', borderBottom: '1px solid #eee', fontFamily: 'IBM Plex Mono, monospace' }}>{formatCurrency(item.gold_value)}</td>
                    <td style={{ textAlign: 'right', padding: '6px 3px', fontSize: '0.8rem', borderBottom: '1px solid #eee', fontFamily: 'IBM Plex Mono, monospace' }}>{formatCurrency(item.total_making)}</td>
                    <td style={{ textAlign: 'right', padding: '6px 3px', fontSize: '0.8rem', borderBottom: '1px solid #eee', fontFamily: 'IBM Plex Mono, monospace' }}>{formatCurrency(item.total_stone)}</td>
                    {hasDiamond && <td style={{ textAlign: 'right', padding: '6px 3px', fontSize: '0.8rem', borderBottom: '1px solid #eee', fontFamily: 'IBM Plex Mono, monospace' }}>{formatCurrency(item.total_studded || 0)}</td>}
                    <td style={{ textAlign: 'right', padding: '6px 3px', fontSize: '0.8rem', borderBottom: '1px solid #eee', fontFamily: 'IBM Plex Mono, monospace', fontWeight: 700 }}>{formatCurrency(item.total_amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Making Charge Note */}
          <div style={{ marginTop: '6px', fontSize: '0.7rem', color: '#999', fontStyle: 'italic' }}>
            * Making charges are calculated on net weight
            {bill.items?.some(i => i.studded_less_grams > 0) && (
              <span> | Net weight includes diamond weight deductions (L entries: 1 carat = 0.2g)</span>
            )}
          </div>

          {/* Totals */}
          <div className="mt-6" style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <div style={{ minWidth: '320px', maxWidth: '380px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '0.9rem' }}>
                <span>Items Total:</span>
                <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontWeight: 500 }}>{formatCurrency(bill.items_total)}</span>
              </div>
              {(bill.external_charges || []).map((ec, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '0.85rem', color: '#666' }}>
                  <span>{ec.name}:</span>
                  <span style={{ fontFamily: 'IBM Plex Mono, monospace' }}>{formatCurrency(ec.amount)}</span>
                </div>
              ))}
              {bill.external_charges_total > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '0.9rem' }}>
                  <span>External Charges:</span>
                  <span style={{ fontFamily: 'IBM Plex Mono, monospace' }}>{formatCurrency(bill.external_charges_total)}</span>
                </div>
              )}
              <div style={{ height: '1px', background: '#C5A55A', margin: '8px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '0.95rem', fontWeight: 600 }}>
                <span>Subtotal (without GST):</span>
                <span style={{ fontFamily: 'IBM Plex Mono, monospace' }}>{formatCurrency(bill.subtotal_without_gst)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '0.9rem', color: '#666' }}>
                <span>GST ({bill.gst_percent}%):</span>
                <span style={{ fontFamily: 'IBM Plex Mono, monospace' }}>{formatCurrency(bill.gst_amount)}</span>
              </div>
              <div style={{ height: '2px', background: '#C5A55A', margin: '8px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: '1.2rem', fontWeight: 700 }}>
                <span style={{ fontFamily: 'Cormorant Garamond, serif', letterSpacing: '0.05em' }}>GRAND TOTAL:</span>
                <span style={{ fontFamily: 'IBM Plex Mono, monospace' }}>{formatCurrency(bill.grand_total)}</span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-8 text-center" style={{ borderTop: '1px solid #e0d6c4', paddingTop: '12px' }}>
            <p style={{ fontFamily: 'Cormorant Garamond, serif', fontStyle: 'italic', color: '#888', fontSize: '0.9rem' }}>Thank you for your valuable patronage</p>
          </div>
        </div>
      </div>
    </div>
  );
}
