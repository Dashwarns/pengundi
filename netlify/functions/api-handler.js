// netlify/functions/api-handler.js

const admin = require('firebase-admin');

// PASTIKAN environment variable ini sudah diatur di Netlify
// dan berisi string JSON dari Firebase Service Account Key Anda
const serviceAccountString = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

// Pastikan untuk menginisialisasi Firebase Admin SDK HANYA SEKALI
if (!admin.apps.length) {
    try {
        const serviceAccount = JSON.parse(serviceAccountString);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
    } catch (error) {
        console.error('Failed to initialize Firebase Admin SDK:', error);
        // Penting: Tangani error ini jika terjadi, mungkin konfigurasi kunci service account salah
    }
}

const db = admin.firestore();
const collectionRef = db.collection('redeemCodes'); // Pastikan nama koleksi Firestore Anda benar

// PASTIKAN environment variable ini sudah diatur di Netlify
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

// --- DEBUGGING LOGS (HAPUS SETELAH DEBUGGING SELESAI!) ---
console.log('API Handler Loaded. Current time:', new Date().toISOString());
console.log('ADMIN_PASSWORD (from env):', ADMIN_PASSWORD ? '***** (Set)' : '!!! NOT SET !!!');
// --- AKHIR DEBUGGING LOGS ---

