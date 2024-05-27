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

const { addUserToGuest } = require("./users");

router.post("/create-event/:token", async (req, res) => {
  const token = req.params.token;
  User.findOne({ token })
    .then(async (user) => {
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
          "guests",
          "totalSum",
        ])
      ) {
        console.log("Request body:", req.body);
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
      let organizerShare = 1;
      const guests = [
        {
          userId: user._id,
          email: user.email,
          share: organizerShare,
          hasPaid: false,
        },
      ];
      let shareAmount = 0;
      for (let participant of req.body.guests) {
        let participantShare = Number(participant.parts);
        if (isNaN(participantShare)) {
          res.json({
            result: false,
            error: "Invalid share amount for participant",
          });
          return;
        }
        if (participant.email === user.email) {
          organizerShare = participantShare;
          guests[0].share = organizerShare;
        } else {
          let participantUser = await User.findOne({
            email: participant.email,
          });
          if (!participantUser) {
            participantUser = new User({ email: participant.email });
            await participantUser.save();
          }
          guests.push({
            userId: participantUser._id,
            email: participantUser.email,
            share: participantShare,
            hasPaid: false,
          });
        }
        shareAmount += participantShare;
      }
      const newEvent = new Event({
        eventUniqueId: uid2(32),
        organizer: user._id,
        name: req.body.name,
        eventDate: new Date(req.body.eventDate),
        paymentDate: new Date(req.body.paymentDate),
        description: req.body.description,
        guests: guests,
        totalSum: req.body.totalSum,
        shareAmount: shareAmount,
        transactions: [],
      });

      newEvent.save().then(async (data) => {
        for (let guest of guests) {
          if (guest.userId.toString() !== user._id.toString()) {
            let guestUser = await User.findOne({ _id: guest.userId });
            if (guestUser) {
              guestUser.events.push(data._id);
              await guestUser.save();
            }
          }
        }

        let organizerUser = await User.findOne({ _id: newEvent.organizer });
        if (organizerUser) {
          organizerUser.events.push(data._id);
          await organizerUser.save();
        }

        res.json({
          result: true,
          message: "Evenement créé avec succès",
          data: data,
        });
      });
    })
    .catch((err) => {
      res.json({ result: false, error: err.message });
    });
});

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

//Route utilisée dans le screen EventScreen
router.get("/event/:id", (req, res) => {
  Event.findById(req.params.id)
    .populate("organizer", ["firstName", "email"])
    .populate("guests", ["firstName", "email", "share", "hasPaid"]) //Récupération des champs qui nous intéresse dans l'object
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

//Route utilisée dans le screen EventsListScreen
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

module.exports = router;
