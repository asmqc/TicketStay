/* TicketStay — page « Mon compte »
 * Connexion avec GitHub (Supabase Auth) et lecture des données synchronisées
 * par l'app dans la table ts_snapshots (une ligne par équipe, voir supabase/schema.sql).
 * La sécurité par ligne (RLS) fait que chaque compte ne lit que ses propres lignes.
 */
(function () {
  'use strict';

  var cfg = window.TICKETSTAY_SUPABASE || {};
  var configured = !!(cfg.url && cfg.key);
  var sb = null;
  var state = { teams: [], team: 0, demo: false };
  var listening = false;

  var money = new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 });
  var dayFmt = new Intl.DateTimeFormat('fr-CA', { weekday: 'short' });
  var monFmt = new Intl.DateTimeFormat('fr-CA', { month: 'short' });
  var timeFmt = new Intl.DateTimeFormat('fr-CA', { hour: 'numeric', minute: '2-digit' });
  var longFmt = new Intl.DateTimeFormat('fr-CA', { weekday: 'long', day: 'numeric', month: 'long' });
  var syncFmt = new Intl.DateTimeFormat('fr-CA', { dateStyle: 'long', timeStyle: 'short' });

  var STATUS = {
    a_vendre: ['À vendre', 'sell'],
    vendu: ['Vendu', 'sold'],
    donne: ['Donné', 'gift'],
    utilise: ['Utilisé', 'used'],
    a_placer: ['À placer', 'todo']
  };

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
  }

  /* ================================================================ Supabase */
  function loadSupabase() {
    return new Promise(function (res, rej) {
      if (window.supabase && window.supabase.createClient) return res();
      var s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
      s.async = true;
      s.onload = function () { res(); };
      s.onerror = function () { rej(new Error('Le service de connexion ne répond pas. Vérifiez votre connexion Internet.')); };
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
          else if (event === 'SIGNED_IN' && session && !state.teams.length) onSignedIn(session.user);
        });
      }
      return sb.auth.getSession();
    }).then(function (r) {
      /* Nettoie l'adresse après le retour de GitHub (?code=…) */
      if (/[?&](code|error)=/.test(location.search)) {
        var q = new URLSearchParams(location.search);
        if (q.get('error_description')) throw new Error(q.get('error_description'));
        try { history.replaceState(null, '', location.pathname); } catch (e) {}
      }
      var session = r && r.data && r.data.session;
      if (r && r.error) throw r.error;
      if (session) onSignedIn(session.user); else onSignedOut();
    }).catch(onError);
  }

  function signIn() {
    var btn = $('#ghSignIn');
    btn.disabled = true;
    btn.classList.add('busy');
    sb.auth.signInWithOAuth({
      provider: cfg.provider || 'github',
      options: { redirectTo: location.origin + location.pathname }
    }).then(function (r) { if (r.error) throw r.error; }).catch(function (e) {
      btn.disabled = false; btn.classList.remove('busy'); onError(e);
    });
  }

  function signOut() {
    state.teams = [];
    sb.auth.signOut().then(onSignedOut, onSignedOut);
  }

  function onSignedOut() {
    $('#sessionBar').hidden = true;
    state.teams = [];
    var btn = $('#ghSignIn'); if (btn) { btn.disabled = false; btn.classList.remove('busy'); }
    show('signin');
  }

  function userLabel(u) {
    var m = (u && u.user_metadata) || {};
    return { name: m.full_name || m.name || m.user_name || m.preferred_username || u.email || '', login: m.user_name || m.preferred_username || '', avatar: m.avatar_url || '' };
  }

  function onSignedIn(user) {
    var who = userLabel(user);
    $('#sessionBar').hidden = false;
    $('#who').textContent = who.login ? who.name + ' (@' + who.login + ')' : who.name;
    var av = $('#whoAvatar');
    if (who.avatar && /^https:\/\//.test(who.avatar)) { av.src = who.avatar; av.hidden = false; } else av.hidden = true;
    fetchData(who);
  }

  function fetchData(who) {
    show('loading');
    sb.from('ts_snapshots').select('team_id, payload, updated_at').then(function (r) {
      if (r.error) throw r.error;
      var teams = (r.data || []).map(function (row) {
        var d = row.payload;
        if (typeof d === 'string') { try { d = JSON.parse(d); } catch (e) { d = null; } }
        if (d && !d.syncedAt && row.updated_at) d.syncedAt = row.updated_at;
        return d;
      }).filter(function (d) { return d && d.team; });
      if (!teams.length) { show('empty'); return; }
      teams.sort(function (a, b) { return (a.team.name || '').localeCompare(b.team.name || '', 'fr'); });
      var first = (teams[0].owner || who.name || '').split(' ')[0];
      setData(teams, first);
    }).catch(onError);
  }

  function onError(err) {
    var code = err && (err.code || err.status);
    var msg = (err && (err.message || err.error_description)) || 'Erreur inconnue.';
    /* Table pas encore créée : on affiche simplement un compte vide */
    if (code === '42P01' || code === 'PGRST205' || /relation .* does not exist|Could not find the table/i.test(msg)) { show('empty'); return; }
    if (/provider is not enabled|Unsupported provider/i.test(msg)) msg = 'La connexion GitHub n\'est pas encore activée pour ce site.';
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
    function team(name, sport, league, cost, opponents, seats, basePrice, startHour) {
      var now = new Date(); now.setHours(0, 0, 0, 0);
      var games = [];
      for (var i = -9; i < 11; i++) {
        var d = new Date(now.getTime() + (i * 4 + 1) * 86400000);
        d.setHours(startHour, i % 3 === 0 ? 0 : 30, 0, 0);
        var past = i < 0;
        var tickets = seats.map(function (seat, si) {
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
        version: 1, owner: 'Alex', syncedAt: new Date(Date.now() - 12 * 60000).toISOString(),
        team: { name: name, sport: sport, league: league, season: '2026-2027', cost: cost },
        games: games, buyers: buyers
      };
    }
    return [
      team('Les Harfangs', 'Hockey', 'Ligue démo', 4200, ['Les Loups', 'Les Faucons', 'Les Ours', 'Les Lynx', 'Les Orignaux'], ['Sec. 112 · R. F · S. 3', 'Sec. 112 · R. F · S. 4'], 85, 19),
      team('Les Castors', 'Basketball', 'Ligue démo', 2600, ['Les Aigles', 'Les Renards', 'Les Coyotes', 'Les Bisons'], ['Sec. 204 · R. B · S. 11', 'Sec. 204 · R. B · S. 12'], 60, 20)
    ];
  }

  function startDemo() {
    state.demo = true;
    $('#demoBar').hidden = false;
    $('#sessionBar').hidden = true;
    setData(demoData(), 'Alex');
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
  function setData(teams, name) {
    state.teams = teams;
    state.team = 0;
    $('#hello').textContent = name ? 'Bonjour ' + name : 'Bonjour';
    renderTabs();
    renderTeam();
    show('dash');
  }

  function renderTabs() {
    var box = clear($('#teamTabs'));
    box.hidden = state.teams.length < 2;
    state.teams.forEach(function (t, i) {
      var b = el('button', { type: 'button', cls: 'team-tab', role: 'tab', 'aria-selected': i === state.team ? 'true' : 'false' }, [
        el('b', { text: t.team.name || 'Équipe' }), el('small', { text: t.team.sport || t.team.league || '' })
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
    $('#synced').textContent = d.syncedAt ? 'Synchronisé le ' + syncFmt.format(new Date(d.syncedAt)) : '';

    /* --- Indicateurs --- */
    var next = upcoming[0];
    var owingCount = Object.keys(owing).length;
    var k = clear($('#kpis'));
    k.appendChild(kpi('Prochain match', next ? 'vs ' + next.opponent : 'Aucun', next ? cap(longFmt.format(new Date(next.date))) + ' · ' + timeFmt.format(new Date(next.date)) : 'Aucun match à venir', 'nxt'));
    k.appendChild(kpi('À recevoir', money.format(owed), owingCount ? owingCount + (owingCount > 1 ? ' acheteurs' : ' acheteur') : 'Tout est payé', owed ? 'owed' : 'ok'));
    k.appendChild(kpi('Revenus encaissés', money.format(revenue), 'Billets vendus et payés', 'rev'));
    k.appendChild(kpi('Billets à placer', String(toPlace), 'Pour les matchs à venir', toPlace ? 'todo' : 'ok'));

    /* --- Prochains matchs --- */
    var gl = clear($('#games'));
    if (!upcoming.length) gl.appendChild(el('p', { cls: 'muted', text: 'Aucun match à venir.' }));
    upcoming.slice(0, 6).forEach(function (g) {
      var dt = new Date(g.date);
      var pills = el('div', { cls: 'pills' });
      (g.tickets || []).forEach(function (t) {
        var s = STATUS[t.status] || [t.status, 'todo'];
        var who = t.buyer && buyers[t.buyer] ? buyers[t.buyer].name : '';
        pills.appendChild(el('span', { cls: 'pill ' + s[1], title: [t.seat, who].filter(Boolean).join(' — ') }, [
          s[0] + (t.status === 'vendu' && t.paid === false ? ' · non payé' : '')
        ]));
      });
      gl.appendChild(el('div', { cls: 'game' }, [
        el('div', { cls: 'gdate' }, [el('b', { text: String(dt.getDate()) }), el('small', { text: monFmt.format(dt).replace('.', '') })]),
        el('div', { cls: 'ginfo' }, [
          el('b', { text: (g.home === false ? '@ ' : 'vs ') + (g.opponent || 'Adversaire') }),
          el('small', { text: cap(dayFmt.format(dt)).replace('.', '') + ' · ' + timeFmt.format(dt) }),
          pills
        ])
      ]));
    });

    /* --- Qui doit encore payer --- */
    var ol = clear($('#owing'));
    var ids = Object.keys(owing).sort(function (a, b) { return owing[b].sum - owing[a].sum; });
    if (!ids.length) ol.appendChild(el('div', { cls: 'allpaid' }, [el('b', { text: 'Tout le monde a payé' }), el('small', { text: 'Personne ne vous doit d\'argent pour cette équipe.' })]));
    ids.forEach(function (id) {
      var b = buyers[id] || { name: 'Acheteur inconnu' };
      var acts = el('div', { cls: 'acts' });
      if (b.phone) acts.appendChild(el('a', { cls: 'act', href: 'sms:' + String(b.phone).replace(/[^\d+]/g, ''), 'aria-label': 'Texto à ' + b.name, text: 'Texto' }));
      if (b.email) acts.appendChild(el('a', { cls: 'act', href: 'mailto:' + b.email, 'aria-label': 'Courriel à ' + b.name, text: 'Courriel' }));
      ol.appendChild(el('div', { cls: 'buyer' }, [
        el('span', { cls: 'bav', text: initials(b.name) }),
        el('div', { cls: 'binfo' }, [el('b', { text: b.name }), el('small', { text: owing[id].n + (owing[id].n > 1 ? ' billets' : ' billet') + ' · ' + money.format(owing[id].sum) })]),
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
      $('#recoverPct').textContent = pct + ' %';
      $('#recoverTxt').textContent = money.format(revenue) + ' récupérés sur ' + money.format(cost);
    }
    var counts = {};
    games.forEach(function (g) { (g.tickets || []).forEach(function (t) { counts[t.status] = (counts[t.status] || 0) + 1; }); });
    var total = Object.keys(counts).reduce(function (s, x) { return s + counts[x]; }, 0) || 1;
    var bar = clear($('#mixBar')), leg = clear($('#mixLegend'));
    Object.keys(STATUS).forEach(function (st) {
      if (!counts[st]) return;
      bar.appendChild(el('span', { cls: 'seg ' + STATUS[st][1], style: 'width:' + (counts[st] / total * 100) + '%', title: STATUS[st][0] }));
      leg.appendChild(el('span', { cls: 'lg-item ' + STATUS[st][1] }, [el('i'), STATUS[st][0] + ' ', el('b', { text: String(counts[st]) })]));
    });
  }

  function kpi(label, value, sub, tone) {
    return el('div', { cls: 'kpi ' + tone }, [el('small', { text: label }), el('b', { text: value }), el('span', { text: sub })]);
  }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function initials(n) { return String(n || '?').split(/\s+/).map(function (p) { return p.charAt(0); }).join('').slice(0, 2).toUpperCase(); }

  /* ================================================================ Démarrage */
  document.querySelectorAll('[data-demo]').forEach(function (b) { b.addEventListener('click', startDemo); });
  $('#demoExit').addEventListener('click', exitDemo);
  $('#retry').addEventListener('click', function () { if (configured) startCloud(); });
  $('#ghSignIn').addEventListener('click', signIn);
  $('#signOut').addEventListener('click', signOut);

  if (/[?&]demo=1/.test(location.search)) startDemo();
  else if (configured) startCloud();
  else show('setup');
})();
