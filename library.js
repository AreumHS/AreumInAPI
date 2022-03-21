'use strict';

// #1 - 급식
// #2 - 계정 관련
// #3 - 시간표


const moment = require('moment');
const mysql = require('mysql');
const request = require('request-promise-native');
const convert = require('xml-js');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

require('dotenv').config();

var db = mysql.createPool({
    connectionLimit: 16,
    host: process.env.DBLINK,
    port: process.env.DBPORT,
    user: process.env.DBID,
    password: process.env.DBPW,
    database: process.env.DBNAME
});

function CodeChk(code){ return /^[a-z0-9]{64}$/.test(code); }

var library = {};

////////////////// #1. 급식 관련 함수 라이브러리 ///////////////
library.GetWeekMeal = async function(){
    var querytime = moment().startOf('week').format('YYYYMMDD');
    var starttime = moment().add(9, "hours").startOf('week').add(1,"days").format('YYYYMMDD');
    var endtime   = moment().add(9, "hours").endOf('week').add(-1,"days").format('YYYYMMDD');

    return new Promise(resolve =>{
        db.query("SELECT * FROM `meal-data` WHERE `week`=?",[String(querytime)], async function (err, ret, fields) {
            if (err) { resolve("Failed"); }
            var meal = ret[0];
            if (meal != undefined) { resolve({lunch: JSON.parse(meal.lunch), dinner: JSON.parse(meal.dinner)}); }
    
            var luncharr = [];
            var dinnerarr = [];
    
            await request({
                uri: 'https://open.neis.go.kr/hub/mealServiceDietInfo',
                method: 'GET',
                qs: { 'KEY': process.env.NEIS_API_KEYS, 'Type': 'json', 'pIndex': 1, 'pSize': 128, 'ATPT_OFCDC_SC_CODE': 'I10', 'SD_SCHUL_CODE': '9300117', 'MMEAL_SC_CODE': 2, 'MLSV_FROM_YMD': starttime, 'MLSV_TO_YMD': endtime },
            },function (err2, res2, body2) {
                var cnt = 0;
                if (err2) { resolve("Failed"); }
                for (var i = 0; i < 7; i++) {
                    var nowtime = moment().add(9, "hours").startOf('week').add(i, "days").format('YYYYMMDD');
                    try {
                        var innermeal = JSON.parse(body2).mealServiceDietInfo[1].row[cnt].DDISH_NM;
                        var innerdate = JSON.parse(body2).mealServiceDietInfo[1].row[cnt].MLSV_YMD;
                        if (innerdate == nowtime) { cnt++; luncharr.push(innermeal.replace(/[0-9]{1,2}[.]/gi, '')); }
                        else { luncharr.push('오늘의 급식이 없습니다'); }
                    } catch (e) { luncharr.push('오늘의 급식이 없습니다'); }
                }
            });
            
            await request({
                uri: 'https://open.neis.go.kr/hub/mealServiceDietInfo',
                method: 'GET',
                qs: { 'KEY': process.env.NEIS_API_KEYS, 'Type': 'json', 'pIndex': 1, 'pSize': 128, 'ATPT_OFCDC_SC_CODE': 'I10', 'SD_SCHUL_CODE': '9300117', 'MMEAL_SC_CODE': 3, 'MLSV_FROM_YMD': starttime, 'MLSV_TO_YMD': endtime },
            },function (err3, res3, body3) {
                var cnt = 0;
                if (err3) { resolve("Failed"); }
                for (var i = 0; i < 7; i++) {
                    var nowtime = moment().add(9, "hours").startOf('week').add(i, "days").format('YYYYMMDD');
                    try {
                        var innermeal = JSON.parse(body3).mealServiceDietInfo[1].row[cnt].DDISH_NM;
                        var innerdate = JSON.parse(body3).mealServiceDietInfo[1].row[cnt].MLSV_YMD;
                        if (innerdate == nowtime) { cnt++; dinnerarr.push(innermeal.replace(/[0-9]{1,2}[.]/gi, '')); }
                        else { dinnerarr.push('오늘의 급식이 없습니다'); }
                    } catch (e) { dinnerarr.push('오늘의 급식이 없습니다'); }
                }
            });
    
            db.query("INSERT INTO `meal-data`(`week`, `lunch`, `dinner`) VALUES ('" + querytime + "','" + JSON.stringify(luncharr) + "','" + JSON.stringify(dinnerarr) + "');", function (error, val,fields) {
                if (error) { resolve("Failed"); }
                return resolve({ lunch: luncharr, dinner: dinnerarr });
            });
        });
    });
}

