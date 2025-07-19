// netlify/functions/api-handler.js

// Tidak lagi memerlukan Firebase Admin SDK atau Google Sheets API
// const admin = require('firebase-admin');
// const { google } = require('googleapis');
// const { JWT } = require('google-auth-library');

// ADMIN_PASSWORD masih diperlukan untuk otentikasi halaman admin (kode.html dan setting.html)
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

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
    let response = {};

    try {
        // Aksi: Verifikasi Password Admin (tetap ada untuk melindungi kode.html dan setting.html)
        if (action === 'verifyPassword') {
            const enteredPassword = payload.password;
            if (enteredPassword === ADMIN_PASSWORD) {
                response = { success: true, message: 'Password benar.' };
            } else {
                response = { success: false, message: 'Password salah.' };
            }
        }

        // Aksi: Membuat Kode Redeem Baru (dari kode.html)
        // KODE HANYA DIBUAT SECARA ACAK, TIDAK DISIMPAN DI MANA PUN.
        else if (action === 'generateCode') {
            // Verifikasi password admin untuk aksi ini
            const enteredPassword = payload.password;
            if (enteredPassword !== ADMIN_PASSWORD) {
                 return {
                    statusCode: 401,
                    body: JSON.stringify({ success: false, message: 'Unauthorized: Password admin diperlukan.' }),
                    headers: { 'Content-Type': 'application/json' }
                };
            }

            const numCodes = parseInt(payload.numCodes);
            if (isNaN(numCodes) || numCodes < 1) {
                return {
                    statusCode: 400,
                    body: JSON.stringify({ success: false, message: 'Jumlah kode tidak valid.' }),
                    headers: { 'Content-Type': 'application/json' }
                };
            }

            const generatedCodes = [];
            for (let i = 0; i < numCodes; i++) {
                generatedCodes.push(generateRandomCode(7, 10));
            }
            // Kode hanya ditampilkan di frontend, tidak disimpan
            response = { success: true, codes: generatedCodes, message: `Berhasil membuat ${numCodes} kode (tidak disimpan).` };
        }

        // Aksi: Mengatur Hadiah Tetap (dari setting.html)
        // AKSI INI TIDAK AKAN BEKERJA KARENA TIDAK ADA DATABASE UNTUK MENYIMPANNYA.
        // FUNGSI INI HANYA AKAN MENGEMBALIKAN PESAN SUKSES PALSU.
        else if (action === 'setPrize') {
             // Verifikasi password admin untuk aksi ini
            const enteredPassword = payload.password;
            if (enteredPassword !== ADMIN_PASSWORD) {
                 return {
                    statusCode: 401,
                    body: JSON.stringify({ success: false, message: 'Unauthorized: Password admin diperlukan.' }),
                    headers: { 'Content-Type': 'application/json' }
                };
            }

            const code = payload.code ? payload.code.toUpperCase() : '';
            const fixedPrize = payload.prize ? payload.prize.trim() : '';
            
            // Simulasikan sukses, tapi data tidak disimpan
            response = { 
                success: true, 
                code: code, 
                prize: fixedPrize, 
                message: 'Pengaturan hadiah berhasil disimulasikan (tidak disimpan permanen).' 
            };
        }

        // Aksi: Memeriksa dan Menggunakan Kode (dari index.html)
        // KODE INI AKAN SELALU DIANGGAP BARU DAN HADIAH SELALU ACAR.
        // TIDAK ADA PENGECEKAN STATUS 'DIGUNAKAN'.
        else if (action === 'checkAndUseCode') {
            const code = payload.code ? payload.code.toUpperCase() : '';
            const wonPrize = payload.prize; // Hadiah yang ditarik dari fungsi undian di frontend

            // Selalu anggap kode baru dan valid
            response = { success: true, status: 'newly_used', prize: wonPrize };
            // Catatan: Tidak ada logika untuk memeriksa apakah kode sudah digunakan
            // Hadiah yang diberikan akan selalu wonPrize (dari acak) karena fixedPrize tidak disimpan.
        }

        // Aksi: Mengambil Semua Kode (opsional)
        // AKSI INI TIDAK AKAN MENGEMBALIKAN APA PUN KARENA TIDAK ADA DATABASE.
        else if (action === 'getAllCodes') {
            // Verifikasi password admin untuk aksi ini
            const enteredPassword = payload.password;
            if (enteredPassword !== ADMIN_PASSWORD) {
                 return {
                    statusCode: 401,
                    body: JSON.stringify({ success: false, message: 'Unauthorized: Password admin diperlukan.' }),
                    headers: { 'Content-Type': 'application/json' }
                };
            }
            response = { success: true, codes: [], message: 'Tidak ada kode tersimpan.' };
        }

        // Aksi tidak valid
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

// Fungsi pembantu untuk menghasilkan kode acak (tidak berubah)
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
