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

        let response = {};

        // Verifikasi Password (digunakan oleh kode.html dan setting.html)
        if (action === 'verifyPassword') {
            const enteredPassword = payload.password;
            if (enteredPassword === ADMIN_PASSWORD) {
                response = { success: true, message: 'Password benar.' };
            } else {
                response = { success: false, message: 'Password salah.' };
            }
        }

        // Aksi untuk membuat kode (dari kode.html)
        else if (action === 'generateCode') {
            // Untuk keamanan yang lebih baik, Anda bisa menambahkan cek password di sini juga:
            // if (payload.password !== ADMIN_PASSWORD) { return { statusCode: 401, body: JSON.stringify({ message: 'Unauthorized' })}; }

            const numCodes = payload.numCodes;
            const generatedCodes = [];
            const batch = db.batch();

            for (let i = 0; i < numCodes; i++) {
                const newCode = generateRandomCode(7, 10);
                const docRef = collectionRef.doc(newCode);
                batch.set(docRef, {
                    code: newCode,
                    status: 'Belum',
                    prize: null, // prize yang akan diterima saat redeem normal
                    fixedPrize: null, // <--- FIELD BARU: hadiah tetap jika disetting
                    timestamp: null
                });
                generatedCodes.push(newCode);
            }
            await batch.commit();
            response = { success: true, codes: generatedCodes };

        }
        // --- Aksi Baru: Set Hadiah Tetap ---
        else if (action === 'setPrize') {
            // Verifikasi password untuk aksi kritis ini
            if (payload.password !== ADMIN_PASSWORD) { // Pastikan password dikirim dari frontend untuk aksi ini
                return {
                    statusCode: 401,
                    body: JSON.stringify({ success: false, message: 'Unauthorized: Password admin diperlukan untuk aksi ini.' }),
                    headers: { 'Content-Type': 'application/json' }
                };
            }

            const code = payload.code.toUpperCase();
            const fixedPrize = payload.prize;
            const docRef = collectionRef.doc(code);
            const doc = await docRef.get();

            if (!doc.exists) {
                response = { success: false, message: 'Kode redeem tidak ditemukan.' };
            } else {
                await docRef.update({
                    fixedPrize: fixedPrize // <--- Update field baru
                });
                response = { success: true, code: code, prize: fixedPrize, message: 'Hadiah tetap berhasil diatur.' };
            }
        }
        // --- Akhir Aksi Baru ---

        // Aksi untuk checkAndUseCode (dari index.html) - LOGIKA PENTING DI SINI
        else if (action === 'checkAndUseCode') {
            const code = payload.code.toUpperCase();
            const wonPrize = payload.prize; // Hadiah yang ditarik dari fungsi undian
            const docRef = collectionRef.doc(code);
            const doc = await docRef.get();

            if (!doc.exists) {
                response = { success: false, message: 'Kode redeem tidak ditemukan.' };
            } else {
                const codeData = doc.data();
                if (codeData.status === 'Digunakan') {
                    response = { success: false, message: 'Kode redeem sudah digunakan.', prize: codeData.prize || codeData.fixedPrize };
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
        // Aksi untuk getAllCodes (dari kode.html jika Anda tambahkan, atau bisa dihapus)
        else if (action === 'getAllCodes') {
            const snapshot = await collectionRef.orderBy('code').get();
            const codesData = [];
            snapshot.forEach(doc => {
                codesData.push(doc.data());
            });
            response = { success: true, codes: codesData };

        } else {
            response = { success: false, message: 'Aksi tidak valid.' };
        }

        return {
            statusCode: 200,
            body: JSON.stringify(response),
            headers: {
                'Content-Type': 'application/json',
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
