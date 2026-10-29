import { BadResponse } from '../../shared/http/responses.js';
import { validateHMAC } from '../../shared/security/hmac.js';

export const verifyHmac = async (req, res, next) => {
  const status = await validateHMAC(req.body);
  if (!status) return new BadResponse('Token error').send(res, 400);
  next();
};
