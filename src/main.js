'use strict';

var custom = require('../library.js');

const express    = require('express');

require('dotenv').config();

const app = express.Router();
app.use(express.json());
app.use(express.urlencoded( {extended : false } ));

app.get('/get', async function(req,res){
    var table   = await custom.GetDayTimeTable(req.query.code);
    //var weather = await custom.GetDayWeather();
    var meal = await custom.GetDayMeal();
    //var notice = await custom.GetNotice();
    var barcode = await custom.GetLibCode(req.query.code);

    if(table == "Failed" || meal == "Failed") return res.status(200).send(Failed);
    return res.status(200).send({meal: meal, table: table, barcode: barcode});
});
module.exports = app;