'use strict';

var custom = require('../library.js');

const express = require('express');
const mysql = require('mysql');
const crypto = require('crypto');

require('dotenv').config();

const db = mysql.createPool({
    host: process.env.DBLINK,
    port: process.env.DBPORT,
    user: process.env.DBID,
    password: process.env.DBPW,
    database: process.env.DBNAME
});

const app = express.Router();


app.use(express.json());
app.use(express.urlencoded({ extended: false }));

function primaryChk(n)  { return /^[A-Za-z0-9!@#$%^&*]{4,32}$/.test(n); }

app.post('/post', function(req,res){
    var id = req.body.id;
    var pw = req.body.pw;

    if(id==null || pw==null) { return res.status(200).send("Failed"); }
    else if(!primaryChk(id)) { return res.status(200).send("Failed"); }
    else if(!primaryChk(pw)) { return res.status(200).send("Failed"); }
    else {
        var hash = crypto.createHmac('sha256', process.env.SECRET).update(pw).digest('hex');

        db.query("SELECT `pid`,`loginpw` FROM `account` WHERE `loginid`=?",[id], function(err, ret){
            if(err)                  { return res.status(200).send("Failed"); }
            if(ret[0] == undefined)  { return res.status(200).send("Failed"); }
            else{
                if(ret[0].loginpw != hash){ return res.status(200).send("Failed"); }
                return res.status(200).send(ret[0].pid);
            }
        });
    }
});


app.get('/get', async function(req,res){
    var ret = await custom.GetDayMeal();
    if(ret == undefined) { return res.status(200).send("Failed"); }
    else                 { return res.status(200).send(ret); }
});

module.exports = app;