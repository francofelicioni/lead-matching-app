import { NextResponse } from 'next/server';
import axios from 'axios';
import * as XLSX from 'xlsx';

export const config = {
  api: {
    bodyParser: false,
  },
};

export async function POST(req) {
  try {
    const buffer = await req.arrayBuffer();
    const { searchParams } = new URL(req.url);

    const date_from = searchParams.get('date_from');
    const date_to = searchParams.get('date_to') || new Date().toISOString().split('T')[0];
    const date_type = searchParams.get('date_type') || 'processed_at';
    const status = searchParams.get('status') || 'open';
    const advertising_material_id = searchParams.get('advertising_material_id');

    if (!buffer || !date_from) {
      return NextResponse.json({ error: 'File and start date are required' }, { status: 400 });
    }

    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const smartBrokerData = XLSX.utils.sheet_to_json(sheet).map((row) => row.phoneNumber);

    const params = {
      api_key: process.env.API_KEY,
      program_id: process.env.PROGRAM_ID,
      status,
      date_type,
      date_from,
      date_to,
    };

    if (advertising_material_id) {
      params.advertising_material_id = advertising_material_id;
    }

    const response = await axios.get(process.env.API_URL, { params });
    const financeAdsData = response.data.data.leads;

    const matchedLeads = financeAdsData
      .filter((lead) => lead.customer?.phone_number && smartBrokerData.includes(lead.customer.phone_number))
      .map((lead) => ({
        customer_phone_number: lead.customer?.phone_number,
        created_at: lead.created_at,
        processed_at: lead.processed_at,
        clicked_at: lead.clicked_at,
        customer_browser: lead.customer?.browser,
        customer_email_address: lead.customer?.email_address,
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
      }));

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
    console.error('Error processing leads:', error);
    return NextResponse.json({ error: 'Error processing data' }, { status: 500 });
  }
}