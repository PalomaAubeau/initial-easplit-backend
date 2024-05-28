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
    // Recherche de l'utilisateur
    User.findById(req.body.emitter).then((user) => {
      // Vérification de l'existence de l'utilisateur
      if (!user) {
        return res.status(400).json({ error: "Utilisateur non trouvé" });
      }
      // Mise à jour du solde de l'utilisateur
      user.balance += Number(req.body.amount);
      // Vérification du solde
      if (user.balance < 0) {
        return res.status(400).json({ error: "Fonds insuffisants" });
      }
      // Ajout de la transaction à l'utilisateur
      user.transactions.push(transaction._id);
      // Sauvegarde de l'utilisateur
      user.save().then(() => res.json({ response: true, transaction }));
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
    // Recherche de l'utilisateur
    User.findById(req.body.emitter).then((user) => {
      // Vérification de l'existence de l'utilisateur
      if (!user) {
        return res.status(400).json({ error: "Utilisateur non trouvé" });
      }
      // Vérification du solde
      if (user.balance < Number(req.body.amount)) {
        return res.status(400).json({ error: "Fonds insuffisants" });
      }
      // Mise à jour du solde de l'utilisateur
      user.balance -= Number(req.body.amount);
      // Ajout de la transaction à l'utilisateur
      user.transactions.push(transaction._id);
      // Sauvegarde de l'utilisateur
      user.save().then(() => {
        // Recherche de l'événement
        Event.findById(req.body.recipient).then((event) => {
          // Vérification de l'existence de l'événement
          if (!event) {
            return res.status(400).json({ error: "Événement non trouvé" });
          }
          // Ajout de la transaction à l'événement
          event.transactions.push(transaction._id);
          // Sauvegarde de l'événement
          event.save().then(() => res.json({ response: true, transaction }));
        });
      });
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
      // Mise à jour du solde de chaque invité
      let promises = event.guests.map((guest) => {
        return User.findById(guest.userId).then((user) => {
          // Vérification de l'existence de l'utilisateur
          if (!user) {
            console.log("Utilisateur avec ID ${guest.userId} non trouvé");
            return;
          }
          // Mise à jour du solde de l'utilisateur
          user.balance += perShareAmount * guest.share;
          // Ajout de la transaction à l'utilisateur
          user.transactions.push(transaction._id);
          // Sauvegarde de l'utilisateur
          return user.save();
        });
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
    // Recherche de l'événement
    Event.findById(req.body.emitter).then((event) => {
      // Vérification de l'existence de l'événement
      if (!event) {
        return res.status(400).json({ error: "Événement non trouvé" });
      }
      // Vérification du solde de l'événement
      if (event.totalSum < Number(req.body.amount)) {
        return res.status(400).json({ error: "Fonds insuffisants" });
      }
      // Mise à jour du solde de l'événement
      event.totalSum -= Number(req.body.amount);
      // Ajout de la transaction à l'événement
      event.transactions.push(transaction._id);
      // Sauvegarde de l'événement
      event.save().then(() => res.json({ response: true, transaction }));
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

//Route pour modifier/créer la transaction et modifier le statut du paiment de l'utilisateur en test sur EventScreen
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
  // console.log("résultat du find pour création payment", isSamePerson);
  //   {
  //   userId: {
  //     _id: new ObjectId('664cb32590817b04a47bd457'),
  //     firstName: 'Paloma',
  //     email: 'test@gmail.com'
  //   },
  //   email: 'test@gmail.com',
  //   share: 1,
  //   hasPaid: false,
  //   _id: new ObjectId('665084c25b8edd087301f5ae')
  // }

  if (isSamePerson) {
    // Création de la transaction
    const userPayment = new Transaction({
      type: req.body.type,
      eventId: event._id,
      emitter: user.token,
      recipient: event.eventUniqueId,
      name: event.name,
      amount: shareAmountPerGuest * isSamePerson.share,
    });
    // Sauvegarde de la transaction
    userPayment.save().then((transactionSaved) => {
      // console.log("test de ce que renvoie userPayment", transactionSaved);
      res.json({ result: true, transactionSaved });
    });

    Event.updateOne(
      {
        eventUniqueId: event.eventUniqueId,
        "guests.userId": isSamePerson.userId._id,
      },
      { $set: { "guests.$.hasPaid": true } }
    ).then(() => {
      return Event.findOne({ eventUniqueId: event.eventUniqueId }).then(
        (updatedEvent) => {
          const updatedGuest = updatedEvent.guests.find(
            (guest) => String(guest.userId) === String(isSamePerson.userId._id)
          );
          //console.log("Updated guest's hasPaid status:", updatedGuest.hasPaid);
        }
      );
    });
  }
  //
  //
  //
  //
  //
  //
  // User.findOne({ token: req.params.token }).then((user) => {
  //   //console.log("test de ce que renvoie user pour create/payment", user);
  //   if (!user) {
  //     res.json({ result: false, error: "Compte utilisateur non trouvé" });
  //     return;
  //   }

  //   Event.findOne({ eventUniqueId: req.params.eventUniqueId })
  //     .populate("guests.userId", [
  //       "userId",
  //       "firstName",
  //       "email",
  //       "share",
  //       "hasPaid",
  //     ])
  //     .populate("transactions")
  //     .then((event) => {
  //       //console.log("event dans route transactions/create/payment:", event);
  //       const shareAmountPerGuest = event.totalSum / event.shareAmount;
  //       console.log(user);
  //       const isWellGuest = event.guests.find(
  //         (guest) => String(guest.userId._id) === String(user._id)
  //       );

  //       console.log({ isWellGuest });

  //       // TODO Renommer variable
  //       if (isWellGuest) {
  //         // Création de la transaction
  //         const userPayment = new Transaction({
  //           type: req.body.type,
  //           eventId: event._id,
  //           emitter: user.token,
  //           recipient: event.eventUniqueId,
  //           name: event.name,
  //           amount: shareAmountPerGuest * isWellGuest.share,
  //           hasPaid: true,
  //         });
  //         // Sauvegarde de la transaction
  //         userPayment.save().then((transactionSaved) => {
  //           console.log("test de ce que renvoie userPayment", transactionSaved);
  //         });
  //       }
  //     });
  // });
});

// Exportation du routeur

// Exportation du routeur
module.exports = router;
