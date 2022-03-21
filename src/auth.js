'use strict';

const express    = require('express');
const dotenv     = require('dotenv').config();
const mysql      = require('mysql');
const crypto     = require('crypto');
const nodemailer = require('nodemailer');
const moment     = require('moment');

const dbquery = {
    host: process.env.DBLINK,
    port: process.env.DBPORT,
    user: process.env.DBID,
    password: process.env.DBPW,
    database: process.env.DBNAME
};

const app = express.Router();

app.use(express.json());
app.use(express.urlencoded( {extended : false } ));

var tmpdate = moment();
var emailtime = tmpdate.add(9,"hours").format('YYYY년 MM월 DD일 hh:mm:ss');

function isNumber(n)    { return /^-?[\d.]+(?:e-?\d+)?$/.test(n); }
/////////////// get -> post , req.query.xx -> req.body.xx ////////////////

app.get('/getid', function(req,res){
    const db = mysql.createConnection(dbquery);
    db.connect();

    var code = req.query.code;
    if(code == null) return res.status(400).json({status:"failed", log:"NullException"});

    db.query("SELECT `id` FROM `student-code` WHERE pid='"+code+"'", function(err,ret){
        if (err) { return res.status(400).json({ status: "Failed", log: "DatabaseErr" }); }
        if (ret[0] == undefined) { return res.status(400).json({ status: "Failed", log: "DatabaseFindFailed" }); }
        return res.status(200).json({ status: "Succeed", log: "GetId", return: ret[0] });
    });

    db.end();
});

app.post('/changepass', function(req,res){ // 비밀번호 변경 API
    const db = mysql.createConnection(dbquery);
    db.connect();

    var pid = req.body.pid;
    var nextpw = req.body.nextpw;
    var email = req.body.email;

    if(pid==null || nextpw==null || email==null) { return res.status(400).json({status: "Failed", log:"NullException"}); }
    if(!isEmail(email))                          { return res.status(400).json({status: "Failed", log:"EmailIncorrect"}); }

    var nexthash = crypto.createHmac('sha256', process.env.SECRET).update(nextpw).digest('hex');

    db.query("SELECT * FROM `student-code` WHERE `pid`='"+pid+"'", function(err, ret){
        if(err)                  { return res.status(400).json({status: "Failed", log:"DatabaseErr"}); }
        if(ret[0] == undefined)  { return res.status(400).json({status: "Failed", log:"PidIsntExist"}); }
        else{
            if(ret[0].email != email)   { return res.status(400).json({status: "Failed", log:"EmailFalse"}); }

            db.query("UPDATE `student-code` SET `password`='"+nexthash+"' WHERE `pid`='"+pid+"'", function(err, ret){
                if(err) { return res.status(400).json({status: "Failed", log:"DatabaseErr"}); }
            });

            const mail = nodemailer.createTransport({
                service: 'gmail',
                auth: { user: process.env.MAIL_USER, pass: process.env.MAIL_PASS },
                tls:  { rejectUnauthorized: false }
            });
            var innermail = {
                from: process.env.MAIL_USER,
                to: email,
                subject: '아름인 홈페이지에서 변경점을 알려드립니다.',
                html: `<h1>${emailtime} 에 비밀번호 변경이 감지되었습니다.</h1></br>변경된 비밀번호는 '${nextpw}' 입니다.`
            }
            mail.sendMail(innermail, function(err,res){
                if(err){ return res.status(400).json({status: "Failed", log:"EmailSendError"}); }
                mail.close();
            });

            console.log(`${ret[0].id} ${ret[0].name}님이 비밀번호를 변경하셨습니다.`);
            return res.status(200).json({status: "Succeed", log:"PasswordChanged", return: pid});
        }
    });
});

module.exports = app;