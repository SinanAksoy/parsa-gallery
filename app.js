
/* Parsa's Gallery — standalone, browser-local interaction review.
   There is intentionally NO security/auth backend in this file.
   Connect Supabase Auth + database/RLS before making a public writable deployment. */
'use strict';
const STORAGE_KEY='parsas.gallery.review.v1';
const ROLE_KEY='parsas.gallery.session.v1';
const LIMITS={friends:10,interactions:5,everything:5};
const LABELS={friends:'Friends',interactions:'Interactions',everything:'Everything else'};
const DEFAULT_CONTENT={title:"Parsa's Gallery",categories:{...LABELS},footer:'Parsa’s Gallery',entryOwner:'Gallery owner',entryFriend:'Friends',entryVisitor:'Visitor'};
const art=['photo-1529156069898-49953e39b3ac','photo-1524504388940-b1c1722653e1','photo-1506794778202-cad84cf45f1d','photo-1534528741775-53994a69daeb','photo-1531123897727-8f129e1688ce','photo-1500648767791-00dcc994a43e','photo-1544005313-94ddf0286df2','photo-1552058544-f2b08422138a','photo-1547425260-76bcadfb4f2c','photo-1551836022-d5d88e9218df','photo-1511795409834-ef04bbd61622','photo-1492684223066-81342ee5ff30','photo-1528605248644-14dd04022da1','photo-1529333166437-7750a6dd5a70','photo-1527525443983-6e60c75fff46','photo-1470770841072-f978cf4d019e','photo-1500534623283-312aade485b7','photo-1500530855697-b586d89ba3ee','photo-1441974231531-c6227db76b6e','photo-1519681393784-d120267933ba','photo-1500534314209-a25ddb2bd429','photo-1490750967868-88aa4486c946','photo-1490730141103-6cac27aaab94','photo-1517841905240-472988babdf9','photo-1517841905240-472988babdf9','photo-1521737711867-e3b97375f902','photo-1530099486328-e021101a494a','photo-1543857778-c4a1a3e0b2eb','photo-1521305916504-4a1121188589','photo-1464822759023-fed622ff2c3b','photo-1481627834876-b7833e8f5570','photo-1439853949212-09789ba4541e','photo-1500534314209-a25ddb2bd429','photo-1447752875215-b2761acb3c5d','photo-1500534314209-a25ddb2bd429','photo-1469474968028-56623f02e42e','photo-1441974231531-c6227db76b6e','photo-1518837695005-2083093ee35b','photo-1470252649378-9c29740c9fa8','photo-1470071459604-3b5ec3a7fe05'];
const mkId=()=>globalThis.crypto?.randomUUID?.()||('id_'+Date.now()+'_'+Math.random().toString(16).slice(2));
const srcFor=id=>`https://images.unsplash.com/${id}?auto=format&fit=crop&w=700&q=82`;
const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const initialEdition=(date,start=0)=>{let pos=start;return {id:mkId(),date,photos:Object.fromEntries(Object.keys(LIMITS).map(cat=>[cat,Array.from({length:LIMITS[cat]},()=>({id:mkId(),src:srcFor(art[pos++%art.length]),tags:[],comments:[],friendUploads:[],commentsEnabled:true}))]))}};
function initialStore(){let e=initialEdition('2026-10-01',0);e.photos.friends[0].tags=[{name:'Mina',email:'mina@example.test'}];e.photos.friends[1].tags=[{name:'Arman',email:'arman@example.test'}];return {content:{...DEFAULT_CONTENT,categories:{...LABELS}},editions:[e,initialEdition('2026-07-14',20)],draft:null}};
function readStore(){try{let v=JSON.parse(localStorage.getItem(STORAGE_KEY));if(v&&Array.isArray(v.editions)&&v.content&&v.content.categories)return v}catch{}return initialStore()}
let store=readStore();let session;try{session=JSON.parse(sessionStorage.getItem(ROLE_KEY))}catch{session=null}
let selected=store.editions[0]?.id||null;let category='friends';let modal=null;let uploadedUrlMap={};let toastTimer=null;
function persist(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(store))}catch(e){notice('Browser storage is full; your latest change may not persist.')}}
function setSession(s){session=s;try{sessionStorage.setItem(ROLE_KEY,JSON.stringify(s))}catch{}render()}
function notice(msg){let t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),3500)}
function label(cat){return store.content.categories[cat]||LABELS[cat]}
function edition(){return store.editions.find(x=>x.id===selected)||store.editions[0]}
function getPhoto(editionId,cat,idx){return store.editions.find(x=>x.id===editionId)?.photos?.[cat]?.[idx]}
function img(src){return src?.startsWith('idb:')?(uploadedUrlMap[src]||''):src||''}
function formatDate(d){let value=new Date(d+'T12:00:00');return Number.isFinite(value.getTime())?value.toLocaleDateString('en-GB',{month:'long',year:'numeric'}):d}
function entry(){let words=store.content.title.split(/\s+/),last=words.pop()||'',first=words.join(' ');return `<main class="entry">
  <section class="entry-left"><div class="entry-brand">${safe(store.content.title)}</div>
    <div class="entry-intro animate-in"><div class="eyebrow"><span class="motif"></span></div>
    <h1>${safe(first)} <em>${safe(last)}</em></h1>
    <div class="entry-roles">
     <button class="role-card" data-action="auth" data-role="owner"><span class="role-name">${safe(store.content.entryOwner)}</span><span class="arrow">↗</span></button>
     <button class="role-card" data-action="auth" data-role="friend"><span class="role-name">${safe(store.content.entryFriend)}</span><span class="arrow">↗</span></button>
     <button class="role-card" data-action="auth" data-role="visitor"><span class="role-name">${safe(store.content.entryVisitor)}</span><span class="arrow">↗</span></button>
    </div></div><div class="entry-foot">✦ &nbsp; ${safe(store.content.title)}</div></section>
  <section class="entry-visual" aria-hidden="true"><div class="ornament"></div><div class="arch"></div><div class="visual-corner"><span class="motif"></span></div></section>
</main>`}
function gallery(){let e=edition();return `<div class="shell"><header class="nav"><div class="wordmark">${safe(store.content.title)}</div><div class="nav-right">
  <span class="role-pill">${session.role==='owner'?'Owner':session.role==='friend'?safe(session.name||'Friend'):safe(session.name)}</span>
  ${session.role==='owner'?`<button class="btn ghost small" data-action="settings">Content</button>`:''}
  <button class="icon-button" data-action="logout" aria-label="Sign out" title="Sign out">↗</button>
 </div></header>
 <section class="masthead animate-in"><div><span class="eyebrow">✦ &nbsp; ${String(store.editions.length).padStart(2,'0')} editions</span><h1>${safe(store.content.title)}</h1></div><div class="description">${e?formatDate(e.date):''}</div></section>
 <div class="flourish" aria-hidden="true">✦ ⟡ ✦</div>
 <div class="timeline" role="tablist" aria-label="Gallery timeline">
  ${store.editions.map((ed,i)=>`<button class="date-tab ${e?.id===ed.id?'active':''}" role="tab" aria-selected="${e?.id===ed.id}" data-action="edition" data-id="${ed.id}">${formatDate(ed.date)}</button>`).join('')}
  ${session.role==='owner'?`<button class="btn small ghost" data-action="create">+ New edition</button>`:''}
 </div>
 ${session.role==='owner'?`<div class="owner-toolbar">${e?`<button class="btn ghost small" data-action="delete-edition">Delete edition</button>`:''}${store.draft?`<button class="btn small" data-action="create">Continue edition · ${draftCount()}/20</button>`:''}</div>`:''}
 ${e?`<section class="section-top"><div><div class="eyebrow">${formatDate(e.date)}</div><h2>${safe(label(category))}</h2><span class="section-meta">${String(LIMITS[category]).padStart(2,'0')} photographs</span></div>
 <div class="category-menu" role="tablist" aria-label="Categories">${Object.keys(LIMITS).map(c=>`<button role="tab" aria-selected="${c===category}" class="${c===category?'active':''}" data-action="category" data-cat="${c}">${safe(label(c))} <span class="tiny">${LIMITS[c]}</span></button>`).join('')}</div></section>
 <section class="gallery-grid" aria-label="${safe(label(category))}">${e.photos[category].map((p,i)=>`<button class="photo-card" data-action="photo" data-cat="${category}" data-index="${i}" aria-label="Open ${safe(label(category))} photograph ${i+1}">
  <img class="photo-img" src="${safe(img(p.src))}" alt="${safe(label(category))} photograph ${i+1}" loading="lazy"/>
  <span class="photo-index">${String(i+1).padStart(2,'0')}</span><span class="photo-bottom"><span class="photo-names">${category==='friends'?safe(p.tags.map(t=>t.name).join(' · ')):''}</span><span class="photo-stats">${p.comments.length?'◌ '+p.comments.length:''}</span></span></button>`).join('')}</section>`:`<section class="section-top"><h2>New edition</h2></section>`}
 <footer class="footer"><span>${safe(store.content.footer)}</span><span class="diamond">✦</span><span>${new Date().getFullYear()}</span></footer></div>`}
