'use client';

/**
 * WabaSwitcher Component
 * Enterprise-grade workspace dropdown for switching between multiple WhatsApp Business Accounts
 * Sets the active configuration securely in session state
 */

import { useState, useEffect } from 'react';
import { ChevronDown, Check, Phone, Loader2 } from 'lucide-react';

interface WabaAccount {
  id: string;
  displayName: string;
  businessPhoneNumber: string;
  connectionStatus: string;
  isActive: boolean;
}

interface WabaSwitcherProps {
  accounts: WabaAccount[];
  onSwitch: (accountId: string) => Promise<void>;
  isLoading?: boolean;
}

export default function WabaSwitcher({
  accounts,
  onSwitch,
  isLoading = false,
}: WabaSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [switchingId, setSwitchingId] = useState<string | null>(null);

  const activeAccount = accounts.find((acc) => acc.isActive);

  const handleSwitch = async (accountId: string) => {
    setSwitchingId(accountId);
    try {
      await onSwitch(accountId);
      setIsOpen(false);
    } catch (error) {
      console.error('Failed to switch WABA account:', error);
    } finally {
      setSwitchingId(null);
    }
  };

  const formatPhoneNumber = (phone: string) => {
    // Simple phone number formatting
    if (phone.length <= 3) return phone;
    if (phone.length <= 6) return `${phone.slice(0, 3)} ${phone.slice(3)}`;
    return `${phone.slice(0, 3)} ${phone.slice(3, 6)} ${phone.slice(6)}`;
  };

  const getConnectionStatusColor = (status: string) => {
    switch (status) {
      case 'CONNECTED':
        return 'bg-green-500';
      case 'NOT_CONNECTED':
        return 'bg-red-500';
      case 'TESTING':
        return 'bg-yellow-500';
      default:
        return 'bg-gray-500';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg shadow-sm">
        <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
        <span className="text-sm text-gray-600">Loading accounts...</span>
      </div>
    );
  }

  if (!activeAccount && accounts.length === 0) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg shadow-sm">
        <Phone className="w-4 h-4 text-gray-400" />
        <span className="text-sm text-gray-600">No accounts connected</span>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 px-4 py-2 bg-white border border-gray-200 rounded-lg shadow-sm hover:border-gray-300 hover:shadow-md transition-all duration-200 min-w-[280px]"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        {activeAccount ? (
          <>
            <div className="flex items-center justify-center w-8 h-8 bg-blue-50 rounded-full">
              <Phone className="w-4 h-4 text-blue-600" />
            </div>
            <div className="flex-1 text-left">
              <div className="text-sm font-medium text-gray-900">
                {activeAccount.displayName}
              </div>
              <div className="text-xs text-gray-500">
                {formatPhoneNumber(activeAccount.businessPhoneNumber)}
              </div>
            </div>
            <div
              className={`w-2 h-2 rounded-full ${getConnectionStatusColor(
                activeAccount.connectionStatus
              )}`}
            />
            <ChevronDown
              className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${
                isOpen ? 'rotate-180' : ''
              }`}
            />
          </>
        ) : (
          <>
            <Phone className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-600">Select an account</span>
            <ChevronDown
              className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${
                isOpen ? 'rotate-180' : ''
              }`}
            />
          </>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          {/* Menu */}
          <div className="absolute top-full left-0 mt-2 w-full min-w-[280px] bg-white border border-gray-200 rounded-lg shadow-lg z-20 overflow-hidden">
            <div className="p-2">
              {accounts.length === 0 ? (
                <div className="px-3 py-4 text-center text-sm text-gray-500">
                  No WhatsApp accounts connected
                </div>
              ) : (
                <ul
                  className="space-y-1"
                  role="listbox"
                  aria-label="WhatsApp accounts"
                >
                  {accounts.map((account) => (
                    <li key={account.id}>
                      <button
                        onClick={() => handleSwitch(account.id)}
                        disabled={switchingId === account.id}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-gray-50 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                        role="option"
                        aria-selected={account.isActive}
                      >
                        <div className="flex items-center justify-center w-8 h-8 bg-gray-100 rounded-full">
                          <Phone className="w-4 h-4 text-gray-600" />
                        </div>
                        <div className="flex-1 text-left">
                          <div className="text-sm font-medium text-gray-900">
                            {account.displayName}
                          </div>
                          <div className="text-xs text-gray-500">
                            {formatPhoneNumber(account.businessPhoneNumber)}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-2 h-2 rounded-full ${getConnectionStatusColor(
                              account.connectionStatus
                            )}`}
                          />
                          {account.isActive && (
                            <Check className="w-4 h-4 text-blue-600" />
                          )}
                          {switchingId === account.id && (
                            <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                          )}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Footer */}
            <div className="px-3 py-2 bg-gray-50 border-t border-gray-200">
              <div className="text-xs text-gray-500">
                {accounts.length} account{accounts.length !== 1 ? 's' : ''} connected
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
