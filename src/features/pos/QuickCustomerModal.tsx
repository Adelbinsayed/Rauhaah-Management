import React, { useState } from 'react';
import { X, UserPlus, Phone, User as UserIcon, FileText } from 'lucide-react';
import { posRepo } from '../../data/repositories/posRepo';
import type { Customer } from '../../domain/pos/types';

interface QuickCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCustomerCreated: (customer: Customer) => void;
  initialPhone?: string;
  deviceId: string;
}

export const QuickCustomerModal: React.FC<QuickCustomerModalProps> = ({
  isOpen,
  onClose,
  onCustomerCreated,
  initialPhone = '',
  deviceId,
}) => {
  const [phone, setPhone] = useState(initialPhone);
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (isOpen) {
      setPhone(initialPhone);
      setName('');
      setNotes('');
      setError(null);
    }
  }, [isOpen, initialPhone]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = phone.trim().replace(/[\s-]/g, '');
    const cleanName = name.trim();

    if (!cleanPhone || cleanPhone.length < 5) {
      setError('Please enter a valid customer phone number.');
      return;
    }
    if (!cleanName) {
      setError('Customer name is required.');
      return;
    }

    try {
      setLoading(true);
      const customer = await posRepo.quickCreateCustomer(cleanPhone, cleanName, deviceId, notes);
      onCustomerCreated(customer);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-[2px]"
    >
      <div className="w-full max-w-sm bg-surface border border-hairline-strong rounded-2xl shadow-[0_12px_36px_rgba(0,0,0,0.16)] dark:shadow-none p-6 space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-hairline">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-accent/12 border border-accent/25 flex items-center justify-center text-accent-ink shrink-0">
              <UserPlus className="w-4 h-4" strokeWidth={1.5} />
            </div>
            <div>
              <h3 className="text-sm font-medium text-ink">Quick-add customer</h3>
              <p className="text-xs text-ink-muted">Save for loyalty tracking &amp; history</p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close modal"
            onClick={onClose}
            className="p-1.5 rounded-lg text-ink-muted hover:text-ink hover:bg-raised"
          >
            <X className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-negative/10 border border-negative/25 text-negative text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-xs font-medium text-ink-secondary mb-1">
              Mobile number *
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 text-ink-muted absolute left-3 top-2.5" strokeWidth={1.5} />
              <input
                type="tel"
                required
                autoFocus={!initialPhone}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="01712345678"
                className="w-full pl-9 pr-3 py-2 bg-raised border border-hairline rounded-lg text-sm text-ink font-mono placeholder-ink-muted focus:outline-none focus:border-accent"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-ink-secondary mb-1">
              Customer full name *
            </label>
            <div className="relative">
              <UserIcon className="w-4 h-4 text-ink-muted absolute left-3 top-2.5" strokeWidth={1.5} />
              <input
                type="text"
                required
                autoFocus={Boolean(initialPhone)}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Rafiqul Islam"
                className="w-full pl-9 pr-3 py-2 bg-raised border border-hairline rounded-lg text-sm text-ink placeholder-ink-muted focus:outline-none focus:border-accent"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-ink-secondary mb-1">
              Notes (optional)
            </label>
            <div className="relative">
              <FileText className="w-4 h-4 text-ink-muted absolute left-3 top-2.5" strokeWidth={1.5} />
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Prefers woody attar notes"
                className="w-full pl-9 pr-3 py-2 bg-raised border border-hairline rounded-lg text-xs text-ink placeholder-ink-muted focus:outline-none focus:border-accent"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-lg border border-hairline bg-raised text-ink-secondary hover:text-ink text-xs font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover text-accent-fg font-semibold text-xs transition-colors duration-150 ease-unslop"
            >
              {loading ? 'Saving…' : 'Save & Attach to Sale'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
