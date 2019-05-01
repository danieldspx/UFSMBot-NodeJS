import * as admin from 'firebase-admin';
import * as querystring from 'querystring';
//Requires
import express = require('express');
import moment = require('moment');
import crypto = require('crypto');
import cors = require('cors');
const fetch = require('node-fetch');
const _ = require('lodash');
//Interfaces
import { RequestConfig } from './interfaces/request-config';
import { Schedule } from './interfaces/schedule';
import { StudentWrapper } from './interfaces/student-wrapper';
import { RoutineWrapper } from './interfaces/routine-wrapper';
import { DocumentReference } from '@google-cloud/firestore';
//Const variables
const app = express();
const PORT = process.env.PORT || 5000;
//Initialization
const serviceAccount = require("./config/serviceAccountKey.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
})
const db = admin.firestore();
app.enable('trust proxy');
app.use(requireHTTPS, express.json(), express.static('public'), cors());
app.listen(PORT, () => {
  console.log(`UFSMBot Listening on ${ PORT }`);
})

app.get('/', callAngularApp);
app.get('/login', callAngularApp);
app.get('/home', callAngularApp);

app.post('/auth/login', (req, res) => {
  let currentSession: string;
  const {matricula , password} = req.body;
  getLoginSessionID(matricula, password)
  .then((session: string | boolean) => {
    if(session !== false){
      if(isValidSession(<string>session)){
        currentSession = <string>session;
        return getStudentByMatricula(matricula, password);
      }
    }
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
  .catch((e) => {
    res.status(403).send({
      message: 'login attemp failed',
      error: e
    })
  })
  .finally(() => {
    if(!isUndefined(currentSession) && isValidSession(currentSession)){
      logOut(currentSession)
      .then((response: any) => {
        if(response.status === 200){
          console.log('Logout realizado', currentSession);
        } else {
          console.log('Erro ao fazer logout', currentSession);
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
    res.send({
      message: 'mass schedule executed successfully'
    })
  })
  .catch((error) => {
    res.status(400).send({
      message: error
    });
  })
})

function callAngularApp(req, res) {
  res.sendFile('public/index.html', {root: __dirname })
}

function requireHTTPS(req, res, next) {
    if (!req.secure) {
        //FYI this should work for local development as well
        return res.redirect('https://' + req.get('host') + req.url);
    }
    next();
}

async function executeFlowAgendamento(schedule: Schedule, isLast: boolean = true): Promise<void>{
  return agendarRefeicao(schedule)
  .then((response) => {
    if(response.status === 200){
      console.log('Sucesso ao agendar', schedule.matricula, schedule.dia);
    } else {
      throw new Error('Erro ao agendar');
    }
  })
  .catch((error) => {
    console.log(error);
  })
  .finally(() => {
    if(!isUndefined(schedule.session) && isLast){
      logOut(schedule.session)
      .then((response: any) => {
        if(response.status === 200){
          console.log('Logout realizado');
        } else {
          console.log('Erro ao fazer logout');
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
      console.log("Login realizado", matricula);
      return response.url.split(';')[1].replace("jsessionid=", "JSESSIONID=");
    }
    throw new Error('login failed');
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
  .then((querySnapshot) => {
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
  const today = new Date();
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
    .where('lastSchedule','<',today)
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
    for (let routine of routines) {
      let session = await getLoginSessionID(student.matricula, student.password);
      if(session !== false){
        if(isValidSession(<string>session)){
          let agendamentos: Promise<void>[] = [];
          const days = convertDaysToSchedule(routine.dias);
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
              executeFlowAgendamento(schedule, isLastIndex(index, days))
            )
          })

          try{
            await db.doc(student.ref).update({
              lastSchedule: moment(days.pop(), "DD/MM/YYYY").toDate()
            });
          }catch(e){
            console.log('Error', e);
          }

          return Promise.all(agendamentos);
        }
      }
    }
  } else {
    console.log("getStudentRoutines returned false");
    return null;
  }
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
  return session.indexOf('JSESSIONID') !== -1;
}

function isUndefined(variable): boolean{
  return typeof variable === 'undefined';
}

function isLastIndex(pos, arrayCheck){
  return arrayCheck.length === (pos+1)
}
