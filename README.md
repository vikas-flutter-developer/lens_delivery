# Lens Delivery Mobile Application 📦✈️

A professional, feature-rich Flutter application designed for delivery agents/drivers to manage, track, and complete lens shipments efficiently. This mobile client integrates seamlessly with the backend to handle real-time deliveries, barcode scanning, proof of delivery, and geolocator services.

---

## 🚀 Key Features

- **🔐 Secure Authentication**: Agent sign-in with persistent token management using secure shared preferences.
- **📋 Delivery Feed & Management**: Real-time list of active, pending, and completed delivery tasks with smart status filtering.
- **🔍 Mobile Scanner Integration**: Quick scanning of QR codes and package barcodes using `mobile_scanner` to fetch order details instantly.
- **📍 GPS Tracking & Directions**: Dynamic location tracking via `geolocator` and single-tap directions using `url_launcher` to navigate directly to the customer's location.
- **📸 Delivery Proof Upload**: Take photos using the camera (`image_picker`) to capture signatures or physical packages as validation for successful deliveries.
- **🎨 Premium UI Design**: Elegant layout matching the brand design with Outfit typography, clean transitions, and modern card-based elements.

---

## 🛠️ Technology Stack

- **Framework:** [Flutter](https://flutter.dev/) (SDK ^3.11.4)
- **State & Storage:** `shared_preferences`
- **Scanning:** `mobile_scanner`
- **Utilities:** `geolocator`, `image_picker`, `url_launcher`, `http`
- **Typography:** `google_fonts` (Outfit theme)

---

## 📁 Directory Structure

```
lib/
├── api/
│   └── api_service.dart          # Core network services & authorization interceptors
├── screens/
│   ├── login_screen.dart         # Login page for authentication
│   ├── home_screen.dart          # Main dashboard with delivery tabs
│   ├── delivery_detail_screen.dart # Detailed shipment info, camera, & upload actions
│   └── scanner_screen.dart       # Live camera barcode/QR code reader
└── main.dart                     # Application bootstrap and routing gate
```

---

## 🏁 Getting Started

### 📋 Prerequisites
Make sure you have Flutter installed and configured on your system. Run:
```bash
flutter doctor
```

### ⚙️ Installation

1. Navigate to the project directory:
   ```bash
   cd lens_delivery
   ```

2. Fetch the required dependencies:
   ```bash
   flutter pub get
   ```

3. Run the project in development mode:
   ```bash
   flutter run
   ```

### 📱 Build Instructions

#### Build Android APK:
```bash
flutter build apk --release
```

#### Build iOS App Bundle (Requires macOS):
```bash
flutter build ipa
```
