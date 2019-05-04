"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
exports.__esModule = true;
var admin = require("firebase-admin");
var querystring = require("querystring");
//Requires
var express = require("express");
var moment = require("moment");
var crypto = require("crypto");
var cors = require("cors");
var fetch = require('node-fetch');
var _ = require('lodash');
//Const variables
var app = express();
var PORT = process.env.PORT || 5000;
//Initialization
var serviceAccount = require("./config/serviceAccountKey.json");
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});
var db = admin.firestore();
app.enable('trust proxy');
app.use(requireHTTPS, express.json(), express.static('public'), cors()); //Remova o requireHTTPS quando em Desenvolvimento
app.listen(PORT, function () {
    console.log("UFSMBot Listening on " + PORT);
});
app.get('/', callAngularApp);
app.get('/login', callAngularApp);
app.get('/home', callAngularApp);
app.post('/auth/login', function (req, res) {
    var currentSession;
    var _a = req.body, matricula = _a.matricula, password = _a.password;
    getLoginSessionID(matricula, password)
        .then(function (session) {
        if (session !== false) {
            if (isValidSession(session)) {
                currentSession = session;
                return getStudentByMatricula(matricula, password);
            }
        }
    })
        .then(function (studentUID) {
        return admin.auth()
            .createCustomToken(studentUID, { matricula: matricula });
    })
        .then(function (token) {
        res.send({
            message: 'sucess',
            token: token
        });
    })["catch"](function (e) {
        res.status(403).send({
            message: 'login attemp failed',
            error: e
        });
    })["finally"](function () {
        if (!isUndefined(currentSession) && isValidSession(currentSession)) {
            logOut(currentSession)
                .then(function (response) {
                if (response.status === 200) {
                    console.log('Logout realizado', currentSession);
                }
                else {
                    console.log('Erro ao fazer logout', currentSession);
                }
            });
        }
    });
});
app.post('/api/agendar', function (req, res) {
    var schedule = req.body;
    getLoginSessionID(schedule.matricula, schedule.password)
        .then(function (session) {
        if (session !== false) {
            if (isValidSession(session)) {
                schedule.session = session;
                return executeFlowAgendamento(schedule);
            }
        }
    })
        .then(function () {
        res.send({ message: 'schedule executed successfully' });
    })["catch"](function (e) {
        res.status(400).send({
            message: 'error when trying to schedule',
            error: e
        });
    });
});
app.get('/api/agendamento', function (req, res) {
    getStudentsRef(100, 0)
        .then(function (studentsWrapper) {
        if (Array.isArray(studentsWrapper)) {
            var allSchedules = [];
            for (var _i = 0, studentsWrapper_1 = studentsWrapper; _i < studentsWrapper_1.length; _i++) {
                var student = studentsWrapper_1[_i];
                allSchedules.push(startScheduleForStudent(student));
            }
            return Promise.all(allSchedules);
        }
        else {
            throw new Error('error when in fetch students for mass schedule');
        }
    })
        .then(function () {
        res.send({
            message: 'mass schedule executed successfully'
        });
    })["catch"](function (error) {
        res.status(400).send({
            message: error
        });
    });
});
function callAngularApp(req, res) {
    res.sendFile('public/index.html', { root: __dirname });
}
function requireHTTPS(req, res, next) {
    if (!req.secure) {
        //FYI this should work for local development as well
        return res.redirect('https://' + req.get('host') + req.url);
    }
    next();
}
function executeFlowAgendamento(schedule, studentRef, isLast) {
    if (studentRef === void 0) { studentRef = ''; }
    if (isLast === void 0) { isLast = true; }
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, agendarRefeicao(schedule)
                    .then(function (response) {
                    if (response.status === 200) {
                        console.log('Sucesso ao agendar', schedule.matricula, schedule.dia);
                    }
                    else {
                        throw new Error("Erro ao agendar (" + response.status + ") - " + schedule.matricula + " - " + schedule.dia);
                    }
                })["catch"](function (error) {
                    console.log(studentRef); //TODO: Save the errors and try again later
                    console.log(error);
                })["finally"](function () {
                    if (!isUndefined(schedule.session) && isLast) {
                        logOut(schedule.session)
                            .then(function (response) {
                            if (response.status === 200) {
                                console.log('Logout realizado');
                            }
                            else {
                                console.log('Erro ao fazer logout');
                            }
                        });
                    }
                })];
        });
    });
}
function getLoginSessionID(matricula, password) {
    return __awaiter(this, void 0, void 0, function () {
        var data, requestConfig;
        return __generator(this, function (_a) {
            data = {
                j_username: matricula,
                j_password: password
            };
            requestConfig = {
                body: querystring.stringify(data),
                referrer: 'https://portal.ufsm.br/ru/index.html',
                url: 'https://portal.ufsm.br/ru/j_security_check'
            };
            return [2 /*return*/, makeRequest(requestConfig)
                    .then(function (response) {
                    if (response.url.indexOf('jsessionid') !== -1) {
                        console.log("Login realizado", matricula);
                        return response.url.split(';')[1].replace("jsessionid=", "JSESSIONID=");
                    }
                    throw new Error('login failed');
                })];
        });
    });
}
function agendarRefeicao(schedule) {
    return __awaiter(this, void 0, void 0, function () {
        var headers, bodyRequest, _i, _a, refeicao, requestConfig;
        return __generator(this, function (_b) {
            headers = [['Cookie', schedule.session]];
            bodyRequest = querystring.stringify({
                'restaurante': schedule.restaurante,
                'periodo.inicio': schedule.dia,
                'periodo.fim': schedule.dia,
                'save': ''
            });
            if (Array.isArray(schedule.refeicao)) {
                for (_i = 0, _a = schedule.refeicao; _i < _a.length; _i++) {
                    refeicao = _a[_i];
                    bodyRequest += "&tiposRefeicao=" + refeicao;
                }
            }
            else {
                bodyRequest += "&tiposRefeicao=" + schedule.refeicao;
            }
            requestConfig = {
                body: bodyRequest,
                headers: headers,
                referrer: 'https://portal.ufsm.br/ru/usuario/agendamento/form.html',
                url: 'https://portal.ufsm.br/ru/usuario/agendamento/form.html'
            };
            return [2 /*return*/, makeRequest(requestConfig)];
        });
    });
}
function logOut(session) {
    return __awaiter(this, void 0, void 0, function () {
        var headers, requestConfig;
        return __generator(this, function (_a) {
            headers = [['Cookie', session]];
            requestConfig = {
                headers: headers,
                url: 'https://portal.ufsm.br/ru/logout.html',
                referrer: ''
            };
            return [2 /*return*/, makeRequest(requestConfig)];
        });
    });
}
function makeRequest(requestConfig) {
    return __awaiter(this, void 0, void 0, function () {
        var requestInit;
        return __generator(this, function (_a) {
            if (typeof requestConfig.headers === 'undefined') {
                requestConfig.headers = [];
            }
            requestConfig.headers.push(['upgrade-insecure-requests', '1']);
            requestConfig.headers.push(['content-type', 'application/x-www-form-urlencoded']);
            requestConfig.headers.push(['cache-control', 'max-age=0']);
            requestConfig.headers.push(['accept-language', 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7']);
            requestConfig.headers.push(['accept', 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3']);
            requestInit = {
                body: requestConfig.body,
                method: 'POST',
                headers: requestConfig.headers,
                referrer: requestConfig.referrer,
                referrerPolicy: "no-referrer-when-downgrade",
                mode: 'cors',
                credentials: 'include'
            };
            return [2 /*return*/, fetch(requestConfig.url, requestInit)];
        });
    });
}
function getStudentByMatricula(matricula, password) {
    return __awaiter(this, void 0, void 0, function () {
        var encryptedPassword;
        return __generator(this, function (_a) {
            encryptedPassword = encrypt(password);
            return [2 /*return*/, db.collection('estudantes')
                    .where('matricula', '==', matricula)
                    .get()
                    .then(function (querySnapshot) {
                    if (querySnapshot.size !== 0) {
                        var studentRef_1;
                        querySnapshot.forEach(function (doc) {
                            studentRef_1 = doc.ref;
                        });
                        return db.doc(studentRef_1.path)
                            .update({ password: encryptedPassword })
                            .then(function () {
                            return studentRef_1;
                        });
                    }
                    else { //Student does not exist
                        return db.collection('estudantes')
                            .add({
                            matricula: matricula,
                            password: encryptedPassword,
                            lastSchedule: null
                        });
                    }
                })
                    .then(function (querySnapshot) {
                    return querySnapshot.path;
                })];
        });
    });
}
function getStudentsRef(limit, offset) {
    return __awaiter(this, void 0, void 0, function () {
        var today, studentsRef;
        return __generator(this, function (_a) {
            today = moment();
            studentsRef = [];
            return [2 /*return*/, db.collection('estudantes')
                    .where('lastSchedule', '==', null)
                    .limit(limit)
                    .offset(offset)
                    .get()
                    .then(function (querySnapshot) {
                    querySnapshot.forEach(function (doc) {
                        var student = doc.data();
                        studentsRef.push({
                            ref: doc.ref.path,
                            matricula: student.matricula,
                            password: decrypt(student.password)
                        });
                    });
                    return db.collection('estudantes')
                        .where('lastSchedule', '<', today.add(3, 'days').toDate())
                        .limit(limit)
                        .offset(offset)
                        .get();
                })
                    .then(function (querySnapshot) {
                    querySnapshot.forEach(function (doc) {
                        var student = doc.data();
                        studentsRef.push({
                            ref: doc.ref.path,
                            matricula: student.matricula,
                            password: decrypt(student.password)
                        });
                    });
                    return studentsRef;
                })["catch"](function () {
                    return false;
                })];
        });
    });
}
function getStudentRoutines(ref) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, db.collection(ref + "/rotinas")
                    .get()
                    .then(function (querySnapshot) {
                    var routines = [];
                    querySnapshot.forEach(function (doc) {
                        var routine = __assign({}, doc.data());
                        routine.ref = doc.ref.path;
                        routines.push(routine);
                    });
                    return routines;
                })];
        });
    });
}
function startScheduleForStudent(student) {
    return __awaiter(this, void 0, void 0, function () {
        var routines, session_1, agendamentos_1, lastSchedule, _loop_1, _i, routines_1, routine, e_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getStudentRoutines(student.ref)];
                case 1:
                    routines = _a.sent();
                    if (!Array.isArray(routines)) return [3 /*break*/, 8];
                    return [4 /*yield*/, getLoginSessionID(student.matricula, student.password)];
                case 2:
                    session_1 = _a.sent();
                    if (!(session_1 !== false && isValidSession(session_1))) return [3 /*break*/, 7];
                    agendamentos_1 = [];
                    lastSchedule = void 0;
                    _loop_1 = function (routine) {
                        var days = convertDaysToSchedule(routine.dias);
                        var lastDay = moment(_.last(days), "DD/MM/YYYY");
                        if (isUndefined(lastSchedule)) {
                            lastSchedule = lastDay;
                        }
                        else if (lastSchedule.isBefore(lastDay)) {
                            lastSchedule = lastDay;
                        }
                        days.forEach(function (day, index) {
                            var schedule = {
                                dia: day,
                                restaurante: routine.restaurante,
                                refeicao: routine.tiposRefeicao,
                                matricula: student.matricula,
                                password: student.password,
                                session: session_1
                            };
                            agendamentos_1.push(executeFlowAgendamento(schedule, student.ref, isLastIndex(index, days)));
                        });
                    };
                    for (_i = 0, routines_1 = routines; _i < routines_1.length; _i++) {
                        routine = routines_1[_i];
                        _loop_1(routine);
                    }
                    _a.label = 3;
                case 3:
                    _a.trys.push([3, 5, , 6]);
                    return [4 /*yield*/, db.doc(student.ref).update({
                            lastSchedule: lastSchedule.toDate()
                        })];
                case 4:
                    _a.sent();
                    return [3 /*break*/, 6];
                case 5:
                    e_1 = _a.sent();
                    console.log('Error', e_1);
                    return [3 /*break*/, 6];
                case 6: return [2 /*return*/, Promise.all(agendamentos_1)];
                case 7: return [3 /*break*/, 9];
                case 8:
                    console.log("getStudentRoutines returned false");
                    return [2 /*return*/, null];
                case 9: return [2 /*return*/];
            }
        });
    });
}
function encrypt(text) {
    var cryptoKey = crypto.createCipher('aes-128-cbc', process.env.CRYPTOKEY);
    var encrypted = cryptoKey.update(text, 'utf8', 'hex');
    encrypted += cryptoKey.final('hex');
    return encrypted;
}
function decrypt(encripted) {
    var decryptKey = crypto.createDecipher('aes-128-cbc', process.env.CRYPTOKEY);
    var decrypted = decryptKey.update(encripted, 'hex', 'utf8');
    decrypted += decryptKey.final('utf8');
    return decrypted;
}
function convertDaysToSchedule(days) {
    var convertedDays = [];
    if (Array.isArray(days)) {
        var today_1 = moment().day();
        var thisWeek = days.filter(function (day) { return day > today_1; });
        var nextWeek = days.filter(function (day) { return day < today_1; });
        for (var _i = 0, thisWeek_1 = thisWeek; _i < thisWeek_1.length; _i++) {
            var day = thisWeek_1[_i];
            convertedDays.push(moment().day(day).format("DD/MM/YYYY"));
        }
        for (var _a = 0, nextWeek_1 = nextWeek; _a < nextWeek_1.length; _a++) {
            var day = nextWeek_1[_a];
            convertedDays.push(moment().day(day + 7).format("DD/MM/YYYY"));
        }
    }
    else {
        convertedDays.push(moment().day(days).format("DD/MM/YYYY"));
    }
    return removeUnecessaryDates(sortDates(convertedDays));
}
function sortDates(dates) {
    return _.orderBy(dates, function (date) { return moment(date, "DD/MM/YYYY").format('YYYYMMDD'); }, ['asc']);
}
function removeUnecessaryDates(dates) {
    return dates.filter(function (dia) {
        return moment(dia, "DD/MM/YYYY")
            .isBefore(moment().add(5, 'days'));
    });
}
function isValidSession(session) {
    return session.toString().indexOf('JSESSIONID') !== -1;
}
function isUndefined(variable) {
    return typeof variable === 'undefined';
}
function isLastIndex(pos, arrayCheck) {
    return arrayCheck.length === (pos + 1);
}
