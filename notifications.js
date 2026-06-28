// ============================================================
//  NOTIFICATIONS.JS — Module temps réel partagé
//  À inclure dans dashboard.html, saisie.html, validation.html
// ============================================================

const NOTIF = (() => {
    let db          = null;
    let currentUser = null;
    let channel     = null;
    let allNotifs   = [];
    let panelOpen   = false;

    // ── Init ─────────────────────────────────────────────────
    async function init(supabaseClient, user) {
        db          = supabaseClient;
        currentUser = user;
        _injectUI();
        await _load();
        _subscribe();
    }

    // ── Injecter l'UI dans le header ─────────────────────────
    function _injectUI() {
        // Cloche dans le header
        const style = document.createElement('style');
        style.textContent = `
            #notif-btn {
                position:relative; background:rgba(255,255,255,0.1);
                border:1px solid rgba(255,255,255,0.2); color:white;
                width:38px; height:38px; border-radius:10px;
                display:flex; align-items:center; justify-content:center;
                cursor:pointer; font-size:18px; flex-shrink:0;
                transition:background 0.2s;
            }
            #notif-btn:hover { background:rgba(255,255,255,0.2); }
            #notif-badge {
                position:absolute; top:-5px; right:-5px;
                background:#C8102E; color:white; font-size:10px;
                font-weight:800; min-width:18px; height:18px;
                border-radius:9px; display:none; align-items:center;
                justify-content:center; padding:0 4px;
                border:2px solid #0D1B4B;
            }
            #notif-badge.show { display:flex; }

            #notif-panel {
                position:fixed; top:60px; right:16px; width:360px;
                max-height:520px; background:white; border-radius:16px;
                box-shadow:0 8px 40px rgba(13,27,75,0.18);
                z-index:500; display:none; flex-direction:column;
                animation:panelIn 0.2s ease; overflow:hidden;
            }
            #notif-panel.open { display:flex; }
            @keyframes panelIn { from{opacity:0;transform:translateY(-10px)} to{opacity:1;transform:translateY(0)} }

            .notif-panel-hdr {
                background:#0D1B4B; padding:14px 16px;
                display:flex; align-items:center; justify-content:space-between;
                flex-shrink:0;
            }
            .notif-panel-hdr h4 { color:white; font-size:14px; font-weight:600; }
            .notif-hdr-actions { display:flex; gap:8px; align-items:center; }
            .notif-hdr-btn {
                background:rgba(255,255,255,0.1); color:rgba(255,255,255,0.8);
                border:none; padding:5px 10px; border-radius:6px;
                font-size:11px; font-weight:600; cursor:pointer;
                transition:background 0.2s;
            }
            .notif-hdr-btn:hover { background:rgba(255,255,255,0.2); }

            .notif-tabs {
                display:flex; background:#F4F6FC;
                border-bottom:1px solid #E2E8F0; flex-shrink:0;
            }
            .notif-tab {
                flex:1; padding:9px; text-align:center; font-size:12px;
                font-weight:600; color:#5A6275; cursor:pointer;
                border-bottom:2px solid transparent; transition:all 0.2s;
            }
            .notif-tab.active { color:#0D1B4B; border-bottom-color:#C8102E; }

            .notif-list { overflow-y:auto; flex:1; }
            .notif-list::-webkit-scrollbar { width:4px; }
            .notif-list::-webkit-scrollbar-thumb { background:#CBD5E1; border-radius:2px; }

            .notif-item {
                padding:12px 16px; border-bottom:1px solid #F1F5F9;
                cursor:pointer; transition:background 0.15s; display:flex;
                gap:10px; align-items:flex-start;
            }
            .notif-item:hover { background:#F8FAFC; }
            .notif-item.unread { background:#EFF6FF; border-left:3px solid #3B82F6; }
            .notif-item.unread:hover { background:#DBEAFE; }

            .notif-icon {
                width:34px; height:34px; border-radius:50%; flex-shrink:0;
                display:flex; align-items:center; justify-content:center;
                font-size:16px;
            }
            .ni-validation    { background:#DCFCE7; }
            .ni-refus         { background:#FEE2E2; }
            .ni-nouvel        { background:#FEF3C7; }
            .ni-budget        { background:#FEF3C7; }
            .ni-commentaire   { background:#F1F5F9; }

            .notif-body { flex:1; min-width:0; }
            .notif-titre {
                font-size:13px; font-weight:600; color:#1E293B;
                margin-bottom:2px; white-space:nowrap; overflow:hidden;
                text-overflow:ellipsis;
            }
            .notif-msg  { font-size:11px; color:#5A6275; line-height:1.4; }
            .notif-time { font-size:10px; color:#94A3B8; margin-top:4px; }
            .notif-dot  {
                width:8px; height:8px; border-radius:50%;
                background:#3B82F6; flex-shrink:0; margin-top:6px;
            }

            .notif-empty {
                text-align:center; padding:40px 20px; color:#94A3B8;
            }
            .notif-empty-icon { font-size:36px; margin-bottom:8px; }

            .notif-footer {
                padding:10px 16px; border-top:1px solid #E2E8F0;
                text-align:center; flex-shrink:0;
            }
            .notif-footer-btn {
                font-size:12px; color:#0D1B4B; font-weight:600;
                cursor:pointer; background:none; border:none;
            }
            .notif-footer-btn:hover { text-decoration:underline; }

            .notif-overlay {
                display:none; position:fixed; inset:0; z-index:499;
            }
            #notif-overlay.show { display:block; }

            @media(max-width:400px) {
                #notif-panel { left:8px; right:8px; width:auto; }
            }
        `;
        document.head.appendChild(style);

        // Bouton cloche — insérer dans header-right
        const btn = document.createElement('button');
        btn.id = 'notif-btn';
        btn.title = 'Notifications';
        btn.innerHTML = `🔔<span id="notif-badge"></span>`;
        btn.onclick = togglePanel;

        const hdrRight = document.querySelector('.header-right');
        if (hdrRight) hdrRight.insertBefore(btn, hdrRight.firstChild);

        // Overlay pour fermer
        const overlay = document.createElement('div');
        overlay.id = 'notif-overlay';
        overlay.className = 'notif-overlay';
        overlay.onclick = closePanel;
        document.body.appendChild(overlay);

        // Panel
        const panel = document.createElement('div');
        panel.id = 'notif-panel';
        panel.innerHTML = `
            <div class="notif-panel-hdr">
                <h4>🔔 Notifications</h4>
                <div class="notif-hdr-actions">
                    <button class="notif-hdr-btn" onclick="NOTIF.markAllRead()">✓ Tout lire</button>
                    <button class="notif-hdr-btn" onclick="NOTIF.closePanel()">✕</button>
                </div>
            </div>
            <div class="notif-tabs">
                <div class="notif-tab active" onclick="NOTIF.filterTab('all',this)">Toutes</div>
                <div class="notif-tab" onclick="NOTIF.filterTab('unread',this)">Non lues</div>
                <div class="notif-tab" onclick="NOTIF.filterTab('validation',this)">Validations</div>
            </div>
            <div class="notif-list" id="notif-list"></div>
            <div class="notif-footer">
                <button class="notif-footer-btn" onclick="NOTIF.deleteAll()">🗑 Effacer toutes les notifications</button>
            </div>
        `;
        document.body.appendChild(panel);
    }

    // ── Charger depuis Supabase ───────────────────────────────
    async function _load() {
        if (!db || !currentUser) return;
        const { data } = await db.from('notifications')
            .select('*')
            .eq('destinataire_id', currentUser.id)
            .order('created_at', { ascending:false })
            .limit(50);
        allNotifs = data || [];
        _render(allNotifs);
        _updateBadge();
    }

    // ── Souscription temps réel ───────────────────────────────
    function _subscribe() {
        if (!db || !currentUser) return;
        channel = db.channel('notif-rt-' + currentUser.id)
            .on('postgres_changes', {
                event:'INSERT', schema:'public', table:'notifications',
                filter:`destinataire_id=eq.${currentUser.id}`
            }, async (payload) => {
                allNotifs.unshift(payload.new);
                _render(allNotifs);
                _updateBadge();
                _playSound();
                _showBanner(payload.new);
            })
            .subscribe();
    }

    // ── Rendu liste ───────────────────────────────────────────
    function _render(notifs) {
        const list = document.getElementById('notif-list');
        if (!list) return;
        if (!notifs.length) {
            list.innerHTML = `<div class="notif-empty"><div class="notif-empty-icon">🔔</div><p>Aucune notification</p></div>`;
            return;
        }
        list.innerHTML = notifs.map(n => {
            const { icon, cls } = _iconForType(n.type);
            const time = _relTime(n.created_at);
            return `
                <div class="notif-item ${n.lue ? '' : 'unread'}" onclick="NOTIF.markRead('${n.id}','${n.engagement_id||''}')">
                    <div class="notif-icon ${cls}">${icon}</div>
                    <div class="notif-body">
                        <div class="notif-titre">${n.titre}</div>
                        <div class="notif-msg">${n.message||''}</div>
                        <div class="notif-time">${time}</div>
                    </div>
                    ${!n.lue ? '<div class="notif-dot"></div>' : ''}
                </div>`;
        }).join('');
    }

    // ── Badge compteur ────────────────────────────────────────
    function _updateBadge() {
        const badge = document.getElementById('notif-badge');
        if (!badge) return;
        const unread = allNotifs.filter(n=>!n.lue).length;
        badge.textContent = unread > 99 ? '99+' : unread;
        badge.className = unread > 0 ? 'show' : '';
        // Changer titre page
        const base = document.title.replace(/^\(\d+\) /, '');
        document.title = unread > 0 ? `(${unread}) ${base}` : base;
    }

    // ── Son discret ───────────────────────────────────────────
    function _playSound() {
        try {
            const ctx = new (window.AudioContext||window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain); gain.connect(ctx.destination);
            osc.frequency.setValueAtTime(880, ctx.currentTime);
            osc.frequency.setValueAtTime(1100, ctx.currentTime+0.1);
            gain.gain.setValueAtTime(0.1, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime+0.3);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime+0.3);
        } catch(e) {}
    }

    // ── Bannière toast ────────────────────────────────────────
    function _showBanner(n) {
        const { icon } = _iconForType(n.type);
        let banner = document.getElementById('notif-banner');
        if (!banner) {
            banner = document.createElement('div');
            banner.id = 'notif-banner';
            banner.style.cssText = `
                position:fixed; top:70px; right:16px; max-width:320px;
                background:white; border-radius:12px; padding:14px 16px;
                box-shadow:0 8px 32px rgba(13,27,75,0.2); z-index:600;
                display:flex; gap:10px; align-items:flex-start;
                border-left:4px solid #0D1B4B; cursor:pointer;
                animation:panelIn 0.2s ease;
            `;
            banner.onclick = () => { banner.style.display='none'; togglePanel(); };
            document.body.appendChild(banner);
        }
        banner.style.display = 'flex';
        banner.innerHTML = `
            <span style="font-size:22px">${icon}</span>
            <div>
                <div style="font-size:13px;font-weight:700;color:#0D1B4B">${n.titre}</div>
                <div style="font-size:11px;color:#5A6275;margin-top:2px">${n.message||''}</div>
            </div>
            <button onclick="event.stopPropagation();document.getElementById('notif-banner').style.display='none'"
                style="background:none;border:none;color:#94A3B8;cursor:pointer;font-size:16px;margin-left:auto">✕</button>
        `;
        setTimeout(() => { if(banner) banner.style.display='none'; }, 5000);
    }

    // ── Toggle panel ──────────────────────────────────────────
    function togglePanel() {
        panelOpen = !panelOpen;
        const panel   = document.getElementById('notif-panel');
        const overlay = document.getElementById('notif-overlay');
        if (panelOpen) {
            panel.classList.add('open');
            overlay.classList.add('show');
        } else {
            panel.classList.remove('open');
            overlay.classList.remove('show');
        }
    }
    function closePanel() {
        panelOpen = false;
        document.getElementById('notif-panel')?.classList.remove('open');
        document.getElementById('notif-overlay')?.classList.remove('show');
    }

    // ── Marquer lu ────────────────────────────────────────────
    async function markRead(id, engId) {
        await db.from('notifications').update({ lue:true }).eq('id', id);
        const n = allNotifs.find(x=>x.id===id);
        if (n) n.lue = true;
        _render(allNotifs);
        _updateBadge();
        // Naviguer vers l'engagement si dispo
        if (engId && engId !== 'null') {
            closePanel();
            if (typeof showDetail === 'function') showDetail(engId);
        }
    }

    async function markAllRead() {
        await db.from('notifications').update({ lue:true }).eq('destinataire_id', currentUser.id).eq('lue', false);
        allNotifs.forEach(n => n.lue = true);
        _render(allNotifs);
        _updateBadge();
    }

    async function deleteAll() {
        if (!confirm('Supprimer toutes vos notifications ?')) return;
        await db.from('notifications').delete().eq('destinataire_id', currentUser.id);
        allNotifs = [];
        _render(allNotifs);
        _updateBadge();
    }

    // ── Filtres onglets ───────────────────────────────────────
    function filterTab(tab, el) {
        document.querySelectorAll('.notif-tab').forEach(t=>t.classList.remove('active'));
        if (el) el.classList.add('active');
        let filtered;
        if (tab==='unread')     filtered = allNotifs.filter(n=>!n.lue);
        else if (tab==='validation') filtered = allNotifs.filter(n=>['validation','refus'].includes(n.type));
        else                    filtered = allNotifs;
        _render(filtered);
    }

    // ── Helpers ───────────────────────────────────────────────
    function _iconForType(type) {
        const map = {
            validation:   { icon:'✅', cls:'ni-validation' },
            refus:        { icon:'🚫', cls:'ni-refus' },
            nouvel_engagement: { icon:'📋', cls:'ni-nouvel' },
            budget_depasse:   { icon:'⚠️', cls:'ni-budget' },
            commentaire:  { icon:'💬', cls:'ni-commentaire' }
        };
        return map[type] || { icon:'🔔', cls:'ni-commentaire' };
    }

    function _relTime(iso) {
        const diff = Date.now() - new Date(iso).getTime();
        const m = Math.floor(diff/60000);
        const h = Math.floor(diff/3600000);
        const d = Math.floor(diff/86400000);
        if (m < 1)  return "À l'instant";
        if (m < 60) return `Il y a ${m} min`;
        if (h < 24) return `Il y a ${h}h`;
        if (d < 7)  return `Il y a ${d}j`;
        return new Date(iso).toLocaleDateString('fr-FR');
    }

    // ── Envoyer une notification (depuis le code) ─────────────
    async function send(destinataireId, type, titre, message, engagementId=null) {
        if (!db) return;
        await db.from('notifications').insert({
            destinataire_id: destinataireId,
            type, titre, message,
            engagement_id: engagementId,
            lue: false
        });
    }

    // API publique
    return { init, send, markRead, markAllRead, deleteAll, filterTab, togglePanel, closePanel };
})();
