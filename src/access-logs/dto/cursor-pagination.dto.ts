import { IsOptional, IsString, IsNumberString } from 'class-validator';
import { Transform } from 'class-transformer';

export class CursorPaginationDto{
    @IsOptional()
    @IsString()
    cursor?: string;

    @IsOptional()
    @IsNumberString()
    limit?: string;
}