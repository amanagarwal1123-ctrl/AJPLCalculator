import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiClient } from '@/App';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { SkipForward, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function FeedbackPage() {
  const { billId } = useParams();
  const navigate = useNavigate();
  const [questions, setQuestions] = useState([]);
  const [ratings, setRatings] = useState({});
  const [additionalComments, setAdditionalComments] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [bill, setBill] = useState(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [qRes, bRes] = await Promise.all([
        apiClient.get('/feedback-questions'),
        apiClient.get(`/bills/${billId}`),
      ]);
      setQuestions(qRes.data);
      setBill(bRes.data);
    } catch (err) { console.error(err); }
  };

  const setRating = (qId, value) => setRatings(prev => ({ ...prev, [qId]: value }));

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const ratingsList = questions.map(q => ({
        question_id: q.id,
        question: q.question,
        rating: ratings[q.id] || 0,
      }));
      await apiClient.post(`/bills/${billId}/feedback`, {
        ratings: ratingsList,
        customer_name: bill?.customer_name || '',
        additional_comments: additionalComments,
      });
      toast.success('Thank you for your feedback!');
      navigate('/sales');
    } catch (err) { toast.error('Failed to submit feedback'); }
    finally { setSubmitting(false); }
  };

  const handleSkip = () => navigate('/sales');

  return (
    <div className="kintsugi-page min-h-screen flex items-center justify-center p-4">
      <div className="kintsugi-veins" />
      <Card className="relative z-10 w-full max-w-lg bg-card/95 backdrop-blur-sm border-border shadow-[var(--shadow-elev-2)]">
        <CardHeader className="text-center pb-3">
          <img src="/ajpl-logo.png" alt="AJPL" className="h-14 w-auto object-contain mx-auto mb-2" />
          <CardTitle className="heading text-2xl">Customer Feedback</CardTitle>
          {bill && <p className="text-sm text-muted-foreground mt-1">For {bill.customer_name}</p>}
          <p className="text-xs text-muted-foreground">Rate each question from 1 to 10</p>
        </CardHeader>
        <CardContent className="space-y-5">
          {questions.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-muted-foreground mb-4">No feedback questions configured</p>
              <Button onClick={handleSkip} data-testid="skip-feedback-btn">Continue</Button>
            </div>
          ) : (
            <>
              {questions.map((q, idx) => (
                <div key={q.id} className="space-y-2" data-testid={`feedback-q-${q.id}`}>
                  <p className="text-sm font-medium">{idx + 1}. {q.question}</p>
                  <div className="flex gap-1 flex-wrap">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                      <button
                        key={n}
                        onClick={() => setRating(q.id, n)}
                        className={`w-9 h-9 rounded-lg text-sm font-bold transition-all duration-150 ${
                          ratings[q.id] === n
                            ? 'bg-primary text-primary-foreground scale-110 shadow-lg'
                            : ratings[q.id] > n
                              ? 'bg-primary/30 text-primary'
                              : 'bg-secondary/50 text-muted-foreground hover:bg-secondary'
                        }`}
                        data-testid={`rating-${q.id}-${n}`}
                      >{n}</button>
                    ))}
                  </div>
                </div>
              ))}

              {/* Additional comments text box */}
              <div className="space-y-2 pt-2" data-testid="feedback-comments-section">
                <p className="text-sm font-medium">Any additional suggestions or feedback?</p>
                <Textarea
                  value={additionalComments}
                  onChange={e => setAdditionalComments(e.target.value)}
                  placeholder="Type your suggestions here... (optional)"
                  className="bg-secondary/50 min-h-[80px]"
                  data-testid="feedback-comments-input"
                />
              </div>

              <div className="flex gap-3 pt-3">
                <Button variant="secondary" className="flex-1 h-12" onClick={handleSkip} data-testid="skip-feedback-btn">
                  <SkipForward size={16} className="mr-2" /> Skip
                </Button>
                <Button className="flex-1 h-12 text-base font-semibold" onClick={handleSubmit} disabled={submitting} data-testid="submit-feedback-btn">
                  <CheckCircle size={16} className="mr-2" /> {submitting ? 'Submitting...' : 'Submit'}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
