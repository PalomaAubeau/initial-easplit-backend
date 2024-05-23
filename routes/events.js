var express = require("express");
var router = express.Router();

const mongoose = require("mongoose");

require("../models/connection");
const Event = require("../models/events");
const User = require("../models/users");
const Transaction = require("../models/transactions");

const { checkBody } = require("../modules/checkBody");
const bcrypt = require("bcrypt");
const uid2 = require("uid2");

// Route pour créer un événement
router.post("/create-event", (req, res) => {
  if (
    // On vérifie que les champs ne sont pas vides
    !checkBody(req.body, [
      "name",
      "eventDate",
      "paymentDate",
      "description",
      "organizer",
    ])
  ) {
    // Si un champ est vide, on renvoie une erreur
    res.json({ result: false, error: "Champs manquants ou vides" });
    return;
  }

  if (
    isNaN(new Date(req.body.eventDate)) ||
    isNaN(new Date(req.body.paymentDate))
  ) {
    res.json({ result: false, error: "Date invalide" });
    return;
  }
  // On crée un nouvel événement
  const organizer = req.body.organizer;
  const newEvent = new Event({
    organizer: organizer,
    name: req.body.name,
    eventDate: new Date(req.body.eventDate),
    paymentDate: new Date(req.body.paymentDate),
    description: req.body.description,
    guests: [
      { userId: organizer, email: req.body.email, share: 1, hasPaid: false },
    ],
    totalSum: 0,
    shareAmount: 0,
    transactions: [],
  });
  // On sauvegarde l'événement
  newEvent.save().then(() => {
    res.json({ result: true, message: "Event créé avec succès" });
  });
});

// Route pour récupérer un événement
router.get("/event/:id", (req, res) => {
  // On cherche l'événement avec l'id donné
  Event.findById(req.params.id)
    // On récupère les informations de l'organisateur
    .populate("organizer")
    // On récupère les informations des invités
    .populate("guests.userId")
    // On récupère les transactions
    .populate("transactions")
    // On renvoie l'événement
    .then((event) => {
      if (!event) {
        res.json({ result: false, error: "Event non trouvé" });
        return;
      }
      res.json(event);
    });
});

// Route pour récupérer les événements de l'utilisateur connécté
router.get("/userevents/:token", (req, res) => {
  // On cherche l'utilisateur avec le token donné
  User.findOne({ token: req.params.token })
    // On récupère les événements de l'utilisateur
    .populate("events")
    // On renvoie les événements
    .then((user) => {
      // Si l'utilisateur n'est pas trouvé, on renvoie une erreur
      if (!user) {
        res.json({ result: false, error: "User non trouvé" });
        // Arrêt de l'exécution de la fonction
        return;
      }
      // Sinon, on renvoie les événements de l'utilisateur
      res.json({ result: true, events: user.events });
    });
});

module.exports = router;
