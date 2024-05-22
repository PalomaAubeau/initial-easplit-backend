var express = require("express");
var router = express.Router();

require("../models/connection");
const User = require("../models/users");
const Event = require("../models/events");
const Transaction = require("../models/transactions");

const { checkBody } = require("../modules/checkBody");

// Fonction pour gérer les réponses
const handleResponse = (res, result, data) => {
  res.json({ result, ...data });
};

// Fonction pour gérer les transactions
const handleTransaction = (transaction, res) => {
  transaction.save().then(() => {
    handleResponse(res, true, { transaction });
  });
};

// Route pour créer une transaction
router.post("/create", (req, res) => {
  // On vérifie si les champs sont bien remplis
  if (!checkBody(req.body, ["date", "invoice", "type", "emitter"])) {
    return handleResponse(res, false, { error: "Champs manquants ou vides" });
  }
  // On vérifie si le type de transaction est valide
  if (
    req.body.type !== "refound" &&
    (req.body.amount.toString().split(".")[1] || "").length > 2
  ) {
    return handleResponse(res, false, {
      error: "le solde ne peut pas avoir plus de 2 décimales",
    });
  }
  // On crée une nouvelle transaction
  const transaction = new Transaction(req.body);
  // On vérifie le type de transaction
  switch (req.body.type) {
    case "reload":
      // On vérifie si l'utilisateur existe
      User.findById(req.body.emitter).then((user) => {
        if (!user) {
          return handleResponse(res, false, { error: "User non trouvé" });
        }
        // On ajoute le montant au solde de l'utilisateur
        user.balance += Number(req.body.amount);
        // On vérifie si le solde est négatif
        if (user.balance < 0) {
          return handleResponse(res, false, {
            error: "operation impossible: solde négatif",
          });
          // On sauvegarde l'utilisateur
        }
        user.save().then(() => handleTransaction(transaction, res));
      });
      //
      break;

    default:
      // On vérifie si l'événement existe
      Event.findById(req.body.emitter).then((event) => {
        if (!event) {
          return handleResponse(res, false, { error: "Event non trouvé" });
        }
        // On vérifie le type de transaction
        switch (req.body.type) {
          case "expense":
            // On vérifie si le montant est supérieur au solde de l'événement
            if (Number(event.totalSum || 0) - Number(req.body.amount) < 0) {
              return handleResponse(res, false, {
                error: "Fonds insuffisants pour l'événement",
              });
            }
            // On soustrait le montant au solde de l'événement
            event.totalSum = Number(
              (Number(event.totalSum || 0) - Number(req.body.amount)).toFixed(2)
            );
            break;
          // On vérifie si l'utilisateur est un invité
          case "payment":
            // On vérifie si l'utilisateur est un invité
            const isGuest = event.guests.some(
              (guest) => guest.userId.toString() === req.body.recipient
            );
            // On renvoie une erreur si l'utilisateur n'est pas un invité
            if (!isGuest) {
              return handleResponse(res, false, {
                error: "User doit être un invité de l'événement",
              });
            }
            // On ajoute le montant au solde de l'événement
            event.totalSum = Number(
              (Number(event.totalSum || 0) + Number(req.body.amount)).toFixed(2)
            );
            break;
          // On vérifie si le montant est supérieur au solde de l'événement
          case "refound":
            if (event.shareAmount === 0) {
              return handleResponse(res, false, {
                error: "Opération impossible: aucun invité à rembourser",
              });
            }
            // On vérifie si le montant est supérieur au solde de l'événement
            const perShareAmount =
              Number(event.totalSum || 0) / event.shareAmount;
            event.guests.forEach((guest) => {
              // On vérifie si l'utilisateur est un invité
              User.findById(guest.userId).then((user) => {
                // On ajoute le montant au solde de l'utilisateur
                if (user) {
                  user.balance += perShareAmount * guest.share;
                  user.save();
                }
              });
            });
            // On réinitialise le solde de l'événement
            event.totalSum = 0;
            break;
        }
        // On vérifie si le solde de l'événement est un nombre
        if (isNaN(event.totalSum)) {
          return handleResponse(res, false, { error: "Operation invalide" });
        }
        event.save().then(() => handleTransaction(transaction, res));
      });
  }
});

// // route get pour récuper les transactions d'un événement donné.
// router.get("/event/:id", (req, res) => {
//   Transaction.find({ eventId: req.params.id }).then((transactions) => {
//     handleResponse(res, true, { transactions });
//   });
// }
// );

// // route pour récupérer les transaction émises ou reçu d'un user donné
// router.get("/user/:id", (req, res) => {
//   Transaction.find({ $or: [{ emitter: req.params.id }, { recipient: req.params.id }] }).then((transactions) => {
//     handleResponse(res, true, { transactions });
//   });
// });

// // route pour récupérer les payment sur un évenement donné
// router.get("/event/:id/payment", (req, res) => {
//   Transaction.find({ eventId: req.params.id, type: "payment" }).then((transactions) => {
//     handleResponse(res, true, { transactions });
//   });
// });

// // route pour récupérer les expense sur un évenement donné
// router.get("/event/:id/expense", (req, res) => {
//   Transaction.find({ eventId: req.params.id, type: "expense" }).then((transactions) => {
//     handleResponse(res, true, { transactions });
//   });
// });

module.exports = router;
