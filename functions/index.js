const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const https = require('https');
const zlib = require('zlib');
const { XMLParser } = require('fast-xml-parser');

initializeApp();
const db = getFirestore();
const UF = {RO:11,AC:12,AM:13,RR:14,PA:15,AP:16,TO:17,MA:21,PI:22,CE:23,RN:24,PB:25,PE:26,AL:27,SE:28,BA:29,MG:31,ES:32,RJ:33,SP:35,PR:41,SC:42,RS:43,MS:50,MT:51,GO:52,DF:53};
const ENDPOINT='https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx';
const parser=new XMLParser({ignoreAttributes:false,removeNSPrefix:true,parseTagValue:true});
function onlyDigits(v){return String(v||'').replace(/\D/g,'')}
function pick(o,...keys){for(const k of keys){if(o&&o[k]!==undefined)return o[k]}return undefined}
function decodeDocZip(value){const raw=Buffer.from(String(value),'base64');try{return zlib.gunzipSync(raw).toString('utf8')}catch{try{return zlib.inflateRawSync(raw).toString('utf8')}catch{return raw.toString('utf8')}}}
function findNode(root,name){if(!root||typeof root!=='object')return null;if(Object.prototype.hasOwnProperty.call(root,name))return root[name];for(const k of Object.keys(root)){const r=findNode(root[k],name);if(r)return r}return null}
function nfeResumo(xml){
  const x=parser.parse(xml);
  const r=findNode(x,'resNFe')||findNode(x,'resEvento')||findNode(x,'procNFe')||findNode(x,'NFe')||{};
  const infNFe=findNode(r,'infNFe')||{};
  const ide=findNode(infNFe,'ide')||findNode(r,'ide')||{};
  const emit=findNode(infNFe,'emit')||findNode(r,'emit')||{};
  const total=findNode(infNFe,'total')||findNode(r,'total')||{};
  const icms=pick(total,'ICMSTot')||{};
  const dest=findNode(infNFe,'dest')||{};
  return {
    chave: pick(r,'chNFe','chave')||'',
    numero: String(pick(ide,'nNF')||pick(r,'nNF')||''),
    serie: String(pick(ide,'serie')||''),
    emissao: pick(r,'dhEmi','dEmi','dhEvento')||pick(ide,'dhEmi','dEmi')||'',
    emitenteNome: pick(emit,'xNome','xFant')||pick(r,'xNome','xFant')||'',
    emitenteCnpj: onlyDigits(pick(emit,'CNPJ','CPF')||pick(r,'CNPJ','CPF')||''),
    destinatarioCnpj: onlyDigits(pick(dest,'CNPJ','CPF')||''),
    valor: Number(pick(icms,'vNF')||pick(r,'vNF')||0),
    situacao: pick(r,'cSitNFe','cStat')||'',
    xml: xml
  };
}
function soap(cnpj,uf,ultNSU){const c=onlyDigits(cnpj);const cUF=UF[uf]||52;const body=`<distDFeInt xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.01"><tpAmb>1</tpAmb><cUFAutor>${cUF}</cUFAutor><CNPJ>${c}</CNPJ><distNSU><ultNSU>${String(ultNSU||'0').padStart(15,'0')}</ultNSU></distNSU></distDFeInt>`;return `<?xml version="1.0" encoding="UTF-8"?><soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope"><soap:Body><nfeDistDFeInteresse xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe"><nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe">${body}</nfeDadosMsg></nfeDistDFeInteresse></soap:Body></soap:Envelope>`}
function requestNfe(pfx,password,xml){return new Promise((resolve,reject)=>{const req=https.request(ENDPOINT,{method:'POST',pfx:Buffer.from(pfx,'base64'),passphrase:password,rejectUnauthorized:true,headers:{'Content-Type':'application/soap+xml; charset=utf-8;',Accept:'application/soap+xml; charset=utf-8;','Content-Length':Buffer.byteLength(xml)}},res=>{let data='';res.setEncoding('utf8');res.on('data',d=>data+=d);res.on('end',()=>resolve({status:res.statusCode,body:data}))});req.on('error',reject);req.setTimeout(60000,()=>req.destroy(new Error('Timeout na consulta à SEFAZ')));req.write(xml);req.end()})}
exports.sincronizarNfe=onCall({region:'southamerica-east1',timeoutSeconds:120,memory:'512MiB'},async request=>{if(!request.auth)throw new HttpsError('unauthenticated','Faça login.');const u=await db.doc(`usuarios/${request.auth.uid}`).get();const func=u.exists?u.data().funcao:'';if(!['ADMINISTRADOR','CAIXA'].includes(func))throw new HttpsError('permission-denied','Sem permissão.');const {cnpj,uf,pfxBase64,password}=request.data||{};if(onlyDigits(cnpj).length!==14||!UF[uf]||!pfxBase64||!password)throw new HttpsError('invalid-argument','CNPJ, UF, certificado A1 e senha são obrigatórios.');const cfgRef=db.doc('configuracoes/fiscal');const cfg=(await cfgRef.get()).data()||{};let ultNSU=String(cfg.ultNSU||'0');let recebidas=0;let ultimo=ultNSU;for(let rodada=0;rodada<8;rodada++){const r=await requestNfe(pfxBase64,password,soap(cnpj,uf,ultNSU));if(r.status<200||r.status>=300)throw new Error(`SEFAZ HTTP ${r.status}`);const parsed=parser.parse(r.body);const ret=findNode(parsed,'retDistDFeInt')||{};const cStat=String(pick(ret,'cStat')||'');const motivo=pick(ret,'xMotivo')||'';if(cStat&&!['137','138','139'].includes(cStat)&&cStat!=='138')throw new Error(`SEFAZ ${cStat}: ${motivo}`);const lote=findNode(ret,'loteDistDFeInt')||{};const docs=lote.docZip||[];const arr=Array.isArray(docs)?docs:[docs];for(const d of arr){const nsu=String(pick(d,'NSU')||pick(d,'nsu')||'');const schema=String(pick(d,'schema')||'');const xml=decodeDocZip(pick(d,'_')||pick(d,'#text')||'');if(nsu&&Number(nsu)>Number(ultimo))ultimo=nsu;if(!xml)continue;const resumo=nfeResumo(xml);if(!resumo.chave&&!resumo.numero)continue;const id=resumo.chave||`nsu_${nsu}`;const ref=db.doc(`nfesRecebidas/${id}`);const old=await ref.get();await ref.set({...resumo,status:old.exists?(old.data().status||'NOVA'):'NOVA',nsu,schema,atualizadoEm:FieldValue.serverTimestamp(),recebidoEm:old.exists()?(old.data().recebidoEm||FieldValue.serverTimestamp()):FieldValue.serverTimestamp()},{merge:true});if(!old.exists())recebidas++;}const maxNSU=String(pick(ret,'maxNSU')||ultimo);const ult=String(pick(ret,'ultNSU')||ultimo);if(Number(ult)>=Number(maxNSU)||arr.length===0){ultimo=ult||ultimo;break}ultNSU=ult||ultimo;}await cfgRef.set({cnpj:onlyDigits(cnpj),uf,ultNSU:ultimo,ultimaSincronizacao:FieldValue.serverTimestamp()},{merge:true});return {recebidas,ultNSU:ultimo};});
