import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class ProcessAccessDto {
  @IsString()
  @IsNotEmpty()
  uid: string;
}
