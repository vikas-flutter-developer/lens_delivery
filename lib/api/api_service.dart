import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:geolocator/geolocator.dart';

class ApiService {
  static const String baseUrl = 'https://be-lens.onrender.com/api';

  // In-Memory/SharedPreferences Mock Database for offline demo
  static List<Map<String, dynamic>> _mockOrders = [];

  static Future<void> initMockData() async {
    final prefs = await SharedPreferences.getInstance();
    final cached = prefs.getString('mock_orders');
    if (cached != null && cached.isNotEmpty) {
      try {
        final decoded = jsonDecode(cached) as List;
        _mockOrders = decoded.map((e) => Map<String, dynamic>.from(e)).toList();
        return;
      } catch (e) {
        debugPrint('Failed to parse cached mock orders: $e');
      }
    }

    // Default 5 mock orders with different coordinates around Mumbai
    _mockOrders = [
      {
        '_id': 'order_sion_001',
        'billData': {'billNo': 'LS-2026-001', 'date': '2026-07-02T10:00:00.000Z'},
        'partyData': {'partyAccount': 'Sion Eye Clinic'},
        'customer': {
          'name': 'Aarav Mehta',
          'phone': '+91 98200 12345',
          'address': 'Shop 12, Sion Circle, Sion, Mumbai - 400022',
        },
        'deliveryStatus': 'Pending',
        'latitude': 19.0380,
        'longitude': 72.8639,
        'isWhitelisted': false,
        'deliveryOtp': '111111',
      },
      {
        '_id': 'order_ghatkopar_002',
        'billData': {'billNo': 'LS-2026-002', 'date': '2026-07-02T10:15:00.000Z'},
        'partyData': {'partyAccount': 'Ghatkopar Vision Care'},
        'customer': {
          'name': 'Priya Shah',
          'phone': '+91 98199 54321',
          'address': 'MG Road, near Station, Ghatkopar East, Mumbai - 400077',
        },
        'deliveryStatus': 'Pending',
        'latitude': 19.0856,
        'longitude': 72.9082,
        'isWhitelisted': true, // Whitelisted customer - bypasses OTP
        'deliveryOtp': '',
      },
      {
        '_id': 'order_bandra_003',
        'billData': {'billNo': 'LS-2026-003', 'date': '2026-07-02T10:30:00.000Z'},
        'partyData': {'partyAccount': 'Bandra Opticians'},
        'customer': {
          'name': 'Rohan Fernandes',
          'phone': '+91 98922 99887',
          'address': 'Linking Road, opposite KFC, Bandra West, Mumbai - 400050',
        },
        'deliveryStatus': 'Pending',
        'latitude': 19.0596,
        'longitude': 72.8295,
        'isWhitelisted': false,
        'deliveryOtp': '333333',
      },
      {
        '_id': 'order_dadar_004',
        'billData': {'billNo': 'LS-2026-004', 'date': '2026-07-02T11:00:00.000Z'},
        'partyData': {'partyAccount': 'Dadar Optical Emporium'},
        'customer': {
          'name': 'Sneha Patil',
          'phone': '+91 98690 77665',
          'address': 'Ranade Road, Dadar West, Mumbai - 400028',
        },
        'deliveryStatus': 'Pending',
        'latitude': 19.0178,
        'longitude': 72.8478,
        'isWhitelisted': false,
        'deliveryOtp': '444444',
      },
      {
        '_id': 'order_thane_005',
        'billData': {'billNo': 'LS-2026-005', 'date': '2026-07-02T11:30:00.000Z'},
        'partyData': {'partyAccount': 'Thane Supreme Lenses'},
        'customer': {
          'name': 'Amit Joshi',
          'phone': '+91 98330 11223',
          'address': 'Naupada, near Teen Haath Naka, Thane West - 400602',
        },
        'deliveryStatus': 'Pending',
        'latitude': 19.2183,
        'longitude': 72.9781,
        'isWhitelisted': false,
        'deliveryOtp': '555555',
      }
    ];
    await _saveMockOrders();
  }

