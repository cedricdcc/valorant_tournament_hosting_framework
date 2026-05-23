import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { LegalService } from './legal.service.js';

@Controller('legal')
export class LegalController {
  constructor(private readonly legalService: LegalService) {}

  @Get('terms')
  termsOfService(@Res() res: Response): void {
    res
      .status(200)
      .type('text/html')
      .send(this.legalService.getTermsOfServiceHtml());
  }

  @Get('privacy')
  privacyPolicy(@Res() res: Response): void {
    res
      .status(200)
      .type('text/html')
      .send(this.legalService.getPrivacyPolicyHtml());
  }
}
