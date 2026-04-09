import { useNumpad } from '@/context/NumpadContext';
import { Input } from '@/components/ui/input';

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

  return (
    <Input
      {...props}
      type="text"
      inputMode="none"
      readOnly
      value={value ?? ''}
      onClick={handleClick}
      className={`cursor-pointer caret-transparent numpad-digits ${className || ''}`}
    />
  );
}
