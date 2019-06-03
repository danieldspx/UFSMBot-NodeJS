import * as admin from 'firebase-admin';
import * as querystring from 'querystring';
import * as NodeLogger from 'simple-node-logger';
//Requires
import express = require('express');
import moment = require('moment');
import crypto = require('crypto');
import cors = require('cors');
const fetch = require('node-fetch');
const _ = require('lodash');
require('dotenv').config(); //Apenas para Desenvolvimento
//Interfaces
import { RequestConfig } from './interfaces/request-config';
import { Schedule } from './interfaces/schedule';
import { StudentWrapper } from './interfaces/student-wrapper';
import { RoutineWrapper } from './interfaces/routine-wrapper';
import { DocumentReference } from '@google-cloud/firestore';
import { Moment } from 'moment';
//Const variables
const app = express();
const PORT = process.env.PORT || 5000;
//Initialization
const serviceAccount = require("./config/serviceAccountKey.json");
const log = NodeLogger.createSimpleLogger({
  logFilePath:'./ufsmbot.log',
  timestampFormat:'DD-MM-YYYY HH:mm:ss'
});
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
})
const db = admin.firestore();
app.enable('trust proxy');
app.use(requireHTTPS, express.json(), express.static('public'), cors());//Remova o requireHTTPS quando em Desenvolvimento
app.listen(PORT, () => {
  log.info(`UFSMBot Listening on ${ PORT }`);
})

app.get('/', callAngularApp);
app.get('/login', callAngularApp);
app.get('/home', callAngularApp);
app.get('/account', callAngularApp);

app.post('/auth/login', (req, res) => {
  let currentSession: string;
  const {matricula , password, hasAcceptedTerm} = req.body;
  getLoginSessionID(matricula, password)
  .then((session: string | boolean) => {
    if(session !== false){
      if(isValidSession(<string>session)){
        currentSession = <string>session;
        return getStudentByMatricula(matricula, password);
      }
    }
  })
  .then(async (studentUID) => {
    let updateData = {
      lastLogin: moment().toDate(),
      agreementAccepted: hasAcceptedTerm
    };
    const studentInfo = await getStudentNameAndCourse(matricula, currentSession);
    if(studentInfo !== false){
      updateData = {...updateData, ...studentInfo};
    }
    db.doc(studentUID)
    .update(updateData)
    .catch((error) => {
      log.error(`Error on update user data on login. Error message: ${error}`);
    })
    return studentUID;
  })
  .then((studentUID) => {
    return admin.auth()
    .createCustomToken(studentUID, {matricula: matricula})
  })
  .then((token) => {
    res.send({
      message: 'sucess',
      token: token
    })
  })
  .catch((errorStatus) => {
    if(errorStatus.message == 200){//It returns 200 even if you have the wrong credentials
      res.status(403).send({
        message: 'login attemp failed'
      })
    } else {//Show when the UFSM server is down or something
      res.status(502).send({
        message: 'invalid response from an upstream server'
      })
    }
  })
  .finally(() => {
    if(!isUndefined(currentSession) && isValidSession(currentSession)){
      logOut(currentSession)
      .then((response: any) => {
        if(response.status == 200){
          log.info(`Logout realizado ${currentSession}`);
        } else {
          log.error(`Erro ao fazer logout ${currentSession}`);
        }
      })
    }
  })
})

app.post('/api/agendar', (req, res) => {
  let schedule = <Schedule>req.body;
  getLoginSessionID(schedule.matricula, schedule.password)
  .then((session) => {
    if(session !== false){
      if(isValidSession(<string>session)){
        schedule.session = <string>session;
        return executeFlowAgendamento(schedule)
      }
    }
  })
  .then(() => {
    res.send({message: 'schedule executed successfully'});
  }).catch((e) => {
    res.status(400).send({
      message: 'error when trying to schedule',
      error: e
    })
  })
})

app.get('/api/agendamento', (req, res) => {
  res.send({
    message: 'mass schedule started successfully...'
  });
  getStudentsRef(100,0)
  .then((studentsWrapper) => {
    if(Array.isArray(studentsWrapper)){
      let allSchedules = [];
      for (let student of studentsWrapper) {
        allSchedules.push(
          startScheduleForStudent(student)
        )
      }
      return Promise.all(allSchedules);
    } else {
      throw new Error('error when in fetch students for mass schedule')
    }
  })
  .then(() => {
    log.info('mass schedule finished successfully')
  })
  .catch((error) => {
    log.error(`Error on mass schedule: ${error}`);
  });
})

