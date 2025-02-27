'use client';

import React, { useState } from 'react';

export default function DocumentationModal() {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                className="bg-green-500 text-white px-4 py-2 rounded mb-4"
            >
                Show Documentation
            </button>
            {isOpen && (
                <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
                    <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4">
                        <h2 className="text-2xl font-bold mb-4">Lead Matching App – User Manual</h2>
                        <p className="mb-4">
                            <strong>Overview:</strong> This app helps you match leads from your Excel file with data from our FinanceAds system and then downloads a new Excel file with only the matched leads.
                        </p>
                        <ul className="list-disc ml-6 mb-4">
                            <li>
                                <strong>Excel File Headers:</strong> The first row of your Excel file should contain the headers.
                                <br />
                                For phone numbers, use one of these header names:
                                <code className='text-sm font-bold'> phone_number, Phone_Number, phoneNumber, phone number, Phone Number, PHONE NUMBER, phonenumber, PHONENUMBER</code>.
                                <br />
                                For email addresses, use one of these:
                                <code className='text-sm font-bold'> email, Email, EMAIL, email_address, Email Address, EMAIL ADDRESS</code>.
                                Only these headers will be recognized for matching.
                            </li>
                            <li>
                                <strong>Upload Your Excel File:</strong> Your file must include phone numbers and/or email addresses.
                                <br />
                                <em>Note:</em> All phone numbers must be in the international E.164 format (e.g., <code>+491234567890</code>) or without the "+" (e.g., <code>491234567890</code>). Numbers not in this format are ignored.
                            </li>
                            <li>
                                <strong>Set the Date Range:</strong> Choose a Start Date (required) and an End Date (optional). The app filters leads based on this range.
                            </li>
                            <li>
                                <strong>Select Matching Options:</strong> You can match by phone only, email only, or both.
                            </li>
                            <li>
                                <strong>Choose Lead Status:</strong> Select the lead status you want:
                                <br />
                                <em>Open</em>, <em>Confirmed</em>, <em>Cancelled</em>, or <em>All</em>. (The app converts your selection to the correct format for our system.)
                            </li>
                            <li>
                                <strong>Download Your Matched Leads:</strong> Click the "Download Matched Leads" button. A new Excel file will be generated with only the matched leads.
                            </li>
                        </ul>
                        <div className="text-center">
                            <button
                                onClick={() => setIsOpen(false)}
                                className="bg-blue-500 text-white px-4 py-2 rounded"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
