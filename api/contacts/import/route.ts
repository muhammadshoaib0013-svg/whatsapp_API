import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db';
import Papa from 'papaparse';

interface CSVRow {
  name: string;
  phoneNumber: string;
  tags?: string;
}

// Validate E.164 phone number format
function isValidE164PhoneNumber(phoneNumber: string): boolean {
  const e164Regex = /^\+[1-9]\d{1,14}$/;
  return e164Regex.test(phoneNumber);
}

// Normalize phone number to E.164 format
function normalizePhoneNumber(phoneNumber: string): string {
  // Remove all non-digit characters except leading +
  let normalized = phoneNumber.replace(/[^\d+]/g, '');
  
  // If no country code, assume it's missing and return as-is (will fail validation)
  if (!normalized.startsWith('+')) {
    // Try to add common country codes based on length (this is a simple heuristic)
    // For production, you'd want to ask user for their country code
    if (normalized.length === 10) {
      // Assume US/Canada
      normalized = '+1' + normalized;
    } else if (normalized.length === 11 && normalized.startsWith('1')) {
      normalized = '+' + normalized;
    }
  }
  
  return normalized;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Check file type
    if (!file.name.endsWith('.csv')) {
      return NextResponse.json(
        { error: 'File must be a CSV' },
        { status: 400 }
      );
    }

    // Read file content
    const fileContent = await file.text();

    // Parse CSV with more lenient settings
    const parseResult = Papa.parse<CSVRow>(fileContent, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,
      transformHeader: (header: string) => {
        // Normalize header names
        const headerLower = header.toLowerCase().trim();
        if (headerLower === 'phone' || headerLower === 'phone number' || headerLower === 'phonenumber') {
          return 'phoneNumber';
        }
        if (headerLower === 'tag' || headerLower === 'tags') {
          return 'tags';
        }
        return headerLower;
      },
    });

    // Only fail on critical parsing errors (not minor formatting issues)
    const criticalErrors = parseResult.errors.filter(
      (error) => error.type === 'Delimiter' || error.type === 'Quotes'
    );

    if (criticalErrors.length > 0) {
      console.error('[CONTACTS_IMPORT] Critical parsing errors:', criticalErrors);
      return NextResponse.json(
        { 
          error: 'CSV parsing failed due to format errors', 
          details: criticalErrors.map(e => e.message).join(', '),
          suggestion: 'Ensure CSV has proper delimiters (commas) and quotes'
        },
        { status: 400 }
      );
    }

    const rows = parseResult.data;

    if (rows.length === 0) {
      return NextResponse.json(
        { error: 'CSV file is empty' },
        { status: 400 }
      );
    }

    // Validate and process contacts
    const validContacts: Array<{ name: string; phoneNumber: string; tags?: string[] }> = [];
    const errors: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 2; // +2 because header is row 1

      if (!row.name || !row.phoneNumber) {
        errors.push(`Row ${rowNumber}: Missing name or phone number`);
        continue;
      }

      // Normalize phone number
      const normalizedPhone = normalizePhoneNumber(row.phoneNumber);

      // Validate phone number format
      if (!isValidE164PhoneNumber(normalizedPhone)) {
        errors.push(`Row ${rowNumber}: Invalid phone number format: ${row.phoneNumber}. Use E.164 format (e.g., +1234567890)`);
        continue;
      }

      // Parse tags
      let tags: string[] = [];
      if (row.tags) {
        tags = row.tags.split(',').map((tag: string) => tag.trim()).filter((tag: string) => tag.length > 0);
      }

      validContacts.push({
        name: row.name.trim(),
        phoneNumber: normalizedPhone,
        tags: tags.length > 0 ? tags : undefined,
      });
    }

    if (validContacts.length === 0) {
      return NextResponse.json(
        { error: 'No valid contacts found in CSV', errors },
        { status: 400 }
      );
    }

    // Create contacts in database (with tenant isolation)
    const createdContacts = await prisma.$transaction(
      validContacts.map((contact) =>
        prisma.contact.create({
          data: {
            tenantId: session.tenant.id,
            name: contact.name,
            phoneNumber: contact.phoneNumber,
            tags: contact.tags || [],
          },
        })
      )
    );

    return NextResponse.json(
      {
        message: 'Contacts imported successfully',
        imported: createdContacts.length,
        total: rows.length,
        errors: errors.length > 0 ? errors : undefined,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[CONTACTS_IMPORT] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
