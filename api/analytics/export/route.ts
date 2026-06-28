import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { getAnalyticsSummary } from '@/lib/services/analytics-service';
import { getCostSummary } from '@/lib/billing/cost-tracker';

// Force dynamic route to avoid static generation issues
export const dynamic = 'force-dynamic';

/**
 * Analytics Export API
 * Supports CSV and PDF export formats with tenant isolation
 */
export async function GET(request: NextRequest) {
  try {
    // Get authenticated session
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const tenantId = session.tenant.id;

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const format = (searchParams.get('format') || 'csv').toLowerCase();
    const whatsappAccountId = searchParams.get('whatsappAccountId') || undefined;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const period = searchParams.get('period') || 'MONTH';

    // Build date filters
    const dateFilter: any = {};
    if (startDate) {
      dateFilter.startDate = new Date(startDate);
    }
    if (endDate) {
      dateFilter.endDate = new Date(endDate);
    }

    // Validate format
    if (format !== 'csv' && format !== 'pdf') {
      return NextResponse.json(
        { error: 'Invalid format. Use csv or pdf' },
        { status: 400 }
      );
    }

    // Get analytics data with tenant isolation
    const analyticsSummary = await getAnalyticsSummary({
      tenantId,
      whatsappAccountId,
      ...dateFilter,
    });

    // Get cost summary
    const costSummary = await getCostSummary(
      tenantId,
      period as 'TODAY' | 'WEEK' | 'MONTH' | 'CUSTOM',
      dateFilter.startDate,
      dateFilter.endDate
    );

    if (format === 'csv') {
      return generateCSVExport(analyticsSummary, costSummary, tenantId);
    } else if (format === 'pdf') {
      return generatePDFExport(analyticsSummary, costSummary, tenantId);
    }

  } catch (error) {
    console.error('[ANALYTICS_EXPORT] Error processing request', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Generate CSV export
 */
function generateCSVExport(
  analyticsSummary: any,
  costSummary: any,
  tenantId: string
): NextResponse {
  const csvRows: string[] = [];

  // Add header
  csvRows.push('WhatsApp Analytics Export');
  csvRows.push(`Tenant ID: ${tenantId}`);
  csvRows.push(`Export Date: ${new Date().toISOString()}`);
  csvRows.push('');

  // Add metrics summary
  csvRows.push('=== Message Metrics ===');
  csvRows.push('Metric,Value');
  csvRows.push(`Total Sent,${analyticsSummary.metrics.totalSent}`);
  csvRows.push(`Total Delivered,${analyticsSummary.metrics.totalDelivered}`);
  csvRows.push(`Total Read,${analyticsSummary.metrics.totalRead}`);
  csvRows.push(`Total Failed,${analyticsSummary.metrics.totalFailed}`);
  csvRows.push(`Delivery Success Rate,${analyticsSummary.metrics.deliverySuccessRate.toFixed(2)}%`);
  csvRows.push(`Read Receipt Rate,${analyticsSummary.metrics.readReceiptRate.toFixed(2)}%`);
  csvRows.push('');

  // Add cost summary
  csvRows.push('=== Cost Summary ===');
  csvRows.push('Category,Cost (USD)');
  csvRows.push(`Total Cost,${costSummary.totalCost.toFixed(2)}`);
  csvRows.push(`Business-Initiated,${costSummary.businessInitiatedCost.toFixed(2)}`);
  csvRows.push(`User-Initiated,${costSummary.userInitiatedCost.toFixed(2)}`);
  csvRows.push(`Marketing,${costSummary.marketingCost.toFixed(2)}`);
  csvRows.push(`Utility,${costSummary.utilityCost.toFixed(2)}`);
  csvRows.push(`Authentication,${costSummary.authenticationCost.toFixed(2)}`);
  csvRows.push(`Service,${costSummary.serviceCost.toFixed(2)}`);
  csvRows.push('');

  // Add time series data
  csvRows.push('=== Message Volume Over Time ===');
  csvRows.push('Date,Sent,Delivered,Read,Failed');
  analyticsSummary.timeSeries.forEach((ts: any) => {
    csvRows.push(`${ts.date},${ts.sent},${ts.delivered},${ts.read},${ts.failed}`);
  });
  csvRows.push('');

  // Add template performance
  csvRows.push('=== Template Performance ===');
  csvRows.push('Template Name,Sent,Delivered,Read,Success Rate');
  analyticsSummary.templatePerformance.forEach((tp: any) => {
    csvRows.push(`${tp.templateName},${tp.totalSent},${tp.totalDelivered},${tp.totalRead},${tp.deliverySuccessRate.toFixed(2)}%`);
  });
  csvRows.push('');

  // Add failure reasons
  csvRows.push('=== Failure Reasons ===');
  csvRows.push('Reason,Count');
  Object.entries(analyticsSummary.metrics.failureReasons).forEach(([reason, count]) => {
    csvRows.push(`${reason},${count}`);
  });

  const csvContent = csvRows.join('\n');

  return new NextResponse(csvContent, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="analytics-export-${tenantId}-${Date.now()}.csv"`,
    },
  });
}

/**
 * Generate PDF export (HTML-based for browser print)
 */
function generatePDFExport(
  analyticsSummary: any,
  costSummary: any,
  tenantId: string
): NextResponse {
  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Analytics Export - ${tenantId}</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      color: #333;
    }
    h1 {
      color: #1a1a1a;
      border-bottom: 2px solid #0066cc;
      padding-bottom: 10px;
    }
    h2 {
      color: #333;
      margin-top: 30px;
      border-bottom: 1px solid #ddd;
      padding-bottom: 5px;
    }
    .summary-card {
      background: #f5f5f5;
      padding: 15px;
      border-radius: 8px;
      margin: 10px 0;
    }
    .metric-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 15px;
      margin: 20px 0;
    }
    .metric-item {
      background: white;
      padding: 15px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .metric-label {
      font-size: 12px;
      color: #666;
      margin-bottom: 5px;
    }
    .metric-value {
      font-size: 24px;
      font-weight: bold;
      color: #0066cc;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
    }
    th, td {
      border: 1px solid #ddd;
      padding: 12px;
      text-align: left;
    }
    th {
      background-color: #0066cc;
      color: white;
    }
    tr:nth-child(even) {
      background-color: #f9f9f9;
    }
    .success {
      color: #28a745;
    }
    .warning {
      color: #ffc107;
    }
    .danger {
      color: #dc3545;
    }
    .export-info {
      font-size: 12px;
      color: #666;
      margin-bottom: 20px;
    }
  </style>
</head>
<body>
  <h1>WhatsApp Analytics Report</h1>
  
  <div class="export-info">
    <p><strong>Tenant ID:</strong> ${tenantId}</p>
    <p><strong>Export Date:</strong> ${new Date().toLocaleString()}</p>
  </div>

  <h2>Message Metrics</h2>
  <div class="metric-grid">
    <div class="metric-item">
      <div class="metric-label">Total Sent</div>
      <div class="metric-value">${analyticsSummary.metrics.totalSent.toLocaleString()}</div>
    </div>
    <div class="metric-item">
      <div class="metric-label">Total Delivered</div>
      <div class="metric-value success">${analyticsSummary.metrics.totalDelivered.toLocaleString()}</div>
    </div>
    <div class="metric-item">
      <div class="metric-label">Total Read</div>
      <div class="metric-value">${analyticsSummary.metrics.totalRead.toLocaleString()}</div>
    </div>
    <div class="metric-item">
      <div class="metric-label">Total Failed</div>
      <div class="metric-value danger">${analyticsSummary.metrics.totalFailed.toLocaleString()}</div>
    </div>
    <div class="metric-item">
      <div class="metric-label">Delivery Success Rate</div>
      <div class="metric-value">${analyticsSummary.metrics.deliverySuccessRate.toFixed(1)}%</div>
    </div>
    <div class="metric-item">
      <div class="metric-label">Read Receipt Rate</div>
      <div class="metric-value">${analyticsSummary.metrics.readReceiptRate.toFixed(1)}%</div>
    </div>
  </div>

  <h2>Cost Summary</h2>
  <div class="summary-card">
    <p><strong>Total Cost:</strong> $${costSummary.totalCost.toFixed(2)}</p>
    <p><strong>Business-Initiated:</strong> $${costSummary.businessInitiatedCost.toFixed(2)}</p>
    <p><strong>User-Initiated:</strong> $${costSummary.userInitiatedCost.toFixed(2)}</p>
    <p><strong>Marketing:</strong> $${costSummary.marketingCost.toFixed(2)}</p>
    <p><strong>Utility:</strong> $${costSummary.utilityCost.toFixed(2)}</p>
    <p><strong>Authentication:</strong> $${costSummary.authenticationCost.toFixed(2)}</p>
    <p><strong>Service:</strong> $${costSummary.serviceCost.toFixed(2)}</p>
  </div>

  <h2>Template Performance</h2>
  <table>
    <thead>
      <tr>
        <th>Template Name</th>
        <th>Sent</th>
        <th>Delivered</th>
        <th>Read</th>
        <th>Success Rate</th>
      </tr>
    </thead>
    <tbody>
      ${analyticsSummary.templatePerformance.map((tp: any) => `
        <tr>
          <td>${tp.templateName}</td>
          <td>${tp.totalSent.toLocaleString()}</td>
          <td>${tp.totalDelivered.toLocaleString()}</td>
          <td>${tp.totalRead.toLocaleString()}</td>
          <td class="${tp.deliverySuccessRate >= 90 ? 'success' : tp.deliverySuccessRate >= 70 ? 'warning' : 'danger'}">${tp.deliverySuccessRate.toFixed(1)}%</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  ${Object.keys(analyticsSummary.metrics.failureReasons).length > 0 ? `
  <h2>Failure Reasons</h2>
  <table>
    <thead>
      <tr>
        <th>Reason</th>
        <th>Count</th>
      </tr>
    </thead>
    <tbody>
      ${Object.entries(analyticsSummary.metrics.failureReasons).map(([reason, count]) => `
        <tr>
          <td>${reason}</td>
          <td>${count}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
  ` : ''}

  <div class="export-info" style="margin-top: 40px;">
    <p><em>This report was generated automatically by the WhatsApp Automation SaaS platform.</em></p>
  </div>
</body>
</html>
  `;

  return new NextResponse(htmlContent, {
    headers: {
      'Content-Type': 'text/html',
      'Content-Disposition': `attachment; filename="analytics-export-${tenantId}-${Date.now()}.html"`,
    },
  });
}
