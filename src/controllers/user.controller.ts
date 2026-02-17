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
import {
getAllUsers, getUserById, createUser,
searchUser,
} from "../services/user.service";

@Route("users")
@Tags("Users")
export class UserController extends Controller {

  @Security('basic')
  @Get("/")
  public async getUsers(@Request() request: any): Promise<object> {
    // THIS retrieves the object returned by expressAuthentication()
    const authUser = request.user;
    if(!authUser) return {
      status: 'failed',
      statuscode: 500,
      message: `Failed to authenticate the user! Please provice correct username or password.`
    }
    console.log('authUser -', authUser);
    return getAllUsers();
  }

  @Get("/{id}")
  @Response(404, "Not Found")
  public async getUserById(@Path() id: number): Promise<UserDTO> {
    const user = await getUserById(Number(id));
    if (!user) {
      this.setStatus(404);
      throw new Error("User not found");
    }
    return user;
  }

  @SuccessResponse("201", "Created")
  @Post("/")
  public async createUser(@Body() requestBody: CreateUserRequest): Promise<UserDTO> {
    const created = await createUser(requestBody);
    this.setStatus(201);
    return created;
  }

  @Get("/search")
  public async searchUsers(
    @Query() id: number,
    @Query() age?: number,
    @Query() active?: boolean
  ): Promise<object> {
    return searchUser( id, age, active );
  }
}
