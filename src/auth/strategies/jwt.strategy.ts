import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SessionService } from '../../session/session.service';
import { ISession, SessionStatus } from '../../session/entities/session.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly sessionService: SessionService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get('JWT_SECRET'),
    });
  }

  async validate(payload: any): Promise<ISession> {
    const session = await this.sessionService.findOne(payload.id);
    
    if (!session) {
      throw new UnauthorizedException('Session not found');
    }

    // Check if session is revoked
    if (session.status === SessionStatus.REVOKED) {
      throw new UnauthorizedException('Session has been revoked');
    }

    // Check if session is expired by status
    if (session.status === SessionStatus.EXPIRED) {
      throw new UnauthorizedException('Session has expired');
    }

    // Check if session is expired by time
    const currentTime = Date.now();
    const expirationTime = session.timestamp + session.duration;
    if (currentTime > expirationTime) {
      // Mark session as expired in database
      await this.sessionService.update(session._id, { status: SessionStatus.EXPIRED });
      throw new UnauthorizedException('Session has expired');
    }

    // Only return active sessions
    if (session.status === SessionStatus.ACTIVE) {
      return session;
    }

    throw new UnauthorizedException('Invalid session status');
  }
}
