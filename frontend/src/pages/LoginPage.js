import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/App';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Gem } from 'lucide-react';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      toast.error('Please enter username and password');
      return;
    }
    setLoading(true);
    try {
      const user = await login(username, password);
      toast.success(`Welcome, ${user.full_name}!`);
      switch (user.role) {
        case 'admin': navigate('/admin'); break;
        case 'manager': navigate('/manager'); break;
        case 'executive': navigate('/sales'); break;
        default: navigate('/');
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="kintsugi-page min-h-screen flex">
      <div className="kintsugi-veins" />
      {/* Left brand panel - desktop only */}
      <div className="hidden lg:flex lg:w-1/2 relative items-center justify-center">
        <div className="relative z-10 text-center px-12">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 border-2 border-primary/30 mb-6">
            <Gem className="w-10 h-10 text-primary" />
          </div>
          <h1 className="heading text-5xl font-bold text-foreground tracking-tight mb-4">
            Gold Jewellery<br />
            <span className="text-primary">Sales Suite</span>
          </h1>
          <p className="text-muted-foreground text-lg max-w-md mx-auto leading-relaxed">
            Premium sales management for distinguished jewellery showrooms. Track, calculate, and report with elegance.
          </p>
          <div className="mt-8 flex justify-center gap-4">
            <div className="px-4 py-2 rounded-full bg-primary/10 border border-primary/20">
              <span className="text-primary text-sm font-medium">Multi-Branch</span>
            </div>
            <div className="px-4 py-2 rounded-full bg-primary/10 border border-primary/20">
              <span className="text-primary text-sm font-medium">Real-time Calc</span>
            </div>
            <div className="px-4 py-2 rounded-full bg-primary/10 border border-primary/20">
              <span className="text-primary text-sm font-medium">Analytics</span>
            </div>
          </div>
        </div>
      </div>
      {/* Right login panel */}
      <div className="flex-1 flex items-center justify-center px-4 py-12 relative z-10">
        <Card className="w-full max-w-md bg-card/90 backdrop-blur-sm border-border shadow-[var(--shadow-elev-2)]">
          <div className="h-[2px] bg-primary rounded-t-lg" />
          <CardHeader className="text-center pb-2">
            <div className="lg:hidden inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 border-2 border-primary/30 mb-4 mx-auto">
              <Gem className="w-7 h-7 text-primary" />
            </div>
            <CardTitle className="heading text-2xl font-bold">Welcome Back</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">Sign in to your account</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="Enter your username"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  className="h-11 bg-secondary/50"
                  data-testid="login-username-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="h-11 bg-secondary/50"
                  data-testid="login-password-input"
                />
              </div>
              <Button
                type="submit"
                className="w-full h-11 text-base font-semibold rounded-xl"
                disabled={loading}
                data-testid="login-submit-button"
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
