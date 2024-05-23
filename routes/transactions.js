var express = require("express");
var router = express.Router();

require("../models/connection");
const User = require("../models/users");
const Event = require("../models/events");
const Transaction = require("../models/transactions");

const { checkBody } = require("../modules/checkBody");

// Fonction pour gérer les réponses
const handleResponse = (res, success, data) => {
  if (success) {
    return res.json({ status: 200, data: data });
  } else {
    return res.json({ status: 400, data: data });
  }
};

// Fonction pour gérer la sauvegarde des transactions afin d'éviter les répétitions dans la route
const handleTransaction = (transaction, res, user = null, event = null) => {
  transaction.save().then((transaction) => {
    // Vérification de l'existence de l'utilisateur
    if (user) {
      // Vérification de l'existence de la transaction dans les transactions de l'utilisateur
      if (!user.transactions.includes(transaction._id)) {
        // Ajout de la transaction aux transactions de l'utilisateur
        user.transactions.push(transaction._id);
      }
      user.save().then(() => {
        // Vérification de l'existence de l'événement
        if (event) {
          // Vérification de l'existence de la transaction dans les transactions de l'événement
          if (!event.transactions.includes(transaction._id)) {
            event.transactions.push(transaction._id);
            // Mise à jour du totalSum de l'événement
            event.totalSum += transaction.amount;
          }
          // Sauvegarde de l'événement
          event.save().then(() => {
            handleResponse(res, true, { transaction });
          });
        } else {
          handleResponse(res, true, { transaction });
        }
      });
    } else if (event) {
      // Vérification de l'existence de la transaction dans les transactions de l'événement
      if (!event.transactions.includes(transaction._id)) {
        event.transactions.push(transaction._id);
        // Mise à jour du totalSum de l'événement
        event.totalSum += transaction.amount;
      }
      // Sauvegarde de l'événement
      event.save().then(() => {
        handleResponse(res, true, { transaction });
      });
    } else {
      handleResponse(res, true, { transaction });
    }
  });
};

