import { useNumpad } from '@/context/NumpadContext';
import { Delete, Check, X } from 'lucide-react';

export default function NumpadModal() {
  const { isOpen, value, setValue, label, closeNumpad, confirm } = useNumpad();

  if (!isOpen) return null;

  const press = (digit) => {
    setValue(prev => {
      if (digit === '.' && prev.includes('.')) return prev;
      if (digit === '0' && prev === '0') return prev;
      return prev + digit;
    });
  };

  const backspace = () => setValue(prev => prev.slice(0, -1));
  const clear = () => setValue('');

  const numKeys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

  return (
    <div className="fixed inset-0 z-[300] flex items-end justify-center" data-testid="numpad-modal">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={closeNumpad} />

      {/* Numpad Panel — centered, max-width for large tablets */}
      <div className="relative w-full max-w-xl bg-[hsl(224,48%,12%)] border-t-2 border-primary/50 rounded-t-3xl shadow-[0_-12px_60px_rgba(0,0,0,0.7)]"
        style={{ animation: 'slideUp 0.2s ease-out' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-1">
          <span className="text-[11px] uppercase tracking-[0.2em] text-primary/70 font-semibold">{label}</span>
          <button
            onClick={closeNumpad}
            className="w-9 h-9 rounded-full flex items-center justify-center bg-white/5 hover:bg-white/10 text-muted-foreground transition-colors"
            data-testid="numpad-close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Value Display */}
        <div className="mx-4 mb-4 px-5 py-4 rounded-2xl bg-[hsl(224,55%,8%)] border border-primary/20 min-h-[68px] flex items-center justify-between"
          data-testid="numpad-display">
          <span className="numpad-digits text-4xl font-bold text-foreground tracking-wide flex-1 text-right overflow-hidden leading-tight">
            {value || <span className="text-muted-foreground/30">0</span>}
          </span>
          {value && (
            <button
              onClick={clear}
              className="ml-4 w-8 h-8 rounded-full flex items-center justify-center bg-white/5 hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
              data-testid="numpad-clear"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Number Grid — 3 cols, larger buttons */}
        <div className="px-3 pb-2">
          {/* Row 1-3: digits */}
          <div className="grid grid-cols-3 gap-2 mb-2">
            {numKeys.map((key) => (
              <button
                key={key}
                onClick={() => press(key)}
                className="h-[72px] rounded-2xl flex items-center justify-center bg-[hsl(224,40%,20%)] hover:bg-[hsl(224,40%,24%)] active:scale-95 active:bg-[hsl(224,40%,28%)] transition-all duration-100 select-none border border-white/[0.04]"
                data-testid={`numpad-key-${key}`}
              >
                <span className="numpad-digits text-[28px] font-semibold text-foreground">{key}</span>
              </button>
            ))}
          </div>

          {/* Bottom Row: dot, 0, backspace */}
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => press('.')}
              className="h-[72px] rounded-2xl flex items-center justify-center bg-[hsl(224,40%,20%)] hover:bg-[hsl(224,40%,24%)] active:scale-95 active:bg-[hsl(224,40%,28%)] transition-all duration-100 select-none border border-white/[0.04]"
              data-testid="numpad-key-."
            >
              <span className="numpad-digits text-[32px] font-bold text-primary">.</span>
            </button>
            <button
              onClick={() => press('0')}
              className="h-[72px] rounded-2xl flex items-center justify-center bg-[hsl(224,40%,20%)] hover:bg-[hsl(224,40%,24%)] active:scale-95 active:bg-[hsl(224,40%,28%)] transition-all duration-100 select-none border border-white/[0.04]"
              data-testid="numpad-key-0"
            >
              <span className="numpad-digits text-[28px] font-semibold text-foreground">0</span>
            </button>
            <button
              onClick={backspace}
              className="h-[72px] rounded-2xl flex items-center justify-center bg-[hsl(224,35%,18%)] hover:bg-destructive/20 active:scale-95 active:bg-destructive/30 transition-all duration-100 select-none border border-white/[0.04]"
              data-testid="numpad-key-backspace"
            >
              <Delete size={28} className="text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Done Button */}
        <div className="px-3 pt-2 pb-4" style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}>
          <button
            onClick={confirm}
            className="w-full h-[60px] rounded-2xl bg-primary text-primary-foreground font-bold text-xl flex items-center justify-center gap-3 active:scale-[0.98] active:bg-primary/85 transition-all duration-100 shadow-lg shadow-primary/20"
            data-testid="numpad-enter"
          >
            <Check size={24} strokeWidth={3} /> Done
          </button>
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
