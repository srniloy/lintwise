import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getInfo() {
    return {
      name: 'LintWise API',
      version: '1.0.0',
      description: 'AI-Powered Code Review Tool',
      docs: '/api/docs',
    };
  }
}
