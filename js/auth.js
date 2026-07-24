/* ==========================================
   NeoScale
   AUTH.JS
========================================== */


console.log("AUTH.JS CARREGADO");


import { auth } from "./firebase.js";


import {

signInWithEmailAndPassword,
onAuthStateChanged

}

from

"https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";





const formulario =

document.getElementById("loginForm");





if(formulario){


formulario.addEventListener(

"submit",

async(e)=>{


e.preventDefault();



const email =

document.getElementById("email").value;



const senha =

document.getElementById("senha").value;



try{


await signInWithEmailAndPassword(

auth,

email,

senha

);



window.location.href =
"dashboard.html";



}


catch(error){


console.error(error);


alert(
"Usuário ou senha inválidos."
);


}



}


);



}






onAuthStateChanged(

auth,

(user)=>{


if(user){


console.log(
"Usuário conectado:",
user.email
);


}


});