// Route pour créer une transaction
router.post("/create", (req, res) => {
  // Vérification si les champs sont remplis
  if (!checkBody(req.body, ["date", "type", "emitter", "name"])) {
    return handleResponse(res, false, { error: "Champs manquants ou vides" });
  }
  // Vérification si le type de transaction est valide
  if (
    req.body.type !== "refound" &&
    // Vérification si le montant est un nombre et s'il a plus de 2 décimales après la virgule
    (req.body.amount.toString().split(".")[1] || "").length > 2
  ) {
    // Envoi d'une erreur si le montant a plus de 2 décimales
    return handleResponse(res, false, {
      error: "Le solde ne peut pas avoir plus de 2 décimales",
    });
  }
  // Création d'une nouvelle transaction
  const transaction = new Transaction(req.body);
  // Vérification du type de transaction
  switch (req.body.type) {
    case "reload":
      // Vérification si l'utilisateur existe
      User.findById(req.body.emitter).then((user) => {
        // Envoi d'une erreur si l'utilisateur n'existe pas
        if (!user) {
          return handleResponse(res, false, {
            error: "Utilisateur non trouvé",
          });
        }
        // Ajout du montant au solde de l'utilisateur
        user.balance += Number(req.body.amount);
        // Vérification si le solde est négatif
        if (user.balance < 0) {
          // Envoi d'une erreur si le solde est négatif
          return handleResponse(res, false, {
            error: "Opération impossible : solde négatif",
          });
        }
        // Sauvegarde de la transaction et l'utilisateur
        user.save().then(() => handleTransaction(transaction, res, user, user));
      });
      break;

    case "payment":
      // Vérification si l'utilisateur existe
      User.findById(req.body.emitter).then((user) => {
        if (!user) {
          return handleResponse(res, false, {
            error: "Utilisateur non trouvé",
          });
        }
        // Vérification si le montant est supérieur au solde de l'utilisateur
        if (user.balance < Number(req.body.amount)) {
          return handleResponse(res, false, { error: "Solde insuffisant" });
        }
        // Déduction du montant sur le solde de l'utilisateur
        user.balance -= Number(req.body.amount);
        // Vérification si le solde est négatif
        if (user.balance < 0) {
          return handleResponse(res, false, {
            error: "Opération impossible : solde négatif",
          });
        }
        // Ajout de la transaction aux transactions de l'utilisateur
        user.transactions.push(transaction);
        // Sauvegarde de la transaction et l'utilisateur
        user.save().then(() => {
          // Vérification si le destinataire existe
          Event.findById(req.body.recipient).then((event) => {
            if (!event) {
              // Envoi d'une erreur si le destinataire n'existe pas
              return handleResponse(res, false, {
                error: "Événement non trouvé",
              });
            }
            // Ajout du montant au solde de l'événement
            handleTransaction(transaction, res, user, event);
          });
        });
      });
      break;

    case "refound":
      // Vérifcaton si l'événement existe
      Event.findById(req.body.emitter).then((event) => {
        // Envoi d'une erreur si l'événement n'existe pas
        if (!event) {
          // Envoi d'une erreur si l'événement n'existe pas
          return handleResponse(res, false, { error: "Événement non trouvé" });
        }
        // Vérification si l'événement a des invités et donc des parts
        if (event.shareAmount === 0) {
          return handleResponse(res, false, {
            error: "Opération impossible : aucun invité à rembourser",
          });
        }
        // Vérifier si le montant est supérieur au solde de l'événement
        const perShareAmount = Number(event.totalSum || 0) / event.shareAmount;
        let promises = event.guests.map((guest) => {
          // Vérifier si l'utilisateur est un invité
          return User.findById(guest.userId).then((user) => {
            // Vérifier si l'utilisateur existe
            if (user) {
              // Ajouter le montant à l'utilisateur
              user.balance += perShareAmount * guest.share;
              return user.save();
            }
          });
        });
        // Nous attendons que toutes les promesses soient résolues
        Promise.all(promises).then(() => {
          // Réinitialisation du totalSum de l'événement
          event.totalSum = 0;
          // Envoi d'une erreur si le totalSum n'est pas un nombre
          if (isNaN(event.totalSum)) {
            return handleResponse(res, false, { error: "Opération invalide" });
          }
          // Sauvegarde de l'événement
          event.save().then(() => handleTransaction(transaction, res, event));
        });
      });
      break;

    case "expense":
      // Vérification si l'événement existe
      Event.findById(req.body.emitter).then((event) => {
        // Envoi d'une erreur si l'événement n'existe pas
        if (!event) {
          return handleResponse(res, false, { error: "Événement non trouvé" });
        }
        // Vérification si le montant est supérieur au totalSum de l'événement
        if (event.totalSum < Number(req.body.amount)) {
          return handleResponse(res, false, {
            error: "Fonds de l'événement insuffisants",
          });
        }
        // Déduction du montant du totalSum de l'événement
        event.totalSum -= Number(req.body.amount);
        // Sauvegarde de l'événement
        event.save().then(() => handleTransaction(transaction, res, event));
      });
      break;

    default:
      // Envoi d'une erreur si le type de transaction est invalide
      return handleResponse(res, false, {
        error: "Type de transaction invalide",
      });
  }
});

router.get('/userTransactions/:userId', async (req, res) => {
  try {
  const user = await User.findById(req.params.userId).populate('transactions');
  if (!user) {
  return res.json({ response: false, error: 'Utilisateur non trouvé' });
  }
  res.json({ response: true, transactions: user.transactions });
  } catch (error) {
  res.json({ response: false, error: error.message });
  }
  });
  
  // Route pour récupérer les détails d'une transaction spécifique
  router.get('/:transactionId', async (req, res) => {
  try {
  const transaction = await Transaction.findById(req.params.transactionId).populate('eventId');
  if (!transaction) {
  return res.json({ response: false, error: 'Transaction non trouvée' });
  }
  res.json({ response: true, transaction });
  } catch (error) {
  res.json({ response: false, error: error.message });
  }
  });

module.exports = router;
