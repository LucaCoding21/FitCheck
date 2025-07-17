# Expo Go Tunnel Setup Guide

## 🚀 Quick Start

### 1. Start the Tunnel

```bash
npm run start:tunnel
```

Or manually:

```bash
expo start --tunnel
```

### 2. Scan the QR Code

- Open Expo Go app on your phone
- Scan the QR code that appears in the terminal
- The app will load over the internet (tunnel)

## 📱 Benefits of Tunnel

✅ **Access from anywhere** - Works on any network  
✅ **No network restrictions** - Bypasses firewall issues  
✅ **Easy sharing** - Share QR code with others  
✅ **Consistent experience** - Same URL works everywhere

## 🔧 Configuration

### App.json Updates

- Added `extra.eas.projectId` for future EAS builds
- Added `owner` field for Expo account integration

### Package.json Scripts

- Added `start:tunnel` script for easy tunnel access

## 🌐 How It Works

1. **Expo creates a secure tunnel** to your local development server
2. **QR code contains the tunnel URL** instead of local IP
3. **Expo Go connects** through the tunnel to your app
4. **Real-time updates** work over the internet

## 🛠️ Troubleshooting

### If tunnel doesn't work:

1. Make sure you have the latest Expo CLI:

   ```bash
   npm install -g @expo/cli
   ```

2. Try clearing Expo cache:

   ```bash
   expo start --clear
   ```

3. Check your internet connection

### If QR code doesn't scan:

1. Make sure Expo Go app is updated
2. Try typing the URL manually in Expo Go
3. Check if your phone has internet access

## 📋 Commands Reference

```bash
# Start with tunnel
npm run start:tunnel

# Start with tunnel and clear cache
expo start --tunnel --clear

# Start tunnel with specific port
expo start --tunnel --port 8081

# Start tunnel and open in browser
expo start --tunnel --web
```

## 🔒 Security Note

The tunnel creates a public URL that anyone can access. For development, this is usually fine, but be aware that your app will be accessible to anyone with the URL while the tunnel is active.
