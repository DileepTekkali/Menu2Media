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
  const normalized = type.replace(/_(offer|special|specials)$/, '').toLowerCase();
  return ['daily', 'new_arrivals', 'new_arrival', 'festive', 'combo'].includes(normalized);
};

const removeWeekendFromValidCampaignTypes = () => {
  return ['daily', 'new_arrivals', 'festive', 'combo'];
};

const validatePlatform = (platform) => {
  return ['instagram', 'facebook', 'whatsapp'].includes(platform);
};

const validateFormat = (format) => {
  const validFormats = ['1:1', '4:5', '16:9', 'square', 'story', 'landscape'];
  const normalized = format.replace(/^(instagram_|facebook_|whatsapp_)/, '');
  return validFormats.includes(normalized);
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
