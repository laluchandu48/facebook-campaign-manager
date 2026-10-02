import axios from 'axios';

// Backend URL comes from frontend/.env (REACT_APP_API_URL), defaulting to local dev.
export const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

// withCredentials sends the session cookie. The Facebook token stays on the server;
// the browser never stores it or puts it in a URL.
const api = axios.create({
  baseURL: `${API_URL}/api`,
  withCredentials: true,
});

/** Best available error message: the backend's explanation first, then axios'. */
export function errorMessage(error) {
  return error?.response?.data?.error || error?.message || 'Something went wrong';
}

/** Format an amount in the ad account's currency, e.g. ₹1,250.00 or $19.99. */
export function formatMoney(amount, currency) {
  const value = Number(amount || 0);
  if (!currency) return value.toFixed(2);
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

export default api;
