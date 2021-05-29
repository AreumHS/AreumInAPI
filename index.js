'use strict';

const express    = require('express');
const dotenv     = require('dotenv').config();
const mysql      = require('mysql');
const crypto     = require('crypto');
const bodyparser = require('body-parser');

const port = 8081;
const host = '0.0.0.0';

const db = mysql.createConnection({
    host     : process.env.DBLINK,
    port     : process.env.DBPORT,
    user     : process.env.DBID,
    password : process.env.DBPW,
    database : process.env.DBNAME
});

db.connect();
const app = express();

app.use(express.json());
app.use(express.urlencoded( {extended : false } ));

function isNumber(n)    { return /^-?[\d.]+(?:e-?\d+)?$/.test(n); }
function isEmail(email) { return /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/.test(email); }

/////////////// get -> post , req.query.xx -> req.body.xx ////////////////

app.post('/register', function(req,res){ // 회원가입 API
    var id     = req.body.id;
    var name   = req.body.name;
    var pw     = req.body.pw;
    var pw2    = req.body.pw2;
    var email  = req.body.email;
    var code   = req.body.code;

    console.log(req.body);

    if( id    == null ||
        name  == null ||
        pw    == null ||
        pw2   == null ||
        email == null ||
        code  == null
    ){ return res.status(400).json({status: "Failed", log:"NullException"}); }

    if(code != process.env.CODE){ return res.status(400).json({status: "Failed", log:"CodeCheckFailed"}); }

    if(pw != pw2)                       { return res.status(400).json({status: "Failed", log:"PasswordIncorrect"}); }
    if(!isNumber(id) || id.length!=5)   { return res.status(400).json({status: "Failed", log:"IdIncorrect"}); }
    if(!isEmail(email))                 { return res.status(400).json({status: "Failed", log:"EmailIncorrect"}); }
    
    var hash = crypto.createHmac('sha256', process.env.SECRET).update(pw).digest('hex');
    var pid  = crypto.createHmac('sha256', process.env.SECRET).update(id).digest('hex');

    db.query("SELECT * FROM `student-code` WHERE `id`='"+pid+"'", function(err, ret){
        if(err)                  { return res.status(400).json({status: "Failed", log:"DatabaseSelectErr"}); }
        if(ret[0] != undefined)  { return res.status(400).json({status: "Failed", log:"AlreadyUsing"}); }
        else{
            db.query('INSERT INTO `student-code`(`id`, `name`, `password`, `email`) VALUES ("'+pid+'","'+name+'","'+hash+'","'+email+'");', function(error, val){
                if(error){ return res.status(400).json({status: "Failed", log:"DatabaseInsertErr"}); }
            });
            /////////////// 다른 데이터베이스 세팅하는 파트 ////////////////////


            /////////////// 다른 데이터베이스 세팅하는 파트 끝 //////////////////
            console.log(`${id} ${name}님이 성공적으로 회원가입 처리되었습니다.`);
            return res.status(200).json({status: "Succeed", log:"RegisterDone", return: pid});
        }
    });
});

app.listen(port,host);
console.log(`API서버 작동 시작.`);