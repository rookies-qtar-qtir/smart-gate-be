import {
    Controller,
    Post,
    Body,
    HttpCode,
    HttpStatus,
    Get,
    UseGuards
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterAdminDto } from './dto/register-operator.dto';
import { Public } from './decorators/public.decorator';

@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) { }

    @Public()
    @Post('login')
    @HttpCode(HttpStatus.OK)
    async login(@Body() loginDto: LoginDto) {
        const result = await this.authService.login(loginDto);
        return {
            statusCode: HttpStatus.OK,
            message: 'Login successful',
            data: result,
        };
    }

    // @Public()
    // @Post('register/operator')
    // @HttpCode(HttpStatus.CREATED)
    // async registerAdmin(@Body() registerAdminDto: RegisterAdminDto) {
    //     const result = await this.authService.registerAdmin(registerAdminDto);
    //     return {
    //         statusCode: HttpStatus.CREATED,
    //         message: 'Admin registered successfully',
    //         data: result,
    //     };
    // }
}