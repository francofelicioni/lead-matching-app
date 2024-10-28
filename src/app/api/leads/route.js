import { NextResponse } from 'next/server';
import axios from 'axios';
import * as XLSX from 'xlsx';

export const config = {
  api: {
    bodyParser: false, // Disable default Next.js body parser
  },
};

export async function POST(req) {
  try {
    // Collect binary data from the request body
    const buffer = await req.arrayBuffer();
    const formData = new FormData();
    formData.append('file', new Blob([buffer]), 'upload.xlsx');

    // Extract the `date_from` parameter from the request URL
    const { searchParams } = new URL(req.url);
    const date_from = searchParams.get('date_from');
    
    if (!formData.get('file') || !date_from) {
      return NextResponse.json({ error: 'File and date are required' }, { status: 400 });
    }

    // Read Excel file and extract phone numbers
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const smartBrokerData = XLSX.utils.sheet_to_json(sheet).map((row) => row.phoneNumber);

    // Fetch FinanceAds data
    const params = {
      api_key: process.env.API_KEY,
      program_id: process.env.PROGRAM_ID,
      status: 'all',
      date_type: 'created_at',
      date_from,
    };

    const response = await axios.get(process.env.API_URL, { params });
    const financeAdsData = response.data.data.leads;

    // Match phone numbers and extract all specified data
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

    // Create output Excel file in memory
    const resultWorkbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(matchedLeads);
    XLSX.utils.book_append_sheet(resultWorkbook, worksheet, 'Matched Leads');

    // Write the workbook to a buffer
    const excelBuffer = XLSX.write(resultWorkbook, { type: 'buffer', bookType: 'xlsx' });

    // Generate a filename with the selected date
    const formattedDate = date_from.replace(/-/g, ''); // Format the date as YYYYMMDD
    const fileName = `matched_leads_${formattedDate}.xlsx`;

    // Send the file as a download response
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