// src/services/user.service.ts

import appConfigService from "../config/app-config";
import CreateUserRequest from "../dto/CreateUserDTO";
import UserDTO from "../dto/UserDTO";
import { hashPassword } from "../utils/hashing";
import { dbQuery } from "../config/query";
import { authCheck, registerUser } from "../queries/sql";
import { JsonWebTokenError } from "jsonwebtoken";
import jwt from "jsonwebtoken";
import { Pool, PoolClient } from "pg";
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
      ], 3, client
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
    const initCreditResult: any = await dbQuery("select value from variables where name = $1 limit 1", ['bonus'], 3, client);
    if(initCreditResult.length > 0){
      initCredit = initCreditResult[0].value.value;
    }
    console.log('initCredit -', initCredit);

    //Generate a wallet for the newly registerd user
    //TODO: We have to re-calculate the balance due after making the ledger entries.
    const walletResult: any = await dbQuery(
      `INSERT INTO wallets (owner_type, owner_id, asset_id, balance_cached, created_at, updated_at) VALUES ($1, $2, $3, $4, NOW(), NOW()) 
      ON CONFLICT (owner_type, owner_id, asset_id)
      DO UPDATE SET owner_id = EXCLUDED.owner_id
      RETURNING id;
      `, 
      ['user', userId, assetId, initCredit], 3, client
    );

    if (!walletResult || walletResult.length === 0) {
      throw { status: 500, message: "Failed to create user wallet" };
    }
    const userWallet = walletResult[0];
    console.log('userWallet- ', userWallet);

    const systemWallet: any = await dbQuery(
      `SELECT id, balance_cached as balance FROM wallets WHERE owner_id IS NULL AND owner_type = $1 AND asset_id = $2 LIMIT 1`,
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
    let orderId = uuid();
    const orderResult: any = await dbQuery(
      `INSERT INTO orders (id, user_id, asset_id, type, amount,  status) VALUES ($1, $2, $3, $4, $5, $6) 
      ON CONFLICT (user_id, type) 
      DO UPDATE SET user_id = EXCLUDED.user_id 
      RETURNING id`,
      [orderId, userId, assetId,  'bonus', initCredit, 'processing'], 3, client
    );

    if (!orderResult || orderResult.length === 0) {
      throw { status: 500, message: "Failed to create user order" };
    }

    console.log('orderResult -', orderResult);
    orderId = orderResult[0].id;
    
    //Check if the bonus has already been granted for this order (idempotent retry)
    const existingLedger = await dbQuery(
      `SELECT 1 FROM ledger WHERE order_id = $1 LIMIT 1`,
      [orderId],
      3,
      client
    );

    if (existingLedger.length > 0) {
      await client.query("COMMIT");
      return { status: 200, message: "Bonus already granted" };
    }

    //Ledger entries and remaining transaction -> 
    //1. Debit system wallet
    //2. Credit user wallet
    //3. Update balance_cached in system wallet
    //4. Update balance_cached in user wallet
    //5. Update order status to completed

    const walletIds = [Number(sysWallet.id), Number(userWallet.id)]
      .sort((a, b) => a - b);
      
    for (const wid of walletIds) {
      await dbQuery(
        `SELECT id FROM wallets WHERE id = $1 FOR UPDATE`,
        [wid],
        3,
        client
      );
    }

    const ledgerDebitResult: any = await dbQuery(
      `INSERT INTO ledger (id, order_id, wallet_id, debit_amount) VALUES ($1, $2, $3, $4)`,
      [uuid(), orderId, sysWallet.id, initCredit], 3, client
    );

    const ledgerCreditResult: any = await dbQuery(
      `INSERT INTO ledger (id, order_id, wallet_id, credit_amount) VALUES ($1, $2, $3, $4)`,
      [uuid(), orderId, userWallet.id, initCredit], 3, client
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

    if (err.code === "23505") {
      // Username or email duplicate
      if (
        err.constraint === "users_username_key" ||
        err.constraint === "users_email_key"
      ) {
        throw { status: 409, message: "Username or email already exists" };
      }

      // Bonus already granted (idempotent retry)
      if (err.constraint === "unique_bonus_per_user") {
        return {
          status: 200,
          message: "Bonus already granted",
        };
      }

      // Wallet already exists (idempotent retry)
      if (err.constraint === "wallets_owner_type_owner_id_asset_id_key") {
        // Safe retry case
        return {
          status: 200,
          message: "Wallet already exists",
        };
      }
    }
    throw { status: 500, message: "Failed to create user" };
  }
  finally {
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

export async function getUserDetails(req: any): Promise<any>{
  console.log("get User details -", req.user);  
  //I want to get the wallets with asset type, and orders
  try{
    const userId = req.user.sub;
    //Get the user wallets
    const walletResult: any = await dbQuery(
      `SELECT w.id, w.asset_id, a.name as asset_name, w.balance_cached, w.created_at  
        FROM wallets w 
        JOIN assets a ON w.asset_id = a.id
        WHERE w.owner_type = 'user' AND w.owner_id = $1`,
      [userId]
    );

    const wallets = walletResult || [];

    //Get all user orders
    const orderResults = await dbQuery(
      `
      SELECT o.id, o.asset_id, a.name as asset_name, o.amount, o.status, o.created_at
      FROM orders o
      JOIN assets a ON o.asset_id = a.id
      WHERE o.user_id = $1`,
      [userId]
    )

    const orders = orderResults || [];
    return {
      user: req.user,
      wallets: wallets,
      orders: orders
    };
  }catch(err: any){
    console.error("Failed to get user details -", err.message);
    err.status = err.status || 500;
    throw err;
  }
}

export async function getWallets(req: any, assetId: number): Promise<any>{
  try{
    const userId = req.user.sub;
    const walletResult: any = await dbQuery(
      `SELECT w.id, w.asset_id, a.name as asset_name, w.balance_cached, w.created_at  
        FROM wallets w 
        JOIN assets a ON w.asset_id = a.id
        WHERE w.owner_type = 'user' AND w.owner_id = $1 AND w.asset_id = $2 LIMIT 1`,
      [userId, assetId]
    );
    return walletResult[0] || [];  
  }catch(err: any){
    console.error("Failed to get user wallets -", err.message);
    err.status = err.status || 500;
    throw err;
  }
}

export async function getWalletLedger(req: any, walletId: number): Promise<any>{
  try{
    const userId = req.user.sub;
    // check if the wallet belongs to the user first
    const walletResult: any = await dbQuery(
      `SELECT id FROM wallets WHERE id = $1 AND owner_type = 'user' AND owner_id = $2 LIMIT 1`,
      [walletId, userId]
    )
    if (!walletResult || walletResult.length === 0) {
      throw { status: 404, message: "Wallet not found or inaccessible" };
    }
    // If wallet exists and belongs to user, return ledger entries
    const ledgerResult: any = await dbQuery(
      `SELECT * FROM ledger WHERE wallet_id = $1 ORDER BY created_at DESC`,
      [walletId]
    );
    return ledgerResult;

  }catch(err: any){
    console.error("Failed to get wallet ledger -", err.message);
    err.status = err.status || 500;
    throw err;
  }
}

export async function makeOrder(req: any, orderRequest: any): Promise<any>{
  const client: PoolClient = await pool.connect();
  try{
    await client.query("BEGIN");
    const userId = req.user.sub;
    const {assetId, type, amount} = orderRequest;

    if(!assetId || !type || !amount || amount <= 0 || !userId){
      throw { status: 400, message: "Missing required order parameters" };
    }
    
    const assetExists: any = await dbQuery(
      `SELECT * FROM assets WHERE id = $1 LIMIT 1`,
      [assetId], 3, client
    )
    
    if(!assetExists || assetExists.length === 0){
      throw { status: 400, message: "Invalid assetId" };
    }

    const orderId = uuid();
    const insertQuery = `
      INSERT INTO dinowallet.orders 
        (id, user_id, asset_id, type, amount, status, attempts, expires_at)
      VALUES 
        ($1, $2, $3, $4, $5, 'pending', 0, NOW() + INTERVAL '10 minutes')
      RETURNING id;
    `;

    // Create order with status 'pending'
    const orderResult: any = await dbQuery(
      insertQuery,
      [orderId, userId, assetId, type, amount], 3, client
    );

    if (!orderResult || orderResult.length === 0) {
      throw { status: 500, message: "Failed to create order" };
    }
    await client.query("COMMIT");
    
    return {
      status: 201,
      message: "Order created successfully",
      orderId: orderResult[0].id
    }
  }catch(err: any){
    await client.query("ROLLBACK");
    console.error("Failed to create order - ", err.message);
    err.status = err.status || 500;
    throw err;
  }finally{
    client.release();
  }
}

export async function getOrder(req: any, orderId: string): Promise<any>{
  try{
    const userId = req.user.sub;
    if(!orderId || orderId.trim() === ""){
      throw { status: 400, message: "Invalid orderId"}
    }
    const orderResult: any = await dbQuery(
      `SELECT o.id, o.user_id, u.username, o.asset_id, a.name as asset_name, o.type, o.amount, o.status, o.attempts, o.expires_at, o.failed_reason, o.last_attempt_at, o.created_at 
      FROM orders o
      JOIN assets a ON o.asset_id = a.id 
      JOIN users u ON o.user_id = u.id 
      WHERE o.id = $1 AND o.user_id = $2`,
      [orderId, userId]
    );

    if(!orderResult || orderResult.length === 0){
      throw { status: 404, message: "Order not found or inaccessible" };
    }
    return orderResult[0];
  }catch(err: any){
    console.error("Failed to fetch order details -", err.message);
    err.status = err.status || 500;
    throw err;
  }
}

export async function executeOrder(req: any, orderId: string): Promise<any>{
  const client: PoolClient = await pool.connect();
  try{
    await client.query("BEGIN");

    const userId = req.user.sub;
    if(!orderId || orderId.trim() === "" || !userId){
      throw { status: 400, message: "Invalid orderId or userId"}
    }
    
    const orderResult: any = await dbQuery(
      `SELECT * FROM orders 
       WHERE id = $1 AND user_id = $2 LIMIT 1 FOR UPDATE`,
       [orderId, userId], 3, client
    )

    if (orderResult.length === 0) {
      throw { status: 404, message: "Order not found or inaccessible" };
    }

    const order = orderResult[0];

    if (order.status === "completed") {
      await client.query("COMMIT");
      return { status: 200, message: "Order already completed" };
    }

    if (order.status === "failed") {
      throw { status: 400, message: "Order already failed" };
    }

    if (order.status === "processing") {
      throw { status: 409, message: "Order already processing" };
    }

    //Check order expiry
    if (order.expires_at && new Date(order.expires_at) < new Date()) {
      await dbQuery(
        `UPDATE orders SET status = 'failed' WHERE id = $1`,
        [orderId], 3, client
      );
      await client.query("COMMIT");
      return { status: 400, message: "Order expired" };
    }

    //Check number of attempts
    if (order.attempts >= 3) {
      await dbQuery(
        `UPDATE orders SET status = 'failed' WHERE id = $1`,
        [orderId], 3, client
      );
      await client.query("COMMIT");
      return { status: 400, message: "Max retry limit reached" };
    }
    
    //Update the number of status and attempts for the order
    await dbQuery(
      `UPDATE orders SET status = 'processing', attempts = attempts + 1 WHERE id = $1 `,
      [orderId], 3, client
    );

    const assetId = order.asset_id;
    const amount = Number(order.amount)
    const type = order.type;

    //Lock user wallet for the asset type
    const userWalletResult: any = await dbQuery(
      `SELECT * FROM wallets WHERE owner_type = 'user' AND owner_id = $1 AND asset_id = $2`,
      [userId, assetId], 3, client
    );
    if (userWalletResult.length === 0) {
      throw { status: 400, message: "User wallet not found" };
    }
    const userWallet = userWalletResult[0];

    const systemWalletResult: any = await dbQuery(
      `SELECT * FROM wallets where owner_type = 'system' AND asset_id = $1`,
      [assetId], 3, client
    )
    if (systemWalletResult.length === 0) {
      throw { status: 400, message: "System wallet not found" };
    }
    const systemWallet = systemWalletResult[0];

    const walletIds = [Number(systemWallet.id), Number(userWallet.id)]
      .sort((a, b) => a - b);
    for (const wid of walletIds) {
      await dbQuery(
        `SELECT id FROM wallets WHERE id = $1 FOR UPDATE`,
        [wid],
        3,
        client
      );
    }

    //Balance validation - 
    if(type === 'spend'){

        //Debit the user waller with balance check - This will ensure that we do not have negative balance in user wallet.
        const userWalletDebit = await dbQuery(
        `UPDATE dinowallet.wallets
         SET balance_cached = balance_cached - $1
         WHERE id = $2 
         AND balance_cached >= $1 
         returning id`,
        [amount, userWallet.id], 3, client
      );

      if (userWalletDebit.length === 0) {
      await dbQuery(
        `UPDATE orders SET status = 'pending', attempts = attempts + 1 WHERE id = $1`,
        [orderId], 3, client
      );
        await client.query("COMMIT");
        return { status: 400, message: "Insufficient balance" };
      }

      //Ledger entries -> user debit
      await dbQuery(
        `INSERT INTO ledger 
        (id, order_id, wallet_id, debit_amount, credit_amount, created_at)
        VALUES
        ($1, $2, $3, $4, 0, CURRENT_TIMESTAMP)`,
        [uuid(), orderId, userWallet.id, amount], 3, client
      )

      //Credit system wallet 
      await dbQuery(
        `UPDATE wallets SET balance_cached = balance_cached + $1 WHERE id = $2`,
        [amount, systemWallet.id], 3, client
      );

      //Ledger entries -> system credit
      await dbQuery(
        `INSERT INTO ledger 
        (id, order_id, wallet_id, debit_amount, credit_amount, created_at)
        VALUES
        ($1, $2, $3, 0, $4, CURRENT_TIMESTAMP)`,
        [uuid(), orderId, systemWallet.id, amount], 3, client
      )
    }else if(type === 'bonus' || type === 'topup'){

      //Debit system wallet 
      await dbQuery(
        `UPDATE wallets SET balance_cached = balance_cached - $1 WHERE id = $2`,
        [amount, systemWallet.id], 3, client
      );

      //Update ledger -> system debit
      await dbQuery(
        `INSERT INTO ledger (id, order_id, wallet_id, debit_amount, credit_amount, created_at)
         VALUES ($1, $2, $3, $4, 0, CURRENT_TIMESTAMP)`,
        [uuid(), orderId, systemWallet.id, amount],
        3, client
      );

      //Credit user wallet
      await dbQuery(
        `UPDATE wallets SET balance_cached = balance_cached + $1 WHERE id = $2`,
        [amount, userWallet.id], 3, client
      );

      //Update ledger -> User credit
      await dbQuery(
        `INSERT INTO ledger (id, order_id, wallet_id, debit_amount, credit_amount, created_at)
        VALUES ($1, $2, $3, 0, $4, CURRENT_TIMESTAMP)`,
        [uuid() , orderId, userWallet.id, amount],
        3, client
      );
    }

    //Mark order completed
    await dbQuery(
      `UPDATE orders
       SET status = 'completed'
       WHERE id = $1`,
      [orderId], 3, client
    );

    await client.query("COMMIT");
    return {
      status: 200,
      message: "Order executed successfully!"
    }
  }catch(err: any){
    await client.query("ROLLBACK");
    await dbQuery(
      `UPDATE orders SET status = 'pending', attempts = attempts + 1, last_attempt_at = CURRENT_TIMESTAMP, failed_reason = $2 WHERE id = $1`,
      [orderId, err.message]
    );
    console.error("Failed to execute order -", err.message);
    err.status = err.status || 500;
    throw err;
  }finally{
    client.release();
  }
}