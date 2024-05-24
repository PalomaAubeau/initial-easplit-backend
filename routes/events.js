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


// const updateUserWithEvent = async (email, eventId) => {
//   try {
//     // Recherche de l'utilisateur par son ID
//     const user = await User.findOne(email);
//     // Si l'utilisateur est trouvé, mettre à jour son champ events avec l'ID de l'événement
//     if (user) {
//       user.events.push(eventId);
//       await user.save();
//     } else {
//       console.log(`Utilisateur avec l'email ${email} non trouvé`);
//     }
//   } catch (error) {
//     console.error('Erreur lors de la mise à jour de l\'utilisateur avec l\'événement :', error);
//   }
// };


// Route pour créer un événement
router.post("/create-event/:token", (req, res) => {
  const token = req.params.token;
// Vérification de l'existence de l'utilisateur
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
        totalSum: req.body.totalSum || null,
        shareAmount: req.body.shareAmount || null,
        transactions: [],
      });
// Sauvegarde de l'événement
      newEvent.save().then((data) => {
        res.json({ result: true, message: "Evenement créé avec succès", data: data });
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
      const { name, organizer, guests, transactions, totalSum, shareAmount } =
        event; // destruration de l'objet (clean-code) rajouter des champs si besoin
      res.json({
        result: true,
        event: { name, organizer, guests, transactions, totalSum, shareAmount }, // même clés que dans la destructuration
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
