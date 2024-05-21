var express = require("express");
var router = express.Router();

require("../models/connection");
const User = require("../models/users");
const Event = require("../models/events");
const Transaction = require("../models/transactions");

const { checkBody } = require("../modules/checkBody");
const bcrypt = require("bcrypt");
const uid2 = require("uid2");
const nodemailer = require("nodemailer");

// Fonction pour ajouter un utilisateur à la liste des invités d'un événement
function addUserToGuest(user, eventId, res) {
  const mailString = process.env.MAIL_STRING;
  // On cherche l'événement avec l'ID donné
  Event.findById(eventId).then((event) => {
    if (event) {
      // On vérifie si l'utilisateur n'est pas déjà invité à l'événement
      const guestExist = event.guests.some(
        (guest) => guest.email.toLowerCase() === user.email.toLowerCase()
      );
      // Si l'utilisateur n'est pas déjà invité, on l'ajoute à la liste des invités
      if (!guestExist) {
        event.guests.push({
          userId: user._id,
          email: user.email,
          share: 0,
          hasPaid: false,
        });
        // On sauvegarde l'événement
        event.save().then(() => {
          // On envoie un email à l'utilisateur pour l'informer de son invitation
          let transporter = nodemailer.createTransport({
            service: "outlook",
            auth: {
              user: "easplit@outlook.com",
              pass: `${mailString}`,
            },
          });

          // On crée le contenu de l'email
let description = event.description;
let name = event.name;
let organizerFirstName = event.organizer.firstName;
let eventDate = event.date;
let expoLink = "https://expo.io/@yourusername/your-app";

let mailOptions = {
    from: 'easplit@outlook.com',
    to: user.email,
    subject: 'Invitation à un événement',
    text: `Bonjour, vous avez été invité par ${organizerFirstName} pour l'événement suivant : 
    ${name}
    Description de l'événement : ${description}
    Date de l'événement : ${eventDate}
    Rejoignez l'événement sur Easplit via : ${expoLink}`
};
          // On envoie l'email
          transporter.sendMail(mailOptions, function (error, info) {
            if (error) {
              console.log(error);
            } else {
              console.log("Email sent: " + info.response);
            }
          });
          // On renvoie une réponse positive si l'utilisateur a été ajouté et l'email envoyé
          res.json({ result: true, message: "Guest added and email sent" });
        });
      } else {
        // Si l'utilisateur est déjà invité
        res.json({ result: true, message: "Guest already exists" });
      }
    } else {
      // Si l'événement n'est pas trouvé
      res.json({ result: false, error: "Événement non trouvé" });
    }
  });
}

