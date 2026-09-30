# Brancher la page « Mon compte » (compte.html)

Pour l'instant, la page affiche « Bientôt disponible » et une démo (`compte.html?demo=1`).
Pour activer la vraie connexion avec Apple, il reste 3 étapes, à faire plus tard.

## 1. Dans Xcode (app TicketStay)

1. **Signing & Capabilities → + Capability → iCloud**, puis cocher **CloudKit** et créer
   un conteneur, par exemple `iCloud.com.anthonysmith.TicketStay`.
2. Ajouter une option « Accès web » dans les Réglages. Quand elle est activée, l'app envoie
   **un enregistrement par équipe** dans la base **privée** iCloud de la personne :

```swift
import CloudKit

enum WebSync {
    static let db = CKContainer(identifier: "iCloud.com.anthonysmith.TicketStay").privateCloudDatabase

    /// json = le texte décrit à la section « Format » ci-dessous
    static func publish(teamID: String, teamName: String, json: String) async throws {
        let id = CKRecord.ID(recordName: "snapshot-\(teamID)")
        let record = (try? await db.record(for: id)) ?? CKRecord(recordType: "TSSnapshot", recordID: id)
        record["team"] = teamName as CKRecordValue
        record["payload"] = json as CKRecordValue
        _ = try await db.modifyRecords(saving: [record], deleting: [], savePolicy: .allKeys)
    }

    /// À appeler quand la personne désactive « Accès web »
    static func removeAll(teamIDs: [String]) async throws {
        let ids = teamIDs.map { CKRecord.ID(recordName: "snapshot-\($0)") }
        _ = try await db.modifyRecords(saving: [], deleting: ids)
    }
}
```

## 2. Dans CloudKit Console (icloud.developer.apple.com)

1. Type d'enregistrement **`TSSnapshot`** avec les champs `team` (String) et `payload` (String).
2. Ajouter l'index **Queryable** sur `recordName` (nécessaire pour la requête du site).
3. **API Tokens → +** : type web, *Sign in Callback* = `postMessage`,
   domaine autorisé `asmqc.github.io`.
4. Une fois testé, **Deploy Schema Changes** vers Production.

## 3. Sur le site

Remplir `assets/compte-config.js` :

```js
window.TICKETSTAY_CLOUDKIT = {
  containerIdentifier: 'iCloud.com.anthonysmith.TicketStay',
  apiToken: 'le-jeton-web',
  environment: 'production'
};
```

Le jeton web n'est pas secret : il ne donne accès qu'aux données de la personne connectée.

## Format du champ `payload` (JSON, une équipe)

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

## Avant la mise en ligne : politique de confidentialité

La politique dit aujourd'hui qu'aucune donnée ne quitte l'appareil. Avant d'activer l'accès web,
il faudra ajouter une section du genre : « Accès web (facultatif) — si vous l'activez, une copie de
vos équipes, matchs, billets et acheteurs est enregistrée dans votre base iCloud privée (Apple).
Seule votre connexion avec votre identifiant Apple permet de la lire; nous n'y avons pas accès.
Désactiver l'option supprime cette copie. »
