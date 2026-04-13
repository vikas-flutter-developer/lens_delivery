import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

class ApiService {
  // Use 10.0.2.2 for Android Emulator, localhost for iOS Simulator, or your machine's IP for physical devices.
   static const String baseUrl = 'https://be-lens.onrender.com/api';
  // static const String baseUrl = 'http://10.0.2.2:5000/api';

  static Future<String?> getToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString('token');
  }

  static Future<String?> getUserId() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString('userId');
  }

  static Future<Map<String, dynamic>> login(String role, String email, String password) async {
    final response = await http.post(
      Uri.parse('$baseUrl/auth/login'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'role': role, 'email': email, 'password': password}),
    );

    final data = jsonDecode(response.body);
    if (response.statusCode >= 200 && response.statusCode < 300) {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('token', data['token']);
      await prefs.setString('userId', data['user']['id']);
      await prefs.setString('userName', data['user']['name']);
      await prefs.setString('role', data['user']['role'] ?? role);
      return {'success': true, 'data': data};
    } else {
      return {'success': false, 'message': data['message'] ?? (data['errors']?[0]?['msg'] ?? 'Login failed')};
    }
  }

  static Future<void> logout() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('token');
    await prefs.remove('userId');
    await prefs.remove('userName');
    await prefs.remove('role');
  }

  static Future<Map<String, dynamic>> startDelivery(String qrData, {bool forceRegenerate = false}) async {
    final token = await getToken();
    final userId = await getUserId();
    
    final response = await http.post(
      Uri.parse('$baseUrl/delivery/start'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
      },
      body: jsonEncode({
        'qrData': qrData,
        'deliveryPersonId': userId,
        'forceRegenerate': forceRegenerate,
      }),
    );

    final data = jsonDecode(response.body);
    if (response.statusCode == 200 && data['success'] == true) {
      return {'success': true, 'data': data};
    } else {
      return {'success': false, 'message': data['message'] ?? 'Failed to start delivery'};
    }
  }

  static Future<Map<String, dynamic>> recordArrival(String orderId) async {
    final token = await getToken();
    
    final response = await http.post(
      Uri.parse('$baseUrl/delivery/arrive'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
      },
      body: jsonEncode({
        'orderId': orderId,
      }),
    );
    
    final data = jsonDecode(response.body);
    if (response.statusCode == 200 && data['success'] == true) {
      return {'success': true, 'data': data};
    } else {
      return {'success': false, 'message': data['message'] ?? 'Failed to record arrival'};
    }
  }

  static Future<Map<String, dynamic>> completeDelivery(String orderId, String? otp) async {
    final token = await getToken();
    final userId = await getUserId();
    
    final bodyData = {
      'orderId': orderId,
      'deliveryPersonId': userId,
    };
    if (otp != null && otp.isNotEmpty) {
      bodyData['otp'] = otp;
    }

    final response = await http.post(
      Uri.parse('$baseUrl/delivery/complete'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
      },
      body: jsonEncode(bodyData),
    );

    final data = jsonDecode(response.body);
    if (response.statusCode == 200 && data['success'] == true) {
      return {'success': true, 'data': data};
    } else {
      return {'success': false, 'message': data['message'] ?? 'Failed to complete delivery'};
    }
  }

  static Future<Map<String, dynamic>> getDeliveryStats() async {
    final token = await getToken();
    
    final response = await http.get(
      Uri.parse('$baseUrl/delivery/stats'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
      },
    );

    final data = jsonDecode(response.body);
    if (response.statusCode == 200 && data['success'] == true) {
      return {'success': true, 'data': data['data']};
    } else {
      return {'success': false, 'message': data['message'] ?? 'Failed to fetch stats'};
    }
  }

  static Future<Map<String, dynamic>> getAssignedOrders() async {
    final token = await getToken();
    
    final response = await http.get(
      Uri.parse('$baseUrl/delivery/assigned'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
      },
    );

    final data = jsonDecode(response.body);
    if (response.statusCode == 200 && data['success'] == true) {
      return {'success': true, 'data': data['data']};
    } else {
      return {'success': false, 'message': data['message'] ?? 'Failed to fetch assigned orders'};
    }
  }

  static Future<Map<String, dynamic>> getAllAccounts() async {
    final token = await getToken();
    
    final response = await http.get(
      Uri.parse('$baseUrl/accounts/getallaccounts'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
      },
    );

    final data = jsonDecode(response.body);
    if (response.statusCode >= 200 && response.statusCode < 300) {
      // Backend returns an array directly
      if (data is List) {
        return {'success': true, 'data': data};
      }
      return {'success': true, 'data': data['data'] ?? data};
    } else {
      return {'success': false, 'message': data['message'] ?? 'Failed to fetch accounts'};
    }
  }

  static Future<Map<String, dynamic>> getWhitelistedCustomers() async {
    final token = await getToken();
    
    final response = await http.get(
      Uri.parse('$baseUrl/customers/whitelist'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
      },
    );

    final data = jsonDecode(response.body);
    if (response.statusCode >= 200 && response.statusCode < 300) {
      return {'success': true, 'data': data['data'] ?? data};
    } else {
      return {'success': false, 'message': data['message'] ?? 'Failed to fetch whitelist'};
    }
  }

  static Future<Map<String, dynamic>> addToWhitelist(String customerId) async {
    final token = await getToken();
    
    final response = await http.post(
      Uri.parse('$baseUrl/customers/whitelist'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
      },
      body: jsonEncode({'customerId': customerId}),
    );

    final data = jsonDecode(response.body);
    if (response.statusCode >= 200 && response.statusCode < 300) {
      return {'success': true, 'data': data};
    } else {
      return {'success': false, 'message': data['message'] ?? 'Failed to add to whitelist'};
    }
  }

  static Future<Map<String, dynamic>> removeFromWhitelist(String customerId) async {
    final token = await getToken();
    
    final response = await http.delete(
      Uri.parse('$baseUrl/customers/whitelist/$customerId'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
      },
    );

    final data = jsonDecode(response.body);
    if (response.statusCode >= 200 && response.statusCode < 300) {
      return {'success': true, 'data': data};
    } else {
      return {'success': false, 'message': data['message'] ?? 'Failed to remove from whitelist'};
    }
  }
}
