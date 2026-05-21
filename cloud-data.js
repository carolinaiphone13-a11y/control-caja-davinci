const DAVINCI_LOCAL_KEY='davinci-caja';

window.DavinciCloud=(()=>{
  const clientId=localStorage.getItem('davinci-client-id')||crypto.randomUUID();
  localStorage.setItem('davinci-client-id',clientId);
  let db=null;
  let unsub=null;
  let ready=false;
  let saving=false;
  let lastRemoteUpdatedAt=0;
  let onRemoteChange=null;
  let saveTimer=null;
  let lastError='';

  function hasConfig(){
    const c=window.DAVINCI_FIREBASE_CONFIG||{};
    return Boolean(c.apiKey&&c.authDomain&&c.projectId&&c.appId);
  }

  function loadLocal(){
    try{return JSON.parse(localStorage.getItem(DAVINCI_LOCAL_KEY)||'null')}
    catch(_){return null}
  }

  function saveLocal(state){
    localStorage.setItem(DAVINCI_LOCAL_KEY,JSON.stringify(state));
  }

  function status(){
    if(!hasConfig())return 'Modo local';
    if(ready)return 'Nube activa';
    if(lastError)return `Error nube: ${lastError}`;
    return 'Conectando nube';
  }

  async function init(callback,stateProvider){
    onRemoteChange=callback;
    if(!hasConfig()||!window.firebase)return false;
    try{
      if(!firebase.apps.length)firebase.initializeApp(window.DAVINCI_FIREBASE_CONFIG);
      await firebase.auth().signInAnonymously();
      db=firebase.firestore();
      await db.enablePersistence({synchronizeTabs:true}).catch(()=>{});
      const ref=db.collection('davinci').doc('control-caja');
      unsub=ref.onSnapshot(async snap=>{
        lastError='';
        if(!snap.exists){
          const initial=stateProvider?stateProvider():loadLocal();
          if(initial)await save(initial,true);
          ready=true;
          if(initial&&onRemoteChange)onRemoteChange(initial);
          return;
        }
        const data=snap.data()||{};
        if(data.clientId===clientId&&saving)return;
        if((data.updatedAt||0)<lastRemoteUpdatedAt)return;
        lastRemoteUpdatedAt=data.updatedAt||Date.now();
        if(data.state){
          saveLocal(data.state);
          ready=true;
          if(onRemoteChange)onRemoteChange(data.state);
        }
      },err=>{
        console.warn('Firestore no disponible',err);
        lastError=err.code||err.message||'Firestore';
        ready=false;
        if(onRemoteChange&&stateProvider)onRemoteChange(stateProvider());
      });
      return true;
    }catch(err){
      console.warn('Firebase no disponible',err);
      lastError=err.code||err.message||'Firebase';
      ready=false;
      if(onRemoteChange&&stateProvider)onRemoteChange(stateProvider());
      return false;
    }
  }

  async function save(state,immediate=false){
    saveLocal(state);
    if(!db)return;
    clearTimeout(saveTimer);
    const run=async()=>{
      saving=true;
      const updatedAt=Date.now();
      lastRemoteUpdatedAt=updatedAt;
      try{
        await db.collection('davinci').doc('control-caja').set({
          state,
          updatedAt,
          clientId,
          version:'2.0.0',
          updatedAtIso:new Date(updatedAt).toISOString()
        },{merge:true});
        ready=true;
      }catch(err){
        console.warn('No se pudo sincronizar con Firestore',err);
      }finally{
        setTimeout(()=>{saving=false},250);
      }
    };
    if(immediate)return run();
    saveTimer=setTimeout(run,450);
  }

  return {init,loadLocal,save,status,hasConfig};
})();

