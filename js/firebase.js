/* ==========================================
   NeoScale
   FIREBASE CONFIGURAÇÃO
========================================== */


console.log("NEOSCALE FIREBASE CARREGADO");


// Import Firebase

import { initializeApp } 
from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";


import { getFirestore }
from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


import { getAuth }
from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";




// ==========================================
// CONFIGURAÇÃO FIREBASE
// ==========================================


// SUBSTITUIR PELOS DADOS DO PROJETO FIREBASE


const firebaseConfig = {
    apiKey: "AIzaSyCq-uHd3KqO8n02MpY-CqV3QP31p8SExhg",
    authDomain: "neoscale-6f7af.firebaseapp.com",
    projectId: "neoscale-6f7af",
    storageBucket: "neoscale-6f7af.firebasestorage.app",
    messagingSenderId: "844489196273",
    appId: "1:844489196273:web:ea887303bc54df3e965f50"
  };





// ==========================================
// INICIALIZAR
// ==========================================


const app =

initializeApp(firebaseConfig);





// Banco

const db =

getFirestore(app);





// Autenticação

const auth =

getAuth(app);





// Exportar

export {

    db,

    auth

};