app.get('/api/errors/replay', (req, res) => {
  res.send({
    message: 'mass schedule started successfully...'
  })
  getScheduleErrors(100)
  .then(async (schedulesWrap: any) => {
    if(Array.isArray(schedulesWrap)){
      let allSchedules = [];
      for (let scheduleWrap of schedulesWrap) {
        let schedule = {...scheduleWrap};
        let session;
        const studentRef = schedule.ref;
        delete schedule.ref;
        try {
          session = await getLoginSessionID(schedule.matricula, schedule.password);
        } catch(e) {
          session = false;
          log.error(e.message);
        }
        if(session !== false && isValidSession(<string>session)){
          schedule.session = session;
          allSchedules.push(
            executeFlowAgendamento(schedule, studentRef, true)
          )
        }
      }
      return Promise.all(allSchedules);
    } else {
      throw new Error('error when in fetch students for mass schedule')
    }
  })
  .then(() => {
    log.info('Error replay executed successfully.')
  })
  .catch((error) => {
    log.error(`Error replay not successfull. Error message: ${error}`)
  })
})

function callAngularApp(req, res) {
  res.sendFile('public/index.html', {root: __dirname })
}

function requireHTTPS(req, res, next) {
    if (!req.secure && !isDevMode()) {
        //FYI this should work for local development as well
        return res.redirect('https://' + req.get('host') + req.url);
    }
    next();
}

async function executeFlowAgendamento(schedule: Schedule, studentRef: string = '', isLast: boolean = true): Promise<void>{
  return agendarRefeicao(schedule)
  .then((response) => {
    if(response.status === 200){
      log.info(`Sucesso ao agendar ${schedule.matricula} ${schedule.dia}`);
    } else {
      throw new Error(`Erro ao agendar (${response.status}) - ${schedule.matricula} - ${schedule.dia}`);
    }
  })
  .catch((error) => {
    saveError(studentRef, {...schedule});
    log.error(error.message);
  })
  .finally(() => {
    if(!isUndefined(schedule.session) && isLast){
      logOut(schedule.session)
      .then((response: any) => {
        if(response.status === 200){
          log.info(`Logout realizado ${schedule.session}`);
        } else {
          log.error(`Erro ao fazer logout ${schedule.session}`);
        }
      });
    }
  })
}

async function getLoginSessionID(matricula: string, password: string): Promise<string | boolean>{
  const data = {
    j_username: matricula,
    j_password: password,
  };
  const requestConfig: RequestConfig = {
    body: querystring.stringify(data),
    referrer: 'https://portal.ufsm.br/ru/index.html',
    url: 'https://portal.ufsm.br/ru/j_security_check'
  };
  return makeRequest(requestConfig)
  .then((response: any) => {
    if(response.url.indexOf('jsessionid') !== -1){
      log.info(`Login realizado ${matricula}`);
      return response.url.split(';')[1].replace("jsessionid=", "JSESSIONID=");
    }
    log.error(`Login falhou - ${matricula}`);
    throw new Error(response.status);
  })
}

async function agendarRefeicao(schedule: Schedule){
  const headers = [['Cookie', schedule.session]];

  let bodyRequest = querystring.stringify({
    'restaurante': schedule.restaurante,
    'periodo.inicio': schedule.dia,
    'periodo.fim': schedule.dia,
    'save': ''
  });

  if(Array.isArray(schedule.refeicao)){
    for (let refeicao of schedule.refeicao) {
        bodyRequest += `&tiposRefeicao=${refeicao}`;
    }
  } else {
    bodyRequest += `&tiposRefeicao=${schedule.refeicao}`;
  }

  const requestConfig: RequestConfig = {
    body: bodyRequest,
    headers: headers,
    referrer: 'https://portal.ufsm.br/ru/usuario/agendamento/form.html',
    url: 'https://portal.ufsm.br/ru/usuario/agendamento/form.html'
  };

  return makeRequest(requestConfig);
}

async function logOut(session: string){
  const headers = [['Cookie', session]];

  const requestConfig: RequestConfig = {
    headers: headers,
    url: 'https://portal.ufsm.br/ru/logout.html',
    referrer: ''
  }

  return makeRequest(requestConfig);
}

