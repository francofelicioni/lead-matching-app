'use client';

import React, { useEffect, useState } from 'react';
import axios from 'axios';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();
  const [file, setFile] = useState(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [dateType, setDateType] = useState('processed_at');
  const [status, setStatus] = useState('open');
  const [advertisingMaterialId, setAdvertisingMaterialId] = useState(''); // New state
  const [loading, setLoading] = useState(false);

  const handleFileChange = (e) => setFile(e.target.files[0]);
  const handleDateFromChange = (e) => setDateFrom(e.target.value);
  const handleDateToChange = (e) => setDateTo(e.target.value);
  const handleDateTypeChange = (e) => setDateType(e.target.value);
  const handleStatusChange = (e) => setStatus(e.target.value);
  const handleAdvertisingMaterialIdChange = (e) => setAdvertisingMaterialId(e.target.value);

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    setDateTo(today);
  }, []);

  const handleLogout = () => {
    document.cookie = 'auth-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;';
    router.push('/login');
  };


  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file || !dateFrom) {
      alert('Please select a file and start date');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
      setLoading(true);

      const params = new URLSearchParams({
        date_from: dateFrom,
        date_to: dateTo || new Date().toISOString().split('T')[0],
        date_type: dateType,
        status,
      });

      if (advertisingMaterialId) {
        params.append('advertising_material_id', advertisingMaterialId);
      }

      const response = await axios.post(`/api/leads?${params.toString()}`, file, {
        headers: { 'Content-Type': 'application/octet-stream' },
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'matched_leads.xlsx');
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
    } catch (error) {
      console.error('Error downloading file:', error);
      alert('Error downloading file');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4 bg-gray-500">
      <a href="https://next-level.com/" target="_blank" rel="noopener noreferrer">
        <Image
          className="p-5 rounded-lg"
          src="https://next-level.com/wp-content/uploads/2021/11/nextlevel_RGB_claimless_color_EPS-1-1.svg"
          alt="Next.js logo"
          width={200}
          height={50}
          priority
        />
      </a>
      <h1 className="text-center text-3xl font-bold mb-6 py-4 text-white">Lead Matching App</h1>
      <form onSubmit={handleSubmit} className="bg-white shadow-md rounded-lg p-6 space-y-4 w-full max-w-md">
        <div>
          <label className="block text-gray-700 font-medium mb-2" htmlFor="file">Select Excel File</label>
          <input
            type="file"
            accept=".xlsx, .xls"
            onChange={handleFileChange}
            required
            className="w-full border border-gray-300 rounded-md p-2"
          />
        </div>
        <div>
          <label className="block text-gray-700 font-medium mb-2" htmlFor="dateFrom">Select Start Date</label>
          <input
            type="date"
            value={dateFrom}
            onChange={handleDateFromChange}
            required
            className="w-full border border-gray-300 rounded-md p-2"
          />
        </div>
        <div>
          <label className="block text-gray-700 font-medium mb-2" htmlFor="dateTo">Select End Date (optional)</label>
          <input
            type="date"
            value={dateTo}
            onChange={handleDateToChange}
            className="w-full border border-gray-300 rounded-md p-2"
          />
        </div>
        <div>
          <label className="block text-gray-700 font-medium mb-2" htmlFor="dateType">Select Date Type</label>
          <select
            value={dateType}
            onChange={handleDateTypeChange}
            className="w-full border border-gray-300 rounded-md p-2"
          >
            <option value="created_at">Created At</option>
            <option value="processed_at">Processed At</option>
          </select>
        </div>
        <div>
          <label className="block text-gray-700 font-medium mb-2" htmlFor="status">Select Status</label>
          <select
            value={status}
            onChange={handleStatusChange}
            className="w-full border border-gray-300 rounded-md p-2"
          >
            <option value="all">All</option>
            <option value="open">Open</option>
            <option value="canceled">Cancelled</option>
            <option value="confirmed">Confirmed</option>
          </select>
        </div>
        <div>
          <label className="block text-gray-700 font-medium mb-2" htmlFor="advertisingMaterialId">Advertising Material ID (optional)</label>
          <input
            type="text"
            value={advertisingMaterialId}
            onChange={handleAdvertisingMaterialIdChange}
            className="w-full border border-gray-300 rounded-md p-2"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className={`w-full bg-blue-500 text-white font-bold py-2 px-4 rounded-lg 
            ${loading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-600'}`}
        >
          {loading ? 'Processing...' : 'Download Matched Leads'}
        </button>
      </form>
      <div className="text-center mt-8"> 
        <button onClick={handleLogout} className="text-sm text-gray-200 hover:underline mb-4">Logout</button>
      </div>
    </div>
  );
}