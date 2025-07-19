// netlify/functions/api-handler.js

exports.handler = async (event, context) => {
    // Hanya izinkan permintaan POST dari frontend
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ message: 'Method Not Allowed' }),
            headers: { 'Content-Type': 'application/json' }
        };
    }

    // Ambil URL Apps Script dari variabel lingkungan Netlify
    const GOOGLE_APPS_SCRIPT_URL = process.env.GOOGLE_APPS_SCRIPT_URL;

    if (!GOOGLE_APPS_SCRIPT_URL) {
        console.error('GOOGLE_APPS_SCRIPT_URL environment variable is not set!');
        return {
            statusCode: 500,
            body: JSON.stringify({ message: 'Server configuration error: Apps Script URL missing.' }),
            headers: { 'Content-Type': 'application/json' }
        };
    }

    try {
        const payload = JSON.parse(event.body);

        // Teruskan payload yang diterima dari frontend ke Google Apps Script
        const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        // Kembalikan respons dari Apps Script ke frontend Anda
        return {
            statusCode: response.status,
            body: JSON.stringify(result),
            headers: {
                'Content-Type': 'application/json',
                // Mengizinkan origin situs Netlify Anda (atau '*' untuk development)
                'Access-Control-Allow-Origin': 'https://dashwarnstore.netlify.app' // Ganti jika domain Anda berbeda
            }
        };

    } catch (error) {
        console.error('Error in Netlify Function:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ message: 'Internal Server Error', details: error.message }),
            headers: { 'Content-Type': 'application/json' }
        };
    }
};
