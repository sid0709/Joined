export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: "candidate" | "employee" | "scout";
};

export type AuthSession = {
  user: SessionUser;
};
