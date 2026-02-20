
export default interface CreateUserRequest {
  username: string;
  password: string;
  email: string;
  phone?: string | null;
}
