import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class CreateOrganizationDto {
  @IsString()
  @IsNotEmpty()
  orgName: string;

  @IsString()
  @IsNotEmpty()
  userName: string;

  @IsEmail()
  @IsNotEmpty()
  userEmail: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  userPassword: string;

  @IsString()
  @IsNotEmpty()
  masterKey: string;
}
