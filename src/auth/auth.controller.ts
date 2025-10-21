import { Controller, Request, Post, UseGuards, Body, Delete, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('session')
  async createSession(@Request() request): Promise<any> {
    return this.authService.createToken(request);
  }

  @Delete('session/:leadId')
  async deleteSession(
    @Request() request,
    @Param('leadId') leadId: string, // Get leadId from URL param
  ): Promise<any> {
    // You might want to validate leadId here
    return this.authService.deleteToken(leadId);
  }


  // TODO: find an alternate way of returning this response by using Guards
  // @All('register')
  // async notAllowedRegister(@Request() request, @Res() response): Promise<any> {
  //   // Return a 405 Method Not Allowed error for any HTTP method that is not POST
  //   if (request.method !== 'P  OST') {
  //     response.setHeader('Allow', 'POST');
  //     response.status(405).send({statusCode: 405, error: METHOD_NOT_ALLOWED});
  //   }
  // }

  // @UseGuards(LocalAuthGuard)
  // @Post('login')
  // @ApiBody({type: UserCredentialsDto})
  // async login(@Request() req): Promise<RegisterResponseDto> {
  //   return this.authService.createToken(req.user);
  // }

  // @All('login')
  // async notAllowedLogin(@Request() request, @Res() response): Promise<any> {
  //   // Return a 405 Method Not Allowed error for any HTTP method that is not POST
  //   if (request.method !== 'POST') {
  //     response.setHeader('Allow', 'POST');
  //     response.status(405).send({statusCode: 405, error: METHOD_NOT_ALLOWED});
  //   }
  // }
}
