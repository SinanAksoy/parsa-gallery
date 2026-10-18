/* Parsa's Gallery — Supabase adapter. Nothing activates until config.js has
   the project's PUBLIC URL and PUBLISHABLE key. Never use a secret/service key. */
(() => {
  'use strict';
  const config = window.PARSA_SUPABASE || {};
  const active = /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(config.url || '')
    && /^(sb_publishable_|eyJ)/.test(config.publishableKey || '');
  const BUCKET = 'parsa-images';
  let client = null;
  let user = null;
  let profile = null;
  const categories = ['friends','interactions','everything'];
  const limits = {friends:10,interactions:5,everything:5};
  const fail = (value) => { if(value.error) throw value.error; return value.data; };
  function assert() {if (!active) throw new Error('Supabase has not been configured'); if(!client) throw new Error('Supabase client could not load');}
  function photoUrl(path) {return client.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;}
  function filePath(prefix,file) {
    if(!file || !['image/jpeg','image/png','image/webp','image/avif'].includes(file.type))
      throw new Error('Choose a JPEG, PNG, WebP or AVIF photograph');
    if(file.size > 18*1024*1024) throw new Error('Photograph must be below 18 MB');
    const ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/avif':'avif'}[file.type];
    return `${prefix}/${crypto.randomUUID()}.${ext}`;
  }
  async function put(file,prefix) {
    const path=filePath(prefix,file);
    fail(await client.storage.from(BUCKET).upload(path,file,{cacheControl:'3600',upsert:false,contentType:file.type}));
    return path;
  }
  async function initialize() {
    if(!active) return;
    if(!window.supabase?.createClient) throw new Error('Supabase library did not load');
    client=window.supabase.createClient(config.url,config.publishableKey,{auth:{persistSession:true,autoRefreshToken:true}});
    const result=await client.auth.getUser();
    if(result.error && result.error.name!=='AuthSessionMissingError') throw result.error;
    user=result.data?.user||null;
    if(user) {
      const row=fail(await client.from('profiles').select('id,email,display_name,role').eq('id',user.id).maybeSingle());
      if(!row) { await client.auth.signOut(); user=null; profile=null; }
      else profile=row;
    }
  }
  function currentSession(){return profile?{role:profile.role,email:profile.email,name:profile.display_name}:null;}
  async function signIn(role,email,password) {
    assert();
    const result=await client.auth.signInWithPassword({email,password});
    if(result.error)throw result.error;
    user=result.data.user;
    profile=fail(await client.from('profiles').select('id,email,display_name,role').eq('id',user.id).maybeSingle());
    if(!profile || profile.role!==role) {await signOut();throw new Error('This account is not authorized for the selected role');}
    return currentSession();
  }
  async function signOut(){if(client)await client.auth.signOut();user=null;profile=null;}
  async function load(){
    assert();
    const [labels,copy,eds,pics,comments,uploads,names,tags]=await Promise.all([
      client.from('categories').select('key,title,slots'),
      client.from('site_content').select('value').eq('id',1).single(),
      client.from('editions').select('id,edition_date,status').order('edition_date',{ascending:false}),
      client.from('photos').select('id,edition_id,category_key,slot,storage_path,comments_enabled'),
      client.from('comments').select('id,photo_id,display_name,message,created_at').order('created_at',{ascending:true}),
      client.from('friend_uploads').select('id,photo_id,friend_id,display_name,storage_path'),
      client.from('public_photo_tags').select('photo_id,display_name'),
      profile ? client.from('photo_tags').select('photo_id,friend_email,display_name') : Promise.resolve({data:[],error:null})
    ]);
    const labelRows=fail(labels), copyValue=fail(copy).value, editionRows=fail(eds),photoRows=fail(pics),commentRows=fail(comments),uploadRows=fail(uploads),nameRows=fail(names),privateTags=fail(tags);
    const content={title:"Parsa's Gallery",footer:'Parsa’s Gallery',entryOwner:'Gallery owner',entryFriend:'Friends',entryVisitor:'Visitor',...copyValue,categories:Object.fromEntries(labelRows.map(x=>[x.key,x.title]))};
    const byPhoto=new Map();
    const all=editionRows.map(e=>{
      const result={id:e.id,date:e.edition_date,status:e.status,photos:Object.fromEntries(categories.map(k=>[k,Array(limits[k]).fill(null)]))};
      for(const p of photoRows.filter(p=>p.edition_id===e.id)) {
        const record={id:p.id,src:photoUrl(p.storage_path),storagePath:p.storage_path,tags:[],comments:[],friendUploads:[],commentsEnabled:p.comments_enabled};
        result.photos[p.category_key][p.slot-1]=record;
        byPhoto.set(p.id,record);
      }
      return result;
    });
    for(const c of commentRows) {
      const p=byPhoto.get(c.photo_id);if(p)p.comments.push({id:c.id,name:c.display_name,text:c.message,at:c.created_at});
    }
    for(const f of uploadRows) {
      const p=byPhoto.get(f.photo_id);if(p)p.friendUploads.push({id:f.id,src:photoUrl(f.storage_path),name:f.display_name,email:profile?.id===f.friend_id?profile.email:''});
    }
    for(const t of nameRows) {
      const p=byPhoto.get(t.photo_id);if(p)p.tags.push({name:t.display_name,email:''});
    }
    for(const t of privateTags) {
      const p=byPhoto.get(t.photo_id);if(!p)continue;
      let existing=p.tags.find(x=>x.name===t.display_name&&!x.email);
      if(profile?.role==='owner') {
        // Multiple people can share a display name; add distinct email-bearing tags.
        const exact=p.tags.find(x=>x.name===t.display_name&&x.email===t.friend_email);
        if(!exact) p.tags.push({name:t.display_name,email:t.friend_email});
      } else if(existing) existing.email=t.friend_email;
    }
    if(profile?.role==='owner'){
      // When owner has private tags, suppress duplicate public display-name tags.
      for(const p of byPhoto.values()) {
        const complete=p.tags.filter(t=>t.email);
        if(complete.length)p.tags=complete;
      }
    }
    // Find tagged friend uploads by authenticated user ID, not by publicly visible emails.
    for(const p of byPhoto.values())p._myUpload=!!(profile&&p.friendUploads.some(x=>x.email===profile.email));
    const draft=all.find(x=>x.status==='draft')||null;
    return {content,editions:all.filter(x=>x.status==='published'),draft};
  }
  async function createDraft(date){assert();if(profile?.role!=='owner')throw new Error('Owner account required');
    return fail(await client.from('editions').insert({edition_date:date,status:'draft'}).select('id').single());}
  async function changeDraftDate(id,date){fail(await client.from('editions').update({edition_date:date}).eq('id',id));}
  async function uploadDraftSlot(draft,cat,index,file){
    if(!categories.includes(cat)||index<0||index>=limits[cat])throw new Error('Invalid gallery slot');
    const path=await put(file,'owner');
    const existing=draft.photos[cat][index];
    if(existing){ fail(await client.from('photos').update({storage_path:path}).eq('id',existing.id)); }
    else {fail(await client.from('photos').insert({edition_id:draft.id,category_key:cat,slot:index+1,storage_path:path}));}
  }
  async function publishDraft(id){fail(await client.rpc('publish_edition',{p_edition_id:id}));}
  async function deleteEdition(id){fail(await client.from('editions').delete().eq('id',id));}
  async function replacePhoto(photoId,file){const path=await put(file,'owner');fail(await client.from('photos').update({storage_path:path}).eq('id',photoId));}
  async function addTag(photoId,name,email){fail(await client.from('photo_tags').insert({photo_id:photoId,display_name:name,friend_email:email.toLowerCase()}));}
  async function removeTag(photoId,email){fail(await client.from('photo_tags').delete().eq('photo_id',photoId).eq('friend_email',email));}
  async function comment(photoId,text,visitorName){
    fail(await client.from('comments').insert({photo_id:photoId,message:text,display_name:profile?.display_name||visitorName,author_id:user?.id||null}));
  }
  async function toggleComments(photoId,enabled){fail(await client.from('photos').update({comments_enabled:enabled}).eq('id',photoId));}
  async function uploadFriend(photoId,file){
    if(!user||profile?.role!=='friend')throw new Error('Friend account required');
    const path=await put(file,`friends/${photoId}/${user.id}`);
    fail(await client.from('friend_uploads').insert({photo_id:photoId,friend_id:user.id,display_name:profile.display_name,storage_path:path}));
  }
  async function saveContent(content){
    if(profile?.role!=='owner')throw new Error('Owner account required');
    const {categories:titles,...value}=content;
    fail(await client.from('site_content').update({value}).eq('id',1));
    for(const [key,title] of Object.entries(titles))fail(await client.from('categories').update({title}).eq('key',key));
  }
  window.ParsaCloud={active,initialize,currentSession,signIn,signOut,load,createDraft,changeDraftDate,uploadDraftSlot,publishDraft,deleteEdition,replacePhoto,addTag,removeTag,comment,toggleComments,uploadFriend,saveContent};
})();