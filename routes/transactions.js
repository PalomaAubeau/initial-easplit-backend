var express = require("express");
var router = express.Router();

require("../models/connection");
const User = require("../models/users");
const Event = require("../models/events");
const Transaction = require("../models/transactions");

const { checkBody } = require("../modules/checkBody");

router.post("/create/reload", (req, res) => {
  if (!checkBody(req.body, ["emitter", "recipient"])) {
    return res.status(400).json({ error: "Invalid body" });
  }
  const transaction = new Transaction(req.body);
  transaction.save().then(() => {
    User.findById(req.body.emitter).then((user) => {
      if (!user) {
        return res.status(400).json({ error: "User not found" });
      }
      user.balance += Number(req.body.amount);
      if (user.balance < 0) {
        return res.status(400).json({ error: "Insufficient balance" });
      }
      user.transactions.push(transaction._id);
      user.save().then(() => res.json({ response: true, transaction }));
    });
  });
});

router.post("/create/payment", (req, res) => {
  if (!checkBody(req.body, ["emitter", "name", "amount", "recipient"])) {
    return res.status(400).json({ error: "Invalid body" });
  }
  const transaction = new Transaction(req.body);
  transaction.save().then(() => {
    User.findById(req.body.emitter).then((user) => {
      if (!user) {
        return res.status(400).json({ error: "User not found" });
      }
      if (user.balance < Number(req.body.amount)) {
        return res.status(400).json({ error: "Insufficient balance" });
      }
      user.balance -= Number(req.body.amount);
      user.transactions.push(transaction._id);
      user.save().then(() => {
        Event.findById(req.body.recipient).then((event) => {
          if (!event) {
            return res.status(400).json({ error: "Event not found" });
          }
          event.transactions.push(transaction._id);
          event.save().then(() => res.json({ response: true, transaction }));
        });
      });
    });
  });
});

router.post("/create/refound", (req, res) => {
  if (!checkBody(req.body, ["emitter", "eventId"])) {
    return res.status(400).json({ error: "Invalid body" });
  }
  const transaction = new Transaction(req.body);
  transaction.save().then(() => {
    Event.findById(req.body.emitter).then((event) => {
      if (!event) {
        return res.status(400).json({ error: "Event not found" });
      }
      if (event.shareAmount === 0) {
        return res.status(400).json({ error: "No guests to refund" });
      }
      const perShareAmount = Number(event.totalSum || 0) / event.shareAmount;
      let promises = event.guests.map((guest) => {
        return User.findById(guest.userId).then((user) => {
          if (!user) {
            console.log(`User with ID ${guest.userId} not found`);
            return;
          }
          if (!user.transactions) {
            user.transactions = [];
          }
          user.balance += perShareAmount * guest.share;
          user.transactions.push(transaction._id);
          return user.save();
        });
      });
      Promise.all(promises).then(() => {
        event.totalSum = 0;
        if (isNaN(event.totalSum)) {
          return res.status(400).json({ error: "Invalid operation" });
        }
        event.transactions.push(transaction._id);
        event.save().then(() => res.json({ response: true, transaction }));
      });
    });
  });
});

router.post("/create/expense", (req, res) => {
  if (!checkBody(req.body, ["emitter", "amount"])) {
    return res.status(400).json({ error: "Invalid body" });
  }
  const transaction = new Transaction(req.body);
  transaction.save().then(() => {
    Event.findById(req.body.emitter).then((event) => {
      if (!event) {
        return res.status(400).json({ error: "Event not found" });
      }
      if (event.totalSum < Number(req.body.amount)) {
        return res.status(400).json({ error: "Insufficient event funds" });
      }
      event.totalSum -= Number(req.body.amount);
      event.transactions.push(transaction._id);
      event.save().then(() => res.json({ response: true, transaction }));
    });
  });
});

router.get("/userTransactions/:userId", async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).populate(
      "transactions"
    );
    if (!user) {
      return res.json({ response: false, error: "Utilisateur non trouvé" });
    }
    res.json({ response: true, transactions: user.transactions });
  } catch (error) {
    res.json({ response: false, error: error.message });
  }
});

// Route pour récupérer les détails d'une transaction spécifique
router.get("/:transactionId", async (req, res) => {
  try {
    const transaction = await Transaction.findById(
      req.params.transactionId
    ).populate("eventId");
    if (!transaction) {
      return res.json({ response: false, error: "Transaction non trouvée" });
    }
    res.json({ response: true, transaction });
  } catch (error) {
    res.json({ response: false, error: error.message });
  }
});

module.exports = router;
