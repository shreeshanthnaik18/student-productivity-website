const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];
async function api(path, options={}) {
  const response = await fetch(`/api${path}`, { credentials:'same-origin', headers:{'Content-Type':'application/json', ...(options.headers||{})}, ...options });
  const data = response.status === 204 ? {} : await response.json().catch(()=>({}));
  if (!response.ok) { if (response.status===401 && !location.pathname.endsWith('login.html') && !location.pathname.endsWith('signup.html')) location.href='/login.html'; throw new Error(data.error||'Something went wrong.'); }
  return data;
}
async function session() {
  try { const {user}=await api('/auth/me'); $$('.user-name').forEach(x=>x.textContent=user.name); $$('.avatar').forEach(x=>x.textContent=user.name[0].toUpperCase()); return user; }
  catch { if (!location.pathname.endsWith('login.html') && !location.pathname.endsWith('signup.html')) location.href='/login.html'; return null; }
}
function showError(el, message=''){ if(el) el.textContent=message; }
async function logout(){ await api('/auth/logout',{method:'POST'}); location.href='/login.html'; }
async function loadEntries(kind){ return (await api(`/entries?kind=${kind}`)).entries; }
function escapeHtml(s=''){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
document.addEventListener('click',e=>{if(e.target.closest('[data-logout]')) logout().catch(()=>location.href='/login.html');});
