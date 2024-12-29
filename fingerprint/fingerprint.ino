#include <WiFi.h>
#include <WebServer.h>
#include <ArduinoJson.h>
#include <Adafruit_Fingerprint.h>

// WiFi設置
const char* ssid = "Ck";
const char* password = "12345678";

// 創建指紋傳感器對象
HardwareSerial mySerial(2);  // 使用 UART2
Adafruit_Fingerprint finger = Adafruit_Fingerprint(&mySerial);

// 創建Web服務器，端口80
WebServer server(80);

void setup() {
  Serial.begin(115200);
  Serial.println("\n啟動指紋識別系統...");
  
  // 初始化指紋傳感器
  mySerial.begin(57600, SERIAL_8N1, 16, 17); // RX=16, TX=17
  delay(100);
  
  // 檢查指紋傳感器
  Serial.println("檢查指紋傳感器...");
  if (finger.verifyPassword()) {
    Serial.println("找到指紋傳感器!");
    // 獲取傳感器參數
    uint8_t p = finger.getParameters();
    Serial.print("狀態: 0x"); Serial.println(p, HEX);
    Serial.print("指紋容量: "); Serial.println(finger.capacity);
    Serial.print("安全等級: "); Serial.println(finger.security_level);
  } else {
    Serial.println("未找到指紋傳感器 :(");
    Serial.println("請檢查接線是否正確：");
    Serial.println("紅線 -> 5V");
    Serial.println("黑線 -> GND");
    Serial.println("黃線 -> GPIO16");
    Serial.println("綠線 -> GPIO17");
    while (1) { delay(1); }
  }

  // 連接WiFi
  Serial.print("連接到WiFi: ");
  Serial.println(ssid);
  
  WiFi.begin(ssid, password);
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi連接成功!");
    Serial.print("IP地址: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\nWiFi連接失敗!");
    ESP.restart();
  }

  // 設置CORS和API路由
  setupRoutes();
  
  // 啟動服務器
  server.begin();
  Serial.println("HTTP服務器已啟動");
}

void loop() {
  server.handleClient();
}

