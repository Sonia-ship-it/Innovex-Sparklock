#include <DHT.h>
#include <SoftwareSerial.h>
#include <ESP8266WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <time.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>

// ===================== PIN DEFINITIONS =====================
#define DHTPIN        D2
#define DHTTYPE       DHT11
#define ARD_RX_PIN    D5          // Arduino TX → ESP8266 D5 (via voltage divider)
#define ARD_TX_PIN    D3          // ESP8266 TX → Arduino RX (direct, 3.3V safe via resistor)
#define BUZZER_PIN    D8
#define GREEN_LED     D4
#define BLUE_LED      D1
#define RED_LED       D0

// LCD I2C Pins (custom, to avoid conflicts)
#define LCD_SDA       D6          // GPIO12
#define LCD_SCL       D7          // GPIO13

// ===================== WIFI & MQTT CONFIG =====================
const char* ssid         = "RCA-OFFICE";
const char* password     = "RCA@2024";
const char* mqtt_server  = "test.mosquitto.org";
const uint16_t MQTT_PORT = 1883;
const uint32_t WIFI_TIMEOUT_MS = 30000;
const float MAINS_VOLTAGE = 230.0;

// ===================== MQTT TOPICS =====================
String TOPIC_SENSOR = "sparklock/sensor";
String TOPIC_HEALTH = "sparklock/device/health";
String TOPIC_LWT    = "sparklock/device/status";
String TOPIC_CMD    = "sparklock/command";

// ===================== DEVICE STATE =====================
bool relayState   = true;
bool buzzerState  = false;
String ledColor   = "GREEN";
float lastCurrent = 0.0;

// ===================== TIMING VARIABLES =====================
unsigned long last_health_report  = 0;
const unsigned long HEALTH_INTERVAL = 60000;   // 60 seconds

unsigned long last_sensor_publish = 0;
const unsigned long SENSOR_INTERVAL = 5000;    // 5 seconds

// LCD Non-blocking override timer
unsigned long lcd_override_time = 0;
bool is_lcd_overridden = false;
const unsigned long LCD_OVERRIDE_DURATION = 3000; // 3 seconds

// Last known sensor readings to re-display after override finishes
float displayTemp = 0.0;
float displayHum  = 0.0;
float displayCurr = 0.0;

// ===================== OBJECTS =====================
DHT dht(DHTPIN, DHTTYPE);
SoftwareSerial arduinoSerial(ARD_RX_PIN, ARD_TX_PIN);
WiFiClient espClient;
PubSubClient client(espClient);
LiquidCrystal_I2C lcd(0x27, 16, 2); // Try 0x3F if display is blank

// ===================== LCD HELPERS =====================
void lcdPrintLine(uint8_t row, String text) {
  lcd.setCursor(0, row);
  while (text.length() < 16) text += " ";
  if (text.length() > 16) text = text.substring(0, 16);
  lcd.print(text);
}

void lcdShowBoot() {
  lcdPrintLine(0, "  SparkLock v1  ");
  lcdPrintLine(1, "  Booting...    ");
}

void lcdShowWifi(bool connecting) {
  if (connecting) {
    lcdPrintLine(0, "WiFi Connecting ");
    lcdPrintLine(1, "Please wait...  ");
  } else {
    lcdPrintLine(0, "WiFi Connected! ");
    lcdPrintLine(1, WiFi.localIP().toString());
  }
}

void lcdShowNTP() {
  lcdPrintLine(0, "Syncing Time... ");
  lcdPrintLine(1, "NTP in progress ");
}

void lcdShowMQTT(bool connecting) {
  if (connecting) {
    lcdPrintLine(0, "MQTT Connecting ");
    lcdPrintLine(1, mqtt_server);
  } else {
    lcdPrintLine(0, "MQTT Connected! ");
    lcdPrintLine(1, "SparkLock Ready!");
  }
}

void lcdShowSensor(float t, float h, float c) {
  String row0 = "T:" + String(t, 1) + "C H:" + String(h, 0) + "%";
  lcdPrintLine(0, row0);
  String row1 = "I:" + String(c, 3) + "A R:" + String(relayState ? "ON " : "OFF");
  lcdPrintLine(1, row1);
}

// Shows a temporary message on LCD without using delay()
void lcdShowTemporary(String line0, String line1) {
  lcdPrintLine(0, line0);
  lcdPrintLine(1, line1);
  is_lcd_overridden = true;
  lcd_override_time = millis();
}

void lcdShowHealth(int heap, int rssi) {
  String row1 = "H:" + String(heap / 1024) + "KB S:" + String(rssi) + "dB";
  lcdShowTemporary("Health Report   ", row1);
}

