import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

export type LogAction = 
  | 'LOGIN' 
  | 'LOGOUT' 
  | 'CREATE_USER' 
  | 'UPDATE_USER' 
  | 'DELETE_USER' 
  | 'RESET_PASSWORD'
  | 'CREATE_SUBJECT'
  | 'UPDATE_SUBJECT'
  | 'DELETE_SUBJECT'
  | 'CREATE_QUESTION'
  | 'UPDATE_QUESTION'
  | 'DELETE_QUESTION';

export const createLog = async (
  userId: string, 
  username: string, 
  action: LogAction, 
  details: string
) => {
  try {
    await addDoc(collection(db, 'logs'), {
      userId,
      username,
      action,
      details,
      timestamp: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error creating log:', error);
  }
};
