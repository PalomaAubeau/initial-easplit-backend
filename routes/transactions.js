var express = require("express");
var router = express.Router();

require("../models/connection");
const User = require("../models/users");
const Event = require("../models/events");
const Transaction = require("../models/transactions");

const { checkBody } = require("../modules/checkBody");

// Route pour créer une transaction
router.post("/create", async (req, res) => {
  // Vérification que les champs nécessaires sont présents
  if (
    !checkBody(req.body, [
      "date",
      "invoice",
      "amount",
      "type",
      "eventId",
      "emitter",
      "recipient",
      "name",
      "category",
    ])
  ) {
    res.json({ result: false, error: "Champs manquants ou vides" });
    return;
  } else {
    if ((req.body.amount.toString().split(".")[1] || "").length > 2) {
      res.json({
        result: false,
        error: "Amount should not have more than two decimal places",
      });
      return;
    }
    // Si tous les champs sont présents, créetion une nouvelle transaction
    const transaction = new Transaction(req.body);

    // Récupération de l'utilisateur et l'événement concernés par la transaction
    let user = await User.findById(req.body.emitter);
    let event = await Event.findById(req.body.eventId);

    // Vérification que le type de transaction pour mettre à jour le solde de l'utilisateur et le total de l'événement
    switch (req.body.type) {
      case "reload":
      case "expense":
        // Vérification si l'utilisateur a suffisamment de fonds
        if (Number(event.totalSum || 0) - Number(req.body.amount) < 0) {
          // Si l'utilisateur n'a pas assez de fonds, on renvoie une erreur
          res.json({
            result: false,
            error: "Insufficient funds in event total",
          });
          // Arrêt de l'exécution de la fonction
          return;
        }
        // Sinon, mise à jour du solde de l'utilisateur et du total de l'événement
        user.balance = Number(user.balance) + Number(req.body.amount);
        event.totalSum = Number(event.totalSum || 0) - Number(req.body.amount);
        // Arrêt l'exécution de la fonction
        break;
      // Si le type de transaction est un paiement ou un remboursement
      case "payment":
      case "refound":
        // Vérification si l'utilisateur a suffisamment de fonds
        if (Number(user.balance) - Number(req.body.amount) < 0) {
          res.json({ result: false, error: "Insufficient balance" });
          // Arrêt l'exécution de la fonction
          return;
        }
        // Mise à jour le solde de l'utilisateur et le total de l'événement
        user.balance = Number(user.balance) - Number(req.body.amount);
        event.totalSum = Number(event.totalSum || 0) + Number(req.body.amount);
        break;
    }

    // Vérification si le solde de l'utilisateur et le total de l'événement sont des nombres
    if (isNaN(user.balance) || isNaN(event.totalSum)) {
      res.json({ result: false, error: "Invalid operation" });
      return;
    }

    // Ajout de la transaction à l'utilisateur et à l'événement
    await user.save();
    await event.save();

    // Sauvegarde de la transaction
    transaction.save().then(() => {
      res.json({ result: true, transaction });
    });
  }
});

module.exports = router;
