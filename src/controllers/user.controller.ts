// src/controllers/user.controller.ts
import {
  Controller,
  Get,
  Route,
  Post,
  Body,
  Path,
  Tags,
  Security,
  Request,
} from "tsoa";
import CreateUserRequest from "../dto/CreateUserDTO";
import { convertAsset, executeOrder, getOrder, getWalletLedger, getWallets, makeOrder, topup } from '../services/user.service';

import { authenticate, createUser, getUserDetails } from '../services/user.service';
import { RateLimit } from '../decorators/rateLimit';

@Route("users")
@Tags("Users")
export class UserController extends Controller {

  @Post('/register')
  @RateLimit({ capacity: 10, refillRate: 1}) //refill per second
  public async registerUser(@Body() requestBody: CreateUserRequest): Promise<object>{
    return createUser(requestBody);
  }

  @Security("BasicAuth")
  @RateLimit({ capacity: 10, refillRate: 1}) //refill per second
  @Get("/authenticate")
  public async authenticateUser(@Request() request: any): Promise<object>{
    return authenticate(request);
  }

  @Security("BearerAuth")
  @RateLimit({ capacity: 10, refillRate: 1})
  @Post('/topup')
  public async topupCredits(@Request() request: any, @Body() topupRequest: any): Promise<object>{
    return topup(request, topupRequest);
  }

  //Get user, wallet and orders for a user
  @Security("BearerAuth")
  @Get("/profile")
  public async getUserProfile(@Request() request: any): Promise<object>{
    return getUserDetails(request);
  }

  //Get wallets for an asset type
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
  @RateLimit({ capacity: 10, refillRate: 1})
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
  @RateLimit({ capacity: 10, refillRate: 1})
  @Get("/order/{orderId}/execute")
  public async runExecuteOrder(@Request() request: any, @Path() orderId: string): Promise<object>{
    return executeOrder(request, orderId);
  }

  @Security("BearerAuth")
  @Post("/wallet/purchase/asset/")
  public async purchaseAsset(@Request() request: any, @Body() purchaseBody: any): Promise<object>{
    return convertAsset(request, purchaseBody);
  }
}
