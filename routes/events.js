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
  const token = req.headers["authorization"];
  // Vérification de l'existence de l'utilisateur
  User.findOne({ token })
    .then((user) => {
      if (!user) {
        res.json({ result: false, error: "Utilisateur non trouvé" });
        return;
      }
      // Vérification des champs
      if (
        !checkBody(req.body, [
          "name",
          "eventDate",
          "paymentDate",
          "description",
        ])
      ) {
        res.json({ result: false, error: "Champs manquants ou vides" });
        return;
      }
      // Vérification des dates
      if (
        isNaN(new Date(req.body.eventDate)) ||
        isNaN(new Date(req.body.paymentDate))
      ) {
        res.json({ result: false, error: "Date invalide" });
        return;
      }
      // Création de l'événement
      const newEvent = new Event({
        organizer: user._id,
        name: req.body.name,
        eventDate: new Date(req.body.eventDate),
        paymentDate: new Date(req.body.paymentDate),
        description: req.body.description,
        guests: [
          { userId: user._id, email: user.email, share: 1, hasPaid: false },
        ],
        totalSum: 0,
        shareAmount: 0,
        transactions: [],
      });
      // Sauvegarde de l'événement
      newEvent.save().then(() => {
        res.json({ result: true, message: "Evenement créé avec succès" });
      });
    })
    .catch((err) => {
      res.json({ result: false, error: err.message });
    });
});

// router.get("/event/:id", (req, res) => {
//   Event.findById(req.params.id)
//     .populate("organizer")
//     .populate("guests.userId")
//     .populate("transactions")
//     .then((event) => {
//       if (!event) {
//         res.json({ result: false, error: "Event not found" });
//         return;
//       }
//       res.json(event);
//     });
// });

// router.get("/userevents", (req, res) => {
//   const token = req.headers['authorization'];

//   User.findOne({ token })
//     .populate("events")
//     .then((user) => {
//       if (!user) {
//         res.json({ result: false, error: "User not found" });
//         return;
//       }
//       res.json({ result: true, events: user.events });
//     });
// });

router.get("/user-events/:token", (req, res) => {
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
