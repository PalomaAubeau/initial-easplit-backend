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
router.post("/createEvent", (req, res) => {
  if (
    // On vérifie si les champs sont bien remplis
    !checkBody(req.body, [
      "organizer",
      "name",
      "eventDate",
      "paymentDate",
      "description",
    ])
  ) {
    // Si un champ est manquant ou vide, on renvoie une erreur
    res.json({ result: false, error: "Missing or empty fields" });
    return;
  }

  // On vérifie si les dates sont valides
  if (
    isNaN(new Date(req.body.eventDate)) ||
    isNaN(new Date(req.body.paymentDate))
  ) {
    res.json({ result: false, error: "Invalid date" });
    return;
  }
  // On crée un nouvel événement
  const newEvent = new Event({
    organizer: req.body.organizer,
    name: req.body.name,
    eventDate: new Date(req.body.eventDate),
    paymentDate: new Date(req.body.paymentDate),
    description: req.body.description,
    guests: req.body.guests,
    totalSum: 0,
    shareAmount: 0,
    transactions: [],
  });
  // On sauvegarde l'événement
  newEvent.save().then(() => {
    res.json({ result: "Event successfully created" });
  });
});

// Route pour supprimer un événement
router.delete("/event/:id", (req, res) => {
  // On supprime l'événement avec l'id donné
  Event.deleteOne({ _id: req.params.id }).then((result) => {
    // Si l'événement est supprimé, on renvoie un message de succès
    if (result.deletedCount > 0) {
      res.json({ result: true, message: "Event deleted successfully" });
    } else {
      // Sinon, on renvoie une erreur
      res.json({ result: false, message: "Event not found" });
    }
  });
});

// Route pour récupérer tous les événements
router.get("/events", (req, res) => {
  Event.find().then((events) => {
    res.json(events);
  });
});

// Route pour récupérer un événement
router.get("/event/:id", (req, res) => {
  Event.findById(req.params.id).then((event) => {
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
        res.json({ result: false, error: "User not found" });
        // Arrêt de l'exécution de la fonction
        return;
      }
      // Sinon, on renvoie les événements de l'utilisateur
      res.json({ result: true, events: user.events });
    });
});

module.exports = router;
