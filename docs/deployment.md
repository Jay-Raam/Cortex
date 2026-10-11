# Nexa AI Deployment & Run Guide

## 1. Web Application Deployment (Vercel)

The web frontend can be deployed directly to Vercel:

1. Link repository to Vercel.
2. Set Build Command: `npm run build`
3. Set Output Directory: `dist`
4. Configure Environment Variables:
   - `GEMINI_API_KEY`: API Key for Google Gemini
   - `OPENROUTER_API_KEY`: (Optional) OpenRouter key
   - `APP_URL`: Production domain URL

## 2. API & Co-Work Backend Deployment (Node.js / Cloud Run / VPS)

1. Provision a Node.js 20+ runtime container.
2. Run standard initialization:
   ```bash
   npm install
   npm run build
   npm run start
   ```
3. Expose port 3000 with HTTPS reverse proxy (Nginx or Caddy) configured for SSE streaming:
   ```nginx
   location /api/chat/stream {
       proxy_pass http://localhost:3000;
       proxy_set_header Connection '';
       proxy_http_version 1.1;
       chunked_transfer_encoding off;
       proxy_buffering off;
       proxy_cache off;
   }
   ```

## 3. Flutter Android Build & Installation

The Flutter Android client lives in `apps/mobile`:

### Debug Run:
```bash
cd apps/mobile
flutter pub get
flutter run
```

### Release APK Generation (Direct Install without Google Play Store):
```bash
cd apps/mobile
flutter build apk --release --split-per-abi
```
Generated APKs will be located at:
- `apps/mobile/build/app/outputs/flutter-apk/app-armeabi-v7a-release.apk`
- `apps/mobile/build/app/outputs/flutter-apk/app-arm64-v8a-release.apk`
- `apps/mobile/build/app/outputs/flutter-apk/app-x86_64-release.apk`

Transfer the APK to any Android device and tap to install directly.
