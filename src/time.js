'use strict';

var custom = require('../library.js');

const express    = require('express');

require('dotenv').config();

const app = express.Router();
app.use(express.json());
app.use(express.urlencoded( {extended : false } ));

app.get('/get', async function(req,res){
    var ret  = await custom.GetWeekTimeTable(req.query.code);
    var ret2 = await custom.GetSchNumToArr(req.query.code);

    if(ret == "Failed" || ret2 == "Failed") return res.status(200).send("Failed");
    return res.status(200).send({title:ret2, body:ret});
});
module.exports = app;