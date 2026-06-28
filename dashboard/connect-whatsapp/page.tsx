'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface WhatsappAccount {
  id: string;
  displayName: string;
  wabaId: string;
  phoneNumberId: string;
  businessPhoneNumber: string;
  graphApiVersion: string;
  tokenLastFour: string | null;
  connectionStatus: 'NOT_CONNECTED' | 'CONNECTED' | 'FAILED' | 'DISABLED';
  lastTestedAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function ConnectWhatsappPage() {
  const [account, setAccount] = useState<WhatsappAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showManualForm, setShowManualForm] = useState(false);
  const [embeddedSignupLoading, setEmbeddedSignupLoading] = useState(false);
  const [isFbLoaded, setIsFbLoaded] = useState(false);

  const [formData, setFormData] = useState({
    displayName: '',
    wabaId: '',
    phoneNumberId: '',
    businessPhoneNumber: '',
    graphApiVersion: 'v19.0',
    accessToken: '',
  });

  useEffect(() => {
    // Log environment variables on mount
    console.log('[META_DEBUG] Meta App ID:', process.env.NEXT_PUBLIC_META_APP_ID);
    console.log('[META_DEBUG] Meta Config ID:', process.env.NEXT_PUBLIC_META_CONFIG_ID);
    
    fetchAccount();
    loadMetaSDK();
  }, []);

  const loadMetaSDK = () => {
    // Load Meta Embedded Signup SDK
    console.log('[META_DEBUG] Starting to load Meta SDK...');
    (window as any).fbAsyncInit = function() {
      console.log('[META_DEBUG] fbAsyncInit called');
      console.log('[META_DEBUG] Initializing FB with App ID:', process.env.NEXT_PUBLIC_META_APP_ID);
      (window as any).FB.init({
        appId: process.env.NEXT_PUBLIC_META_APP_ID,
        cookie: true,
        xfbml: true,
        version: 'v19.0',
      });
      console.log('[META_DEBUG] FB.init completed');
      setIsFbLoaded(true);
      console.log('[META_DEBUG] isFbLoaded set to true');
    };

    // Load SDK script
    const script = document.createElement('script');
    script.src = 'https://connect.facebook.net/en_US/sdk.js';
    script.async = true;
    script.onload = () => {
      console.log('[META_DEBUG] Meta SDK script loaded successfully');
      console.log('[META_DEBUG] FB object available:', typeof (window as any).FB !== 'undefined');
    };
    script.onerror = () => {
      console.error('[META_DEBUG] Failed to load Meta SDK script');
      setError('Failed to load Meta SDK. Please use manual setup.');
    };
    document.body.appendChild(script);
  };

  const fetchAccount = async () => {
    try {
      const res = await fetch('/api/whatsapp/accounts');
      if (!res.ok) {
        window.location.href = '/login';
        return;
      }
      const data = await res.json();
      setAccount(data.account);
      if (data.account) {
        setFormData({
          displayName: data.account.displayName,
          wabaId: data.account.wabaId,
          phoneNumberId: data.account.phoneNumberId,
          businessPhoneNumber: data.account.businessPhoneNumber,
          graphApiVersion: data.account.graphApiVersion,
          accessToken: '',
        });
      }
    } catch (err) {
      console.error('Failed to fetch account:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch('/api/whatsapp/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to save account');
        return;
      }

      setSuccess(account ? 'WhatsApp account updated successfully' : 'WhatsApp account created successfully');
      setFormData({ ...formData, accessToken: '' });
      await fetchAccount();
    } catch (err) {
      setError('Failed to save account');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch('/api/whatsapp/accounts/test', {
        method: 'POST',
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Connection test failed');
        await fetchAccount();
        return;
      }

      setSuccess('Connection test successful!');
      await fetchAccount();
    } catch (err) {
      setError('Connection test failed');
    } finally {
      setTesting(false);
    }
  };

  const handleDelete = async () => {
    if (!account || !confirm('Are you sure you want to delete this WhatsApp account?')) {
      return;
    }

    try {
      const res = await fetch(`/api/whatsapp/accounts/${account.id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        setError('Failed to delete account');
        return;
      }

      setSuccess('WhatsApp account deleted successfully');
      setAccount(null);
      setFormData({
        displayName: '',
        wabaId: '',
        phoneNumberId: '',
        businessPhoneNumber: '',
        graphApiVersion: 'v19.0',
        accessToken: '',
      });
    } catch (err) {
      setError('Failed to delete account');
    }
  };

  const handleEmbeddedSignup = () => {
    console.log('[META_DEBUG] handleEmbeddedSignup called');
    console.log('[META_DEBUG] isFbLoaded:', isFbLoaded);
    console.log('[META_DEBUG] FB object available before login:', typeof (window as any).FB !== 'undefined');
    
    if (!isFbLoaded || !(window as any).FB) {
      console.error('[META_DEBUG] FB not loaded yet, cannot call FB.login');
      setError('Meta SDK not loaded yet. Please wait and try again.');
      return;
    }
    
    const configId = process.env.NEXT_PUBLIC_META_CONFIG_ID;
    console.log('[META_DEBUG] Config ID being used:', configId);
    
    setEmbeddedSignupLoading(true);
    setError(null);

    try {
      console.log('[META_DEBUG] About to call FB.login...');
      // Launch Meta Embedded Signup
      (window as any).FB.login(
        function(response: any) {
          console.log('[META_DEBUG] FB.login callback received');
          console.log('[META_DEBUG] Full response object:', JSON.stringify(response, null, 2));
          console.log('[META_DEBUG] Response status:', response.status);
          console.log('[META_DEBUG] Response authResponse:', response.authResponse);
          
          if (response.status === 'not_authorized') {
            console.error('[META_DEBUG] User denied authorization');
            setError('User denied authorization. Please try again.');
            setEmbeddedSignupLoading(false);
            return;
          }
          
          if (response.status === 'unknown') {
            console.error('[META_DEBUG] Unknown error occurred during login');
            setError('An unknown error occurred. Please try manual setup.');
            setEmbeddedSignupLoading(false);
            return;
          }
          
          if (response.authResponse) {
            console.log('[META_DEBUG] Authorization successful, code received');
            // Exchange code for token via our backend
            exchangeCodeForToken(response.authResponse.code);
          } else {
            console.error('[META_DEBUG] No authResponse in response');
            setError('Embedded signup was cancelled or failed');
            setEmbeddedSignupLoading(false);
          }
        },
        {
          config_id: configId,
          response_type: 'code',
          override_default_response_type: true,
          extras: {
            setup: {
              // Meta Embedded Signup configuration
            },
          },
        }
      );
    } catch (err) {
      console.error('[META_DEBUG] Exception in handleEmbeddedSignup:', err);
      setError('Failed to launch embedded signup. Please try manual setup.');
      setEmbeddedSignupLoading(false);
    }
  };

  const exchangeCodeForToken = async (code: string) => {
    try {
      const res = await fetch('/api/whatsapp/embedded-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to complete signup');
        setEmbeddedSignupLoading(false);
        return;
      }

      setSuccess('WhatsApp account connected successfully!');
      await fetchAccount();
      setEmbeddedSignupLoading(false);
    } catch (err) {
      console.error('Token exchange error:', err);
      setError('Failed to complete signup. Please try manual setup.');
      setEmbeddedSignupLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Link href="/dashboard" className="text-gray-600 hover:text-gray-900 mr-4">
                ← Back to Dashboard
              </Link>
              <h1 className="text-xl font-bold text-gray-900">Connect WhatsApp Business API</h1>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Security Notice */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex">
            <svg className="w-5 h-5 text-blue-600 mr-2 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <h3 className="text-sm font-medium text-blue-800">Security Notice</h3>
              <p className="text-sm text-blue-700 mt-1">
                Your WhatsApp access token is encrypted before storage and never shown again. Only the last 4 characters are displayed for verification.
              </p>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-green-800">{success}</p>
          </div>
        )}

        {/* Connection Status Card */}
        {account && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Connection Status</h2>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Status:</span>
                <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                  account.connectionStatus === 'CONNECTED' ? 'bg-green-100 text-green-800' :
                  account.connectionStatus === 'FAILED' ? 'bg-red-100 text-red-800' :
                  'bg-yellow-100 text-yellow-800'
                }`}>
                  {account.connectionStatus}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Display Name:</span>
                <span className="text-sm font-medium text-gray-900">{account.displayName}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Business Phone:</span>
                <span className="text-sm font-medium text-gray-900">{account.businessPhoneNumber}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Token Last 4:</span>
                <span className="text-sm font-medium text-gray-900">••••{account.tokenLastFour}</span>
              </div>
              {account.lastTestedAt && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Last Tested:</span>
                  <span className="text-sm text-gray-900">{new Date(account.lastTestedAt).toLocaleString()}</span>
                </div>
              )}
              {account.lastError && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Last Error:</span>
                  <span className="text-sm text-red-600">{account.lastError}</span>
                </div>
              )}
              <div className="flex space-x-3 mt-4">
                <button
                  onClick={handleTest}
                  disabled={testing}
                  className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50"
                >
                  {testing ? 'Testing...' : 'Test Connection'}
                </button>
                <button
                  onClick={handleDelete}
                  className="flex-1 bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 transition-colors font-medium"
                >
                  Delete Account
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Connection Options */}
        {!account && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Connect Your WhatsApp Account</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              {/* Embedded Signup Option */}
              <div className="border-2 border-blue-200 rounded-lg p-6 hover:border-blue-400 transition-colors cursor-pointer" onClick={!embeddedSignupLoading ? handleEmbeddedSignup : undefined}>
                <div className="flex flex-col items-center text-center">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-3">
                    <svg className="w-6 h-6 text-green-600" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Quick Setup</h3>
                  <p className="text-sm text-gray-600 mb-4">Connect your WhatsApp Business Account using Meta&apos;s secure embedded signup</p>
                  <button
                    type="button"
                    disabled={embeddedSignupLoading || !isFbLoaded}
                    className="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {!isFbLoaded ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Loading Meta SDK...
                      </>
                    ) : embeddedSignupLoading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Connecting...
                      </>
                    ) : (
                      'Launch Embedded Signup'
                    )}
                  </button>
                </div>
              </div>

              {/* Manual Setup Option */}
              <div className="border-2 border-gray-200 rounded-lg p-6 hover:border-gray-400 transition-colors cursor-pointer" onClick={() => setShowManualForm(true)}>
                <div className="flex flex-col items-center text-center">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-3">
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Manual Setup</h3>
                  <p className="text-sm text-gray-600 mb-4">Enter your WhatsApp Business API credentials manually</p>
                  <button
                    type="button"
                    className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                  >
                    Configure Manually
                  </button>
                </div>
              </div>
            </div>

            <p className="text-xs text-gray-500 text-center">
              Quick setup is recommended for most users. Manual setup is for advanced users with existing Meta apps.
            </p>
          </div>
        )}

        {/* Manual Form */}
        {showManualForm && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                {account ? 'Update WhatsApp Account' : 'Manual Setup'}
              </h2>
              <button
                onClick={() => setShowManualForm(false)}
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                Cancel
              </button>
            </div>
            <form onSubmit={handleSave} className="space-y-4" autoComplete="off">
            <div>
              <label htmlFor="displayName" className="block text-sm font-medium text-gray-700 mb-1">
                Display Name
              </label>
              <input
                type="text"
                id="displayName"
                value={formData.displayName}
                onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                required
                autoComplete="off"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder:text-gray-400 bg-white"
                placeholder="My Business WhatsApp"
              />
            </div>

            <div>
              <label htmlFor="wabaId" className="block text-sm font-medium text-gray-700 mb-1">
                WABA ID (WhatsApp Business Account ID)
              </label>
              <input
                type="text"
                id="wabaId"
                value={formData.wabaId}
                onChange={(e) => setFormData({ ...formData, wabaId: e.target.value })}
                required
                autoComplete="off"
                pattern="\d+"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder:text-gray-400 bg-white"
                placeholder="123456789012345"
              />
              <p className="text-xs text-gray-500 mt-1">Numeric only</p>
            </div>

            <div>
              <label htmlFor="phoneNumberId" className="block text-sm font-medium text-gray-700 mb-1">
                Phone Number ID
              </label>
              <input
                type="text"
                id="phoneNumberId"
                value={formData.phoneNumberId}
                onChange={(e) => setFormData({ ...formData, phoneNumberId: e.target.value })}
                required
                autoComplete="off"
                pattern="\d+"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder:text-gray-400 bg-white"
                placeholder="123456789012345"
              />
              <p className="text-xs text-gray-500 mt-1">Numeric only</p>
            </div>

            <div>
              <label htmlFor="businessPhoneNumber" className="block text-sm font-medium text-gray-700 mb-1">
                Business Phone Number
              </label>
              <input
                type="tel"
                id="businessPhoneNumber"
                value={formData.businessPhoneNumber}
                onChange={(e) => setFormData({ ...formData, businessPhoneNumber: e.target.value })}
                required
                autoComplete="tel"
                pattern="\+[1-9]\d{1,14}"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder:text-gray-400 bg-white"
                placeholder="+1234567890"
              />
              <p className="text-xs text-gray-500 mt-1">E.164 format (e.g., +923001234567)</p>
            </div>

            <div>
              <label htmlFor="graphApiVersion" className="block text-sm font-medium text-gray-700 mb-1">
                Graph API Version
              </label>
              <input
                type="text"
                id="graphApiVersion"
                value={formData.graphApiVersion}
                onChange={(e) => setFormData({ ...formData, graphApiVersion: e.target.value })}
                required
                autoComplete="off"
                pattern="v\d+\.\d+"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder:text-gray-400 bg-white"
                placeholder="v19.0"
              />
              <p className="text-xs text-gray-500 mt-1">Format: v19.0</p>
            </div>

            <div>
              <label htmlFor="accessToken" className="block text-sm font-medium text-gray-700 mb-1">
                Access Token
              </label>
              <input
                type="password"
                id="accessToken"
                value={formData.accessToken}
                onChange={(e) => setFormData({ ...formData, accessToken: e.target.value })}
                required={!account}
                autoComplete="off"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder:text-gray-400 bg-white"
                placeholder={account ? 'Leave blank to keep existing token' : 'Enter your access token'}
              />
              <p className="text-xs text-gray-500 mt-1">
                {account ? 'Leave blank to keep existing token, or enter new token to update' : 'Your token will be encrypted and never shown again'}
              </p>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50"
            >
              {saving ? 'Saving...' : account ? 'Update Account' : 'Connect Account'}
            </button>
          </form>
          </div>
        )}

        {/* Help Section */}
        <div className="mt-6 bg-gray-50 rounded-lg p-6">
          <h3 className="text-sm font-medium text-gray-900 mb-2">How to get these values?</h3>
          <ol className="text-sm text-gray-600 list-decimal list-inside space-y-1">
            <li>Go to Meta for Developers (developers.facebook.com/apps)</li>
            <li>Select or create your app</li>
            <li>Go to WhatsApp &gt; Configuration</li>
            <li>Find your WABA ID, Phone Number ID, and Business Phone Number</li>
            <li>Generate a permanent access token with required permissions</li>
          </ol>
        </div>
      </main>
    </div>
  );
}