exports.handler = async (event, context) => {
    // Pastikan hanya menerima request POST
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

    // --- DEBUGGING LOGS (HAPUS SETELAH DEBUGGING SELESAI!) ---
    console.log('Received Action:', action);
    // --- AKHIR DEBUGGING LOGS ---

    let response = {};

    try {
        // Aksi: Verifikasi Password Admin (digunakan oleh kode.html dan setting.html)
        if (action === 'verifyPassword') {
            const enteredPassword = payload.password;
            // --- DEBUGGING LOGS (HAPUS SETELAH DEBUGGING SELESAI!) ---
            console.log('Action: verifyPassword');
            console.log('Entered Password:', enteredPassword ? enteredPassword.substring(0, 3) + '...' : 'Empty'); // Log sebagian saja
            console.log('ADMIN_PASSWORD for comparison:', ADMIN_PASSWORD ? ADMIN_PASSWORD.substring(0, 3) + '...' : 'Undefined'); // Log sebagian saja
            console.log('Password Match Result:', enteredPassword === ADMIN_PASSWORD);
            // --- AKHIR DEBUGGING LOGS ---

            if (enteredPassword === ADMIN_PASSWORD) {
                response = { success: true, message: 'Password benar.' };
            } else {
                response = { success: false, message: 'Password salah.' };
            }
        }

        // Aksi: Membuat Kode Redeem Baru (dari kode.html)
        else if (action === 'generateCode') {
            // Untuk keamanan yang lebih baik, Anda bisa menambahkan cek password di sini juga:
            // if (payload.password !== ADMIN_PASSWORD) { return { statusCode: 401, body: JSON.stringify({ message: 'Unauthorized' })}; }
            // Namun, saat ini kita asumsikan akses sudah diverifikasi di frontend (kode.html)

            const numCodes = parseInt(payload.numCodes);
            if (isNaN(numCodes) || numCodes < 1) {
                return {
                    statusCode: 400,
                    body: JSON.stringify({ success: false, message: 'Jumlah kode tidak valid.' }),
                    headers: { 'Content-Type': 'application/json' }
                };
            }

            const generatedCodes = [];
            const batch = db.batch(); // Menggunakan batch untuk penulisan yang lebih efisien

            for (let i = 0; i < numCodes; i++) {
                const newCode = generateRandomCode(7, 10);
                const docRef = collectionRef.doc(newCode); // Gunakan kode sebagai ID dokumen
                batch.set(docRef, {
                    code: newCode,
                    status: 'Belum',
                    prize: null, // Field untuk hadiah yang diterima saat redeem normal
                    fixedPrize: null, // Field baru: hadiah tetap jika disetting khusus
                    timestamp: null
                });
                generatedCodes.push(newCode);
            }
            await batch.commit(); // Eksekusi semua operasi tulis dalam satu batch
            response = { success: true, codes: generatedCodes, message: `Berhasil membuat ${numCodes} kode.` };
        }

        // Aksi: Mengatur Hadiah Tetap untuk Kode Tertentu (dari setting.html)
        else if (action === 'setPrize') {
            // VERIFIKASI PASSWORD DI BACKEND UNTUK AKSI KRITIS INI
            const enteredPassword = payload.password;
            if (enteredPassword !== ADMIN_PASSWORD) {
                return {
                    statusCode: 401,
                    body: JSON.stringify({ success: false, message: 'Unauthorized: Password admin diperlukan untuk aksi ini.' }),
                    headers: { 'Content-Type': 'application/json' }
                };
            }

            const code = payload.code ? payload.code.toUpperCase() : '';
            const fixedPrize = payload.prize ? payload.prize.trim() : '';

            if (!code || !fixedPrize) {
                return {
                    statusCode: 400,
                    body: JSON.stringify({ success: false, message: 'Kode dan Hadiah tidak boleh kosong.' }),
                    headers: { 'Content-Type': 'application/json' }
                };
            }

            const docRef = collectionRef.doc(code);
            const doc = await docRef.get();

            if (!doc.exists) {
                response = { success: false, message: 'Kode redeem tidak ditemukan.' };
            } else {
                await docRef.update({
                    fixedPrize: fixedPrize // Update field fixedPrize
                });
                response = { success: true, code: code, prize: fixedPrize, message: 'Hadiah tetap berhasil diatur.' };
            }
        }

        // Aksi: Memeriksa dan Menggunakan Kode (dari index.html)
        else if (action === 'checkAndUseCode') {
            const code = payload.code ? payload.code.toUpperCase() : '';
            const wonPrize = payload.prize; // Hadiah yang ditarik dari fungsi undian di frontend

            if (!code) {
                return {
                    statusCode: 400,
                    body: JSON.stringify({ success: false, message: 'Kode redeem tidak boleh kosong.' }),
                    headers: { 'Content-Type': 'application/json' }
                };
            }

            const docRef = collectionRef.doc(code);
            const doc = await docRef.get();

            if (!doc.exists) {
                response = { success: false, message: 'Kode redeem tidak ditemukan.' };
            } else {
                const codeData = doc.data();
                if (codeData.status === 'Digunakan') {
                    // Jika sudah digunakan, kembalikan hadiah yang sudah tercatat (bisa fixedPrize atau prize)
                    const existingPrize = codeData.fixedPrize || codeData.prize;
                    response = { success: false, message: 'Kode redeem sudah digunakan.', prize: existingPrize };
                } else {
                    // Tentukan hadiah akhir: jika ada fixedPrize, gunakan itu. Jika tidak, gunakan wonPrize dari undian.
                    const finalPrize = codeData.fixedPrize ? codeData.fixedPrize : wonPrize;

                    await docRef.update({
                        status: 'Digunakan',
                        prize: finalPrize, // Simpan hadiah yang benar-benar diterima pengguna
                        timestamp: new Date().toLocaleString('id-ID')
                    });
                    response = { success: true, status: 'newly_used', prize: finalPrize };
                }
            }
        }

        // Aksi: Mengambil Semua Kode (opsional, jika ada halaman admin terpisah untuk melihat daftar kode)
        else if (action === 'getAllCodes') {
            // Pertimbangkan untuk menambahkan verifikasi password admin untuk aksi ini
            // if (payload.password !== ADMIN_PASSWORD) { ... }

            const snapshot = await collectionRef.orderBy('code').get(); // Mengambil semua dokumen, diurutkan berdasarkan kode
            const codesData = [];
            snapshot.forEach(doc => {
                codesData.push(doc.data());
            });
            response = { success: true, codes: codesData };
        }

        // Aksi tidak valid
        else {
            response = { success: false, message: 'Aksi tidak valid.' };
        }

        // Respon sukses
        return {
            statusCode: 200,
            body: JSON.stringify(response),
            headers: {
                'Content-Type': 'application/json',
                // Pastikan Access-Control-Allow-Origin sesuai dengan domain situs Anda
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

// Fungsi pembantu untuk menghasilkan kode acak
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