// 設置API路由
void setupRoutes() {
  // 處理所有 OPTIONS 請求
  server.on("/api/fingerprints/verify", HTTP_OPTIONS, []() {
    handleOptions();
  });

  // 處理 /api/fingerprints 的預檢請求
  server.on("/api/fingerprints", HTTP_OPTIONS, []() {
    handleOptions();
  });

  // 處理 /api/fingerprints/register 的預檢請求
  server.on("/api/fingerprints/register", HTTP_OPTIONS, []() {
    handleOptions();
  });

  // 處理 /api/fingerprints/delete 的預檢請求
  server.on("/api/fingerprints/delete", HTTP_OPTIONS, []() {
    handleOptions();
  });

  // 註冊的指紋列表
  server.on("/api/fingerprints", HTTP_GET, []() {
    Serial.println("收到獲取指紋列表請求");
    DynamicJsonDocument doc(1024);
    JsonArray array = doc.to<JsonArray>();
    
    int count = 0;
    for (int i = 1; i <= 127; i++) {
      uint8_t p = finger.loadModel(i);
      if (p == FINGERPRINT_OK) {
        JsonObject fingerprint = array.createNestedObject();
        fingerprint["id"] = i;
        count++;
      }
    }
    
    String response;
    serializeJson(doc, response);
    Serial.printf("找到%d個指紋\n", count);
    
    addCorsHeaders();
    server.send(200, "application/json", response);
  });

  // 註冊新指紋
  server.on("/api/fingerprints/register", HTTP_POST, []() {
    Serial.println("\n收到註冊指紋請求");
    addCorsHeaders();
    
    int id = getFreeID();
    Serial.printf("分配的ID: %d\n", id);
    
    if (id == -1) {
      Serial.println("錯誤：指紋庫已滿");
      server.send(400, "application/json", "{\"error\":\"指紋庫已滿，請先刪除一些指紋\"}");
      return;
    }

    Serial.println("開始註冊指紋流程...");
    int result = enrollFingerprint(id);
    Serial.printf("註冊結果代碼: %d\n", result);
    
    if (result == 0) {
      Serial.println("指紋註冊成功！");
      server.send(200, "application/json", "{\"message\":\"指紋註冊成功\",\"id\":" + String(id) + "}");
    } else {
      String errorMsg = getErrorMessage(result);
      Serial.println("指紋註冊失敗: " + errorMsg);
      server.send(400, "application/json", "{\"error\":\"" + errorMsg + "\"}");
    }
  });

  // 刪除指紋
  server.on("/api/fingerprints/delete", HTTP_DELETE, []() {
    Serial.println("收到刪除指紋請求");
    addCorsHeaders();
    
    if (!server.hasArg("id")) {
      Serial.println("錯誤：缺少ID參數");
      server.send(400, "application/json", "{\"error\":\"缺少ID參數\"}");
      return;
    }
    
    int id = server.arg("id").toInt();
    Serial.printf("嘗試刪除ID: %d\n", id);
    
    if (deleteFingerprint(id)) {
      Serial.println("指紋刪除成功");
      server.send(200, "application/json", "{\"message\":\"指紋刪除成功\"}");
    } else {
      Serial.println("指紋刪除失敗");
      server.send(400, "application/json", "{\"error\":\"指紋刪除失敗\"}");
    }
  });

  // 驗證指紋
  server.on("/api/fingerprints/verify", HTTP_POST, []() {
    Serial.println("\n收到指紋驗證請求");
    addCorsHeaders();
    
    int fingerprintId = getFingerprintID();
    Serial.printf("驗證結果: %d\n", fingerprintId);
    
    if (fingerprintId >= 0) {
      Serial.printf("驗證成功，指紋ID: %d\n", fingerprintId);
      server.send(200, "application/json", "{\"message\":\"驗證成功\",\"fingerprintId\":" + String(fingerprintId) + "}");
    } else {
      String errorMsg;
      switch (fingerprintId) {
        case FINGERPRINT_NOTFOUND:
          errorMsg = "未找到匹配的指紋";
          break;
        case FINGERPRINT_NOFINGER:
          errorMsg = "未檢測到手指";
          break;
        default:
          errorMsg = "驗證失敗";
      }
      Serial.println("驗證失敗: " + errorMsg);
      server.send(400, "application/json", "{\"error\":\"" + errorMsg + "\"}");
    }
  });
}

// 處理 OPTIONS 請求的輔助函數
void handleOptions() {
  addCorsHeaders();
  server.send(204);
}

// 添加 CORS 頭的輔助函數
void addCorsHeaders() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type,Accept");
  server.sendHeader("Access-Control-Max-Age", "3600");
}

// 獲取錯誤信息的輔助函數
String getErrorMessage(int errorCode) {
  switch (errorCode) {
    case FINGERPRINT_NOFINGER:
      return "未檢測到手指";
    case FINGERPRINT_PACKETRECIEVEERR:
      return "通信錯誤";
    case FINGERPRINT_IMAGEFAIL:
      return "圖像採集失敗";
    case FINGERPRINT_IMAGEMESS:
      return "圖像太亂";
    case FINGERPRINT_FEATUREFAIL:
      return "特徵提取失敗";
    case FINGERPRINT_INVALIDIMAGE:
      return "圖像無效";
    default:
      return "未知錯誤 (" + String(errorCode) + ")";
  }
}

// 獲取空閒的ID
int getFreeID() {
  Serial.println("正在搜索空閒ID...");
  
  for (int i = 1; i <= 127; i++) {
    uint8_t p = finger.loadModel(i);
    Serial.printf("檢查ID %d: ", i);
    
    if (p == FINGERPRINT_PACKETRECIEVEERR) {
      Serial.println("通信錯誤");
      continue;
    }
    
    // 如果返回 FINGERPRINT_OK，表示這個 ID 已經被使用
    if (p == FINGERPRINT_OK) {
      Serial.println("已使用");
      continue;
    }
    
    // 如果不是 FINGERPRINT_OK，表示這個 ID 是空閒的
    Serial.println("空閒");
    return i;  // 找到空閒ID，立即返回
  }
  
  Serial.println("沒有找到空閒ID");
  return -1;  // 所有ID都被使用
}

