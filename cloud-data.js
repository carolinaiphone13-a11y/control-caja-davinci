const DAVINCI_DATA_KEY='davinci-caja-data';

window.DavinciCloud=(()=>{
  const clientId=localStorage.getItem('davinci-client-id')||crypto.randomUUID();
  localStorage.setItem('davinci-client-id',clientId);

  const data={professionals:[],sales:[],refunds:[],expenses:[]};
  const unsubs=[];
  const prefixes={sale:'V',refund:'D',expense:'S'};
  const collections={sale:'sales',refund:'refunds',expense:'expenses',professional:'professionals'};
  let db=null;
  let ready=false;
  let lastError='';
  let onDataChange=null;

  function hasConfig(){
    const c=window.DAVINCI_FIREBASE_CONFIG||{};
    return Boolean(c.apiKey&&c.authDomain&&c.projectId&&c.appId);
  }

  function loadLocal(){
    try{
      const dataOnly=JSON.parse(localStorage.getItem(DAVINCI_DATA_KEY)||'null');
      if(dataOnly)return dataOnly;
      const legacy=JSON.parse(localStorage.getItem('davinci-caja')||'null');
      if(!legacy)return null;
      return {
        professionals:legacy.professionals||[],
        sales:legacy.sales||[],
        refunds:legacy.refunds||[],
        expenses:legacy.expenses||[]
      };
    }catch(_){return null}
  }

  function saveLocal(next){
    localStorage.setItem(DAVINCI_DATA_KEY,JSON.stringify({
      professionals:next.professionals||[],
      sales:next.sales||[],
      refunds:next.refunds||[],
      expenses:next.expenses||[]
    }));
  }

  function status(){
    if(!hasConfig())return 'Modo local';
    if(ready)return 'Nube activa';
    if(lastError)return `Error nube: ${lastError}`;
    return 'Conectando nube';
  }

  function root(){
    return db.collection('davinci').doc('control-caja');
  }

  function emit(){
    const payload={
      professionals:[...data.professionals],
      sales:[...data.sales],
      refunds:[...data.refunds],
      expenses:[...data.expenses]
    };
    saveLocal(payload);
    if(onDataChange)onDataChange(payload);
  }

  function sortByFolio(a,b){
    return String(a.folio||'').localeCompare(String(b.folio||''),'es-CL',{numeric:true});
  }

  async function init(callback,localDataProvider){
    onDataChange=callback;
    if(!hasConfig()||!window.firebase)return false;
    try{
      if(!firebase.apps.length)firebase.initializeApp(window.DAVINCI_FIREBASE_CONFIG);
      await firebase.auth().signInAnonymously();
      db=firebase.firestore();
      await db.enablePersistence({synchronizeTabs:true}).catch(()=>{});
      await migrateLegacyData(localDataProvider?localDataProvider():loadLocal());
      listenCollection('professionals','professionals');
      listenCollection('sales','sales');
      listenCollection('refunds','refunds');
      listenCollection('expenses','expenses');
      ready=true;
      lastError='';
      emit();
      return true;
    }catch(err){
      console.warn('Firebase no disponible',err);
      lastError=err.code||err.message||'Firebase';
      ready=false;
      return false;
    }
  }

  function listenCollection(name,key){
    const unsub=root().collection(name).onSnapshot(snap=>{
      lastError='';
      ready=true;
      data[key]=snap.docs.map(d=>({id:d.id,...d.data()})).sort(sortByFolio);
      emit();
    },err=>{
      console.warn(`Firestore ${name} no disponible`,err);
      lastError=err.code||err.message||name;
      ready=false;
      emit();
    });
    unsubs.push(unsub);
  }

  async function migrateLegacyData(localData){
    const marker=root().collection('meta').doc('migration-v3');
    const done=await marker.get();
    if(done.exists)return;
    const oldRoot=await root().get();
    const remoteState=oldRoot.exists?(oldRoot.data()||{}).state:null;
    localData={
      professionals:[...(localData?.professionals||[]),...(remoteState?.professionals||[])],
      sales:[...(localData?.sales||[]),...(remoteState?.sales||[])],
      refunds:[...(localData?.refunds||[]),...(remoteState?.refunds||[])],
      expenses:[...(localData?.expenses||[]),...(remoteState?.expenses||[])]
    };
    const batch=db.batch();
    (localData.professionals||[]).forEach(p=>{
      if(!p.profesional)return;
      batch.set(root().collection('professionals').doc(profId(p)),p,{merge:true});
    });
    (localData.sales||[]).forEach(r=>r.folio&&batch.set(root().collection('sales').doc(r.folio),r,{merge:true}));
    (localData.refunds||[]).forEach(r=>r.folio&&batch.set(root().collection('refunds').doc(r.folio),r,{merge:true}));
    (localData.expenses||[]).forEach(r=>r.folio&&batch.set(root().collection('expenses').doc(r.folio),r,{merge:true}));
    batch.set(root().collection('counters').doc('sale'),{next:maxNext(localData.sales,'V'),updatedAt:Date.now()},{merge:true});
    batch.set(root().collection('counters').doc('refund'),{next:maxNext(localData.refunds,'D'),updatedAt:Date.now()},{merge:true});
    batch.set(root().collection('counters').doc('expense'),{next:maxNext(localData.expenses,'S'),updatedAt:Date.now()},{merge:true});
    batch.set(marker,{completedAt:Date.now(),clientId});
    await batch.commit();
  }

  function maxNext(rows,prefix){
    return (rows||[]).reduce((max,r)=>{
      const n=Number(String(r.folio||'').replace(`${prefix}-`,''));
      return Number.isFinite(n)&&n>=max?n+1:max;
    },1);
  }

  async function saveRecord(kind,record){
    const col=collections[kind];
    if(!col)throw new Error('Tipo de registro no valido');
    if(!db){
      const local=loadLocal()||{professionals:[],sales:[],refunds:[],expenses:[]};
      const key=col;
      const next=(local[key]||[]).length+1;
      const saved={...record,folio:`${prefixes[kind]}-${String(next).padStart(5,'0')}`,updatedAt:Date.now(),clientId};
      local[key]=(local[key]||[]).filter(x=>x.folio!==saved.folio).concat(saved);
      saveLocal(local);
      return saved;
    }
    return db.runTransaction(async tx=>{
      const counter=root().collection('counters').doc(kind);
      const snap=await tx.get(counter);
      const current=snap.exists?(snap.data().next||1):1;
      const folio=`${prefixes[kind]}-${String(current).padStart(5,'0')}`;
      const saved={...record,folio,updatedAt:Date.now(),createdAt:Date.now(),clientId};
      tx.set(counter,{next:current+1,updatedAt:Date.now()},{merge:true});
      tx.set(root().collection(col).doc(folio),saved);
      return saved;
    });
  }

  async function saveProfessional(professional,oldId=''){
    if(!db){
      const local=loadLocal()||{professionals:[],sales:[],refunds:[],expenses:[]};
      const removeId=oldId||profId(professional);
      local.professionals=(local.professionals||[]).filter(p=>profId(p)!==removeId).concat(professional);
      saveLocal(local);
      return professional;
    }
    const id=profId(professional);
    const batch=db.batch();
    if(oldId&&oldId!==id)batch.delete(root().collection('professionals').doc(oldId));
    batch.set(root().collection('professionals').doc(id),{...professional,updatedAt:Date.now(),clientId},{merge:true});
    await batch.commit();
    return professional;
  }

  async function deleteProfessional(professional){
    if(!db){
      const local=loadLocal()||{professionals:[],sales:[],refunds:[],expenses:[]};
      const id=profId(professional);
      local.professionals=(local.professionals||[]).filter(p=>profId(p)!==id);
      saveLocal(local);
      return;
    }
    await root().collection('professionals').doc(profId(professional)).delete();
  }

  function profId(p){
    return encodeURIComponent((p.rutProfesional||p.profesional||crypto.randomUUID()).trim());
  }

  return {init,loadLocal,saveLocal,status,hasConfig,saveRecord,saveProfessional,deleteProfessional,profId};
})();
