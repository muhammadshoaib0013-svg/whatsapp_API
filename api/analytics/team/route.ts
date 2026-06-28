import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import { DatabaseUnavailableError } from '@/lib/auth/session';

interface TeamAnalyticsData {
  agentId: string;
  agentName: string;
  totalMessagesHandled: number;
  averageFirstResponseTime: number; // in seconds
  resolutionRate: number; // percentage
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Build date filter
    const dateFilter: any = {};
    if (startDate) {
      dateFilter.gte = new Date(startDate);
    }
    if (endDate) {
      dateFilter.lte = new Date(endDate);
    }

    // Get all users (agents) for the tenant via TeamMember relation
    const teamMembers = await prisma.teamMember.findMany({
      where: {
        tenantId: session.tenant.id,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    const agents = teamMembers.map(tm => tm.user);

    const analyticsData: TeamAnalyticsData[] = [];

    for (const agent of agents) {
      // Get all messages handled by this agent
      const messages = await prisma.message.findMany({
        where: {
          tenantId: session.tenant.id,
          ...(Object.keys(dateFilter).length > 0 && {
            createdAt: dateFilter,
          }),
          // Filter for messages where the agent was involved (outbound messages from agent)
          direction: 'OUTBOUND',
        },
        include: {
          chatSession: {
            select: {
              messages: {
                where: {
                  direction: 'INBOUND',
                  ...(Object.keys(dateFilter).length > 0 && {
                    createdAt: dateFilter,
                  }),
                },
                orderBy: {
                  createdAt: 'asc',
                },
                take: 1, // Get first inbound message
              },
            },
          },
        },
      });

      const totalMessagesHandled = messages.length;

      // Calculate average first response time
      let totalResponseTime = 0;
      let responseCount = 0;

      for (const message of messages) {
        const firstInbound = message.chatSession.messages[0];
        if (firstInbound) {
          const responseTime = (new Date(message.createdAt).getTime() - new Date(firstInbound.createdAt).getTime()) / 1000; // in seconds
          if (responseTime > 0) {
            totalResponseTime += responseTime;
            responseCount++;
          }
        }
      }

      const averageFirstResponseTime = responseCount > 0 ? totalResponseTime / responseCount : 0;

      // Calculate resolution rate (messages that led to a resolved conversation)
      // For simplicity, we'll consider a conversation resolved if there's no new inbound message for 24 hours after the last outbound
      const resolvedConversations = await prisma.chatSession.count({
        where: {
          tenantId: session.tenant.id,
          messages: {
            some: {
              direction: 'OUTBOUND',
              ...(Object.keys(dateFilter).length > 0 && {
                createdAt: dateFilter,
              }),
            },
          },
          NOT: {
            messages: {
              some: {
                direction: 'INBOUND',
                createdAt: {
                  gt: new Date(Date.now() - 24 * 60 * 60 * 1000), // No inbound in last 24 hours
                },
              },
            },
          },
        },
      });

      const totalConversations = await prisma.chatSession.count({
        where: {
          tenantId: session.tenant.id,
          messages: {
            some: {
              direction: 'OUTBOUND',
              ...(Object.keys(dateFilter).length > 0 && {
                createdAt: dateFilter,
              }),
            },
          },
        },
      });

      const resolutionRate = totalConversations > 0 ? (resolvedConversations / totalConversations) * 100 : 0;

      analyticsData.push({
        agentId: agent.id,
        agentName: agent.name || agent.email,
        totalMessagesHandled,
        averageFirstResponseTime,
        resolutionRate,
      });
    }

    // Sort by total messages handled (descending)
    analyticsData.sort((a, b) => b.totalMessagesHandled - a.totalMessagesHandled);

    return NextResponse.json({
      data: analyticsData,
      summary: {
        totalAgents: agents.length,
        totalMessages: analyticsData.reduce((sum, a) => sum + a.totalMessagesHandled, 0),
        avgResponseTime: analyticsData.reduce((sum, a) => sum + a.averageFirstResponseTime, 0) / analyticsData.length || 0,
        avgResolutionRate: analyticsData.reduce((sum, a) => sum + a.resolutionRate, 0) / analyticsData.length || 0,
      },
    });
  } catch (error) {
    if (error instanceof DatabaseUnavailableError) {
      return NextResponse.json(
        { error: 'Database temporarily unavailable. Please retry.' },
        { status: 503 }
      );
    }

    console.error('[TEAM_ANALYTICS] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
