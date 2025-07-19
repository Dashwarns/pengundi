// netlify/functions/api-handler.js

// Tidak lagi memerlukan Firebase Admin SDK
// const admin = require('firebase-admin'); 

// Tidak perlu inisialisasi Firebase
// if (!admin.apps.length) { ... }

exports.handler = async (event, context) => {
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ message: 'Method Not Allowed' }),
            headers: { 'Content-Type': 'application/json' }
        };
    }

    const GOOGLE_APPS_SCRIPT_URL = process.env.GOOGLE_APPS_SCRIPT_URL; // Ambil URL dari Environment Variable

    if (!GOOGLE_APPS_SCRIPT_URL) {
        console.error('GOOGLE_APPS_SCRIPT_URL environment variable is not set.');
        return {
            statusCode: 500,
            body: JSON.stringify({ message: 'Internal Server Error: Backend URL not configured.' }),
            headers: { 'Content-Type': 'application/json' }
        };
    }

    try {
        const payload = JSON.parse(event.body);

        // Langsung meneruskan payload ke Google Apps Script
        const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload) // Teruskan seluruh payload
        });

        const result = await response.json();

        return {
            statusCode: response.status, // Teruskan status code dari Apps Script
            body: JSON.stringify(result),
            headers: { 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': 'https://dashwarnstore.netlify.app' // Ganti jika domain Anda berbeda
            }
        };

    } catch (error) {
        console.error('Error in Netlify Function acting as proxy:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ message: 'Internal Server Error', details: error.message }),
            headers: { 'Content-Type': 'application/json' }
        };
    }
};

// Fungsi generateRandomCode juga dihapus dari sini, akan ditangani oleh Apps Script
// function generateRandomCode(...) { ... }
