export type User = {
  name: string;
  profile_pic: string;
  email: string;
  date: string;
  teams: string[];
};

export type UserType = {
  id: string;
  name: string;
  email: string;
  org_id: string;
  role: string;
  profile_pic?: string;
  calendar?: string;
  access_token?: string;
  refresh_token?: string;
  tag_lead?: any;
};

export type UserData = {
  first_name: string;
  last_name: string;
  email?: string | null;
  mobile_phone?: string | null;
  sys_id: string;
  employee_number?: string;
};
