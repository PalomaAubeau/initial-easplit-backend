var express = require("express");
var router = express.Router();

require("../models/connection");
const User = require("../models/users");
const Event = require("../models/events");
const Transaction = require("../models/transactions");

const { checkBody } = require("../modules/checkBody");

// Route pour créer une transaction
router.post("/create", async (req, res) => {
  // Vérifiez que les champs nécessaires sont présents
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
    // Si tous les champs sont présents, créez une nouvelle transaction
    const transaction = new Transaction(req.body);

    // Récupérez l'utilisateur et l'événement concernés par la transaction
    let user = await User.findById(req.body.emitter);
    let event = await Event.findById(req.body.eventId);

    // Vérifiez le type de transaction pour mettre à jour le solde de l'utilisateur et le total de l'événement
    switch (req.body.type) {
      case "reload":
      case "expense":
        if (Number(event.totalSum || 0) - Number(req.body.amount) < 0) {
          res.json({
            result: false,
            error: "Insufficient funds in event total",
          });
          return;
        }
        user.balance = Number(user.balance) + Number(req.body.amount);
        event.totalSum = Number(event.totalSum || 0) - Number(req.body.amount);
        break;
      case "payment":
      case "refound":
        if (Number(user.balance) - Number(req.body.amount) < 0) {
          res.json({ result: false, error: "Insufficient balance" });
          return;
        }
        user.balance = Number(user.balance) - Number(req.body.amount);
        event.totalSum = Number(event.totalSum || 0) + Number(req.body.amount);
        break;
    }

    // Check if user.balance and event.totalSum are numbers
    if (isNaN(user.balance) || isNaN(event.totalSum)) {
      res.json({ result: false, error: "Invalid operation" });
      return;
    }

    // Ajoutez la transaction à l'utilisateur et à l'événement
    await user.save();
    await event.save();

    // Sauvegardez la transaction
    transaction.save().then(() => {
      res.json({ result: true, transaction });
    });
  }
});

module.exports = router;
