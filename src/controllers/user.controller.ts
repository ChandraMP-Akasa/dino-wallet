// src/controllers/user.controller.ts
import * as express from 'express'
import {
  Controller,
  Get,
  Route,
  Post,
  Body,
  Path,
  SuccessResponse,
  Tags,
  Response,
  Security,
  Query,
  Request,
} from "tsoa";
import UserDTO from "../dto/UserDTO";
import CreateUserRequest from "../dto/CreateUserDTO";
import { executeOrder, getOrder, getWalletLedger, getWallets, makeOrder } from '../services/user.service';

import { authenticate, createUser, getUserDetails } from '../services/user.service';
import { RateLimit } from '../decorators/rateLimit';

@Route("users")
@Tags("Users")
export class UserController extends Controller {

  @Post('/register')
  public async registerUser(@Body() requestBody: CreateUserRequest): Promise<object>{
    return createUser(requestBody);
  }

  @Security("BasicAuth")
  @RateLimit({ capacity: 10, refillRate: 1}) //refill per second
  @Get("/authenticate")
  public async authenticateUser(@Request() request: any): Promise<object>{
    return authenticate(request);
  }

  //Get user, wallet and orders for a user
  @Security("BearerAuth")
  @Get("/profile")
  public async getUserProfile(@Request() request: any): Promise<object>{
    return getUserDetails(request);
  }

  //Get wallets or order for an asset type
  @Security("BearerAuth")
  @Get("/wallets/{assetId}")
  public async getWalletforAsset(@Request() request: any, @Path() assetId: number): Promise<object>{
    return getWallets(request, assetId);
  }


  //Get ledger for a wallet
  @Security("BearerAuth")
  @Get("/wallets/{walletId}/ledger")
  public async getLedger(@Request() request: any, @Path() walletId: number): Promise<object>{
    return getWalletLedger(request, walletId);
  }

  //Create orders and executre transactions 
  @Security("BearerAuth")
  @Post("/order")
  public async createOrder(@Request() request: any, @Body() orderRequest: any): Promise<object>{
    return makeOrder(request, orderRequest);
  }

  @Security("BearerAuth")
  @Get("/order/{orderId}")
  public async completeOrder(@Request() request: any, @Path() orderId: string): Promise<object>{
    return getOrder(request, orderId);
  }

  @Security("BearerAuth")
  @Get("/order/{orderId}/execute")
  public async runExecuteOrder(@Request() request: any, @Path() orderId: string): Promise<object>{
    return executeOrder(request, orderId);
  }
}
