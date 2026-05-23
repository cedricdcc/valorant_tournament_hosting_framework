import { Controller, Get, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { AuthService } from './auth.service.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('discord/authorize')
  discordAuthorize(@Query('privacyOptIn') privacyOptIn: string | undefined, @Res() res: Response): void {
    const optIn = privacyOptIn === 'true';
    const redirectUrl = this.authService.buildDiscordAuthorizeUrl(optIn);
    res.redirect(302, redirectUrl);
  }

  @Get('discord/callback')
  async discordCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const linkToken = await this.authService.exchangeDiscordCode(
      this.authService.assertAuthorizationCode(code),
      this.authService.assertState(state),
    );

    const riotAuthorizeUrl = this.authService.buildRiotAuthorizeUrl(linkToken);
    res.redirect(302, riotAuthorizeUrl);
  }

  @Get('riot/authorize')
  riotAuthorize(@Query('linkToken') linkToken: string | undefined, @Res() res: Response): void {
    const verifiedLinkToken = this.authService.assertState(linkToken);
    const redirectUrl = this.authService.buildRiotAuthorizeUrl(verifiedLinkToken);
    res.redirect(302, redirectUrl);
  }

  @Get('riot/callback')
  async riotCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const result = await this.authService.handleRiotCallback(
      this.authService.assertAuthorizationCode(code),
      this.authService.assertState(state),
    );

    res.status(200).json({
      linked: true,
      discordSnowflake: result.user.discord_snowflake,
      riot: result.riotProfile,
    });
  }
}
