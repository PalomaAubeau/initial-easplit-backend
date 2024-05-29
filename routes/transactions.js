// Importation des modules nécessaires
var express = require("express");
var router = express.Router();

require("../models/connection");
const User = require("../models/users");
const Event = require("../models/events");
const Transaction = require("../models/transactions");

const { checkBody } = require("../modules/checkBody");

// Route pour obtenir les transactions de type expense d'un événement
router.get("/expenses/:eventId", async (req, res) => {
  try {
    // Recherche de l'événement
    const event = await Event.findById(req.params.eventId).populate(
      "transactions"
    );
    // Vérification de l'existence de l'événement
    if (!event) {
      return res.json({ response: false, error: "Événement non trouvé" });
    }
    // Filtrage des transactions de type expense
    const expenses = event.transactions.filter(
      (transaction) => transaction.type === "expense"
    );
    // Renvoi des transactions de type expense
    res.json({ response: true, expenses });
  } catch (error) {
    // Gestion des erreurs
    res.json({ response: false, error: error.message });
  }
});

// Route pour le rechargement du solde d'un utilisateur
router.post("/create/reload", (req, res) => {
  // Vérification du corps de la requête
  if (!checkBody(req.body, ["emitter", "recipient", "type", "amount"])) {
    return res.status(400).json({ error: "Corps invalide" });
  }
  // Création de la transaction
  const transaction = new Transaction(req.body);
  // Sauvegarde de la transaction
  transaction.save().then(() => {
    // Mise à jour du solde de l'utilisateur et ajout de la transaction
    User.findByIdAndUpdate(
      req.body.emitter,
      {
        $inc: { balance: Number(req.body.amount) },
        $push: { transactions: transaction._id },
      },
      { new: true }
    ).then((user) => {
      // Vérification de l'existence de l'utilisateur
      if (!user) {
        return res.status(400).json({ error: "Utilisateur non trouvé" });
      }
      // Vérification du solde
      if (user.balance < 0) {
        return res.status(400).json({ error: "Fonds insuffisants" });
      }
      res.json({ response: true, transaction });
    });
  });
});

// Route pour créer un paiement
router.post("/create/payment", (req, res) => {
  // Vérification du corps de la requête
  if (
    !checkBody(req.body, ["emitter", "name", "amount", "recipient", "type"])
  ) {
    return res.status(400).json({ error: "Corps invalide" });
  }
  // Création de la transaction
  const transaction = new Transaction(req.body);
  // Sauvegarde de la transaction
  transaction.save().then(() => {
    // Mise à jour du solde de l'utilisateur et ajout de la transaction
    User.findByIdAndUpdate(
      req.body.emitter,
      {
        $inc: { balance: -Number(req.body.amount) },
        $push: { transactions: transaction._id },
      },
      { new: true }
    ).then((user) => {
      // Vérification de l'existence de l'utilisateur
      if (!user) {
        return res.status(400).json({ error: "Utilisateur non trouvé" });
      }
      // Vérification du solde
      if (user.balance < 0) {
        return res.status(400).json({ error: "Fonds insuffisants" });
      }
      res.json({ response: true, transaction });
    });
  });
});

// Route pour créer un remboursement
router.post("/create/refund", (req, res) => {
  // Vérification du corps de la requête
  if (!checkBody(req.body, ["emitter", "type"])) {
    return res.status(400).json({ error: "Corps invalide" });
  }
  // Création de la transaction
  const transaction = new Transaction(req.body);
  // Sauvegarde de la transaction
  transaction.save().then(() => {
    // Recherche de l'événement
    Event.findById(req.body.emitter).then((event) => {
      // Vérification de l'existence de l'événement
      if (!event) {
        return res.status(400).json({ error: "Événement non trouvé" });
      }
      // Vérification du nombre de participants
      if (event.shareAmount === 0) {
        return res.status(400).json({ error: "Aucun invité à rembourser" });
      }
      // Calcul du montant par part
      const perShareAmount = Number(event.totalSum || 0) / event.shareAmount;
      // Mise à jour du solde de chaque invité et ajout de la transaction
      let promises = event.guests.map((guest) => {
        return User.findByIdAndUpdate(
          guest.userId,
          {
            $inc: { balance: perShareAmount * guest.share },
            $push: { transactions: transaction._id },
          },
          { new: true }
        );
      });
      // Mise à jour de l'événement après le remboursement
      Promise.all(promises).then(() => {
        event.totalSum = 0;
        // Vérification de l'opération
        if (isNaN(event.totalSum)) {
          return res.status(400).json({ error: "Opération invalide" });
        }
        // Ajout de la transaction à l'événement
        event.transactions.push(transaction._id);
        // Sauvegarde de l'événement
        event.save().then(() => res.json({ response: true, transaction }));
      });
    });
  });
});

