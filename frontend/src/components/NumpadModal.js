import { useNumpad } from '@/context/NumpadContext';
import { Delete, CornerDownLeft, X } from 'lucide-react';

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

  const backspace = () => {
    setValue(prev => prev.slice(0, -1));
  };

  const clear = () => setValue('');

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'backspace'];

  return (
    <div className="fixed inset-0 z-[300] flex flex-col justify-end" data-testid="numpad-modal">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeNumpad} />

      {/* Numpad Panel */}
      <div className="relative bg-[hsl(224,50%,14%)] border-t-2 border-primary/40 rounded-t-2xl shadow-[0_-8px_40px_rgba(0,0,0,0.6)] animate-in slide-in-from-bottom duration-200">
        {/* Header with label and close */}
        <div className="flex items-center justify-between px-4 pt-3 pb-1">
          <span className="text-xs uppercase tracking-widest text-muted-foreground font-medium">{label}</span>
          <button onClick={closeNumpad} className="p-1.5 rounded-lg hover:bg-secondary/50 text-muted-foreground" data-testid="numpad-close">
            <X size={18} />
          </button>
        </div>

        {/* Value Display */}
        <div className="mx-4 mb-3 px-4 py-3 rounded-xl bg-[hsl(224,50%,10%)] border border-border/60 min-h-[56px] flex items-center justify-between" data-testid="numpad-display">
          <span className="numpad-digits text-3xl font-bold text-foreground tracking-wider flex-1 text-right overflow-hidden">
            {value || <span className="text-muted-foreground/40">0</span>}
          </span>
          {value && (
            <button onClick={clear} className="ml-3 text-muted-foreground hover:text-foreground p-1" data-testid="numpad-clear">
              <X size={14} />
            </button>
          )}
        </div>

        {/* Number Grid */}
        <div className="grid grid-cols-3 gap-[1px] bg-border/20 mx-2 rounded-xl overflow-hidden mb-2">
          {keys.map((key) => (
            <button
              key={key}
              onClick={() => key === 'backspace' ? backspace() : press(key)}
              className="h-16 flex items-center justify-center bg-[hsl(224,45%,18%)] active:bg-[hsl(224,45%,25%)] transition-colors select-none"
              data-testid={`numpad-key-${key}`}
            >
              {key === 'backspace' ? (
                <Delete size={24} className="text-muted-foreground" />
              ) : (
                <span className="numpad-digits text-2xl font-semibold text-foreground">{key}</span>
              )}
            </button>
          ))}
        </div>

        {/* Enter/Done Button */}
        <div className="px-2 pb-3" style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
          <button
            onClick={confirm}
            className="w-full h-14 rounded-xl bg-primary text-primary-foreground font-bold text-lg flex items-center justify-center gap-2 active:bg-primary/80 transition-colors"
            data-testid="numpad-enter"
          >
            <CornerDownLeft size={20} /> Done
          </button>
        </div>
      </div>
    </div>
  );
}
