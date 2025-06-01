import { Controller, Get, Param, Post, Put, Body, Delete } from '@nestjs/common';
import { UserService } from './user.service';

@Controller('user')
export class UserController {
    constructor (private readonly userService: UserService) {}

    @Get()
    findAll() {
        return this.userService.findAll();
    }

    @Post()
    createUser(@Body() data: any) {
        return this.userService.createUser(data);
    }

    @Get(':id')
    findOne(@Param('uid') uid: string) {
        return this.userService.findOne(uid);
    }

    @Put(':id')
    updateUser(@Param('uid') uid: string, @Body() updateData: any) {
        return this.userService.updateUser(uid, updateData);
    }

    @Delete(':id')
    deleteUser(@Param('uid') uid: string) {
        return this.userService.deleteUser(uid);
    }

}
