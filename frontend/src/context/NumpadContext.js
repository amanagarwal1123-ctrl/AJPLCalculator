import { createContext, useContext, useState, useCallback } from 'react';

const NumpadContext = createContext(null);

export function NumpadProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false);
  const [value, setValue] = useState('');
  const [label, setLabel] = useState('');
  const [onConfirm, setOnConfirm] = useState(null);

  const openNumpad = useCallback((currentValue, callback, fieldLabel) => {
    setValue(currentValue != null && currentValue !== '' ? String(currentValue) : '');
    setOnConfirm(() => callback);
    setLabel(fieldLabel || 'Enter value');
    setIsOpen(true);
  }, []);

  const closeNumpad = useCallback(() => {
    setIsOpen(false);
    setOnConfirm(null);
  }, []);

  const confirm = useCallback(() => {
    if (onConfirm) onConfirm(value);
    closeNumpad();
  }, [onConfirm, value, closeNumpad]);

  return (
    <NumpadContext.Provider value={{ isOpen, value, setValue, label, openNumpad, closeNumpad, confirm }}>
      {children}
    </NumpadContext.Provider>
  );
}

export function useNumpad() {
  const ctx = useContext(NumpadContext);
  if (!ctx) throw new Error('useNumpad must be used within NumpadProvider');
  return ctx;
}
