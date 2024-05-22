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
          share: 1,
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
            from: "easplit@outlook.com",
            to: user.email,
            subject: "Invitation à un événement",
            text: `Bonjour, vous avez été invité par ${organizerFirstName} pour l'événement suivant : 
    ${name}
    Description de l'événement : ${description}
    Date de l'événement : ${eventDate}
    Rejoignez l'événement sur Easplit via : ${expoLink}`,
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
          res.json({
            result: true,
            message: "Invitation envoyée",
          });
        });
      } else {
        // Si l'utilisateur est déjà invité
        res.json({ result: true, message: "Compte déjà existant" });
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
      if (data !== null && data.password && data.firstName && data.lastName) {
        // Si un utilisateur est trouvé avec non-empty password, firstName, and lastName, on renvoie une erreur
        res.json({ result: false, error: "Compte déjà existant" });
      } else {
        // Si aucun utilisateur n'est trouvé, or the user has empty password, firstName, or lastName, on crée un nouvel utilisateur
        const hash = bcrypt.hashSync(req.body.password, 10);
        const updatedUser = {
          firstName: req.body.firstName,
          lastName: req.body.lastName,
          email: req.body.email,
          balance: 0,
          password: hash,
          token: uid2(32),
          events: data && data.events ? data.events : [],
        };

        // On met à jour l'utilisateur s'il existe déjà, sinon on le crée
        if (data !== null) {
          User.updateOne({ _id: data._id }, updatedUser).then(() => {
            // Une fois l'utilisateur mis à jour, on renvoie un résultat positif et le token de l'utilisateur
            res.json({ result: true, token: updatedUser.token });
          });
        } else {
          // On crée un nouvel utilisateur
          const newUser = new User(updatedUser);
          newUser.save().then((newDoc) => {
            // Une fois l'utilisateur créé, on renvoie un résultat positif et le token de l'utilisateur
            res.json({ result: true, token: newDoc.token });
          });
        }
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
            balance: data.balance,
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
  User.deleteOne({ _id: req.params.id }).then((result) => {
    if (result.deletedCount > 0) {
      res.json({ result: true, message: "User supprimé avec succès" });
    } else {
      res.json({ result: false, message: "User non trouvé" });
    }
  });
});

// Route pour récuprer le solde / balance du participant
router.get("/user/:id", (req, res) => {
  User.findById(req.params.id).then((user) => {
    res.json(user.balance);
  });
});

// // Route pour mettre à jour le solde du participant
// router.put("/user/:id/transaction", (req, res) => {
//   // On cherche l'utilisateur avec l'ID donné
//   User.findById(req.params.id).then((user) => {
//     // On récupère la transaction envoyée dans le body de la requête
//     const transaction = req.body.transaction;
//     // On vérifie le type de transaction pour mettre à jour le solde de l'utilisateur
//     if (
//       ["payment", "expense"].includes(transaction.type) &&
//       transaction.emitter === user._id.toString()
//     ) {
//       // On déduit si la transaction est un paiement ou une dépense et que l'utilisateur est l'émetteur
//       user.balance -= transaction.amount;
//     } else if (
//       ["refound", "reload"].includes(transaction.type) &&
//       transaction.recipient === user._id.toString()
//     ) {
//       // On ajoute si la transaction est un remboursement ou un rechargement et que l'utilisateur est le destinataire
//       user.balance += transaction.amount;
//     }
//     // On sauvegarde l'utilisateur avec le nouveau solde
//     user.save().then(() => {
//       res.json({ result: "Balance updated", balance: user.balance });
//     });
//   });
// });

module.exports = router;
