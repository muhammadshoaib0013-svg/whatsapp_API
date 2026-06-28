import Link from 'next/link';
import { MessageSquare, Bot, Send, Users, BarChart3, Zap } from 'lucide-react';

export default function FeaturesPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold text-gray-900">
            WhatsApp Automation SaaS
          </Link>
          <Link
            href="/dashboard"
            className="text-gray-600 hover:text-gray-900 mb-8 inline-flex items-center gap-2"
          >
            ← Back to Dashboard
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              Powerful Features for Modern Businesses
            </h1>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Scale your customer engagement with AI-powered chatbots, team inbox, CRM tools, and automated campaigns.
            </p>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Team Inbox */}
            <div className="bg-white rounded-lg shadow-md p-8 hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                <MessageSquare className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Team Inbox</h3>
              <p className="text-gray-600">
                Centralize all WhatsApp conversations in one place. Assign chats to team members, track response times, and collaborate seamlessly.
              </p>
            </div>

            {/* AI Chatbot */}
            <div className="bg-white rounded-lg shadow-md p-8 hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                <Bot className="w-6 h-6 text-purple-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">AI Chatbot</h3>
              <p className="text-gray-600">
                Automate responses with intelligent chatbots. Set up rules, train with your data, and provide 24/7 customer support.
              </p>
            </div>

            {/* Campaigns */}
            <div className="bg-white rounded-lg shadow-md p-8 hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                <Send className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Campaigns</h3>
              <p className="text-gray-600">
                Send bulk messages to your contacts with WhatsApp Business API templates. Track delivery, read receipts, and engagement metrics.
              </p>
            </div>

            {/* CRM */}
            <div className="bg-white rounded-lg shadow-md p-8 hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center mb-4">
                <Users className="w-6 h-6 text-orange-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">CRM & Lead Pipeline</h3>
              <p className="text-gray-600">
                Manage contacts and leads with a visual Kanban board. Track prospects through your sales funnel and convert more deals.
              </p>
            </div>

            {/* Analytics */}
            <div className="bg-white rounded-lg shadow-md p-8 hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center mb-4">
                <BarChart3 className="w-6 h-6 text-indigo-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Analytics</h3>
              <p className="text-gray-600">
                Get detailed insights into your messaging performance. Track costs, delivery rates, and customer engagement metrics.
              </p>
            </div>

            {/* Automation */}
            <div className="bg-white rounded-lg shadow-md p-8 hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center mb-4">
                <Zap className="w-6 h-6 text-yellow-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Automation</h3>
              <p className="text-gray-600">
                Automate workflows with triggers and actions. Connect with Shopify and other platforms for seamless integrations.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gray-50">
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-8 max-w-2xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            Ready to Transform Your Customer Engagement?
          </h2>
          <p className="text-xl text-gray-600 mb-8">
            Start your 7-day free trial today. No credit card required.
          </p>
          <Link
            href="/signup"
            className="inline-flex items-center justify-center px-8 py-4 border border-transparent text-lg font-semibold rounded-lg text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-lg"
          >
            Get Started Free
          </Link>
        </div>
      </section>
    </div>
  );
}
