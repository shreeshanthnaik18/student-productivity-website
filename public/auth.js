const form=$('#auth-form');
if(form){
  const isSignup=location.pathname.endsWith('signup.html');
  form.addEventListener('submit',async e=>{
    e.preventDefault();showError($('#error'));
    const payload={email:$('#email').value,password:$('#password').value};if(isSignup)payload.name=$('#name').value;
    try{await api(isSignup?'/auth/register':'/auth/login',{method:'POST',body:JSON.stringify(payload)});location.href='/';}
    catch(error){showError($('#error'),error.message);}
  });
  api('/auth/me').then(()=>location.href='/').catch(()=>{});
}
