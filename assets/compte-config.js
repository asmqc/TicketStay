/*
 * Configuration de la connexion « Mon compte » (iCloud / CloudKit JS).
 *
 * Tant que containerIdentifier ET apiToken sont vides, la page Mon compte
 * affiche « Bientôt disponible » et propose seulement la démo.
 *
 * Les deux valeurs viennent de CloudKit Console (voir COMPTE-ICLOUD.md).
 * Le jeton API web n'est pas un secret : il est fait pour être public dans
 * une page web. Il ne donne accès qu'aux données de la personne connectée.
 */
window.TICKETSTAY_CLOUDKIT = {
  containerIdentifier: '',     // ex. 'iCloud.com.anthonysmith.TicketStay'
  apiToken: '',                // jeton API « web » créé dans CloudKit Console
  environment: 'development'   // mettre 'production' une fois le schéma déployé
};
