import { NextResponse } from 'next/server';
import axios from 'axios';
import * as XLSX from 'xlsx';
import envs from '@/config/envConfig.js';

export const config = {
  api: {
    bodyParser: false,
  },
};

export async function POST(req) {
  try {
    const buffer = req.body ? await req.arrayBuffer() : null;
    const { searchParams } = new URL(req.url);

    const date_from = searchParams.get('date_from');
    const date_to = searchParams.get('date_to') || new Date().toISOString().split('T')[0];
    const created_from = searchParams.get('created_from');
    const created_to = searchParams.get('created_to');
    const date_type = searchParams.get('date_type') || 'processed_at';
    const status = searchParams.get('status') || 'open';
    const advertising_material_id = searchParams.get('advertising_material_id');
    const use_phone = searchParams.get('use_phone') === 'true';
    const use_email = searchParams.get('use_email') === 'true';
    const download_full_data = searchParams.get('download_full_data') === 'true';

    const params = {
      api_key: envs.API_KEY,
      program_id: envs.PROGRAM_ID,
      status,
      date_type,
      date_from,
      date_to,
      created_from,
      created_to,
    };

    if (advertising_material_id) {
      params.advertising_material_id = advertising_material_id;
    }

    // Fetch data from Finance Ads API
    const response = await axios.get(envs.API_URL, { params });
    const financeAdsData = response.data.data.leads;

    // Add fields for success and message in the output
    const resultMetadata = {
      success: response.data.success,
      message: response.data.message,
    };

    const mapLeadFields = (lead) => ({
      created_at: lead.created_at,
      processed_at: lead.processed_at,
      clicked_at: lead.clicked_at,
      order_id: lead.order?.id,
      order_name: lead.order?.name,
      order_value: lead.order?.value,
      affiliate_id: lead.affiliate?.id,
      affiliate_company: lead.affiliate?.company_name,
      affiliate_sub_id: lead.affiliate?.sub_id,
      adspace_id: lead.adspace?.id,
      adspace_name: lead.adspace?.name,
      advertising_material_id: lead.advertising_material?.id,
      advertising_material_type: lead.advertising_material?.type,
      added_later: lead.added_later,
      commission_value: lead.commission?.value,
      commission_currency: lead.commission?.currency,
      commission_type: lead.commission?.type,
      status: lead.status,
      customer_email_address: lead.customer?.email_address,
      customer_phone_number: lead.customer?.phone_number,
      customer_browser: lead.customer?.browser,
    });

    if (download_full_data) {
      // Convert full JSON data to Excel, including metadata
      const leadsWithFields = financeAdsData.map(mapLeadFields);

      const resultWorkbook = XLSX.utils.book_new();
      const leadsSheet = XLSX.utils.json_to_sheet(leadsWithFields);

      XLSX.utils.book_append_sheet(resultWorkbook, leadsSheet, 'Leads');

      const excelBuffer = XLSX.write(resultWorkbook, { type: 'buffer', bookType: 'xlsx' });
      return new NextResponse(excelBuffer, {
        headers: {
          'Content-Disposition': `attachment; filename=finance_ads_full_data.xlsx`,
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        },
      });
    }

    if (!buffer) {
      return NextResponse.json({ error: 'File is required for matching' }, { status: 400 });
    }

    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    const headerRow = data[0];

    // Identify phone and email columns
    const phoneColumnIndex = headerRow.findIndex(header =>
      ["phone_number", "phoneNumber", "phone number", "Phone Number", "PHONE NUMBER"].includes(header)
    );
    const emailColumnIndex = headerRow.findIndex(header =>
      ["email", "Email", "EMAIL", "email_address", "Email Address", "EMAIL ADDRESS"].includes(header)
    );

    if (use_phone && phoneColumnIndex === -1 && use_email && emailColumnIndex === -1) {
      return NextResponse.json({ error: 'Neither phone number nor email columns were found' }, { status: 400 });
    }

    const smartBrokerData = data.slice(1).map(row => ({
      phoneNumber: phoneColumnIndex !== -1 ? row[phoneColumnIndex]?.toString() : null,
      email: emailColumnIndex !== -1 ? row[emailColumnIndex] : null,
    })).map(({ phoneNumber, email }) => ({
      phoneNumber: phoneNumber && !phoneNumber.startsWith('+') ? `+${phoneNumber}` : phoneNumber,
      email,
    }));

    const uniqueMatchedLeads = new Map();

    financeAdsData.forEach((lead) => {
      const customerPhoneNumber = lead.customer?.phone_number;
      const customerEmail = lead.customer?.email_address;

      const phoneMatch = use_phone && customerPhoneNumber && smartBrokerData.some(data => data.phoneNumber === customerPhoneNumber);
      const emailMatch = use_email && customerEmail && smartBrokerData.some(data => data.email === customerEmail);

      if (phoneMatch || emailMatch) {
        const key = phoneMatch ? customerPhoneNumber : customerEmail;
        uniqueMatchedLeads.set(key, mapLeadFields(lead));
      }
    });

    const matchedLeads = Array.from(uniqueMatchedLeads.values());
    const resultWorkbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(matchedLeads.length ? matchedLeads : [{}]);
    XLSX.utils.book_append_sheet(resultWorkbook, worksheet, 'Matched Leads');

    const excelBuffer = XLSX.write(resultWorkbook, { type: 'buffer', bookType: 'xlsx' });
    return new NextResponse(excelBuffer, {
      headers: {
        'Content-Disposition': `attachment; filename=matched_leads.xlsx`,
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
    });
  } catch (error) {
    console.error('Error processing leads:', error);
    return NextResponse.json({ error: 'Error processing data' }, { status: 500 });
  }
}
