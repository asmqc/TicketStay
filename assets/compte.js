/* TicketStay — page « Mon compte » / "My account" (français et anglais)
 * Connexion avec GitHub (Supabase Auth) et lecture des données synchronisées
 * par l'app dans la table ts_snapshots (une ligne par équipe, voir supabase/schema.sql).
 * La sécurité par ligne (RLS) fait que chaque compte ne lit que ses propres lignes.
 *
 * Paramètres du compte : nom affiché, langue, devise et équipe par défaut sont
 * enregistrés dans les métadonnées du compte Supabase (clés ts_*).
 * « Supprimer mon compte » appelle la fonction SQL public.delete_my_account().
 */
(function () {
  'use strict';

  var LANG = /^en/i.test(document.documentElement.lang) ? 'en' : 'fr';
  var LOCALE = LANG === 'en' ? 'en-CA' : 'fr-CA';
  var ROOT = (document.body && document.body.getAttribute('data-root')) || '';
  var PAGES = { fr: 'compte.html', en: 'en/account.html' };

  var T = {
    fr: {
      netErr: 'Le service de connexion ne répond pas. Vérifiez votre connexion Internet.',
      unknownErr: 'Erreur inconnue.',
      ghOff: 'La connexion GitHub n\'est pas encore activée pour ce site.',
      hello: 'Bonjour', team: 'Équipe', synced: 'Synchronisé le ',
      next: 'Prochain match', none: 'Aucun', noUpcoming: 'Aucun match à venir', noUpcomingDot: 'Aucun match à venir.',
      owed: 'À recevoir', buyer: ' acheteur', buyers: ' acheteurs', allPaidShort: 'Tout est payé',
      revenue: 'Revenus encaissés', revenueSub: 'Billets vendus et payés',
      toPlace: 'Billets à placer', toPlaceSub: 'Pour les matchs à venir',
      unpaid: ' · non payé', opponent: 'Adversaire',
      allPaid: 'Tout le monde a payé', allPaidSub: 'Personne ne vous doit d\'argent pour cette équipe.',
      unknownBuyer: 'Acheteur inconnu', text: 'Texto', textTo: 'Texto à ', email: 'Courriel', emailTo: 'Courriel à ',
      ticket: ' billet', tickets: ' billets', recovered: ' récupérés sur ', pct: ' %',
      status: { a_vendre: 'À vendre', vendu: 'Vendu', donne: 'Donné', utilise: 'Utilisé', a_placer: 'À placer' },
      demoLeague: 'Ligue démo',
      demoTeams: [['Les Harfangs', ['Les Loups', 'Les Faucons', 'Les Ours', 'Les Lynx', 'Les Orignaux']], ['Les Castors', ['Les Aigles', 'Les Renards', 'Les Coyotes', 'Les Bisons']]],
      // Paramètres
      saved: 'Paramètres enregistrés.', savedDemo: 'Mode démo : les paramètres ne sont pas enregistrés.',
      saving: 'Enregistrement…', demoOff: 'Non disponible en mode démo.',
      exported: 'Fichier téléchargé.', nothingExport: 'Aucune donnée synchronisée à exporter.',
      dataDeleted: 'Vos données synchronisées ont été supprimées.',
      accountDeleted: 'Votre compte a été supprimé.', confirmWord: 'SUPPRIMER',
      typeToConfirm: 'Tapez SUPPRIMER pour confirmer.',
      notSet: 'Non fourni par GitHub', firstTeam: 'Première équipe (ordre alphabétique)', noTeams: 'Aucune équipe synchronisée',
      switching: 'Ouverture de la version anglaise…'
    },
    en: {
      netErr: 'The sign-in service is not responding. Check your internet connection.',
      unknownErr: 'Unknown error.',
      ghOff: 'GitHub sign-in is not enabled for this site yet.',
      hello: 'Hello', team: 'Team', synced: 'Synced ',
      next: 'Next game', none: 'None', noUpcoming: 'No upcoming games', noUpcomingDot: 'No upcoming games.',
      owed: 'Owed to you', buyer: ' buyer', buyers: ' buyers', allPaidShort: 'All paid',
      revenue: 'Collected', revenueSub: 'Tickets sold and paid',
      toPlace: 'Tickets to assign', toPlaceSub: 'For upcoming games',
      unpaid: ' · unpaid', opponent: 'Opponent',
      allPaid: 'Everyone has paid', allPaidSub: 'Nobody owes you money for this team.',
      unknownBuyer: 'Unknown buyer', text: 'Text', textTo: 'Text ', email: 'Email', emailTo: 'Email ',
      ticket: ' ticket', tickets: ' tickets', recovered: ' recovered out of ', pct: '%',
      status: { a_vendre: 'For sale', vendu: 'Sold', donne: 'Given away', utilise: 'Used', a_placer: 'To assign' },
      demoLeague: 'Demo league',
      demoTeams: [['Snowy Owls', ['Wolves', 'Falcons', 'Bears', 'Lynx', 'Moose']], ['Beavers', ['Eagles', 'Foxes', 'Coyotes', 'Bison']]],
      saved: 'Settings saved.', savedDemo: 'Demo mode: settings are not saved.',
      saving: 'Saving…', demoOff: 'Not available in demo mode.',
      exported: 'File downloaded.', nothingExport: 'No synced data to export.',
      dataDeleted: 'Your synced data has been deleted.',
      accountDeleted: 'Your account has been deleted.', confirmWord: 'DELETE',
      typeToConfirm: 'Type DELETE to confirm.',
      notSet: 'Not provided by GitHub', firstTeam: 'First team (alphabetical)', noTeams: 'No synced teams',
      switching: 'Opening the French version…'
    }
  }[LANG];

  var cfg = window.TICKETSTAY_SUPABASE || {};
  var configured = !!(cfg.url && cfg.key);
  var sb = null;
  var state = { teams: [], team: 0, demo: false, user: null, prefs: {}, view: 'dash', who: null };
  var demoPrefs = {};
  var listening = false;

  var money;
  function setMoney(cur) {
    try { money = new Intl.NumberFormat(LOCALE, { style: 'currency', currency: cur || 'CAD', maximumFractionDigits: 0 }); }
    catch (e) { money = new Intl.NumberFormat(LOCALE, { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }); }
  }
  setMoney('CAD');
  var dayFmt = new Intl.DateTimeFormat(LOCALE, { weekday: 'short' });
  var monFmt = new Intl.DateTimeFormat(LOCALE, { month: 'short' });
  var timeFmt = new Intl.DateTimeFormat(LOCALE, { hour: 'numeric', minute: '2-digit' });
  var longFmt = new Intl.DateTimeFormat(LOCALE, { weekday: 'long', day: 'numeric', month: 'long' });
  var syncFmt = new Intl.DateTimeFormat(LOCALE, { dateStyle: 'long', timeStyle: 'short' });

  var STATUS_CLS = { a_vendre: 'sell', vendu: 'sold', donne: 'gift', utilise: 'used', a_placer: 'todo' };

  function $(s) { return document.querySelector(s); }

  /* Construit un élément sans jamais injecter de HTML venant des données */
  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'text') n.textContent = attrs[k];
      else if (k === 'cls') n.className = attrs[k];
      else if (attrs[k] != null) n.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) { if (c) n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return n;
  }
  function clear(n) { while (n.firstChild) n.removeChild(n.firstChild); return n; }

  function show(name) {
    document.querySelectorAll('[data-state]').forEach(function (s) { s.hidden = s.getAttribute('data-state') !== name; });
    var gear = document.querySelectorAll('[data-open-settings]');
    gear.forEach(function (b) { b.hidden = name === 'settings' || name === 'loading'; });
  }

  function pageUrl(lang) { return new URL(ROOT + PAGES[lang], location.href).href; }

  /* ================================================================ Supabase */
  function loadSupabase() {
    return new Promise(function (res, rej) {
      if (window.supabase && window.supabase.createClient) return res();
      var s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
      s.async = true;
      s.onload = function () { res(); };
      s.onerror = function () { rej(new Error(T.netErr)); };
      document.head.appendChild(s);
    });
  }

  function startCloud() {
    state.demo = false;
    $('#demoBar').hidden = true;
    show('loading');
    loadSupabase().then(function () {
      if (!sb) {
        sb = window.supabase.createClient(cfg.url, cfg.key, {
          auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
        });
      }
      if (!listening) {
        listening = true;
        sb.auth.onAuthStateChange(function (event, session) {
          if (state.demo) return;
          if (event === 'SIGNED_OUT') onSignedOut();
          else if (event === 'SIGNED_IN' && session && !state.user) onSignedIn(session.user);
        });
      }
      return sb.auth.getSession();
    }).then(function (r) {
      var back = /[?&](code|error)=/.test(location.search);
      /* Nettoie l'adresse après le retour de GitHub (?code=…) */
      if (back) {
        var q = new URLSearchParams(location.search);
        if (q.get('error_description')) throw new Error(q.get('error_description'));
        try { history.replaceState(null, '', location.pathname); } catch (e) {}
      }
      var session = r && r.data && r.data.session;
      if (r && r.error) throw r.error;
      /* Connexion lancée depuis la version anglaise : y retourner */
      var ret = null;
      try { ret = localStorage.getItem('ts-auth-return'); localStorage.removeItem('ts-auth-return'); } catch (e) {}
      if (session && back && ret && ret !== location.href.split('?')[0] && /^https:\/\//.test(ret) && new URL(ret).origin === location.origin) {
        location.replace(ret); return;
      }
      if (session) onSignedIn(session.user); else onSignedOut();
    }).catch(onError);
  }

  function signIn() {
    var btn = $('#ghSignIn');
    btn.disabled = true;
    btn.classList.add('busy');
    /* Une seule adresse de retour autorisée chez Supabase : compte.html */
    var target = pageUrl('fr');
    try {
      if (location.href.split('?')[0] !== target) localStorage.setItem('ts-auth-return', location.href.split('?')[0]);
      else localStorage.removeItem('ts-auth-return');
    } catch (e) {}
    sb.auth.signInWithOAuth({
      provider: cfg.provider || 'github',
      options: { redirectTo: target }
    }).then(function (r) { if (r.error) throw r.error; }).catch(function (e) {
      btn.disabled = false; btn.classList.remove('busy'); onError(e);
    });
  }

  function signOut() {
    state.teams = []; state.user = null;
    if (state.demo) { exitDemo(); return; }
    sb.auth.signOut().then(onSignedOut, onSignedOut);
  }

  function onSignedOut() {
    $('#sessionBar').hidden = true;
    state.teams = []; state.user = null;
    var btn = $('#ghSignIn'); if (btn) { btn.disabled = false; btn.classList.remove('busy'); }
    show('signin');
  }

  function userLabel(u) {
    var m = (u && u.user_metadata) || {};
    return { name: m.full_name || m.name || m.user_name || m.preferred_username || u.email || '', login: m.user_name || m.preferred_username || '', avatar: m.avatar_url || '', email: u.email || m.email || '' };
  }

  function readPrefs(u) {
    var m = (u && u.user_metadata) || {};
    return { name: m.ts_display_name || '', lang: m.ts_lang || '', currency: m.ts_currency || 'CAD', team: m.ts_default_team || '' };
  }

  function onSignedIn(user) {
    state.user = user;
    state.prefs = readPrefs(user);
    setMoney(state.prefs.currency);
    var who = state.who = userLabel(user);
    $('#sessionBar').hidden = false;
    $('#who').textContent = who.login ? who.name + ' (@' + who.login + ')' : who.name;
    var av = $('#whoAvatar');
    if (who.avatar && /^https:\/\//.test(who.avatar)) { av.src = who.avatar; av.hidden = false; } else av.hidden = true;
    fetchData();
  }

  function fetchData() {
    show('loading');
    sb.from('ts_snapshots').select('team_id, payload, updated_at').then(function (r) {
      if (r.error) throw r.error;
      state.rows = r.data || [];
      var teams = state.rows.map(function (row) {
        var d = row.payload;
        if (typeof d === 'string') { try { d = JSON.parse(d); } catch (e) { d = null; } }
        if (d && !d.syncedAt && row.updated_at) d.syncedAt = row.updated_at;
        if (d) d._id = row.team_id;
        return d;
      }).filter(function (d) { return d && d.team; });
      if (!teams.length) { state.teams = []; show('empty'); return; }
      teams.sort(function (a, b) { return (a.team.name || '').localeCompare(b.team.name || '', LANG); });
      setData(teams);
    }).catch(onError);
  }

  function onError(err) {
    var code = err && (err.code || err.status);
    var msg = (err && (err.message || err.error_description)) || T.unknownErr;
    /* Table pas encore créée : on affiche simplement un compte vide */
    if (code === '42P01' || code === 'PGRST205' || /relation .* does not exist|Could not find the table/i.test(msg)) { show('empty'); return; }
    if (/provider is not enabled|Unsupported provider/i.test(msg)) msg = T.ghOff;
    $('#errMsg').textContent = msg;
    show('error');
  }

  /* ================================================================ Démo */
  function demoData() {
    var seed = 7;
    function rnd() { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }
    var buyers = [
      { id: 'b1', name: 'Julie Bouchard', phone: '514 555-0142', email: 'julie@example.com' },
      { id: 'b2', name: 'Marc Tremblay', phone: '438 555-0187' },
      { id: 'b3', name: 'Sophie Lavoie', phone: '450 555-0119', email: 'sophie@example.com' },
      { id: 'b4', name: 'Alex Dubé', phone: '514 555-0163' }
    ];
    function team(id, name, sport, cost, opponents, seats, basePrice, startHour) {
      var now = new Date(); now.setHours(0, 0, 0, 0);
      var games = [];
      for (var i = -9; i < 11; i++) {
        var d = new Date(now.getTime() + (i * 4 + 1) * 86400000);
        d.setHours(startHour, i % 3 === 0 ? 0 : 30, 0, 0);
        var past = i < 0;
        var tickets = seats.map(function (seat) {
          var r = rnd(), st, paid = true, buyer = null;
          if (past) {
            st = r < .55 ? 'vendu' : r < .75 ? 'donne' : 'utilise';
            if (st !== 'utilise') buyer = buyers[Math.floor(rnd() * buyers.length)].id;
            if (st === 'vendu' && rnd() < .18) paid = false;
          } else {
            st = r < .4 ? 'vendu' : r < .7 ? 'a_vendre' : r < .8 ? 'donne' : 'a_placer';
            if (st === 'vendu' || st === 'donne') buyer = buyers[Math.floor(rnd() * buyers.length)].id;
            if (st === 'vendu' && rnd() < .45) paid = false;
          }
          return { seat: seat, status: st, price: st === 'vendu' ? basePrice + Math.round(rnd() * 4) * 5 : 0, buyer: buyer, paid: paid };
        });
        games.push({ date: d.toISOString(), opponent: opponents[(i + 20) % opponents.length], home: true, tickets: tickets });
      }
      return {
        _id: id, version: 1, owner: 'Alex', syncedAt: new Date(Date.now() - 12 * 60000).toISOString(),
        team: { name: name, sport: sport, league: T.demoLeague, season: '2026-2027', cost: cost },
        games: games, buyers: buyers
      };
    }
    var dt = T.demoTeams;
    var s = LANG === 'en' ? ['Sec. 112 · Row F · Seat 3', 'Sec. 112 · Row F · Seat 4', 'Sec. 204 · Row B · Seat 11', 'Sec. 204 · Row B · Seat 12'] : ['Sec. 112 · R. F · S. 3', 'Sec. 112 · R. F · S. 4', 'Sec. 204 · R. B · S. 11', 'Sec. 204 · R. B · S. 12'];
    return [
      team('demo-1', dt[0][0], 'Hockey', 4200, dt[0][1], [s[0], s[1]], 85, 19),
      team('demo-2', dt[1][0], 'Basketball', 2600, dt[1][1], [s[2], s[3]], 60, 20)
    ];
  }

  function startDemo() {
    state.demo = true;
    state.user = null;
    state.who = { name: 'Alex Martin', login: 'alex-demo', avatar: '', email: 'alex@example.com' };
    state.prefs = Object.assign({ name: '', lang: '', currency: 'CAD', team: '' }, demoPrefs);
    setMoney(state.prefs.currency);
    $('#demoBar').hidden = false;
    $('#sessionBar').hidden = true;
    setData(demoData());
    try { history.replaceState(null, '', '?demo=1'); } catch (e) {}
  }

  function exitDemo() {
    state.demo = false;
    $('#demoBar').hidden = true;
    try { history.replaceState(null, '', location.pathname); } catch (e) {}
    if (configured) startCloud(); else show('setup');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ================================================================ Tableau de bord */
  function displayName() {
    if (state.prefs.name) return state.prefs.name;
    var d = state.teams[0];
    return ((d && d.owner) || (state.who && state.who.name) || '').split(' ')[0];
  }

  function setData(teams) {
    state.teams = teams;
    var idx = 0;
    if (state.prefs.team) teams.forEach(function (t, i) { if (t._id === state.prefs.team) idx = i; });
    state.team = idx;
    var n = displayName();
    $('#hello').textContent = n ? T.hello + ' ' + n : T.hello;
    renderTabs();
    renderTeam();
    show('dash');
  }

  function renderTabs() {
    var box = clear($('#teamTabs'));
    box.hidden = state.teams.length < 2;
    state.teams.forEach(function (t, i) {
      var b = el('button', { type: 'button', cls: 'team-tab', role: 'tab', 'aria-selected': i === state.team ? 'true' : 'false' }, [
        el('b', { text: t.team.name || T.team }), el('small', { text: t.team.sport || t.team.league || '' })
      ]);
      b.addEventListener('click', function () {
        state.team = i;
        box.querySelectorAll('.team-tab').forEach(function (x, k) { x.setAttribute('aria-selected', k === i ? 'true' : 'false'); });
        renderTeam();
      });
      box.appendChild(b);
    });
  }

  function renderTeam() {
    var d = state.teams[state.team];
    var buyers = {};
    (d.buyers || []).forEach(function (b) { buyers[b.id] = b; });
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var games = (d.games || []).slice().sort(function (a, b) { return new Date(a.date) - new Date(b.date); });
    var upcoming = games.filter(function (g) { return new Date(g.date) >= today; });

    var owed = 0, revenue = 0, toPlace = 0, owing = {};
    games.forEach(function (g) {
      (g.tickets || []).forEach(function (t) {
        if (t.status === 'vendu') {
          if (t.paid === false) {
            owed += +t.price || 0;
            var k = t.buyer || '?';
            owing[k] = owing[k] || { n: 0, sum: 0 };
            owing[k].n++; owing[k].sum += +t.price || 0;
          } else revenue += +t.price || 0;
        }
        if (new Date(g.date) >= today && (t.status === 'a_vendre' || t.status === 'a_placer')) toPlace++;
      });
    });

    $('#teamName').textContent = [d.team.name, d.team.season].filter(Boolean).join(' · ');
    $('#synced').textContent = d.syncedAt ? T.synced + syncFmt.format(new Date(d.syncedAt)) : '';

    /* --- Indicateurs --- */
    var next = upcoming[0];
    var owingCount = Object.keys(owing).length;
    var k = clear($('#kpis'));
    k.appendChild(kpi(T.next, next ? 'vs ' + next.opponent : T.none, next ? cap(longFmt.format(new Date(next.date))) + ' · ' + timeFmt.format(new Date(next.date)) : T.noUpcoming, 'nxt'));
    k.appendChild(kpi(T.owed, money.format(owed), owingCount ? owingCount + (owingCount > 1 ? T.buyers : T.buyer) : T.allPaidShort, owed ? 'owed' : 'ok'));
    k.appendChild(kpi(T.revenue, money.format(revenue), T.revenueSub, 'rev'));
    k.appendChild(kpi(T.toPlace, String(toPlace), T.toPlaceSub, toPlace ? 'todo' : 'ok'));

    /* --- Prochains matchs --- */
    var gl = clear($('#games'));
    if (!upcoming.length) gl.appendChild(el('p', { cls: 'muted', text: T.noUpcomingDot }));
    upcoming.slice(0, 6).forEach(function (g) {
      var dt = new Date(g.date);
      var pills = el('div', { cls: 'pills' });
      (g.tickets || []).forEach(function (t) {
        var label = T.status[t.status] || t.status;
        var who = t.buyer && buyers[t.buyer] ? buyers[t.buyer].name : '';
        pills.appendChild(el('span', { cls: 'pill ' + (STATUS_CLS[t.status] || 'todo'), title: [t.seat, who].filter(Boolean).join(' — ') }, [
          label + (t.status === 'vendu' && t.paid === false ? T.unpaid : '')
        ]));
      });
      gl.appendChild(el('div', { cls: 'game' }, [
        el('div', { cls: 'gdate' }, [el('b', { text: String(dt.getDate()) }), el('small', { text: monFmt.format(dt).replace('.', '') })]),
        el('div', { cls: 'ginfo' }, [
          el('b', { text: (g.home === false ? '@ ' : 'vs ') + (g.opponent || T.opponent) }),
          el('small', { text: cap(dayFmt.format(dt)).replace('.', '') + ' · ' + timeFmt.format(dt) }),
          pills
        ])
      ]));
    });

    /* --- Qui doit encore payer --- */
    var ol = clear($('#owing'));
    var ids = Object.keys(owing).sort(function (a, b) { return owing[b].sum - owing[a].sum; });
    if (!ids.length) ol.appendChild(el('div', { cls: 'allpaid' }, [el('b', { text: T.allPaid }), el('small', { text: T.allPaidSub })]));
    ids.forEach(function (id) {
      var b = buyers[id] || { name: T.unknownBuyer };
      var acts = el('div', { cls: 'acts' });
      if (b.phone) acts.appendChild(el('a', { cls: 'act', href: 'sms:' + String(b.phone).replace(/[^\d+]/g, ''), 'aria-label': T.textTo + b.name, text: T.text }));
      if (b.email) acts.appendChild(el('a', { cls: 'act', href: 'mailto:' + b.email, 'aria-label': T.emailTo + b.name, text: T.email }));
      ol.appendChild(el('div', { cls: 'buyer' }, [
        el('span', { cls: 'bav', text: initials(b.name) }),
        el('div', { cls: 'binfo' }, [el('b', { text: b.name }), el('small', { text: owing[id].n + (owing[id].n > 1 ? T.tickets : T.ticket) + ' · ' + money.format(owing[id].sum) })]),
        acts
      ]));
    });

    /* --- Coût récupéré + répartition --- */
    var cost = +d.team.cost || 0;
    var rec = $('#recoverBox');
    rec.hidden = !cost;
    if (cost) {
      var pct = Math.min(100, Math.round(revenue / cost * 100));
      $('#recoverBar').style.width = pct + '%';
      $('#recoverPct').textContent = pct + T.pct;
      $('#recoverTxt').textContent = money.format(revenue) + T.recovered + money.format(cost);
    }
    var counts = {};
    games.forEach(function (g) { (g.tickets || []).forEach(function (t) { counts[t.status] = (counts[t.status] || 0) + 1; }); });
    var total = Object.keys(counts).reduce(function (s, x) { return s + counts[x]; }, 0) || 1;
    var bar = clear($('#mixBar')), leg = clear($('#mixLegend'));
    Object.keys(STATUS_CLS).forEach(function (st) {
      if (!counts[st]) return;
      bar.appendChild(el('span', { cls: 'seg ' + STATUS_CLS[st], style: 'width:' + (counts[st] / total * 100) + '%', title: T.status[st] }));
      leg.appendChild(el('span', { cls: 'lg-item ' + STATUS_CLS[st] }, [el('i'), T.status[st] + ' ', el('b', { text: String(counts[st]) })]));
    });
  }

  function kpi(label, value, sub, tone) {
    return el('div', { cls: 'kpi ' + tone }, [el('small', { text: label }), el('b', { text: value }), el('span', { text: sub })]);
  }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function initials(n) { return String(n || '?').split(/\s+/).map(function (p) { return p.charAt(0); }).join('').slice(0, 2).toUpperCase(); }

  /* ================================================================ Paramètres */
  var backTo = 'dash';

  function openSettings() {
    var cur = document.querySelector('[data-state]:not([hidden])');
    backTo = cur ? cur.getAttribute('data-state') : 'dash';
    if (backTo === 'settings' || backTo === 'loading') backTo = state.teams.length ? 'dash' : 'empty';
    fillSettings();
    show('settings');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function closeSettings() {
    show(backTo);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function fillSettings() {
    var w = state.who || {};
    var av = $('#setAvatar');
    if (w.avatar && /^https:\/\//.test(w.avatar)) { av.src = w.avatar; av.hidden = false; $('#setAvatarFallback').hidden = true; }
    else { av.hidden = true; var f = $('#setAvatarFallback'); f.hidden = false; f.textContent = initials(w.name); }
    $('#setName').textContent = w.name || '—';
    $('#setLogin').textContent = w.login ? '@' + w.login : '';
    $('#setEmail').textContent = w.email || T.notSet;
    $('#prefName').value = state.prefs.name || '';
    $('#prefName').placeholder = ((state.teams[0] && state.teams[0].owner) || w.name || '').split(' ')[0];
    $('#prefLang').value = state.prefs.lang || LANG;
    $('#prefCurrency').value = state.prefs.currency || 'CAD';
    var sel = clear($('#prefTeam'));
    if (!state.teams.length) { sel.appendChild(el('option', { value: '', text: T.noTeams })); sel.disabled = true; }
    else {
      sel.disabled = false;
      sel.appendChild(el('option', { value: '', text: T.firstTeam }));
      state.teams.forEach(function (t) { sel.appendChild(el('option', { value: t._id || '', text: t.team.name || T.team })); });
      sel.value = state.prefs.team || '';
    }
    document.querySelectorAll('[data-demo-off]').forEach(function (b) { b.disabled = state.demo; b.title = state.demo ? T.demoOff : ''; });
    $('#demoNote').hidden = !state.demo;
    resetConfirms();
    msg('#prefMsg', '');
    msg('#dataMsg', '');
    msg('#acctMsg', '');
  }

  function msg(sel, text, bad) {
    var m = $(sel); m.textContent = text; m.classList.toggle('bad', !!bad); m.hidden = !text;
  }

  function savePrefs(e) {
    e.preventDefault();
    var p = {
      name: $('#prefName').value.trim().slice(0, 40),
      lang: $('#prefLang').value === 'en' ? 'en' : 'fr',
      currency: ['CAD', 'USD', 'EUR'].indexOf($('#prefCurrency').value) > -1 ? $('#prefCurrency').value : 'CAD',
      team: $('#prefTeam').value || ''
    };
    var langChanged = p.lang !== LANG;
    function applied(text) {
      state.prefs = p;
      setMoney(p.currency);
      if (state.teams.length) setData(state.teams);
      if (langChanged) {
        msg('#prefMsg', T.switching);
        try { localStorage.setItem('ts-open-settings', '1'); } catch (x) {}
        location.href = pageUrl(p.lang) + (state.demo ? '?demo=1' : '');
        return;
      }
      show('settings');
      msg('#prefMsg', text);
    }
    if (state.demo) { demoPrefs = p; applied(T.savedDemo); return; }
    var btn = $('#prefSave'); btn.disabled = true; msg('#prefMsg', T.saving);
    sb.auth.updateUser({ data: { ts_display_name: p.name, ts_lang: p.lang, ts_currency: p.currency, ts_default_team: p.team } })
      .then(function (r) {
        btn.disabled = false;
        if (r.error) throw r.error;
        if (r.data && r.data.user) state.user = r.data.user;
        applied(T.saved);
      }).catch(function (err) { btn.disabled = false; msg('#prefMsg', (err && err.message) || T.unknownErr, true); });
  }

  function exportData() {
    if (state.demo) return;
    var rows = state.rows || [];
    if (!rows.length) { msg('#dataMsg', T.nothingExport, true); return; }
    var blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), teams: rows }, null, 2)], { type: 'application/json' });
    var a = el('a', { href: URL.createObjectURL(blob), download: 'ticketstay-' + new Date().toISOString().slice(0, 10) + '.json' });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
    msg('#dataMsg', T.exported);
  }

  function resetConfirms() {
    document.querySelectorAll('.confirm').forEach(function (c) { c.hidden = true; });
    var inp = $('#delAcctWord'); if (inp) inp.value = '';
  }

  function deleteData() {
    if (state.demo) return;
    var b = $('#delDataYes'); b.disabled = true;
    sb.from('ts_snapshots').delete().eq('user_id', state.user.id).then(function (r) {
      b.disabled = false;
      if (r.error) throw r.error;
      state.teams = []; state.rows = [];
      resetConfirms();
      fillSettings();
      backTo = 'empty';
      msg('#dataMsg', T.dataDeleted);
    }).catch(function (err) { b.disabled = false; msg('#dataMsg', (err && err.message) || T.unknownErr, true); });
  }

  function deleteAccount() {
    if (state.demo) return;
    if ($('#delAcctWord').value.trim().toUpperCase() !== T.confirmWord) { msg('#acctMsg', T.typeToConfirm, true); return; }
    var b = $('#delAcctYes'); b.disabled = true;
    sb.rpc('delete_my_account').then(function (r) {
      if (r.error) throw r.error;
      return sb.auth.signOut().catch(function () {});
    }).then(function () {
      state.teams = []; state.user = null;
      $('#sessionBar').hidden = true;
      show('signin');
      var n = $('#goodbye'); if (n) { n.textContent = T.accountDeleted; n.hidden = false; }
    }).catch(function (err) { b.disabled = false; msg('#acctMsg', (err && err.message) || T.unknownErr, true); });
  }

  /* ================================================================ Démarrage */
  document.querySelectorAll('[data-demo]').forEach(function (b) { b.addEventListener('click', startDemo); });
  document.querySelectorAll('[data-open-settings]').forEach(function (b) { b.addEventListener('click', openSettings); });
  $('#demoExit').addEventListener('click', exitDemo);
  $('#retry').addEventListener('click', function () { if (configured) startCloud(); });
  $('#ghSignIn').addEventListener('click', signIn);
  $('#signOut').addEventListener('click', signOut);
  $('#settingsBack').addEventListener('click', closeSettings);
  $('#prefForm').addEventListener('submit', savePrefs);
  $('#exportBtn').addEventListener('click', exportData);
  $('#delDataBtn').addEventListener('click', function () { if (!state.demo) { resetConfirms(); $('#delDataConfirm').hidden = false; } });
  $('#delDataNo').addEventListener('click', resetConfirms);
  $('#delDataYes').addEventListener('click', deleteData);
  $('#delAcctBtn').addEventListener('click', function () { if (!state.demo) { resetConfirms(); $('#delAcctConfirm').hidden = false; $('#delAcctWord').focus(); } });
  $('#delAcctNo').addEventListener('click', resetConfirms);
  $('#delAcctYes').addEventListener('click', deleteAccount);

  /* Après un changement de langue dans les paramètres, rouvrir les paramètres */
  function reopenSettingsIfAsked() {
    var again = false;
    try { again = localStorage.getItem('ts-open-settings') === '1'; localStorage.removeItem('ts-open-settings'); } catch (e) {}
    if (!again) return;
    var tries = 0;
    (function wait() {
      var vis = document.querySelector('[data-state]:not([hidden])');
      var name = vis && vis.getAttribute('data-state');
      if (name === 'dash' || name === 'empty') openSettings();
      else if (tries++ < 40) setTimeout(wait, 150);
    })();
  }

  if (/[?&]demo=1/.test(location.search)) startDemo();
  else if (configured) startCloud();
  else show('setup');
  reopenSettingsIfAsked();
})();
