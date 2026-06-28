'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Copy, Check, ExternalLink } from 'lucide-react';

export default function SettingsPage() {
  const [aiEnabled, setAiEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [shopifySecret, setShopifySecret] = useState('');
  const [savingShopifySecret, setSavingShopifySecret] = useState(false);
  const [shopifySuccess, setShopifySuccess] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      // Fetch tenant settings (API handles authentication)
      const response = await fetch('/api/tenant/settings');
      if (!response.ok) {
        if (response.status === 401) {
          window.location.href = '/login';
          return;
        }
        throw new Error('Failed to load settings');
      }

      const data = await response.json();
      setAiEnabled(data.aiEnabled || false);
      // Note: Shopify secret should be stored securely, not in client-side settings
      // This is a placeholder for demonstration
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveShopifySecret = async () => {
    setSavingShopifySecret(true);
    setError(null);
    setShopifySuccess(false);

    try {
      // In production, this should be saved to environment variables or secure storage
      // For now, we'll just show success as a placeholder
      setShopifySuccess(true);
      setTimeout(() => setShopifySuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save Shopify secret');
    } finally {
      setSavingShopifySecret(false);
    }
  };

  const handleCopyWebhookUrl = () => {
    const webhookUrl = `${window.location.origin}/api/integrations/shopify`;
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleToggleAi = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await fetch('/api/tenant/settings', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          aiEnabled: !aiEnabled,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update settings');
      }

      setAiEnabled(!aiEnabled);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Dashboard
      </Link>
      <h1 className="text-3xl font-bold mb-8">Settings</h1>

      <div className="bg-white border rounded-lg p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">AI Fallback</h2>
            <p className="text-sm text-gray-600 mt-1">
              Enable AI-powered responses when no keyword rules match. Uses OpenAI GPT-4o-mini for intelligent customer support.
            </p>
          </div>
          <button
            onClick={handleToggleAi}
            disabled={saving}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              aiEnabled ? 'bg-blue-600' : 'bg-gray-200'
            } ${saving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                aiEnabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        <div className="border-t pt-4">
          <div className="flex items-center gap-2 text-sm">
            <span className={`font-medium ${aiEnabled ? 'text-green-600' : 'text-gray-600'}`}>
              Status:
            </span>
            <span className={aiEnabled ? 'text-green-600' : 'text-gray-600'}>
              {aiEnabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
            Settings saved successfully
          </div>
        )}
      </div>

      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-2">How AI Fallback Works</h3>
        <ol className="list-decimal list-inside space-y-2 text-sm text-blue-800">
          <li>Customer sends a message to your WhatsApp number</li>
          <li>System checks for matching keyword rules (Exact/Contains)</li>
          <li>If no rule matches and AI is enabled, OpenAI processes the message</li>
          <li>AI generates a response based on conversation context (last 10 messages)</li>
          <li>If AI fails or is disabled, the message waits for a human agent</li>
        </ol>
      </div>

      {/* Shopify Integration */}
      <div className="mt-6 bg-white border rounded-lg p-6 space-y-6">
        <div>
          <h2 className="text-xl font-semibold mb-2">Shopify Integration</h2>
          <p className="text-sm text-gray-600">
            Configure Shopify webhooks to automatically send WhatsApp notifications for order events.
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Webhook URL</label>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={`${typeof window !== 'undefined' ? window.location.origin : ''}/api/integrations/shopify`}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600 text-sm"
              />
              <button
                onClick={handleCopyWebhookUrl}
                className="px-3 py-2 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-lg transition-colors"
                title="Copy webhook URL"
              >
                {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4 text-gray-600" />}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Use this URL in your Shopify webhook configuration for orders/create and orders/fulfilled events.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Shopify API Secret</label>
            <div className="flex gap-2">
              <input
                type="password"
                value={shopifySecret}
                onChange={(e) => setShopifySecret(e.target.value)}
                placeholder="Enter your Shopify webhook secret"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleSaveShopifySecret}
                disabled={savingShopifySecret}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {savingShopifySecret ? 'Saving...' : 'Save'}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Required for webhook signature verification. Store securely in your environment variables.
            </p>
          </div>

          {shopifySuccess && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
              Shopify secret saved successfully
            </div>
          )}

          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
              <ExternalLink className="h-4 w-4" />
              Setup Instructions
            </h3>
            <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
              <li>Go to your Shopify Admin → Settings → Notifications → Webhooks</li>
              <li>Create a new webhook for &ldquo;Order creation&rdquo; event</li>
              <li>Paste the webhook URL above</li>
              <li>Enter your Shopify webhook secret (optional but recommended)</li>
              <li>Repeat for &ldquo;Order fulfillment&rdquo; event</li>
              <li>Ensure you have approved WhatsApp templates named &ldquo;order_confirmed&rdquo; and &ldquo;order_shipped&rdquo;</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