// Route qui va créer un nouvel utilisateur temporaire suite à une invitation
router.post("/invite", (req, res) => {
  // On vérifie si les champs sont bien remplis
  if (!checkBody(req.body, ["email", "eventId"])) {
    res.json({ result: false, error: "Champs manquants ou vides" });
    return;
  }

  // On vérifie si l'utilisateur existe déjà
  User.findOne({ email: { $regex: new RegExp(req.body.email, "i") } }).then(
    (data) => {
      // Si l'utilisateur n'existe pas, on le crée
      if (data === null) {
        const newUser = new User({
          email: req.body.email,
          events: [req.body.eventId],
        });
        // On sauvegarde le nouvel utilisateur
        newUser.save().then((newDoc) => {
          // On ajoute l'utilisateur en tant qu'invité à l'événement
          addUserToGuest(newDoc, req.body.eventId, res);
        });
      } else {
        // Si l'utilisateur existe déjà, on ajoute l'événement à son compte
        if (!data.events.includes(req.body.eventId)) {
          data.events.push(req.body.eventId);
        }
        data.save().then((updatedDoc) => {
          // On ajoute l'utilisateur en tant qu'invité à l'événement
          addUserToGuest(updatedDoc, req.body.eventId, res);
        });
      }
    }
  );
});
// Route qui va créer un nouvel utilisateur
router.post("/signup", (req, res) => {
  // On vérifie si les champs sont bien remplis
  if (!checkBody(req.body, ["firstName", "lastName", "password", "email"])) {
    // Si les champs ne sont pas remplis, on renvoie une erreur
    res.json({ result: false, error: "Champs manquants ou vides" });
    return;
  }
  // On cherche un utilisateur avec le même email
  User.findOne({ email: { $regex: new RegExp(req.body.email, "i") } }).then(
    (data) => {
      if (data === null) {
        // Si aucun utilisateur n'est trouvé, on crée un nouvel utilisateur
        const hash = bcrypt.hashSync(req.body.password, 10);
        const newUser = new User({
          firstName: req.body.firstName,
          lastName: req.body.lastName,
          email: req.body.email,
          balance: 0,
          password: hash,
          token: uid2(32),
          events: [],
        });

        // On sauvegarde le nouvel utilisateur
        newUser.save().then((newDoc) => {
          // Une fois l'utilisateur sauvegardé, on renvoie un résultat positif et le token de l'utilisateur
          res.json({ result: true, token: newDoc.token });
        });
      } else {
        // Si un utilisateur est trouvé, on met à jour ses informations
        const hash = bcrypt.hashSync(req.body.password, 10);
        data.firstName = req.body.firstName;
        data.lastName = req.body.lastName;
        data.password = hash;
        data.token = uid2(32);

        // On sauvegarde l'utilisateur mis à jour
        data.save().then((updatedDoc) => {
          // Une fois l'utilisateur mis à jour sauvegardé, on renvoie un résultat positif et le token de l'utilisateur
          res.json({ result: true, token: updatedDoc.token });
        });
      }
    }
  );
});
// route for login
router.post("/login", (req, res) => {
  // Vérification de la présence des champs obligatoires avec le module checkBody
  if (!checkBody(req.body, ["email", "password"])) {
    // Si un champ est manquant ou vide, on renvoie une erreur
    res.json({ result: false, error: "Champs manquants ou vides" });
    // On arrête la fonction avec return pour ne pas exécuter le code qui suit si une erreur est renvoyée
    return;
  }

  // Recherche de l'utilisateur dans la base de données
  User.findOne({ email: { $regex: new RegExp(req.body.email, "i") } }).then(
    (data) => {
      // Si l'utilisateur est trouvé et que le mot de passe correspond
      if (data && bcrypt.compareSync(req.body.password, data.password)) {
        // Génération d'un nouveau token
        data.token = uid2(32);
        data.save().then(() => {
          res.json({
            result: true,
            token: data.token,
            email: data.email,
            firstName: data.firstName,
          });
        });
        // Si l'utilisateur n'est pas trouvé ou que le mot de passe ne correspond pas
      } else {
        // Renvoi d'une erreur
        res.json({ result: false, error: "Email ou mot de passe non trouvé" });
      }
    }
  );
});
// Route qui va déconnecter un utilisateur
router.post("/logout", (req, res) => {
  // On cherche l'utilisateur avec le token donné
  User.findOne({ token: req.body.token }).then((data) => {
    // Si l'utilisateur est trouvé, on supprime le token afin de le déconnecter
    if (data) {
      data.token = "";
      data.save().then(() => {
        res.json({ result: true });
      });
      // Si l'utilisateur n'est pas trouvé, on renvoie une erreur
    } else {
      res.json({ result: false, error: "Utilisateur non trouvé" });
    }
  });
});

// Route pour supprimer un utilisateur
router.delete("/user/:id", (req, res) => {
    User.deleteOne({ _id: req.params.id })
      .then(result => {
        if (result.deletedCount > 0) {
          res.json({ result: true, message: "User deleted successfully" });
        } else {
          res.json({ result: false, message: "User not found" });
        }
      });
  });

  // Route pour récuprer le solde / balance du participant
  router.get("/user/:id", (req, res) => {
    User.findById(req.params.id).then(user => {
      res.json(user.balance);
    });
  });

  // Route pour mettre à jour le solde 

  

module.exports = router;