// Route pour créer une dépense
router.post("/create/expense", (req, res) => {
  // Vérification du corps de la requête
  if (!checkBody(req.body, ["emitter", "amount", "type"])) {
    return res.status(400).json({ error: "Corps invalide" });
  }
  // Création de la transaction
  const transaction = new Transaction(req.body);
  // Sauvegarde de la transaction
  transaction.save().then(() => {
    // Mise à jour du solde de l'événement et ajout de la transaction
    Event.findByIdAndUpdate(
      req.body.emitter,
      {
        $inc: { totalSum: -Number(req.body.amount) },
        $push: { transactions: transaction._id },
      },
      { new: true }
    ).then((event) => {
      // Vérification de l'existence de l'événement
      if (!event) {
        return res.status(400).json({ error: "Événement non trouvé" });
      }
      // Vérification du solde de l'événement
      if (event.totalSum < 0) {
        return res.status(400).json({ error: "Fonds insuffisants" });
      }
      res.json({ response: true, transaction });
    });
  });
});

// Route pour obtenir les transactions d'un utilisateur
router.get("/userTransactions/:token", async (req, res) => {
  try {
    const user = await User.findOne({ token: req.params.token }).populate(
      "transactions"
    );
    // Vérification de l'existence de l'utilisateur
    if (!user) {
      return res.json({ response: false, error: "Utilisateur non trouvé" });
    }
    // Inverser l'ordre des transactions
    const reversedTransactions = user.transactions.reverse();
    // Renvoi des transactions de l'utilisateur
    res.json({ response: true, transactions: reversedTransactions });
  } catch (error) {
    // Gestion des erreurs
    res.json({ response: false, error: error.message });
  }
});

// Route pour obtenir les détails d'une transaction spécifique
router.get("/:transactionId", async (req, res) => {
  try {
    // Recherche de la transaction
    const transaction = await Transaction.findById(
      req.params.transactionId
    ).populate("eventId");
    // Vérification de l'existence de la transaction
    if (!transaction) {
      return res.json({ response: false, error: "Transaction non trouvée" });
    }
    // Renvoi des détails de la transaction
    res.json({ response: true, transaction });
  } catch (error) {
    // Gestion des erreurs
    res.json({ response: false, error: error.message });
  }
});

