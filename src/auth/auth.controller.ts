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
import { RegisterAdminDto } from './dto/register-admin.dto';
import { Public } from './decorators/public.decorator';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { JwtPayload } from './interfaces/jwt-payload.interface';
// import { AdminOnly } from './decorators/admin-only.decorator';

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

    @Public()
    @Post('register/admin')
    @HttpCode(HttpStatus.CREATED)
    async registerAdmin(@Body() registerAdminDto: RegisterAdminDto) {
        const result = await this.authService.registerAdmin(registerAdminDto);
        return {
            statusCode: HttpStatus.CREATED,
            message: 'Admin registered successfully',
            data: result,
        };
    }

    @Get('profile')
    @UseGuards(JwtAuthGuard)
    async getProfile(@CurrentUser() user: JwtPayload) {
        return {
            statusCode: HttpStatus.OK,
            message: 'Profile retrieved successfully',
            data: {
                id: user.sub,
                email: user.email,
                uid: user.uid,
                role: user.role,
                name: user.name,
            },
        };
    }

    // @Get('admin/test')
    // @AdminOnly()
    // async adminTest(@CurrentUser() user: JwtPayload) {
    //     return {
    //         statusCode: HttpStatus.OK,
    //         message: 'Admin endpoint accessed successfully',
    //         data: {
    //             user: user,
    //             timestamp: new Date().toISOString(),
    //         },
    //     };
    // }
}