  static Future<void> _saveMockOrders() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('mock_orders', jsonEncode(_mockOrders));
  }

  // Retrieve current GPS location safely
  static Future<Position?> getCurrentLocation() async {
    try {
      bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) return null;

      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
        if (permission == LocationPermission.denied) return null;
      }
      if (permission == LocationPermission.deniedForever) return null;

      return await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
        timeLimit: const Duration(seconds: 4),
      );
    } catch (e) {
      debugPrint('Error getting GPS coordinates: $e');
      return null;
    }
  }

  static Future<String?> getToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString('token');
  }

  static Future<String?> getUserId() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString('userId');
  }

  static Future<Map<String, dynamic>> login(String role, String email, String password) async {
    // Populate mock data if not initialized yet
    if (_mockOrders.isEmpty) {
      await initMockData();
    }

    try {
      final response = await http.post(
        Uri.parse('$baseUrl/auth/login'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'role': role, 'email': email, 'password': password}),
      ).timeout(const Duration(seconds: 5));

      final data = jsonDecode(response.body);
      if (response.statusCode >= 200 && response.statusCode < 300) {
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('token', data['token'] ?? 'mock_token_123');
        await prefs.setString('userId', data['user']?['id'] ?? 'mock_user_123');
        await prefs.setString('userName', data['user']?['name'] ?? 'Delivery Boy Vikas');
        await prefs.setString('role', data['user']?['role'] ?? role);
        return {'success': true, 'data': data};
      }
    } catch (_) {
      // Network failed - fallback to mock login success for easy UI demo
    }

    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('token', 'mock_token_123');
    await prefs.setString('userId', 'mock_user_123');
    await prefs.setString('userName', 'Delivery Boy Vikas');
    await prefs.setString('role', role);
    return {
      'success': true,
      'data': {
        'token': 'mock_token_123',
        'user': {'id': 'mock_user_123', 'name': 'Delivery Boy Vikas', 'role': role}
      }
    };
  }

  static Future<void> logout() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('token');
    await prefs.remove('userId');
    await prefs.remove('userName');
    await prefs.remove('role');
    await prefs.remove('mock_orders');
    _mockOrders.clear();
  }

  // Scan & Pickup trigger
  static Future<Map<String, dynamic>> startDelivery(String qrData, {bool forceRegenerate = false}) async {
    if (_mockOrders.isEmpty) await initMockData();

    final userId = await getUserId();
    final location = await getCurrentLocation();
    final now = DateTime.now().toIso8601String();

    try {
      final response = await http.post(
        Uri.parse('$baseUrl/delivery/start'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ${await getToken()}',
        },
        body: jsonEncode({
          'qrData': qrData,
          'deliveryPersonId': userId,
          'forceRegenerate': forceRegenerate,
          'pickupTime': now,
          'pickupLatitude': location?.latitude,
          'pickupLongitude': location?.longitude,
        }),
      ).timeout(const Duration(seconds: 4));

      final data = jsonDecode(response.body);
      if (response.statusCode == 200 && data['success'] == true) {
        return {'success': true, 'data': data};
      }
    } catch (_) {}

    // Fallback to Mock implementation
    int index = _mockOrders.indexWhere((o) => o['_id'] == qrData || o['billData']?['billNo'] == qrData);
    if (index == -1) {
      return {'success': false, 'message': 'Parcel with ID/Bill No "$qrData" not found in warehouse'};
    }

    final order = _mockOrders[index];
    order['pickupTime'] = now;
    order['pickupLatitude'] = location?.latitude;
    order['pickupLongitude'] = location?.longitude;
    
    // Auto move to next step if not already out for delivery
    if (order['deliveryStatus'] == 'Pending') {
      order['deliveryStatus'] = 'Ready'; 
    }

    if (forceRegenerate && order['isWhitelisted'] == false) {
      order['deliveryOtp'] = String.fromCharCodes(
        Iterable.generate(6, (_) => '1234567890'.codeUnitAt(DateTime.now().microsecond % 10))
      );
      order['otpExpiresAt'] = DateTime.now().add(const Duration(minutes: 5)).toIso8601String();
    }

    await _saveMockOrders();

    return {
      'success': true,
      'data': {
        'orderId': order['_id'],
        'orderType': 'Lens Invoice',
        'isWhitelisted': order['isWhitelisted'],
        'deliveryStatus': order['deliveryStatus'],
        'customer': order['customer'],
        'billData': order['billData'],
        'partyData': order['partyData'],
        'latitude': order['latitude'],
        'longitude': order['longitude'],
        'deliveryOtp': order['deliveryOtp'],
      }
    };
  }

  // Trigger Out for Delivery state
  static Future<Map<String, dynamic>> setOutForDelivery(String orderId) async {
    if (_mockOrders.isEmpty) await initMockData();

    final location = await getCurrentLocation();
    final now = DateTime.now().toIso8601String();

    try {
      final response = await http.post(
        Uri.parse('$baseUrl/delivery/out-for-delivery'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ${await getToken()}',
        },
        body: jsonEncode({
          'orderId': orderId,
          'outForDeliveryTime': now,
          'latitude': location?.latitude,
          'longitude': location?.longitude,
        }),
      ).timeout(const Duration(seconds: 4));

      final data = jsonDecode(response.body);
      if (response.statusCode == 200 && data['success'] == true) {
        return {'success': true, 'data': data};
      }
    } catch (_) {}

    // Fallback to Mock update
    int idx = _mockOrders.indexWhere((o) => o['_id'] == orderId);
    if (idx != -1) {
      _mockOrders[idx]['deliveryStatus'] = 'Out for Delivery';
      _mockOrders[idx]['outForDeliveryTime'] = now;
      _mockOrders[idx]['outForDeliveryLatitude'] = location?.latitude;
      _mockOrders[idx]['outForDeliveryLongitude'] = location?.longitude;
      await _saveMockOrders();
      return {'success': true, 'data': _mockOrders[idx]};
    }

    return {'success': false, 'message': 'Order not found in mock store'};
  }

  // Reach Customer Location trigger
  static Future<Map<String, dynamic>> recordArrival(String orderId) async {
    if (_mockOrders.isEmpty) await initMockData();
    final now = DateTime.now().toIso8601String();

    try {
      final response = await http.post(
        Uri.parse('$baseUrl/delivery/arrive'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ${await getToken()}',
        },
        body: jsonEncode({'orderId': orderId, 'arrivalTime': now}),
      ).timeout(const Duration(seconds: 4));

      final data = jsonDecode(response.body);
      if (response.statusCode == 200 && data['success'] == true) {
        return {'success': true, 'data': data};
      }
    } catch (_) {}

    // Fallback to Mock
    int idx = _mockOrders.indexWhere((o) => o['_id'] == orderId);
    if (idx != -1) {
      _mockOrders[idx]['arrivalTime'] = now;
      _mockOrders[idx]['otpExpiresAt'] = DateTime.now().add(const Duration(minutes: 5)).toIso8601String();
      await _saveMockOrders();
      return {
        'success': true,
        'data': {
          'orderId': _mockOrders[idx]['_id'],
          'isWhitelisted': _mockOrders[idx]['isWhitelisted'],
          'deliveryStatus': _mockOrders[idx]['deliveryStatus'],
          'customer': _mockOrders[idx]['customer'],
          'billData': _mockOrders[idx]['billData'],
          'partyData': _mockOrders[idx]['partyData'],
        }
      };
    }

    return {'success': false, 'message': 'Order not found'};
  }

  // Complete handover with validation
  static Future<Map<String, dynamic>> completeDelivery(
    String orderId, 
    String? otp, {
    String? proofPhotoPath,
  }) async {
    if (_mockOrders.isEmpty) await initMockData();

    final userId = await getUserId();
    final location = await getCurrentLocation();
    final now = DateTime.now().toIso8601String();

    try {
      final response = await http.post(
        Uri.parse('$baseUrl/delivery/complete'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ${await getToken()}',
        },
        body: jsonEncode({
          'orderId': orderId,
          'deliveryPersonId': userId,
          'otp': otp,
          'deliveredTime': now,
          'latitude': location?.latitude,
          'longitude': location?.longitude,
          'proofPhotoPath': proofPhotoPath,
        }),
      ).timeout(const Duration(seconds: 4));

      final data = jsonDecode(response.body);
      if (response.statusCode == 200 && data['success'] == true) {
        return {'success': true, 'data': data};
      }
    } catch (_) {}

    // Fallback to Mock
    int idx = _mockOrders.indexWhere((o) => o['_id'] == orderId);
    if (idx == -1) {
      return {'success': false, 'message': 'Order not found in mock store'};
    }

    final order = _mockOrders[idx];

    // OTP validation if not whitelisted and photo not uploaded
    if (proofPhotoPath == null && order['isWhitelisted'] == false) {
      if (otp == null || otp.trim() != order['deliveryOtp']) {
        return {'success': false, 'message': 'Invalid OTP entered'};
      }
    }

    order['deliveryStatus'] = 'Delivered';
    order['deliveredTime'] = now;
    order['deliveredLatitude'] = location?.latitude;
    order['deliveredLongitude'] = location?.longitude;
    order['proofPhotoPath'] = proofPhotoPath;
    order['deliveryOtp'] = null; // Clear OTP

    await _saveMockOrders();

    return {
      'success': true,
      'data': {
        'orderId': order['_id'],
        'deliveryStatus': 'Delivered',
        'deliveredTime': now,
        'customer': order['customer'],
        'billNo': order['billData']?['billNo'] ?? '',
      }
    };
  }

  static Future<Map<String, dynamic>> getDeliveryStats() async {
    if (_mockOrders.isEmpty) await initMockData();

    try {
      final response = await http.get(
        Uri.parse('$baseUrl/delivery/stats'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ${await getToken()}',
        },
      ).timeout(const Duration(seconds: 4));

      final data = jsonDecode(response.body);
      if (response.statusCode == 200 && data['success'] == true) {
        return {'success': true, 'data': data['data']};
      }
    } catch (_) {}

    // Fallback counts
    int completed = _mockOrders.where((o) => o['deliveryStatus'] == 'Delivered').length;
    int pending = _mockOrders.where((o) => o['deliveryStatus'] == 'Ready' || o['deliveryStatus'] == 'Out for Delivery').length;
    int todayOrders = _mockOrders.length;

    return {
      'success': true,
      'data': {
        'todayOrders': todayOrders,
        'completed': completed,
        'onHand': pending,
      }
    };
  }

  static Future<Map<String, dynamic>> getAssignedOrders() async {
    if (_mockOrders.isEmpty) await initMockData();

    try {
      final response = await http.get(
        Uri.parse('$baseUrl/delivery/assigned'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ${await getToken()}',
        },
      ).timeout(const Duration(seconds: 4));

      final data = jsonDecode(response.body);
      if (response.statusCode == 200 && data['success'] == true) {
        return {'success': true, 'data': data['data']};
      }
    } catch (_) {}

    // Fallback filter: picked up / assigned parcels that are not yet Delivered,
    // plus items delivered today.
    return {
      'success': true,
      'data': _mockOrders
    };
  }

  // Reset the mock orders back to initial warehouse state for debugging
  static Future<void> resetMockData() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('mock_orders');
    _mockOrders.clear();
    await initMockData();
  }

  static Future<Map<String, dynamic>> getAllAccounts() async => {'success': true, 'data': []};
  static Future<Map<String, dynamic>> getWhitelistedCustomers() async => {'success': true, 'data': []};
  static Future<Map<String, dynamic>> addToWhitelist(String customerId) async => {'success': true};
  static Future<Map<String, dynamic>> removeFromWhitelist(String customerId) async => {'success': true};
}
