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

// Fonction pour gérer les transactions
const handleTransaction = (transaction, res, user = null, event = null) => {
  transaction.save().then((transaction) => {
    if (user) {
      // Vérifier si la transaction est déjà dans les transactions de l'utilisateur
      if (!user.transactions.includes(transaction._id)) {
        user.transactions.push(transaction._id);
      }
      user.save().then(() => {
        if (event) {
          // Vérifier si la transaction est déjà dans les transactions de l'événement
          if (!event.transactions.includes(transaction._id)) {
            event.transactions.push(transaction._id);
            // Mettre à jour le totalSum de l'événement
            event.totalSum += transaction.amount;
          }
          event.save().then(() => {
            handleResponse(res, true, { transaction });
          });
        } else {
          handleResponse(res, true, { transaction });
        }
      });
    } else if (event) {
      // Vérifier si la transaction est déjà dans les transactions de l'événement
      if (!event.transactions.includes(transaction._id)) {
        event.transactions.push(transaction._id);
        // Mettre à jour le totalSum de l'événement
        event.totalSum += transaction.amount;
      }
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
  // Vérifier si les champs sont remplis
  if (!checkBody(req.body, ["date", "type", "emitter"])) {
    return handleResponse(res, false, { error: "Champs manquants ou vides" });
  }
  // Vérifier si le type de transaction est valide
  if (
    req.body.type !== "refound" &&
    (req.body.amount.toString().split(".")[1] || "").length > 2
  ) {
    return handleResponse(res, false, {
      error: "Le solde ne peut pas avoir plus de 2 décimales",
    });
  }
  // Créer une nouvelle transaction
  const transaction = new Transaction(req.body);
  // Vérifier le type de transaction
  switch (req.body.type) {
    case "reload":
      // Vérifier si l'utilisateur existe
      User.findById(req.body.emitter).then((user) => {
        if (!user) {
          return handleResponse(res, false, { error: "Utilisateur non trouvé" });
        }
        // Ajouter le montant au solde de l'utilisateur
        user.balance += Number(req.body.amount);
        // Vérifier si le solde est négatif
        if (user.balance < 0) {
          return handleResponse(res, false, {
            error: "Opération impossible : solde négatif",
          });
        }
        // Sauvegarder l'utilisateur
        user.save().then(() => handleTransaction(transaction, res, user, user));
      });
      break;

    case "payment":
      // Vérifier si l'utilisateur existe
      User.findById(req.body.emitter).then((user) => {
        if (!user) {
          return handleResponse(res, false, { error: "Utilisateur non trouvé" });
        }
        // Vérifier si l'utilisateur a assez de solde
        if (user.balance < Number(req.body.amount)) {
          return handleResponse(res, false, { error: "Solde insuffisant" });
        }
        // Déduire le montant du solde de l'utilisateur
        user.balance -= Number(req.body.amount);
        // Vérifier si le solde est négatif
        if (user.balance < 0) {
          return handleResponse(res, false, {
            error: "Opération impossible : solde négatif",
          });
        }
        // Ajouter la transaction aux transactions de l'utilisateur
        user.transactions.push(transaction);
        // Sauvegarder l'utilisateur
        user.save().then(() => {
          // Vérifier si l'événement existe
          Event.findById(req.body.recipient).then((event) => {
            if (!event) {
              return handleResponse(res, false, { error: "Événement non trouvé" });
            }
            handleTransaction(transaction, res, user, event);
          });
        });
      });
      break;

    case "refound":
      // Vérifier si l'événement existe
      Event.findById(req.body.emitter).then((event) => {
        if (!event) {
          return handleResponse(res, false, { error: "Événement non trouvé" });
        }
        if (event.shareAmount === 0) {
          return handleResponse(res, false, {
            error: "Opération impossible : aucun invité à rembourser",
          });
        }
        // Vérifier si le montant est supérieur au solde de l'événement
        const perShareAmount =
          Number(event.totalSum || 0) / event.shareAmount;
        let promises = event.guests.map((guest) => {
          // Vérifier si l'utilisateur est un invité
          return User.findById(guest.userId).then((user) => {
            // Ajouter le montant au solde de l'utilisateur
            if (user) {
              user.balance += perShareAmount * guest.share;
              return user.save();
            }
          });
        });
        Promise.all(promises).then(() => {
          // Réinitialiser le solde de l'événement
          event.totalSum = 0;
          // Vérifier si le solde de l'événement est un nombre
          if (isNaN(event.totalSum)) {
            return handleResponse(res, false, { error: "Opération invalide" });
          }
          event.save().then(() => handleTransaction(transaction, res, event));
        });
      });
      break;

    case "expense":
      // Vérifier si l'événement existe
      Event.findById(req.body.emitter).then((event) => {
        if (!event) {
          return handleResponse(res, false, { error: "Événement non trouvé" });
        }
        // Vérifier si l'événement a assez de totalSum
        if (event.totalSum < Number(req.body.amount)) {
          return handleResponse(res, false, { error: "Fonds de l'événement insuffisants" });
        }
        // Déduire le montant du totalSum de l'événement
        event.totalSum -= Number(req.body.amount);
        // Sauvegarder l'événement
        event.save().then(() => handleTransaction(transaction, res, event));
      });
      break;

    default:
      return handleResponse(res, false, { error: "Type de transaction invalide" });
  }
});

module.exports = router;