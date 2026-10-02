const bizSdk = require('facebook-nodejs-business-sdk');

const { FacebookAdsApi, AdAccount } = bizSdk;

/**
 * Build a Graph API client for one request.
 * FacebookAdsApi.init() sets a single *global* default, which means two users
 * hitting the server at the same time could end up using each other's tokens.
 * Creating an instance per request and passing it to every object avoids that.
 */
function apiFor(accessToken) {
  return new FacebookAdsApi(accessToken);
}

/** Construct an SDK object (Campaign, AdSet, ...) bound to a specific api client. */
function obj(Klass, id, api) {
  return new Klass(id, {}, undefined, api);
}

/** SDK objects -> plain JSON. */
function toPlain(item) {
  if (!item) return item;
  if (typeof item.exportAllData === 'function') return item.exportAllData();
  if (item._data) return item._data;
  return item;
}

/** Read every page of an SDK cursor (capped so a huge account can't hang the server). */
async function fetchAll(cursor, maxItems = 5000) {
  const results = cursor.map(toPlain);
  while (cursor.hasNext() && results.length < maxItems) {
    await cursor.next();
    results.push(...cursor.map(toPlain));
  }
  return results;
}

/**
 * Turn an SDK/Graph error into a message that is useful to show to the user.
 * Never log the raw error object: it contains the request URL, which includes
 * the access token.
 */
function fbErrorMessage(error) {
  const body = error && error.response;
  const fbErr = (body && body.error) || body || {};
  return (
    fbErr.error_user_msg ||
    fbErr.error_user_title ||
    fbErr.message ||
    (error && error.message) ||
    'Unknown error'
  );
}

function sendError(res, error, status = 500) {
  const message = fbErrorMessage(error);
  console.error(`[api error] ${message}`);
  res.status(error && error.status && error.status < 500 ? error.status : status).json({ error: message });
}

/*
 * Money handling.
 * Meta's Marketing API takes budgets and bids in the currency's minor unit
 * ("offset"). For most currencies (USD, INR, EUR...) that is 1/100, so 500.00
 * INR must be sent as 50000. A few currencies have no minor unit and use an
 * offset of 1. See Meta's "Currencies" reference for the full list.
 */
const OFFSET_ONE_CURRENCIES = new Set([
  'CLP', 'COP', 'CRC', 'HUF', 'ISK', 'IDR', 'JPY', 'KRW', 'PYG', 'TWD', 'VND',
]);

function currencyOffset(currency) {
  return OFFSET_ONE_CURRENCIES.has(String(currency || '').toUpperCase()) ? 1 : 100;
}

/** "500.50" (major units, as typed by a user) -> 50050 (what the API wants). */
function toMinorUnits(amount, currency) {
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) {
    throw Object.assign(new Error('Amount must be a positive number'), { status: 400 });
  }
  return Math.round(value * currencyOffset(currency));
}

/** 50050 (from the API) -> 500.5 */
function fromMinorUnits(amount, currency) {
  if (amount === undefined || amount === null || amount === '') return null;
  const value = Number(amount);
  return Number.isFinite(value) ? value / currencyOffset(currency) : null;
}

async function getAccountCurrency(api, adAccountId) {
  const account = await obj(AdAccount, normalizeAdAccountId(adAccountId), api).read(['currency']);
  return account.currency || toPlain(account).currency;
}

function normalizeAdAccountId(id) {
  const value = String(id || '').trim();
  if (!value) throw Object.assign(new Error('adAccountId is required'), { status: 400 });
  return value.startsWith('act_') ? value : `act_${value}`;
}

module.exports = {
  bizSdk,
  apiFor,
  obj,
  toPlain,
  fetchAll,
  fbErrorMessage,
  sendError,
  currencyOffset,
  toMinorUnits,
  fromMinorUnits,
  getAccountCurrency,
  normalizeAdAccountId,
};
