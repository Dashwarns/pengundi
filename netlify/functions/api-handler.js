// netlify/functions/api-handler.js

const admin = require('firebase-admin');

const serviceAccountString = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

if (!admin.apps.length) {
    try {
        const serviceAccount = JSON.parse(serviceAccountString);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
    } catch (error) {
        console.error('Failed to initialize Firebase Admin SDK:', error);
        // Handle error initialization
    }
}

const db = admin.firestore();
const collectionRef = db.collection('redeemCodes');

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

// --- DEBUGGING LOGS (HAPUS SEMUA console.log INI SETELAH DEBUGGING!) ---
console.log('API Handler Loaded. Current time:', new Date().toISOString());
console.log('ADMIN_PASSWORD (from env):', ADMIN_PASSWORD ? '***** (Set)' : '!!! NOT SET !!!');
// --- AKHIR DEBUGGING LOGS ---


exports.handler = async (event, context) => {
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ message: 'Method Not Allowed' }),
            headers: { 'Content-Type': 'application/json' }
        };
    }

    let payload;
    try {
        payload = JSON.parse(event.body);
    } catch (e) {
        console.error('Failed to parse request body:', e);
        return {
            statusCode: 400,
            body: JSON.stringify({ message: 'Bad Request: Invalid JSON payload' }),
            headers: { 'Content-Type': 'application/json' }
        };
    }

    const action = payload.action;

    // --- DEBUGGING LOGS (HAPUS console.log INI SETELAH DEBUGGING!) ---
    console.log('Received Action:', action);
    // --- AKHIR DEBUGGING LOGS ---

    let response = {};

    try {
        // --- AKSI DEBUGGING BARU: 'echoPassword' (HAPUS INI SETELAH DEBUGGING) ---
        if (action === 'echoPassword') {
            console.log("Echoing ADMIN_PASSWORD for debugging purposes."); // Log ini akan terlihat di Netlify Logs
            return {
                statusCode: 200,
                body: JSON.stringify({
                    success: true,
                    // SANGAT TIDAK AMAN! JANGAN BIARKAN INI DI PRODUKSI!
                    debug_admin_password_from_env: ADMIN_PASSWORD,
                    message: "Password dari ENV telah di-echo untuk debugging."
                }),
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': 'https://dashwarnstore.netlify.app' // Ganti jika domain Anda berbeda
                }
            };
        }
        // --- AKHIR AKSI DEBUGGING BARU ---

        // Aksi: Verifikasi Password Admin (tetap ada)
        else if (action === 'verifyPassword') {
            const enteredPassword = payload.password;
            if (enteredPassword === ADMIN_PASSWORD) {
                response = { success: true, message: 'Password benar.' };
            } else {
                response = { success: false, message: 'Password salah.' };
            }
        }

        // ... Sisa kode api-handler Anda (generateCode, setPrize, checkAndUseCode, getAllCodes) ...
        // TETAPKAN SISA KODE SEPERTI BIASA DI SINI

        else {
            response = { success: false, message: 'Aksi tidak valid.' };
        }

        return {
            statusCode: 200,
            body: JSON.stringify(response),
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': 'https://dashwarnstore.netlify.app' // GANTI INI JIKA ANDA MENGGUNAKAN DOMAIN KUSTOM
            }
        };

    } catch (error) {
        console.error('Error in Netlify Function handler:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ message: 'Internal Server Error', details: error.message }),
            headers: { 'Content-Type': 'application/json' }
        };
    }
};

// Fungsi pembantu generateRandomCode tetap di sini
function generateRandomCode(minLength, maxLength) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const length = Math.floor(Math.random() * (maxLength - minLength + 1)) + minLength;
    let result = '';
    const charactersLength = characters.length;
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}