//Route pour créer un paient sur un évènement, ajouter la transaction dans la BDD (collections transactions et user), modifier statut du paiment de l'utilisateur sur EventScreen
router.post("/create/payment/:token/:eventUniqueId", async (req, res) => {
  const userCall = await User.findOne({ token: req.params.token });
  const eventCall = await Event.findOne({
    eventUniqueId: req.params.eventUniqueId,
  })
    .populate("guests.userId", [
      "userId",
      "firstName",
      "email",
      "share",
      "hasPaid",
    ])
    .populate("transactions");
  const [user, event] = await Promise.all([userCall, eventCall]); // Pour éviter de faire les recherches l'une derrière l'autre mais plutôt un seul call

  if (!user) {
    res.json({ result: false, error: "Compte utilisateur non trouvé" });
    return;
  }

  if (!event) {
    res.json({ result: false, error: "Evènement non trouvé" });
    return;
  }

  const shareAmountPerGuest = event.totalSum / event.shareAmount;

  const isSamePerson = event.guests.find(
    (guest) => String(guest.userId._id) === String(user._id)
  );
  if (isSamePerson) {
    const userDue = shareAmountPerGuest * isSamePerson.share;
    if (user.balance < Number(userDue)) {
      res.json({ result: false, error: "Veuillez recharger votre compte" });
      return;
    }
    const balanceSetForUser = user.balance - Number(userDue);
    // Création de la transaction
    const userPayment = new Transaction({
      amount: userDue,
      //date: new Date(),
      type: req.body.type,
      eventId: event._id,
      emitter: user._id,
      recipient: event._id,
      name: event.name,
    });
    // Sauvegarde de la transaction
    userPayment.save().then(async (transactionSaved) => {
      await Event.updateOne(
        {
          eventUniqueId: event.eventUniqueId,
          "guests.userId": isSamePerson.userId._id,
        },
        { $set: { "guests.$.hasPaid": true } }
      );
      await User.updateOne(
        { _id: user._id },
        {
          $push: { transactions: userPayment._id },
          $set: { balance: balanceSetForUser },
        }
      );
      // console.log("test de ce que renvoie userPayment", transactionSaved);
      res.json({ result: true, transactionSaved });
    });
  }
});

//TEST//

// Route pour recharger le solde et créer une transaction
router.put("/reload/:token", async (req, res) => {
  const { emitter, recipient, type, amount } = req.body;
  console.log(req.body);
  // Vérification complète des paramètres de la requête
  if (!emitter || !amount) {
    console.log("Requête invalide :", req.body); // Log des données reçues pour le débogage
    return res.status(400).json({ error: "Corps invalide" });
  }

  try {
    // Ajout d'un log pour vérifier l'émetteur reçu
    console.log("Emetteur reçu:", emitter);

    // Recherche de l'utilisateur
    const user = await User.findOne({ token: emitter });

    // Ajout d'un log pour vérifier l'utilisateur trouvé
    if (!user) {
      console.log("Utilisateur non trouvé pour le token:", emitter);
      return res.status(404).json({ error: "Utilisateur non trouvé" });
    } else {
      console.log("Utilisateur trouvé:", user);
    }

    // Calcul du nouveau solde
    const newBalance = user.balance + Number(amount);

    // Création de la transaction
    const transaction = new Transaction({
      emitter,
      recipient: `${emitter}`,
      type: "reload",
      amount,
    });

    // Mise à jour de la balance de l'utilisateur
    await User.updateOne(
      { token: emitter },
      {
        $set: { balance: newBalance },
        $push: { transactions: transaction._id },
      }
    );

    // Sauvegarde de la transaction dans la base de données
    await transaction.save();

    // Réponse avec la transaction en json
    res.json({ response: true, data: transaction });
  } catch (error) {
    console.error("Erreur dans /transaction/reload2:", error);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// module.exports = router;

module.exports = router;

// // Route pour recharger le solde et créer une transaction
// router.put('/transaction/reload3',(req, res) => {
//   const { emitter, recipient, type, amount } = req.body;

//   if (!amount) {
//     return res.status(400).json({ error: 'Corps invalide' });
//   }
//  console.log(emitter)
//   // Recherche de l'utilisateur
//   const user = User.findOne({token: emitter}).then(user=>{//dans ce cas l'emitter est le token du user dans la bdd
//     // Calcul du nouveau solde
//     const newBalance = user.balance + Number(amount);

//   });

//   // Création de la transaction
//  const transaction = new Transaction({ emitter, recipient: `${emitter}`, type: 'reload', amount });
//   // const transaction = new Transaction({ emitter, recipient, type, amount });

//   // Mise à jour de la balance de l'utilisateur
//    User.updateOne(
//     { token: emitter },
//     { $set: { balance: newBalance }, $push: { transactions: transaction._id } }
//   );

//   // Sauvegarde de la transaction dans la bdd transaction
//    transaction.save()
//    .then(() =>{
//     res.json({result: true, data: data})
//    });

//   // Réponse avec la transaction en json
//   res.json({ response: true, data: transaction });
// });

// module.exports = router;
