const mongoose = require("mongoose");

const eventSchema = mongoose.Schema({
  organizer: { type: mongoose.Schema.Types.ObjectId, ref: "users" },
  name: String,
  eventDate: Date,
  paymentDate: Date,
  description: String,
  guests: [
    {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: "users" },
      email: String,
      share: Number,
      hasPaid: Boolean,
    },
  ],
  transactions: transactionSchema,
  totalSum: Number,
  shareAmount: Number,
});

const Event = mongoose.model("events", eventSchema);

module.exports = Event;
