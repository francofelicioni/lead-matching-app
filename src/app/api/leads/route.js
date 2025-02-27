import { NextResponse } from 'next/server';
import axios from 'axios';
import * as XLSX from 'xlsx';
import envs from '@/config/envConfig.js';
import { Buffer } from 'buffer';

export const config = {
  api: {
    bodyParser: false,
  },
};

function mapStatus(userStatus) {
  switch (userStatus) {
    case 'open':
      return '1';
    case 'canceled':
      return '3';
    case 'confirmed':
      return '2';
    default:
      return null;
  }
}

/**
 * Normalize a phone number:
 */
function normalizePhoneNumber(phone) {
  if (!phone) return null;
  let num = String(phone).trim();
  // Remove common formatting characters
  num = num.replace(/[\s\-().]/g, '');
  if (!num.startsWith('+')) {
    if (num.startsWith('49')) {
      num = `+${num}`;
    } else {
      num = `+49${num}`;
    }
  }
  return num;
}

// Validate that a phone number is in E.164 format (e.g. +491234567890)
function isE164(phone) {
  return /^\+[1-9]\d{1,14}$/.test(phone);
}

export async function POST(req) {
  try {
    // Convert incoming ArrayBuffer to a Node Buffer
    const arrayBuffer = await req.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    console.log("Received file buffer length:", buffer.length);

    // Parse query parameters
    const { searchParams } = new URL(req.url);
    const date_from = searchParams.get('date_from');
    const date_to = searchParams.get('date_to') || new Date().toISOString().split('T')[0];
    const date_type = searchParams.get('date_type') || 'processed_at';
    let status = searchParams.get('status') || '2';
    const advertising_material_id = searchParams.get('advertising_material_id');
    const use_phone = searchParams.get('use_phone') === 'true';
    const use_email = searchParams.get('use_email') === 'true';

    if (!buffer || !date_from || (!use_phone && !use_email)) {
      return NextResponse.json(
        { error: 'File, start date, and at least one matching option are required' },
        { status: 400 }
      );
    }

    // Normalize and map the status value to allowed API values.
    // The FinanceAds API expects: "open", "confirmed", "cancelled", or "all".
    status = status.toString().toLowerCase();
    if (status === "all") {
      // leave as is
    } else {
      const statusMapping = {
        "1": "open",
        "2": "confirmed",
        "3": "cancelled",
        "cancelled": "cancelled",
        "canceled": "cancelled",
        "open": "open",
        "confirmed": "confirmed"
      };
      status = statusMapping[status] || "confirmed";
    }

    // Read the Excel file
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    if (!data || data.length === 0) {
      return NextResponse.json({ error: 'Excel file is empty or invalid' }, { status: 400 });
    }
    console.log("Excel rows received:", data.length);
    const headerRow = data[0];

    // Define header variations
    const phoneHeaders = [
      'phone_number', 'Phone_Number', 'phoneNumber', 'phone number',
      'Phone Number', 'PHONE NUMBER', 'phonenumber', 'PHONENUMBER'
    ];
    const emailHeaders = [
      'email', 'Email', 'EMAIL', 'email_address',
      'Email Address', 'EMAIL ADDRESS'
    ];

    const phoneColumnIndex = headerRow.findIndex(header => phoneHeaders.includes(header));
    const emailColumnIndex = headerRow.findIndex(header => emailHeaders.includes(header));

    if (use_phone && phoneColumnIndex === -1 && use_email && emailColumnIndex === -1) {
      return NextResponse.json(
        { error: 'Neither phone number nor email columns were found' },
        { status: 400 }
      );
    }

    // Extract and normalize Excel data
    const excelData = data.slice(1).map(row => {
      const rawPhone = phoneColumnIndex !== -1 ? row[phoneColumnIndex] : null;
      // Normalize Excel phone numbers (adds '+' if missing)
      const phoneNumber = rawPhone ? normalizePhoneNumber(rawPhone) : null;
      const email = emailColumnIndex !== -1 ? String(row[emailColumnIndex]).trim() : null;
      return { phoneNumber, email };
    });

    // Prepare query parameters for the FinanceAds API call
    const params = {
      api_key: envs.API_KEY,
      program_id: envs.PROGRAM_ID,
      date_type,
      date_from,
      date_to,
      status,
    };
    if (advertising_material_id) {
      params.advertising_material_id = advertising_material_id;
    }
    console.log('FinanceAds API params:', params);

    // Call the FinanceAds API with proper error handling
    let financeAdsData = [];
    try {
      const response = await axios.get(envs.API_URL, { params });
      if (response.data && response.data.data && response.data.data.leads) {
        financeAdsData = response.data.data.leads;
      } else {
        console.error('Unexpected API response:', response.data);
        return NextResponse.json(
          { error: 'Unexpected API response from FinanceAds' },
          { status: 500 }
        );
      }
      console.log("FinanceAds API returned", financeAdsData.length, "leads");
    } catch (apiError) {
      console.error("FinanceAds API error:", apiError.response?.data || apiError.message);
      return NextResponse.json(
        { error: 'Error calling FinanceAds API', details: apiError.response?.data || apiError.message },
        { status: 500 }
      );
    }

    // Match leads based on phone and/or email.
    // Normalize FinanceAds phone numbers for consistent matching.
    const uniqueMatchedLeads = new Map();
    financeAdsData.forEach(lead => {
      const customerPhoneNumber = lead.customer?.phone_number;
      const normalizedCustomerPhone = customerPhoneNumber ? normalizePhoneNumber(customerPhoneNumber) : null;
      const customerEmail = lead.customer?.email_address?.trim();

      const phoneMatch =
        use_phone &&
        normalizedCustomerPhone &&
        excelData.some(d => d.phoneNumber && d.phoneNumber === normalizedCustomerPhone);

      const emailMatch =
        use_email &&
        customerEmail &&
        excelData.some(d => d.email && d.email === customerEmail);

      if (phoneMatch || emailMatch) {
        const key = phoneMatch ? normalizedCustomerPhone : customerEmail;
        uniqueMatchedLeads.set(key, {
          customer_phone_number: normalizedCustomerPhone,
          customer_email_address: customerEmail,
          created_at: lead.created_at,
          processed_at: lead.processed_at,
          clicked_at: lead.clicked_at,
          customer_browser: lead.customer?.browser,
          order_id: lead.order?.id,
          order_value: lead.order?.value,
          affiliate_id: lead.affiliate?.id,
          affiliate_company: lead.affiliate?.company_name,
          sub_id: lead.affiliate?.sub_id,
          adspace_id: lead.adspace?.id,
          adspace_name: lead.adspace?.name,
          advertising_material_id: lead.advertising_material?.id,
          advertising_material_type: lead.advertising_material?.type,
          added_later: lead.added_later,
          commission_value: lead.commission?.value,
          commission_currency: lead.commission?.currency,
          commission_type: lead.commission?.type,
          status: lead.status,
        });
      }
    });

    const matchedLeads = Array.from(uniqueMatchedLeads.values());
    console.log("Total matched leads:", matchedLeads.length);

    // Create an Excel workbook with the matched leads or a message if none found
   const resultWorkbook = XLSX.utils.book_new();
    let worksheet;
    if (matchedLeads.length === 0) {
      const message = `No matches were found for ${date_from} to ${date_to} with a status of ${status}${advertising_material_id ? ` and advertising material ID ${advertising_material_id}` : ''}.`;
      worksheet = XLSX.utils.aoa_to_sheet([[message]]);
    } else {
      // Generate the sheet from the matched leads
      let sheetData = XLSX.utils.sheet_to_json(XLSX.utils.json_to_sheet(matchedLeads), { header: 1 });
      // Prepend a header row with a custom message
      const headerMessage = `Matches founded for ${date_from} to ${date_to} with a status of ${status}${advertising_material_id ? ` and advertising material ID ${advertising_material_id}` : ''}.`;
      sheetData.unshift([headerMessage]);
      worksheet = XLSX.utils.aoa_to_sheet(sheetData);
    }
    XLSX.utils.book_append_sheet(resultWorkbook, worksheet, 'Matched Leads');

    const excelBuffer = XLSX.write(resultWorkbook, { type: 'buffer', bookType: 'xlsx' });
    const formattedDateFrom = date_from.replace(/-/g, '');
    const formattedDateTo = date_to.replace(/-/g, '');
    const fileName = `matched_leads_${formattedDateFrom}_to_${formattedDateTo}.xlsx`;

    return new NextResponse(excelBuffer, {
      headers: {
        'Content-Disposition': `attachment; filename=${fileName}`,
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
    });
  } catch (error) {
    console.error('Error processing leads:', error.response?.data || error.message);
    return NextResponse.json(
      {
        error: 'Error processing data',
        details: error.response?.data || error.message,
      },
      { status: 500 }
    );
  }
}