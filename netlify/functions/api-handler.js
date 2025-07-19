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

// Ambil password admin dari Environment Variable
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

        // --- Aksi Baru: Verifikasi Password ---
        if (action === 'verifyPassword') {
            const enteredPassword = payload.password;
            if (enteredPassword === ADMIN_PASSWORD) { // Verifikasi password
                response = { success: true, message: 'Password benar.' };
            } else {
                response = { success: false, message: 'Password salah.' };
            }
        }
        // --- Akhir Aksi Baru ---

        else if (action === 'generateCode') {
            // OPTIONAL: Anda bisa menambahkan cek password di sini juga
            // jika Anda ingin memastikan setiap permintaan `generateCode`
            // juga membawa password yang benar.
            // Namun, karena frontend sudah melakukan verifikasi awal,
            // untuk kasus sederhana ini, kita asumsikan akses sudah diberikan.

            const numCodes = payload.numCodes;
            const generatedCodes = [];
            const batch = db.batch();

            for (let i = 0; i < numCodes; i++) {
                const newCode = generateRandomCode(7, 10);
                const docRef = collectionRef.doc(newCode);
                batch.set(docRef, {
                    code: newCode,
                    status: 'Belum',
                    prize: null,
                    timestamp: null
                });
                generatedCodes.push(newCode);
            }
            await batch.commit();
            response = { success: true, codes: generatedCodes };

        } else if (action === 'checkAndUseCode') {
            const code = payload.code.toUpperCase();
            const wonPrize = payload.prize;
            const docRef = collectionRef.doc(code);
            const doc = await docRef.get();

            if (!doc.exists) {
                response = { success: false, message: 'Kode redeem tidak ditemukan.' };
            } else {
                const codeData = doc.data();
                if (codeData.status === 'Digunakan') {
                    response = { success: false, message: 'Kode redeem sudah digunakan.', prize: codeData.prize };
                } else {
                    await docRef.update({
                        status: 'Digunakan',
                        prize: wonPrize,
                        timestamp: new Date().toLocaleString('id-ID')
                    });
                    response = { success: true, status: 'newly_used', prize: wonPrize };
                }
            }

        } else if (action === 'getAllCodes') {
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
