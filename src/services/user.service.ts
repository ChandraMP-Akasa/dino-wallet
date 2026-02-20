// src/services/user.service.ts

import appConfigService from "../config/app-config";
import CreateUserRequest from "../dto/CreateUserDTO";
import UserDTO from "../dto/UserDTO";
import { hashPassword } from "../utils/hashing";
import { dbQuery } from "../config/query";
import { authCheck, registerUser } from "../queries/sql";
import { JsonWebTokenError } from "jsonwebtoken";
import jwt from "jsonwebtoken";
import { PoolClient } from "pg";
import pool from "../config/db";
import { v4 as uuid } from "uuid";

//TODO: Implement a job queue to handle wallet creation and bonus incentive
export async function createUser(payload: CreateUserRequest): Promise<object> {
  if (!payload?.username || payload.username.trim() === "" || !payload?.password || payload.password.trim() === "" || !payload?.email || payload.email.trim() === "" ) {
    throw { status: 400, message: "Invalid request payload" };
  }
  const client: PoolClient = await pool.connect();

  try {
    await client.query("BEGIN");

    const passwordHash = await hashPassword(payload.password);
    const username = payload.username.trim();
    const email = payload.email.trim().toLowerCase();
    
    //Register a new user;
    const result: any = await dbQuery(registerUser,
      [
        username,
        passwordHash,
        email,
        payload.phone || null,
      ]
    );

    if (!result || result.length === 0) {
      throw { status: 500, message: "Failed to create user" };
    }
    const userId = result[0].id;

    //Get credit asset id
    const creditAsset: any = await dbQuery("select id from assets where name = $1 limit 1", ['credits'], 3, client)
    if(creditAsset.length === 0) {
      throw { status: 500, message: "Failed to get credit asset id" };
    }
    const assetId = creditAsset[0].id;

    //Initialize the user with 100 credits
    let initCredit = 10;
    const initCreditResult: any = await dbQuery("select value from vairables where name = $1 limit 1", ['bonus'], 3, client);
    if(initCreditResult.length > 0){
      initCredit = initCreditResult[0].value.value;
    }
    console.log('initCredit -', initCredit);

    //Generate a wallet for the newly registerd user
    //TODO: We have to re-calculate the balance due after making the ledger entries.
    const walletResult: any = await dbQuery(
      `INSERT INTO WALLETS (owner_id, asset_id, balance_cached) VALUES ($1, $2, $3) RETURNING id`, 
      [userId, assetId, initCredit, 3, client]
    );

    if (!walletResult || walletResult.length === 0) {
      throw { status: 500, message: "Failed to create user wallet" };
    }
    const userWallet = walletResult[0];
    console.log('userWallet- ', userWallet);

    const systemWallet: any = await dbQuery(
      `SELECT id, balance FROM wallets WHERE owner_id IS NULL AND owner_type = $1 AND asset_id = $2 LIMIT 1`,
      ['system', assetId],
      3,
      client
    );
    if (!systemWallet || systemWallet.length === 0) {
      throw { status: 500, message: "System wallet not found" };
    }
    const sysWallet = systemWallet[0];
    console.log('systemWallet -', sysWallet);

    //Generate a order;
    const orderId = uuid();
    const orderResult: any = await dbQuery(
      `INSERT INTO orders (id, user_id, asset_id, type, amount,  status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [orderId, userId, assetId,  'bonus', initCredit, 'processing'], 3, client
    );

    if (!orderResult || orderResult.length === 0) {
      throw { status: 500, message: "Failed to create user order" };
    }

    //Ledger entries and remaining transaction -> 
    //1. Debit system wallet
    //2. Credit user wallet
    //3. Update balance_cached in system wallet
    //4. Update balance_cached in user wallet
    //5. Update order status to completed


    const ledgerDebitResult: any = await dbQuery(
      `INSERT INTO ledger (id, order_id, wallet_id, debit_amount) VALUES ($1, $2, $3, $4)`,
      [uuid(), orderId, sysWallet.id, initCredit], 3, client
    );

    const ledgerCreditResult: any = await dbQuery(
      `INSERT INTO ledger(id, order_id, wallet_id, credit_amount) VALUES ($1, $2, $3, $4)`,
      [uuid(), orderId, userWallet.id, initCredit]
    );

    // Update the system wallet balance
    // Check how to calculate the absolute balance_cached value after the transaction. 
    // We can not rely on the balance_cached value in the system wallet as it can be updated by other transactions.
    // We have to calculate the balance based on the ledger entries.
    const updateSysWalletResult: any = await dbQuery(
      `UPDATE wallets 
        SET balance_cached = (
            SELECT COALESCE(SUM( 
              COALESCE(credit_amount, 0) - COALESCE(debit_amount, 0)
            ), 0) 
            FROM ledger 
            WHERE wallet_id = $1
        ) 
        WHERE id = $1`,
      [sysWallet.id],
      3,
      client
    );

    const updateUserWalletResult: any = await dbQuery(
        `UPDATE wallets SET balance_cached = (
          SELECT COALESCE(SUM( 
              COALESCE(credit_amount, 0) - COALESCE(debit_amount, 0)
            ), 0) 
          FROM ledger 
          WHERE wallet_id = $1
        ) WHERE id = $1`,
      [userWallet.id],
      3,
      client
    );

    //Mark order completed
    const updateOrderResult: any = await dbQuery(
      `UPDATE orders SET status = $1 WHERE id =$2`,
      ['completed', orderId], 3, client
    );
    
    await client.query('COMMIT');
    
    return {
      status: 201,
      message: "User created successfully",
      userid: result[0].id,
      orderid: orderId
    }
  } catch (err: any) {
    await client.query("ROLLBACK");
    // PostgreSQL duplicate key error
    if (err.code === "23505") {
      throw { status: 409, message: "Username or email already exists" };
    }
    throw { status: 500, message: "Failed to create user" };
  }finally {
    client.release();
  }
}

export async function authenticate(req: any): Promise<any>{
  const secret = appConfigService.getJwtSecret();
  try {
    const authUser = req.user;
    if (!authUser) {
      const error: any = new Error("No user information found in request");
      error.status = 401;
      throw error;
    }

    const { id, username, role, email} = authUser;
    // Payload (DO NOT put password here)
    const payload = {
      sub: id,
      username,
      role: role,
      email: email
    };

    const expiresIn = "8h";
    const token = jwt.sign(payload, secret, {
      algorithm: "HS256",
      expiresIn,
    });

    return {
      email,
      token,
    };
  } catch (err: any) {
    console.error("Authentication failed:", err.message);
    err.status = 401;
    throw err;
  }
}

// export async function getAllUsers(): Promise<UserDTO[]> {
//   const  config = appConfigService.getConfig();
//   const secrets = appConfigService.getSecrets();

//   console.log('dbConfig -', config.db);
//   console.log('secrets -', config.secrets);
//   console.log('env -', config.nodeEnv)
//   return [
//     { id: 1, name: "Chandra" },
//     { id: 2, name: "John Doe" },
//   ];
// }

// export async function getUserById(id: number): Promise<UserDTO | null> {
//   const users = await getAllUsers();
//   const u = users.find((x) => x.id === Number(id)) ?? null;
//   console.warn('user -', u)
//   return u;
// }


// export async function searchUser(id: number, age?: number, active?: boolean): Promise<object>{
//   return {
//     message: 'success',
//     status: 200,
//     data: true
//   };
// }
