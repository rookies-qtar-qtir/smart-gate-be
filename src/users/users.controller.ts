import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { AdminOnly } from '../auth/decorators/admin-only.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

@Controller('users')
@AdminOnly()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createUserDto: CreateUserDto, @CurrentUser() admin: JwtPayload) {
    const user = await this.usersService.create(createUserDto);
    return {
      statusCode: HttpStatus.CREATED,
      message: 'User created successfully',
      data: user,
      createdBy: admin.email,
    };
  }

  @Get()
  async findAll(@CurrentUser() admin: JwtPayload) {
    const users = await this.usersService.findAll();
    return {
      statusCode: HttpStatus.OK,
      message: 'Users retrieved successfully',
      data: users,
      accessedBy: admin.email,
    };
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() admin: JwtPayload) {
    const user = await this.usersService.findOne(id);
    return {
      statusCode: HttpStatus.OK,
      message: 'User retrieved successfully',
      data: user,
      accessedBy: admin.email,
    };
  }

  @Get('uid/:uid')
  async findByUid(@Param('uid') uid: string, @CurrentUser() admin: JwtPayload) {
    const user = await this.usersService.findByUid(uid);
    return {
      statusCode: HttpStatus.OK,
      message: 'User retrieved successfully',
      data: user,
      accessedBy: admin.email,
    };
  }

  @Patch(':id')
  async update(
    @Param('id') id: string, 
    @Body() updateUserDto: UpdateUserDto,
    @CurrentUser() admin: JwtPayload
  ) {
    const user = await this.usersService.update(id, updateUserDto);
    return {
      statusCode: HttpStatus.OK,
      message: 'User updated successfully',
      data: user,
      updatedBy: admin.email,
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string, @CurrentUser() admin: JwtPayload) {
    await this.usersService.remove(id);
    return {
      statusCode: HttpStatus.OK,
      message: 'User deleted successfully',
      deletedBy: admin.email,
    };
  }

  @Get(':id/access-logs')
  async findOneWithAccessLogs(@Param('id') id: string, @CurrentUser() admin: JwtPayload) {
    const user = await this.usersService.findOneWithAccessLogs(id);
    return {
      statusCode: HttpStatus.OK,
      message: 'User with access logs retrieved successfully',
      data: user,
      accessedBy: admin.email,
    };
  }

  @Get('uid/:uid/access-logs')
  async findByUidWithAccessLogs(@Param('uid') uid: string, @CurrentUser() admin: JwtPayload) {
    const user = await this.usersService.findByUidWithAccessLogs(uid);
    return {
      statusCode: HttpStatus.OK,
      message: 'User with access logs retrieved successfully',
      data: user,
      accessedBy: admin.email,
    };
  }
}