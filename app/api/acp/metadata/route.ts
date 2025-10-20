// ACP Service Metadata Endpoint

import { SWAPWRIGHT_SERVICE } from '@/lib/acp-service';

export async function GET() {
  return Response.json(SWAPWRIGHT_SERVICE);
}
