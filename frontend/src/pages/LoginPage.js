import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, apiClient } from '@/App';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { ArrowLeft, KeyRound, User, Loader2, ShieldCheck, Lock } from 'lucide-react';

export default function LoginPage() {
  const [step, setStep] = useState('username'); // 'username', 'otp', 'admin-password'
  const [username, setUsername] = useState('');
  const [otp, setOtp] = useState(['', '', '', '']);
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const otpRefs = [useRef(null), useRef(null), useRef(null), useRef(null)];

  // Focus first OTP input when step changes
  useEffect(() => {
    if (step === 'otp' && otpRefs[0].current) {
      setTimeout(() => otpRefs[0].current?.focus(), 100);
    }
  }, [step]);

  const handleRequestOtp = async (e) => {
    e.preventDefault();
    if (!username.trim()) {
      toast.error('Please enter your username');
      return;
    }
    setLoading(true);
    try {
      await apiClient.post('/auth/request-otp', { username: username.trim() });
      toast.success('OTP sent! Ask your admin for the code.');
      setStep('otp');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index, value) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);

    if (digit && index < 3) {
      otpRefs[index + 1].current?.focus();
    }

    if (digit && index === 3) {
      const fullOtp = newOtp.join('');
      if (fullOtp.length === 4) {
        handleVerifyOtp(fullOtp);
      }
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs[index - 1].current?.focus();
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4);
    if (pasted.length > 0) {
      const newOtp = [...otp];
      for (let i = 0; i < pasted.length && i < 4; i++) {
        newOtp[i] = pasted[i];
      }
      setOtp(newOtp);
      if (pasted.length >= 4) {
        handleVerifyOtp(newOtp.join(''));
      } else {
        otpRefs[Math.min(pasted.length, 3)].current?.focus();
      }
    }
  };

  const handleVerifyOtp = async (otpCode) => {
    if (!otpCode || otpCode.length !== 4) {
      toast.error('Please enter the 4-digit OTP');
      return;
    }
    setLoading(true);
    try {
      const res = await apiClient.post('/auth/verify-otp', {
        username: username.trim(),
        otp: otpCode,
      });
      const { token, user: userData } = res.data;
      localStorage.setItem('token', token);
      apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      const dest = userData.role === 'admin' ? '/admin' : userData.role === 'manager' ? '/manager' : '/sales';
      window.location.href = dest;
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Invalid OTP');
      setOtp(['', '', '', '']);
      otpRefs[0].current?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitOtp = (e) => {
    e.preventDefault();
    handleVerifyOtp(otp.join(''));
  };

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    if (!adminUsername.trim() || !adminPassword) {
      toast.error('Please enter username and password');
      return;
    }
    setLoading(true);
    try {
      const res = await apiClient.post('/auth/login', {
        username: adminUsername.trim(),
        password: adminPassword,
      });
      const { token, user: userData } = res.data;
      if (userData.role !== 'admin') {
        toast.error('This login is for admin only. Please use OTP login.');
        return;
      }
      localStorage.setItem('token', token);
      apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      window.location.href = '/admin';
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  // Render the card content based on current step
  const renderContent = () => {
    if (step === 'admin-password') {
      return (
        <>
          <CardHeader className="text-center pb-2">
            <div className="lg:hidden inline-flex items-center justify-center mb-4 mx-auto">
              <img src="/ajpl-logo.png" alt="AJPL" className="h-14 w-auto object-contain" />
            </div>
            <CardTitle className="heading text-2xl font-bold">Admin Login</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">Sign in with admin credentials</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="admin-username">Username</Label>
                <div className="relative">
                  <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="admin-username"
                    type="text"
                    placeholder="Admin username"
                    value={adminUsername}
                    onChange={e => setAdminUsername(e.target.value)}
                    className="h-12 pl-10 bg-secondary/50 text-base"
                    data-testid="admin-username-input"
                    autoComplete="username"
                    autoFocus
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin-password">Password</Label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="admin-password"
                    type="password"
                    placeholder="Admin password"
                    value={adminPassword}
                    onChange={e => setAdminPassword(e.target.value)}
                    className="h-12 pl-10 bg-secondary/50 text-base"
                    data-testid="admin-password-input"
                    autoComplete="current-password"
                  />
                </div>
              </div>
              <Button
                type="submit"
                className="w-full h-12 text-base font-semibold rounded-xl"
                disabled={loading}
                data-testid="admin-login-button"
              >
                {loading ? (
                  <><Loader2 size={18} className="mr-2 animate-spin" /> Signing in...</>
                ) : (
                  <><ShieldCheck size={18} className="mr-2" /> Sign In as Admin</>
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => setStep('username')}
                data-testid="back-to-otp-login"
              >
                <ArrowLeft size={16} className="mr-2" /> Back to OTP Login
              </Button>
            </form>
          </CardContent>
        </>
      );
    }

    if (step === 'otp') {
      return (
        <>
          <CardHeader className="text-center pb-2">
            <div className="lg:hidden inline-flex items-center justify-center mb-4 mx-auto">
              <img src="/ajpl-logo.png" alt="AJPL" className="h-14 w-auto object-contain" />
            </div>
            <CardTitle className="heading text-2xl font-bold">Enter OTP</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              A 4-digit code has been generated for <span className="text-primary font-medium">{username}</span>
            </p>
            <p className="text-xs text-muted-foreground mt-1">Ask your admin for the code</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmitOtp} className="space-y-5">
              <div className="space-y-3">
                <Label className="text-center block">Enter 4-digit OTP</Label>
                <div className="flex justify-center gap-3" onPaste={handleOtpPaste}>
                  {otp.map((digit, i) => (
                    <Input
                      key={i}
                      ref={otpRefs[i]}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={e => handleOtpChange(i, e.target.value)}
                      onKeyDown={e => handleOtpKeyDown(i, e)}
                      className="w-14 h-14 text-center text-2xl mono font-bold bg-secondary/50 rounded-xl"
                      data-testid={`otp-input-${i}`}
                    />
                  ))}
                </div>
              </div>
              <Button
                type="submit"
                className="w-full h-12 text-base font-semibold rounded-xl"
                disabled={loading || otp.join('').length !== 4}
                data-testid="verify-otp-button"
              >
                {loading ? (
                  <><Loader2 size={18} className="mr-2 animate-spin" /> Verifying...</>
                ) : (
                  'Verify & Sign In'
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => { setStep('username'); setOtp(['', '', '', '']); }}
                data-testid="back-to-username-button"
              >
                <ArrowLeft size={16} className="mr-2" /> Change Username
              </Button>
            </form>
          </CardContent>
        </>
      );
    }

    // Default: username step
    return (
      <>
        <CardHeader className="text-center pb-2">
          <div className="lg:hidden inline-flex items-center justify-center mb-4 mx-auto">
            <img src="/ajpl-logo.png" alt="AJPL" className="h-14 w-auto object-contain" />
          </div>
          <CardTitle className="heading text-2xl font-bold">Welcome Back</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">Enter your username to receive an OTP</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleRequestOtp} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <div className="relative">
                <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="username"
                  type="text"
                  placeholder="Enter your username"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  className="h-12 pl-10 bg-secondary/50 text-base"
                  data-testid="login-username-input"
                  autoComplete="username"
                  autoFocus
                />
              </div>
            </div>
            <Button
              type="submit"
              className="w-full h-12 text-base font-semibold rounded-xl"
              disabled={loading}
              data-testid="request-otp-button"
            >
              {loading ? (
                <><Loader2 size={18} className="mr-2 animate-spin" /> Sending...</>
              ) : (
                <><KeyRound size={18} className="mr-2" /> Get OTP</>
              )}
            </Button>
          </form>

          {/* Admin Login Link */}
          <div className="mt-6 pt-4 border-t border-border">
            <button
              type="button"
              onClick={() => setStep('admin-password')}
              className="w-full flex items-center justify-center gap-2 text-xs text-muted-foreground hover:text-primary transition-colors duration-200 py-2"
              data-testid="admin-login-link"
            >
              <ShieldCheck size={14} />
              <span>Admin Login</span>
            </button>
          </div>
        </CardContent>
      </>
    );
  };

  return (
    <div className="kintsugi-page min-h-screen flex">
      <div className="kintsugi-veins" />
      {/* Left brand panel - desktop only */}
      <div className="hidden lg:flex lg:w-1/2 relative items-center justify-center">
        <div className="relative z-10 text-center px-12">
          <img src="/ajpl-logo.png" alt="AJPL by Yash" className="h-36 w-auto object-contain mx-auto mb-6" />
          <h1 className="heading text-4xl font-bold text-foreground tracking-tight mb-4">
            <span className="text-primary">AJPL Calculator</span>
          </h1>
          <p className="text-muted-foreground text-lg max-w-md mx-auto leading-relaxed">
            Premium sales management for distinguished jewellery showrooms. Track, calculate, and analyse with elegance.
          </p>
          <div className="mt-8 flex justify-center gap-4">
            <div className="px-4 py-2 rounded-full bg-primary/10 border border-primary/20">
              <span className="text-primary text-sm font-medium">Multi-Branch</span>
            </div>
            <div className="px-4 py-2 rounded-full bg-primary/10 border border-primary/20">
              <span className="text-primary text-sm font-medium">Real-time Calc</span>
            </div>
            <div className="px-4 py-2 rounded-full bg-primary/10 border border-primary/20">
              <span className="text-primary text-sm font-medium">Secure OTP</span>
            </div>
          </div>
        </div>
      </div>
      {/* Right login panel */}
      <div className="flex-1 flex items-center justify-center px-4 py-12 relative z-10">
        <Card className="w-full max-w-md bg-card/90 backdrop-blur-sm border-border shadow-[var(--shadow-elev-2)]">
          <div className="h-[2px] bg-primary rounded-t-lg" />
          {renderContent()}
        </Card>
      </div>
    </div>
  );
}
