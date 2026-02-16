import { useState, useEffect } from 'react';
import { apiClient } from '@/App';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Trash2, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';

export default function FeedbackQuestionsManagement() {
  const [questions, setQuestions] = useState([]);
  const [newQ, setNewQ] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const res = await apiClient.get('/feedback-questions');
      setQuestions(res.data);
    } catch (err) { toast.error('Failed to load'); }
    finally { setLoading(false); }
  };

  const add = async () => {
    if (!newQ.trim()) { toast.error('Enter a question'); return; }
    try {
      await apiClient.post('/feedback-questions', { question: newQ.trim() });
      setNewQ('');
      toast.success('Question added');
      load();
    } catch (err) { toast.error('Failed'); }
  };

  const remove = async (id) => {
    if (!window.confirm('Remove this question?')) return;
    try {
      await apiClient.delete(`/feedback-questions/${id}`);
      toast.success('Removed');
      load();
    } catch (err) { toast.error('Failed'); }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="heading text-2xl sm:text-3xl font-bold">Feedback Questions</h1>
          <p className="text-sm text-muted-foreground mt-1">Questions shown to customers after billing</p>
        </div>
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Add Question</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              <Input placeholder="e.g., How was our service?" value={newQ} onChange={e => setNewQ(e.target.value)} className="h-11 bg-secondary/50 flex-1" data-testid="feedback-question-input" onKeyDown={e => e.key === 'Enter' && add()} />
              <Button onClick={add} className="h-11 px-6" data-testid="add-question-btn"><Plus size={16} className="mr-1" /> Add</Button>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Active Questions ({questions.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <p className="text-muted-foreground py-4 text-center">Loading...</p> :
              questions.length === 0 ? <p className="text-muted-foreground py-4 text-center">No questions added yet</p> :
                <div className="space-y-2">
                  {questions.map((q, idx) => (
                    <div key={q.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/20 border border-border" data-testid={`question-${q.id}`}>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground mono w-6">{idx + 1}.</span>
                        <MessageSquare size={14} className="text-primary" />
                        <span className="text-sm">{q.question}</span>
                      </div>
                      <Button variant="ghost" size="sm" className="text-destructive h-8 w-8 p-0" onClick={() => remove(q.id)} data-testid={`delete-q-${q.id}`}>
                        <Trash2 size={14} />
                      </Button>
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
