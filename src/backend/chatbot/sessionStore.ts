import { Session } from '@/types/chatbot';

export const sessions = new Map<string, Session>();

export function createSession(session: Session){
  sessions.set(session.id, session);
  return session;
};

export function getSession(sessionId: string) {
  return sessions.get(sessionId);
};

export function saveSession(session: Session) {
  sessions.set(session.id, session);
  return session;
};
