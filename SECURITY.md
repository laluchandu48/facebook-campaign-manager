# Security Features

## Implemented Security Measures

### Backend Security

1. **Helmet.js** - Sets secure HTTP headers
   - XSS Protection
   - Content Security Policy
   - HSTS (HTTP Strict Transport Security)
   - Frame protection

2. **Rate Limiting** - Prevents abuse
   - 100 requests per 15 minutes per IP
   - Protects against DDoS attacks

3. **CORS** - Controlled cross-origin requests
   - Only allows requests from frontend URL
   - Credentials support enabled

4. **Input Validation** - Prevents injection attacks
   - JSON payload size limited to 10MB
   - Express validator ready for implementation

5. **Environment Variables** - Sensitive data protection
   - API keys stored in .env file
   - Never committed to version control

### Frontend Security

1. **No Sensitive Data Storage** - Access tokens handled securely
2. **HTTPS Ready** - Production deployment should use SSL/TLS

## Additional Recommendations for Production

1. **Authentication System**
   - Implement JWT-based authentication
   - Add user login/registration
   - Role-based access control (Admin, Client, Viewer)

2. **Database**
   - Store user credentials securely (bcrypt)
   - Log all campaign activities
   - Audit trail for compliance

3. **API Security**
   - Implement API key rotation
   - Use OAuth 2.0 for Facebook authentication
   - Encrypt access tokens at rest

4. **Monitoring**
   - Log all API requests
   - Set up error tracking (Sentry)
   - Monitor for suspicious activity

5. **Deployment**
   - Use HTTPS only
   - Enable firewall rules
   - Regular security updates
   - Backup strategy

## Client Access Control

For sharing with clients:

1. Create separate user accounts per client
2. Limit access to only their ad accounts
3. Set up read-only access for reporting
4. Implement session timeouts
5. Two-factor authentication (2FA)

## Environment Variables

Required for production:

```
PORT=5000
JWT_SECRET=<strong-random-string>
SESSION_SECRET=<strong-random-string>
NODE_ENV=production
FRONTEND_URL=https://your-domain.com
DATABASE_URL=<your-database-url>
```
