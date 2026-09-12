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


let mensagem = "Usuário ou senha inválidos.";

if(error.code === "auth/user-not-found") mensagem = "Usuário não encontrado. Use Criar primeiro acesso.";
if(error.code === "auth/wrong-password") mensagem = "Senha incorreta.";
if(error.code === "auth/invalid-credential") mensagem = "E-mail ou senha incorretos.";
if(error.code === "auth/invalid-email") mensagem = "E-mail inválido.";
if(error.code === "auth/too-many-requests") mensagem = "Muitas tentativas. Aguarde alguns minutos e tente novamente.";

alert(mensagem);


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