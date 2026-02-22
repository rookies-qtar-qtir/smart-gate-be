import {
  Controller, Get, Post, Body, Patch, Param, Delete,
  HttpStatus, HttpCode, Query
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { OperatorOnly } from '../auth/decorators/operator-only.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { DeleteUserDto } from './dto/delete-user.dto';

@Controller('users')
@OperatorOnly()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createUserDto: CreateUserDto, @CurrentUser() operator: JwtPayload) {
    const user = await this.usersService.create(createUserDto);
    return {
      statusCode: HttpStatus.CREATED,
      message: 'User created successfully',
      data: user,
      createdBy: operator.email,
    };
  }

  @Get()
  async findAll(@Query('page') page: string = '1') {
    const pageNumber = parseInt(page) || 1;
    const result = await this.usersService.findAll(pageNumber);
    return {
      statusCode: HttpStatus.OK,
      message: 'Users retrieved successfully',
      ...result,
    };
  }

  @Get("operator")
  async findOperator() {
    const result = await this.usersService.findOperator();
    return {
      statusCode: HttpStatus.OK,
      messagge: 'User retrieved successfully',
      ...result,
    }
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() operator: JwtPayload) {
    const user = await this.usersService.findOne(id);
    return {
      statusCode: HttpStatus.OK,
      message: 'User retrieved successfully',
      data: user,
      accessedBy: operator.email,
    };
  }

  @Get('pid/:pid')
  async findByPid(@Param('pid') pid: string, @CurrentUser() operator: JwtPayload) {
    const user = await this.usersService.findByPid(pid);
    return {
      statusCode: HttpStatus.OK,
      message: 'User retrieved successfully',
      data: user,
      accessedBy: operator.email,
    };
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
    @CurrentUser() operator: JwtPayload
  ) {
    const user = await this.usersService.update(id, updateUserDto);
    return {
      statusCode: HttpStatus.OK,
      message: 'User updated successfully',
      data: user,
      updatedBy: operator.email,
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(
    @Param('id') id: string,
    @Body() deleteUserDto: DeleteUserDto,
    @CurrentUser() operator: JwtPayload
  ) {
    await this.usersService.remove(id, deleteUserDto.pin);
    return {
      statusCode: HttpStatus.OK,
      message: 'User deleted successfully',
      deletedBy: operator.email,
    };
  }
}