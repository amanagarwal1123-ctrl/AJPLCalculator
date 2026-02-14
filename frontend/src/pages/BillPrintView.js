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

  if (!bill) return <div className="kintsugi-page flex items-center justify-center min-h-screen"><div className="kintsugi-veins" /><p className="relative z-10 heading text-xl text-primary">Loading...</p></div>;

  return (
    <div>
      {/* Action bar - no print */}
      <div className="no-print bg-card border-b border-border p-4 flex items-center justify-between sticky top-0 z-50">
        <Button variant="ghost" onClick={() => navigate(`/bill/${billId}`)}><ArrowLeft size={18} className="mr-2" /> Back</Button>
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
            </div>
          </div>

          {/* Items Table */}
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Item</th>
                <th>KT</th>
                <th>Net Wt (g)</th>
                <th style={{ textAlign: 'right' }}>Rate/10g</th>
                <th style={{ textAlign: 'right' }}>Gold Value</th>
                <th style={{ textAlign: 'right' }}>Making</th>
                <th style={{ textAlign: 'right' }}>Stone</th>
                {bill.items?.some(i => i.item_type === 'diamond') && <th style={{ textAlign: 'right' }}>Studded</th>}
                <th style={{ textAlign: 'right' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {bill.items?.map((item, idx) => (
                <tr key={idx}>
                  <td>{idx + 1}</td>
                  <td>{item.item_name}</td>
                  <td>{item.purity_name}</td>
                  <td style={{ fontFamily: 'IBM Plex Mono, monospace' }}>{item.net_weight?.toFixed(3)}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'IBM Plex Mono, monospace' }}>{formatCurrency(item.rate_per_10g)}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'IBM Plex Mono, monospace' }}>{formatCurrency(item.gold_value)}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'IBM Plex Mono, monospace' }}>{formatCurrency(item.total_making)}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'IBM Plex Mono, monospace' }}>{formatCurrency(item.total_stone)}</td>
                  {bill.items?.some(i => i.item_type === 'diamond') && <td style={{ textAlign: 'right', fontFamily: 'IBM Plex Mono, monospace' }}>{formatCurrency(item.total_studded || 0)}</td>}
                  <td style={{ textAlign: 'right', fontFamily: 'IBM Plex Mono, monospace', fontWeight: 700 }}>{formatCurrency(item.total_amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div className="mt-6" style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <div style={{ minWidth: '350px' }}>
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
