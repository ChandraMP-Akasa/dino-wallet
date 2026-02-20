export const registerUser =`
INSERT INTO dinowallet.users (username, password_hash, email, phone, created_at, updated_at)
VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)  
ON CONFLICT (username) DO NOTHING
RETURNING id;
`;

export const authCheck =`
SELECT id, username, email, password_hash, type
FROM dinowallet.users
WHERE username = $1 
   OR email = $2 
LIMIT 1;
`

