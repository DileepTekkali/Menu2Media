const validateUrl = (url) => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

const validateUuid = (uuid) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

const validateCampaignType = (type) => {
  return ['daily', 'weekend', 'festive', 'combo'].includes(type);
};

const validatePlatform = (platform) => {
  return ['instagram', 'facebook', 'whatsapp'].includes(platform);
};

const validateFormat = (format) => {
  return ['instagram_square', 'instagram_story', 'facebook_post'].includes(format);
};

const sanitizeString = (str) => {
  if (!str) return '';
  return str.replace(/[<>]/g, '').trim();
};

module.exports = {
  validateUrl,
  validateUuid,
  validateCampaignType,
  validatePlatform,
  validateFormat,
  sanitizeString
};
