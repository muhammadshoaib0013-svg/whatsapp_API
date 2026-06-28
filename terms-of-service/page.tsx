import Link from 'next/link';

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Link
          href="/dashboard"
          className="text-gray-600 hover:text-gray-900 mb-8 inline-flex items-center gap-2"
        >
          ← Back to Dashboard
        </Link>
        
        <h1 className="text-4xl font-bold text-gray-900 mb-8">Terms of Service</h1>
        
        <div className="bg-white rounded-lg shadow-md p-8 prose prose-lg max-w-none">
          <p className="text-gray-600 mb-6">
            Last Updated: {new Date().toLocaleDateString()}
          </p>

          <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">1. Acceptance of Terms</h2>
          <p className="text-gray-700 mb-4">
            By accessing or using WhatsApp Automation SaaS (&ldquo;the Service&rdquo;), you agree to be bound by these Terms of Service (&ldquo;Terms&rdquo;). If you do not agree to these Terms, you may not use the Service.
          </p>

          <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">2. Description of Service</h2>
          <p className="text-gray-700 mb-4">
            WhatsApp Automation SaaS provides a platform for businesses to automate WhatsApp messaging through the official WhatsApp Business API. Our services include:
          </p>
          <ul className="list-disc pl-6 text-gray-700 mb-4 space-y-2">
            <li>WhatsApp message sending and receiving</li>
            <li>AI-powered chatbot automation</li>
            <li>Team inbox and collaboration tools</li>
            <li>CRM and contact management</li>
            <li>Campaign management</li>
            <li>Analytics and reporting</li>
          </ul>

          <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">3. Account Registration</h2>
          <p className="text-gray-700 mb-4">
            To use the Service, you must:
          </p>
          <ul className="list-disc pl-6 text-gray-700 mb-4 space-y-2">
            <li>Be at least 18 years old</li>
            <li>Provide accurate and complete information</li>
            <li>Maintain the security of your account credentials</li>
            <li>Notify us immediately of any unauthorized use</li>
          </ul>

          <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">4. Subscription and Billing</h2>
          
          <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">4.1 Subscription Plans</h3>
          <p className="text-gray-700 mb-4">
            We offer various subscription plans with different features and message limits. You agree to pay the fees for the plan you select.
          </p>

          <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">4.2 Payment Terms</h3>
          <p className="text-gray-700 mb-4">
            Subscription fees are billed monthly or annually, depending on your chosen plan. You authorize us to charge your payment method for the subscription fees.
          </p>

          <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">4.3 Refund Policy</h3>
          <p className="text-gray-700 mb-4">
            Refunds are handled on a case-by-case basis. Please contact our support team for refund requests. Unused message credits are non-refundable.
          </p>

          <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">4.4 Cancellation</h3>
          <p className="text-gray-700 mb-4">
            You may cancel your subscription at any time. Cancellation will take effect at the end of the current billing period. No refunds will be provided for partial months.
          </p>

          <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">5. Fair Usage Policy</h2>
          <p className="text-gray-700 mb-4">
            To ensure fair usage of our platform, we have established the following policies:
          </p>
          <ul className="list-disc pl-6 text-gray-700 mb-4 space-y-2">
            <li>Message limits are enforced per subscription plan</li>
            <li>Excessive API requests may be rate-limited</li>
            <li>Storage limits apply to contacts and message logs</li>
            <li>We reserve the right to suspend accounts that violate fair usage policies</li>
          </ul>

          <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">6. No-Spam Policy</h2>
          <p className="text-gray-700 mb-4">
            We strictly prohibit spam and unsolicited messaging. You agree to:
          </p>
          <ul className="list-disc pl-6 text-gray-700 mb-4 space-y-2">
            <li>Only send messages to users who have opted in to receive communications</li>
            <li>Comply with WhatsApp&apos;s Business Messaging Policy</li>
            <li>Provide opt-out mechanisms in your messages</li>
            <li>Not use our platform for marketing to purchased contact lists without consent</li>
          </ul>
          <p className="text-gray-700 mb-4">
            Violation of this policy may result in immediate account termination and potential legal action.
          </p>

          <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">7. WhatsApp Business API Compliance</h2>
          <p className="text-gray-700 mb-4">
            Our platform integrates with the official WhatsApp Business API. You agree to:
          </p>
          <ul className="list-disc pl-6 text-gray-700 mb-4 space-y-2">
            <li>Comply with Meta&apos;s WhatsApp Business Policy</li>
            <li>Use templates approved by WhatsApp</li>
            <li>Maintain high message quality ratings</li>
            <li>Respond to customer messages within 24 hours</li>
          </ul>

          <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">8. User Responsibilities</h2>
          <p className="text-gray-700 mb-4">
            You are responsible for:
          </p>
          <ul className="list-disc pl-6 text-gray-700 mb-4 space-y-2">
            <li>All content you send through our platform</li>
            <li>Maintaining the confidentiality of your account</li>
            <li>Complying with all applicable laws and regulations</li>
            <li>Not using our platform for illegal activities</li>
          </ul>

          <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">9. Intellectual Property</h2>
          <p className="text-gray-700 mb-4">
            All content, features, and functionality of the Service are owned by WhatsApp Automation SaaS and are protected by international copyright, trademark, and other intellectual property laws.
          </p>

          <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">10. Limitation of Liability</h2>
          <p className="text-gray-700 mb-4">
            To the maximum extent permitted by law, WhatsApp Automation SaaS shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses.
          </p>

          <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">11. Indemnification</h2>
          <p className="text-gray-700 mb-4">
            You agree to indemnify and hold harmless WhatsApp Automation SaaS from any claims arising from your use of the Service or violation of these Terms.
          </p>

          <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">12. Termination</h2>
          <p className="text-gray-700 mb-4">
            We reserve the right to terminate or suspend your account at any time for violation of these Terms or for any other reason at our sole discretion.
          </p>

          <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">13. Governing Law</h2>
          <p className="text-gray-700 mb-4">
            These Terms shall be governed by and construed in accordance with the laws of the jurisdiction in which WhatsApp Automation SaaS is registered, without regard to its conflict of law provisions.
          </p>

          <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">14. Changes to Terms</h2>
          <p className="text-gray-700 mb-4">
            We may modify these Terms at any time. Continued use of the Service after modifications constitutes your acceptance of the updated Terms.
          </p>

          <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">15. Contact Information</h2>
          <p className="text-gray-700 mb-4">
            If you have any questions about these Terms, please contact us at:
          </p>
          <p className="text-gray-700 mb-4">
            Email: support@whatsapp-automation-saas.com
          </p>
        </div>
      </div>
    </div>
  );
}
