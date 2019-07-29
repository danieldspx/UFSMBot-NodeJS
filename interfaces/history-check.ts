import { Moment } from "moment";
import { DocumentReference } from "@google-cloud/firestore";

export interface HistoryCheck {
  session?: string,
  ref: DocumentReference,
  matricula: string,
  password: string,
  lastHistoryCheck: Moment,
  banUntil: Moment,
  banCount: number,
  email?: string
}
