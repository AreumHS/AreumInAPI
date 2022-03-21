var custom = require('../library.js');

const express = require('express');

require('dotenv').config();
const app = express.Router();

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.get('/get', async function (req, res) {
    var ret = await custom.GetWeekMeal();
    if(ret == undefined) { return res.status(400).send("Failed"); }
    else                 { return res.status(200).send(ret); }
});

module.exports = app;