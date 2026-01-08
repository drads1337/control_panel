# Error Analysis: Browser Console Errors

## Summary

This document explains the errors you're seeing in your browser console and how to fix them.

## Errors Identified

### 1. Font File 404 Error
```
GET https://ovrin.xyz/assets/css/~@fontsource-variable/figtree/files/figtree-latin-wght-normal.woff2 
net::ERR_ABORTED 404 (Not Found)
```

**Root Cause:**
- The CSS file was using `~@fontsource-variable/figtree/files/...` syntax
- The `~` prefix is a **webpack convention** that doesn't work in Vite
- Vite doesn't resolve the `~` alias in CSS `url()` functions during build
- The path wasn't being properly resolved, leaving the alias in the built CSS

**Fix Applied:**
- Changed from manual `@font-face` declarations with `~` aliases
- To importing the font CSS directly: `@import "@fontsource-variable/figtree/index.css"`
- Vite will now properly process and copy the font files during build

**Next Steps:**
1. Rebuild the frontend: `cd frontend && npm run build`
2. Restart the nginx container to serve the new build

---

### 2. 503 Service Unavailable Errors
```
POST https://ovrin.xyz/api/auth/login 503 (Service Unavailable)
GET https://ovrin.xyz/api/auth/csrf-token 503 (Service Unavailable)
```

**Root Cause:**
- Nginx is trying to proxy requests to the backend API (`api:5001`)
- The backend is either:
  - Not running
  - Taking too long to respond (timeout)
  - Crashing/restarting
  - Not ready yet (still starting up)

**Nginx Configuration:**
- `proxy_connect_timeout` was set to only **5 seconds** (very short)
- If the backend takes longer than 5 seconds to accept a connection, nginx returns 503
- The upstream has `max_fails=3 fail_timeout=30s`, meaning if the backend fails 3 times, it's marked as down for 30 seconds

**Fix Applied:**
- Increased `proxy_connect_timeout` from `5s` to `30s` in nginx.conf
- This gives the backend more time to respond, especially during startup

**Diagnosis Steps:**
1. Check if the backend container is running:
   ```bash
   docker ps | grep panel_api
   ```

2. Check backend logs:
   ```bash
   docker logs panel_api --tail 100
   ```

3. Check if the backend is responding:
   ```bash
   docker exec panel_api curl http://localhost:5001/health
   ```

4. Check nginx error logs:
   ```bash
   docker logs panel_nginx --tail 50
   ```

**Common Causes:**
- Backend container crashed (check logs)
- Database connection issues (check postgres container)
- Backend still starting up (wait a few minutes)
- Port conflicts (check if port 5001 is available)
- Memory/resource constraints

---

### 3. 401 Unauthorized Errors
```
GET https://ovrin.xyz/api/users/me 401 (Unauthorized)
POST https://ovrin.xyz/api/auth/login 401 (Unauthorized)
```

**Root Cause:**
- **401 errors are EXPECTED behavior** for:
  - Unauthenticated requests to protected endpoints (`/api/users/me`)
  - Invalid login credentials (`/api/auth/login`)
- However, if you're seeing 401s after successful login, it could indicate:
  - JWT token not being set in cookies
  - CORS issues preventing cookies from being sent
  - Token expiration
  - Backend authentication middleware issues

**When 401 is Normal:**
- User not logged in accessing protected routes
- Invalid username/password during login
- Expired session token

**When 401 is a Problem:**
- After successful login, user still gets 401
- Token is set but backend rejects it
- CORS preventing cookie transmission

**Diagnosis:**
1. Check browser DevTools → Application → Cookies
   - Look for `access_token_cookie` after login
   - Verify it's being sent with requests (Network tab → Headers)

2. Check CORS configuration:
   - Backend `CORS_ORIGINS` should include your domain
   - Cookies need `SameSite=None; Secure` for cross-origin (if needed)

3. Check backend authentication logs:
   ```bash
   docker logs panel_api | grep -i "auth\|jwt\|401"
   ```

---

## Quick Fix Checklist

1. **Fix Font 404:**
   - ✅ Font import fixed in `frontend/src/index.css`
   - ⏳ Rebuild frontend: `cd frontend && npm run build`
   - ⏳ Restart nginx: `docker restart panel_nginx`

2. **Fix 503 Errors:**
   - ✅ Increased nginx proxy timeout to 30s
   - ⏳ Reload nginx: `docker exec panel_nginx nginx -s reload`
   - ⏳ Check backend status: `docker ps | grep panel_api`
   - ⏳ Check backend logs: `docker logs panel_api --tail 100`

3. **Investigate 401 Errors:**
   - Check if you're logged in (cookies in DevTools)
   - Verify credentials are correct
   - Check backend auth logs

---

## Commands to Run

```bash
# 1. Rebuild frontend with fixed font imports
cd frontend
npm run build

# 2. Reload nginx configuration (or restart container)
docker exec panel_nginx nginx -s reload
# OR
docker restart panel_nginx

# 3. Check backend status
docker ps | grep panel_api
docker logs panel_api --tail 100

# 4. Test backend health
docker exec panel_api curl http://localhost:5001/health

# 5. Check nginx error logs
docker logs panel_nginx --tail 50
```

---

## Additional Notes

### Font Import Alternative
If the CSS import doesn't work, you can also import fonts in JavaScript:

```typescript
// In main.tsx or a font setup file
import '@fontsource-variable/figtree/index.css'
```

### Backend Health Check
The backend should respond to `/health` endpoint. If it doesn't:
- Check database connection
- Check Redis connection
- Check for startup errors in logs
- Verify environment variables are set correctly

### Nginx Upstream Health
Nginx marks the upstream as "down" after 3 consecutive failures. Once marked down:
- All requests return 503 for 30 seconds (`fail_timeout=30s`)
- After 30 seconds, nginx tries again
- If it succeeds, the upstream is marked healthy again

---

## Expected Behavior After Fixes

1. **Font 404:** Should be resolved after rebuilding frontend
2. **503 Errors:** Should be reduced with increased timeout, but if backend is down, you'll still see 503s
3. **401 Errors:** Normal for unauthenticated requests; should not appear after successful login
