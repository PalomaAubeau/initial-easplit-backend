var express = require('express');
var router = express.Router();

require('../models/connection');
const User = require('../models/users');

const { checkBody } = require('../modules/checkBody');
const bcrypt = require('bcrypt');
const uid2 = require('uid2');


// Route pour le signup
router.post('/signup', (req, res) => {
    // Vérification de la présence des champs obligatoires avec le module checkBody
    if (!checkBody(req.body, ['firstName', 'lastName', 'password', 'email'])) {
        // Si un champ est manquant ou vide, on renvoie une erreur
      res.json({ result: false, error: 'Missing or empty fields' });
      // On arrête la fonction avec return pour ne pas exécuter le code qui suit si une erreur est renvoyée
      return;
    }
  
    // Création du nouvel utilisateur avec vérification de l'éventuel doublon de l'email dans la base de données
    User.findOne({ email: { $regex: new RegExp(req.body.email, 'i') } }).then(data => {
        // Si l'email n'est pas déjà présent dans la base de données
      if (data === null) {
        // Hash du mot de passe pour le stocker en base de données
        const hash = bcrypt.hashSync(req.body.password, 10);
  // Création du nouvel utilisateur
        const newUser = new User({
          firstName: req.body.firstName,
          lastName: req.body.lastName,
          email: req.body.email,
          balance: 0,
          password: hash,
          token: uid2(32),
          events: []
        });
  
        // Sauvegarde du nouvel utilisateur dans la base de données
        newUser.save().then(newDoc => {
            // Renvoi de la réponse au format JSON avec le token de l'utilisateur
          res.json({ result: true, token: newDoc.token });
        });
        // Si une erreur survient lors de la création de l'utilisateur
      } else {
        // Renvoi d'une erreur
        res.json({ result: false, error: 'Email already exists' });
      }
    });
  });

// route for login
router.post('/login', (req, res) => {
    // Vérification de la présence des champs obligatoires avec le module checkBody
    if (!checkBody(req.body, ['email', 'password'])) {
        // Si un champ est manquant ou vide, on renvoie une erreur
      res.json({ result: false, error: 'Missing or empty fields' });
      // On arrête la fonction avec return pour ne pas exécuter le code qui suit si une erreur est renvoyée
      return;
    }
  
    // Recherche de l'utilisateur dans la base de données
    User.findOne({ email: { $regex: new RegExp(req.body.email, 'i') } }).then(data => {
        // Si l'utilisateur est trouvé et que le mot de passe correspond
      if (data && bcrypt.compareSync(req.body.password, data.password)) {
        // Génération d'un nouveau token
        res.json({ result: true, token: data.token, email: data.email, firstName: data.firstName });
        // Si l'utilisateur n'est pas trouvé ou que le mot de passe ne correspond pas
      } else {
        // Renvoi d'une erreur
        res.json({ result: false, error: 'Email not found or wrong password' });
      }
    });
  });

  // route for logout
router.post('/logout', (req, res) => {
    User.findOne({
        // Recherche de l'utilisateur avec le token reçu dans le corps de la requête
        token: req.body.token
        }).then(data => {
            // Si l'utilisateur est trouvé, on supprime le token et on renvoie une réponse positive
        if (data) {
            data.token = '';
            data.save().then(() => {
            res.json({ result: true });
            });
        } else {
            // Si l'utilisateur n'est pas trouvé, on renvoie une erreur
            res.json({ result: false, error: 'User not found' });
        }
        });
    }
);


  
  module.exports = router;

