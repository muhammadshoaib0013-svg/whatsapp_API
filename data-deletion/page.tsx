import Link from 'next/link';

export default function DataDeletionPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Link
          href="/dashboard"
          className="text-gray-600 hover:text-gray-900 mb-8 inline-flex items-center gap-2"
        >
          ← Back to Dashboard
        </Link>
        
        <h1 className="text-4xl font-bold text-gray-900 mb-8">Data Deletion Request</h1>
        
        <div className="bg-white rounded-lg shadow-md p-8 prose prose-lg max-w-none">
          <p className="text-gray-600 mb-6">
            Last Updated: {new Date().toLocaleDateString()}
          </p>

          <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">Your Right to Data Deletion</h2>
          <p className="text-gray-700 mb-4">
            At WhatsApp Automation SaaS, we respect your privacy and your right to control your personal data. You have the right to request the deletion of your personal data from our systems.
          </p>

          <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">What Data Can Be Deleted</h2>
          <p className="text-gray-700 mb-4">
            Upon your request, we can delete the following data associated with your account:
          </p>
          <ul className="list-disc pl-6 text-gray-700 mb-4 space-y-2">
            <li>Account information (name, email, organization details)</li>
            <li>Contact records and CRM data</li>
            <li>Message logs and history</li>
            <li>Campaign data and templates</li>
            <li>Team member information</li>
            <li>API keys and authentication tokens</li>
            <li>Support tickets and communication history</li>
          </ul>

          <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">How to Request Data Deletion</h2>
          
          <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">Option 1: Email Request</h3>
          <p className="text-gray-700 mb-4">
            Send an email to our support team with the following information:
          </p>
          <div className="bg-gray-100 p-4 rounded-lg mb-4">
            <p className="text-gray-900 font-semibold mb-2">Email: support@whatsapp-automation-saas.com</p>
            <p className="text-gray-700 mb-2">Subject: Data Deletion Request</p>
            <p className="text-gray-700 mb-2">Please include:</p>
            <ul className="list-disc pl-6 text-gray-700 space-y-1">
              <li>Your registered email address</li>
              <li>Your organization name</li>
              <li>Confirmation that you are the account owner</li>
              <li>Specific data you want deleted (or all data)</li>
            </ul>
          </div>

          <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">Option 2: In-App Request</h3>
          <p className="text-gray-700 mb-4">
            If you have an active account, you can also request data deletion through our support system:
          </p>
          <ol className="list-decimal pl-6 text-gray-700 mb-4 space-y-2">
            <li>Log in to your dashboard</li>
            <li>Navigate to the Support page</li>
            <li>Create a new support ticket with the subject &ldquo;Data Deletion Request&rdquo;</li>
            <li>Include the details mentioned above</li>
          </ol>

          <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">Deletion Process Timeline</h2>
          <p className="text-gray-700 mb-4">
            Once we receive your deletion request:
          </p>
          <ul className="list-disc pl-6 text-gray-700 mb-4 space-y-2">
            <li>We will verify your identity as the account owner</li>
            <li>We will process your request within 30 days</li>
            <li>You will receive a confirmation email when deletion is complete</li>
            <li>All data will be permanently deleted from our systems</li>
          </ul>

          <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">Important Notes</h2>
          <ul className="list-disc pl-6 text-gray-700 mb-4 space-y-2">
            <li><strong>Irreversible Action:</strong> Data deletion is permanent and cannot be undone. Please ensure you have exported any data you need before requesting deletion.</li>
            <li><strong>Account Termination:</strong> Requesting deletion of all data will result in the termination of your account and loss of access to our services.</li>
            <li><strong>Billing:</strong> Any outstanding fees must be paid before data deletion can be processed.</li>
            <li><strong>Legal Requirements:</strong> We may retain certain data if required by law or for legitimate business purposes (e.g., fraud prevention, legal disputes).</li>
            <li><strong>WhatsApp Data:</strong> Message data stored with Meta/WhatsApp may require separate deletion requests through their channels.</li>
          </ul>

          <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">Data Export Before Deletion</h2>
          <p className="text-gray-700 mb-4">
            Before requesting deletion, we recommend exporting your data. You can export:
          </p>
          <ul className="list-disc pl-6 text-gray-700 mb-4 space-y-2">
            <li>Contacts from the Contacts page</li>
            <li>Message logs from the Message Logs page</li>
            <li>Campaign reports from the Campaigns page</li>
          </ul>
          <p className="text-gray-700 mb-4">
            If you need assistance with data export, please contact our support team.
          </p>

          <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">Contact Information</h2>
          <p className="text-gray-700 mb-4">
            If you have any questions about the data deletion process or need assistance, please contact us:
          </p>
          <div className="bg-gray-100 p-4 rounded-lg">
            <p className="text-gray-900 font-semibold mb-2">Email: support@whatsapp-automation-saas.com</p>
            <p className="text-gray-700">Response Time: Within 24-48 hours</p>
          </div>
        </div>
      </div>
    </div>
  );
}