function authModal(){let owner=modal.role==='owner',friend=modal.role==='friend';return `<div class="eyebrow">${owner?safe(store.content.entryOwner):friend?safe(store.content.entryFriend):safe(store.content.entryVisitor)}</div>
  <h2>${owner||friend?'Sign in':'Your name'}</h2><form id="auth-form" data-role="${modal.role}">
  ${owner||friend?`<div class="field"><label for="auth-email">Email</label><input id="auth-email" name="email" type="email" placeholder="name@example.com" autocomplete="username" required /></div><div class="field"><label for="auth-password">Password</label><input id="auth-password" name="password" type="password" autocomplete="current-password" required /></div>`:`<div class="field"><label for="visitor-name">Name</label><input id="visitor-name" name="name" placeholder="Your name" maxlength="70" required autofocus /></div>`}
  <div class="modal-actions"><button type="button" class="btn ghost" data-action="close">Back</button><button class="btn" type="submit">Enter gallery ↗</button></div></form>`}
function photoModal(){let {edId,cat,index}=modal,p=getPhoto(edId,cat,index);if(!p)return '';let tagged=session.role==='friend'&&p.tags.some(t=>t.email.toLowerCase()===session.email?.toLowerCase());let allowComment=cat==='interactions'||cat==='everything'&&p.commentsEnabled||cat==='friends'&&(tagged||session.role==='owner');let canPost=allowComment&&session.role!=='owner'||allowComment&&session.role==='owner';let canFriendUpload=cat==='friends'&&tagged&&!p.friendUploads.some(x=>x.email===session.email);return `<div class="editor-head"><div><div class="eyebrow">${safe(label(cat))} · ${formatDate(store.editions.find(e=>e.id===edId).date)}</div><h2>Photograph ${String(index+1).padStart(2,'0')}</h2></div></div>
 <div class="editor-layout"><div><img class="editor-preview" src="${safe(img(p.src))}" alt="Selected gallery photograph" />
 ${p.tags.length?`<div class="section-label">In this frame</div><div class="tags">${p.tags.map(t=>`<span class="tag">${safe(t.name)}</span>`).join('')}</div>`:''}
 ${p.friendUploads.length?`<div class="section-label">Shared photographs</div><div class="tags">${p.friendUploads.map(x=>`<a href="${safe(img(x.src))}" target="_blank" rel="noopener"><img src="${safe(img(x.src))}" alt="Shared by ${safe(x.name)}" style="width:92px;height:92px;object-fit:cover" /></a>`).join('')}</div>`:''}
 </div><div class="editor-side">
  ${session.role==='owner'?`<div class="photo-actions"><button class="btn ghost small" data-action="edit-photo">Edit photograph</button>${cat==='everything'?`<label class="toggle"><input id="comments-toggle" type="checkbox" ${p.commentsEnabled?'checked':''}/> Comments</label>`:''}</div><div class="soft-rule"></div>`:''}
  <div class="section-label">Comments · ${p.comments.length}</div>
  <div class="comments-panel">${p.comments.map(c=>`<div class="comment"><strong>${safe(c.name)}</strong><p>${safe(c.text)}</p></div>`).join('')||`<div class="inline-note">No comments yet.</div>`}</div>
  ${canPost?`<form id="comment-form"><div class="field"><label for="comment-text">Add a comment</label><textarea id="comment-text" name="text" maxlength="1000" placeholder="Your words" required></textarea></div><button class="btn small" type="submit">Post comment ↗</button></form>`:`<div class="locked">Comments are unavailable</div>`}
  ${canFriendUpload?`<div class="soft-rule"></div><div class="section-label">Share one photograph</div><label class="image-uploader">+ Choose photograph<input id="friend-image" type="file" accept="image/*"/></label>`:''}
 </div></div>`}