async function makeRequest(requestConfig: RequestConfig){
  if(typeof requestConfig.headers === 'undefined'){
    requestConfig.headers = [];
  }
  requestConfig.headers.push(['upgrade-insecure-requests', '1']);
  requestConfig.headers.push(['content-type', 'application/x-www-form-urlencoded']);
  requestConfig.headers.push(['cache-control', 'max-age=0']);
  requestConfig.headers.push(['accept-language', 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7']);
  requestConfig.headers.push(['accept', 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3']);
  let requestInit : RequestInit = {
    body: requestConfig.body,
    method: 'POST',
    headers: requestConfig.headers,
    referrer:requestConfig.referrer,
    referrerPolicy:"no-referrer-when-downgrade",
    mode: 'cors',
    credentials: 'include',
  };
  return fetch(requestConfig.url, requestInit);
}

async function getStudentByMatricula(matricula: string, password: string){
  const encryptedPassword = encrypt(password);
  return db.collection('estudantes')
  .where('matricula', '==', matricula)
  .get()
  .then(async (querySnapshot) => {
    if(querySnapshot.size !== 0){
      let studentRef: DocumentReference;
      querySnapshot.forEach((doc) => {
        studentRef = doc.ref;
      })
      return db.doc(studentRef.path)
      .update({password: encryptedPassword})
      .then(() => {
        return studentRef;
      })
    } else {//Student does not exist
      return db.collection('estudantes')
      .add({
        matricula: matricula,
        password: encryptedPassword,
        lastSchedule: null
      })
    }
  })
  .then((querySnapshot: DocumentReference) => {
    return querySnapshot.path;
  })
}

async function getStudentsRef(limit: number, offset: number): Promise<StudentWrapper[] | boolean>{
  const today = moment();
  let studentsRef:StudentWrapper[] = [];
  return db.collection('estudantes')
  .where('lastSchedule', '==', null)
  .limit(limit)
  .offset(offset)
  .get()
  .then((querySnapshot) => {
    querySnapshot.forEach((doc) => {
      const student = doc.data();
      studentsRef.push({
        ref: doc.ref.path,
        matricula: student.matricula,
        password: decrypt(student.password)
      });
    })
    return db.collection('estudantes')
    .where('lastSchedule','<',today.add(2, 'days').toDate())
    .limit(limit)
    .offset(offset)
    .get()
  })
  .then((querySnapshot) => {
    querySnapshot.forEach((doc) => {
      const student = doc.data();
      studentsRef.push({
        ref: doc.ref.path,
        matricula: student.matricula,
        password: decrypt(student.password)
      })
    })
    return studentsRef;
  })
  .catch(() => {
    return false;
  })
}

async function getScheduleErrors(limit: number){
  let schedulesWrap = [];
  let errors = [];
  return db.collection('errors')
  .where('resolved', '==', false)
  .limit(limit)
  .get()
  .then((querySnapshot) => {
    querySnapshot.forEach((doc) => {
      errors.push({...doc.data(), ref: doc.ref.path});
    })
  })
  .then(() => {
    let all = [];
    for (let error of errors) {
      error.schedule.password = decrypt(error.schedule.password);
      schedulesWrap.push({...error.schedule, ref: error.estudante});
      db.doc(error.ref).delete()
      .catch(() => {
        log.error(`Couldnt delete the error in DB - ${error.ref}`);
      })
    }
    return Promise.all(all);
  })
  .then(() => {
    return schedulesWrap;
  })
  .catch((e) => {
    log.error(e);
    return false;
  })
}

async function getStudentRoutines(ref: string): Promise<RoutineWrapper[] | boolean>{
  return db.collection(`${ref}/rotinas`)
  .get()
  .then((querySnapshot) => {
    let routines: RoutineWrapper[] = [];
    querySnapshot.forEach((doc) => {
      let routine = {
        ...doc.data()
      };
      routine.ref = doc.ref.path;
      routines.push(<RoutineWrapper>routine)
    })
    return routines;
  })
}

async function startScheduleForStudent(student: StudentWrapper): Promise<void[]>{
  let routines = await getStudentRoutines(student.ref);
  if(Array.isArray(routines)){
    let session;
    try {
      session = await getLoginSessionID(student.matricula, student.password);
    } catch(e) {
      session = false;
      log.error(e.message);
    }
    if(session !== false && isValidSession(<string>session)){
      let agendamentos: Promise<void>[] = [];
      let lastSchedule: Moment = moment();
      for (let routine of routines) {
        const days = convertDaysToSchedule(routine.dias);
        const lastDay = moment(_.last(days), "DD/MM/YYYY");
        if(isUndefined(lastSchedule)){
          lastSchedule = lastDay;
        } else if(lastSchedule.isBefore(lastDay)) {
          lastSchedule = lastDay;
        }
        days.forEach((day, index) => {
          let schedule = {
            dia: day,
            restaurante: routine.restaurante,
            refeicao: routine.tiposRefeicao,
            matricula: student.matricula,
            password: student.password,
            session: <string>session
          };
          agendamentos.push(
            executeFlowAgendamento(schedule, student.ref, isLastIndex(index, days))
          )
        })
      }
      try{
        await db.doc(student.ref).update({
          lastSchedule: lastSchedule.toDate()
        });
      }catch(e){
        log.error(e);
      }
      return Promise.all(agendamentos);
    }
  } else {
    log.error("getStudentRoutines returned false");
    return null;
  }
}

async function saveError(studentRef: string, schedule: Schedule){
  delete schedule.session;
  schedule.password = encrypt(schedule.password);
  try {
    await db.collection('errors').add({
      resolved: false,
      estudante: studentRef,
      schedule: schedule
    });
    log.info('Erro salvo');
  }
  catch (e) {
    log.error(`Erro ao salvar o erro ${e}`);
  }
}

async function getStudentNameAndCourse(matricula: string, session: string): Promise<boolean | any>{
  const headers = [['Cookie', session]];
  const requestConfig: RequestConfig = {//It is igly but it is the only way
    headers: headers,
    body: `callCount=1\npage=/ru/usuario/transferencia/credito/form.html\nhttpSessionId=7caf08d8244959875a34e1758d0b\nscriptSessionId=5000E7D9FF69206B62CD4E56F325D285348\nc0-scriptName=usuarioRuCaptchaAjaxService\nc0-methodName=search\nc0-id=0\nc0-param0=number:0\nc0-param1=number:10\nc0-e1=string:${matricula}\nc0-e2=string:sono\nc0-e3=null:null\nc0-e4=null:null\nc0-param2=Object_Object:{matricula:reference:c0-e1, captcha:reference:c0-e2, orderBy:reference:c0-e3, orderMode:reference:c0-e4}\nbatchId=7\n`,
    referrer: 'https://portal.ufsm.br/ru/usuario/transferencia/credito/form.html',
    url: 'https://portal.ufsm.br/ru/dwr/call/plaincall/usuarioRuCaptchaAjaxService.search.dwr'
  };
  return makeRequest(requestConfig)
  .then((response) => {
    return response.text()
  })
  .then((data) => {
    let info = {
      nome: data.match(/s0.nome="(?:.*)"/i)[0].slice(9).replace('"', ''),
      curso: data.match(/s5.nome="(?:.*)"/i)[0].slice(9).replace('"', '')
    };
    info.nome = unscapeUnicode(info.nome);
    info.curso = unscapeUnicode(info.curso);
    return info;
  })
  .catch((error) => {
    log.error(`Error when fetching data from the user. Error message: ${error}`);
    return false;
  });
}

function unscapeUnicode(text){
  return decodeURIComponent(JSON.parse(`"${text}"`));
}

function encrypt(text: string){
  const cryptoKey = crypto.createCipher('aes-128-cbc', process.env.CRYPTOKEY);
  let encrypted = cryptoKey.update(text, 'utf8', 'hex');
  encrypted += cryptoKey.final('hex')
  return encrypted
}

function decrypt(encripted: string){
  const decryptKey = crypto.createDecipher('aes-128-cbc', process.env.CRYPTOKEY);
  let decrypted = decryptKey.update(encripted, 'hex', 'utf8');
  decrypted += decryptKey.final('utf8');
  return decrypted
}

function convertDaysToSchedule(days: number[] | number): string[]{
  let convertedDays: string[] = [];
  if(Array.isArray(days)){
    const today = moment().day();
    const thisWeek = days.filter(day => day>today);
    const nextWeek = days.filter(day => day<today);
    for (let day of thisWeek) {
        convertedDays.push(
          moment().day(day).format("DD/MM/YYYY")
        )
    }
    for (let day of nextWeek) {
        convertedDays.push(
          moment().day(day+7).format("DD/MM/YYYY")
        )
    }
  } else {
    convertedDays.push(
      moment().day(days).format("DD/MM/YYYY")
    );
  }
  return removeUnecessaryDates(sortDates(convertedDays));
}

function sortDates(dates: string[]){
  return _.orderBy(dates, date =>  moment(date, "DD/MM/YYYY").format('YYYYMMDD'), ['asc']);
}

function removeUnecessaryDates(dates: string[]): string[]{
  return dates.filter((dia: string) => {
    return moment(dia, "DD/MM/YYYY")
    .isBefore(
      moment().add(5, 'days')
    )
  })
}

function isValidSession(session: string): boolean{
  return session.toString().indexOf('JSESSIONID') !== -1;
}

function isUndefined(variable): boolean{
  return typeof variable === 'undefined';
}

function isLastIndex(pos, arrayCheck){
  return arrayCheck.length === (pos+1)
}

function isDevMode(): boolean{
  return process.env.DEV === "true";
}

function countTotalUsers(){
  db.collection('estudantes').get().then((querySnapshot) => {
    console.log('Total alunos: '+querySnapshot.size);
  });
}

countTotalUsers();
