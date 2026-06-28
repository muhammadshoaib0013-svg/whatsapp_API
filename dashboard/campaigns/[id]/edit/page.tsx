'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Template {
  id: string;
  name: string;
  language: string;
  status: string;
}

interface WhatsAppAccount {
  id: string;
  displayName: string;
  businessPhoneNumber: string;
  connectionStatus: string;
}

interface Campaign {
  id: string;
  name: string;
  status: string;
  whatsappAccountId: string;
  templateId: string;
  complianceConfirmed: boolean;
  recipients: Array<{
    phoneNumber: string;
    isValid: boolean;
  }>;
}

export default function EditCampaignPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [accounts, setAccounts] = useState<WhatsAppAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    whatsappAccountId: '',
    templateId: '',
    recipients: '',
    complianceConfirmed: false,
  });

  const [validationErrors, setValidationErrors] = useState<{
    validCount: number;
    invalidCount: number;
    duplicateCount: number;
    errors: Array<{ phoneNumber: string; error: string }>;
  } | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [campaignRes, templatesRes, accountsRes] = await Promise.all([
        fetch(`/api/campaigns/${params.id}`),
        fetch('/api/whatsapp/templates'),
        fetch('/api/whatsapp/accounts'),
      ]);

      if (!campaignRes.ok) {
        if (campaignRes.status === 401) {
          window.location.href = '/login';
          return;
        }
        if (campaignRes.status === 404) {
          setError('Campaign not found');
          setLoading(false);
          return;
        }
        throw new Error('Failed to fetch campaign');
      }

      if (!templatesRes.ok || !accountsRes.ok) {
        throw new Error('Failed to fetch data');
      }

      const campaignData = await campaignRes.json();
      const templatesData = await templatesRes.json();
      const accountsData = await accountsRes.json();

      // Check if campaign is in DRAFT status
      if (campaignData.campaign.status !== 'DRAFT') {
        setError('Only DRAFT campaigns can be edited');
        setLoading(false);
        return;
      }

      setCampaign(campaignData.campaign);

      // Filter only approved templates
      const approvedTemplates = (templatesData.templates || []).filter(
        (t: Template) => t.status === 'APPROVED'
      );

      setTemplates(approvedTemplates);
      setAccounts(accountsData.accounts || []);

      // Pre-populate form with existing campaign data
      const existingRecipients = campaignData.campaign.recipients
        .filter((r: { isValid: boolean }) => r.isValid)
        .map((r: { phoneNumber: string }) => r.phoneNumber)
        .join('\n');

      setFormData({
        name: campaignData.campaign.name,
        whatsappAccountId: campaignData.campaign.whatsappAccountId,
        templateId: campaignData.campaign.templateId,
        recipients: existingRecipients,
        complianceConfirmed: campaignData.campaign.complianceConfirmed,
      });

      // Validate existing recipients
      const validation = validateRecipients(existingRecipients);
      setValidationErrors(validation);
    } catch (err) {
      setError('Failed to load campaign data');
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const validateRecipients = (text: string) => {
    const lines = text.split('\n');
    const errors: Array<{ phoneNumber: string; error: string }> = [];
    let validCount = 0;
    let invalidCount = 0;
    const seenNumbers = new Set<string>();
    let duplicateCount = 0;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      if (seenNumbers.has(trimmed)) {
        duplicateCount++;
        continue;
      }

      seenNumbers.add(trimmed);

      // E.164 validation
      const e164Regex = /^\+[1-9]\d{6,14}$/;
      if (!e164Regex.test(trimmed)) {
        errors.push({
          phoneNumber: trimmed,
          error: 'Invalid E.164 format. Must start with + followed by country code and digits (e.g., +923001234567)',
        });
        invalidCount++;
      } else {
        validCount++;
      }
    }

    return { validCount, invalidCount, duplicateCount, errors };
  };

  const handleRecipientsChange = (value: string) => {
    setFormData((prev) => ({ ...prev, recipients: value }));
    const validation = validateRecipients(value);
    setValidationErrors(validation);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const validation = validateRecipients(formData.recipients);

      if (validation.validCount === 0) {
        setError('At least one valid recipient is required');
        setSubmitting(false);
        return;
      }

      if (!formData.complianceConfirmed) {
        setError('You must confirm that recipients have opted in');
        setSubmitting(false);
        return;
      }

      const res = await fetch(`/api/campaigns/${params.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update campaign');
      }

      const data = await res.json();
      router.push(`/dashboard/campaigns/${params.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update campaign');
      setSubmitting(false);
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

  if (error && !campaign) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center">
                <Link href="/dashboard/campaigns" className="text-gray-600 hover:text-gray-900 mr-4">
                  Back to Campaigns
                </Link>
                <h1 className="text-xl font-bold text-gray-900">Edit Campaign</h1>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Link href={`/dashboard/campaigns/${params.id}`} className="text-gray-600 hover:text-gray-900 mr-4">
                Back to Campaign
              </Link>
              <h1 className="text-xl font-bold text-gray-900">Edit Campaign</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-md p-6">
          <form onSubmit={handleSubmit}>
            <div className="space-y-6">
              {/* Campaign Name */}
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                  Campaign Name
                </label>
                <input
                  type="text"
                  id="name"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                  placeholder="e.g., Summer Sale Campaign"
                  style={{ color: '#000000' }}
                />
              </div>

              {/* WhatsApp Account */}
              <div>
                <label htmlFor="whatsappAccountId" className="block text-sm font-medium text-gray-700 mb-2">
                  WhatsApp Account
                </label>
                <select
                  id="whatsappAccountId"
                  required
                  value={formData.whatsappAccountId}
                  onChange={(e) => setFormData((prev) => ({ ...prev, whatsappAccountId: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                  style={{ color: '#000000' }}
                  disabled={accounts.length === 0}
                >
                  <option value="">Select an account</option>
                  {accounts.map((account) => (
                    <option
                      key={account.id}
                      value={account.id}
                      disabled={account.connectionStatus !== 'CONNECTED'}
                    >
                      {account.displayName} ({account.businessPhoneNumber}) - {account.connectionStatus}
                    </option>
                  ))}
                </select>
                {accounts.length === 0 && (
                  <p className="mt-1 text-sm text-red-600">
                    No connected WhatsApp account. Please connect an account first.
                  </p>
                )}
              </div>

              {/* Template */}
              <div>
                <label htmlFor="templateId" className="block text-sm font-medium text-gray-700 mb-2">
                  Template
                </label>
                <select
                  id="templateId"
                  required
                  value={formData.templateId}
                  onChange={(e) => setFormData((prev) => ({ ...prev, templateId: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                  style={{ color: '#000000' }}
                  disabled={templates.length === 0}
                >
                  <option value="">Select a template</option>
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name} ({template.language})
                    </option>
                  ))}
                </select>
                {templates.length === 0 && (
                  <p className="mt-1 text-sm text-red-600">
                    No approved templates available. Please sync and approve templates first.
                  </p>
                )}
              </div>

              {/* Recipients */}
              <div>
                <label htmlFor="recipients" className="block text-sm font-medium text-gray-700 mb-2">
                  Recipients (one phone number per line)
                </label>
                <textarea
                  id="recipients"
                  required
                  rows={10}
                  value={formData.recipients}
                  onChange={(e) => handleRecipientsChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm text-gray-900"
                  placeholder="+923001234567&#10;+923007654321&#10;+923009876543"
                  style={{ color: '#000000' }}
                />
                <p className="mt-1 text-xs text-gray-500">
                  Phone numbers must be in E.164 format (e.g., +923001234567)
                </p>

                {validationErrors && (
                  <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                    <div className="text-sm font-medium text-gray-700 mb-2">
                      Validation Results:
                    </div>
                    <div className="space-y-1 text-sm">
                      <div className="text-green-600">
                        ✓ Valid: {validationErrors.validCount}
                      </div>
                      <div className="text-red-600">
                        ✗ Invalid: {validationErrors.invalidCount}
                      </div>
                      {validationErrors.duplicateCount > 0 && (
                        <div className="text-yellow-600">
                          ⚠ Duplicates removed: {validationErrors.duplicateCount}
                        </div>
                      )}
                    </div>
                    {validationErrors.errors.length > 0 && (
                      <div className="mt-2">
                        <div className="text-sm font-medium text-red-700 mb-1">
                          Invalid Numbers:
                        </div>
                        <div className="max-h-32 overflow-y-auto text-xs text-red-600">
                          {validationErrors.errors.map((err, idx) => (
                            <div key={idx} className="mb-1">
                              {err.phoneNumber}: {err.error}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Compliance Notice */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-yellow-800">Compliance Notice</h3>
                    <div className="mt-2 text-sm text-yellow-700">
                      <p>
                        Only upload recipients who have opted in to receive WhatsApp messages from your business.
                        Sending messages to recipients who have not opted in may violate WhatsApp&apos;s terms of service.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Compliance Checkbox */}
              <div className="flex items-start">
                <div className="flex items-center h-5">
                  <input
                    id="complianceConfirmed"
                    type="checkbox"
                    checked={formData.complianceConfirmed}
                    onChange={(e) => setFormData((prev) => ({ ...prev, complianceConfirmed: e.target.checked }))}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                </div>
                <div className="ml-3 text-sm">
                  <label htmlFor="complianceConfirmed" className="font-medium text-gray-700">
                    I confirm that all recipients have opted in to receive WhatsApp messages from my business
                  </label>
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex justify-end space-x-3">
                <Link
                  href={`/dashboard/campaigns/${params.id}`}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium"
                >
                  Cancel
                </Link>
                <button
                  type="submit"
                  disabled={submitting || !formData.complianceConfirmed || validationErrors?.validCount === 0}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
