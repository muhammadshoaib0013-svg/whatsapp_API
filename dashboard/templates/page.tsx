'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  parseTemplateComponents,
  getCategoryBadgeColor,
  getStatusBadgeColor,
  getLanguageBadgeColor,
  formatLanguage,
  formatCategory,
  replaceVariables,
  type ParsedTemplate,
} from '@/lib/template-utils';

interface WhatsappAccount {
  id: string;
  displayName: string;
  connectionStatus: string;
  businessPhoneNumber: string;
}

interface Template {
  id: string;
  metaTemplateId: string;
  name: string;
  language: string;
  category: string;
  status: string;
  componentsJson: any;
  lastSyncedAt: string;
  createdAt: string;
  updatedAt: string;
}

export default function TemplatesPage() {
  const [account, setAccount] = useState<WhatsappAccount | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [filteredTemplates, setFilteredTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [variables, setVariables] = useState<string>('');

  // New state for Phase 5 features
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewVariables, setPreviewVariables] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchAccount();
    fetchTemplates();
  }, []);

  // Filter templates based on search query and filters
  useEffect(() => {
    let filtered = templates;

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (template) =>
          template.name.toLowerCase().includes(query) ||
          template.category.toLowerCase().includes(query) ||
          template.language.toLowerCase().includes(query)
      );
    }

    // Apply status filter
    if (statusFilter !== 'ALL') {
      filtered = filtered.filter((template) => template.status === statusFilter);
    }

    // Apply category filter
    if (categoryFilter !== 'ALL') {
      filtered = filtered.filter((template) => template.category === categoryFilter);
    }

    setFilteredTemplates(filtered);
  }, [templates, searchQuery, statusFilter, categoryFilter]);

  const fetchAccount = async () => {
    try {
      const res = await fetch('/api/whatsapp/accounts');
      if (!res.ok) {
        window.location.href = '/login';
        return;
      }
      const data = await res.json();
      setAccount(data.account);
    } catch (err) {
      console.error('Failed to fetch account:', err);
    }
  };

  const fetchTemplates = async () => {
    try {
      const res = await fetch('/api/whatsapp/templates');
      if (!res.ok) {
        window.location.href = '/login';
        return;
      }
      const data = await res.json();
      setTemplates(data.templates || []);
    } catch (err) {
      console.error('Failed to fetch templates:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch('/api/whatsapp/templates/sync', {
        method: 'POST',
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to sync templates');
        return;
      }

      setSuccess(`Synced ${data.templatesSynced} templates successfully`);
      await fetchTemplates();
    } catch (err) {
      setError('Failed to sync templates');
    } finally {
      setSyncing(false);
    }
  };

  const handleRefresh = async () => {
    setLoading(true);
    setError(null);
    await fetchTemplates();
  };

  const handlePreview = (template: Template) => {
    setSelectedTemplate(template);
    setPreviewOpen(true);
    // Initialize preview variables with empty strings
    const parsed = parseTemplateComponents(template.componentsJson);
    const initialVars: Record<string, string> = {};
    parsed.variables.forEach((v) => {
      initialVars[v] = '';
    });
    setPreviewVariables(initialVars);
  };

  const closePreview = () => {
    setPreviewOpen(false);
    setSelectedTemplate(null);
    setPreviewVariables({});
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setError(null);
    setSuccess(null);

    try {
      const body: any = {
        templateId: selectedTemplateId,
        toPhoneNumber: phoneNumber,
      };

      if (variables) {
        try {
          body.variables = JSON.parse(variables);
        } catch {
          setError('Invalid JSON format for variables');
          setSending(false);
          return;
        }
      }

      const res = await fetch('/api/whatsapp/messages/send-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to send message');
        return;
      }

      setSuccess('Message sent successfully');
      setSelectedTemplateId('');
      setPhoneNumber('');
      setVariables('');
    } catch (err) {
      setError('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center">
                <Link href="/dashboard" className="text-gray-600 hover:text-gray-900 mr-4">
                  Back to Dashboard
                </Link>
                <h1 className="text-xl font-bold text-gray-900">WhatsApp Templates</h1>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Loading Skeleton */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <div className="animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="animate-pulse space-y-4">
              <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex space-x-4">
                    <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                    <div className="h-4 bg-gray-200 rounded w-1/6"></div>
                    <div className="h-4 bg-gray-200 rounded w-1/6"></div>
                    <div className="h-4 bg-gray-200 rounded w-1/6"></div>
                    <div className="h-4 bg-gray-200 rounded w-1/6"></div>
                  </div>
                ))}
              </div>
            </div>
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
              <Link href="/dashboard" className="text-gray-600 hover:text-gray-900 mr-4">
                Back to Dashboard
              </Link>
              <h1 className="text-xl font-bold text-gray-900">WhatsApp Templates</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {account ? (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-1">Connected Account</h2>
                <p className="text-sm text-gray-600">{account.displayName}</p>
                <p className="text-sm text-gray-600">{account.businessPhoneNumber}</p>
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={handleRefresh}
                  disabled={loading}
                  className="bg-gray-600 text-white py-2 px-4 rounded-lg hover:bg-gray-700 transition-colors font-medium disabled:opacity-50"
                >
                  {loading ? 'Refreshing...' : 'Refresh'}
                </button>
                <button
                  onClick={handleSync}
                  disabled={syncing}
                  className="bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50"
                >
                  {syncing ? 'Syncing...' : 'Sync Templates'}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-6">
            <p className="text-sm text-yellow-800">
              No WhatsApp account connected. Please{' '}
              <Link href="/dashboard/connect-whatsapp" className="underline font-medium">
                connect your WhatsApp account
              </Link>{' '}
              first.
            </p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-green-800">{success}</p>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Message Templates</h2>
            <div className="text-sm text-gray-500">
              Last synced: {templates.length > 0 ? new Date(Math.max(...templates.map(t => new Date(t.lastSyncedAt).getTime()))).toLocaleString() : 'Never'}
            </div>
          </div>

          {/* Search and Filters */}
          <div className="mb-6 space-y-4">
            <div>
              <input
                type="text"
                placeholder="Search templates by name, category, or language..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder:text-gray-400 bg-white"
              />
            </div>
            <div className="flex space-x-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="APPROVED">Approved</option>
                  <option value="PENDING">Pending</option>
                  <option value="REJECTED">Rejected</option>
                  <option value="DISABLED">Disabled</option>
                  <option value="PAUSED">Paused</option>
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                >
                  <option value="ALL">All Categories</option>
                  <option value="MARKETING">Marketing</option>
                  <option value="UTILITY">Utility</option>
                  <option value="AUTHENTICATION">Authentication</option>
                </select>
              </div>
            </div>
          </div>
          
          {filteredTemplates.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No templates synced yet</h3>
              <p className="text-gray-600 mb-4">
                Click Sync Templates to fetch your approved message templates from Meta.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Category
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Language
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Last Synced
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredTemplates.map((template) => (
                    <tr key={template.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {template.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getCategoryBadgeColor(template.category)}`}>
                          {formatCategory(template.category)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getLanguageBadgeColor(template.language)}`}>
                          {formatLanguage(template.language)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusBadgeColor(template.status)}`}>
                          {template.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(template.lastSyncedAt).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button
                          onClick={() => handlePreview(template)}
                          className="text-blue-600 hover:text-blue-900 font-medium"
                        >
                          Preview
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {account && templates.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Send Test Message</h2>
            
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <div className="flex">
                <svg className="w-5 h-5 text-yellow-600 mr-2 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div>
                  <h3 className="text-sm font-medium text-yellow-800">Compliance Notice</h3>
                  <p className="text-sm text-yellow-700 mt-1">
                    Only message users who have opted in to receive WhatsApp messages from your business.
                  </p>
                </div>
              </div>
            </div>

            <form onSubmit={handleSendMessage} className="space-y-4">
              <div>
                <label htmlFor="template" className="block text-sm font-medium text-gray-700 mb-1">
                  Select Template
                </label>
                <select
                  id="template"
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
                >
                  <option value="">Choose a template...</option>
                  {templates.filter(t => t.status === 'APPROVED').map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name} ({template.language})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-700 mb-1">
                  Recipient Phone Number
                </label>
                <input
                  type="tel"
                  id="phoneNumber"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  required
                  placeholder="+1234567890"
                  pattern="\+[1-9]\d{1,14}"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder:text-gray-400 bg-white"
                />
                <p className="text-xs text-gray-500 mt-1">E.164 format (e.g., +923001234567)</p>
              </div>

              <div>
                <label htmlFor="variables" className="block text-sm font-medium text-gray-700 mb-1">
                  Variables (JSON format, optional)
                </label>
                <textarea
                  id="variables"
                  value={variables}
                  onChange={(e) => setVariables(e.target.value)}
                  placeholder='{"1": "John", "2": "your company"}'
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder:text-gray-400 bg-white font-mono text-sm"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Example: {`{"1": "John", "2": "your company"}`}
                </p>
              </div>

              <button
                type="submit"
                disabled={sending}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50"
              >
                {sending ? 'Sending...' : 'Send Test Message'}
              </button>
            </form>
          </div>
        )}

        {/* Template Preview Modal */}
        {previewOpen && selectedTemplate && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-bold text-gray-900">Template Preview</h3>
                  <button
                    onClick={closePreview}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Template Info */}
                <div className="mb-4 space-y-2">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium text-gray-700">Name:</span>
                    <span className="text-sm text-gray-900">{selectedTemplate.name}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium text-gray-700">Category:</span>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getCategoryBadgeColor(selectedTemplate.category)}`}>
                      {formatCategory(selectedTemplate.category)}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium text-gray-700">Language:</span>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getLanguageBadgeColor(selectedTemplate.language)}`}>
                      {formatLanguage(selectedTemplate.language)}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium text-gray-700">Status:</span>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusBadgeColor(selectedTemplate.status)}`}>
                      {selectedTemplate.status}
                    </span>
                  </div>
                </div>

                {/* Template Preview */}
                <div className="bg-gray-50 rounded-lg p-4 mb-4 border border-gray-200">
                  {(() => {
                    const parsed = parseTemplateComponents(selectedTemplate.componentsJson);
                    return (
                      <div className="space-y-3">
                        {/* Header */}
                        {parsed.header && (
                          <div className="border-b border-gray-200 pb-3">
                            {parsed.header.format && parsed.header.format !== 'TEXT' ? (
                              <div className="bg-gray-200 rounded-lg p-4 flex items-center justify-center">
                                <div className="text-center">
                                  <svg className="w-12 h-12 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                                  <p className="text-sm text-gray-500">{parsed.header.format}</p>
                                </div>
                              </div>
                            ) : parsed.header.text && (
                              <p className="font-semibold text-gray-900">{parsed.header.text}</p>
                            )}
                          </div>
                        )}

                        {/* Body */}
                        {parsed.body && parsed.body.text && (
                          <div className="border-b border-gray-200 pb-3">
                            <p className="text-gray-700 whitespace-pre-wrap">
                              {replaceVariables(parsed.body.text, previewVariables)}
                            </p>
                          </div>
                        )}

                        {/* Footer */}
                        {parsed.footer && parsed.footer.text && (
                          <div className="border-b border-gray-200 pb-3">
                            <p className="text-xs text-gray-500">{parsed.footer.text}</p>
                          </div>
                        )}

                        {/* Buttons */}
                        {parsed.buttons && parsed.buttons.buttons && parsed.buttons.buttons.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {parsed.buttons.buttons.map((button: any, index: number) => (
                              <button
                                key={index}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
                              >
                                {button.text}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>

                {/* Variable Inputs */}
                {(() => {
                  const parsed = parseTemplateComponents(selectedTemplate.componentsJson);
                  if (parsed.variables.length === 0) return null;

                  return (
                    <div className="mb-4">
                      <h4 className="text-sm font-medium text-gray-900 mb-2">Preview Variables</h4>
                      <div className="space-y-2">
                        {parsed.variables.map((variable) => (
                          <div key={variable}>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Variable {'{'}{variable}{'}'}
                            </label>
                            <input
                              type="text"
                              value={previewVariables[variable] || ''}
                              onChange={(e) =>
                                setPreviewVariables({
                                  ...previewVariables,
                                  [variable]: e.target.value,
                                })
                              }
                              placeholder={`Enter value for {{${variable}}}`}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder:text-gray-400 bg-white text-sm"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                <div className="flex justify-end space-x-3">
                  <button
                    onClick={closePreview}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
