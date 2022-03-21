'use strict';

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

function isNumber(n)    { return /^[0-9]{5}$/.test(n); }
function isBarcode(n)   { return /^ARH[0-9]{5}$/.test(n); }
function isEmail(email) { return /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/.test(email); }

function primaryChk(n)  { return /^[A-Za-z0-9!@#$%^&*-]{4,}$/.test(n); }
function nameChk(n)     { return /^[가-힣]{2,}$/.test(n); }

app.post('/post', function(req,res){ // 회원가입 API

    var chkcode = req.body.chkcode; // 인증코드
    var barcode = req.body.barcode; // 학생증 바코드

    var id      = req.body.id;  // 아이디
    var email   = req.body.email; // 이메일 확인 ( 비밀번호 복구 등 )

    var pw      = req.body.pw;  // 비밀번호
    var pw2     = req.body.pw2; // 비밀번호 확인

    var pid     = req.body.pid;  // 학번
    var name    = req.body.name; // 이름

    console.log(barcode);

    //////////////////// 입력값 검증 //////////////////////
    if( chkcode == null || email == null ||
        pid     == null || name    == null ||
        id      == null || pw      == null || pw2 == null
    ){ return res.status(400).json({status: "Failed", log:"NullException"}); } // 입력값 비었는지 검증

    if(chkcode != process.env.CHKCODE){ return res.status(400).json({status: "Failed", log:"CodeCheckFailed"}); }

    if(pw != pw2)                            { return res.status(400).json({status: "Failed", log:"PasswordIncorrect"}); } // 비밀번호 체크
    if(!isNumber(pid))                       { return res.status(400).json({status: "Failed", log:"pidFailed"}); }
    if(!isEmail(email))                      { return res.status(400).json({status: "Failed", log:"emailFailed"}); }
    if(barcode!='' && !isBarcode(barcode)) { return res.status(400).json({status: "Failed", log:"barcodeFailed"}); }

    if(!nameChk(name))  { return res.status(400).json({status: "Failed", log:"nameFailed"}); }
    if(!primaryChk(id)) { return res.status(400).json({status: "Failed", log:"idFailed"}); }
    if(!primaryChk(pw)) { return res.status(400).json({status: "Failed", log:"pwFailed"}); }
    
    
    ////////////////////// 입력값 암호화 및 처리 //////////////////////
    var hash_pw = crypto.createHmac('sha256', process.env.SECRET).update(pw).digest('hex');
    var hash_id = crypto.createHmac('sha256', process.env.SECRET).update(id).digest('hex');
    
    if(barcode == '') barcode = 'null';
    /*
    var _grade = parseInt(pid/10000);
    var _class = parseInt(pid/100%100);
    var _num   = parseInt(pid%100);
    */

    ////////////////////// 데이터베이스 파트 //////////////////////////
    db.query("SELECT * FROM `account` WHERE `schnum`=?", [parseInt(pid)] , function(err, ret){
        if(err)                  { return res.status(400).json({status: "Failed", log:"DatabaseErr"}); }
        if(ret[0] != undefined)  { return res.status(400).json({status: "Failed", log:"AlreadyRegistered"}); }
        else{
            db.query('INSERT INTO `account`(`pid`, `barcode`, `schnum`, `name`, `loginid`, `loginpw`, `email`) VALUES (?,?,?,?,?,?,?);',[hash_id, barcode, parseInt(pid), name, id, hash_pw, email], function(error, val){
                if(error){ return res.status(400).json({status: "Failed", log:"DatabaseErr"}); }

                db.query('INSERT INTO `data`(`code`, `circles`, `timetable`, `calendar`) VALUES (?,?,?,?);',[hash_id,'{}','{}','{}'], function(error, val){
                    if(error){ return res.status(400).json({status: "Failed", log:"DatabaseErr"}); }
                });

                console.log(`${pid} ${name}님이 성공적으로 회원가입 처리되었습니다.`);
                return res.status(200).json({status: "Succeed", log:"RegisterDone", return: hash_id});
            });
        }
    });
});

module.exports = app;