library.GetDayMeal = async function(){
    var realtime = moment().day();
    var ret = await library.GetWeekMeal();
    if(ret == "Failed") return "Failed";
    return { lunch: ret.lunch[realtime], dinner: ret.dinner[realtime] };
}

///////////////// #2. 계정 관련 함수 라이브러리 ////////////////
library.GetName = async function(code){
    if(code == null || code == undefined) return "Failed";
    if(!CodeChk(code)) return "Failed";

    return new Promise(resolve =>{
        db.query("SELECT `name` FROM `account` WHERE `pid`=?",[code], async function(err,ret,fields){
            var ret = ret[0].name;
            resolve({name: ret});
        });
    });
}

library.GetSchNumToArr = async function(code){
    if(code == null || code == undefined) return "Failed";
    if(!CodeChk(code)) return "Failed";

    return new Promise(resolve =>{
        db.query("SELECT `schnum` FROM `account` WHERE `pid`=?",[code], async function(err,ret,fields){
            console.log(ret[0]);
            var id = ret[0].schnum;

            var _grade = parseInt(id/10000);
            var _class = parseInt(id/100 % 100);
            var _num   = parseInt(id%100);
            resolve({grade: _grade, class: _class, num: _num});
        });
    });
}

library.GetLibCode = async function(code){
    if(code == null || code == undefined) return "Failed";
    if(!CodeChk(code)) return "Failed";

    return new Promise(resolve =>{
        db.query("SELECT `barcode` FROM `account` WHERE `pid`=?",[code], async function(err,ret,fields){
            //console.log(ret);
            var ret = ret[0].barcode;
            if(ret == "null") resolve("Failed");
            else resolve(ret);
        });
    });
}

///////////////// #3. 시간표 관련 함수 라이브러리 ////////////////
library.GetWeekTimeTable = async function(code){
    if(code == null || code == undefined) return "Failed";
    if(!CodeChk(code)) return "Failed";

    var schnum = await library.GetSchNumToArr(code);
    var starttime = moment().add(9, "hours").startOf('week').add(1,"days").format('YYYYMMDD');
    var endtime   = moment().add(9, "hours").endOf('week').add(-1,"days").format('YYYYMMDD');

    if(schnum == "Failed") return "Failed";

    return new Promise(resolve =>{
        db.query("SELECT `timetable` FROM `data` WHERE `code`=?",[code], async function(err,ret,fields){
            if (err) { resolve("Failed"); }
            if (ret == undefined) { resolve("Failed"); }
            if (ret[0].timetable != "{}") { resolve(JSON.parse(ret[0].timetable)); }
    
            request({
                uri: 'https://open.neis.go.kr/hub/hisTimetable',
                method: 'GET',
                qs: 
                {
                    'KEY' : process.env.NEIS_API_KEYS,
                    'Type' : 'json',
                    'pIndex' : 1,
                    'pSize': 128,
                    'ATPT_OFCDC_SC_CODE': 'I10',
                    'SD_SCHUL_CODE' : '9300117',
                    'TI_FROM_YMD' : starttime,
                    'TI_TO_YMD' : endtime,
                    'CLRM_NM' : schnum.class,
                    'GRADE' : schnum.grade
                },
            }, function(err2,res2,body2){
                //console.log(body2);
                var inform = JSON.parse(body2).hisTimetable[0];
                var timetable = JSON.parse(body2).hisTimetable[1].row;
    
                var k = inform.head[0].list_total_count;
                var cnt = 0;
                var idx = 0;
                var ret = [];
                for(var i=0; i<k; i++){
                    if(i!=k-1) var nxtperio = timetable[i+1].PERIO;
                    
                    if(!ret[cnt]) ret[cnt] = [];
                    ret[cnt][idx] = timetable[i].ITRT_CNTNT;
                    idx++;
                    if(nxtperio == undefined || nxtperio == '1'){cnt++; idx = 0;}
                }

                db.query("UPDATE `data` SET `timetable`=? WHERE `code` = ?;",[JSON.stringify(ret),code], function (error, val,fields) {
                    if (error) { resolve("Failed"+error); }
                    else { resolve(ret); }
                });
            });
        });
    });
}

