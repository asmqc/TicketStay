/*
 * Configuration de la connexion « Mon compte » (Supabase + GitHub).
 *
 * Ces deux valeurs sont PUBLIQUES : elles sont faites pour être dans une page web.
 * La sécurité vient des règles RLS de la table ts_snapshots (voir supabase/schema.sql) :
 * chaque compte ne peut lire que ses propres lignes.
 *
 * Ne JAMAIS mettre ici la clé « service_role » ou « secret » (sb_secret_…).
 * Laisser url ou key vide réaffiche « Bientôt disponible ».
 */
window.TICKETSTAY_SUPABASE = {
  url: 'https://ulxjyvrwvhqntyiztiqw.supabase.co',
  key: 'sb_publishable_L_XvCBKFEFswNnNzDwi1pg_zXqSXQGZ',
  provider: 'github'
};
