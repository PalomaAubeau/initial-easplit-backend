const mongoose = require("mongoose");

const transactionSchema = mongoose.Schema({
  amount: Number,
  date: String,
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

transactionSchema.pre('save', function(next) {
  let parts = this.date.split("/");
  let dateObject = new Date(+parts[2], parts[1] - 1, +parts[0]);
  this.date = dateObject;
  next();
});

const Transaction = mongoose.model("transactions", transactionSchema);

module.exports = Transaction;
