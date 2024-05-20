var express = require("express");
var router = express.Router();

const mongoose = require("mongoose");

require("../models/connection");
const Event = require("../models/events");

const { checkBody } = require("../modules/checkBody");
const bcrypt = require("bcrypt");
const uid2 = require("uid2");

router.post("/createEvent", (req, res) => {
  if (
    !checkBody(req.body, [
      "organizer",
      "name",
      "eventDate",
      "paymentDate",
      "description",
    ])
  ) {
    res.json({ result: false, error: "Missing or empty fields" });
    return;
  } else {
    const newEvent = new Event({
      organizer: req.body.organizer,
      name: req.body.name,
      eventDate: new Date(req.body.eventDate),
      paymentDate: new Date(req.body.paymentDate),
      description: req.body.description,
      guests: req.body.guests,
    });

    newEvent.save().then(() => {
      res.json({ result: "Event successfully created" });
    });
  }
});

// Route pour supprimer un événement
router.delete("/event/:id", (req, res) => {
  Event.deleteOne({ _id: req.params.id })
    .then(result => {
      if (result.deletedCount > 0) {
        res.json({ result: true, message: "Event deleted successfully" });
      } else {
        res.json({ result: false, message: "Event not found" });
      }
    });
});

module.exports = router;
