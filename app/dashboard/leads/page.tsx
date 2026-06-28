'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Plus, X, DollarSign } from 'lucide-react';

type LeadStage = 'NEW' | 'INTERESTED' | 'FOLLOW_UP' | 'WON' | 'LOST';

interface Lead {
  id: string;
  title: string;
  stage: LeadStage;
  value: number | null;
  contactId: string | null;
  assignedToUserId: string | null;
  createdAt: string;
  updatedAt: string;
  contact?: {
    id: string;
    name: string | null;
    phoneNumber: string;
  };
}

interface CreateLeadFormData {
  title: string;
  stage: LeadStage;
  value: string;
}

const STAGES: { key: LeadStage; label: string; color: string }[] = [
  { key: 'NEW', label: 'New', color: 'bg-blue-100 border-blue-300' },
  { key: 'INTERESTED', label: 'Interested', color: 'bg-yellow-100 border-yellow-300' },
  { key: 'FOLLOW_UP', label: 'Follow Up', color: 'bg-orange-100 border-orange-300' },
  { key: 'WON', label: 'Won', color: 'bg-green-100 border-green-300' },
  { key: 'LOST', label: 'Lost', color: 'bg-red-100 border-red-300' },
];

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createFormData, setCreateFormData] = useState<CreateLeadFormData>({
    title: '',
    stage: 'NEW',
    value: '',
  });
  const [creating, setCreating] = useState(false);
  const [draggedLeadId, setDraggedLeadId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchLeads = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/leads');
      if (res.ok) {
        const data = await res.json();
        setLeads(data);
      }
    } catch (err) {
      console.error('Failed to fetch leads:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, []);

  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!createFormData.title.trim()) {
      setError('Title is required');
      return;
    }

    try {
      setCreating(true);
      setError(null);
      
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: createFormData.title,
          stage: createFormData.stage,
          value: createFormData.value ? parseFloat(createFormData.value) : null,
        }),
      });

      if (res.ok) {
        setShowCreateForm(false);
        setCreateFormData({ title: '', stage: 'NEW', value: '' });
        fetchLeads();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to create lead');
      }
    } catch (err) {
      setError('Failed to create lead');
    } finally {
      setCreating(false);
    }
  };

  const handleStageChange = async (leadId: string, newStage: LeadStage) => {
    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: newStage }),
      });

      if (res.ok) {
        fetchLeads();
      }
    } catch (err) {
      console.error('Failed to update lead stage:', err);
    }
  };

  const handleDragStart = (e: React.DragEvent, leadId: string) => {
    setDraggedLeadId(leadId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, stage: LeadStage) => {
    e.preventDefault();
    if (draggedLeadId) {
      handleStageChange(draggedLeadId, stage);
      setDraggedLeadId(null);
    }
  };

  const getLeadsByStage = (stage: LeadStage) => {
    return leads.filter((lead) => lead.stage === stage);
  };

  const formatValue = (value: number | null) => {
    if (value === null) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <Link
            href="/dashboard"
            className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-4"
          >
            ← Back to Dashboard
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Lead Pipeline</h1>
              <p className="mt-2 text-gray-600">Manage your sales leads through the pipeline</p>
            </div>
            <button
              onClick={() => setShowCreateForm(true)}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="h-5 w-5" />
              Create Lead
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {/* Create Lead Form Modal */}
        {showCreateForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-md p-6 w-full max-w-md">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900">Create New Lead</h2>
                <button
                  onClick={() => setShowCreateForm(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <form onSubmit={handleCreateLead} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">
                    Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={createFormData.title}
                    onChange={(e) => setCreateFormData({ ...createFormData, title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800"
                    placeholder="Lead title"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">
                    Stage
                  </label>
                  <select
                    value={createFormData.stage}
                    onChange={(e) => setCreateFormData({ ...createFormData, stage: e.target.value as LeadStage })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800"
                  >
                    {STAGES.map((stage) => (
                      <option key={stage.key} value={stage.key}>
                        {stage.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-900 mb-1">
                    Value (USD)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={createFormData.value}
                    onChange={(e) => setCreateFormData({ ...createFormData, value: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800"
                    placeholder="0.00"
                  />
                </div>
                <div className="flex gap-2 pt-4">
                  <button
                    type="submit"
                    disabled={creating}
                    className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {creating ? 'Creating...' : 'Create Lead'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCreateForm(false)}
                    className="flex-1 bg-gray-200 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-300 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Kanban Board */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-4">
            {STAGES.map((stage) => {
              const stageLeads = getLeadsByStage(stage.key);
              return (
                <div
                  key={stage.key}
                  className={`flex-shrink-0 w-80 ${stage.color} border-2 rounded-lg p-4`}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, stage.key)}
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-gray-900">{stage.label}</h3>
                    <span className="bg-white bg-opacity-50 text-gray-700 text-sm px-2 py-1 rounded-full">
                      {stageLeads.length}
                    </span>
                  </div>
                  <div className="space-y-3 min-h-[200px]">
                    {stageLeads.length === 0 ? (
                      <div className="text-center py-8 text-gray-600 text-sm">
                        No leads yet
                      </div>
                    ) : (
                      stageLeads.map((lead) => (
                        <div
                          key={lead.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, lead.id)}
                          className="bg-white rounded-lg shadow-sm p-4 cursor-move hover:shadow-md transition-shadow border border-gray-200"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <h4 className="font-medium text-gray-900 flex-1">{lead.title}</h4>
                            <select
                              value={lead.stage}
                              onChange={(e) => handleStageChange(lead.id, e.target.value as LeadStage)}
                              className="text-xs border border-gray-300 rounded px-2 py-1 text-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            >
                              {STAGES.map((s) => (
                                <option key={s.key} value={s.key}>
                                  {s.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          {lead.value !== null && (
                            <div className="flex items-center gap-1 text-sm text-gray-600 mb-2">
                              <DollarSign className="h-4 w-4" />
                              <span>{formatValue(lead.value)}</span>
                            </div>
                          )}
                          {lead.contact && (
                            <div className="text-sm text-gray-600">
                              <div>{lead.contact.name || 'No name'}</div>
                              <div className="text-xs">{lead.contact.phoneNumber}</div>
                            </div>
                          )}
                          <div className="text-xs text-gray-400 mt-2">
                            {new Date(lead.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
