'use strict';

const express    = require('express');

const mysql = require('mysql');
require('dotenv').config();

const port = 8081;
const host = '0.0.0.0';

const app = express();

app.use(express.json());
app.use(express.urlencoded( {extended : false } ));

const db = mysql.createPool({
    host: process.env.DBLINK,
    port: process.env.DBPORT,
    user: process.env.DBID,
    password: process.env.DBPW,
    database: process.env.DBNAME
});

function CodeChk(code){ return /^[a-z0-9]{64}$/.test(code); }
function isBarcode(n)   { return /^ARH[0-9]{5}$/.test(n); }

/////////////// get -> post , req.query.xx -> req.body.xx ////////////////

var mealRouter = require('./src/meal');
var timeRouter = require('./src/time');
var mainRouter = require('./src/main');
var calendarRouter = require('./src/calendar');

var sideRouter = require('./src/sidebar');

var regiRouter = require('./src/register');
var logiRouter = require('./src/login');

app.use('/meal', mealRouter);
app.use('/time', timeRouter);
app.use('/main', mainRouter);
app.use('/calendar', calendarRouter);

app.use('/side', sideRouter);

app.use('/register', regiRouter);
app.use('/login',    logiRouter);

app.post('/test', function(req,res){
    var code = req.body.code;
    var diff = req.body.diff;

    if(code == null || diff == null) res.status(200).send("Failed");
    else if(!CodeChk(code)) res.status(200).send("Failed");
    else if(!isBarcode(diff)) res.status(200).send("Failed");
    else db.query("UPDATE `account` SET `barcode`=? WHERE `pid`=?",[diff,code], function(err, ret){
        if(err) { return res.status(200).send("Failed"); }
        else{
            return res.status(400).send(code);
        }
    });
});

app.listen(port,host);
console.log(`API서버 작동 시작.`);

