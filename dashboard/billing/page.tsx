'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Check, Loader2 } from 'lucide-react';

interface Tenant {
  id: string;
  name: string;
  subscriptionPlan: string;
  subscriptionStatus: string;
  trialEndsAt: string | null;
  stripeCustomerId: string | null;
}

interface Invoice {
  id: string;
  amount_paid: number;
  created: number;
  invoice_pdf: string | null;
  hosted_invoice_url: string | null;
  status: string;
  number: string | null;
  currency: string;
}

interface Plan {
  id: string;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  interval: 'MONTHLY' | 'YEARLY';
  stripePriceId: string;
  features: string[];
  category: 'PERSONAL' | 'BUSINESS';
  isActive: boolean;
  isFeatured: boolean;
}

export default function BillingPage() {
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'PERSONAL' | 'BUSINESS'>('PERSONAL');
  const [isNewUser, setIsNewUser] = useState(false);

  useEffect(() => {
    fetchTenant();
    fetchInvoices();
    fetchPlans();
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('success') === 'true') {
      setSuccess(true);
      // Clear URL params
      window.history.replaceState({}, '', window.location.pathname);
    }
    if (urlParams.get('new') === 'true') {
      setIsNewUser(true);
      // Clear URL params
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const fetchTenant = async () => {
    try {
      const res = await fetch('/api/tenant/settings');
      if (!res.ok) {
        if (res.status === 401) {
          window.location.href = '/login';
          return;
        }
        throw new Error('Failed to fetch tenant');
      }
      const data = await res.json();
      setTenant(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load billing information');
    } finally {
      setLoading(false);
    }
  };

  const fetchInvoices = async () => {
    try {
      setInvoicesLoading(true);
      const res = await fetch('/api/billing/invoices');
      if (!res.ok) {
        throw new Error('Failed to fetch invoices');
      }
      const data = await res.json();
      setInvoices(data.invoices || []);
    } catch (err) {
      console.error('Failed to load invoices:', err);
      // Don't set error state for invoices, just log it
    } finally {
      setInvoicesLoading(false);
    }
  };

  const fetchPlans = async () => {
    try {
      setPlansLoading(true);
      const res = await fetch('/api/plans');
      if (!res.ok) {
        throw new Error('Failed to fetch plans');
      }
      const data = await res.json();
      setPlans(data);
    } catch (err) {
      console.error('Failed to load plans:', err);
      setError('Failed to load plans');
    } finally {
      setPlansLoading(false);
    }
  };

  const handleSubscribe = async (stripePriceId: string) => {
    setSubscribing(stripePriceId);
    setError(null);

    // Log coupon code if entered
    if (couponCode.trim()) {
      console.log('Coupon code entered:', couponCode);
    }

    try {
      const res = await fetch('/api/billing/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ stripePriceId }),
      });

      // Check if response is JSON before parsing
      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Server returned an invalid response. Please try again.');
      }

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create checkout session');
      }

      // Redirect to Stripe Checkout
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initiate checkout');
      setSubscribing(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'text-green-600 bg-green-50';
      case 'TRIALING':
        return 'text-blue-600 bg-blue-50';
      case 'PAST_DUE':
        return 'text-yellow-600 bg-yellow-50';
      case 'CANCELED':
        return 'text-red-600 bg-red-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const getTrialDaysRemaining = (trialEndsAt: string | null) => {
    if (!trialEndsAt) return null;
    const trialEnd = new Date(trialEndsAt);
    const now = new Date();
    const diff = trialEnd.getTime() - now.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days > 0 ? days : 0;
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getInvoiceStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'text-green-600 bg-green-50';
      case 'open':
        return 'text-yellow-600 bg-yellow-50';
      case 'void':
        return 'text-gray-600 bg-gray-50';
      case 'uncollectible':
        return 'text-red-600 bg-red-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const handleDownloadPdf = (invoiceId: string) => {
    window.location.href = `/api/billing/invoices/${invoiceId}/download`;
  };

  const filteredPlans = plans.filter((plan) => plan.category === selectedCategory);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto" />
          <p className="mt-4 text-gray-600">Loading billing information...</p>
        </div>
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
              <h1 className="text-xl font-bold text-gray-900">Billing & Plans</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {isNewUser && (
          <div className="bg-blue-600 text-white px-4 py-3 rounded mb-6">
            <div className="flex items-center justify-between">
              <p className="font-medium">
                Welcome! Choose a plan to get started. Select Starter for a 7-day free trial.
              </p>
            </div>
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded mb-6">
            Subscription updated successfully!
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {/* Current Subscription Status */}
        {tenant && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Current Subscription</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-gray-600">Plan</p>
                <p className="text-2xl font-bold text-gray-900">{tenant.subscriptionPlan}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Status</p>
                <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(tenant.subscriptionStatus)}`}>
                  {tenant.subscriptionStatus}
                </span>
              </div>
              <div>
                <p className="text-sm text-gray-600">Trial</p>
                {tenant.subscriptionStatus === 'TRIALING' && tenant.trialEndsAt ? (
                  <p className="text-2xl font-bold text-gray-900">
                    {getTrialDaysRemaining(tenant.trialEndsAt)} days remaining
                  </p>
                ) : (
                  <p className="text-2xl font-bold text-gray-900">-</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Pricing Plans */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Choose Your Plan</h2>
          <p className="text-gray-600 mb-6">All plans include a 7-day free trial. No credit card required to start.</p>

          {/* Tabbed Interface */}
          <div className="flex gap-4 mb-8">
            <button
              onClick={() => setSelectedCategory('PERSONAL')}
              className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                selectedCategory === 'PERSONAL'
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Personal
            </button>
            <button
              onClick={() => setSelectedCategory('BUSINESS')}
              className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                selectedCategory === 'BUSINESS'
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Business
            </button>
          </div>

          {/* Coupon Code Input */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Enter Coupon Code (Optional)
            </label>
            <input
              type="text"
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value)}
              placeholder="e.g., SAVE20"
              className="w-full md:w-64 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {plansLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            </div>
          ) : filteredPlans.length === 0 ? (
            <div className="bg-white rounded-lg shadow-md p-8 text-center">
              <p className="text-gray-600">No plans available for this category. Please contact support.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {filteredPlans.map((plan) => (
                <div
                  key={plan.id}
                  className={`flex flex-col h-full bg-white rounded-lg shadow-md p-6 border-2 ${
                    plan.isFeatured ? 'border-gray-900' : 'border-gray-200'
                  }`}
                >
                  {plan.isFeatured && (
                    <div className="text-xs font-semibold text-gray-900 mb-2">RECOMMENDED</div>
                  )}
                  <h3 className="text-xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                  <div className="mb-4">
                    <span className="text-4xl font-bold text-gray-900">
                      {plan.currency} {plan.price}
                    </span>
                    <span className="text-gray-600">/{plan.interval.toLowerCase()}</span>
                  </div>
                  {plan.description && (
                    <p className="text-gray-600 mb-6">{plan.description}</p>
                  )}

                  <ul className="space-y-3 mb-6 flex-grow">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start">
                        <Check className="h-5 w-5 text-green-600 mr-2 flex-shrink-0" />
                        <span className="text-sm text-gray-700">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-auto">
                    <button
                      onClick={() => handleSubscribe(plan.stripePriceId)}
                      disabled={subscribing === plan.stripePriceId}
                      className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
                        subscribing === plan.stripePriceId
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'bg-gray-900 text-white hover:bg-gray-800'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {subscribing === plan.stripePriceId ? (
                        <span className="flex items-center justify-center">
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Processing...
                        </span>
                      ) : (
                        'Subscribe'
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Billing History */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Billing History</h2>
          <p className="text-gray-600 mb-6">View and download your past invoices.</p>

          {invoicesLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            </div>
          ) : invoices.length === 0 ? (
            <div className="bg-white rounded-lg shadow-md p-8 text-center">
              <p className="text-gray-600">No invoices found</p>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Invoice Number
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Amount
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {invoices.map((invoice) => (
                      <tr key={invoice.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {invoice.number || invoice.id}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {formatDate(invoice.created)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                          {formatCurrency(invoice.amount_paid, invoice.currency)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getInvoiceStatusColor(invoice.status)}`}>
                            {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button
                            onClick={() => handleDownloadPdf(invoice.id)}
                            className="text-blue-600 hover:text-blue-900 font-medium"
                          >
                            Download PDF
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Billing Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="font-semibold text-blue-900 mb-2">Billing Information</h3>
          <ul className="space-y-2 text-sm text-blue-800">
            <li>• Your subscription will automatically renew at the end of each billing period</li>
            <li>• You can cancel your subscription at any time from your Stripe dashboard</li>
            <li>• All prices are in USD</li>
            <li>• For enterprise plans, contact our sales team</li>
          </ul>
        </div>
      </main>
    </div>
  );
}
