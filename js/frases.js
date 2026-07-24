/* ==========================================
   NeoScale
   FRASES.JS
========================================== */


console.log("NEOSCALE FRASES CARREGADO");



import { db } from "./firebase.js";


import {

collection,

getDocs

}

from

"https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";






// ==========================================
// BUSCAR FRASE
// ==========================================


async function buscarFrase(){


    try{


        const consulta =

        await getDocs(

            collection(
                db,
                "frases"
            )

        );



        const lista = [];



        consulta.forEach((doc)=>{


            lista.push(

                doc.data()

            );


        });





        if(lista.length === 0){


            return {

                frase:
                "Uma boa refeição transforma o dia.",

                autor:
                "NeoScale"


            };


        }







        const aleatoria =

        Math.floor(

            Math.random()

            *

            lista.length

        );






        return lista[aleatoria];



    }


    catch(error){


        console.error(

            "Erro ao buscar frases:",

            error

        );



        return {


            frase:
            "A felicidade está nas pequenas coisas.",


            autor:
            "NeoScale"


        };


    }



}









// ==========================================
// DISPONIBILIZAR NO SISTEMA
// ==========================================


window.NeoFrases = {


    buscarFrase


};