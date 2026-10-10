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
      status: { a_vendre: 'À vendre', vendu: 'Vendu', donne: 'Donné', utilise: 'Utilisé', a_placer: 'À placer', non_utilise: 'Non utilisé' },
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
      switching: 'Ouverture de la version anglaise…',
      whereLocal: 'gardée seulement dans ce navigateur. Connectez-vous avec GitHub pour la retrouver partout.',
      cloudSaving: 'enregistrement dans votre compte GitHub…', cloudSaved: 'enregistrée dans votre compte GitHub.',
      cloudError: 'pas encore enregistrée dans votre compte (connexion?) : gardée dans ce navigateur, nouvel essai à la prochaine modification.',
      colon: ' : ', bCost: 'Coût de l\'abonnement', bCollected: 'Encaissé', bPending: 'En attente', bPerTicket: 'Coût payé par billet',
      bBest: 'Meilleure vente', bNetUsed: 'Coût net par match vu', bGames: 'Matchs inscrits', bUpcomingN: '%@ à venir',
      bNoCost: 'Inscrivez le coût de votre abonnement (+ Équipe ou dans l\'app) pour suivre votre remboursement.',
      bPaidBack: 'Abonnement remboursé, avec un profit de %@.', bLeft: 'Il reste %@ à récupérer.',
      bNoSales: 'Aucune vente enregistrée.', pTitle: '%@ — Rapport de saison', pGenerated: 'Généré le %@', pHolder: 'Détenteur : %@',
      pBalance: 'Solde : %@', pToCollect: 'à recevoir', pDate: 'Date', opponentWord: 'Adversaire', pPerson: 'Personne', pPrice: 'Prix',
      pAll: 'Total de toutes les équipes', pFoot: 'Rapport produit par %@. À usage personnel — ce document n\'est pas un reçu officiel.',
      copiedApp: 'Copié! Ouvrez l\'app TicketStay pour le coller.', copyManual: 'Sélectionnez le texte et copiez-le à la main.',
      txtHi: 'Salut!', txtHiName: 'Salut %@!', txtReminder: 'Petit rappel pour les billets : il reste %@ à régler.',
      txtInterac: 'Virement Interac à : %@', txtInteracConfirm: 'Je te confirme les coordonnées pour le virement Interac.', txtThanks: 'Merci!',
      txtFor: '%@ pour %@, %@ à %@', txtYourN: 'Tes %@ billets', txtYour1: 'Ton billet', txtSection: 'Section %@', txtRow: 'Rangée %@',
      txtPriceN: 'Prix : %@ pour les %@, soit %@ chacun.', txtPrice1: 'Prix : %@.',
      txtSteps: ['Pour recevoir les billets :', '1. Confirme-moi l\'adresse courriel à utiliser.', '2. Je transfère les billets à cette adresse depuis Ticketmaster.', '3. Tu reçois un courriel de Ticketmaster annonçant un transfert de billets. Ouvre-le et touche « Accepter les billets ».', '4. Il faut un compte Ticketmaster avec cette même adresse courriel. C\'est gratuit et ça prend deux minutes si tu n\'en as pas.', '5. Les billets apparaissent ensuite dans ton compte, dans « Mes billets ».'],
      txtImportant: 'Important : garde-les dans l\'application Ticketmaster. Le code-barres change constamment, alors une capture d\'écran ou un PDF ne passe pas à l\'entrée.',
      txtTextMe: 'Texte-moi quand tu les as reçus, juste pour être sûrs.', txtGoodGame: 'Bonne game! %@',
      nPerson1: '%@ personne', nPersons: '%@ personnes', owedTotal: '%@ à recevoir',
      emptyBook: 'Carnet vide. Ajoutez les personnes à qui vous vendez habituellement, ou inscrivez un acheteur sur un billet vendu.',
      bought1: '%@ billet acheté (%@)', boughtN: '%@ billets achetés (%@)', given1: '%@ billet donné', givenN: '%@ billets donnés',
      noTickets: 'Aucun billet pour l\'instant', nextOn: 'Prochain match : %@', remind: 'Relancer', markPaid: 'Payé', edit: 'Modifier',
      owes: 'Doit encore %@', savedShort: 'Enregistré.', newBuyer: 'Nouvel acheteur', nameNeeded: 'Inscrivez le nom de la personne.',
      nameTaken: 'Une personne porte déjà ce nom dans le carnet.', transferText: 'Texto de transfert',
      needPhone: 'Ajoutez le téléphone de l\'acheteur pour lui texter.',
      seasonDefault: 'Saison 2026-2027', teamNameNeeded: 'Inscrivez le nom de l\'équipe.',
      noGamesYet: 'Aucun match pour l\'instant. Ajoutez le premier avec le bouton ci-dessus.',
      upcoming: 'À venir', past: 'Passés', newGame: 'Nouveau match', statusLabel: 'Statut', seatLabel: 'Siège',
      seatWord: 'Siège', removeSeat: 'Retirer ce siège', priceLabel: 'Prix obtenu', personPh: 'Nom de la personne',
      soldTo: 'Vendu à', givenTo: 'Donné à', phoneLabel: 'Téléphone', emailLabel: 'Courriel', optional: 'facultatif',
      paidLabel: 'Payé — l\'argent est rentré', noSeats: 'Aucun siège. Ajoutez-en un.',
      oppNeeded: 'Inscrivez l\'adversaire.', dateNeeded: 'Choisissez la date et l\'heure du match.',
      personNeeded: 'Vendu et Donné demandent le nom de la personne.',
      pasteEmpty: 'Collez d\'abord le texte copié dans l\'app.',
      pasteBad: 'Ce texte ne ressemble pas aux données de l\'app TicketStay. Dans l\'app, utilisez Réglages → Partager la saison → Envoyer les données → Copier, puis collez tout le texte.',
      pasteNoTeam: 'Les données ont été lues, mais elles ne contiennent aucune équipe.',
      importNote: 'Données de l\'app : vos préférences sont gardées dans ce navigateur seulement. L\'export et la suppression en ligne ne s\'appliquent pas.',
      importSaved: 'Préférences gardées dans ce navigateur.',
      seat: ['Sec. ', 'R. '],
      custom: 'Ma ligue'
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
      status: { a_vendre: 'For sale', vendu: 'Sold', donne: 'Given away', utilise: 'Used', a_placer: 'To assign', non_utilise: 'Not used' },
      demoLeague: 'Demo league',
      demoTeams: [['Snowy Owls', ['Wolves', 'Falcons', 'Bears', 'Lynx', 'Moose']], ['Beavers', ['Eagles', 'Foxes', 'Coyotes', 'Bison']]],
      saved: 'Settings saved.', savedDemo: 'Demo mode: settings are not saved.',
      saving: 'Saving…', demoOff: 'Not available in demo mode.',
      exported: 'File downloaded.', nothingExport: 'No synced data to export.',
      dataDeleted: 'Your synced data has been deleted.',
      accountDeleted: 'Your account has been deleted.', confirmWord: 'DELETE',
      typeToConfirm: 'Type DELETE to confirm.',
      notSet: 'Not provided by GitHub', firstTeam: 'First team (alphabetical)', noTeams: 'No synced teams',
      switching: 'Opening the French version…',
      whereLocal: 'kept only in this browser. Sign in with GitHub to find it everywhere.',
      cloudSaving: 'saving to your GitHub account…', cloudSaved: 'saved to your GitHub account.',
      cloudError: 'not saved to your account yet (connection?): kept in this browser, will retry on the next change.',
      colon: ': ', bCost: 'Season ticket cost', bCollected: 'Collected', bPending: 'Pending', bPerTicket: 'Cost paid per ticket',
      bBest: 'Best sale', bNetUsed: 'Net cost per game attended', bGames: 'Games entered', bUpcomingN: '%@ upcoming',
      bNoCost: 'Enter the cost of your season tickets (+ Team or in the app) to track how much you\'ve recovered.',
      bPaidBack: 'Season tickets paid back, with a profit of %@.', bLeft: 'You still have %@ to recover.',
      bNoSales: 'No sales recorded.', pTitle: '%@ — Season report', pGenerated: 'Generated on %@', pHolder: 'Holder: %@',
      pBalance: 'Balance: %@', pToCollect: 'to collect', pDate: 'Date', opponentWord: 'Opponent', pPerson: 'Person', pPrice: 'Price',
      pAll: 'Total for all teams', pFoot: 'Report produced by %@. For personal use — this document is not an official receipt.',
      copiedApp: 'Copied! Open the TicketStay app to paste it.', copyManual: 'Select the text and copy it by hand.',
      txtHi: 'Hi!', txtHiName: 'Hi %@!', txtReminder: 'Quick reminder about the tickets: %@ is still owing.',
      txtInterac: 'Interac e-Transfer to: %@', txtInteracConfirm: 'Confirming the details for the Interac e-Transfer.', txtThanks: 'Thanks!',
      txtFor: '%@ for %@, %@ at %@', txtYourN: 'Your %@ tickets', txtYour1: 'Your ticket', txtSection: 'Section %@', txtRow: 'Row %@',
      txtPriceN: 'Price: %@ for the %@, so %@ each.', txtPrice1: 'Price: %@.',
      txtSteps: ['To receive the tickets:', '1. Confirm the email address to use.', '2. I transfer the tickets to that address from Ticketmaster.', '3. You get an email from Ticketmaster announcing a ticket transfer. Open it and tap “Accept tickets”.', '4. You need a Ticketmaster account with that same email address. It\'s free and takes two minutes if you don\'t have one.', '5. The tickets then show up in your account, under “My Tickets”.'],
      txtImportant: 'Important: keep them in the Ticketmaster app. The barcode changes constantly, so a screenshot or a PDF won\'t get you in.',
      txtTextMe: 'Text me when you get them, just to be sure.', txtGoodGame: 'Enjoy the game! %@',
      nPerson1: '%@ person', nPersons: '%@ people', owedTotal: '%@ owed to you',
      emptyBook: 'Empty contact book. Add the people you usually sell to, or enter a buyer on a sold ticket.',
      bought1: '%@ ticket bought (%@)', boughtN: '%@ tickets bought (%@)', given1: '%@ ticket given', givenN: '%@ tickets given',
      noTickets: 'No tickets yet', nextOn: 'Next game: %@', remind: 'Remind', markPaid: 'Paid', edit: 'Edit',
      owes: 'Still owes %@', savedShort: 'Saved.', newBuyer: 'New buyer', nameNeeded: 'Enter the person\'s name.',
      nameTaken: 'Someone with this name is already in the contact book.', transferText: 'Transfer text',
      needPhone: 'Add the buyer\'s phone number to text them.',
      seasonDefault: '2026-2027 Season', teamNameNeeded: 'Enter the team name.',
      noGamesYet: 'No games yet. Add the first one with the button above.',
      upcoming: 'Upcoming', past: 'Past', newGame: 'New game', statusLabel: 'Status', seatLabel: 'Seat',
      seatWord: 'Seat', removeSeat: 'Remove this seat', priceLabel: 'Price received', personPh: 'Person\'s name',
      soldTo: 'Sold to', givenTo: 'Given to', phoneLabel: 'Phone', emailLabel: 'Email', optional: 'optional',
      paidLabel: 'Paid — the money is in', noSeats: 'No seats. Add one.',
      oppNeeded: 'Enter the opponent.', dateNeeded: 'Choose the game date and time.',
      personNeeded: 'Sold and Given away need the person\'s name.',
      pasteEmpty: 'First paste the text copied in the app.',
      pasteBad: 'This text doesn\'t look like TicketStay app data. In the app, use Settings → Share the season → Send the data → Copy, then paste all of the text.',
      pasteNoTeam: 'The data was read, but it contains no team.',
      importNote: 'App data: your preferences are kept in this browser only. Online export and deletion don\'t apply.',
      importSaved: 'Preferences kept in this browser.',
      seat: ['Sec. ', 'Row '],
      custom: 'My league'
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

  var STATUS_CLS = { a_vendre: 'sell', vendu: 'sold', donne: 'gift', utilise: 'used', a_placer: 'todo', non_utilise: 'used' };

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
    if (state.demo && !state.imported) { exitDemo(); return; }
    try { localStorage.removeItem(CLE_IMPORT); localStorage.removeItem(CLE_IMPORT_V1); } catch (e) {}
    state.archive = null; state.imported = false; state.demo = false;
    $('#importBar').hidden = true;
    sb.auth.signOut().then(onSignedOut, onSignedOut);
  }

  function onSignedOut() {
    $('#sessionBar').hidden = true;
    state.teams = []; state.user = null;
    var btn = $('#ghSignIn'); if (btn) { btn.disabled = false; btn.classList.remove('busy'); }
    var locale = importGarde();
    if (locale) { startImport(locale); return; }
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
    fetchSaison();
  }

  /* Saison enregistrée dans le compte GitHub (table ts_saisons, une ligne par compte). */
  function fetchSaison() {
    show('loading');
    sb.from('ts_saisons').select('archive, updated_at').maybeSingle().then(function (r) {
      if (r.error) throw r.error;
      var locale = importGarde();
      if (r.data && r.data.archive && Array.isArray(r.data.archive.abonnements)) {
        startImport(r.data.archive);
        try { localStorage.setItem(CLE_IMPORT, JSON.stringify(r.data.archive)); } catch (e) {}
      } else if (locale) {
        /* Première connexion : la saison de ce navigateur part dans le compte. */
        startImport(locale);
        sauverNuage();
      } else fetchData();
    }).catch(function (err) {
      var code = err && (err.code || err.status);
      if (code === '42P01' || code === 'PGRST205' || /Could not find the table|does not exist/i.test((err && err.message) || '')) { fetchData(); return; }
      onError(err);
    });
  }

  var minuterieNuage = null;
  function sauverNuage() {
    if (!state.user || !sb || !state.archive) return;
    clearTimeout(minuterieNuage);
    statutSaison(T.cloudSaving);
    minuterieNuage = setTimeout(function () {
      var a = JSON.parse(JSON.stringify(state.archive));
      sb.from('ts_saisons').upsert({ user_id: state.user.id, archive: a }).then(function (r) {
        if (r.error) throw r.error;
        statutSaison(T.cloudSaved);
      }).catch(function () { statutSaison(T.cloudError, true); });
    }, 700);
  }

  function statutSaison(texte, mauvais) {
    var s = $('#importWhere');
    if (!s) return;
    s.textContent = texte;
    s.classList.toggle('bad', !!mauvais);
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
    if (!state.imported && importGarde()) { startImport(importGarde()); return; }
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
    state.imported = false;
    $('#importBar').hidden = true;
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


  /* ================================================================ Ma saison sur le site
   * Les données viennent de l'app (Réglages → Partager la saison → Envoyer les
   * données → Copier) ou sont créées ici. Elles sont gardées au format de
   * l'app, sans NIP, photo ni emblèmes, et seulement dans ce navigateur.
   * Rien n'est envoyé sur Internet. */
  var CLE_IMPORT = 'ts-saison-v2';
  var CLE_IMPORT_V1 = 'ts-import-v1';
  var CLE_IMPORT_PREFS = 'ts-import-prefs';
  var LIGUES = {
    lnh: ['LNH', 'NHL', 'Hockey'], lah: ['LAH', 'AHL', 'Hockey'], lphf: ['LPHF', 'PWHL', 'Hockey'],
    echl: ['ECHL', 'ECHL', 'Hockey'], sphl: ['SPHL', 'SPHL', 'Hockey'], lhjmq: ['LHJMQ', 'QMJHL', 'Hockey'],
    ohl: ['OHL', 'OHL', 'Hockey'], whl: ['WHL', 'WHL', 'Hockey'],
    nba: ['NBA', 'NBA', 'Basketball'], wnba: ['WNBA', 'WNBA', 'Basketball'], gleague: ['G League', 'G League', 'Basketball'],
    cebl: ['CEBL', 'CEBL', 'Basketball'], mlb: ['MLB', 'MLB', 'Baseball'], aaa: ['AAA', 'AAA', 'Baseball'],
    nfl: ['NFL', 'NFL', 'Football'], lcf: ['LCF', 'CFL', 'Football'], ufl: ['UFL', 'UFL', 'Football'],
    mls: ['MLS', 'MLS', 'Soccer'], nwsl: ['NWSL', 'NWSL', 'Soccer'], usl: ['USL', 'USL', 'Soccer'],
    cpl: ['PLC', 'CPL', 'Soccer'], nll: ['NLL', 'NLL', 'Crosse']
  };
  /* Valeurs exactes enregistrées par l'app (ne pas traduire). */
  var STATUT_APP = { 'À placer': 'a_placer', 'À vendre': 'a_vendre', 'Utilisé': 'utilise', 'Vendu': 'vendu', 'Donné': 'donne', 'Non utilisé': 'non_utilise' };
  var STATUT_VERS_APP = {};
  Object.keys(STATUT_APP).forEach(function (k) { STATUT_VERS_APP[STATUT_APP[k]] = k; });
  var ORDRE_STATUTS = ['a_placer', 'a_vendre', 'vendu', 'donne', 'utilise', 'non_utilise'];

  function cle(s) { return String(s || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function nomSport(s) { return LANG === 'en' && s === 'Crosse' ? 'Lacrosse' : s; }
  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID().toUpperCase();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16);
    }).toUpperCase();
  }
  /* Format de date lu par l'app : ISO 8601 sans millisecondes. */
  function isoApp(d) { return d.toISOString().replace(/\.\d{3}Z$/, 'Z'); }
  function pourChampDate(iso) {
    var d = new Date(iso); if (isNaN(d)) d = new Date();
    var p = function (n) { return String(n).padStart(2, '0'); };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + 'T' + p(d.getHours()) + ':' + p(d.getMinutes());
  }

  /* Retire ce qui n'a rien à faire dans un navigateur. */
  function nettoyer(a) {
    delete a.nip;
    delete a.emblemes;
    if (a.compte) delete a.compte.photo;
    return a;
  }

  function lireApp(texte) {
    var a;
    try { a = JSON.parse(String(texte).trim().replace(/^[^{]*/, '').replace(/[^}]*$/, '')); }
    catch (e) { throw new Error(T.pasteBad); }
    if (!a || typeof a !== 'object') throw new Error(T.pasteBad);
    if (!Array.isArray(a.abonnements)) {
      if (!(a.reglages || a.matchs)) throw new Error(T.pasteBad);
      a = { abonnements: [{ id: uuid(), reglages: a.reglages || {}, matchs: a.matchs || [], favori: true }] };
    }
    if (!a.abonnements.length) throw new Error(T.pasteNoTeam);
    return nettoyer(a);
  }

  /* Archive de l'app → équipes affichées par le tableau de bord. */
  function equipesDe(a) {
    var carnet = {};
    (a.carnet || []).forEach(function (c) { if (c && c.nom) carnet[cle(c.nom)] = c; });
    var owner = (a.compte && a.compte.nom) || '';
    var equipes = a.abonnements.map(function (ab, i) {
      var r = ab.reglages || {};
      var lg = LIGUES[r.ligueID];
      var parNom = {}, liste = [];
      function acheteur(nom, tel, courriel) {
        var k = cle(nom);
        if (!k) return null;
        if (!parNom[k]) {
          var c = carnet[k] || {};
          parNom[k] = { id: 'b' + liste.length, name: String(nom).trim(), phone: tel || c.telephone || '', email: courriel || c.courriel || '' };
          liste.push(parNom[k]);
        } else {
          if (!parNom[k].phone && tel) parNom[k].phone = tel;
          if (!parNom[k].email && courriel) parNom[k].email = courriel;
        }
        return parNom[k].id;
      }
      var games = (ab.matchs || []).map(function (m, mi) {
        return {
          _mi: mi, date: m.date, opponent: m.adversaire || '', home: m.domicile !== false,
          tickets: (m.billets || []).map(function (b) {
            var st = STATUT_APP[b.statut] || 'a_placer';
            var seat = [m.section ? T.seat[0] + m.section : '', m.rangee ? T.seat[1] + m.rangee : '', b.siege || ''].filter(Boolean).join(' · ');
            return {
              seat: seat, status: st, price: +b.prixVente || 0,
              buyer: (st === 'vendu' || st === 'donne') ? acheteur(b.personne, b.telephone, b.courriel) : null,
              paid: st !== 'vendu' || !!b.paye
            };
          })
        };
      });
      return {
        _id: ab.id || ('app-' + i), _ai: i, version: 1, owner: owner, syncedAt: a._modifie || null, favori: !!ab.favori,
        team: {
          name: r.equipe || T.team,
          sport: nomSport(lg ? lg[2] : (r.sportPerso || '')),
          league: lg ? lg[LANG === 'en' ? 1 : 0] : T.custom,
          season: r.nomSaison || '', cost: +r.coutAbonnement || 0
        },
        games: games, buyers: liste
      };
    });
    equipes.sort(function (x, y) { return (y.favori ? 1 : 0) - (x.favori ? 1 : 0); });
    return equipes;
  }

  function garder() {
    state.archive._modifie = isoApp(new Date());
    try {
      localStorage.setItem(CLE_IMPORT, JSON.stringify(state.archive));
      localStorage.removeItem(CLE_IMPORT_V1);
    } catch (e) {}
    $('#importDate').textContent = syncFmt.format(new Date(state.archive._modifie));
    sauverNuage();
  }

  function importGarde() {
    try {
      var s = localStorage.getItem(CLE_IMPORT);
      var a = s ? JSON.parse(s) : null;
      return a && Array.isArray(a.abonnements) ? a : null;
    } catch (e) { return null; }
  }

  function ouvrirCollage() {
    msg('#pasteMsg', '');
    show('paste');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(function () { var z = $('#pasteText'); if (z) z.focus(); }, 300);
  }

  function validerCollage() {
    var texte = $('#pasteText').value;
    if (!texte.trim()) { msg('#pasteMsg', T.pasteEmpty, true); return; }
    var archive;
    try { archive = lireApp(texte); } catch (e) { msg('#pasteMsg', e.message, true); return; }
    $('#pasteText').value = '';
    state.archive = archive;
    garder();
    startImport(archive);
  }

  function annulerCollage() {
    if (state.teams.length) show('dash');
    else if (state.demo) startDemo();
    else if (configured) startCloud();
    else show('setup');
  }

  function startImport(archive) {
    state.archive = archive;
    state.imported = true;
    state.demo = !state.user;
    if (!state.user) {
      state.who = { name: (archive.compte && archive.compte.nom) || '', login: '', avatar: '', email: (archive.compte && archive.compte.courriel) || '' };
      var p = {};
      try { p = JSON.parse(localStorage.getItem(CLE_IMPORT_PREFS) || '{}') || {}; } catch (e) {}
      state.prefs = Object.assign({ name: '', lang: '', currency: 'CAD', team: '' }, p);
      setMoney(state.prefs.currency);
    }
    $('#demoBar').hidden = true;
    $('#sessionBar').hidden = !state.user;
    $('#importBar').hidden = false;
    $('#importClear').hidden = !!state.user;
    statutSaison(state.user ? T.cloudSaved : T.whereLocal);
    $('#importDate').textContent = archive._modifie ? syncFmt.format(new Date(archive._modifie)) : '';
    try { history.replaceState(null, '', location.pathname); } catch (e) {}
    setData(equipesDe(archive));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function effacerImport() {
    try {
      localStorage.removeItem(CLE_IMPORT); localStorage.removeItem(CLE_IMPORT_V1); localStorage.removeItem(CLE_IMPORT_PREFS);
    } catch (e) {}
    state.imported = false;
    state.demo = false;
    state.archive = null;
    state.teams = [];
    $('#importBar').hidden = true;
    resetConfirms();
    if (configured) startCloud(); else show('setup');
  }

  /* Recalcule l'affichage après une modification, en restant sur la même équipe. */
  function rafraichir() {
    var ai = state.teams[state.team] ? state.teams[state.team]._ai : 0;
    state.teams = equipesDe(state.archive);
    var idx = 0;
    state.teams.forEach(function (t, i) { if (t._ai === ai) idx = i; });
    state.team = idx;
    renderTabs();
    renderTeam();
  }

  function abonnementCourant() {
    var t = state.teams[state.team];
    return state.archive.abonnements[t ? t._ai : 0];
  }

  /* ---------- Nouvelle saison créée sur le site ---------- */
  function ouvrirEquipe() {
    var sel = clear($('#ntLeague'));
    Object.keys(LIGUES).forEach(function (id) { sel.appendChild(el('option', { value: id, text: LIGUES[id][LANG === 'en' ? 1 : 0] + ' · ' + nomSport(LIGUES[id][2]) })); });
    sel.appendChild(el('option', { value: 'perso', text: T.custom }));
    sel.value = 'lnh';
    $('#ntName').value = '';
    $('#ntSeason').value = T.seasonDefault;
    $('#ntCost').value = '';
    $('#ntSection').value = '';
    $('#ntRow').value = '';
    $('#ntSeats').value = '2';
    msg('#ntMsg', '');
    show('team');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function creerEquipe(e) {
    e.preventDefault();
    var nom = $('#ntName').value.trim();
    if (!nom) { msg('#ntMsg', T.teamNameNeeded, true); $('#ntName').focus(); return; }
    var nb = Math.max(1, Math.min(12, parseInt($('#ntSeats').value, 10) || 2));
    var ab = {
      id: uuid(), favori: !state.archive || !state.archive.abonnements.length, matchs: [],
      reglages: {
        configure: true, ligueID: $('#ntLeague').value, equipe: nom,
        nomSaison: $('#ntSeason').value.trim() || T.seasonDefault,
        coutAbonnement: Math.max(0, parseFloat(String($('#ntCost').value).replace(',', '.')) || 0),
        sectionParDefaut: $('#ntSection').value.trim(), rangeeParDefaut: $('#ntRow').value.trim(),
        nbSiegesParDefaut: nb, prixVenteParDefaut: 0, amphitheatre: ''
      }
    };
    if (!state.archive) state.archive = { abonnements: [], carnet: [], compte: { nom: '', courriel: '', telephone: '', interac: '', cree: true }, equipesPersos: {}, versionVue: '' };
    state.archive.abonnements.push(ab);
    garder();
    startImport(state.archive);
    var t = 0; state.teams.forEach(function (x, i) { if (x._ai === state.archive.abonnements.length - 1) t = i; });
    state.team = t; renderTabs(); renderTeam();
  }

  /* ---------- Liste de tous les matchs ---------- */
  function ouvrirMatchs() {
    var ab = abonnementCourant();
    $('#matchesTitle').textContent = (ab.reglages && ab.reglages.equipe) || T.team;
    var liste = clear($('#matchesList'));
    var tous = (ab.matchs || []).map(function (m, mi) { return { m: m, mi: mi, d: new Date(m.date) }; })
      .sort(function (x, y) { return x.d - y.d; });
    var auj = new Date(); auj.setHours(0, 0, 0, 0);
    var aVenir = tous.filter(function (x) { return x.d >= auj; });
    var passes = tous.filter(function (x) { return x.d < auj; }).reverse();
    if (!tous.length) liste.appendChild(el('p', { cls: 'muted', text: T.noGamesYet }));
    [[T.upcoming, aVenir], [T.past, passes]].forEach(function (groupe) {
      if (!groupe[1].length) return;
      liste.appendChild(el('h3', { cls: 'm-group', text: groupe[0] + ' · ' + groupe[1].length }));
      groupe[1].forEach(function (x) { liste.appendChild(ligneMatch(x.m, x.mi)); });
    });
    show('matches');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function ligneMatch(m, mi) {
    var dt = new Date(m.date);
    var pills = el('div', { cls: 'pills' });
    (m.billets || []).forEach(function (b) {
      var st = STATUT_APP[b.statut] || 'a_placer';
      pills.appendChild(el('span', { cls: 'pill ' + STATUS_CLS[st] }, [T.status[st] + (st === 'vendu' && !b.paye ? T.unpaid : '')]));
    });
    var b = el('button', { type: 'button', cls: 'game game-btn' }, [
      el('div', { cls: 'gdate' }, [el('b', { text: String(dt.getDate()) }), el('small', { text: monFmt.format(dt).replace('.', '') })]),
      el('div', { cls: 'ginfo' }, [
        el('b', { text: (m.domicile === false ? '@ ' : 'vs ') + (m.adversaire || T.opponent) }),
        el('small', { text: cap(dayFmt.format(dt)).replace('.', '') + ' · ' + timeFmt.format(dt) }),
        pills
      ]),
      el('span', { cls: 'chev', 'aria-hidden': 'true', text: '›' })
    ]);
    b.addEventListener('click', function () { ouvrirMatch(mi); });
    return b;
  }

  /* ---------- Éditeur d'un match ---------- */
  var edition = null;   // { mi: index ou -1, billets: [...] }

  function ouvrirMatch(mi) {
    var ab = abonnementCourant();
    var r = ab.reglages || {};
    var m = mi >= 0 ? ab.matchs[mi] : null;
    var date;
    if (m) date = m.date;
    else { var d = new Date(); d.setDate(d.getDate() + 1); d.setHours(19, 0, 0, 0); date = isoApp(d); }
    edition = {
      mi: m ? mi : -1,
      billets: m ? JSON.parse(JSON.stringify(m.billets || [])) : Array.from({ length: Math.max(1, +r.nbSiegesParDefaut || 2) }, function (_, i) {
        return { id: uuid(), siege: T.seatWord + ' ' + (i + 1), statut: 'À placer', prixVente: 0, personne: '', courriel: '', telephone: '', paye: false };
      })
    };
    $('#matchHeading').textContent = m ? (m.domicile === false ? '@ ' : 'vs ') + (m.adversaire || T.opponent) : T.newGame;
    $('#mDate').value = pourChampDate(date);
    $('#mOpp').value = m ? (m.adversaire || '') : '';
    $('#mHome').value = m && m.domicile === false ? 'non' : 'oui';
    $('#mSection').value = m ? (m.section || '') : (r.sectionParDefaut || '');
    $('#mRow').value = m ? (m.rangee || '') : (r.rangeeParDefaut || '');
    $('#mNotes').value = m ? (m.notes || '') : '';
    var dl = clear($('#oppList'));
    var vus = {};
    state.archive.abonnements.forEach(function (a) { (a.matchs || []).forEach(function (x) { if (x.adversaire && !vus[x.adversaire]) { vus[x.adversaire] = 1; dl.appendChild(el('option', { value: x.adversaire })); } }); });
    $('#mDelete').hidden = !m;
    $('#mDelConfirm').hidden = true;
    msg('#matchMsg', '');
    dessinerBillets();
    show('match');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (!m) setTimeout(function () { $('#mOpp').focus(); }, 300);
  }

  function dessinerBillets() {
    var box = clear($('#mSeats'));
    edition.billets.forEach(function (b, i) {
      var st = STATUT_APP[b.statut] || 'a_placer';
      var choix = el('select', { 'aria-label': T.statusLabel });
      ORDRE_STATUTS.forEach(function (s) { var o = el('option', { value: s, text: T.status[s] }); if (s === st) o.selected = true; choix.appendChild(o); });
      choix.addEventListener('change', function () {
        b.statut = STATUT_VERS_APP[choix.value];
        if (choix.value !== 'vendu') b.paye = false;
        dessinerBillets();
      });
      var siege = el('input', { type: 'text', value: b.siege || '', 'aria-label': T.seatLabel, placeholder: T.seatWord });
      siege.addEventListener('input', function () { b.siege = siege.value; });
      var retirer = el('button', { type: 'button', cls: 'seat-x', 'aria-label': T.removeSeat, title: T.removeSeat, text: '×' });
      retirer.addEventListener('click', function () { edition.billets.splice(i, 1); dessinerBillets(); });
      var tete = el('div', { cls: 'seat-top' }, [siege, choix, retirer]);
      var carte = el('div', { cls: 'seat-card st-' + STATUS_CLS[st] }, [tete]);

      if (st === 'vendu' || st === 'donne') {
        var champs = el('div', { cls: 'seat-fields' });
        if (st === 'vendu') {
          var prix = el('input', { type: 'number', min: '0', step: '1', inputmode: 'decimal', value: b.prixVente ? String(b.prixVente) : '', placeholder: '0' });
          prix.addEventListener('input', function () { b.prixVente = Math.max(0, parseFloat(prix.value) || 0); });
          champs.appendChild(el('label', { cls: 'field sm' }, [el('span', { text: T.priceLabel }), prix]));
        }
        var pers = el('input', { type: 'text', value: b.personne || '', placeholder: T.personPh, autocomplete: 'off' });
        pers.addEventListener('input', function () { b.personne = pers.value; });
        champs.appendChild(el('label', { cls: 'field sm' }, [el('span', { text: st === 'vendu' ? T.soldTo : T.givenTo }), pers]));
        var tel = el('input', { type: 'tel', value: b.telephone || '', placeholder: T.optional, autocomplete: 'off' });
        tel.addEventListener('input', function () { b.telephone = tel.value; });
        champs.appendChild(el('label', { cls: 'field sm' }, [el('span', { text: T.phoneLabel }), tel]));
        var mail = el('input', { type: 'email', value: b.courriel || '', placeholder: T.optional, autocomplete: 'off' });
        mail.addEventListener('input', function () { b.courriel = mail.value; });
        champs.appendChild(el('label', { cls: 'field sm' }, [el('span', { text: T.emailLabel }), mail]));
        if (st === 'vendu') {
          var paye = el('input', { type: 'checkbox' }); paye.checked = !!b.paye;
          paye.addEventListener('change', function () { b.paye = paye.checked; });
          champs.appendChild(el('label', { cls: 'check' }, [paye, el('span', { text: T.paidLabel })]));
          var texto = el('button', { type: 'button', cls: 'btn btn-sm btn-ghost seat-sms', text: T.transferText });
          texto.addEventListener('click', function () {
            if (!String(b.telephone || '').trim()) { msg('#matchMsg', T.needPhone, true); tel.focus(); return; }
            var d = new Date($('#mDate').value);
            var m = { adversaire: $('#mOpp').value.trim(), date: isNaN(d) ? new Date().toISOString() : d.toISOString(),
                      section: $('#mSection').value.trim(), rangee: $('#mRow').value.trim(), billets: edition.billets };
            location.href = lienTexto(b.telephone, messageTransfert(abonnementCourant(), m, b));
          });
          champs.appendChild(texto);
        }
        carte.appendChild(champs);
      }
      box.appendChild(carte);
    });
    if (!edition.billets.length) box.appendChild(el('p', { cls: 'muted', text: T.noSeats }));
  }

  function ajouterSiege() {
    edition.billets.push({ id: uuid(), siege: T.seatWord + ' ' + (edition.billets.length + 1), statut: 'À placer', prixVente: 0, personne: '', courriel: '', telephone: '', paye: false });
    dessinerBillets();
  }

  function enregistrerMatch(e) {
    e.preventDefault();
    var adv = $('#mOpp').value.trim();
    var d = new Date($('#mDate').value);
    if (!adv) { msg('#matchMsg', T.oppNeeded, true); $('#mOpp').focus(); return; }
    if (isNaN(d)) { msg('#matchMsg', T.dateNeeded, true); $('#mDate').focus(); return; }
    for (var i = 0; i < edition.billets.length; i++) {
      var b = edition.billets[i];
      if ((b.statut === 'Vendu' || b.statut === 'Donné') && !String(b.personne || '').trim()) {
        msg('#matchMsg', T.personNeeded, true); return;
      }
      b.siege = String(b.siege || '').trim() || (T.seatWord + ' ' + (i + 1));
      b.personne = String(b.personne || '').trim();
      if (b.statut !== 'Vendu' && b.statut !== 'Donné') { b.personne = ''; b.telephone = ''; b.courriel = ''; }
      if (b.statut !== 'Vendu') { b.prixVente = 0; b.paye = false; }
    }
    var ab = abonnementCourant();
    if (!ab.matchs) ab.matchs = [];
    var m = edition.mi >= 0 ? ab.matchs[edition.mi] : { id: uuid(), prixMarche: 0 };
    m.date = isoApp(d);
    m.adversaire = adv;
    m.domicile = $('#mHome').value !== 'non';
    m.section = $('#mSection').value.trim();
    m.rangee = $('#mRow').value.trim();
    m.notes = $('#mNotes').value;
    m.billets = edition.billets;
    if (edition.mi < 0) ab.matchs.push(m);
    ab.matchs.sort(function (x, y) { return new Date(x.date) - new Date(y.date); });
    garder();
    rafraichir();
    ouvrirMatchs();
  }

  function supprimerMatch() {
    var ab = abonnementCourant();
    if (edition && edition.mi >= 0) ab.matchs.splice(edition.mi, 1);
    garder();
    rafraichir();
    ouvrirMatchs();
  }


  /* ================================================================ Carnet d'acheteurs et textos
   * Même logique que l'onglet Acheteurs de l'app : le carnet (archive.carnet)
   * plus toutes les personnes inscrites sur un billet vendu ou donné. */
  var SPORT_EMOJI = { Hockey: '🏒', Basketball: '🏀', Baseball: '⚾', Football: '🏈', Soccer: '⚽', Crosse: '🥍' };
  function prenomDe(nom) { return String(nom || '').trim().split(/\s+/)[0] || ''; }
  function chiffres(tel) { return String(tel || '').replace(/[^\d+]/g, ''); }
  function lienTexto(tel, corps) {
    var sep = /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent) ? '&' : '?';
    return 'sms:' + chiffres(tel) + (corps ? sep + 'body=' + encodeURIComponent(corps) : '');
  }
  function destinationInterac() {
    var c = (state.archive && state.archive.compte) || {};
    return String(c.interac || c.courriel || '').trim();
  }
  function argentCourt(n) {
    try { return new Intl.NumberFormat(LOCALE, { style: 'currency', currency: state.prefs.currency || 'CAD', maximumFractionDigits: 0 }).format(n); }
    catch (e) { return money.format(n); }
  }
  function remplir(modele) {
    var args = Array.prototype.slice.call(arguments, 1), i = 0;
    return modele.replace(/%@/g, function () { return args[i++] === undefined ? '' : args[i - 1]; });
  }

  /* Toutes les fiches : carnet + personnes des billets, toutes équipes confondues. */
  function fiches() {
    var parCle = {}, liste = [];
    function fiche(nom) {
      var k = cle(nom);
      if (!k) return null;
      if (!parCle[k]) { parCle[k] = { cle: k, nom: String(nom).trim(), telephone: '', courriel: '', notes: '', prioritaire: false, contact: null, achetes: 0, donnes: 0, total: 0, du: 0, prochain: null }; liste.push(parCle[k]); }
      return parCle[k];
    }
    (state.archive.carnet || []).forEach(function (c, i) {
      var f = fiche(c.nom); if (!f) return;
      f.contact = i; f.nom = String(c.nom).trim();
      f.telephone = c.telephone || ''; f.courriel = c.courriel || ''; f.notes = c.notes || ''; f.prioritaire = !!c.prioritaire;
    });
    var maintenant = new Date();
    state.archive.abonnements.forEach(function (ab) {
      (ab.matchs || []).forEach(function (m) {
        (m.billets || []).forEach(function (b) {
          if (b.statut !== 'Vendu' && b.statut !== 'Donné') return;
          var f = fiche(b.personne); if (!f) return;
          if (!f.telephone && b.telephone) f.telephone = b.telephone;
          if (!f.courriel && b.courriel) f.courriel = b.courriel;
          if (b.statut === 'Vendu') {
            f.achetes++; f.total += +b.prixVente || 0;
            if (!b.paye) f.du += +b.prixVente || 0;
          } else f.donnes++;
          var d = new Date(m.date);
          if (d >= maintenant && (!f.prochain || d < f.prochain)) f.prochain = d;
        });
      });
    });
    liste.sort(function (a, b) {
      if (a.prioritaire !== b.prioritaire) return a.prioritaire ? -1 : 1;
      if ((a.du > 0) !== (b.du > 0)) return a.du > 0 ? -1 : 1;
      return a.nom.localeCompare(b.nom, LANG);
    });
    return liste;
  }

  function messageRappel(f) {
    var c = (state.archive && state.archive.compte) || {};
    var texte = remplir(T.txtHiName, prenomDe(f.nom)) + ' ' + remplir(T.txtReminder, argentCourt(f.du));
    var dest = destinationInterac();
    if (dest) texte += ' ' + remplir(T.txtInterac, dest);
    texte += '\n\n' + T.txtThanks;
    if (c.nom) texte += '\n' + c.nom;
    return texte;
  }

  /* Texto de transfert d'un billet vendu, comme dans l'app. */
  function messageTransfert(ab, m, b) {
    var c = state.archive.compte || {};
    var lot = (m.billets || []).filter(function (x) { return x.statut === 'Vendu' && cle(x.personne) === cle(b.personne); });
    if (!lot.length) lot = [b];
    var n = lot.length;
    var total = lot.reduce(function (s, x) { return s + (+x.prixVente || 0); }, 0);
    var sieges = lot.map(function (x) { return x.siege; }).filter(Boolean).join(', ');
    var d = new Date(m.date);
    var lignes = [];
    var p = prenomDe(b.personne);
    lignes.push(p ? remplir(T.txtHiName, p) : T.txtHi, '');
    var desc = remplir(T.txtFor, n > 1 ? remplir(T.txtYourN, n) : T.txtYour1, m.adversaire || T.opponent, longFmt.format(d), timeFmt.format(d));
    var place = [m.section ? remplir(T.txtSection, m.section) : '', m.rangee ? remplir(T.txtRow, m.rangee) : ''].filter(Boolean).join(' · ');
    if (place) desc += ', ' + place;
    if (sieges) desc += ' (' + sieges + ')';
    lignes.push(desc + '.', '');
    if (total > 0) lignes.push(n > 1 ? remplir(T.txtPriceN, argentCourt(total), n, argentCourt(total / n)) : remplir(T.txtPrice1, argentCourt(total)));
    var dest = destinationInterac();
    lignes.push(dest ? remplir(T.txtInterac, dest) : T.txtInteracConfirm, '');
    T.txtSteps.forEach(function (l) { lignes.push(l); });
    lignes.push('', T.txtImportant, '', T.txtTextMe, '');
    var lg = LIGUES[(ab.reglages || {}).ligueID];
    var sport = lg ? lg[2] : ((ab.reglages || {}).sportPerso || 'Hockey');
    var sig = remplir(T.txtGoodGame, SPORT_EMOJI[sport] || '🎟️');
    if (c.nom) { sig += '\n' + c.nom; if (c.telephone) sig += ' — ' + c.telephone; }
    else if (c.telephone) sig += '\n' + c.telephone;
    lignes.push(sig);
    return lignes.join('\n');
  }

  function ouvrirCarnet() {
    var c = state.archive.compte || (state.archive.compte = {});
    $('#meName').value = c.nom || '';
    $('#mePhone').value = c.telephone || '';
    $('#meInterac').value = c.interac || '';
    msg('#meMsg', '');
    dessinerCarnet();
    show('buyers');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function dessinerCarnet() {
    var box = clear($('#buyersList'));
    var liste = fiches();
    var totalDu = liste.reduce(function (s, f) { return s + f.du; }, 0);
    $('#buyersSummary').textContent = remplir(liste.length === 1 ? T.nPerson1 : T.nPersons, liste.length) + (totalDu ? ' · ' + remplir(T.owedTotal, argentCourt(totalDu)) : '');
    if (!liste.length) { box.appendChild(el('p', { cls: 'muted', text: T.emptyBook })); return; }
    liste.forEach(function (f) {
      var details = [];
      if (f.achetes) details.push(remplir(f.achetes === 1 ? T.bought1 : T.boughtN, f.achetes, argentCourt(f.total)));
      if (f.donnes) details.push(remplir(f.donnes === 1 ? T.given1 : T.givenN, f.donnes));
      if (!f.achetes && !f.donnes) details.push(T.noTickets);
      if (f.prochain) details.push(remplir(T.nextOn, cap(longFmt.format(f.prochain))));
      var acts = el('div', { cls: 'acts' });
      if (f.telephone) acts.appendChild(el('a', { cls: 'act', href: lienTexto(f.telephone, f.du > 0 ? messageRappel(f) : ''), 'aria-label': T.textTo + f.nom, text: f.du > 0 ? T.remind : T.text }));
      if (f.courriel) acts.appendChild(el('a', { cls: 'act', href: 'mailto:' + f.courriel + (f.du > 0 ? '?body=' + encodeURIComponent(messageRappel(f)) : ''), 'aria-label': T.emailTo + f.nom, text: T.email }));
      if (f.du > 0) {
        var payer = el('button', { type: 'button', cls: 'act act-ok', text: T.markPaid });
        payer.addEventListener('click', function () { marquerPaye(f.cle); });
        acts.appendChild(payer);
      }
      var modif = el('button', { type: 'button', cls: 'act', text: T.edit });
      modif.addEventListener('click', function () { ouvrirFiche(f); });
      acts.appendChild(modif);
      box.appendChild(el('div', { cls: 'buyer buyer-row' + (f.du > 0 ? ' owes' : '') }, [
        el('span', { cls: 'bav', text: initials(f.nom) }),
        el('div', { cls: 'binfo' }, [
          el('b', { text: (f.prioritaire ? '★ ' : '') + f.nom }),
          el('small', { text: details.join(' · ') }),
          f.du > 0 ? el('small', { cls: 'du', text: remplir(T.owes, argentCourt(f.du)) }) : null,
          f.notes ? el('small', { cls: 'muted', text: f.notes }) : null
        ]),
        acts
      ]));
    });
  }

  function marquerPaye(k) {
    state.archive.abonnements.forEach(function (ab) {
      (ab.matchs || []).forEach(function (m) {
        (m.billets || []).forEach(function (b) { if (b.statut === 'Vendu' && cle(b.personne) === k) b.paye = true; });
      });
    });
    garder(); rafraichir(); dessinerCarnet();
  }

  function enregistrerMoi(e) {
    e.preventDefault();
    var c = state.archive.compte || (state.archive.compte = {});
    c.nom = $('#meName').value.trim();
    c.telephone = $('#mePhone').value.trim();
    c.interac = $('#meInterac').value.trim();
    garder();
    if (state.who) state.who.name = c.nom;
    dessinerCarnet();
    msg('#meMsg', T.savedShort);
  }

  /* ---------- Fiche d'une personne ---------- */
  var ficheEnCours = null;   // { contact: index dans le carnet ou null, ancienNom }

  function ouvrirFiche(f) {
    ficheEnCours = { contact: f ? f.contact : null, ancienNom: f ? f.nom : '' };
    $('#buyerHeading').textContent = f ? f.nom : T.newBuyer;
    $('#bName').value = f ? f.nom : '';
    $('#bPhone').value = f ? f.telephone : '';
    $('#bEmail').value = f ? f.courriel : '';
    $('#bNotes').value = f ? f.notes : '';
    $('#bPriority').checked = !!(f && f.prioritaire);
    $('#bRemove').hidden = !(f && f.contact !== null);
    $('#bRemoveConfirm').hidden = true;
    msg('#buyerMsg', '');
    show('buyer');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (!f) setTimeout(function () { $('#bName').focus(); }, 300);
  }

  function enregistrerFiche(e) {
    e.preventDefault();
    var nom = $('#bName').value.trim();
    if (!nom) { msg('#buyerMsg', T.nameNeeded, true); $('#bName').focus(); return; }
    var carnet = state.archive.carnet || (state.archive.carnet = []);
    var k = cle(nom);
    var doublon = carnet.some(function (c, i) { return i !== ficheEnCours.contact && cle(c.nom) === k; });
    if (doublon) { msg('#buyerMsg', T.nameTaken, true); return; }
    var c = ficheEnCours.contact !== null ? carnet[ficheEnCours.contact] : { id: uuid() };
    c.nom = nom;
    c.telephone = $('#bPhone').value.trim();
    c.courriel = $('#bEmail').value.trim();
    c.notes = $('#bNotes').value.trim();
    c.prioritaire = $('#bPriority').checked;
    if (ficheEnCours.contact === null) carnet.push(c);
    /* Nom changé : les billets de cette personne suivent. */
    var ancien = cle(ficheEnCours.ancienNom);
    if (ancien && ancien !== k) {
      state.archive.abonnements.forEach(function (ab) {
        (ab.matchs || []).forEach(function (m) {
          (m.billets || []).forEach(function (b) { if (cle(b.personne) === ancien) b.personne = nom; });
        });
      });
    }
    garder(); rafraichir(); ouvrirCarnet();
  }

  function retirerFiche() {
    if (ficheEnCours && ficheEnCours.contact !== null) state.archive.carnet.splice(ficheEnCours.contact, 1);
    garder(); rafraichir(); ouvrirCarnet();
  }


  /* ================================================================ Bilan, PDF et copie vers l'app
   * Mêmes calculs que l'onglet Bilan de l'app. */
  function statsAbonnement(ab) {
    var r = ab.reglages || {};
    var cout = +r.coutAbonnement || 0;
    var billets = [];
    var auj = new Date(); auj.setHours(0, 0, 0, 0);
    var aPlacer = 0, aVenir = 0, prochain = null;
    (ab.matchs || []).forEach(function (m) {
      var d = new Date(m.date);
      if (d >= auj) {
        aVenir++;
        if (!prochain || d < new Date(prochain.date)) prochain = m;
      }
      (m.billets || []).forEach(function (b) {
        billets.push({ b: b, m: m });
        if (d >= auj && (b.statut === 'À placer' || b.statut === 'À vendre')) aPlacer++;
      });
    });
    var vendus = billets.filter(function (x) { return x.b.statut === 'Vendu'; });
    var revenus = vendus.reduce(function (s, x) { return s + (+x.b.prixVente || 0); }, 0);
    var encaisse = vendus.filter(function (x) { return x.b.paye; }).reduce(function (s, x) { return s + (+x.b.prixVente || 0); }, 0);
    var compte = {};
    ORDRE_STATUTS.forEach(function (s) { compte[s] = 0; });
    billets.forEach(function (x) { compte[STATUT_APP[x.b.statut] || 'a_placer']++; });
    return {
      nom: r.equipe || T.team, saison: r.nomSaison || '', cout: cout, nbBillets: billets.length,
      nbMatchs: (ab.matchs || []).length, aVenir: aVenir, prochain: prochain, aPlacer: aPlacer,
      revenus: revenus, encaisse: encaisse, enAttente: revenus - encaisse, solde: encaisse - cout,
      taux: cout > 0 ? encaisse / cout : 0,
      coutParBillet: billets.length ? cout / billets.length : 0,
      meilleure: vendus.reduce(function (mx, x) { return Math.max(mx, +x.b.prixVente || 0); }, 0),
      coutNetUtilise: compte.utilise ? (cout - revenus) / compte.utilise : 0,
      compte: compte,
      ventes: billets.filter(function (x) { return x.b.statut === 'Vendu' || x.b.statut === 'Donné'; })
        .sort(function (a, b) { return new Date(a.m.date) - new Date(b.m.date); })
    };
  }

  function tuile(etiquette, valeur, ton) {
    return el('div', { cls: 'kpi ' + (ton || '') }, [el('small', { text: etiquette }), el('b', { text: valeur })]);
  }

  function ouvrirBilan() {
    var s = statsAbonnement(abonnementCourant());
    $('#bilanTitle').textContent = s.nom;
    $('#bilanSub').textContent = s.saison;
    var k = clear($('#bilanTiles'));
    k.appendChild(tuile(T.bCost, money.format(s.cout), 'nxt'));
    k.appendChild(tuile(T.bCollected, money.format(s.encaisse), 'rev'));
    k.appendChild(tuile(T.bPending, money.format(s.enAttente), s.enAttente ? 'owed' : 'ok'));
    k.appendChild(tuile(T.bPerTicket, money.format(s.coutParBillet), 'nxt'));
    k.appendChild(tuile(T.bBest, money.format(s.meilleure), 'rev'));
    k.appendChild(tuile(T.bNetUsed, money.format(s.coutNetUtilise), 'todo'));
    k.appendChild(tuile(T.toPlace, String(s.aPlacer), s.aPlacer ? 'todo' : 'ok'));
    k.appendChild(tuile(T.bGames, s.nbMatchs + ' · ' + remplir(T.bUpcomingN, s.aVenir), 'nxt'));

    var pct = Math.min(100, Math.round(s.taux * 100));
    $('#bilanBar').style.width = pct + '%';
    $('#bilanPct').textContent = s.cout ? pct + T.pct : '—';
    $('#bilanVerdict').textContent = !s.cout ? T.bNoCost
      : s.solde >= 0 ? remplir(T.bPaidBack, money.format(s.solde)) : remplir(T.bLeft, money.format(-s.solde));
    $('#bilanVerdict').className = 'verdict ' + (s.cout && s.solde >= 0 ? 'ok' : '');

    var bar = clear($('#bilanMix')), leg = clear($('#bilanMixLegend'));
    var total = s.nbBillets || 1;
    ORDRE_STATUTS.forEach(function (st) {
      if (!s.compte[st]) return;
      bar.appendChild(el('span', { cls: 'seg ' + STATUS_CLS[st], style: 'width:' + (s.compte[st] / total * 100) + '%', title: T.status[st] }));
      leg.appendChild(el('span', { cls: 'lg-item ' + STATUS_CLS[st] }, [el('i'), T.status[st] + ' ', el('b', { text: String(s.compte[st]) })]));
    });

    var tb = clear($('#bilanSales'));
    if (!s.ventes.length) tb.appendChild(el('p', { cls: 'muted', text: T.bNoSales }));
    s.ventes.forEach(function (x) {
      var d = new Date(x.m.date);
      var vendu = x.b.statut === 'Vendu';
      tb.appendChild(el('div', { cls: 'sale' }, [
        el('span', { cls: 'sd', text: dateCourteWeb(d) }),
        el('span', { cls: 'so' }, [el('b', { text: x.m.adversaire || T.opponent }), el('small', { text: [x.b.siege, x.b.personne].filter(Boolean).join(' · ') })]),
        el('span', { cls: 'sp ' + (vendu ? (x.b.paye ? 'paid' : 'unpaid') : 'gift'), text: vendu ? money.format(+x.b.prixVente || 0) + (x.b.paye ? '' : ' ⏳') : T.status.donne })
      ]));
    });
    show('bilan');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function dateCourteWeb(d) {
    return cap(dayFmt.format(d)).replace('.', '') + ' ' + d.getDate() + ' ' + monFmt.format(d).replace('.', '');
  }

  /* Rapport imprimable (Imprimer → Enregistrer en PDF), comme le PDF de l'app. */
  function imprimerRapport() {
    var box = clear($('#printReport'));
    var c = state.archive.compte || {};
    box.appendChild(el('h1', { text: remplir(T.pTitle, 'TicketStay') }));
    box.appendChild(el('p', { cls: 'pmeta', text: remplir(T.pGenerated, cap(longFmt.format(new Date()))) + (c.nom ? ' · ' + remplir(T.pHolder, c.nom) : '') }));
    var tCout = 0, tEnc = 0, tAtt = 0;
    state.archive.abonnements.forEach(function (ab) {
      var s = statsAbonnement(ab);
      tCout += s.cout; tEnc += s.encaisse; tAtt += s.enAttente;
      box.appendChild(el('h2', { text: s.nom + (s.saison ? ' · ' + s.saison : '') }));
      box.appendChild(el('p', { text: T.bCost + T.colon + money.format(s.cout) + '   ·   ' + T.bCollected + T.colon + money.format(s.encaisse) + '   ·   ' + T.bPending + T.colon + money.format(s.enAttente) }));
      box.appendChild(el('p', { cls: 'pstrong', text: remplir(T.pBalance, money.format(s.solde)) }));
      if (!s.ventes.length) { box.appendChild(el('p', { cls: 'pmeta', text: T.bNoSales })); return; }
      var rows = s.ventes.map(function (x) {
        var vendu = x.b.statut === 'Vendu';
        return el('tr', null, [
          el('td', { text: dateCourteWeb(new Date(x.m.date)) }), el('td', { text: x.m.adversaire || '' }),
          el('td', { text: x.b.siege || '' }), el('td', { text: x.b.personne || '' }),
          el('td', { text: vendu ? money.format(+x.b.prixVente || 0) + (x.b.paye ? '' : ' (' + T.pToCollect + ')') : T.status.donne })
        ]);
      });
      box.appendChild(el('table', null, [
        el('thead', null, [el('tr', null, [T.pDate, T.opponentWord, T.seatWord, T.pPerson, T.pPrice].map(function (h) { return el('th', { text: h }); }))]),
        el('tbody', null, rows)
      ]));
    });
    if (state.archive.abonnements.length > 1) {
      box.appendChild(el('h2', { text: T.pAll }));
      box.appendChild(el('p', { text: T.bCost + T.colon + money.format(tCout) + '   ·   ' + T.bCollected + T.colon + money.format(tEnc) + '   ·   ' + T.bPending + T.colon + money.format(tAtt) }));
      box.appendChild(el('p', { cls: 'pstrong', text: remplir(T.pBalance, money.format(tEnc - tCout)) }));
    }
    box.appendChild(el('p', { cls: 'pmeta pfoot', text: remplir(T.pFoot, 'TicketStay') }));
    window.print();
  }

  /* ---------- Copie vers l'app ---------- */
  function texteApp() {
    var a = JSON.parse(JSON.stringify(state.archive));
    delete a._modifie;
    if (!a.equipesPersos) a.equipesPersos = {};
    if (!a.carnet) a.carnet = [];
    var fav = a.abonnements.filter(function (x) { return x.favori; })[0] || a.abonnements[0];
    if (fav && fav.id) a.actifID = fav.id;
    return JSON.stringify(a, null, 2);
  }

  function ouvrirExport() {
    $('#exportText').value = texteApp();
    msg('#exportMsg', '');
    show('export');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function copierExport() {
    var zone = $('#exportText');
    function ok() { msg('#exportMsg', T.copiedApp); }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(zone.value).then(ok, function () { zone.select(); try { document.execCommand('copy'); ok(); } catch (e) { msg('#exportMsg', T.copyManual, true); } });
    } else {
      zone.select(); try { document.execCommand('copy'); ok(); } catch (e) { msg('#exportMsg', T.copyManual, true); }
    }
  }

  function telechargerExport() {
    var blob = new Blob([texteApp()], { type: 'application/json' });
    var a = el('a', { href: URL.createObjectURL(blob), download: 'ticketstay-saison-' + new Date().toISOString().slice(0, 10) + '.json' });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
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
      var ligne = el(state.imported ? 'button' : 'div', state.imported ? { type: 'button', cls: 'game game-btn' } : { cls: 'game' }, [
        el('div', { cls: 'gdate' }, [el('b', { text: String(dt.getDate()) }), el('small', { text: monFmt.format(dt).replace('.', '') })]),
        el('div', { cls: 'ginfo' }, [
          el('b', { text: (g.home === false ? '@ ' : 'vs ') + (g.opponent || T.opponent) }),
          el('small', { text: cap(dayFmt.format(dt)).replace('.', '') + ' · ' + timeFmt.format(dt) }),
          pills
        ])
      ]);
      if (state.imported) ligne.addEventListener('click', function () { ouvrirMatch(g._mi); });
      gl.appendChild(ligne);
    });
    $('#dashActions').hidden = !state.imported;

    /* --- Qui doit encore payer --- */
    var ol = clear($('#owing'));
    var ids = Object.keys(owing).sort(function (a, b) { return owing[b].sum - owing[a].sum; });
    if (!ids.length) ol.appendChild(el('div', { cls: 'allpaid' }, [el('b', { text: T.allPaid }), el('small', { text: T.allPaidSub })]));
    ids.forEach(function (id) {
      var b = buyers[id] || { name: T.unknownBuyer };
      var acts = el('div', { cls: 'acts' });
      if (b.phone) acts.appendChild(el('a', { cls: 'act', href: state.imported ? lienTexto(b.phone, messageRappel({ nom: b.name, du: owing[id].sum })) : 'sms:' + String(b.phone).replace(/[^\d+]/g, ''), 'aria-label': T.textTo + b.name, text: state.imported ? T.remind : T.text }));
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
    $('#demoNote').textContent = state.imported ? T.importNote : $('#demoNote').getAttribute('data-demo-text');
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
        location.href = pageUrl(p.lang) + (state.demo && !state.imported ? '?demo=1' : '');
        return;
      }
      show('settings');
      msg('#prefMsg', text);
    }
    if (state.imported && !state.user) {
      try { localStorage.setItem(CLE_IMPORT_PREFS, JSON.stringify(p)); } catch (x) {}
      applied(T.importSaved); return;
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
    if (state.archive) { telechargerExport(); msg('#dataMsg', T.exported); return; }
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
      if (r.error) throw r.error;
      return sb.from('ts_saisons').delete().eq('user_id', state.user.id);
    }).then(function (r) {
      b.disabled = false;
      if (r && r.error && !/Could not find the table/i.test(r.error.message || '')) throw r.error;
      try { localStorage.removeItem(CLE_IMPORT); localStorage.removeItem(CLE_IMPORT_V1); } catch (e) {}
      state.archive = null; state.imported = false;
      $('#importBar').hidden = true;
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
  document.querySelectorAll('[data-paste]').forEach(function (b) { b.addEventListener('click', ouvrirCollage); });
  $('#pasteGo').addEventListener('click', validerCollage);
  $('#pasteCancel').addEventListener('click', annulerCollage);
  $('#importClear').addEventListener('click', effacerImport);
  document.querySelectorAll('[data-new-team]').forEach(function (b) { b.addEventListener('click', ouvrirEquipe); });
  document.querySelectorAll('[data-matches]').forEach(function (b) { b.addEventListener('click', ouvrirMatchs); });
  document.querySelectorAll('[data-add-game]').forEach(function (b) { b.addEventListener('click', function () { ouvrirMatch(-1); }); });
  $('#ntForm').addEventListener('submit', creerEquipe);
  $('#ntCancel').addEventListener('click', annulerCollage);
  $('#matchesBack').addEventListener('click', function () { show('dash'); window.scrollTo({ top: 0, behavior: 'smooth' }); });
  $('#matchForm').addEventListener('submit', enregistrerMatch);
  $('#mCancel').addEventListener('click', ouvrirMatchs);
  $('#mAddSeat').addEventListener('click', ajouterSiege);
  $('#mDelete').addEventListener('click', function () { $('#mDelConfirm').hidden = false; });
  $('#mDelNo').addEventListener('click', function () { $('#mDelConfirm').hidden = true; });
  $('#mDelYes').addEventListener('click', supprimerMatch);
  document.querySelectorAll('[data-buyers]').forEach(function (b) { b.addEventListener('click', ouvrirCarnet); });
  $('#buyersBack').addEventListener('click', function () { show('dash'); window.scrollTo({ top: 0, behavior: 'smooth' }); });
  $('#addBuyer').addEventListener('click', function () { ouvrirFiche(null); });
  $('#meForm').addEventListener('submit', enregistrerMoi);
  $('#buyerForm').addEventListener('submit', enregistrerFiche);
  $('#bCancel').addEventListener('click', ouvrirCarnet);
  $('#bRemove').addEventListener('click', function () { $('#bRemoveConfirm').hidden = false; });
  $('#bRemoveNo').addEventListener('click', function () { $('#bRemoveConfirm').hidden = true; });
  $('#bRemoveYes').addEventListener('click', retirerFiche);
  document.querySelectorAll('[data-bilan]').forEach(function (b) { b.addEventListener('click', ouvrirBilan); });
  document.querySelectorAll('[data-export]').forEach(function (b) { b.addEventListener('click', ouvrirExport); });
  document.querySelectorAll('[data-back-dash]').forEach(function (b) { b.addEventListener('click', function () { show('dash'); window.scrollTo({ top: 0, behavior: 'smooth' }); }); });
  $('#bilanPrint').addEventListener('click', imprimerRapport);
  $('#exportCopy').addEventListener('click', copierExport);
  $('#exportDownload').addEventListener('click', telechargerExport);
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

  var garde = importGarde();
  if (/[?&]demo=1/.test(location.search)) startDemo();
  else if (configured) startCloud();
  else if (garde) startImport(garde);
  else show('setup');
  reopenSettingsIfAsked();
})();
