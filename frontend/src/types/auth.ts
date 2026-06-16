// types/auth.ts or wherever you prefer to keep your custom type definitions
import { Session } from 'next-auth';

export interface CustomSession extends Session {
  id?: string;
  name?: string;
  email?: string;
  org_id?: string;
  role?: string;
  profile_pic?: string;
  calendar?: string;
  access_token?: string;
}