function editModal(){let isDraft=modal.draft,p=isDraft?store.draft.photos[modal.cat][modal.index]:getPhoto(modal.edId,modal.cat,modal.index);if(!p)return '';return `<div class="eyebrow">${safe(label(modal.cat))}</div><h2>Edit photograph ${String(modal.index+1).padStart(2,'0')}</h2><div class="editor-layout">
 <div><img src="${safe(img(p.src))}" class="editor-preview" alt="Photograph to edit" />
  <label class="image-uploader" style="display:block;margin-top:12px">Replace photograph<input type="file" id="replace-image" accept="image/*" /></label>
  ${!isDraft?`<p class="inline-note">Replacing this photograph clears its comments, friend photographs and associated tags.</p>`:''}
 </div><div><div class="section-label">Tagged friends</div>
 ${modal.cat==='friends'?`<div class="tags">${p.tags.map((t,i)=>`<span class="tag">${safe(t.name)} <span class="muted tiny">${safe(t.email)}</span> <button title="Remove tag" data-action="remove-tag" data-tag-index="${i}">×</button></span>`).join('')||'<span class="muted tiny">No friends tagged</span>'}</div>
 <form id="tag-form"><div class="field"><label>Name</label><input name="name" maxlength="75" required /></div><div class="field"><label>Email · private</label><input type="email" name="email" required /></div><button class="btn small ghost" type="submit">+ Add friend</button></form>`:`<p class="inline-note">Friend tags are available in the Friends category.</p>`}
 ${modal.cat==='everything'?`<div class="soft-rule"></div><label class="toggle"><input id="edit-comments-toggle" type="checkbox" ${p.commentsEnabled?'checked':''}/> Enable comments</label>`:''}
 </div></div><div class="modal-actions"><button class="btn" data-action="back-photo">Done ↗</button></div>`}
