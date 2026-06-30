<div align="center">
  <h1>🧾 Bill Kato</h1>
  <p><strong>A blazing fast, offline-first invoice & inventory management app for modern shopkeepers! 🚀</strong></p>
</div>

---

Welcome to **Bill Kato**! Built with React Native (Expo) and SQLite, this mobile application is designed to make life easier for small business owners. Generate professional estimates, track your stock in real-time, and get paid faster with integrated UPI QR codes directly on your bills! 💸

## ✨ Key Features

- **📑 Smart Invoicing**: Generate professional PDF bills for sales and purchases, and share them instantly via WhatsApp or Email.
- **📦 Live Inventory Tracking**: Stock updates magically! Sales automatically deduct from your inventory, while purchases add to it. 
- **☁️ Google Drive Backup**: Never lose your data. Securely backup your local SQLite database directly to your personal Google Drive.
- **🏦 Seamless UPI Payments**: Add your bank details and UPI ID to automatically embed a scannable payment QR code on your generated invoices.
- **🎨 Custom Shop Branding**: Make it yours! Upload your custom shop logo, address, and GSTIN for a premium, branded invoice experience.
- **⚡ Offline-First Architecture**: Built on `expo-sqlite`, everything is stored locally on your device. It’s incredibly fast and works flawlessly without an internet connection! 

## 🛠️ Tech Stack

- **React Native & Expo** (Using modern Expo Router architecture)
- **Zustand** (For lightning-fast state management)
- **Expo SQLite** (For reliable local database storage)
- **Expo Print & Sharing** (For generating and exporting beautiful PDFs)
- **Expo Auth Session** (For secure Google OAuth login and Drive API integration)

## 🚀 Getting Started

### Prerequisites
- Node.js (v18 or above recommended)
- React Native environment (Expo Go, Android Studio, or Xcode)
- EAS CLI (if you plan on building a standalone APK/IPA)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/rajatsaini26/Bill-Kato.git
   cd bill-kato
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Create a `.env` file in the root directory and add your Expo Google Client ID (required for OAuth & Drive backup):
   ```env
   EXPO_PUBLIC_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
   ```

4. **Start the development server:**
   ```bash
   npx expo start
   ```

### 📱 Building for Production

Want to create a standalone APK for Android? Use Expo EAS:

```bash
eas build --platform android --profile development
```
*(Pro tip: Adjust the profile to `preview` or `production` in `eas.json` when you're ready to launch!)*

## 💡 How to Use

1. **🔐 Login**: Launch the app and sign in securely with your Google account.
2. **⚙️ Setup**: Head to the Settings tab to configure your Shop Profile (add your Logo, UPI, and Bank details).
3. **🧾 Invoicing**: Tap the floating `+` button on the dashboard to instantly create a New Sale or New Purchase.
4. **📊 Stock Management**: Keep an eye on your live stock in the **Inventory** tab. It auto-updates as you create invoices!

## 📜 License

This project is proud to be open-source and is licensed under the **MIT License**. See the [LICENSE](LICENSE) file for more details. 

