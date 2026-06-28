'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';

interface Contact {
  id: string;
  name: string;
  phoneNumber: string;
  tags: string[];
  createdAt: string;
}

export default function ContactsPage() {
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [result, setResult] = useState<{ imported: number; total: number; errors?: string[] } | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchContacts = useCallback(async () => {
    try {
      setContactsLoading(true);
      const url = searchQuery
        ? `/api/contacts?search=${encodeURIComponent(searchQuery)}`
        : '/api/contacts';
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error('Failed to fetch contacts');
      }
      const data = await res.json();
      setContacts(data);
    } catch (err) {
      console.error('Failed to load contacts:', err);
    } finally {
      setContactsLoading(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      fetchContacts();
    }, 300);
    return () => clearTimeout(debounceTimer);
  }, [searchQuery, fetchContacts]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.name.endsWith('.csv')) {
        setError('Please select a CSV file');
        setFile(null);
        return;
      }
      setFile(selectedFile);
      setError(null);
      setSuccess(null);
      setResult(null);
    }
  };

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!file) {
      setError('Please select a file to import');
      return;
    }

    try {
      setImporting(true);
      setError(null);
      setSuccess(null);
      setResult(null);

      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/contacts/import', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (res.ok) {
        setSuccess(data.message);
        setResult({
          imported: data.imported,
          total: data.total,
          errors: data.errors,
        });
        setFile(null);
        // Reset file input
        const fileInput = document.getElementById('csvFile') as HTMLInputElement;
        if (fileInput) {
          fileInput.value = '';
        }
        // Refresh contacts list
        fetchContacts();
      } else {
        setError(data.error || 'Failed to import contacts');
        if (data.errors) {
          setError(`${data.error}: ${data.errors.join(', ')}`);
        }
      }
    } catch (err) {
      setError('Failed to import contacts');
    } finally {
      setImporting(false);
    }
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
          <h1 className="text-3xl font-bold text-gray-900">Contacts</h1>
          <p className="mt-2 text-gray-600">Manage your contacts and import from CSV</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded mb-6">
            {success}
          </div>
        )}

        {/* Contacts Table */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900">All Contacts</h2>
            <div className="w-64">
              <input
                type="text"
                placeholder="Search by name or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
              />
            </div>
          </div>

          {contactsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            </div>
          ) : contacts.length === 0 ? (
            <div className="text-center py-8 text-gray-600">
              No contacts found. Import contacts from CSV to get started.
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
                      Phone Number
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tags
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created At
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {contacts.map((contact) => (
                    <tr key={contact.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                        {contact.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {contact.phoneNumber}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {contact.tags.length > 0 ? (
                          <div className="flex gap-1 flex-wrap">
                            {contact.tags.map((tag, index) => (
                              <span
                                key={index}
                                className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {new Date(contact.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Import Form */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Import CSV</h2>
          
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 className="font-medium text-gray-900 mb-2">CSV Format Requirements:</h3>
            <ul className="text-sm text-gray-700 list-disc list-inside space-y-1">
              <li>File must be in CSV format</li>
              <li>Required columns: <code className="bg-gray-200 px-1 rounded text-gray-900">name</code>, <code className="bg-gray-200 px-1 rounded text-gray-900">phoneNumber</code></li>
              <li>Optional column: <code className="bg-gray-200 px-1 rounded text-gray-900">tags</code> (comma-separated)</li>
              <li>Phone numbers must be in E.164 format (e.g., +1234567890)</li>
            </ul>
          </div>

          <form onSubmit={handleImport} className="space-y-4">
            <div>
              <label htmlFor="csvFile" className="block text-sm font-medium text-gray-700 mb-1">
                Select CSV File
              </label>
              <input
                type="file"
                id="csvFile"
                accept=".csv"
                onChange={handleFileChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              {file && (
                <p className="mt-2 text-sm text-gray-600">
                  Selected: {file.name} ({(file.size / 1024).toFixed(2)} KB)
                </p>
              )}
            </div>
            <button
              type="submit"
              disabled={!file || importing}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {importing ? 'Importing...' : 'Import Contacts'}
            </button>
          </form>
        </div>

        {/* Import Results */}
        {result && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Import Results</h2>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Total rows in CSV:</span>
                <span className="font-medium">{result.total}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Successfully imported:</span>
                <span className="font-medium text-green-600">{result.imported}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Failed:</span>
                <span className="font-medium text-red-600">{result.total - result.imported}</span>
              </div>
            </div>

            {result.errors && result.errors.length > 0 && (
              <div className="mt-4">
                <h3 className="font-medium text-gray-900 mb-2">Errors:</h3>
                <div className="max-h-40 overflow-y-auto bg-red-50 border border-red-200 rounded p-3">
                  <ul className="text-sm text-red-700 space-y-1">
                    {result.errors.map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Sample CSV */}
        <div className="mt-8 bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Sample CSV Format</h2>
          <pre className="bg-gray-50 p-4 rounded-lg overflow-x-auto text-sm text-gray-900">
{`name,phoneNumber,tags
John Doe,+1234567890,customer,vip
Jane Smith,+1987654321,lead
Bob Johnson,+15551234567,customer`}
          </pre>
        </div>
      </div>
    </div>
  );
}
