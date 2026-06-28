import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { requireSuperAdmin } from '@/lib/auth/super-admin';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  try {
    requireSuperAdmin(session);
  } catch (error) {
    // Redirect to tenant dashboard if not SUPER_ADMIN
    redirect('/dashboard');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Super Admin Dashboard</h1>
              <p className="text-sm text-gray-600">Platform-wide monitoring and management</p>
            </div>
            <a
              href="/dashboard"
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              Back to Tenant Dashboard
            </a>
          </div>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
