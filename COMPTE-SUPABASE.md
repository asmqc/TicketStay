# Page « Mon compte » — Supabase + GitHub

La page `compte.html` se connecte à Supabase (`assets/compte-config.js`) avec GitHub
et lit la table `ts_snapshots`. Chaque compte ne voit que ses propres lignes (RLS).

## Déjà fait sur le site
- Bouton « Se connecter avec GitHub », session, déconnexion, tableau de bord, démo (`compte.html?demo=1`).
- Version anglaise : `en/account.html` (même script `assets/compte.js`, la langue vient de `<html lang>`).
  La connexion revient toujours sur `compte.html` (seule adresse autorisée), puis renvoie vers la page anglaise
  si la connexion a été lancée de là. Rien à ajouter dans Supabase.
- Paramètres du compte (bouton ⚙ Paramètres) :
  - Profil GitHub (lecture seule).
  - Préférences enregistrées dans les métadonnées du compte : `ts_display_name`, `ts_lang`, `ts_currency`, `ts_default_team`.
  - Exporter (JSON) et supprimer les données synchronisées (`ts_snapshots`).
  - Supprimer mon compte : appelle la fonction SQL `public.delete_my_account()` (voir `supabase/schema.sql`).

## À faire une fois dans Supabase
1. **SQL Editor** → coller `supabase/schema.sql` → **Run**.
2. **Authentication → Sign In / Providers → GitHub** : activé, avec le Client ID et le
   Client Secret de l'OAuth App GitHub.
3. **Authentication → URL Configuration**
   - Site URL : `https://asmqc.github.io/TicketStay/`
   - Redirect URLs : `https://asmqc.github.io/TicketStay/compte.html`

## Plus tard, dans l'app iPhone (Xcode)
1. Ajouter le paquet Swift `https://github.com/supabase/supabase-swift`.
2. Connexion GitHub dans l'app (`client.auth.signInWithOAuth(provider: .github, redirectTo: …)`),
   avec un schéma d'URL propre à l'app ajouté aux *Redirect URLs* de Supabase.
   Apple exige aussi « Se connecter avec Apple » si une connexion tierce est offerte.
3. Envoyer une ligne par équipe :

```swift
struct Snapshot: Encodable { let team_id: String; let payload: TeamPayload }
try await client.from("ts_snapshots").upsert(Snapshot(team_id: team.id, payload: payload)).execute()
```

## Format de `payload` (une équipe)

```json
{
  "version": 1,
  "owner": "Prénom",
  "team": { "name": "Mon équipe", "sport": "Hockey", "league": "LNH", "season": "2026-2027", "cost": 4200 },
  "games": [
    { "date": "2026-10-01T23:00:00Z", "opponent": "Adversaire", "home": true,
      "tickets": [ { "seat": "Sec. 112 · R. F · S. 3", "status": "vendu", "price": 95, "buyer": "b1", "paid": false } ] }
  ],
  "buyers": [ { "id": "b1", "name": "Nom", "phone": "514 555-0142", "email": "" } ]
}
```
`status` : `a_vendre`, `vendu`, `donne`, `utilise` ou `a_placer`.

## Politique de confidentialité
La connexion au site crée un compte chez Supabase (nom d'utilisateur, nom, photo et courriel GitHub).
Quand l'app enverra des données, la politique devra aussi l'indiquer (hébergeur, données envoyées,
suppression du compte). La section 11 de la politique prévoit d'annoncer ce changement avant sa mise en service.

## Clés
- `url` et `sb_publishable_…` : publiques, prévues pour le site.
- **Jamais** la clé `service_role` / `sb_secret_…` dans le site ou l'app.
