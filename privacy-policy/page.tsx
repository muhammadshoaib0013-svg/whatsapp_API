import Link from 'next/link';

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Link
          href="/dashboard"
          className="text-gray-600 hover:text-gray-900 mb-8 inline-flex items-center gap-2"
        >
          ← Back to Dashboard
        </Link>
        
        <h1 className="text-4xl font-bold text-gray-900 mb-8">Privacy Policy</h1>
        
        <div className="bg-white rounded-lg shadow-md p-8 prose prose-lg max-w-none">
          <p className="text-gray-600 mb-6">
            Last Updated: {new Date().toLocaleDateString()}
          </p>

          <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">1. Introduction</h2>
          <p className="text-gray-700 mb-4">
            Welcome to WhatsApp Automation SaaS (&ldquo;we,&rdquo; &ldquo;our,&rdquo; or &ldquo;us&rdquo;). We are committed to protecting your privacy and ensuring the security of your personal information. This Privacy Policy explains how we collect, use, and protect your data when you use our platform.
          </p>

          <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">2. Information We Collect</h2>
          
          <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">2.1 Account Information</h3>
          <p className="text-gray-700 mb-4">
            When you create an account, we collect your name, email address, and organization details. This information is used to create your account and provide our services.
          </p>

          <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">2.2 WhatsApp Data</h3>
          <p className="text-gray-700 mb-4">
            Through our integration with the WhatsApp Business API, we collect and process:
          </p>
          <ul className="list-disc pl-6 text-gray-700 mb-4 space-y-2">
            <li>Message logs (sent, delivered, read status)</li>
            <li>Customer phone numbers and names (when provided)</li>
            <li>Message content and templates</li>
            <li>Media files shared through WhatsApp</li>
          </ul>

          <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">2.3 Contact Data</h3>
          <p className="text-gray-700 mb-4">
            If you use our CRM features, we store contact information including names, phone numbers, tags, and custom fields that you provide.
          </p>

          <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">3. How We Use Your Information</h2>
          <ul className="list-disc pl-6 text-gray-700 mb-4 space-y-2">
            <li>To provide and maintain our WhatsApp automation services</li>
            <li>To process and deliver WhatsApp messages</li>
            <li>To manage your account and billing</li>
            <li>To provide customer support</li>
            <li>To improve our services and develop new features</li>
            <li>To comply with legal obligations</li>
          </ul>

          <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">4. Data Security</h2>
          <p className="text-gray-700 mb-4">
            We implement industry-standard security measures to protect your data:
          </p>
          <ul className="list-disc pl-6 text-gray-700 mb-4 space-y-2">
            <li>Encryption of data in transit and at rest</li>
            <li>Secure authentication and access controls</li>
            <li>Regular security audits and updates</li>
            <li>Tenant isolation to ensure data separation</li>
          </ul>

          <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">5. WhatsApp Business API Compliance</h2>
          <p className="text-gray-700 mb-4">
            Our platform is built on the official WhatsApp Business API and complies with Meta&apos;s Business Messaging Policy. We do not:
          </p>
          <ul className="list-disc pl-6 text-gray-700 mb-4 space-y-2">
            <li>Send unsolicited promotional messages</li>
            <li>Share your data with third parties for marketing</li>
            <li>Use your data for purposes other than providing our services</li>
          </ul>

          <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">6. Your Rights</h2>
          <p className="text-gray-700 mb-4">
            You have the right to:
          </p>
          <ul className="list-disc pl-6 text-gray-700 mb-4 space-y-2">
            <li>Access your personal data</li>
            <li>Correct inaccurate data</li>
            <li>Request deletion of your data</li>
            <li>Opt-out of marketing communications</li>
            <li>Export your data</li>
          </ul>

          <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">7. Data Retention</h2>
          <p className="text-gray-700 mb-4">
            We retain your data for as long as necessary to provide our services and comply with legal obligations. When you delete your account, we will delete your data within 30 days, except where required by law.
          </p>

          <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">8. Third-Party Services</h2>
          <p className="text-gray-700 mb-4">
            We use third-party services to operate our platform, including:
          </p>
          <ul className="list-disc pl-6 text-gray-700 mb-4 space-y-2">
            <li>Meta (WhatsApp Business API)</li>
            <li>Payment processors (Stripe)</li>
            <li>Cloud infrastructure providers</li>
          </ul>
          <p className="text-gray-700 mb-4">
            These third parties have access to your data only as necessary to provide their services and are bound by confidentiality obligations.
          </p>

          <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">9. International Data Transfers</h2>
          <p className="text-gray-700 mb-4">
            Your data may be transferred to and processed in countries other than your country of residence. We ensure appropriate safeguards are in place to protect your data in accordance with applicable data protection laws.
          </p>

          <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">10. Children&apos;s Privacy</h2>
          <p className="text-gray-700 mb-4">
            Our services are not intended for children under the age of 16. We do not knowingly collect personal information from children under 16.
          </p>

          <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">11. Changes to This Policy</h2>
          <p className="text-gray-700 mb-4">
            We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new policy on this page and updating the &ldquo;Last Updated&rdquo; date.
          </p>

          <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">12. Contact Us</h2>
          <p className="text-gray-700 mb-4">
            If you have any questions about this Privacy Policy or our data practices, please contact us at:
          </p>
          <p className="text-gray-700 mb-4">
            Email: support@whatsapp-automation-saas.com
          </p>
        </div>
      </div>
    </div>
  );
}