function draftCount(){return store.draft?Object.keys(LIMITS).reduce((n,cat)=>n+store.draft.photos[cat].filter(Boolean).length,0):0}
function newEditionModal(){let d=store.draft,done=draftCount(),dt=d.date;return `<div class="editor-head"><div><div class="eyebrow">Gallery owner</div><h2>New edition</h2></div><button class="btn ghost small" data-action="close">Return to gallery</button></div>
 <div class="field" style="max-width:240px"><label>Edition date</label><input id="edition-date" type="date" value="${safe(dt)}" /></div>
 <div class="queue-head"><div class="eyebrow">${String(done).padStart(2,'0')} / 20 photographs</div><span class="muted tiny">${20-done} remaining</span></div><div class="progress"><div style="width:${done*5}%"></div></div>
 ${Object.keys(LIMITS).map(cat=>`<section><div class="queue-categories"><h3>${safe(label(cat))}</h3><span class="section-meta">${d.photos[cat].filter(Boolean).length} / ${LIMITS[cat]}</span></div>
 <div class="queue-grid">${d.photos[cat].map((p,i)=>`<div class="queue-slot">
  <label title="Upload photograph"><input type="file" accept="image/*" data-draft-cat="${cat}" data-draft-index="${i}" />${p?`<img src="${safe(img(p.src))}" alt="Uploaded photograph ${i+1}"/>`:`<div class="blank-slot"><span class="plus">+</span><small>${String(i+1).padStart(2,'0')}</small></div>`}</label>
  ${p?`<button style="position:absolute;bottom:6px;right:6px;padding:6px 7px;font-size:10px" class="btn small" data-action="draft-edit" data-cat="${cat}" data-index="${i}">Edit</button>`:''}
 </div>`).join('')}</div></section>`).join('')}
 <div class="queue-footer"><span class="inline-note">Every slot must contain one photograph before the edition can be published.</span><button class="btn" ${done!==20?'disabled':''} data-action="publish">Publish edition ↗</button></div>`}