library.GetDayTimeTable = async function(code){
    var today = moment().add(9, "hours").day()-1;
    var ret = await library.GetWeekTimeTable(code);

    if(today == -1 || today == 5) return ["주말","주말","주말","주말","주말","주말","주말"];
    if(ret == "Failed") return "Failed";

    console.log(ret[today]);
    return ret[today];
}

library.GetNowTimeTable = async function(code){
    var hours = moment().add(9, "hours");
    var period = 0;
    var ret = await library.GetDayTimeTable(code);

    if(hours.diff(moment('16:30', 'HH:mm'), 'minutes') < 0) period = 6; // 7교시
    if(hours.diff(moment('15:30', 'HH:mm'), 'minutes') < 0) period = 5; // 6교시
    if(hours.diff(moment('14:30', 'HH:mm'), 'minutes') < 0) period = 4; // 5교시

    if(hours.diff(moment('12:30', 'HH:mm'), 'minutes') < 0) period = 3; // 4교시
    if(hours.diff(moment('11:30', 'HH:mm'), 'minutes') < 0) period = 2; // 3교시
    if(hours.diff(moment('10:30', 'HH:mm'), 'minutes') < 0) period = 1; // 2교시
    if(hours.diff(moment('09:30', 'HH:mm'), 'minutes') < 0) period = 0; // 1교시

    return ret[period];
}

///////////////// #4. 학사일정 관련 함수 라이브러리 ///////////////////
library.GetSchCalendar = async function(){
    var querytime = moment().startOf('week').format('YYYYMMDD');
    var starttime = moment().add(9, "hours").startOf('year').format('YYYYMMDD');
    var endtime   = moment().add(9, "hours").endOf('year').format('YYYYMMDD');

    //console.log(starttime);
    //console.log(endtime);

    return new Promise(resolve =>{
        request({
            uri: 'https://open.neis.go.kr/hub/SchoolSchedule',
            method: 'GET',
            qs: { 'KEY': process.env.NEIS_API_KEYS, 'Type': 'json', 'pIndex': 1, 'pSize': 365, 'ATPT_OFCDC_SC_CODE': 'I10', 'SD_SCHUL_CODE': '9300117' , 'AA_FROM_YMD' : starttime , 'AA_TO_YMD' : endtime},
        },function (err2, res2, body2) {
            if (err2) { resolve("Failed"); }
            var tmp = JSON.parse(body2);
            let head = tmp.SchoolSchedule[0].head[0].list_total_count;
            let row = tmp.SchoolSchedule[1].row;

            var list = [{name : row[0].EVENT_NM, startday : row[0].AA_YMD , endday : row[0].AA_YMD}];
            for(var i=1; i<head; i++){
                    if(list[list.length-1].name == row[i].EVENT_NM ){ // && moment(String(lastele.endday)).add(1,'days') == moment(String(row[i].AA_YMD))
                        list[list.length-1].endday = row[i].AA_YMD;
                    }else{
                        list.push({name : row[i].EVENT_NM , startday : row[i].AA_YMD, endday : row[i].AA_YMD});
                    }
                }
            
            resolve(list);
        });
    });
}


library.GetDayWeather = async function(code){

    var calc;

    await request({
        uri: 'https://www.accuweather.com/ko/kr/areum-dong/3354146/current-weather/3354146',
        method: 'GET',
    },function (err2, res2, body2) {
        if (err2) { resolve("Failed"); }
        calc = body2;
    });

    //calc = calc.toString().replace(/\t/g, '');
    //calc = convert.xml2js(calc, {compact:true});
    //calc = calc.rss.channel.item.description.body.location; // 지역별 리스트까지
    //calc = calc[1];

    //if(calc.city._text != '세종') return "Failed";

    calc = calc.data;

    return "TEST";
}


module.exports = library;