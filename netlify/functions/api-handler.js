// netlify/functions/api-handler.js

// Instal Firebase Admin SDK (npm install firebase-admin)
// Ini akan otomatis diinstal oleh Netlify saat build
const admin = require('firebase-admin');

// Ambil kredensial service account dari environment variables
// Pastikan ini adalah string JSON yang dienkripsi atau langsung di paste
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
        // Handle error initialization
    }
}

const db = admin.firestore();
const collectionRef = db.collection('redeemCodes'); // Nama koleksi Firestore Anda

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

        if (action === 'generateCode') {
            const numCodes = payload.numCodes;
            const generatedCodes = [];
            const batch = db.batch(); // Menggunakan batch untuk menulis banyak dokumen lebih efisien

            for (let i = 0; i < numCodes; i++) {
                const newCode = generateRandomCode(7, 10);
                const docRef = collectionRef.doc(newCode); // Gunakan kode sebagai ID dokumen
                batch.set(docRef, {
                    code: newCode,
                    status: 'Belum',
                    prize: null,
                    timestamp: null
                });
                generatedCodes.push(newCode);
            }
            await batch.commit(); // Tulis semua dokumen dalam satu operasi batch
            response = { success: true, codes: generatedCodes };

        } else if (action === 'checkAndUseCode') {
            const code = payload.code.toUpperCase();
            const wonPrize = payload.prize;
            const docRef = collectionRef.doc(code); // Dapatkan dokumen berdasarkan kode
            const doc = await docRef.get();

            if (!doc.exists) {
                response = { success: false, message: 'Kode redeem tidak ditemukan.' };
            } else {
                const codeData = doc.data();
                if (codeData.status === 'Digunakan') {
                    response = { success: false, message: 'Kode redeem sudah digunakan.', prize: codeData.prize };
                } else {
                    // Update status kode
                    await docRef.update({
                        status: 'Digunakan',
                        prize: wonPrize,
                        timestamp: new Date().toLocaleString('id-ID')
                    });
                    response = { success: true, status: 'newly_used', prize: wonPrize };
                }
            }

        } else if (action === 'getAllCodes') {
            const snapshot = await collectionRef.orderBy('code').get(); // Ambil semua dokumen
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
