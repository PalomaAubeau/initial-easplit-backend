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
const cloudinary = require("cloudinary").v2;
const uniqid = require("uniqid");
const fs = require("fs");

const { addUserToGuest } = require("./users");

// Route utilisée dans le screen CreateEventScreen
router.post("/create-event/:token", async (req, res) => {
  // on récupère le token de l'utilisateur
  const token = req.params.token;
  User.findOne({ token })
    .then(async (user) => {
      if (!user) {
        res.json({ result: false, error: "Utilisateur non trouvé" });
        return;
      }
      // on vérifie que les champs obligatoires sont bien remplis
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
        //console.log("Request body:", req.body);
        res.json({ result: false, error: "Champs manquants ou vides" });
        return;
      }
      // on vérifie que les dates sont valides
      if (
        isNaN(new Date(req.body.eventDate)) ||
        isNaN(new Date(req.body.paymentDate))
      ) {
        res.json({ result: false, error: "Date invalide" });
        return;
      }
      // on vérifie que le montant total est un nombre
      let organizerShare = 1;

      // On definit guests comme un tableau contenant dejà l'organisateur
      const guests = [
        {
          userId: user._id,
          email: user.email,
          share: organizerShare,
          hasPaid: false,
        },
      ];
      // On definit shareAmount comme un nombre
      let shareAmount = 0;
      // On boucle sur les participants
      for (let participant of req.body.guests) {
        let participantShare = Number(participant.parts);
        if (isNaN(participantShare)) {
          res.json({
            result: false,
            error: "Le partage doit être un nombre",
          });
          return;
        }
        // On vérifie que l'organisateur n'est pas dans la liste des participants
        if (participant.email === user.email) {
          organizerShare = participantShare;
          // On met à jour le share de l'organisateur
          guests[0].share = organizerShare;
        } else {
          // On vérifie si l'utilisateur est déjà enregistré
          let participantUser = await User.findOne({
            email: participant.email,
          });

          // Si l'utilisateur n'est pas enregistré, on le crée
          if (!participantUser) {
            participantUser = new User({ email: participant.email });
            await participantUser.save();
          }
          // On ajoute le participant à la liste des participants
          guests.push({
            userId: participantUser._id,
            email: participantUser.email,
            share: participantShare,
            hasPaid: false,
          });
        }
        // On met à jour le montant total
        shareAmount += participantShare;
      }
      // On crée l'évènement
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
      // On sauvegarde l'évènement
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
        // On ajoute l'évènement à la liste des évènements de l'organisateur
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

//Route utilisée dans le screen EventScreen (récupération des données d'un évènement ciblé)
router.get("/event/:id", (req, res) => {
  Event.findById(req.params.id)
    .populate("organizer", ["firstName", "email"])
    .populate("guests.userId", [
      "userId",
      "firstName",
      "email",
      "share",
      "hasPaid",
    ]) //Récupération des champs qui nous intéresse dans l'object
    .populate("transactions")
    .then((event) => {
      if (!event) {
        res.json({ result: false, error: "Évènement non trouvé" });
        return;
      }
      res.json({
        result: true,
        event, // on renvoie l'object event au complet dans le champs event soit => event: event
      });
    });
});

//Route utilisée dans le screen EventsListScreen (récupération de la liste des évènements grâce au token de l'user)
router.get("/user-events/:token", (req, res) => {
  User.findOne({ token: req.params.token })
    .populate("events")
    .then((user) => {
      if (!user) {
        res.json({ result: false, error: "Compte utilisateur non trouvé" });
        return;
      }
      res.json({ result: true, events: user.events });
    });
});

// route pour fetch l'organisateur d'un évènement
router.get("/organizer/:eventId", (req, res) => {
  console.log('Received request for event:', req.params.eventId);

  Event.findById(req.params.eventId)
    .populate("organizer")
    .then((event) => {
      if (!event) {
        console.log('Event not found:', req.params.eventId); 
        res.json({ result: false, error: "Évènement non trouvé" });
        return;
      }
      console.log('Found event:', event);
      res.json({ result: true, organizer: event.organizer });
    });
});

//Route pour upload les fichiers
//route test beranger
router.post("/upload", async (req, res) => {
  try {
    if (!req.files || !req.files.photoFromFront) {
      return res.status(400).json({ result: false, error: "No file uploaded" });
    }

    const photoPath = `/tmp/${uniqid()}.jpg`;
    await req.files.photoFromFront.mv(photoPath);

    const resultCloudinary = await cloudinary.uploader.upload(photoPath);
    res.json({ result: true, url: resultCloudinary.secure_url });
    console.log(resultCloudinary.secure_url);

    fs.unlinkSync(photoPath);
  } catch (error) {
    console.error(error);
    res.status(500).json({ result: false, error: error.message });
  }
});



module.exports = router;
