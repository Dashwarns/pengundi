// netlify/functions/api-handler.js

// Pastikan untuk menginstal node-fetch jika Anda menjalankannya secara lokal
// Namun, di Netlify Functions, node-fetch sudah tersedia secara default.

// GANTI DENGAN URL APPS SCRIPT ANDA YANG BARU (Jika Apps Script masih digunakan sebagai backend)
// Jika Anda membuat Apps Script sebagai Executable API (bukan Web App dengan "Anyone"),
// Anda akan membutuhkan Service Account atau cara autentikasi lainnya.
// Untuk demonstrasi ini, anggap Apps Script masih diakses sebagai web app (sementara)
// ATAU, Apps Script ini hanya menjadi internal API yang dipanggil oleh Netlify Function.
const GOOGLE_APPS_SCRIPT_URL = process.env.GOOGLE_APPS_SCRIPT_URL; // Akan disetel di Netlify ENV

exports.handler = async (event, context) => {
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ message: 'Method Not Allowed' }),
            headers: { 'Content-Type': 'application/json' }
        };
    }

    try {
        const payload = JSON.parse(event.body);
        const action = payload.action;

        // Kirim payload langsung ke Google Apps Script
        const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload) // Teruskan payload dari frontend ke Apps Script
        });

        const result = await response.json();

        // Kembalikan respons dari Apps Script ke frontend Anda
        return {
            statusCode: response.status,
            body: JSON.stringify(result),
            headers: {
                'Content-Type': 'application/json',
                // Ini penting! Izinkan origin Netlify Anda.
                // Atau, untuk development/testing, bisa '*'
                'Access-Control-Allow-Origin': 'https://dashwarnstore.netlify.app'
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
