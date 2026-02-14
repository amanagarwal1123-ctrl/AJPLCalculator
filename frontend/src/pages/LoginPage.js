import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, apiClient } from '@/App';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Gem, ArrowLeft, KeyRound, User, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const [step, setStep] = useState('username'); // 'username' or 'otp'
  const [username, setUsername] = useState('');
  const [otp, setOtp] = useState(['', '', '', '']);
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
    // Only allow digits
    const digit = value.replace(/\D/g, '').slice(-1);
    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);

    // Auto-advance to next input
    if (digit && index < 3) {
      otpRefs[index + 1].current?.focus();
    }

    // Auto-submit when all 4 digits entered
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
      // Focus appropriate next field or auto-submit
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
      // Store token and set auth header
      localStorage.setItem('token', token);
      apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      toast.success(`Welcome, ${userData.full_name}!`);
      // Navigate based on role using React Router
      const dest = userData.role === 'admin' ? '/admin' : userData.role === 'manager' ? '/manager' : '/sales';
      navigate(dest);
      // Force reload to ensure auth context picks up the token
      window.location.reload();
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
            AJPL<br />
            <span className="text-primary">Calculator</span>
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
          <CardHeader className="text-center pb-2">
            <div className="lg:hidden inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 border-2 border-primary/30 mb-4 mx-auto">
              <Gem className="w-7 h-7 text-primary" />
            </div>

            {step === 'username' ? (
              <>
                <CardTitle className="heading text-2xl font-bold">Welcome Back</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">Enter your username to receive an OTP</p>
              </>
            ) : (
              <>
                <CardTitle className="heading text-2xl font-bold">Enter OTP</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  A 4-digit code has been generated for <span className="text-primary font-medium">{username}</span>
                </p>
                <p className="text-xs text-muted-foreground mt-1">Ask your admin for the code</p>
              </>
            )}
          </CardHeader>
          <CardContent>
            {step === 'username' ? (
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
            ) : (
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
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
