import { NextResponse } from 'next/server';
import axios from 'axios';
import * as XLSX from 'xlsx';
import envs from '@/config/envConfig.js';

export const config = {
  api: {
    bodyParser: false,
  },
};

function isE164(phone) {
  return /^\+[1-9]\d{1,14}$/.test(phone);
}

export async function POST(req) {
  try {
    const buffer = await req.arrayBuffer();
    const { searchParams } = new URL(req.url);

    const date_from = searchParams.get('date_from');
    const date_to = searchParams.get('date_to') || new Date().toISOString().split('T')[0];
    const date_type = searchParams.get('date_type') || 'processed_at';
    // Default status to 2 (confirmed) using numeric codes: open=1, confirmed=2, canceled=3
    const status = searchParams.get('status') || '2';
    const advertising_material_id = searchParams.get('advertising_material_id');
    const use_phone = searchParams.get('use_phone') === 'true';
    const use_email = searchParams.get('use_email') === 'true';

    if (!buffer || !date_from || (!use_phone && !use_email)) {
      return NextResponse.json(
        { error: 'File, start date, and at least one matching option are required' },
        { status: 400 }
      );
    }

    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    const headerRow = data[0];

    const phoneHeaders = [
      'phone_number',
      'Phone_Number',
      'phoneNumber',
      'phone number',
      'Phone Number',
      'PHONE NUMBER',
      'phonenumber',
      'PHONENUMBER',
    ];
    const emailHeaders = [
      'email',
      'Email',
      'EMAIL',
      'email_address',
      'Email Address',
      'EMAIL ADDRESS',
    ];

    const phoneColumnIndex = headerRow.findIndex(header => phoneHeaders.includes(header));
    const emailColumnIndex = headerRow.findIndex(header => emailHeaders.includes(header));

    if (use_phone && phoneColumnIndex === -1 && use_email && emailColumnIndex === -1) {
      return NextResponse.json(
        { error: 'Neither phone number nor email columns were found' },
        { status: 400 }
      );
    }

    // Extract and filter phone numbers that are in E.164 format
    const excelData = data.slice(1).map(row => {
      const rawPhone = phoneColumnIndex !== -1 ? row[phoneColumnIndex] : null;
      const phoneNumber = rawPhone && isE164(rawPhone) ? rawPhone : null;
      const email = emailColumnIndex !== -1 ? row[emailColumnIndex] : null;
      return { phoneNumber, email };
    });

    const params = {
      api_key: envs.API_KEY,
      program_id: envs.PROGRAM_ID,
      status,
      date_type,
      date_from,
      date_to,
    };

    if (advertising_material_id) {
      params.advertising_material_id = advertising_material_id;
    }

    const response = await axios.get(envs.API_URL, { params });
    let financeAdsData = response.data.data.leads;

    const uniqueMatchedLeads = new Map();

    financeAdsData.forEach(lead => {
      const customerPhoneNumber = lead.customer?.phone_number?.trim();
      const customerEmail = lead.customer?.email_address?.trim();

      const phoneMatch =
        use_phone &&
        customerPhoneNumber &&
        isE164(customerPhoneNumber) &&
        excelData.some(d => d.phoneNumber && d.phoneNumber.trim() === customerPhoneNumber);

      const emailMatch =
        use_email &&
        customerEmail &&
        excelData.some(d => d.email && d.email.trim() === customerEmail);

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