void lcdShowCommand() {
  String row1 = "R:" + String(relayState ? "ON " : "OFF") + " LED:" + ledColor;
  lcdShowTemporary("CMD Received!   ", row1);
}

// ===================== TIME =====================
void sync_time() {
  configTime(0, 0, "pool.ntp.org", "time.nist.gov");
  while (time(nullptr) < 100000) delay(500);
}

unsigned long get_unix_time() {
  return (unsigned long)time(nullptr);
}

// ===================== WIFI =====================
void setup_wifi() {
  Serial.println("Connecting to WiFi...");
  lcdShowWifi(true);

  WiFi.begin(ssid, password);
  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED) {
    if (millis() - start > WIFI_TIMEOUT_MS) {
      Serial.println("WiFi timeout! Restarting...");
      lcdPrintLine(0, "WiFi Timeout!   ");
      lcdPrintLine(1, "Restarting...   ");
      delay(2000);
      ESP.restart();
    }
    Serial.print(".");
    delay(500);
  }
  Serial.println();
  Serial.print("WiFi Connected! IP: ");
  Serial.println(WiFi.localIP());

  lcdShowWifi(false);
  delay(1500);
}

// ===================== HARDWARE =====================
void applyHardwareState() {
  digitalWrite(BUZZER_PIN, buzzerState ? HIGH : LOW);

  digitalWrite(GREEN_LED, LOW);
  digitalWrite(BLUE_LED,  LOW);
  digitalWrite(RED_LED,   LOW);
  if      (ledColor == "GREEN") digitalWrite(GREEN_LED, HIGH);
  else if (ledColor == "BLUE")  digitalWrite(BLUE_LED,  HIGH);
  else if (ledColor == "RED")   digitalWrite(RED_LED,   HIGH);

  Serial.print("Hardware State -> Relay: ");
  Serial.print(relayState ? "ON" : "OFF");
  Serial.print(" | Buzzer: ");
  Serial.print(buzzerState ? "ON" : "OFF");
  Serial.print(" | LED: ");
  Serial.println(ledColor);
}

// ===================== FORWARD RELAY TO ARDUINO =====================
void forwardRelayToArduino(bool state) {
  String cmd = state ? "RELAY:ON\n" : "RELAY:OFF\n";
  arduinoSerial.print(cmd);
  Serial.print("Forwarded to Arduino: ");
  Serial.print(cmd);
}

// ===================== READ CURRENT FROM ARDUINO =====================
float readCurrentFromArduino() {
  while (arduinoSerial.available()) {
    String line = arduinoSerial.readStringUntil('\n');
    line.trim();
    if (line.length() > 0) {
      float val = line.toFloat();
      if (val >= 0) lastCurrent = val;
    }
  }
  return lastCurrent;
}

// ===================== MQTT CALLBACK =====================
void callback(char* topic, byte* payload, unsigned int length) {
  Serial.print("MQTT Command received on [");
  Serial.print(topic);
  Serial.print("]: ");

  String message = "";
  for (unsigned int i = 0; i < length; i++) message += (char)payload[i];
  Serial.println(message);

  StaticJsonDocument<256> doc;
  DeserializationError error = deserializeJson(doc, message);
  if (error) {
    Serial.print("deserializeJson() failed: ");
    Serial.println(error.c_str());
    return;
  }

  if (doc.containsKey("relay")) {
    relayState = doc["relay"].as<String>() == "ON";
    forwardRelayToArduino(relayState);
  }

  if (doc.containsKey("buzzer")) {
    buzzerState = doc["buzzer"].as<String>() == "ON";
  }

  if (doc.containsKey("led")) {
    ledColor = doc["led"].as<String>();
  }

  // Apply physical changes IMMEDIATELY — no delay()
  applyHardwareState();

  // Show on LCD WITHOUT blocking the loop
  lcdShowCommand();
}

// ===================== MQTT RECONNECT =====================
void reconnect() {
  while (!client.connected()) {
    Serial.print("Connecting to MQTT broker...");
    lcdShowMQTT(true);

    if (client.connect("sparklock_", TOPIC_LWT.c_str(), 1, true, "offline")) {
      Serial.println(" Connected!");
      client.publish(TOPIC_LWT.c_str(), "online", true);
      client.subscribe(TOPIC_CMD.c_str());
      Serial.print("Subscribed to: ");
      Serial.println(TOPIC_CMD);
      lcdShowMQTT(false);
      delay(1500);
    } else {
      Serial.print(" Failed! RC=");
      Serial.print(client.state());
      Serial.println(" Retrying in 5s...");
      lcdPrintLine(0, "MQTT Failed!    ");
      lcdPrintLine(1, "RC:" + String(client.state()) + " Retry 5s");
      delay(5000);
    }
  }
}

