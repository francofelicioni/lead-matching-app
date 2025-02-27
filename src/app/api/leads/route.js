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

// Validate that a phone number is in E.164 format
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

    // Extract and filter Excel data (ensuring phone numbers are in E.164 format)
    const excelData = data.slice(1).map(row => {
      const rawPhone = phoneColumnIndex !== -1 ? row[phoneColumnIndex] : null;
      const phoneNumber = rawPhone && isE164(String(rawPhone).trim())
        ? String(rawPhone).trim()
        : null;
      const email = emailColumnIndex !== -1 ? String(row[emailColumnIndex]).trim() : null;
      return { phoneNumber, email };
    });

    // Map numeric status to text values required by the API
    const statusMapping = {
      "1": "open",
      "2": "confirmed",
      "3": "canceled"
    };
    status = status === "all" ? "all" : (statusMapping[status] || "confirmed");

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

    // Match leads based on phone and/or email
    const uniqueMatchedLeads = new Map();
    financeAdsData.forEach(lead => {
      const customerPhoneNumber = lead.customer?.phone_number?.trim();
      const customerEmail = lead.customer?.email_address?.trim();

      const phoneMatch =
        use_phone &&
        customerPhoneNumber &&
        isE164(customerPhoneNumber) &&
        excelData.some(d => d.phoneNumber && d.phoneNumber === customerPhoneNumber);

      const emailMatch =
        use_email &&
        customerEmail &&
        excelData.some(d => d.email && d.email === customerEmail);

      if (phoneMatch || emailMatch) {
        const key = phoneMatch ? customerPhoneNumber : customerEmail;
        uniqueMatchedLeads.set(key, {
          customer_phone_number: customerPhoneNumber,
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

    // Create an Excel workbook with the matched leads
    const resultWorkbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(matchedLeads.length ? matchedLeads : [{}]);
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