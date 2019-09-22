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
var _this = this;
exports.__esModule = true;
var admin = require("firebase-admin");
var querystring = require("querystring");
var NodeLogger = require("simple-node-logger");
//Requires
var express = require("express");
var moment = require("moment");
var crypto = require("crypto");
var cors = require("cors");
var fetch = require('node-fetch');
var _ = require('lodash');
require('dotenv').config(); //Apenas para Desenvolvimento
//Const variables
var app = express();
var PORT = process.env.PORT || 5000;
//Initialization
var serviceAccount = require("./config/serviceAccountKey.json");
var log = NodeLogger.createSimpleLogger({
    logFilePath: './ufsmbot.log',
    timestampFormat: 'DD-MM-YYYY HH:mm:ss'
});
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});
var db = admin.firestore();
app.enable('trust proxy');
app.use(requireHTTPS, express.json(), express.static('public'), cors()); //Remova o requireHTTPS quando em Desenvolvimento
app.listen(PORT, function () {
    log.info("UFSMBot Listening on " + PORT);
});
app.get('/', callAngularApp);
app.get('/login', callAngularApp);
app.get('/home', callAngularApp);
app.get('/account', callAngularApp);
app.post('/auth/login', function (req, res) {
    var currentSession;
    var _a = req.body, matricula = _a.matricula, password = _a.password, hasAcceptedTerm = _a.hasAcceptedTerm;
    getLoginSessionID(matricula, password)
        .then(function (session) {
        if (session !== false) {
            if (isValidSession(session)) {
                currentSession = session;
                return getStudentByMatricula(matricula, password);
            }
        }
    })
        .then(function (studentUID) { return __awaiter(_this, void 0, void 0, function () {
        var updateData, studentInfo;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    updateData = {
                        lastLogin: moment().toDate(),
                        agreementAccepted: hasAcceptedTerm
                    };
                    return [4 /*yield*/, getStudentNameAndCourse(matricula, currentSession)];
                case 1:
                    studentInfo = _a.sent();
                    if (studentInfo !== false) {
                        updateData = __assign({}, updateData, studentInfo);
                    }
                    db.doc(studentUID)
                        .update(updateData)["catch"](function (error) {
                        log.error("Error on update user data on login. Error message: " + error);
                    });
                    return [2 /*return*/, studentUID];
            }
        });
    }); })
        .then(function (studentUID) {
        return admin.auth()
            .createCustomToken(studentUID, { matricula: matricula });
    })
        .then(function (token) {
        res.send({
            message: 'sucess',
            token: token
        });
    })["catch"](function (errorStatus) {
        if (errorStatus.message == 200) { //It returns 200 even if you have the wrong credentials
            res.status(403).send({
                message: 'login attemp failed'
            });
        }
        else { //Show when the UFSM server is down or something
            res.status(502).send({
                message: 'invalid response from an upstream server'
            });
        }
    })["finally"](function () {
        if (!isUndefined(currentSession) && isValidSession(currentSession)) {
            logOut(currentSession)
                .then(function (response) {
                if (response.status == 200) {
                    log.info("Logout realizado " + currentSession);
                }
                else {
                    log.error("Erro ao fazer logout " + currentSession);
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
    res.send({
        message: 'mass schedule started successfully...'
    });
    var daysException = [];
    fetchScheduleException()
        .then(function (daysExceptionResponse) {
        daysException = daysExceptionResponse;
        return getStudentsRef(100, 0);
    })
        .then(function (studentsWrapper) {
        if (Array.isArray(studentsWrapper)) {
            var allSchedules = [];
            for (var _i = 0, studentsWrapper_1 = studentsWrapper; _i < studentsWrapper_1.length; _i++) {
                var student = studentsWrapper_1[_i];
                allSchedules.push(startScheduleForStudent(student, daysException));
            }
            return Promise.all(allSchedules);
        }
        else {
            throw new Error('error when in fetch students for mass schedule');
        }
    })
        .then(function () {
        log.info('mass schedule finished successfully');
    })["catch"](function (error) {
        log.error("Error on mass schedule: " + error.message);
    });
});
app.get('/api/errors/replay', function (req, res) {
    res.send({
        message: 'mass schedule started successfully...'
    });
    getScheduleErrors(100)
        .then(function (schedulesWrap) { return __awaiter(_this, void 0, void 0, function () {
        var allSchedules, _i, schedulesWrap_1, scheduleWrap, schedule, session, studentRef, e_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!Array.isArray(schedulesWrap)) return [3 /*break*/, 8];
                    allSchedules = [];
                    _i = 0, schedulesWrap_1 = schedulesWrap;
                    _a.label = 1;
                case 1:
                    if (!(_i < schedulesWrap_1.length)) return [3 /*break*/, 7];
                    scheduleWrap = schedulesWrap_1[_i];
                    schedule = __assign({}, scheduleWrap);
                    session = void 0;
                    studentRef = schedule.ref;
                    delete schedule.ref;
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, 4, , 5]);
                    return [4 /*yield*/, getLoginSessionID(schedule.matricula, schedule.password)];
                case 3:
                    session = _a.sent();
                    return [3 /*break*/, 5];
                case 4:
                    e_1 = _a.sent();
                    session = false;
                    log.error(e_1.message);
                    return [3 /*break*/, 5];
                case 5:
                    if (session !== false && isValidSession(session)) {
                        schedule.session = session;
                        allSchedules.push(executeFlowAgendamento(schedule, studentRef, true));
                    }
                    _a.label = 6;
                case 6:
                    _i++;
                    return [3 /*break*/, 1];
                case 7: return [2 /*return*/, Promise.all(allSchedules)];
                case 8: throw new Error('error when in fetch students for mass schedule');
            }
        });
    }); })
        .then(function () {
        log.info('Error replay executed successfully.');
    })["catch"](function (error) {
        log.error("Error replay not successfull. Error message: " + error);
    });
});
app.get('/api/history-check', function (req, res) {
    res.send({
        message: 'history check started successfully...'
    });
    log.info('History check started successfully.');
    getStudentsHistoryCheck(100)
        .then(function (studentsHistoryCheck) { return __awaiter(_this, void 0, void 0, function () {
        var allHistoryCheck, _i, studentsHistoryCheck_1, student, session, e_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!Array.isArray(studentsHistoryCheck)) return [3 /*break*/, 8];
                    allHistoryCheck = [];
                    _i = 0, studentsHistoryCheck_1 = studentsHistoryCheck;
                    _a.label = 1;
                case 1:
                    if (!(_i < studentsHistoryCheck_1.length)) return [3 /*break*/, 7];
                    student = studentsHistoryCheck_1[_i];
                    session = void 0;
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, 4, , 5]);
                    return [4 /*yield*/, getLoginSessionID(student.matricula, student.password)];
                case 3:
                    session = _a.sent();
                    return [3 /*break*/, 5];
                case 4:
                    e_2 = _a.sent();
                    session = false;
                    log.error(e_2.message);
                    return [3 /*break*/, 5];
                case 5:
                    if (session !== false && isValidSession(session)) {
                        student.session = session;
                        allHistoryCheck.push(executeHistoryCheck(student));
                    }
                    _a.label = 6;
                case 6:
                    _i++;
                    return [3 /*break*/, 1];
                case 7: return [2 /*return*/, Promise.all(allHistoryCheck)];
                case 8: throw new Error('error when checking schedule history');
            }
        });
    }); })
        .then(function () {
        log.info('History check executed successfully.');
    })["catch"](function (error) {
        log.error("Error replay not successfull. Error message: " + error);
    });
});
function callAngularApp(req, res) {
    res.sendFile('public/index.html', { root: __dirname });
}
function requireHTTPS(req, res, next) {
    if (!req.secure && !isDevMode()) {
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
                        log.info("Sucesso ao agendar " + schedule.matricula + " " + schedule.dia);
                        saveSchedulement(studentRef, schedule);
                    }
                    else {
                        throw new Error("Erro ao agendar (" + response.status + ") - " + schedule.matricula + " - " + schedule.dia);
                    }
                })["catch"](function (error) {
                    saveError(studentRef, __assign({}, schedule));
                    log.error(error.message);
                })["finally"](function () {
                    if (!isUndefined(schedule.session) && isLast) {
                        logOut(schedule.session)
                            .then(function (response) {
                            if (response.status === 200) {
                                log.info("Logout realizado " + schedule.session);
                            }
                            else {
                                log.error("Erro ao fazer logout " + schedule.session);
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
                        log.info("Login realizado " + matricula);
                        return response.url.split(';')[1].replace("jsessionid=", "JSESSIONID=");
                    }
                    log.error("Login falhou - " + matricula);
                    throw new Error(response.status);
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
        var _this = this;
        return __generator(this, function (_a) {
            encryptedPassword = encrypt(password);
            return [2 /*return*/, db.collection('estudantes')
                    .where('matricula', '==', matricula)
                    .get()
                    .then(function (querySnapshot) { return __awaiter(_this, void 0, void 0, function () {
                    var studentRef_1;
                    return __generator(this, function (_a) {
                        if (querySnapshot.size !== 0) {
                            querySnapshot.forEach(function (doc) {
                                studentRef_1 = doc.ref;
                            });
                            return [2 /*return*/, db.doc(studentRef_1.path)
                                    .update({ password: encryptedPassword })
                                    .then(function () {
                                    return studentRef_1;
                                })];
                        }
                        else { //Student does not exist
                            incrementTotalUsers();
                            return [2 /*return*/, db.collection('estudantes')
                                    .add({
                                    matricula: matricula,
                                    password: encryptedPassword,
                                    lastSchedule: null,
                                    lastHistoryCheck: null
                                })];
                        }
                        return [2 /*return*/];
                    });
                }); })
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
                    .where('agreementAccepted', '==', true)
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
                        .where('agreementAccepted', '==', true)
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
                })["catch"](function (e) {
                    return false;
                })];
        });
    });
}
function getScheduleErrors(limit) {
    return __awaiter(this, void 0, void 0, function () {
        var schedulesWrap;
        return __generator(this, function (_a) {
            schedulesWrap = [];
            return [2 /*return*/, db.collection('errors')
                    .where('resolved', '==', false)
                    .limit(limit)
                    .get()
                    .then(function (querySnapshot) {
                    var errors = [];
                    querySnapshot.forEach(function (doc) {
                        errors.push(__assign({}, doc.data(), { ref: doc.ref.path }));
                    });
                    return errors;
                })
                    .then(function (errors) {
                    var all = [];
                    var _loop_1 = function (error) {
                        error.schedule.password = decrypt(error.schedule.password);
                        schedulesWrap.push(__assign({}, error.schedule, { ref: error.estudante }));
                        db.doc(error.ref)["delete"]()["catch"](function () {
                            log.error("Couldnt delete the error in DB - " + error.ref);
                        });
                    };
                    for (var _i = 0, errors_1 = errors; _i < errors_1.length; _i++) {
                        var error = errors_1[_i];
                        _loop_1(error);
                    }
                    return Promise.all(all);
                })
                    .then(function () {
                    return schedulesWrap;
                })["catch"](function (e) {
                    log.error(e);
                    return false;
                })];
        });
    });
}
function getStudentsHistoryCheck(limit) {
    return __awaiter(this, void 0, void 0, function () {
        var studentsRef;
        return __generator(this, function (_a) {
            studentsRef = [];
            return [2 /*return*/, db.collection('estudantes')
                    .where('lastHistoryCheck', '==', null)
                    .limit(limit)
                    .get()
                    .then(function (querySnapshot) {
                    querySnapshot.forEach(function (doc) {
                        var student = doc.data();
                        sanitizeHistoryCheckStudent(student);
                        studentsRef.push({
                            ref: doc.ref,
                            matricula: student.matricula,
                            password: decrypt(student.password),
                            banUntil: student.banUntil,
                            banCount: student.banCount,
                            lastHistoryCheck: student.lastHistoryCheck,
                            email: student.email
                        });
                    });
                    return db.collection('estudantes')
                        .where('lastHistoryCheck', '<', moment().subtract(7, 'days').toDate())
                        .limit(limit)
                        .get();
                })
                    .then(function (querySnapshot) {
                    querySnapshot.forEach(function (doc) {
                        var student = doc.data();
                        sanitizeHistoryCheckStudent(student);
                        studentsRef.push({
                            ref: doc.ref,
                            matricula: student.matricula,
                            password: decrypt(student.password),
                            banUntil: student.banUntil,
                            banCount: student.banCount,
                            lastHistoryCheck: student.lastHistoryCheck
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
function startScheduleForStudent(student, daysException) {
    return __awaiter(this, void 0, void 0, function () {
        var routines, session_1, e_3, agendamentos_1, lastSchedule, _loop_2, _i, routines_1, routine, e_4, today, e_5;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getStudentRoutines(student.ref)];
                case 1:
                    routines = _a.sent();
                    if (!Array.isArray(routines)) return [3 /*break*/, 16];
                    if (!(routines.length != 0)) return [3 /*break*/, 12];
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, 4, , 5]);
                    return [4 /*yield*/, getLoginSessionID(student.matricula, student.password)];
                case 3:
                    session_1 = _a.sent();
                    return [3 /*break*/, 5];
                case 4:
                    e_3 = _a.sent();
                    session_1 = false;
                    log.error(e_3.message);
                    return [3 /*break*/, 5];
                case 5:
                    if (!(session_1 !== false && isValidSession(session_1))) return [3 /*break*/, 11];
                    agendamentos_1 = [];
                    lastSchedule = moment();
                    _loop_2 = function (routine) {
                        var days = convertDaysToSchedule(routine.dias);
                        var lastDay = moment(_.last(days), "DD/MM/YYYY");
                        _.pullAll(days, daysException); //Remove the days that are the exception
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
                        _loop_2(routine);
                    }
                    _a.label = 6;
                case 6:
                    _a.trys.push([6, 8, , 9]);
                    return [4 /*yield*/, db.doc(student.ref).update({
                            lastSchedule: lastSchedule.toDate()
                        })];
                case 7:
                    _a.sent();
                    return [3 /*break*/, 9];
                case 8:
                    e_4 = _a.sent();
                    log.error(e_4);
                    return [3 /*break*/, 9];
                case 9: return [4 /*yield*/, incrementTodaysSchedule(agendamentos_1.length)];
                case 10:
                    _a.sent();
                    return [2 /*return*/, Promise.all(agendamentos_1)];
                case 11: return [3 /*break*/, 15];
                case 12:
                    _a.trys.push([12, 14, , 15]);
                    today = new Date();
                    today.setDate(today.getDate() + 3);
                    return [4 /*yield*/, db.doc(student.ref).update({
                            lastSchedule: today
                        })];
                case 13:
                    _a.sent();
                    return [3 /*break*/, 15];
                case 14:
                    e_5 = _a.sent();
                    log.error(e_5);
                    return [3 /*break*/, 15];
                case 15: return [3 /*break*/, 17];
                case 16: return [2 /*return*/, null];
                case 17: return [2 /*return*/];
            }
        });
    });
}
function saveError(studentRef, schedule) {
    return __awaiter(this, void 0, void 0, function () {
        var e_6;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    delete schedule.session;
                    schedule.password = encrypt(schedule.password);
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, db.collection('errors').add({
                            resolved: false,
                            estudante: studentRef,
                            schedule: schedule
                        })];
                case 2:
                    _a.sent();
                    log.info('Erro salvo');
                    return [3 /*break*/, 4];
                case 3:
                    e_6 = _a.sent();
                    log.error("Erro ao salvar o erro " + e_6);
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    });
}
function getStudentNameAndCourse(matricula, session) {
    return __awaiter(this, void 0, void 0, function () {
        var headers, requestConfig;
        return __generator(this, function (_a) {
            headers = [['Cookie', session]];
            requestConfig = {
                headers: headers,
                body: "callCount=1\nnextReverseAjaxIndex=0\nc0-scriptName=usuarioRuCaptchaAjaxService\nc0-methodName=search\nc0-id=0\nc0-param0=number:0\nc0-param1=number:10\nc0-e1=string:" + matricula + "\nc0-e2=string:CAPTCHA\nc0-e3=null:null\nc0-e4=null:null\nc0-param2=Object_Object:{matricula:reference:c0-e1, captcha:reference:c0-e2, orderBy:reference:c0-e3, orderMode:reference:c0-e4}\nbatchId=2\ninstanceId=0\npage=/ru/usuario/transferencia/credito/form.html\nscriptSessionId=5000E7D9FF69206B62CD4E56F325D285348\n",
                referrer: 'https://portal.ufsm.br/ru/usuario/transferencia/credito/form.html',
                url: 'https://portal.ufsm.br/ru/dwr/call/plaincall/usuarioRuCaptchaAjaxService.search.dwr'
            };
            return [2 /*return*/, makeRequest(requestConfig)
                    .then(function (response) {
                    return response.text();
                })
                    .then(function (data) {
                    var info = {
                        nome: getProperty(data, 'nome'),
                        curso: getProperty(getProperty(data, 'unidade', false), 'nome')
                    };
                    info.nome = unscapeUnicode(info.nome);
                    info.curso = unscapeUnicode(info.curso);
                    return info;
                })["catch"](function (error) {
                    log.error("Error when fetching data from the user. Error message: " + error);
                    return false;
                })];
        });
    });
}
function getProperty(data, label, isString) {
    if (isString === void 0) { isString = true; }
    var sizeSlice = label.length + 1;
    var regExpProp = isString ? label + ":\"(.*?)\"" : label + ":{(.*?)}";
    var result = data.match(RegExp(regExpProp))[0].slice(sizeSlice);
    if (isString) {
        return result.replace(new RegExp('"', 'g'), '');
    }
    return result;
}
function fetchScheduleException() {
    return __awaiter(this, void 0, void 0, function () {
        var today, limitDay, querySnapshot, daysException;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    today = moment().startOf('day').toDate();
                    limitDay = moment().add(7, 'days').startOf('day').toDate();
                    return [4 /*yield*/, db.collection('exceptionSchedule')
                            .where('dia', '>=', today)
                            .where('dia', '<=', limitDay)
                            .get()];
                case 1:
                    querySnapshot = _a.sent();
                    daysException = [];
                    querySnapshot.forEach(function (docSnap) {
                        daysException.push(moment(docSnap.data().dia.toDate()).format("DD/MM/YYYY"));
                    });
                    return [2 /*return*/, daysException];
            }
        });
    });
}
function fetchHistorySchedulement(student) {
    return __awaiter(this, void 0, void 0, function () {
        var headers, twoDaysAgo, lastHistory, bodyRequest, bodyAppend, key, requestConfig;
        return __generator(this, function (_a) {
            headers = [['Cookie', student.session]];
            twoDaysAgo = moment().subtract(2, 'days').format("DD/MM/YYYY");
            lastHistory = student.lastHistoryCheck.format("DD/MM/YYYY");
            bodyRequest = querystring.stringify({
                'callCount': '1',
                'nextReverseAjaxIndex': '0',
                'c0-scriptName': 'agendamentoUsuarioAjaxTable',
                'c0-methodName': 'search',
                'c0-id': '0'
            });
            bodyAppend = {
                'c0-param0': 'number:0',
                'c0-param1': 'number:20',
                'c0-e1': "" + querystring.escape(lastHistory),
                'c0-e2': "string:" + querystring.escape(twoDaysAgo),
                'c0-e3': 'string:dataRefAgendada',
                'c0-e4': 'string:desc',
                'c0-param2': 'Object_Object:{inicio:reference:c0-e1, fim:reference:c0-e2, orderBy:reference:c0-e3, orderMode:reference:c0-e4}',
                'batchId': 5,
                'instanceId': 0,
                'page': '/ru/usuario/agendamento/agendamento.html?action=list',
                'scriptSessionId': ''
            };
            for (key in bodyAppend) {
                bodyRequest += "&" + key + "=" + bodyAppend[key];
            }
            requestConfig = {
                body: bodyRequest,
                headers: headers,
                referrer: 'https://portal.ufsm.br/ru/usuario/agendamento/agendamento.html?action=list',
                url: 'https://portal.ufsm.br/ru/dwr/call/plaincall/agendamentoUsuarioAjaxTable.search.dwr'
            };
            return [2 /*return*/, makeRequest(requestConfig)
                    .then(function (response) { return response.text(); })
                    .then(function (responseTxt) { return parseHistorySchedulement(responseTxt); })];
        });
    });
}
function executeHistoryCheck(student) {
    return __awaiter(this, void 0, void 0, function () {
        var penaltyDetail;
        var _this = this;
        return __generator(this, function (_a) {
            penaltyDetail = {
                matricula: student.matricula,
                checkageDay: new Date(),
                banUntil: new Date(),
                email: isUndefined(student.email) ? "" : student.email,
                banCount: 0,
                days: []
            };
            return [2 /*return*/, fetchHistorySchedulement(student)
                    .then(function (history) { return __awaiter(_this, void 0, void 0, function () {
                    var penalties, _i, history_1, day, shouldAddPenalty;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0:
                                penalties = 0;
                                if (!(history.length != 0)) return [3 /*break*/, 4];
                                _i = 0, history_1 = history;
                                _a.label = 1;
                            case 1:
                                if (!(_i < history_1.length)) return [3 /*break*/, 4];
                                day = history_1[_i];
                                return [4 /*yield*/, wasScheduledByBot(student.matricula, day.format("DD/MM/YYYY"))];
                            case 2:
                                shouldAddPenalty = _a.sent();
                                if (shouldAddPenalty) {
                                    console.log("Add penalty " + student.matricula);
                                    penaltyDetail.days.push(day.format("DD/MM/YYYY"));
                                    penalties++;
                                }
                                _a.label = 3;
                            case 3:
                                _i++;
                                return [3 /*break*/, 1];
                            case 4: return [2 /*return*/, penalties];
                        }
                    });
                }); })
                    .then(function (penalties) {
                    var updates = {
                        lastHistoryCheck: moment().subtract(2, 'days').toDate()
                    };
                    if (penalties > 0) {
                        student.banCount++;
                        var banUntil = moment().add(7 * penalties * student.banCount, 'days').toDate();
                        updates = __assign({ banCount: student.banCount, banUntil: banUntil }, updates);
                        log.info("Ban applyed to " + student.matricula + " until " + moment(banUntil).format('DD/MM'));
                        penaltyDetail.banUntil = banUntil;
                        penaltyDetail.banCount = student.banCount;
                        deleteUserRoutines(student.ref.id);
                        var today = new Date().toISOString().substr(0, 10);
                        db.collection("admin/agendamentos/penalties/" + today + "/details").add(penaltyDetail);
                    }
                    student.ref.update(updates);
                })["catch"](function (e) {
                    console.log(e);
                    log.error("Error on execute history check for " + student.matricula);
                })];
        });
    });
}
function deleteUserRoutines(userID) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            db.collection("estudantes/" + userID + "/rotinas").get()
                .then(function (querySnapshot) {
                querySnapshot.forEach(function (docSnap) {
                    docSnap.ref["delete"]();
                });
            })["catch"](function () {
                log.error("Error on delete routines of user: " + userID);
            });
            return [2 /*return*/];
        });
    });
}
function wasScheduledByBot(matricula, dia) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, db.collection('agendamentos')
                    .where('dia', '==', dia)
                    .where('matricula', '==', matricula)
                    .limit(1)
                    .get()
                    .then(function (querySnapshot) {
                    return !querySnapshot.empty;
                })["catch"](function () {
                    return false;
                })];
        });
    });
}
function sanitizeHistoryCheckStudent(student) {
    if (isUndefined(student.lastHistoryCheck) || student.lastHistoryCheck == null) {
        student.lastHistoryCheck = moment().subtract(7, 'days');
    }
    else {
        student.lastHistoryCheck = moment(student.lastHistoryCheck);
    }
    if (isUndefined(student.banUntil) || student.banUntil == null) {
        student.banUntil = moment();
    }
    else {
        student.banUntil = moment(student.banUntil);
    }
    if (isUndefined(student.banCount) || student.banCount == null) {
        student.banCount = 0;
    }
}
function parseHistorySchedulement(historyTxt) {
    var statuses = historyTxt.match(/,comparecido(.*?),/g);
    var datesRef = historyTxt.match(/,dataRefAgendada(.*?),/g);
    var available = historyTxt.match(/,disponibilizado(.*?),/g);
    var history = [];
    try {
        if (statuses == null) {
            statuses = [];
        }
        for (var i = 0; i < statuses.length; i++) {
            statuses[i] = statuses[i].replace(/,/g, '').substring(12); //`,comparecido:false,` => `false`
            datesRef[i] = parseInt(datesRef[i].replace(/(,|\(|\))/g, '').substring(24)); //`,dataRefAgendada:new Date(1559271600000),` => `1559271600000`
            available[i] = available[i].replace(/,/g, '').substring(16); //`,disponibilizado:false,` => `false`
            if (statuses[i] === 'false' && (available[i] === 'false' || available[i] === 'null')) { //Nao compareceu e nao disponibilizou
                history.push(moment(datesRef[i]).add(3, 'hours')); //Add 3 hours due to timezone
            }
        }
    }
    catch (e) {
        log.error("Error on parse HistorySchedule: " + e.message);
    }
    return history;
}
function unscapeUnicode(text) {
    return decodeURIComponent(JSON.parse("\"" + text + "\""));
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
function isDevMode() {
    return process.env.DEV === "true";
}
function incrementTotalUsers() {
    db.doc('admin/users')
        .get().then(function (docSnap) {
        var data = docSnap.data();
        data.total++;
        docSnap.ref.update(data);
    });
}
function incrementTodaysSchedule(increment) {
    if (increment === void 0) { increment = 1; }
    return __awaiter(this, void 0, void 0, function () {
        var today;
        return __generator(this, function (_a) {
            today = new Date().toISOString().substr(0, 10);
            return [2 /*return*/, db.doc("admin/agendamentos/history/" + today).get()
                    .then(function (docSnap) {
                    return { ref: docSnap.ref, data: docSnap.data() };
                })
                    .then(function (obj) {
                    if (isUndefined(obj.data)) {
                        obj.data = { total: 0 };
                    }
                    obj.data.total += increment;
                    obj.ref.set(obj.data);
                })["catch"](function () {
                    log.error("Error on increment " + today + " schedule");
                })];
        });
    });
}
// function countTotalUsers(){
//   db.collection('estudantes')
//   // .where('banCount', '>=', 1)  
//   .get()
//   .then((querySnapshot) => {
//     console.log(`Total alunos: ${querySnapshot.size}`);
//   })
//   .catch((e) => {
//     console.log(e);
//   });
// }
function saveSchedulement(studentRef, schedule) {
    delete schedule.session;
    schedule.password = encrypt(schedule.password);
    db.collection("agendamentos")
        .add(__assign({ estudante: studentRef, schedule: moment(schedule.dia, "DD/MM/YYYY").toDate(), scheduledAt: moment().toDate() }, schedule))
        .then(function () {
        log.info("Sucesso ao salvar agendamento " + schedule.matricula);
    })["catch"](function () {
        log.error("Erro ao salvar agendamento " + schedule.matricula);
    });
}
// countTotalUsers();
