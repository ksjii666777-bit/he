# Domain & SSL Setup Guide

## Overview

| Item | Value |
|------|-------|
| Primary Domain | `he.app` |
| API Subdomain | `api.he.app` |
| SSL Provider | Let's Encrypt (via Railway) |
| Custom Domain | Configured via Railway Dashboard |

---

## 1. DNS Configuration

### Step 1: Purchase Domain
Recommended registrars: Namecheap, Cloudflare, Google Domains.

### Step 2: Set Nameservers (Cloudflare)
If using Cloudflare:
1. Add site to Cloudflare
2. Replace registrar nameservers with Cloudflare's
3. Wait up to 48h for propagation

### Step 3: Create DNS Records

| Type | Name | Value | Proxy | TTL |
|------|------|-------|-------|-----|
| CNAME | `api` | `he-production.up.railway.app` | Proxied (orange cloud) | Auto |
| CNAME | `www` | `he-production.up.railway.app` | Proxied | Auto |
| CNAME | `@` | `he-production.up.railway.app` | Proxied | Auto |
| TXT | `_dmarc` | `v=DMARC1; p=quarantine; rua=mailto:dmarc@he.app` | - | Auto |
| TXT | `@` | `v=spf1 include:_spf.google.com ~all` | - | Auto |

> **CAA Record** (optional — restricts which CA can issue certs):
> `@` CAA `0 issue "letsencrypt.org"`

---

## 2. Configure Custom Domain on Railway

1. Open [Railway Dashboard](https://railway.app/dashboard)
2. Select `he-production` project
3. Navigate to **Settings → Domains**
4. Click **"Custom Domain"**
5. Enter `api.he.app`
6. Railway automatically provisions a Let's Encrypt SSL certificate
7. Wait for status to show **"SSL Active"** (30s–2min)

---

## 3. SSL Certificate Management

### Automatic (Recommended)
Railway handles Let's Encrypt auto-renewal. No manual steps required.

### Manual Certbot (self-hosted)
```bash
# Install certbot
sudo apt install certbot

# Issue certificate
sudo certbot certonly --standalone -d api.he.app -d he.app

# Verify auto-renewal
sudo certbot renew --dry-run
```

### Certificate Paths (if self-hosted)
```
Certificate: /etc/letsencrypt/live/he.app/fullchain.pem
Private Key: /etc/letsencrypt/live/he.app/privkey.pem
```

---

## 4. Enforce HTTPS

Railway terminates SSL at the edge. The backend receives forwarded `X-Forwarded-Proto: https`.

NestJS is configured to trust `X-Forwarded-Proto` via the `trust proxy` setting in `main.ts`:
```typescript
app.set('trust proxy', 1);
```

To redirect HTTP → HTTPS at the application level (defense-in-depth):
```typescript
app.use((req, res, next) => {
  if (req.headers['x-forwarded-proto'] !== 'https' && process.env.NODE_ENV === 'production') {
    return res.redirect(301, `https://${req.headers.host}${req.url}`);
  }
  next();
});
```

---

## 5. SSL Testing

```bash
# Verify certificate chain
openssl s_client -connect api.he.app:443 -servername api.he.app < /dev/null

# Test with curl
curl -vI https://api.he.app/health

# Check expiry
echo | openssl s_client -connect api.he.app:443 2>/dev/null | openssl x509 -noout -dates

# SSLLabs test
curl https://www.ssllabs.com/ssltest/analyze.html?d=api.he.app
```

---

## 6. Security Headers

Configure your reverse proxy / Railway edge to send:

```
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: microphone=(self), camera=(self)
```

Railway does not support custom response headers directly. Apply them in the NestJS app:

```bash
npm install helmet
```

```typescript
import helmet from 'helmet';
app.use(helmet());
```

---

## 7. Troubleshooting

| Issue | Likely Cause | Fix |
|-------|-------------|-----|
| `ERR_SSL_PROTOCOL_ERROR` | SSL not provisioned | Wait 5 min, check Railway domain status |
| DNS not resolving | Propagation delay | Wait up to 48h, use `dig api.he.app` to check |
| Certificate not renewing | DNS not pointing to Railway | Verify CNAME record |
| Mixed content warnings | Frontend loading HTTP resources | Use `https://` in all URLs |
| `X-Forwarded-Proto` missing | Railway edge config | Enable "SSL Termination" in Railway settings |

---

## 8. Certificate Renewal Monitoring

Set up a monthly check via GitHub Actions (runs on the 1st of every month):

```yaml
name: SSL Check
on:
  schedule:
    - cron: '0 0 1 * *'
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - run: |
          EXPIRY=$(echo | openssl s_client -connect api.he.app:443 2>/dev/null | openssl x509 -noout -enddate)
          DAYS_LEFT=$(echo $EXPIRY | sed 's/notAfter=//' | xargs -I {} date -d {} +%s | xargs -I {} echo $((({} - $(date +%s)) / 86400)))
          if [ "$DAYS_LEFT" -lt 14 ]; then
            curl -X POST -H "Content-Type: application/json" \
              -d "{\"text\":\"⚠️ SSL cert for api.he.app expires in $DAYS_LEFT days\"}" \
              ${{ secrets.SLACK_WEBHOOK_URL }}
          fi
```

---

## Appendix: Cloudflare Full Setup (Recommended)

If using Cloudflare proxy (orange cloud):

1. **SSL/TLS → Overview**: Set to **Full (strict)**
2. **SSL/TLS → Edge Certificates**: Enable "Always Use HTTPS"
3. **SSL/TLS → Edge Certificates**: Enable "Automatic HTTPS Rewrites"
4. **Speed → Optimization**: Enable "Brotli", "Auto Minify (JS, CSS, HTML)"
5. **Firewall → WAF**: Create rule to block traffic outside US/GB/CA/IE/AU/FR/ES/DE/IT
6. **Caching**: Bypass cache for `/api/*` or `api.he.app/*` paths

Cloudflare provides DDoS protection, WAF, CDN caching, and bot management on the free tier.
