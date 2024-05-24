const mongoose = require("mongoose");

const eventSchema = mongoose.Schema({
  eventUniqueId: String,
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
  transactions: [{ type: mongoose.Schema.Types.ObjectId, ref: "transactions" }],
  totalSum: Number,
  shareAmount: Number,
  //  eventId: String,
});

const Event = mongoose.model("events", eventSchema);

module.exports = Event;
