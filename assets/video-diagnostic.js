(function(){
  "use strict";

  const $ = (id) => document.getElementById(id);

  function getBrowserInfo(){
    const ua = navigator.userAgent || "";
    const brands = navigator.userAgentData && Array.isArray(navigator.userAgentData.brands)
      ? navigator.userAgentData.brands.map(b => `${b.brand} ${b.version}`).join(", ")
      : "";

    let browser = "Navigateur inconnu";
    if(/Edg\//.test(ua)) browser = "Microsoft Edge";
    else if(/OPR\//.test(ua)) browser = "Opera";
    else if(/Brave\//.test(ua)) browser = "Brave";
    else if(/Firefox\//.test(ua)) browser = "Firefox";
    else if(/Chrome\//.test(ua) && /Mobile/.test(ua)) browser = "Chrome Mobile / Chromium";
    else if(/Chrome\//.test(ua)) browser = "Chrome / Chromium";
    else if(/Safari\//.test(ua) && /Mobile/.test(ua)) browser = "Safari Mobile";
    else if(/Safari\//.test(ua)) browser = "Safari";

    if(navigator.brave && typeof navigator.brave.isBrave === "function"){
      browser = "Brave";
    }

    return { browser, brands, ua };
  }

  function getOS(){
    const ua = navigator.userAgent || "";
    if(/Android\s([\d.]+)/i.test(ua)) return `Android ${RegExp.$1}`;
    if(/iPhone|iPad|iPod/i.test(ua)) return "iOS / iPadOS";
    if(/Windows NT/i.test(ua)) return "Windows";
    if(/Mac OS X/i.test(ua)) return "macOS";
    if(/Linux/i.test(ua)) return "Linux";
    return "Système inconnu";
  }

  function testCookies(){
    try{
      const key = "ps_video_diag_cookie";
      document.cookie = `${key}=1; SameSite=Lax; path=/`;
      const ok = document.cookie.indexOf(`${key}=1`) !== -1;
      document.cookie = `${key}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
      return ok;
    }catch(e){
      return false;
    }
  }

  function testStorage(){
    try{
      const key = "ps_video_diag_storage";
      localStorage.setItem(key,"1");
      const ok = localStorage.getItem(key) === "1";
      localStorage.removeItem(key);
      return ok;
    }catch(e){
      return false;
    }
  }

  function testAdBlocker(){
    return new Promise((resolve) => {
      const bait = document.createElement("div");
      bait.className = "adsbox ad-banner ad-unit pub_300x250 textads banner-ads";
      bait.style.cssText = "position:absolute;left:-9999px;top:-9999px;width:1px;height:1px;";
      document.body.appendChild(bait);
      window.setTimeout(() => {
        const styles = window.getComputedStyle(bait);
        const hidden = !bait.offsetParent || bait.offsetHeight === 0 || styles.display === "none" || styles.visibility === "hidden";
        bait.remove();
        resolve(hidden);
      }, 120);
    });
  }

  function canPlay(type){
    const video = document.createElement("video");
    if(!video.canPlayType) return "Non disponible";
    const result = video.canPlayType(type);
    if(result === "probably") return "OK";
    if(result === "maybe") return "Peut-être";
    return "Non";
  }

  function rowHTML(item){
    const stateClass = item.state || "info";
    return `<div class="diagnostic-row">
      <div>
        <span class="diagnostic-label">${item.label}</span>
        ${item.help ? `<span class="diagnostic-help">${item.help}</span>` : ""}
      </div>
      <span class="diagnostic-status ${stateClass}">${item.value}</span>
    </div>`;
  }

  function setRows(id, rows){
    const target = $(id);
    if(!target) return;
    target.innerHTML = rows.map(rowHTML).join("");
  }

  function stateFromBool(ok){ return ok ? "ok" : "bad"; }
  function valueFromBool(ok){ return ok ? "OK" : "Non"; }

  async function runDiagnostic(){
    const browserInfo = getBrowserInfo();
    const os = getOS();
    const cookieOk = testCookies();
    const storageOk = testStorage();
    const adBlock = await testAdBlocker();
    const secure = window.isSecureContext || location.protocol === "https:" || location.hostname === "localhost";
    const online = navigator.onLine !== false;
    const video = document.createElement("video");
    const html5 = !!video.canPlayType;
    const fullscreen = !!(document.fullscreenEnabled || document.webkitFullscreenEnabled || document.msFullscreenEnabled);
    const touch = ("ontouchstart" in window) || navigator.maxTouchPoints > 0;
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const networkLabel = connection ? [connection.effectiveType, connection.saveData ? "économie de données" : ""].filter(Boolean).join(" / ") : "Non disponible";
    const memory = navigator.deviceMemory ? `${navigator.deviceMemory} Go environ` : "Non disponible";
    const cores = navigator.hardwareConcurrency ? `${navigator.hardwareConcurrency}` : "Non disponible";
    const darkMode = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    const reducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const essential = [
      {label:"Connexion", value: online ? "OK" : "Hors ligne", state: stateFromBool(online), help:"Indique si le navigateur pense être connecté."},
      {label:"Connexion sécurisée", value: secure ? "HTTPS OK" : "Non sécurisé", state: stateFromBool(secure), help:"Les lecteurs modernes fonctionnent mieux en HTTPS."},
      {label:"JavaScript", value:"OK", state:"ok", help:"Si vous voyez cette ligne, JavaScript fonctionne."},
      {label:"Cookies", value: cookieOk ? "Activés" : "Bloqués", state: cookieOk ? "ok" : "warn", help:"Certains lecteurs et connexions peuvent en avoir besoin."},
      {label:"Stockage local", value: storageOk ? "OK" : "Bloqué", state: storageOk ? "ok" : "warn", help:"Utile pour garder certaines préférences du site."},
      {label:"Bloqueur de contenu", value: adBlock ? "Détecté" : "Non détecté", state: adBlock ? "warn" : "ok", help:"Un bloqueur peut empêcher un lecteur externe de se charger."}
    ];

    const device = [
      {label:"Système", value: os, state:"info", help:"Système détecté via le navigateur."},
      {label:"Navigateur", value: browserInfo.browser, state:"info", help: browserInfo.brands || "Détection approximative selon le user-agent."},
      {label:"Écran", value: `${screen.width} × ${screen.height}`, state:"info", help:"Résolution déclarée par l’appareil."},
      {label:"Fenêtre utile", value: `${window.innerWidth} × ${window.innerHeight}`, state:"info", help:"Taille réellement disponible dans le navigateur."},
      {label:"Appareil tactile", value: touch ? "Oui" : "Non", state:"info", help:"Indique si le navigateur déclare une interface tactile."},
      {label:"Langue", value: navigator.language || "Non disponible", state:"info", help:"Langue principale du navigateur."},
      {label:"Mode sombre", value: darkMode ? "Oui" : "Non", state:"info", help:"Préférence déclarée par le système."}
    ];

    const videoRows = [
      {label:"Lecteur HTML5", value: valueFromBool(html5), state: stateFromBool(html5), help:"Base nécessaire pour lire une vidéo dans le navigateur."},
      {label:"MP4 H.264", value: canPlay('video/mp4; codecs="avc1.42E01E"'), state: canPlay('video/mp4; codecs="avc1.42E01E"') === "Non" ? "warn" : "ok", help:"Format très courant sur mobile."},
      {label:"WebM", value: canPlay('video/webm; codecs="vp8, vorbis"'), state: canPlay('video/webm; codecs="vp8, vorbis"') === "Non" ? "info" : "ok", help:"Format accepté par certains navigateurs."},
      {label:"HLS natif", value: canPlay('application/vnd.apple.mpegurl'), state: canPlay('application/vnd.apple.mpegurl') === "Non" ? "info" : "ok", help:"Souvent natif sur Safari, variable sur Android."},
      {label:"Plein écran", value: fullscreen ? "Compatible" : "Non disponible", state: fullscreen ? "ok" : "warn", help:"Utile pour la lecture confortable."},
      {label:"Autoplay mobile", value:"Souvent bloqué", state:"info", help:"C’est normal : la plupart des mobiles exigent une action utilisateur."},
      {label:"Réseau", value: networkLabel || "Non disponible", state:"info", help:"Information approximative fournie par le navigateur."},
      {label:"Mémoire", value: memory, state:"info", help:"Valeur approximative quand le navigateur l’autorise."},
      {label:"Cœurs CPU", value: cores, state:"info", help:"Aide à repérer les appareils plus modestes."},
      {label:"Animations réduites", value: reducedMotion ? "Oui" : "Non", state:"info", help:"Préférence accessibilité du système."}
    ];

    setRows("essentialDiagnostics", essential);
    setRows("deviceDiagnostics", device);
    setRows("videoDiagnostics", videoRows);

    const now = new Date();
    const text = [
      "=== Planète Stream - Diagnostic vidéo ===",
      `Date : ${now.toLocaleString()}`,
      "",
      `Connexion : ${online ? "OK" : "Hors ligne"}`,
      `HTTPS : ${secure ? "OK" : "Non"}`,
      `JavaScript : OK`,
      `Cookies : ${cookieOk ? "Activés" : "Bloqués"}`,
      `Stockage local : ${storageOk ? "OK" : "Bloqué"}`,
      `Bloqueur de contenu : ${adBlock ? "Détecté" : "Non détecté"}`,
      "",
      `Système : ${os}`,
      `Navigateur : ${browserInfo.browser}`,
      browserInfo.brands ? `Moteur / marques : ${browserInfo.brands}` : "",
      `Langue : ${navigator.language || "Non disponible"}`,
      `Écran : ${screen.width}x${screen.height}`,
      `Fenêtre utile : ${window.innerWidth}x${window.innerHeight}`,
      `Tactile : ${touch ? "Oui" : "Non"}`,
      `Mode sombre : ${darkMode ? "Oui" : "Non"}`,
      "",
      `Lecteur HTML5 : ${html5 ? "OK" : "Non"}`,
      `MP4 H.264 : ${canPlay('video/mp4; codecs="avc1.42E01E"')}`,
      `WebM : ${canPlay('video/webm; codecs="vp8, vorbis"')}`,
      `HLS natif : ${canPlay('application/vnd.apple.mpegurl')}`,
      `Plein écran : ${fullscreen ? "Compatible" : "Non disponible"}`,
      `Réseau : ${networkLabel}`,
      `Mémoire : ${memory}`,
      `Cœurs CPU : ${cores}`,
      "",
      "Note : ce diagnostic est généré localement dans le navigateur."
    ].filter(Boolean).join("\n");

    const box = $("diagnosticCopyBox");
    if(box) box.textContent = text;
    window.psVideoDiagnosticText = text;
  }

  async function copyDiagnostic(){
    const text = window.psVideoDiagnosticText || ($("diagnosticCopyBox") && $("diagnosticCopyBox").textContent) || "";
    const state = $("copyState");
    try{
      await navigator.clipboard.writeText(text);
      if(state) state.textContent = "Diagnostic copié. Vous pouvez le coller sur Discord.";
    }catch(e){
      if(state) state.textContent = "Copie automatique impossible. Sélectionnez le bloc puis copiez-le manuellement.";
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    const copyBtn = $("copyDiagnosticBtn");
    const refreshBtn = $("refreshDiagnosticBtn");
    if(copyBtn) copyBtn.addEventListener("click", copyDiagnostic);
    if(refreshBtn) refreshBtn.addEventListener("click", runDiagnostic);
    runDiagnostic();
  });
})();
