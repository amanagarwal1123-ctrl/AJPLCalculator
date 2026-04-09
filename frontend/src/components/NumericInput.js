import { useNumpad } from '@/context/NumpadContext';
import { Input } from '@/components/ui/input';
import { ChevronRight } from 'lucide-react';

export default function NumericInput({ value, onChange, label, className, ...props }) {
  const { openNumpad } = useNumpad();

  const handleClick = (e) => {
    e.preventDefault();
    e.target.blur();
    openNumpad(value, (newVal) => {
      if (onChange) {
        onChange({ target: { value: newVal } });
      }
    }, label || props.placeholder || props['data-testid'] || 'Enter value');
  };

  const hasValue = value != null && value !== '' && value !== 0 && value !== '0';

  return (
    <div className="relative">
      <Input
        {...props}
        type="text"
        inputMode="none"
        readOnly
        value={value ?? ''}
        onClick={handleClick}
        className={`cursor-pointer caret-transparent numpad-digits pr-8 ${hasValue ? 'text-foreground' : 'text-muted-foreground/50'} ${className || ''}`}
      />
      <ChevronRight size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-primary/40 pointer-events-none" />
    </div>
  );
}
