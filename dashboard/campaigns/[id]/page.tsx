'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import CampaignProgressTracker from '@/components/CampaignProgressTracker';

interface Campaign {
  id: string;
  name: string;
  status: string;
  recipientCount: number;
  validRecipientCount: number;
  invalidRecipientCount: number;
  complianceConfirmed: boolean;
  createdAt: string;
  isAbTest: boolean;
  templateIdA?: string;
  templateIdB?: string;
  template: {
    id: string;
    name: string;
    language: string;
    status: string;
  };
  templateA?: {
    id: string;
    name: string;
  };
  templateB?: {
    id: string;
    name: string;
  };
  account: {
    id: string;
    displayName: string;
    businessPhoneNumber: string;
  };
  recipients: Array<{
    id: string;
    phoneNumber: string;
    isValid: boolean;
    validationError: string | null;
    status: string;
    sentAt: string | null;
    deliveredAt: string | null;
    readAt: string | null;
    errorMessage: string | null;
    metadata?: {
      templateVariant?: string;
      templateId?: string;
    };
  }>;
}

interface SafetyCheck {
  whatsappAccountConnected: boolean;
  templateApproved: boolean;
  hasValidRecipients: boolean;
  complianceConfirmed: boolean;
  estimatedMessageCount: number;
  estimatedCost: string;
  allChecksPassed: boolean;
}

interface CampaignProgress {
  campaignId: string;
  status: string;
  totalRecipients: number;
  pending: number;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
  successRate: number;
  deliveryRate: number;
  readRate: number;
}

