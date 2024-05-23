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
  //  Vérification des champs
  const token = req.headers["authorization"];
  User.findOne({ token })
    .then((user) => {
      if (!user) {
        res.json({ result: false, error: "Utilisateur non trouvé" });
        return;
      }
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
        res.json({ result: false, error: "Date invalidepull" });
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
      newEvent.save().then((savedEvent) => {
        // Ajout de l'événement à l'utilisateur
        User.updateOne({ _id: user._id }, { $push: { events: savedEvent._id } })
          .then(() => {
            res.json({ result: true, message: "Evenement créé avec succès" });
          })
          .catch((err) => {
            res.json({ result: false, error: err.message });
          });
      });
    })
    .catch((err) => {
      res.json({ result: false, error: err.message });
    });
});

router.get("/event/:id", (req, res) => {
  Event.findById(req.params.id)
    .populate("organizer")
    .populate("guests.userId")
    .populate("transactions")
    .then((event) => {
      if (!event) {
        res.json({ result: false, error: "Évènement non trouvé" });
        return;
      }
      const { name, organizer, guests, transactions } = event; // destruration de l'objet (clean-code) rajouter des champs si besoin
      res.json({
        result: true,
        event: { name, organizer, guests, transactions }, // même clés que dans la destructuration
      });
    });
});

// router.get("/user-events", (req, res) => {
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
  User.findOne({ token: req.params.token })
    .populate("events")
    .then((user) => {
      if (!user) {
        res.json({ result: false, error: "User non trouvé" });
        return;
      }
      res.json({ result: true, events: user.events });
    });
});

module.exports = router;
