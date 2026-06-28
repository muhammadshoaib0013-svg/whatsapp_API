'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Book, Code, Send, FileText, Users, Megaphone } from 'lucide-react';

interface ApiEndpoint {
  id: string;
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string;
  description: string;
  requestExample: string;
  responseExample: string;
  category: string;
}

const ENDPOINTS: ApiEndpoint[] = [
  {
    id: 'auth',
    method: 'POST',
    path: '/api/v1/messages/send',
    category: 'Send Message',
    description: 'Send a WhatsApp template message to a phone number.',
    requestExample: `{
  "to": "+1234567890",
  "templateName": "welcome_message",
  "variables": {
    "name": "John Doe"
  }
}`,
    responseExample: `{
  "success": true,
  "messageId": "msg_abc123",
  "status": "sent"
}`,
  },
  {
    id: 'contacts-create',
    method: 'POST',
    path: '/api/v1/contacts',
    category: 'Contacts',
    description: 'Create a new contact in your database.',
    requestExample: `{
  "name": "John Doe",
  "phoneNumber": "+1234567890",
  "tags": ["vip", "customer"]
}`,
    responseExample: `{
  "id": "contact_abc123",
  "name": "John Doe",
  "phoneNumber": "+1234567890",
  "tags": ["vip", "customer"],
  "createdAt": "2024-01-01T00:00:00Z"
}`,
  },
  {
    id: 'contacts-list',
    method: 'GET',
    path: '/api/v1/contacts',
    category: 'Contacts',
    description: 'List all contacts with optional search.',
    requestExample: `// Query parameters
?search=john`,
    responseExample: `{
  "contacts": [
    {
      "id": "contact_abc123",
      "name": "John Doe",
      "phoneNumber": "+1234567890",
      "tags": ["vip", "customer"]
    }
  ]
}`,
  },
  {
    id: 'campaigns-create',
    method: 'POST',
    path: '/api/v1/campaigns',
    category: 'Campaigns',
    description: 'Create and launch a new campaign.',
    requestExample: `{
  "name": "Summer Sale",
  "templateName": "summer_promo",
  "recipientGroup": "all_contacts"
}`,
    responseExample: `{
  "id": "campaign_abc123",
  "name": "Summer Sale",
  "status": "pending",
  "recipientCount": 150
}`,
  },
];

const CATEGORIES = [
  { id: 'all', label: 'All Endpoints', icon: Book },
  { id: 'Send Message', label: 'Send Message', icon: Send },
  { id: 'Contacts', label: 'Contacts', icon: Users },
  { id: 'Campaigns', label: 'Campaigns', icon: Megaphone },
];

const METHOD_COLORS = {
  GET: 'bg-green-100 text-green-800 border-green-300',
  POST: 'bg-blue-100 text-blue-800 border-blue-300',
  PATCH: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  DELETE: 'bg-red-100 text-red-800 border-red-300',
};

export default function ApiDocsPage() {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedEndpoint, setSelectedEndpoint] = useState<ApiEndpoint | null>(ENDPOINTS[0]);

  const filteredEndpoints = selectedCategory === 'all'
    ? ENDPOINTS
    : ENDPOINTS.filter((ep) => ep.category === selectedCategory);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Link href="/dashboard" className="text-gray-600 hover:text-gray-900 mr-4">
                ← Back to Dashboard
              </Link>
              <h1 className="text-xl font-bold text-gray-900">API Documentation</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Authentication Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
            <Code className="h-5 w-5 text-blue-600" />
            Authentication
          </h2>
          <p className="text-gray-700 mb-4">
            All API endpoints require authentication using your API key. Include your API key in the Authorization header as a Bearer token.
          </p>
          <div className="bg-gray-900 text-gray-100 rounded-lg p-4 font-mono text-sm overflow-x-auto">
            <span className="text-purple-400">Authorization:</span> Bearer wa_live_your_api_key_here
          </div>
        </div>

        <div className="flex gap-6">
          {/* Sidebar */}
          <div className="w-64 flex-shrink-0">
            <nav className="bg-white rounded-lg shadow-md p-4 sticky top-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3 uppercase tracking-wider">
                Categories
              </h3>
              <ul className="space-y-2">
                {CATEGORIES.map((category) => {
                  const Icon = category.icon;
                  return (
                    <li key={category.id}>
                      <button
                        onClick={() => setSelectedCategory(category.id)}
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                          selectedCategory === category.id
                            ? 'bg-blue-100 text-blue-900'
                            : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        {category.label}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </nav>
          </div>

          {/* Main Content */}
          <div className="flex-1">
            {/* Endpoint List */}
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Endpoints</h3>
              <div className="space-y-3">
                {filteredEndpoints.map((endpoint) => (
                  <button
                    key={endpoint.id}
                    onClick={() => setSelectedEndpoint(endpoint)}
                    className={`w-full text-left p-4 rounded-lg border-2 transition-colors ${
                      selectedEndpoint?.id === endpoint.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <span
                        className={`px-2 py-1 text-xs font-semibold rounded border ${METHOD_COLORS[endpoint.method]}`}
                      >
                        {endpoint.method}
                      </span>
                      <code className="text-sm text-gray-900 font-mono">{endpoint.path}</code>
                    </div>
                    <p className="text-sm text-gray-600">{endpoint.description}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Endpoint Details */}
            {selectedEndpoint && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center gap-3 mb-6">
                  <span
                    className={`px-3 py-1 text-sm font-semibold rounded border ${METHOD_COLORS[selectedEndpoint.method]}`}
                  >
                    {selectedEndpoint.method}
                  </span>
                  <code className="text-lg text-gray-900 font-mono">{selectedEndpoint.path}</code>
                </div>

                <p className="text-gray-700 mb-6">{selectedEndpoint.description}</p>

                {/* Request Example */}
                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                    <Code className="h-4 w-4" />
                    Request Example
                  </h4>
                  <div className="bg-gray-900 text-gray-100 rounded-lg p-4 font-mono text-sm overflow-x-auto">
                    <pre>{selectedEndpoint.requestExample}</pre>
                  </div>
                </div>

                {/* Response Example */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Response Example
                  </h4>
                  <div className="bg-gray-900 text-gray-100 rounded-lg p-4 font-mono text-sm overflow-x-auto">
                    <pre>{selectedEndpoint.responseExample}</pre>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