function settingsModal(){return `<div class="eyebrow">Gallery owner</div><h2>Content</h2><form id="settings-form">
 <div class="field"><label>Site title</label><input name="title" required maxlength="80" value="${safe(store.content.title)}" /></div>
 ${Object.keys(LIMITS).map(c=>`<div class="field"><label>Category · ${safe(LABELS[c])}</label><input name="category_${c}" required maxlength="50" value="${safe(label(c))}" /></div>`).join('')}
 <div class="field"><label>Footer</label><input name="footer" maxlength="90" value="${safe(store.content.footer)}" /></div>
 <div class="soft-rule"></div><div class="eyebrow">Entrance labels</div>
 ${['entryOwner','entryFriend','entryVisitor'].map(c=>`<div class="field"><label>${safe(c.replace('entry',''))}</label><input name="${c}" maxlength="50" required value="${safe(store.content[c])}" /></div>`).join('')}
 <div class="modal-actions"><button type="button" class="btn ghost" data-action="close">Cancel</button><button class="btn" type="submit">Save changes ↗</button></div></form>`}
function renderModal(){if(!modal)return '';let wide=['photo','edit','create'].includes(modal.type),markup=modal.type==='auth'?authModal():modal.type==='photo'?photoModal():modal.type==='edit'?editModal():modal.type==='create'?newEditionModal():settingsModal();return `<div class="modal-backdrop" data-action="backdrop"><div class="modal ${wide?'wide':''}" role="dialog" aria-modal="true" aria-label="${safe(modal.type)}"><button class="icon-button modal-close" data-action="close" aria-label="Close">×</button>${markup}</div></div>`}
function render(){document.getElementById('app').innerHTML=(session?gallery():entry())+renderModal();document.body.style.overflow=modal?'hidden':''}
function returnToPhoto(){modal={type:'photo',edId:modal.edId,cat:modal.cat,index:modal.index};render()}
function updatedPhoto(){return modal.draft?store.draft.photos[modal.cat][modal.index]:getPhoto(modal.edId,modal.cat,modal.index)}
function openCreate(){if(!store.draft)store.draft={date:new Date().toISOString().slice(0,10),photos:Object.fromEntries(Object.entries(LIMITS).map(([c,n])=>[c,Array(n).fill(null)]))};persist();modal={type:'create'};render()}
function saveTag(name,email){let p=updatedPhoto();if(p.tags.some(t=>t.email.toLowerCase()===email.toLowerCase())){notice('This friend is already tagged');return}p.tags.push({name,email});persist();render();notice('Friend tagged')}
function blobDb(){return new Promise((resolve,reject)=>{const req=indexedDB.open('parsas-gallery-images',1);req.onupgradeneeded=()=>req.result.createObjectStore('files');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})}
async function writeBlob(file){if(!file?.type?.startsWith('image/'))throw new Error('Select an image');if(file.size>18*1024*1024)throw new Error('Image must be smaller than 18 MB');let db=await blobDb(),key='idb:'+mkId();await new Promise((res,rej)=>{const tx=db.transaction('files','readwrite');tx.objectStore('files').put(file,key);tx.oncomplete=res;tx.onerror=()=>rej(tx.error)});db.close();return key}
async function hydrate(){let keys=new Set();for(let ed of store.editions)for(let c of Object.keys(LIMITS))for(let p of ed.photos[c]){if(p.src?.startsWith('idb:'))keys.add(p.src);for(let f of p.friendUploads||[])if(f.src?.startsWith('idb:'))keys.add(f.src)}if(store.draft)for(let c of Object.keys(LIMITS))for(let p of store.draft.photos[c])if(p?.src?.startsWith('idb:'))keys.add(p.src);if(!keys.size)return;let db=await blobDb();await Promise.all([...keys].filter(k=>!uploadedUrlMap[k]).map(key=>new Promise(res=>{const r=db.transaction('files').objectStore('files').get(key);r.onsuccess=()=>{if(r.result)uploadedUrlMap[key]=URL.createObjectURL(r.result);res()};r.onerror=res})));db.close()}
async function onImage(file,cb){try{let src=await writeBlob(file);await cb(src);await hydrate();render();notice('Photograph saved')}catch(err){notice(err.message||'Unable to save photograph')}}
function goNextEdition(){selected=store.editions[0]?.id||null;category='friends'}
async function onAction(el){let action=el.dataset.action;
 if(action==='backdrop'){if(el.classList.contains('modal-backdrop')){modal=null;render()}return}
 if(action==='close'){modal=null;render();return}
 if(action==='auth'){modal={type:'auth',role:el.dataset.role};render();return}
 if(action==='logout'){session=null;try{sessionStorage.removeItem(ROLE_KEY)}catch{}modal=null;render();return}
 if(action==='edition'){selected=el.dataset.id;category='friends';render();return}
 if(action==='category'){category=el.dataset.cat;render();return}
 if(action==='photo'){modal={type:'photo',edId:edition().id,cat:el.dataset.cat,index:Number(el.dataset.index)};render();return}
 if(action==='settings'&&session.role==='owner'){modal={type:'settings'};render();return}
 if(action==='create'&&session.role==='owner'){openCreate();return}
 if(action==='delete-edition'&&session.role==='owner'){let e=edition();if(e&&confirm('Delete the entire edition, including its comments and shared images?')){store.editions=store.editions.filter(x=>x.id!==e.id);goNextEdition();persist();render();notice('Edition deleted')}return}
 if(action==='edit-photo'&&session.role==='owner'){modal={type:'edit',edId:modal.edId,cat:modal.cat,index:modal.index,draft:false};render();return}
 if(action==='draft-edit'&&session.role==='owner'){modal={type:'edit',cat:el.dataset.cat,index:Number(el.dataset.index),draft:true};render();return}
 if(action==='back-photo'){if(modal.draft){modal={type:'create'};render()}else returnToPhoto();return}
 if(action==='remove-tag'&&session.role==='owner'){updatedPhoto().tags.splice(Number(el.dataset.tagIndex),1);persist();render();return}
 if(action==='publish'&&session.role==='owner'){if(draftCount()!==20)return;let d=store.draft;if(!d.date){notice('Choose an edition date');return}if(store.editions.some(e=>e.date===d.date)){notice('An edition already exists on this date');return}store.editions.unshift({id:mkId(),date:d.date,photos:d.photos});store.editions.sort((a,b)=>b.date.localeCompare(a.date));store.draft=null;selected=store.editions.find(e=>e.date===d.date).id;category='friends';modal=null;persist();render();notice('Edition published');return}
}
document.addEventListener('click',event=>{if(event.target.classList?.contains('modal-backdrop')){modal=null;render();return}let target=event.target.closest('[data-action]');if(target&&target.dataset.action!=='backdrop')onAction(target)});
document.addEventListener('submit',async event=>{let form=event.target;event.preventDefault();let data=new FormData(form);
 if(form.id==='auth-form'){let role=form.dataset.role;if(role==='visitor'){let name=String(data.get('name')||'').trim();if(!name)return;setSession({role,name})}else{let email=String(data.get('email')||'').trim().toLowerCase(),password=String(data.get('password')||'');if(!email||!password)return;setSession({role,name:email.split('@')[0],email})}modal=null;render();return}
 if(form.id==='settings-form'&&session.role==='owner'){store.content.title=String(data.get('title')).trim();for(let c of Object.keys(LIMITS))store.content.categories[c]=String(data.get('category_'+c)).trim();for(let c of ['footer','entryOwner','entryFriend','entryVisitor'])store.content[c]=String(data.get(c)||'').trim();persist();modal=null;render();notice('Content updated');return}
 if(form.id==='comment-form'){let p=getPhoto(modal.edId,modal.cat,modal.index),allowed=modal.cat==='interactions'||modal.cat==='everything'&&p.commentsEnabled||modal.cat==='friends'&&(session.role==='owner'||session.role==='friend'&&p.tags.some(t=>t.email.toLowerCase()===session.email));if(!allowed)return;let text=String(data.get('text')||'').trim();if(!text)return;p.comments.push({id:mkId(),name:session.name||session.email||'Guest',text:text.slice(0,1000),at:new Date().toISOString()});persist();render();notice('Comment added');return}
 if(form.id==='tag-form'&&session.role==='owner'&&modal.cat==='friends'){let name=String(data.get('name')||'').trim(),email=String(data.get('email')||'').trim().toLowerCase();if(name&&email)saveTag(name,email);return}
});
document.addEventListener('change',async event=>{let t=event.target;
 if(t.id==='comments-toggle'||t.id==='edit-comments-toggle'){if(session.role!=='owner')return;let p=t.id==='comments-toggle'?getPhoto(modal.edId,modal.cat,modal.index):updatedPhoto();p.commentsEnabled=t.checked;persist();render();notice(t.checked?'Comments enabled':'Comments disabled');return}
 if(t.id==='edition-date'){if(store.draft){store.draft.date=t.value;persist()}return}
 if(t.dataset.draftCat&&session.role==='owner'){let cat=t.dataset.draftCat,index=Number(t.dataset.draftIndex);await onImage(t.files?.[0],async src=>{let before=store.draft.photos[cat][index];store.draft.photos[cat][index]={id:mkId(),src,tags:before?.tags||[],comments:[],friendUploads:[],commentsEnabled:before?.commentsEnabled??true};persist()});return}
 if(t.id==='replace-image'&&session.role==='owner'){let m={...modal};await onImage(t.files?.[0],async src=>{let p=m.draft?store.draft.photos[m.cat][m.index]:getPhoto(m.edId,m.cat,m.index);p.src=src;if(!m.draft){p.tags=[];p.comments=[];p.friendUploads=[]}persist()});return}
 if(t.id==='friend-image'&&session.role==='friend'){let m={...modal},p=getPhoto(m.edId,m.cat,m.index);if(m.cat!=='friends'||!p?.tags.some(tag=>tag.email.toLowerCase()===session.email)||p.friendUploads.some(u=>u.email===session.email))return;await onImage(t.files?.[0],async src=>{p.friendUploads.push({id:mkId(),src,name:session.name,email:session.email});persist()});return}
});
async function loadThemeAndCopy(){
  // File URLs may disallow fetch; built-in defaults still allow the standalone HTML to open.
  try{let response=await fetch('./theme.json');if(response.ok){let theme=await response.json(),palette={background:'--bg',backgroundRaised:'--bg2',surface:'--panel',surfaceHover:'--panel2',text:'--ink',textSecondary:'--muted',gold:'--accent',terracotta:'--accent2',sage:'--teal'};for(let [key,value] of Object.entries(theme.colors||{})){if(palette[key]&&/^#[a-fA-F0-9]{6}$/.test(value))document.documentElement.style.setProperty(palette[key],value)}}}catch{}
  try{let response=await fetch('./content.json');if(response.ok){let defaults=await response.json();let hasLocal=false;try{hasLocal=!!localStorage.getItem(STORAGE_KEY)}catch{};if(!hasLocal){store.content={...store.content,...defaults,categories:{...store.content.categories,...defaults.categories}}}}}catch{}
}
(async()=>{try{await loadThemeAndCopy();await hydrate()}catch(e){console.warn('Local media initialization unavailable',e)}render()})();

