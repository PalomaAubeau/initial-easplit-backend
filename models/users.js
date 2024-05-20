const mongoose = require("mongoose");

const userSchema = mongoose.Schema({
  firstName: String,
  lastName: String,
  password: String,
  token: String,
  email: String,
  events: [{ type: mongoose.Schema.Types.ObjectId, ref: "events" }],
  balance: Number, //zéro par défaut au départ
  transactions: [{ type: mongoose.Schema.Types.ObjectId, ref: "transactions" }],
});

const User = mongoose.model("users", userSchema);

module.exports = User;
