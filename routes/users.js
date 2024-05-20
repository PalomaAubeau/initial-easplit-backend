var express = require("express");
var router = express.Router();

require("../models/connection");
const User = require("../models/users");

const { checkBody } = require("../modules/checkBody");
const bcrypt = require("bcrypt");
const uid2 = require("uid2");

// Route qui va créer un nouvel utilisateur temporaire suite à une invitation
router.post("/invite", (req, res) => {
    // On vérifie si les champs sont bien remplis
  if (!checkBody(req.body, ["email"])) {
    res.json({ result: false, error: "Champs manquants ou vides" });
    // On arrête la fonction si les champs ne sont pas remplis
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
          res.json({ result: true });
        });
    } else {
        // Si l'utilisateur existe déjà, on ajoute l'événement à son compte
        data.events.push(req.body.eventId);
        data.save().then(updatedDoc => {
            res.json({ result: true });
        });
    }
});
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
router.post('/login', (req, res) => {
    // Vérification de la présence des champs obligatoires avec le module checkBody
    if (!checkBody(req.body, ['email', 'password'])) {
        // Si un champ est manquant ou vide, on renvoie une erreur
      res.json({ result: false, error: 'Champs manquants ou vides' });
      // On arrête la fonction avec return pour ne pas exécuter le code qui suit si une erreur est renvoyée
      return;
    }
  
    // Recherche de l'utilisateur dans la base de données
    User.findOne({ email: { $regex: new RegExp(req.body.email, 'i') } }).then(data => {
        // Si l'utilisateur est trouvé et que le mot de passe correspond
      if (data && bcrypt.compareSync(req.body.password, data.password)) {
        // Génération d'un nouveau token
        data.token = uid2(32);
        data.save().then(() => {
          res.json({ result: true, token: data.token, email: data.email, firstName: data.firstName });
        });
        // Si l'utilisateur n'est pas trouvé ou que le mot de passe ne correspond pas
      } else {
        // Renvoi d'une erreur
        res.json({ result: false, error: 'Email ou mot de passe non trouvé' });
      }
    });
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

module.exports = router;