import { IsString, IsNotEmpty } from 'class-validator';

export class ProcessAccessDto {
  @IsString()
  @IsNotEmpty()
  uid: string;
}
