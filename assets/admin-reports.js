/* Planète Stream · Signalements communauté */
(function initAdminReports(){
  const state = {loaded:false, loading:false, reports:[], comments:new Map(), viewers:new Map(), notice:''};
  const els = {
    module: document.querySelector('[data-admin-module="signalements"]'),
    list: document.querySelector('#reportsList'),
    count: document.querySelector('#reportsCount'),
    open: document.querySelector('#reportsOpenCount'),
    closed: document.querySelector('#reportsClosedCount')
  };
  if(!els.module || !els.list) return;

  document.querySelectorAll('[data-admin-tab]').forEach(tab => {
    tab.addEventListener('click', () => {
      if(tab.dataset.adminTab === 'signalements') loadReports(true);
    });
  });

  els.list.addEventListener('click', async event => {
    const action = event.target.closest('[data-report-action]');
    if(!action) return;
    const id = action.dataset.reportId;
    if(!id) return;
    if(action.dataset.reportAction === 'reviewed') await updateReportStatus(id, 'reviewed');
    if(action.dataset.reportAction === 'ignored') await updateReportStatus(id, 'ignored');
    if(action.dataset.reportAction === 'delete-message') await deleteReportedMessage(id);
  });

  async function loadReports(force=false){
    if((state.loaded && !force) || state.loading) return;
    state.loading = true;
    renderMessage('Chargement des signalements…');
    try{
      await waitForPS();
      const ps = getPS();
      const result = await ps.restSelect('reports', 'select=id,reporter_viewer_id,target_type,target_id,movie_id,reason,details,status,created_at,handled_by,handled_at&order=created_at.desc&limit=100', {auth:true});
      if(!result.ok || !Array.isArray(result.data)) throw new Error('Table reports inaccessible. Le SQL est peut-être à lancer dans Supabase.');
      state.reports = result.data;
      await hydrateReports();
      state.loaded = true;
      render();
    }catch(error){
      console.error('Reports admin error', error);
      renderMessage(error.message || 'Impossible de charger les signalements.');
    }finally{
      state.loading = false;
    }
  }

  async function hydrateReports(){
    const ps = getPS();
    const commentIds = [...new Set(state.reports.filter(r => r.target_type === 'comment').map(r => r.target_id).filter(Boolean))];
    const viewerIds = [...new Set(state.reports.flatMap(r => [r.reporter_viewer_id, r.handled_by]).filter(Boolean))];

    state.comments = new Map();
    state.viewers = new Map();

    if(commentIds.length){
      const result = await ps.restSelect('comments', `id=in.(${commentIds.join(',')})&select=id,movie_id,viewer_uuid,display_name,comment,parent_id,created_at`, {auth:true});
      if(result.ok && Array.isArray(result.data)){
        result.data.forEach(row => state.comments.set(String(row.id), row));
        result.data.forEach(row => { if(row.viewer_uuid) viewerIds.push(row.viewer_uuid); });
      }
    }

    const cleanViewerIds = [...new Set(viewerIds)].filter(id => /^[0-9a-f-]{36}$/i.test(String(id)));
    if(cleanViewerIds.length){
      const result = await ps.restSelect('viewers', `id=in.(${cleanViewerIds.join(',')})&select=id,pseudo,avatar,badge,role`, {auth:true});
      if(result.ok && Array.isArray(result.data)) result.data.forEach(row => state.viewers.set(String(row.id), row));
    }
  }

  function render(){
    const total = state.reports.length;
    const open = state.reports.filter(r => String(r.status || 'new') === 'new').length;
    const closed = total - open;
    setText(els.count, total);
    setText(els.open, open);
    setText(els.closed, closed);

    if(!total){
      renderMessage('Aucun signalement pour le moment. Le peuple est calme, rangez les casques.');
      return;
    }

    els.list.innerHTML = state.reports.map(report => renderReport(report)).join('');
  }

  function renderReport(report){
    const comment = state.comments.get(String(report.target_id));
    const reporter = state.viewers.get(String(report.reporter_viewer_id));
    const author = comment?.viewer_uuid ? state.viewers.get(String(comment.viewer_uuid)) : null;
    const status = String(report.status || 'new');
    const isOpen = status === 'new';
    const href = comment?.movie_id ? `watch.html?slug=${encodeURIComponent(comment.movie_id)}#comment-${encodeURIComponent(comment.id)}` : '#';
    const text = comment?.comment || 'Message supprimé ou introuvable';
    return `
      <article class="report-card ${isOpen ? 'is-open' : 'is-closed'}">
        <div class="report-head">
          <span class="report-flag">🚩</span>
          <div>
            <strong>${escapeHtml(reasonLabel(report.reason))}</strong>
            <small>${escapeHtml(formatDate(report.created_at))} · ${escapeHtml(statusLabel(status))}</small>
          </div>
          <span class="report-status">${escapeHtml(statusLabel(status))}</span>
        </div>
        <div class="report-grid">
          ${field('Signalé par', reporter?.pseudo || 'Planétien inconnu')}
          ${field('Auteur du message', author?.pseudo || comment?.display_name || 'Auteur inconnu')}
          ${field('Film / contenu', comment?.movie_id || report.movie_id || 'Non renseigné')}
          ${field('Type', report.target_type || 'comment')}
        </div>
        <blockquote>${escapeHtml(shorten(text, 260))}</blockquote>
        <div class="report-actions">
          ${href !== '#' ? `<a class="ghost" href="${href}">Voir le message</a>` : ''}
          ${isOpen ? `<button class="primary" type="button" data-report-action="reviewed" data-report-id="${escapeAttr(report.id)}">Marquer traité</button>` : ''}
          ${isOpen ? `<button class="ghost" type="button" data-report-action="ignored" data-report-id="${escapeAttr(report.id)}">Ignorer</button>` : ''}
          ${comment?.id ? `<button class="ghost danger" type="button" data-report-action="delete-message" data-report-id="${escapeAttr(report.id)}">Supprimer le message</button>` : ''}
        </div>
      </article>
    `;
  }

  async function updateReportStatus(id, status){
    const ps = getPS();
    const viewer = ps.state?.viewer || ps.getState?.()?.viewer || null;
    const result = await ps.restWrite('reports', 'PATCH', `id=eq.${encodeURIComponent(id)}`, {
      status,
      handled_by: viewer?.id || null,
      handled_at: new Date().toISOString()
    }, {auth:true, prefer:'return=minimal'});
    if(!result.ok){
      alert('Impossible de mettre à jour le signalement. Vérifie les droits RLS.');
      return;
    }
    await markRelatedReportNotificationsRead();
    await loadReports(true);
  }

  async function deleteReportedMessage(reportId){
    const report = state.reports.find(r => String(r.id) === String(reportId));
    const comment = report ? state.comments.get(String(report.target_id)) : null;
    if(!comment?.id) return;
    if(!window.confirm('Supprimer ce message signalé ? Action définitive.')) return;
    const ps = getPS();
    const result = await ps.restWrite('comments', 'DELETE', `id=eq.${encodeURIComponent(comment.id)}`, {}, {auth:true, prefer:'return=minimal'});
    if(!result.ok){
      alert('Suppression refusée. Vérifie les policies DELETE de comments pour les modos/fondateurs.');
      return;
    }
    if(!comment.parent_id && comment.movie_id && comment.viewer_uuid){
      await ps.restWrite('movie_ratings', 'DELETE', `movie_id=eq.${encodeURIComponent(comment.movie_id)}&viewer_id=eq.${encodeURIComponent(comment.viewer_uuid)}`, {}, {auth:true, prefer:'return=minimal'});
    }
    await updateReportStatus(reportId, 'reviewed');
  }

  async function markRelatedReportNotificationsRead(){
    const ps = getPS();
    const viewer = ps.state?.viewer || ps.getState?.()?.viewer || null;
    if(!viewer?.id) return;
    await ps.restWrite('notifications', 'PATCH', `recipient_viewer_id=eq.${encodeURIComponent(viewer.id)}&type=eq.report&read_at=is.null`, {read_at:new Date().toISOString()}, {auth:true, prefer:'return=minimal'});
    await ps.refreshNotificationsCount?.();
  }

  function renderMessage(message){
    els.list.innerHTML = `<div class="admin-empty">${escapeHtml(message)}</div>`;
  }

  function waitForPS(){ return window.PS?.ready || Promise.resolve(); }
  function getPS(){ return window.PS || window.PSAuth; }
  function setText(node, value){ if(node) node.textContent = String(value); }
  function field(label, value){ return `<div class="viewer-detail-field"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value || '—')}</strong></div>`; }
  function reasonLabel(reason){ return {spam:'Spam', insulte:'Insulte', spoiler:'Spoiler non signalé', inapproprie:'Contenu inapproprié', autre:'Autre'}[String(reason || '').toLowerCase()] || reason || 'Signalement'; }
  function statusLabel(status){ return {new:'Nouveau', reviewed:'Traité', ignored:'Ignoré', closed:'Fermé'}[String(status || '').toLowerCase()] || status || 'Nouveau'; }
  function shorten(text='', limit=180){ const clean = String(text || '').replace(/\s+/g, ' ').trim(); return clean.length > limit ? `${clean.slice(0, limit - 1)}…` : clean; }
  function formatDate(value){ if(!value) return 'date inconnue'; const d = new Date(value); return Number.isNaN(d.getTime()) ? 'date inconnue' : d.toLocaleString('fr-FR', {day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit'}); }
  function escapeHtml(value=''){ return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c])); }
  function escapeAttr(value=''){ return escapeHtml(value); }
})();
