import { db, auth } from "./firebase.js";
import { encerrarSessao } from "./sessao.js";
import { collection, getDocs, getDoc, doc, query, where, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const money = v => Number(v||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const weight = v => `${Number(v||0).toFixed(3).replace('.',',')} kg`;
const todayStart = () => { const d=new Date(); d.setHours(0,0,0,0); return d; };
const asDate = v => v?.toDate ? v.toDate() : (v ? new Date(v) : null);
const isToday = d => d && d >= todayStart() && d <= new Date();

async function carregarUsuarioLogado(){
  const aplicar = (nome, funcao) => {
    const nomeFinal = (nome || 'Usuário').trim();
    const funcaoFinal = funcao === 'ADMINISTRADOR' ? 'Administrador' : (funcao || 'Usuário conectado');
    document.getElementById('topUsuarioNome')?.textContent = nomeFinal;
    document.getElementById('topUsuarioFuncao')?.textContent = funcaoFinal;
    document.getElementById('menuUsuarioNome')?.textContent = nomeFinal;
    document.getElementById('menuUsuarioFuncao')?.textContent = funcaoFinal;
  };

  onAuthStateChanged(auth, async (usuario) => {
    if(!usuario) return;
    try {
      const snap = await getDoc(doc(db, 'usuarios', usuario.uid));
      const perfil = snap.exists() ? snap.data() : {};
      const nomePerfil = (perfil.nome || perfil.nomeCompleto || '').trim();
      const nomeAuth = (usuario.displayName || '').trim();
      const nomeEmail = (usuario.email || '').split('@')[0].replace(/[._-]+/g, ' ').trim();
      const nomeFallback = nomeEmail ? nomeEmail.replace(/\b\w/g, c => c.toUpperCase()) : 'Usuário';
      const nome = (nomePerfil && nomePerfil.toUpperCase() !== 'ADMINISTRADOR') ? nomePerfil :
                   (nomeAuth && nomeAuth.toUpperCase() !== 'ADMINISTRADOR') ? nomeAuth : nomeFallback;
      const funcao = perfil.funcao || 'ADMINISTRADOR';
      aplicar(nome, funcao);
      const emailEl = document.getElementById('menuUsuarioEmail');
      if (emailEl) emailEl.textContent = usuario.email || '';
    } catch(e) {
      console.error('Não foi possível carregar o usuário logado:', e);
      const nomeAuth = (usuario.displayName || '').trim();
      const nomeEmail = (usuario.email || '').split('@')[0].replace(/[._-]+/g, ' ').trim();
      const nome = (nomeAuth && nomeAuth.toUpperCase() !== 'ADMINISTRADOR') ? nomeAuth : (nomeEmail || 'Usuário');
      aplicar(nome.replace(/\b\w/g, c => c.toUpperCase()), 'ADMINISTRADOR');
      const emailEl = document.getElementById('menuUsuarioEmail');
      if (emailEl) emailEl.textContent = usuario.email || '';
    }
  });
}

function atualizarSaudacao(){ const h=new Date().getHours(); document.getElementById('saudacao').textContent=h<12?'Bom dia!':h<18?'Boa tarde!':'Boa noite!'; }
function atualizarRelogio(){ const n=new Date(); document.getElementById('dataAtual').textContent=n.toLocaleDateString('pt-BR'); document.getElementById('horaAtual').textContent=n.toLocaleTimeString('pt-BR'); document.getElementById('chartDate').textContent=n.toLocaleDateString('pt-BR'); }
function quote(){ const q=[['“A simplicidade é o último grau da sofisticação.”','Leonardo da Vinci'],['“Tudo vale a pena quando a alma não é pequena.”','Fernando Pessoa'],['“A vida é a arte do encontro.”','Vinicius de Moraes'],['“O essencial é invisível aos olhos.”','Antoine de Saint-Exupéry']]; const x=q[Math.floor(Math.random()*q.length)]; document.getElementById('fraseDia').textContent=x[0]; document.getElementById('autorFrase').textContent=x[1]; }

function drawChart(items){
  const hours=Array.from({length:15},(_,i)=>i+8), counts=hours.map(h=>items.filter(x=>{const d=asDate(x.criadoEm||x.finalizadoEm);return d&&d.getHours()===h}).length);
  const revenue=hours.map(h=>items.filter(x=>{const d=asDate(x.finalizadoEm||x.criadoEm);return d&&d.getHours()===h&&x.status==='FINALIZADA'}).reduce((s,x)=>s+Number(x.total||0),0));
  const max=Math.max(1,...counts); const bars=document.getElementById('bars'); bars.innerHTML='';
  counts.forEach(v=>{const b=document.createElement('div');b.className='bar';b.style.height=`${Math.max(3,v/max*100)}%`;bars.appendChild(b)});
  const chart=document.getElementById('lineChart'); const w=1000,h=170; const maxR=Math.max(1,...revenue); const pts=revenue.map((v,i)=>`${i/(revenue.length-1)*w},${h-(v/maxR*h*.82)-8}`).join(' ');
  chart.setAttribute('viewBox',`0 0 ${w} ${h}`); chart.innerHTML=`<polyline points="${pts}"/>${revenue.map((v,i)=>{const x=i/(revenue.length-1)*w,y=h-(v/maxR*h*.82)-8;return `<circle cx="${x}" cy="${y}" r="3.2"/>`}).join('')}`;
  document.getElementById('xLabels').innerHTML=hours.map(h=>`<span>${String(h).padStart(2,'0')}:00</span>`).join('');
}
function renderSales(items){
  const list=document.getElementById('salesList'); const sales=items.filter(x=>x.status==='FINALIZADA').sort((a,b)=>(asDate(b.finalizadoEm||b.criadoEm)||0)-(asDate(a.finalizadoEm||a.criadoEm)||0)).slice(0,6);
  if(!sales.length){list.innerHTML='<div class="empty-state"><i class="bi bi-inbox"></i><strong>Nenhuma venda registrada hoje</strong><span>As vendas finalizadas aparecerão aqui.</span></div>';return;}
  list.innerHTML=sales.map(x=>{const d=asDate(x.finalizadoEm||x.criadoEm);return `<div class="sale"><i class="sale-dot"></i><span class="sale-time">${d?d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}):'--:--'}</span><div class="sale-info"><strong>Comanda #${x.numero||'------'}</strong><small>${weight(x.peso)} · ${x.pagamento||'Pagamento'}</small></div><span class="sale-value">${money(x.total)}</span><i class="bi bi-chevron-right"></i></div>`}).join('');
}
async function carregar(){
  const btn=document.getElementById('btnAtualizar'); btn?.classList.add('loading');
  try{
    const [comandasSnap, mesasSnap] = await Promise.all([
      getDocs(query(collection(db,'comandas'),orderBy('criadoEm','desc'),limit(500))),
      getDocs(collection(db,'mesas'))
    ]);
    const all=comandasSnap.docs.map(d=>({id:d.id,...d.data()}));
    const hoje=all.filter(x=>isToday(asDate(x.criadoEm)));
    const finalizadas=hoje.filter(x=>x.status==='FINALIZADA');
    const abertas=all.filter(x=>x.status==='ABERTA');
    const faturamento=finalizadas.reduce((s,x)=>s+Number(x.total||0),0);
    const peso=hoje.reduce((s,x)=>s+Number(x.peso||0),0);
    const ticket=finalizadas.length?faturamento/finalizadas.length:0;
    const mesas=mesasSnap.docs.map(d=>({id:d.id,...d.data()}));
    const ocupadas=mesas.filter(m=>m.status==='ABERTA').length;

    document.getElementById('faturamento').textContent=money(faturamento);
    document.getElementById('totalPesagens').textContent=hoje.length;
    document.getElementById('clientes').textContent=ocupadas;
    document.getElementById('comandasAbertas').textContent=abertas.length;

    document.getElementById('faturamentoSub').textContent=finalizadas.length?`${finalizadas.length} venda${finalizadas.length===1?'':'s'} finalizada${finalizadas.length===1?'':'s'}`:'Nenhuma venda finalizada';
    document.getElementById('pesagensSub').textContent=hoje.length?`${hoje.length} pedido${hoje.length===1?'':'s'} registrado${hoje.length===1?'':'s'}`:'Nenhum pedido registrado';
    document.getElementById('clientesSub').textContent=`${ocupadas} de ${mesas.length} mesa${mesas.length===1?'':'s'} ocupada${ocupadas===1?'':'s'}`;
    document.getElementById('comandasSub').textContent=abertas.length?`${abertas.length} aguardando fechamento`:'Nenhuma comanda em aberto';

    document.getElementById('heroVendas').textContent=finalizadas.length;
    document.getElementById('heroMesas').textContent=ocupadas;
    document.getElementById('heroComandas').textContent=abertas.length;
    document.getElementById('heroFaturamento').textContent=money(faturamento);
    document.getElementById('resumoTitulo').textContent=finalizadas.length||ocupadas||abertas.length?'Operação em andamento.':'Tudo pronto para começar.';
    document.getElementById('resumoSubtitulo').textContent=finalizadas.length||ocupadas||abertas.length?'Veja em um só lugar o movimento do restaurante, sem precisar abrir cada módulo.':'Acompanhe rapidamente vendas, mesas e comandas assim que o movimento começar.';

    document.getElementById('sumPesagens').textContent=hoje.length;
    document.getElementById('sumFaturamento').textContent=money(faturamento);
    document.getElementById('sumPeso').textContent=weight(peso);
    document.getElementById('ticketMedio').textContent=money(ticket);

    drawChart(hoje); renderSales(hoje);
  }catch(e){ console.error('Dashboard:',e); }
  finally{ btn?.classList.remove('loading'); }
}
function configurarTopbar(){
  const lojaBtn = document.getElementById('btnLoja');
  const usuarioBtn = document.getElementById('btnUsuario');
  const menuLoja = document.getElementById('menuLoja');
  const menuUsuario = document.getElementById('menuUsuario');

  const fecharMenus = () => {
    [lojaBtn, usuarioBtn].forEach(btn => btn?.setAttribute('aria-expanded','false'));
    [menuLoja, menuUsuario].forEach(menu => { if(menu) menu.hidden = true; });
  };

  const alternar = (btn, menu, outroBtn, outroMenu) => {
    if(!btn || !menu) return;
    const aberto = btn.getAttribute('aria-expanded') === 'true';
    if(aberto){
      fecharMenus();
      return;
    }
    if(outroBtn) outroBtn.setAttribute('aria-expanded','false');
    if(outroMenu) outroMenu.hidden = true;
    btn.setAttribute('aria-expanded','true');
    menu.hidden = false;
  };

  lojaBtn?.addEventListener('click', e => {
    e.stopPropagation();
    alternar(lojaBtn, menuLoja, usuarioBtn, menuUsuario);
  });

  usuarioBtn?.addEventListener('click', e => {
    e.stopPropagation();
    alternar(usuarioBtn, menuUsuario, lojaBtn, menuLoja);
  });

  [menuLoja, menuUsuario].forEach(menu => menu?.addEventListener('click', e => e.stopPropagation()));

  document.addEventListener('click', fecharMenus);
  document.addEventListener('keydown', e => {
    if(e.key === 'Escape') fecharMenus();
  });

  document.querySelectorAll('[data-action]').forEach(item => {
    item.addEventListener('click', () => {
      const action = item.dataset.action;
      fecharMenus();
      if(action === 'configuracoes') window.location.href = 'configuracoes.html';
      if(action === 'historico') window.location.href = 'historico.html';
      if(action === 'sair') encerrarSessao().catch(console.error);
    });
  });

  document.querySelectorAll('[data-store]').forEach(item => {
    item.addEventListener('click', () => {
      localStorage.setItem('neoscaleLojaAtiva', item.dataset.store);
      fecharMenus();
    });
  });
}

document.addEventListener('DOMContentLoaded',()=>{
  atualizarSaudacao();
  carregarUsuarioLogado();
  atualizarRelogio();
  quote();
  carregar();
  configurarTopbar();
  setInterval(atualizarRelogio,1000);
  setInterval(atualizarSaudacao,60000);
  document.getElementById('btnAtualizar')?.addEventListener('click',carregar);
  document.querySelectorAll('.period').forEach(b=>b.addEventListener('click',()=>{
    document.querySelectorAll('.period').forEach(x=>x.classList.remove('active'));
    b.classList.add('active');
  }));
});