export default function CampaignDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [progress, setProgress] = useState<CampaignProgress | null>(null);
  const [safetyCheck, setSafetyCheck] = useState<SafetyCheck | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [showReadyModal, setShowReadyModal] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [sending, setSending] = useState(false);

  const fetchCampaign = useCallback(async () => {
    try {
      const res = await fetch(`/api/campaigns/${params.id}`);
      if (!res.ok) {
        if (res.status === 401) {
          window.location.href = '/login';
          return;
        }
        if (res.status === 404) {
          setError('Campaign not found');
          setLoading(false);
          return;
        }
        throw new Error('Failed to fetch campaign');
      }
      const data = await res.json();
      setCampaign(data.campaign);
    } catch (err) {
      setError('Failed to load campaign');
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  const fetchProgress = useCallback(async () => {
    try {
      const res = await fetch(`/api/campaigns/${params.id}/progress`);
      if (!res.ok) {
        return;
      }
      const data = await res.json();
      setProgress(data);
    } catch (err) {
      console.error('Failed to fetch progress:', err);
    }
  }, [params.id]);

  const fetchSafetyCheck = useCallback(async () => {
    try {
      const res = await fetch(`/api/campaigns/${params.id}/safety-check`);
      if (!res.ok) {
        return;
      }
      const data = await res.json();
      setSafetyCheck(data);
    } catch (err) {
      console.error('Failed to fetch safety check:', err);
    }
  }, [params.id]);

  useEffect(() => {
    fetchCampaign();
    fetchProgress();
    fetchSafetyCheck();
  }, [fetchCampaign, fetchProgress, fetchSafetyCheck]);

  // Auto-refresh every 15 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchCampaign();
      fetchProgress();
      fetchSafetyCheck();
    }, 15000); // Poll every 15 seconds
    return () => clearInterval(interval);
  }, [fetchCampaign, fetchProgress, fetchSafetyCheck]);

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this campaign? This action cannot be undone.')) {
      return;
    }

    setDeleting(true);
    try {
      const res = await fetch(`/api/campaigns/${params.id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete campaign');
      }

      router.push('/dashboard/campaigns');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete campaign');
      setDeleting(false);
    }
  };

  const handleStart = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/campaigns/${params.id}/start`, {
        method: 'POST',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to start campaign');
      }

      await fetchCampaign();
      await fetchProgress();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start campaign');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePause = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/campaigns/${params.id}/pause`, {
        method: 'POST',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to pause campaign');
      }

      await fetchCampaign();
      await fetchProgress();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to pause campaign');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResume = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/campaigns/${params.id}/resume`, {
        method: 'POST',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to resume campaign');
      }

      await fetchCampaign();
      await fetchProgress();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resume campaign');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm('Are you sure you want to cancel this campaign? This action cannot be undone.')) {
      return;
    }

    setActionLoading(true);
    try {
      const res = await fetch(`/api/campaigns/${params.id}/cancel`, {
        method: 'POST',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to cancel campaign');
      }

      await fetchCampaign();
      await fetchProgress();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel campaign');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRetry = async () => {
    if (!confirm('Are you sure you want to retry failed recipients? This will reset failed recipients to PENDING status and attempt to send messages again.')) {
      return;
    }

    setActionLoading(true);
    try {
      const res = await fetch(`/api/campaigns/${params.id}/retry`, {
        method: 'POST',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to retry failed recipients');
      }

      await fetchCampaign();
      await fetchProgress();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to retry failed recipients');
    } finally {
      setActionLoading(false);
    }
  };

  const handleMarkAsReady = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/campaigns/${params.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'READY' }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to mark campaign as ready');
      }

      setShowReadyModal(false);
      await fetchCampaign();
      await fetchSafetyCheck();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark campaign as ready');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRevertToDraft = async () => {
    if (!confirm('Are you sure you want to revert this campaign to draft? This will allow you to edit it again.')) {
      return;
    }

    setActionLoading(true);
    try {
      const res = await fetch(`/api/campaigns/${params.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'DRAFT' }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to revert campaign to draft');
      }

      await fetchCampaign();
      await fetchSafetyCheck();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revert campaign to draft');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSendCampaign = async () => {
    setSending(true);
    try {
      const res = await fetch(`/api/campaigns/${params.id}/send`, {
        method: 'POST',
      });

      if (!res.ok) {
        const data = await res.json();
        if (data.failingChecks) {
          throw new Error(`Safety check failed: ${data.failingChecks.join(', ')}`);
        }
        throw new Error(data.error || 'Failed to send campaign');
      }

      setShowSendModal(false);
      await fetchCampaign();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send campaign');
    } finally {
      setSending(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusLower = status.toLowerCase();
    let bgColor = 'bg-gray-100';
    let textColor = 'text-gray-800';

    if (statusLower === 'draft') {
      bgColor = 'bg-blue-100';
      textColor = 'text-blue-800';
    } else if (statusLower === 'ready') {
      bgColor = 'bg-green-100';
      textColor = 'text-green-800';
    } else if (statusLower === 'scheduled') {
      bgColor = 'bg-purple-100';
      textColor = 'text-purple-800';
    } else if (statusLower === 'sending') {
      bgColor = 'bg-yellow-100';
      textColor = 'text-yellow-800';
    } else if (statusLower === 'completed') {
      bgColor = 'bg-green-100';
      textColor = 'text-green-800';
    } else if (statusLower === 'failed') {
      bgColor = 'bg-red-100';
      textColor = 'text-red-800';
    } else if (statusLower === 'cancelled') {
      bgColor = 'bg-gray-100';
      textColor = 'text-gray-800';
    }

    return (
      <span className={`px-3 py-1 text-sm font-medium rounded-full ${bgColor} ${textColor}`}>
        {status}
      </span>
    );
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

  if (error || !campaign) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center">
                <Link href="/dashboard/campaigns" className="text-gray-600 hover:text-gray-900 mr-4">
                  Back to Campaigns
                </Link>
                <h1 className="text-xl font-bold text-gray-900">Campaign Details</h1>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-800">{error || 'Campaign not found'}</p>
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
              <Link href="/dashboard/campaigns" className="text-gray-600 hover:text-gray-900 mr-4">
                Back to Campaigns
              </Link>
              <h1 className="text-xl font-bold text-gray-900">Campaign Details</h1>
            </div>
            {campaign.status === 'DRAFT' && (
              <div className="flex space-x-3">
                <Link
                  href={`/dashboard/campaigns/${campaign.id}/edit`}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium"
                >
                  Edit Draft
                </Link>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {deleting ? 'Deleting...' : 'Delete Draft'}
                </button>
                {safetyCheck?.allChecksPassed && (
                  <button
                    onClick={() => setShowReadyModal(true)}
                    disabled={actionLoading}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Mark as Ready
                  </button>
                )}
              </div>
            )}
            {campaign.status === 'READY' && (
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowSendModal(true)}
                  disabled={sending}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sending ? 'Sending...' : 'Send Campaign'}
                </button>
                <button
                  onClick={handleRevertToDraft}
                  disabled={actionLoading}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {actionLoading ? 'Reverting...' : 'Revert to Draft'}
                </button>
              </div>
            )}
            {campaign.status === 'SENDING' && (
              <div className="flex space-x-3">
                <button
                  onClick={handlePause}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {actionLoading ? 'Pausing...' : 'Pause Campaign'}
                </button>
                <button
                  onClick={handleCancel}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {actionLoading ? 'Cancelling...' : 'Cancel Campaign'}
                </button>
              </div>
            )}
            {campaign.status === 'PAUSED' && (
              <div className="flex space-x-3">
                <button
                  onClick={handleResume}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {actionLoading ? 'Resuming...' : 'Resume Campaign'}
                </button>
                <button
                  onClick={handleCancel}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {actionLoading ? 'Cancelling...' : 'Cancel Campaign'}
                </button>
              </div>
            )}
            {(campaign.status === 'COMPLETED' || campaign.status === 'COMPLETED_WITH_ERRORS' || campaign.status === 'FAILED' || campaign.status === 'CANCELLED') && progress && progress.failed > 0 && (
              <div className="flex space-x-3">
                <button
                  onClick={handleRetry}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {actionLoading ? 'Retrying...' : `Retry Failed (${progress.failed})`}
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Campaign Info */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Campaign Information</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Campaign Name</label>
                  <p className="text-gray-900 font-bold text-lg !important" style={{ color: '#000000 !important', fontWeight: 'bold !important', fontSize: '1.125rem !important' }}>{campaign.name}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  {getStatusBadge(campaign.status)}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Template</label>
                  <p className="text-gray-900 font-bold !important" style={{ color: '#000000 !important', fontWeight: 'bold !important' }}>{campaign.template.name}</p>
                  <p className="text-sm text-gray-600">{campaign.template.language}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp Account</label>
                  <p className="text-gray-900 font-bold !important" style={{ color: '#000000 !important', fontWeight: 'bold !important' }}>{campaign.account.displayName}</p>
                  <p className="text-sm text-gray-600">{campaign.account.businessPhoneNumber}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Created</label>
                  <p className="text-gray-900 font-bold !important" style={{ color: '#000000 !important', fontWeight: 'bold !important' }}>{new Date(campaign.createdAt).toLocaleString()}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Compliance Confirmed</label>
                  <p className="text-gray-900 font-bold !important" style={{ color: '#000000 !important', fontWeight: 'bold !important' }}>{campaign.complianceConfirmed ? 'Yes' : 'No'}</p>
                </div>
              </div>
            </div>

            {/* A/B Test Results */}
            {campaign.isAbTest && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">A/B Test Results</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-blue-50 rounded-lg p-4">
                    <h3 className="font-semibold text-blue-900 mb-2">Template A</h3>
                    <p className="text-sm text-blue-700 mb-2">{campaign.templateA?.name || 'N/A'}</p>
                    {campaign.recipients && (
                      <div className="space-y-1 text-sm">
                        <p className="text-blue-800">
                          Sent: {campaign.recipients.filter(r => r.metadata?.templateVariant === 'A' && r.status === 'SENT').length}
                        </p>
                        <p className="text-blue-800">
                          Delivered: {campaign.recipients.filter(r => r.metadata?.templateVariant === 'A' && r.deliveredAt).length}
                        </p>
                        <p className="text-blue-800">
                          Read: {campaign.recipients.filter(r => r.metadata?.templateVariant === 'A' && r.readAt).length}
                        </p>
                        <p className="text-blue-800 font-medium">
                          Read Rate: {(() => {
                            const sentA = campaign.recipients.filter(r => r.metadata?.templateVariant === 'A' && r.status === 'SENT').length;
                            const readA = campaign.recipients.filter(r => r.metadata?.templateVariant === 'A' && r.readAt).length;
                            return sentA > 0 ? ((readA / sentA) * 100).toFixed(1) : '0';
                          })()}%
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="bg-purple-50 rounded-lg p-4">
                    <h3 className="font-semibold text-purple-900 mb-2">Template B</h3>
                    <p className="text-sm text-purple-700 mb-2">{campaign.templateB?.name || 'N/A'}</p>
                    {campaign.recipients && (
                      <div className="space-y-1 text-sm">
                        <p className="text-purple-800">
                          Sent: {campaign.recipients.filter(r => r.metadata?.templateVariant === 'B' && r.status === 'SENT').length}
                        </p>
                        <p className="text-purple-800">
                          Delivered: {campaign.recipients.filter(r => r.metadata?.templateVariant === 'B' && r.deliveredAt).length}
                        </p>
                        <p className="text-purple-800">
                          Read: {campaign.recipients.filter(r => r.metadata?.templateVariant === 'B' && r.readAt).length}
                        </p>
                        <p className="text-purple-800 font-medium">
                          Read Rate: {(() => {
                            const sentB = campaign.recipients.filter(r => r.metadata?.templateVariant === 'B' && r.status === 'SENT').length;
                            const readB = campaign.recipients.filter(r => r.metadata?.templateVariant === 'B' && r.readAt).length;
                            return sentB > 0 ? ((readB / sentB) * 100).toFixed(1) : '0';
                          })()}%
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Live Campaign Progress Tracker */}
            {(campaign.status === 'SENDING' || campaign.status === 'PAUSED' || campaign.status === 'COMPLETED' || campaign.status === 'COMPLETED_WITH_ERRORS') && (
              <CampaignProgressTracker
                campaignId={campaign.id}
                initialProgress={progress ? {
                  total: progress.totalRecipients,
                  sent: progress.sent,
                  delivered: progress.delivered,
                  read: progress.read,
                  failed: progress.failed,
                  percentage: progress.totalRecipients > 0 ? (progress.sent / progress.totalRecipients) * 100 : 0,
                  status: campaign.status as 'PENDING' | 'RUNNING' | 'COMPLETED' | 'PAUSED',
                } : undefined}
              />
            )}

            {/* Recipients */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Recipients</h2>
              
              {/* Recipient Summary Cards */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-green-100 rounded-lg p-3 border border-green-200">
                  <div className="text-xl font-bold text-green-900">{campaign.validRecipientCount}</div>
                  <div className="text-xs text-green-800 font-medium">Valid</div>
                </div>
                <div className="bg-red-100 rounded-lg p-3 border border-red-200">
                  <div className="text-xl font-bold text-red-900">{campaign.invalidRecipientCount}</div>
                  <div className="text-xs text-red-800 font-medium">Invalid</div>
                </div>
                <div className="bg-gray-100 rounded-lg p-3 border border-gray-200">
                  <div className="text-xl font-bold text-gray-900">{campaign.recipientCount}</div>
                  <div className="text-xs text-gray-800 font-medium">Total</div>
                </div>
              </div>

              {/* Valid Recipients List */}
              {campaign.recipients.filter(r => r.isValid).length > 0 && (
                <div className="mb-4">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Valid Recipients</h3>
                  <div className="max-h-48 overflow-y-auto border rounded-lg">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                            Phone Number
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {campaign.recipients.filter(r => r.isValid).map((recipient) => (
                          <tr key={recipient.id}>
                            <td className="px-3 py-2 text-sm text-gray-900 font-mono">
                              {recipient.phoneNumber.substring(0, 4)}***{recipient.phoneNumber.substring(recipient.phoneNumber.length - 3)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Invalid Recipients List */}
              {campaign.recipients.filter(r => !r.isValid).length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Invalid Recipients</h3>
                  <div className="max-h-48 overflow-y-auto border rounded-lg">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                            Phone Number
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                            Error
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {campaign.recipients.filter(r => !r.isValid).map((recipient) => (
                          <tr key={recipient.id}>
                            <td className="px-3 py-2 text-sm text-gray-900 font-mono">
                              {recipient.phoneNumber.substring(0, 4)}***{recipient.phoneNumber.substring(recipient.phoneNumber.length - 3)}
                            </td>
                            <td className="px-3 py-2 text-sm text-red-600">
                              {recipient.validationError || 'Invalid format'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Analytics Cards (for sent campaigns) */}
              {progress && (
                <>
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <h3 className="text-sm font-medium text-gray-700 mb-2">Delivery Status</h3>
                    <div className="grid grid-cols-5 gap-3">
                      <div className="bg-blue-100 rounded-lg p-3 border border-blue-200">
                        <div className="text-xl font-bold text-blue-900">{progress.totalRecipients}</div>
                        <div className="text-xs text-blue-800 font-medium">Total</div>
                      </div>
                      <div className="bg-yellow-100 rounded-lg p-3 border border-yellow-200">
                        <div className="text-xl font-bold text-yellow-900">{progress.sent}</div>
                        <div className="text-xs text-yellow-800 font-medium">Sent</div>
                        <div className="text-xs text-yellow-700">{progress.totalRecipients > 0 ? ((progress.sent / progress.totalRecipients) * 100).toFixed(1) : 0}%</div>
                      </div>
                      <div className="bg-green-100 rounded-lg p-3 border border-green-200">
                        <div className="text-xl font-bold text-green-900">{progress.delivered}</div>
                        <div className="text-xs text-green-800 font-medium">Delivered</div>
                        <div className="text-xs text-green-700">{progress.deliveryRate.toFixed(1)}%</div>
                      </div>
                      <div className="bg-purple-100 rounded-lg p-3 border border-purple-200">
                        <div className="text-xl font-bold text-purple-900">{progress.read}</div>
                        <div className="text-xs text-purple-800 font-medium">Read</div>
                        <div className="text-xs text-purple-700">{progress.readRate.toFixed(1)}%</div>
                      </div>
                      <div className="bg-red-100 rounded-lg p-3 border border-red-200">
                        <div className="text-xl font-bold text-red-900">{progress.failed}</div>
                        <div className="text-xs text-red-800 font-medium">Failed</div>
                      </div>
                    </div>
                  </div>

                  {campaign.recipients.length > 0 && (
                    <div className="mt-4">
                      <h3 className="text-sm font-medium text-gray-700 mb-2">Recipient Details</h3>
                      <div className="max-h-96 overflow-y-auto border rounded-lg">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50 sticky top-0">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                Phone Number
                              </th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                Status
                              </th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                Sent At
                              </th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                Delivered At
                              </th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                Read At
                              </th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                Error
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {campaign.recipients.map((recipient) => (
                              <tr key={recipient.id}>
                                <td className="px-4 py-2 text-sm text-gray-900 font-mono">
                                  {recipient.phoneNumber}
                                </td>
                                <td className="px-4 py-2 text-sm">
                                  {getStatusBadge(recipient.status)}
                                </td>
                                <td className="px-4 py-2 text-sm text-gray-600">
                                  {recipient.sentAt ? new Date(recipient.sentAt).toLocaleString() : '-'}
                                </td>
                                <td className="px-4 py-2 text-sm text-gray-600">
                                  {recipient.deliveredAt ? new Date(recipient.deliveredAt).toLocaleString() : '-'}
                                </td>
                                <td className="px-4 py-2 text-sm text-gray-600">
                                  {recipient.readAt ? new Date(recipient.readAt).toLocaleString() : '-'}
                                </td>
                                <td className="px-4 py-2 text-sm text-gray-600">
                                  {recipient.errorMessage || '-'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Safety Check Panel */}
            {(campaign.status === 'DRAFT' || campaign.status === 'READY') && safetyCheck && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-sm font-medium text-gray-700 mb-4">Safety Check</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">WhatsApp Account</span>
                    {safetyCheck.whatsappAccountConnected ? (
                      <span className="text-green-600">✓ Connected</span>
                    ) : (
                      <span className="text-red-600">✗ Not Connected</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Template Status</span>
                    {safetyCheck.templateApproved ? (
                      <span className="text-green-600">✓ Approved</span>
                    ) : (
                      <span className="text-red-600">✗ Not Approved</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Valid Recipients</span>
                    {safetyCheck.hasValidRecipients ? (
                      <span className="text-green-600">✓ {safetyCheck.estimatedMessageCount}</span>
                    ) : (
                      <span className="text-red-600">✗ None</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Compliance Confirmed</span>
                    {safetyCheck.complianceConfirmed ? (
                      <span className="text-green-600">✓ Yes</span>
                    ) : (
                      <span className="text-red-600">✗ No</span>
                    )}
                  </div>
                  <div className="pt-3 border-t border-gray-200">
                    <div className="text-xs text-gray-500 mb-1">Estimated Cost</div>
                    <div className="text-sm text-gray-900">{safetyCheck.estimatedCost}</div>
                  </div>
                  <div className="pt-3 border-t border-gray-200">
                    <div className={`px-3 py-2 rounded-lg text-center font-medium ${
                      safetyCheck.allChecksPassed 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {safetyCheck.allChecksPassed ? '✓ All Checks Passed' : '✗ Checks Failed'}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Progress Section */}
            {(campaign.status === 'SENDING' || campaign.status === 'PAUSED' || campaign.status === 'COMPLETED') && progress && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-sm font-medium text-gray-700 mb-4">Campaign Progress</h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                      <div className="text-lg font-bold text-blue-900">{progress.pending}</div>
                      <div className="text-xs text-blue-700 font-medium">Pending</div>
                    </div>
                    <div className="bg-yellow-50 rounded-lg p-3 border border-yellow-200">
                      <div className="text-lg font-bold text-yellow-900">{progress.sent}</div>
                      <div className="text-xs text-yellow-700 font-medium">Sent</div>
                    </div>
                    <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                      <div className="text-lg font-bold text-green-900">{progress.delivered}</div>
                      <div className="text-xs text-green-700 font-medium">Delivered</div>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-3 border border-purple-200">
                      <div className="text-lg font-bold text-purple-900">{progress.read}</div>
                      <div className="text-xs text-purple-700 font-medium">Read</div>
                    </div>
                    <div className="bg-red-50 rounded-lg p-3 border border-red-200">
                      <div className="text-lg font-bold text-red-900">{progress.failed}</div>
                      <div className="text-xs text-red-700 font-medium">Failed</div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                      <div className="text-lg font-bold text-gray-900">{progress.totalRecipients}</div>
                      <div className="text-xs text-gray-700 font-medium">Total</div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Success Rate</span>
                      <span className="font-medium text-gray-900">{progress.successRate.toFixed(1)}%</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Delivery Rate</span>
                      <span className="font-medium text-gray-900">{progress.deliveryRate.toFixed(1)}%</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Read Rate</span>
                      <span className="font-medium text-gray-900">{progress.readRate.toFixed(1)}%</span>
                    </div>
                  </div>
                  {campaign.status === 'SENDING' && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Progress</span>
                        <span className="font-medium text-gray-900">
                          {((progress.sent + progress.delivered + progress.read + progress.failed) / progress.totalRecipients * 100).toFixed(1)}%
                        </span>
                      </div>
                      <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{
                            width: `${((progress.sent + progress.delivered + progress.read + progress.failed) / progress.totalRecipients * 100)}%`
                          }}
                        ></div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Campaign Status */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Campaign Status</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Current Status</span>
                  {getStatusBadge(campaign.status)}
                </div>
                {campaign.status === 'DRAFT' && (
                  <div className="text-xs text-gray-500 mt-2">
                    This campaign is in draft mode. You can edit or delete it before sending.
                  </div>
                )}
                {campaign.status === 'READY' && (
                  <div className="text-xs text-gray-500 mt-2">
                    Campaign is ready to send. Sending will be implemented in Phase 4.2.
                  </div>
                )}
                {campaign.status === 'SENDING' && (
                  <div className="text-xs text-gray-500 mt-2">
                    Campaign is currently sending messages. Progress is updated automatically.
                  </div>
                )}
                {campaign.status === 'PAUSED' && (
                  <div className="text-xs text-gray-500 mt-2">
                    Campaign is paused. You can resume or cancel it.
                  </div>
                )}
                {campaign.status === 'COMPLETED' && (
                  <div className="text-xs text-gray-500 mt-2">
                    Campaign has completed sending messages.
                  </div>
                )}
                {campaign.status === 'CANCELLED' && (
                  <div className="text-xs text-gray-500 mt-2">
                    Campaign was cancelled.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Mark as Ready Confirmation Modal */}
      {showReadyModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Mark Campaign as Ready</h3>
            <p className="text-sm text-gray-600 mb-4">
              You are about to mark this campaign as READY. No messages will be sent yet. A further confirmation will be required in Phase 4.2 before sending.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowReadyModal(false)}
                disabled={actionLoading}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleMarkAsReady}
                disabled={actionLoading}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Send Campaign Confirmation Modal */}
      {showSendModal && campaign && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Send Campaign</h3>
            <p className="text-sm text-gray-600 mb-4">
              You are about to send <strong>{campaign.validRecipientCount}</strong> WhatsApp message(s). This action cannot be undone. Messages will be sent immediately.
            </p>
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <p className="text-sm text-gray-700">
                <strong>Template:</strong> {campaign.template.name}<br />
                <strong>Recipients:</strong> {campaign.validRecipientCount}
              </p>
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowSendModal(false)}
                disabled={sending}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleSendCampaign}
                disabled={sending}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sending ? 'Sending...' : 'Send Now'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
