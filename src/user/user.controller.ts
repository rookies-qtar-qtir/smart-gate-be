import { 
    Controller, 
    Get, Param, Post, Put, Body, Delete,
    NotFoundException, BadRequestException, InternalServerErrorException 
} from '@nestjs/common';
import { UserService } from './user.service';

@Controller('user')
export class UserController {
    constructor (private readonly userService: UserService) {}

    @Get()
    async findAll() {
        try {
            return await this.userService.findAll();
        } catch(err) {
            throw new InternalServerErrorException('Failed to fetch users');
        }

    }

    @Post()
    async createUser(@Body() data: any) {
        try {
            const createdUserData = await this.userService.createUser(data);
            return {
                data: createdUserData,
                message: 'User created successfully'
            };
        } catch(err){
            if (err.code === 11000) {
                throw new BadRequestException('UID already exists');
              }
            throw new InternalServerErrorException('Failed to create user');
        }
    }

    @Get(':id')
    async findOne(@Param('id') id: string) {
        const user = await this.userService.findOne(id);
        if(!user) {
            throw new NotFoundException(`User with ID ${id} not found`);
        }
        return user;
    }

    @Put(':id')
    async updateUser(@Param('id') id: string, @Body() updateData: any) {
        const updated = await this.userService.updateUser(id, updateData);
        if (!updated) {
            throw new NotFoundException(`User with UID '${id}' not found`);
        }
        return {
            message: `User with UID '${id}' successfully updated`,
            data: updated
        };
    }

    @Delete(':id')
    async deleteUser(@Param('id') id: string) {
        const deleted = await this.userService.deleteUser(id);
        if (!deleted) {
            throw new NotFoundException(`User with UID '${id}' not found`);
        }
        return { message: 'User deleted successfully' };
    }

}
