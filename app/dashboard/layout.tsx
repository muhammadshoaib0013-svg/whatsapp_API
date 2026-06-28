import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  // Fetch tenant data to check trial/subscription status
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: session.tenant.id },
      select: {
        trialEndsAt: true,
        subscriptionStatus: true,
      },
    });

    if (!tenant) {
      redirect('/login');
    }

    // Check if trial has expired and subscription is not active
    const now = new Date();
    const trialExpired = tenant.trialEndsAt && new Date(tenant.trialEndsAt) < now;
    const subscriptionActive = tenant.subscriptionStatus === 'ACTIVE';

    if (trialExpired && !subscriptionActive) {
      redirect('/dashboard/billing?trial=expired');
    }
  } catch (error) {
    console.error('Dashboard layout error:', error);
    // Allow access on error (fail-open) to prevent blocking users during DB issues
  }

  return <>{children}</>;
}
