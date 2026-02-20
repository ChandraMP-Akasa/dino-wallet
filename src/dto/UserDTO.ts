export default interface UserDTO {
  username: string;
  type?: string;
  password_hash: string;
  email: string;
  phone: string;
  created_at: Date;
  updated_at: Date;

  
}