// 註冊新指紋
int enrollFingerprint(int id) {
  int p = -1;
  Serial.println("等待��效的指紋放置...");
  
  // 第一次獲取指紋圖像
  while (p != FINGERPRINT_OK) {
    p = finger.getImage();
    switch (p) {
      case FINGERPRINT_OK:
        Serial.println("圖像獲取成功");
        break;
      case FINGERPRINT_NOFINGER:
        Serial.print(".");
        delay(100);
        break;
      case FINGERPRINT_PACKETRECIEVEERR:
        Serial.println("通信錯誤");
        return p;
      case FINGERPRINT_IMAGEFAIL:
        Serial.println("圖像錯誤");
        return p;
      default:
        Serial.println("未知錯誤");
        return p;
    }
  }

  // 將圖像轉換為特徵模板
  p = finger.image2Tz(1);
  if (p != FINGERPRINT_OK) {
    Serial.println("轉換特徵模板1失敗");
    return p;
  }

  Serial.println("請移開手指");
  delay(2000);
  p = 0;
  while (p != FINGERPRINT_NOFINGER) {
    p = finger.getImage();
    delay(100);
  }

  Serial.println("請再次放置相同的手指");
  p = -1;
  while (p != FINGERPRINT_OK) {
    p = finger.getImage();
    switch (p) {
      case FINGERPRINT_OK:
        Serial.println("圖像獲取成功");
        break;
      case FINGERPRINT_NOFINGER:
        Serial.print(".");
        delay(100);
        break;
      case FINGERPRINT_PACKETRECIEVEERR:
        Serial.println("通信錯誤");
        return p;
      case FINGERPRINT_IMAGEFAIL:
        Serial.println("圖像錯誤");
        return p;
      default:
        Serial.println("未知錯誤");
        return p;
    }
  }

  // 將二次的圖像轉換為特徵模板
  p = finger.image2Tz(2);
  if (p != FINGERPRINT_OK) {
    Serial.println("轉換特徵模板2失敗");
    return p;
  }

  // 創建最終的特徵模型
  Serial.println("創建模型...");
  p = finger.createModel();
  if (p != FINGERPRINT_OK) {
    Serial.println("創建模型失敗");
    return p;
  }

  // 儲存模型
  Serial.print("存儲模型 #"); Serial.println(id);
  p = finger.storeModel(id);
  if (p != FINGERPRINT_OK) {
    Serial.println("存儲模型失敗");
    return p;
  }

  Serial.println("指紋註冊成功！");
  return 0;
}

// 刪除指紋
bool deleteFingerprint(int id) {
  uint8_t p = finger.deleteModel(id);
  if (p == FINGERPRINT_OK) {
    return true;
  }
  return false;
}

// 添加指紋驗證函數
int getFingerprintID() {
  Serial.println("等待指紋...");
  uint8_t p = -1;
  
  // 等待手指放置
  while (p != FINGERPRINT_OK) {
    p = finger.getImage();
    switch (p) {
      case FINGERPRINT_OK:
        Serial.println("圖像獲取成功");
        break;
      case FINGERPRINT_NOFINGER:
        Serial.print(".");
        delay(100);
        continue;
      case FINGERPRINT_PACKETRECIEVEERR:
        Serial.println("通信錯誤");
        return -1;
      case FINGERPRINT_IMAGEFAIL:
        Serial.println("圖像錯誤");
        return -1;
      default:
        Serial.println("未知錯誤");
        return -1;
    }
  }

  // 轉換圖像
  p = finger.image2Tz();
  if (p != FINGERPRINT_OK) {
    Serial.println("轉換圖像失敗");
    return -1;
  }

  // 搜索指紋
  p = finger.fingerFastSearch();
  if (p == FINGERPRINT_OK) {
    Serial.printf("找到匹配的指紋，ID: %d，可信度: %d\n", finger.fingerID, finger.confidence);
    return finger.fingerID;
  } else if (p == FINGERPRINT_NOTFOUND) {
    Serial.println("未找到匹配的指紋");
    return FINGERPRINT_NOTFOUND;
  } else {
    Serial.println("搜索錯誤");
    return -1;
  }
} 