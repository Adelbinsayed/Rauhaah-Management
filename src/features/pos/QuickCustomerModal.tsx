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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-brand-surface border border-brand-border rounded-2xl shadow-2xl p-6 space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-brand-border">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-brand-gold/15 border border-brand-gold/30 flex items-center justify-center text-brand-gold shrink-0">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Quick-Add Customer</h3>
              <p className="text-[11px] text-neutral-400">Save for loyalty tracking &amp; purchase history</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-[11px] font-semibold text-neutral-300 uppercase tracking-wider mb-1">
              Mobile Number *
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 text-neutral-500 absolute left-3 top-2.5" />
              <input
                type="tel"
                required
                autoFocus={!initialPhone}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. 01712345678"
                className="w-full pl-9 pr-3 py-2 bg-brand-black border border-brand-border rounded-lg text-sm text-white font-mono placeholder-neutral-500 focus:outline-none focus:border-brand-gold"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-neutral-300 uppercase tracking-wider mb-1">
              Customer Full Name *
            </label>
            <div className="relative">
              <UserIcon className="w-4 h-4 text-neutral-500 absolute left-3 top-2.5" />
              <input
                type="text"
                required
                autoFocus={Boolean(initialPhone)}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Rafiqul Islam"
                className="w-full pl-9 pr-3 py-2 bg-brand-black border border-brand-border rounded-lg text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-brand-gold"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-neutral-300 uppercase tracking-wider mb-1">
              Notes (Optional)
            </label>
            <div className="relative">
              <FileText className="w-4 h-4 text-neutral-500 absolute left-3 top-2.5" />
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Regular attar lover, prefers woody notes"
                className="w-full pl-9 pr-3 py-2 bg-brand-black border border-brand-border rounded-lg text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-brand-gold"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-lg border border-brand-border text-neutral-300 hover:text-white text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 rounded-lg bg-brand-gold hover:bg-brand-gold-light text-brand-black font-bold text-xs transition-colors shadow-md shadow-brand-gold/10"
            >
              {loading ? 'Saving...' : 'Save & Attach to Sale'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
