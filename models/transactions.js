const mongoose = require("mongoose");

const transactionSchema = mongoose.Schema({
  amount: Number,
  date: Date,
  invoice: String,
  type: {
    type: String,
    enum: ["refound", "payment", "reload", "expense"],
  },
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: "events" },
  emitter: String,
  recipient: String,
  name: String,
  category: String,
});

const Transaction = mongoose.model("transactions", transactionSchema);

module.exports = Transaction;