// ===================== MQTT PUBLISH =====================
void publish_health() {
  int heap = ESP.getFreeHeap();
  int rssi = WiFi.RSSI();

  StaticJsonDocument<128> doc;
  doc["heap"] = heap;
  doc["rssi"] = rssi;
  doc["ts"]   = get_unix_time();
  char buf[128];
  serializeJson(doc, buf);
  client.publish(TOPIC_HEALTH.c_str(), buf);

  Serial.print("Health -> Heap: ");
  Serial.print(heap);
  Serial.print(" B | RSSI: ");
  Serial.print(rssi);
  Serial.print(" dBm | TS: ");
  Serial.println(get_unix_time());

  // Show on LCD WITHOUT blocking the loop
  lcdShowHealth(heap, rssi);
}

void publishSensor(float t, float h, float c) {
  StaticJsonDocument<300> doc;
  doc["temperature"] = t;
  doc["humidity"]    = h;
  doc["current"]     = c;
  doc["relay"]       = relayState  ? "ON" : "OFF";
  doc["buzzer"]      = buzzerState ? "ON" : "OFF";
  doc["led"]         = ledColor;
  doc["ts"]          = get_unix_time();
  char buf[256];
  serializeJson(doc, buf);
  client.publish(TOPIC_SENSOR.c_str(), buf);

  Serial.println("==============================");
  Serial.print("Temperature : "); Serial.print(t, 1);                 Serial.println(" °C");
  Serial.print("Humidity    : "); Serial.print(h, 1);                 Serial.println(" %");
  Serial.print("Current     : "); Serial.print(c, 3);                 Serial.println(" A");
  Serial.print("Power       : "); Serial.print(c * MAINS_VOLTAGE, 2); Serial.println(" W (apparent)");
  Serial.print("Relay       : "); Serial.println(relayState  ? "ON" : "OFF");
  Serial.print("Buzzer      : "); Serial.println(buzzerState ? "ON" : "OFF");
  Serial.print("LED         : "); Serial.println(ledColor);
  Serial.println("==============================");
}

// ===================== SETUP =====================
void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println();
  Serial.println("==============================");
  Serial.println("   SparkLock | Booting...    ");
  Serial.println("==============================");

  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(RED_LED,    OUTPUT);
  pinMode(GREEN_LED,  OUTPUT);
  pinMode(BLUE_LED,   OUTPUT);

  arduinoSerial.begin(9600);

  // LCD INIT (delays here are fine, MQTT not connected yet)
  Wire.begin(LCD_SDA, LCD_SCL);
  lcd.init();
  lcd.backlight();
  lcdShowBoot();
  delay(2000);

  dht.begin();
  setup_wifi();

  Serial.println("Syncing time via NTP...");
  lcdShowNTP();
  sync_time();
  Serial.print("Time synced. Unix time: ");
  Serial.println(get_unix_time());

  client.setServer(mqtt_server, MQTT_PORT);
  client.setCallback(callback);
  reconnect();

  forwardRelayToArduino(relayState);
  applyHardwareState();

  // Show initial sensor screen
  lcdShowSensor(0.0, 0.0, 0.0);

  Serial.println("SparkLock is Ready!");
  Serial.println("==============================");
}

// ===================== LOOP =====================
void loop() {
  // Reconnect if dropped
  if (!client.connected()) reconnect();

  // ⚡ THIS is the key line — runs thousands of times/sec to catch incoming commands instantly
  client.loop();

  unsigned long currentMillis = millis();

  // 1. Health Report (Every 60s, non-blocking)
  if (currentMillis - last_health_report > HEALTH_INTERVAL) {
    last_health_report = currentMillis;
    publish_health();
  }

  // 2. Sensor Read & Publish (Every 5s, non-blocking)
  if (currentMillis - last_sensor_publish > SENSOR_INTERVAL) {
    last_sensor_publish = currentMillis;

    displayTemp = dht.readTemperature();
    displayHum  = dht.readHumidity();
    displayCurr = readCurrentFromArduino();

    if (isnan(displayTemp)) displayTemp = 0.0;
    if (isnan(displayHum))  displayHum  = 0.0;

    publishSensor(displayTemp, displayHum, displayCurr);

    // Only update LCD if it's not showing a temporary message
    if (!is_lcd_overridden) {
      lcdShowSensor(displayTemp, displayHum, displayCurr);
    }
  }

  // 3. LCD Override Expiry Check (Revert to sensor data after 3s)
  if (is_lcd_overridden && (currentMillis - lcd_override_time > LCD_OVERRIDE_DURATION)) {
    is_lcd_overridden = false;
    // Redraw sensor data ONCE when the temporary message expires
    lcdShowSensor(displayTemp, displayHum, displayCurr);
  }

  // NO delay() here! The loop runs freely at full CPU speed.
}