const SUPABASE_URL = 'https://bdtktrbtawalniamalcs.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_QLnbv7xRodnpeCXWNZ1q0w_ySaZLElI';

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function json(statusCode, payload){
  return {statusCode, headers, body: JSON.stringify(payload)};
}

function cleanPseudo(value){
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, 32);
}

function normalizeAvatar(value, pseudo){
  const allowed = new Set(['orbiteur','robot','explorateur','renard','hibou','cosmonaute','masques','projectionniste','chat','kraken','cyberpunk','vip']);
  if(allowed.has(value)) return value;
  const seed = (pseudo || '').toLowerCase().charCodeAt(0) || 0;
  return ['orbiteur','robot','explorateur','renard','hibou','cosmonaute','masques','projectionniste'][seed % 8];
}

function authErrorMessage(data){
  const message = data?.msg || data?.message || data?.error_description || data?.error || '';
  if(/already registered|already been registered|user already/i.test(message)) return 'Cette adresse email possède déjà un compte.';
  if(/password/i.test(message)) return 'Mot de passe invalide ou trop faible.';
  if(/email/i.test(message)) return 'Adresse email invalide.';
  return message || 'Impossible de créer le compte.';
}

exports.handler = async function(event){
  if(event.httpMethod === 'OPTIONS') return {statusCode: 204, headers, body: ''};
  if(event.httpMethod !== 'POST') return json(405, {ok:false, message:'Méthode non autorisée.'});

  const secret = process.env.TURNSTILE_SECRET_KEY;
  if(!secret) return json(500, {ok:false, message:'Turnstile n’est pas configuré côté serveur.'});

  let body;
  try{
    body = JSON.parse(event.body || '{}');
  }catch(error){
    return json(400, {ok:false, message:'Requête invalide.'});
  }

  const email = String(body.email || '').trim();
  const password = String(body.password || '');
  const pseudo = cleanPseudo(body.pseudo);
  const avatar = normalizeAvatar(body.avatar, pseudo);
  const token = String(body.turnstileToken || '');

  if(!email || !password || !pseudo || !token){
    return json(400, {ok:false, message:'Informations d’inscription incomplètes.'});
  }

  const verifyParams = new URLSearchParams();
  verifyParams.append('secret', secret);
  verifyParams.append('response', token);
  const clientIp = event.headers['x-nf-client-connection-ip'] || event.headers['client-ip'] || event.headers['x-forwarded-for'];
  if(clientIp) verifyParams.append('remoteip', String(clientIp).split(',')[0].trim());

  const turnstileResponse = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method:'POST',
    headers:{'Content-Type':'application/x-www-form-urlencoded'},
    body: verifyParams.toString()
  });
  const turnstileData = await turnstileResponse.json().catch(() => null);

  if(!turnstileData?.success){
    return json(403, {ok:false, message:'Vérification humaine refusée. Recharge la page et réessaie.'});
  }

  const signupResponse = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method:'POST',
    headers:{
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type':'application/json'
    },
    body: JSON.stringify({
      email,
      password,
      data:{pseudo, avatar}
    })
  });
  const signupData = await signupResponse.json().catch(() => null);

  if(!signupResponse.ok){
    return json(signupResponse.status, {ok:false, message:authErrorMessage(signupData)});
  }

  return json(200, {
    ok:true,
    session: signupData?.access_token ? signupData : null,
    needsEmailConfirmation: !signupData?.access_token
  });
};
