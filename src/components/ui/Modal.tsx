import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: string;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl';
  showCloseButton?: boolean;
}

const maxWidthMap = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '3xl': 'max-w-3xl',
  '4xl': 'max-w-4xl',
  '5xl': 'max-w-5xl',
};

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  maxWidth = 'md',
  showCloseButton = true,
}) => {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-[2px]"
    >
      <div
        className={`w-full ${maxWidthMap[maxWidth]} bg-surface border border-hairline-strong rounded-2xl shadow-[0_12px_36px_rgba(0,0,0,0.16)] dark:shadow-[0_16px_48px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col max-h-[90vh]`}
      >
        {(title || showCloseButton) && (
          <div className="px-6 py-4 border-b border-hairline flex items-center justify-between shrink-0">
            <div>
              {typeof title === 'string' ? (
                <h3 className="text-base font-medium text-ink">{title}</h3>
              ) : (
                title
              )}
              {subtitle && (
                <p className="text-xs text-ink-muted mt-0.5">{subtitle}</p>
              )}
            </div>
            {showCloseButton && (
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg text-ink-muted hover:text-ink hover:bg-raised transition-colors duration-150 ease-unslop cursor-pointer"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" strokeWidth={1.5} />
              </button>
            )}
          </div>
        )}

        <div className="p-6 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
};
