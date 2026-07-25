const seletorTema = document.getElementById("temaQuiosque");
const chaveTema = "neoscale-tema-quiosque";

function aplicarTema(tema) {
    document.body.dataset.tema = tema;
    localStorage.setItem(chaveTema, tema);
}

const temaSalvo = localStorage.getItem(chaveTema) || "azul";
if (seletorTema) {
    seletorTema.value = temaSalvo;
    aplicarTema(temaSalvo);
    seletorTema.addEventListener("change", () => aplicarTema(seletorTema.value));
}
