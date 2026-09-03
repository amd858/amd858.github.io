/* Parts Bin — electronic component price finder
   Plain JS, no build step, no dependencies. Runs from file:// or GitHub Pages. */

'use strict';

const KEY = 'partsbin.v1';
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const uid = () => Math.random().toString(36).slice(2, 10);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const today = () => new Date().toISOString().slice(0, 10);

/* ============================ seed stores ============================
   search_url uses {q} as the placeholder for the search term.
   These are best-effort defaults. If a link lands on the wrong page,
   open Manage data > Stores and fix the URL — it takes ten seconds. */
const SEED_STORES = [
  { id:'digilog',   name:'Digilog.pk',     country:'PK', currency:'PKR', url:'https://digilog.pk/search?q={q}', enabled:true },
  { id:'circuitpk', name:'Circuit.pk',     country:'PK', currency:'PKR', url:'https://circuit.pk/?s={q}&post_type=product', enabled:true },
  { id:'hallroad',  name:'Hallroad.org',   country:'PK', currency:'PKR', url:'https://hallroad.org/index.php?route=product/search&search={q}', enabled:true },
  { id:'daraz',     name:'Daraz.pk',       country:'PK', currency:'PKR', url:'https://www.daraz.pk/catalog/?q={q}', enabled:true },
  // microtronicspakistan.com no longer resolves in DNS (nor do microtronics.pk /
  // microtronics.com.pk) — shop looks gone. Left here, disabled, in case it returns.
  { id:'microtron', name:'Microtronics.pk',country:'PK', currency:'PKR', url:'https://microtronicspakistan.com/?s={q}&post_type=product', enabled:false },
  // --- more Pakistan-based stores, added from a 2026 store directory. URLs are
  // best-effort guesses at each shop's search address (mostly WooCommerce's
  // default ?s=&post_type=product) — same caveat as the original list above.
  // Wrong link? Manage data > Stores > Edit and fix it, ten seconds.
  { id:'instock', name:'InStock.pk', country:'PK', currency:'PKR', url:'https://instock.pk/catalogsearch/result/?q={q}', enabled:false },
  { id:'electrobes', name:'Electrobes', country:'PK', currency:'PKR', url:'https://electrobes.com/?s={q}&post_type=product', enabled:true },
  { id:'chippk', name:'Chip.pk', country:'PK', currency:'PKR', url:'https://chip.pk/search?q={q}', enabled:true },
  { id:'artofcircuits', name:'Art of Circuits', country:'PK', currency:'PKR', url:'https://artofcircuits.com/?s={q}&post_type=product', enabled:true },
  { id:'mreeco', name:'MREECO', country:'PK', currency:'PKR', url:'https://mreeco.com/?s={q}&post_type=product', enabled:true },
  { id:'hallroadlahore', name:'Hallroad Lahore', country:'PK', currency:'PKR', url:'https://hallroadlahore.pk/search?q={q}', enabled:true },
  { id:'rawlix', name:'Rawlix', country:'PK', currency:'PKR', url:'https://rawlix.com/?s={q}&post_type=product', enabled:true },
  { id:'mekatroniks', name:'Mekatroniks', country:'PK', currency:'PKR', url:'https://mekatroniks.com/?s={q}&post_type=product', enabled:true },
  { id:'electronicshub', name:'Electronics Hub', country:'PK', currency:'PKR', url:'https://electronicshub.pk/?s={q}&post_type=product', enabled:true },
  { id:'sciencestore', name:'ScienceStore.pk', country:'PK', currency:'PKR', url:'https://sciencestore.pk/?s={q}&post_type=product', enabled:true },
  { id:'roboticspk', name:'RoboticsPK', country:'PK', currency:'PKR', url:'https://roboticspk.com/?s={q}&post_type=product', enabled:true },
  { id:'robonation', name:'Robonation Pakistan', country:'PK', currency:'PKR', url:'https://robonationpakistan.com/?s={q}&post_type=product', enabled:true },
  { id:'robostan', name:'Robostan', country:'PK', currency:'PKR', url:'https://robostan.pk/?s={q}&post_type=product', enabled:true },
  { id:'arduinocorner', name:'Arduino Corner', country:'PK', currency:'PKR', url:'https://arduinocorner.com/?s={q}&post_type=product', enabled:true },
  { id:'collegeroad', name:'College Road Online', country:'PK', currency:'PKR', url:'https://collegeroadonline.com/?s={q}&post_type=product', enabled:true },
  { id:'arduinopak', name:'Arduino Megatronics', country:'PK', currency:'PKR', url:'https://arduinopak.com/?s={q}&post_type=product', enabled:true },
  { id:'multanelec', name:'Multan Electronics', country:'PK', currency:'PKR', url:'https://multanelectronics.com/?s={q}&post_type=product', enabled:true },
  { id:'daroghawala', name:'Daroghawala', country:'PK', currency:'PKR', url:'https://daroghawala.org/?s={q}&post_type=product', enabled:true },
  { id:'megaeshop', name:'MegaeShop', country:'PK', currency:'PKR', url:'https://megaeshop.pk/?s={q}&post_type=product', enabled:true },
  { id:'evselectro', name:'EVE-eVision', country:'PK', currency:'PKR', url:'https://evselectro.com/?s={q}&post_type=product', enabled:true },
  { id:'electronicsoln', name:'Electronic Solution', country:'PK', currency:'PKR', url:'https://electronicsolution.pk/search?q={q}', enabled:true },
  { id:'hallroadpk', name:'HallroadPK', country:'PK', currency:'PKR', url:'https://hallroadpk.com/?s={q}&post_type=product', enabled:true },
  { id:'electronicstorepk', name:'Electronic Store', country:'PK', currency:'PKR', url:'https://electronicstore.pk/?s={q}&post_type=product', enabled:true },
  { id:'ewall', name:'EWALL', country:'PK', currency:'PKR', url:'https://ewall.com.pk/?s={q}&post_type=product', enabled:true },
  { id:'dcart', name:'DCart', country:'PK', currency:'PKR', url:'https://dcart.pk/?s={q}&post_type=product', enabled:true },
  { id:'axiselectronics', name:'Axis Electronics', country:'PK', currency:'PKR', url:'https://axiselectronics.com.pk/?s={q}&post_type=product', enabled:true },
  { id:'modernelec', name:'Modern Electronics', country:'PK', currency:'PKR', url:'https://modernelectronics.pk/search?q={q}', enabled:true },
  { id:'electronation', name:'Electronation', country:'PK', currency:'PKR', url:'https://electronation.pk/?s={q}&post_type=product', enabled:true },
  { id:'hallroaddotcom', name:'Hallroad.com.pk', country:'PK', currency:'PKR', url:'https://hallroad.com.pk/?s={q}&post_type=product', enabled:true },
  { id:'epal', name:'epal.pk', country:'PK', currency:'PKR', url:'https://epal.pk/?s={q}&post_type=product', enabled:true },
  { id:'denontek', name:'Denontek', country:'PK', currency:'PKR', url:'https://denontek.com.pk/?s={q}&post_type=product', enabled:true },
  { id:'arduinostorepk', name:'arduinostore.pk', country:'PK', currency:'PKR', url:'https://arduinostore.pk/?s={q}&post_type=product', enabled:true },
  { id:'icmaster', name:'IC Master', country:'PK', currency:'PKR', url:'https://icmasteronline.com/?s={q}&post_type=product', enabled:true },
  { id:'tejar', name:'Tejar.pk', country:'PK', currency:'PKR', url:'https://www.tejar.pk/catalog/search?q={q}', enabled:false },
  // Found by searching for real product pages, then confirmed by DNS.
  // epro.pk and digilog.com.pk serve /product/ and /product-category/ paths
  // (WooCommerce); smarteshop.pk serves /products/ and sits on Shopify's IPs.
  { id:'epro', name:'Epro.pk', country:'PK', currency:'PKR', url:'https://epro.pk/?s={q}&post_type=product', enabled:true },
  { id:'smarteshop', name:'SmartEshop.pk', country:'PK', currency:'PKR', url:'https://smarteshop.pk/search?q={q}', enabled:true },
  { id:'digilogcompk', name:'Digilog.com.pk', country:'PK', currency:'PKR', url:'https://digilog.com.pk/?s={q}&post_type=product', enabled:true },
  { id:'robu',      name:'Robu.in',        country:'IN', currency:'INR', url:'https://robu.in/?s={q}&post_type=product', enabled:true },
  { id:'w11stop',   name:'W11Stop',        country:'PK', currency:'PKR', url:'https://www.w11stop.com/search?q={q}', enabled:false },
  { id:'lcsc',      name:'LCSC',           country:'CN', currency:'USD', url:'https://www.lcsc.com/search?q={q}', enabled:true },
  { id:'ali',       name:'AliExpress',     country:'CN', currency:'USD', url:'https://www.aliexpress.com/wholesale?SearchText={q}', enabled:true },
  { id:'octopart',  name:'Octopart',       country:'--', currency:'USD', url:'https://octopart.com/search?q={q}', enabled:true },
  { id:'mouser',    name:'Mouser',         country:'US', currency:'USD', url:'https://www.mouser.com/c/?q={q}', enabled:false },
  { id:'digikey',   name:'DigiKey',        country:'US', currency:'USD', url:'https://www.digikey.com/en/products/result?keywords={q}', enabled:false }
];

/* ============================ seed catalogue ============================
   [part_no, name, category, package/format, tags]
   Component facts only — no prices. You add those. */
const SEED_RAW = [
// Boards & microcontrollers
['ESP32 DevKit V1','ESP32 WiFi + Bluetooth dev board','Boards','38-pin','wifi bluetooth iot esp'],
['ESP8266 NodeMCU','NodeMCU Lua WiFi board','Boards','CP2102','wifi iot esp nodemcu'],
['ESP-01','ESP8266 serial WiFi module','Modules','8-pin','wifi esp serial'],
['Arduino UNO R3','ATmega328P dev board','Boards','DIP/SMD','arduino uno starter'],
['Arduino Nano','Compact ATmega328P board','Boards','30-pin','arduino nano small'],
['Arduino Mega 2560','ATmega2560 board, 54 I/O','Boards','R3','arduino mega'],
['Arduino Pro Micro','ATmega32U4 board, native USB','Boards','5V/16MHz','arduino leonardo hid'],
['Raspberry Pi Pico','RP2040 microcontroller board','Boards','40-pin','rpi pico rp2040'],
['Raspberry Pi Pico W','RP2040 board with WiFi','Boards','40-pin','rpi pico wifi'],
['STM32F103C8T6','Blue Pill ARM Cortex-M3 board','Boards','LQFP48','stm32 bluepill arm'],
['ATmega328P-PU','8-bit AVR microcontroller','ICs','DIP-28','avr atmega arduino chip'],
['ATmega16A','8-bit AVR microcontroller','ICs','DIP-40','avr atmega'],
['ATtiny85','8-bit AVR, 8 pin','ICs','DIP-8','avr attiny tiny'],
['PIC16F877A','8-bit PIC microcontroller','ICs','DIP-40','pic microchip'],
['PIC16F628A','8-bit PIC microcontroller','ICs','DIP-18','pic microchip'],
['AT89S52','8051 family microcontroller','ICs','DIP-40','8051 atmel'],
// Sensors
['DHT11','Temperature + humidity sensor','Sensors','3-pin module','temperature humidity'],
['DHT22','Temp + humidity sensor, higher accuracy','Sensors','AM2302','temperature humidity am2302'],
['HC-SR04','Ultrasonic distance sensor','Sensors','4-pin','ultrasonic distance sonar'],
['MPU6050','6-axis gyro + accelerometer','Sensors','GY-521','imu gyro accelerometer i2c'],
['MPU9250','9-axis IMU','Sensors','GY-91','imu magnetometer'],
['BMP280','Barometric pressure + temp sensor','Sensors','GY-BMP280','pressure altitude i2c'],
['BME280','Pressure, temp and humidity sensor','Sensors','I2C/SPI','pressure humidity'],
['DS18B20','1-Wire digital temperature sensor','Sensors','TO-92','temperature onewire waterproof'],
['LM35','Analog temperature sensor','Sensors','TO-92','temperature analog'],
['HC-SR501','PIR motion sensor','Sensors','module','pir motion infrared'],
['MQ-2','Smoke and combustible gas sensor','Sensors','module','gas smoke lpg'],
['MQ-135','Air quality gas sensor','Sensors','module','gas air quality'],
['LDR 5mm','Light dependent resistor','Passives','5mm','ldr photoresistor light'],
['ACS712','Hall-effect current sensor','Sensors','5A/20A/30A','current sensor hall'],
['INA219','High-side DC current/power monitor','Sensors','I2C','current power i2c'],
['HX711','24-bit ADC for load cells','Modules','module','loadcell weight scale adc'],
['MAX30102','Pulse oximeter + heart rate sensor','Sensors','I2C','heartrate spo2 pulse'],
['TCS3200','Colour recognition sensor','Sensors','module','colour sensor'],
['Soil moisture sensor','Capacitive soil moisture probe','Sensors','v1.2','soil moisture plant'],
['IR obstacle sensor','Infrared obstacle avoidance module','Sensors','module','infrared obstacle'],
['TCRT5000','Reflective IR line sensor','Sensors','module','line follower infrared'],
['Flame sensor','IR flame detection module','Sensors','module','flame fire'],
// Comms & modules
['HC-05','Bluetooth SPP master/slave module','Modules','6-pin','bluetooth serial'],
['HC-06','Bluetooth slave module','Modules','4-pin','bluetooth serial'],
['NRF24L01','2.4GHz transceiver module','Modules','SMD/PA+LNA','wireless rf 2.4ghz'],
['SX1278','LoRa 433MHz transceiver','Modules','Ra-02','lora rf longrange'],
['SIM800L','Quad-band GSM/GPRS module','Modules','module','gsm gprs sms sim'],
['NEO-6M','GPS receiver module with antenna','Modules','module','gps location'],
['RC522','13.56MHz RFID reader/writer','Modules','SPI','rfid nfc mifare'],
['PN532','NFC reader module','Modules','I2C/SPI','nfc rfid'],
['MicroSD card module','SPI microSD breakout','Modules','SPI','sd card storage'],
['DS3231','Precision RTC with temp compensation','Modules','ZS-042','rtc clock time i2c'],
['DS1307','Real time clock module','Modules','Tiny RTC','rtc clock time'],
['W5500','Ethernet controller module','Modules','SPI','ethernet lan network'],
['ENC28J60','Ethernet module','Modules','SPI','ethernet lan'],
['CP2102','USB to UART bridge','Modules','module','usb serial ttl programmer'],
['FT232RL','USB to serial adapter','Modules','module','usb serial ftdi'],
['CH340G','USB to serial converter','ICs','SOP-16','usb serial'],
// Displays
['LCD 16x2','Character LCD, HD44780','Displays','16x2','lcd display character'],
['LCD 20x4','Character LCD, HD44780','Displays','20x4','lcd display character'],
['PCF8574 I2C backpack','I2C adapter for character LCD','Modules','I2C','lcd i2c backpack'],
['SSD1306 0.96"','128x64 monochrome OLED','Displays','I2C/SPI','oled display i2c'],
['SSD1306 1.3"','128x64 OLED (SH1106 variant)','Displays','I2C','oled display'],
['ST7735 1.8"','128x160 colour TFT','Displays','SPI','tft colour display'],
['ILI9341 2.4"','240x320 colour TFT, touch option','Displays','SPI','tft touch display'],
['TM1637','4-digit 7-segment display module','Displays','module','7segment digit clock'],
['MAX7219','8x8 LED matrix driver module','Displays','module','matrix led dotmatrix'],
['Nokia 5110','84x48 graphic LCD','Displays','PCD8544','lcd graphic nokia'],
// Drivers & power
['L298N','Dual H-bridge motor driver module','Drivers','module','motor driver hbridge'],
['L293D','Quadruple half-H driver','ICs','DIP-16','motor driver hbridge'],
['ULN2003','Darlington array / stepper driver','ICs','DIP-16','darlington stepper driver'],
['ULN2803','8-channel Darlington array','ICs','DIP-18','darlington driver'],
['A4988','Stepper motor driver module','Drivers','module','stepper driver 3dprinter'],
['DRV8825','Stepper driver, higher current','Drivers','module','stepper driver 3dprinter'],
['TB6600','Stepper driver, 4A','Drivers','enclosed','stepper driver cnc'],
['LM2596','Adjustable buck converter module','Power','module','buck stepdown dcdc'],
['XL6009','Adjustable boost converter module','Power','module','boost stepup dcdc'],
['MT3608','2A boost converter module','Power','module','boost stepup dcdc'],
['TP4056','1S Li-ion charger module','Power','with protection','lipo charger 18650 usb'],
['LM7805','5V linear regulator, 1A','Power','TO-220','regulator 5v 7805'],
['LM7812','12V linear regulator, 1A','Power','TO-220','regulator 12v'],
['LM317','Adjustable linear regulator','Power','TO-220','regulator adjustable'],
['AMS1117-3.3','3.3V LDO regulator','Power','SOT-223','regulator ldo 3v3'],
// Discretes
['IRF540N','N-channel MOSFET, 100V 33A','Discretes','TO-220','mosfet nchannel power'],
['IRFZ44N','N-channel MOSFET, 55V 49A','Discretes','TO-220','mosfet nchannel power'],
['IRF3205','N-channel MOSFET, 55V 110A','Discretes','TO-220','mosfet nchannel power'],
['2N2222','NPN general purpose transistor','Discretes','TO-92','transistor npn'],
['BC547','NPN general purpose transistor','Discretes','TO-92','transistor npn'],
['BC557','PNP general purpose transistor','Discretes','TO-92','transistor pnp'],
['TIP122','NPN Darlington power transistor','Discretes','TO-220','transistor darlington'],
['BD139','NPN medium power transistor','Discretes','TO-126','transistor npn'],
['1N4007','Rectifier diode, 1000V 1A','Discretes','DO-41','diode rectifier'],
['1N4148','Small signal switching diode','Discretes','DO-35','diode signal'],
['1N5819','Schottky diode, 40V 1A','Discretes','DO-41','diode schottky'],
['1N5408','Rectifier diode, 1000V 3A','Discretes','DO-201','diode rectifier'],
['KBL406','Bridge rectifier, 4A 600V','Discretes','KBL','bridge rectifier'],
['1N4733A','Zener diode, 5.1V 1W','Discretes','DO-41','zener diode'],
// ICs
['NE555','Timer IC','ICs','DIP-8','timer 555 oscillator'],
['LM358','Dual op-amp','ICs','DIP-8','opamp dual'],
['LM324','Quad op-amp','ICs','DIP-14','opamp quad'],
['LM393','Dual comparator','ICs','DIP-8','comparator'],
['74HC595','8-bit shift register, serial to parallel','ICs','DIP-16','shiftregister logic'],
['74HC165','8-bit shift register, parallel to serial','ICs','DIP-16','shiftregister logic'],
['CD4017','Decade counter / divider','ICs','DIP-16','counter cmos'],
['CD4047','Astable / monostable multivibrator','ICs','DIP-14','multivibrator inverter'],
['MCP3008','8-channel 10-bit SPI ADC','ICs','DIP-16','adc spi'],
['ADS1115','16-bit I2C ADC module','Modules','module','adc i2c precision'],
['PCF8574','8-bit I2C I/O expander','ICs','DIP-16','ioexpander i2c'],
['MAX232','RS-232 line driver/receiver','ICs','DIP-16','rs232 serial'],
['PC817','Optocoupler, transistor output','ICs','DIP-4','optocoupler isolation'],
['4N35','Optocoupler, transistor output','ICs','DIP-6','optocoupler isolation'],
['MOC3021','Triac driver optocoupler','ICs','DIP-6','optocoupler triac ac'],
['BT136','Triac, 4A 600V','Discretes','TO-220','triac ac dimmer'],
// Electromechanical
['SG90','9g micro servo','Motors','plastic gear','servo micro'],
['MG996R','Metal gear servo, high torque','Motors','metal gear','servo torque'],
['28BYJ-48','5V unipolar stepper with ULN2003 board','Motors','with driver','stepper 5v'],
['NEMA 17','Bipolar stepper motor, 1.8°','Motors','42mm','stepper 3dprinter cnc'],
['Relay module 1ch 5V','Single channel relay board, opto-isolated','Modules','5V','relay switch ac'],
['Relay module 4ch 5V','Four channel relay board','Modules','5V','relay switch ac'],
['Buzzer (active) 5V','Self-oscillating buzzer','Passives','12mm','buzzer beep sound'],
['Buzzer (passive) 5V','Tone-driven buzzer','Passives','12mm','buzzer tone sound'],
['DC gear motor','BO motor with gearbox','Motors','3-6V','motor robot bo'],
// Passives & prototyping
['Resistor kit 1/4W','Assorted carbon film resistors','Passives','kit','resistor kit assortment'],
['Resistor 10k 1/4W','Carbon film resistor','Passives','through-hole','resistor 10k'],
['Resistor 220R 1/4W','Carbon film resistor','Passives','through-hole','resistor 220'],
['Resistor 1k 1/4W','Carbon film resistor','Passives','through-hole','resistor 1k'],
['Capacitor 100nF','Ceramic capacitor, 104','Passives','through-hole','capacitor ceramic decoupling'],
['Capacitor 10uF 25V','Electrolytic capacitor','Passives','radial','capacitor electrolytic'],
['Capacitor 100uF 25V','Electrolytic capacitor','Passives','radial','capacitor electrolytic'],
['Capacitor 1000uF 25V','Electrolytic capacitor','Passives','radial','capacitor electrolytic filter'],
['Crystal 16MHz','Quartz crystal oscillator','Passives','HC-49','crystal oscillator'],
['Crystal 32.768kHz','Watch crystal','Passives','cylindrical','crystal rtc'],
['Potentiometer 10k','Rotary potentiometer','Passives','B10K','pot variable resistor'],
['Trimpot 10k','Multiturn trimmer potentiometer','Passives','3296W','trimpot preset'],
['LED 5mm','Standard LED, assorted colours','Passives','5mm','led light'],
['RGB LED 5mm','Common cathode RGB LED','Passives','5mm','led rgb'],
['WS2812B','Addressable RGB LED strip','Passives','5050','neopixel addressable led'],
['Tactile push button','6x6mm momentary switch','Passives','6x6','button switch tactile'],
['Breadboard 830','Solderless breadboard, 830 points','Prototyping','MB-102','breadboard protoboard'],
['Breadboard 400','Solderless breadboard, 400 points','Prototyping','half size','breadboard'],
['Jumper wires M-M','40x male to male dupont wires','Prototyping','20cm','jumper dupont wires'],
['Jumper wires M-F','40x male to female dupont wires','Prototyping','20cm','jumper dupont wires'],
['Vero/perf board','Single sided prototyping board','Prototyping','assorted','perfboard veroboard'],
['Header pins 40p','2.54mm male header strip','Prototyping','2.54mm','header pins berg'],
['IC socket DIP-28','Machined DIP socket','Prototyping','DIP-28','socket dip'],
['18650 cell','Li-ion rechargeable cell','Power','18650','battery lithium 18650'],
['18650 holder 2S','Battery holder','Power','2 cell','battery holder'],
['9V battery clip','Snap connector with leads','Power','snap','battery clip 9v']
];

/* ============================ state ============================ */
let DB = null;
let editingComponent = null;
let browseAll = false;

function seedComponents() {
  return SEED_RAW.map(r => ({
    id: uid(), part: r[0], name: r[1], cat: r[2], pkg: r[3], tags: r[4], note: ''
  }));
}

function demoPrices(comps) {
  // Clearly fake numbers, only so a first-time screen is not empty.
  const pick = ['ESP32 DevKit V1', 'Arduino Nano', 'DHT11', 'NE555', 'L298N', 'SSD1306 0.96"'];
  const table = {
    'ESP32 DevKit V1': [['digilog', 1450, 'PKR'], ['daraz', 1290, 'PKR'], ['robu', 380, 'INR']],
    'Arduino Nano':    [['digilog', 980, 'PKR'], ['circuitpk', 1100, 'PKR'], ['ali', 2.4, 'USD']],
    'DHT11':           [['digilog', 240, 'PKR'], ['daraz', 199, 'PKR']],
    'NE555':           [['hallroad', 35, 'PKR'], ['lcsc', 0.08, 'USD']],
    'L298N':           [['circuitpk', 520, 'PKR'], ['daraz', 470, 'PKR']],
    'SSD1306 0.96"':   [['digilog', 690, 'PKR'], ['robu', 175, 'INR']]
  };
  const out = [];
  pick.forEach(p => {
    const c = comps.find(x => x.part === p);
    if (!c) return;
    (table[p] || []).forEach(([store, price, cur]) => {
      out.push({ id: uid(), cid: c.id, store, price, cur, stock: 'in', url: '', date: today(), demo: true });
    });
  });
  return out;
}

function freshDB() {
  const components = seedComponents();
  return {
    v: 1,
    components,
    prices: demoPrices(components),
    stores: SEED_STORES.map(s => ({ ...s })),
    settings: {
      display: 'PKR',
      // Roughly how many display-units one unit of each currency is worth.
      // These are placeholders — set your own in Settings.
      rates: { PKR: 1, INR: 3.4, USD: 280, AED: 76, GBP: 355, EUR: 305, CNY: 39 }
    }
  };
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return freshDB();
    const d = JSON.parse(raw);
    if (!d || !Array.isArray(d.components)) return freshDB();
    d.prices = d.prices || [];
    d.stores = d.stores && d.stores.length ? d.stores : SEED_STORES.map(s => ({ ...s }));
    d.settings = d.settings || { display: 'PKR', rates: {} };
    d.settings.rates = Object.assign({ PKR: 1, INR: 3.4, USD: 280 }, d.settings.rates);
    return d;
  } catch (e) {
    console.warn('Could not read saved data, starting fresh.', e);
    return freshDB();
  }
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(DB));
  } catch (e) {
    toast('Could not save — browser storage is full or blocked.');
  }
}

/* ============================ helpers ============================ */
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove('show'), 2600);
}

const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
const storeById = id => DB.stores.find(s => s.id === id);

function storeName(id) {
  const s = storeById(id);
  return s ? s.name : id;
}

function toDisplay(price, cur) {
  const r = DB.settings.rates[cur];
  if (!r || !isFinite(price)) return null;
  return price * r;
}

function fmt(amount, cur) {
  if (amount == null || !isFinite(amount)) return '—';
  const dp = amount < 10 ? 2 : 0;
  return `${cur} ${amount.toLocaleString('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp })}`;
}

function pricesFor(cid) {
  return DB.prices.filter(p => p.cid === cid);
}

function daysAgo(d) {
  if (!d) return '';
  const diff = Math.floor((Date.now() - new Date(d + 'T00:00:00').getTime()) / 86400000);
  if (isNaN(diff)) return '';
  if (diff <= 0) return 'today';
  if (diff === 1) return '1d ago';
  if (diff < 30) return diff + 'd ago';
  if (diff < 365) return Math.floor(diff / 30) + 'mo ago';
  return Math.floor(diff / 365) + 'y ago';
}

/* ============================ search ============================ */
function score(c, q) {
  if (!q) return 1;
  const nq = norm(q);
  const np = norm(c.part), nn = norm(c.name), nt = norm(c.tags), nc = norm(c.cat);
  let s = 0;
  if (np === nq) s += 120;
  else if (np.startsWith(nq)) s += 85;
  else if (np.includes(nq)) s += 60;
  if (nn.includes(nq)) s += 35;
  if (nt.includes(nq)) s += 22;
  if (nc.includes(nq)) s += 12;
  // every word must land somewhere, for multi-word queries
  const words = q.toLowerCase().split(/\s+/).filter(Boolean).map(norm).filter(Boolean);
  if (words.length > 1) {
    const hay = np + ' ' + nn + ' ' + nt + ' ' + nc;
    const hit = words.filter(w => hay.includes(w)).length;
    if (hit === words.length) s += 45;
    else if (hit === 0) s = 0;
  }
  return s;
}

function currentQuery() { return $('#q').value.trim(); }

function cheapest(cid, storeFilter) {
  let best = null;
  pricesFor(cid).forEach(p => {
    if (storeFilter && p.store !== storeFilter) return;
    const d = toDisplay(p.price, p.cur);
    if (d == null) return;
    if (!best || d < best.disp) best = { disp: d, p };
  });
  return best;
}

/* ============================ render ============================ */
function render() {
  const q = currentQuery();
  const cat = $('#fCat').value;
  const store = $('#fStore').value;
  const sort = $('#fSort').value;
  const stockOnly = $('#fStock').checked;
  const pricedOnly = $('#fPriced').checked;

  const idle = !q && !cat && !store && !stockOnly && !pricedOnly;

  let list = DB.components.map(c => ({ c, s: score(c, q) })).filter(x => x.s > 0);
  if (cat) list = list.filter(x => x.c.cat === cat);

  // With nothing typed, show the parts you actually track rather than the whole catalogue.
  const tracked = idle && !browseAll;
  if (tracked) list = list.filter(x => pricesFor(x.c.id).length);

  if (store) list = list.filter(x => pricesFor(x.c.id).some(p => p.store === store));
  if (stockOnly) list = list.filter(x => pricesFor(x.c.id).some(p => p.stock === 'in' && (!store || p.store === store)));
  if (pricedOnly) list = list.filter(x => cheapest(x.c.id, store));

  list.forEach(x => { x.best = cheapest(x.c.id, store); });

  if (sort === 'az') list.sort((a, b) => a.c.part.localeCompare(b.c.part));
  else if (sort === 'cheap' || sort === 'expensive') {
    list.sort((a, b) => {
      const av = a.best ? a.best.disp : Infinity, bv = b.best ? b.best.disp : Infinity;
      return sort === 'cheap' ? av - bv : (bv === Infinity ? -1 : av === Infinity ? 1 : bv - av);
    });
  } else list.sort((a, b) => b.s - a.s || a.c.part.localeCompare(b.c.part));

  // live store links
  const box = $('#liveBox');
  if (q) {
    $('#liveQ').textContent = q;
    $('#liveLinks').innerHTML = DB.stores.filter(s => s.enabled)
      .map(s => `<a href="${esc(s.url.replace('{q}', encodeURIComponent(q)))}" target="_blank" rel="noopener noreferrer">${esc(s.name)}</a>`)
      .join('');
    box.hidden = false;
  } else box.hidden = true;

  $('#count').innerHTML = `<b>${list.length}</b> of <b>${DB.components.length}</b> parts`;

  const res = $('#results');
  if (!list.length) {
    res.innerHTML = tracked
      ? `<div class="empty">
          <h3>No prices saved yet</h3>
          <p>Search a part above, open a store link to see what it costs today, then record the price here so you can compare next time.</p>
          <button class="btn btn-solid" onclick="showAll()">Browse all ${DB.components.length} parts</button>
        </div>`
      : `<div class="empty">
          <h3>Nothing in the catalogue matches that</h3>
          <p>The store links above still search the real shops. Or add this part to your own catalogue so you can track its price.</p>
          <button class="btn btn-solid" onclick="openComponent(null)">Add ${q ? '&ldquo;' + esc(q) + '&rdquo;' : 'a component'}</button>
        </div>`;
    return;
  }

  const lead = tracked
    ? `<div class="lead">Parts you have prices for.
         <button class="btn btn-sm btn-ghost" onclick="showAll()">Browse all ${DB.components.length}</button></div>`
    : browseAll && idle
      ? `<div class="lead">Whole catalogue, alphabetical.
           <button class="btn btn-sm btn-ghost" onclick="showTracked()">Back to my parts</button></div>`
      : '';

  const disp = DB.settings.display;
  res.innerHTML = lead + list.slice(0, 120).map(({ c, best }) => {
    let rows = pricesFor(c.id);
    if (store) rows = rows.filter(p => p.store === store);
    rows.sort((a, b) => (toDisplay(a.price, a.cur) ?? 1e18) - (toDisplay(b.price, b.cur) ?? 1e18));

    const priceHtml = rows.length ? rows.map(p => {
      const d = toDisplay(p.price, p.cur);
      const isBest = best && best.p.id === p.id && rows.length > 1;
      const label = p.url
        ? `<a href="${esc(p.url)}" target="_blank" rel="noopener noreferrer">${esc(storeName(p.store))}</a>`
        : esc(storeName(p.store));
      return `<div class="prow ${isBest ? 'is-best' : ''}">
        <span class="dot ${p.stock === 'in' ? 'in' : p.stock === 'out' ? 'out' : 'unk'}" title="${p.stock === 'in' ? 'In stock' : p.stock === 'out' ? 'Out of stock' : 'Stock unknown'}"></span>
        <span class="store">${label}${p.demo ? ' <span class="pill">sample</span>' : ''}${p.variant ? ` <span class="pill" title="This listing is a different bundle or quantity, so its price is not directly comparable">${esc(p.variant)}</span>` : ''}</span>
        <span class="when">${esc(daysAgo(p.date))}</span>
        <span class="amt">${esc(fmt(p.price, p.cur))}</span>
        <span class="conv">${p.cur === disp ? '' : '≈ ' + esc(fmt(d, disp))}</span>
        <span class="rowacts">
          <button class="iconbtn" onclick="openPrice('${c.id}','${p.id}')" title="Edit price">edit</button>
          <button class="iconbtn" onclick="delPrice('${p.id}')" title="Delete price">del</button>
        </span>
      </div>`;
    }).join('') : `<div class="noprice">No price saved &middot;
        <button class="linkbtn" onclick="openPrice('${c.id}',null)">record one</button></div>`;

    return `<article class="strip">
      <div class="strip-head">
        <div class="strip-title">
          <div class="pn">${esc(c.part)}</div>
          <div class="nm">${esc(c.name)}</div>
          <div class="meta">
            ${c.cat ? `<span class="tag">${esc(c.cat)}</span>` : ''}
            ${c.pkg ? `<span class="tag">${esc(c.pkg)}</span>` : ''}
            <button class="iconbtn" onclick="openComponent('${c.id}')">edit part</button>
            <button class="iconbtn" onclick="openPrice('${c.id}',null)">+ price</button>
          </div>
        </div>
        <div class="best">
          ${best
            ? `<div class="amt">${esc(fmt(best.disp, disp))}</div><div class="lbl">cheapest saved</div>`
            : `<div class="none">no price saved</div>`}
        </div>
      </div>
      <div class="prices">${priceHtml}</div>
    </article>`;
  }).join('') + (list.length > 120 ? `<p class="stat">Showing first 120. Narrow the search to see the rest.</p>` : '');
}

function refreshFilters() {
  const cats = Array.from(new Set(DB.components.map(c => c.cat).filter(Boolean))).sort();
  const cur = $('#fCat').value;
  $('#fCat').innerHTML = '<option value="">All</option>' + cats.map(c => `<option>${esc(c)}</option>`).join('');
  $('#fCat').value = cats.includes(cur) ? cur : '';

  const curS = $('#fStore').value;
  $('#fStore').innerHTML = '<option value="">All</option>' +
    DB.stores.map(s => `<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('');
  $('#fStore').value = DB.stores.some(s => s.id === curS) ? curS : '';

  $('#demoBanner').hidden = !DB.prices.some(p => p.demo);
}

/* ============================ modals ============================ */
function closeModal() { $('#scrim').classList.remove('open'); $('#modal').innerHTML = ''; }
function showModal(html) {
  $('#modal').innerHTML = html;
  $('#scrim').classList.add('open');
  const first = $('#modal input, #modal select, #modal textarea');
  if (first) setTimeout(() => first.focus(), 40);
}

function openComponent(id) {
  const c = id ? DB.components.find(x => x.id === id) : null;
  editingComponent = c;
  const cats = Array.from(new Set(DB.components.map(x => x.cat).filter(Boolean))).sort();
  showModal(`
    <div class="modal-head"><h2>${c ? 'Edit component' : 'Add component'}</h2>
      <button class="x" onclick="closeModal()" aria-label="Close">&times;</button></div>
    <div class="modal-body">
      <div class="err" id="cErr"></div>
      <div class="f"><label for="cPart">Part number</label>
        <input id="cPart" class="mono" value="${esc(c ? c.part : currentQuery())}" placeholder="e.g. ATmega328P-PU"></div>
      <div class="f"><label for="cName">Description</label>
        <input id="cName" value="${esc(c ? c.name : '')}" placeholder="What it is, in plain words"></div>
      <div class="f2">
        <div class="f"><label for="cCat">Category</label>
          <input id="cCat" list="catList" value="${esc(c ? c.cat : '')}" placeholder="Sensors">
          <datalist id="catList">${cats.map(x => `<option>${esc(x)}</option>`).join('')}</datalist></div>
        <div class="f"><label for="cPkg">Package</label>
          <input id="cPkg" value="${esc(c ? c.pkg : '')}" placeholder="DIP-8"></div>
      </div>
      <div class="f"><label for="cTags">Search words</label>
        <input id="cTags" value="${esc(c ? c.tags : '')}" placeholder="alternative names, separated by spaces">
        <div class="hint">Extra words that should find this part.</div></div>
      <div class="f"><label for="cNote">Notes</label>
        <textarea id="cNote" placeholder="Substitutes, pinout reminders, which shop had it last time">${esc(c ? c.note : '')}</textarea></div>
    </div>
    <div class="modal-foot">
      ${c ? `<button class="btn btn-danger" onclick="delComponent('${c.id}')">Delete part</button>` : ''}
      <button class="btn" onclick="closeModal()">Cancel</button>
      <button class="btn btn-solid" onclick="saveComponent()">${c ? 'Save changes' : 'Add component'}</button>
    </div>`);
}

function saveComponent() {
  const part = $('#cPart').value.trim();
  if (!part) { const e = $('#cErr'); e.textContent = 'A part number is required.'; e.classList.add('show'); return; }
  const rec = {
    part,
    name: $('#cName').value.trim(),
    cat: $('#cCat').value.trim(),
    pkg: $('#cPkg').value.trim(),
    tags: $('#cTags').value.trim(),
    note: $('#cNote').value.trim()
  };
  if (editingComponent) Object.assign(editingComponent, rec);
  else DB.components.unshift(Object.assign({ id: uid() }, rec));
  save(); refreshFilters(); render(); closeModal();
  toast(editingComponent ? 'Component saved.' : 'Component added.');
}

function delComponent(id) {
  if (!confirm('Delete this part and every price saved against it?')) return;
  DB.components = DB.components.filter(c => c.id !== id);
  DB.prices = DB.prices.filter(p => p.cid !== id);
  save(); refreshFilters(); render(); closeModal();
  toast('Component deleted.');
}

function openPrice(cid, pid) {
  const c = DB.components.find(x => x.id === cid);
  const p = pid ? DB.prices.find(x => x.id === pid) : null;
  const curs = ['PKR', 'INR', 'USD', 'AED', 'GBP', 'EUR', 'CNY'];
  showModal(`
    <div class="modal-head"><h2>${p ? 'Edit price' : 'Record a price'}</h2>
      <button class="x" onclick="closeModal()" aria-label="Close">&times;</button></div>
    <div class="modal-body">
      <div class="stat">${esc(c.part)} — ${esc(c.name)}</div>
      <div class="err" id="pErr"></div>
      <div class="f"><label for="pStore">Store</label>
        <select id="pStore">${DB.stores.map(s =>
          `<option value="${esc(s.id)}" data-cur="${esc(s.currency)}" ${p && p.store === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></div>
      <div class="f2">
        <div class="f"><label for="pPrice">Price</label>
          <input id="pPrice" class="mono" type="number" step="0.01" min="0" value="${p ? p.price : ''}" placeholder="0.00"></div>
        <div class="f"><label for="pCur">Currency</label>
          <select id="pCur">${curs.map(x => `<option ${p && p.cur === x ? 'selected' : ''}>${x}</option>`).join('')}</select></div>
      </div>
      <div class="f2">
        <div class="f"><label for="pStock">Stock</label>
          <select id="pStock">
            <option value="in"  ${p && p.stock === 'in' ? 'selected' : ''}>In stock</option>
            <option value="out" ${p && p.stock === 'out' ? 'selected' : ''}>Out of stock</option>
            <option value="unk" ${!p || p.stock === 'unk' ? 'selected' : ''}>Not sure</option>
          </select></div>
        <div class="f"><label for="pDate">Checked on</label>
          <input id="pDate" type="date" value="${p ? esc(p.date) : today()}"></div>
      </div>
      <div class="f"><label for="pUrl">Link to the product page</label>
        <input id="pUrl" class="mono" value="${p ? esc(p.url) : ''}" placeholder="https://">
        <div class="hint">Optional, but it saves you hunting for the listing next time.</div></div>
    </div>
    <div class="modal-foot">
      ${p ? `<button class="btn btn-danger" onclick="delPrice('${p.id}',true)">Delete</button>` : ''}
      <button class="btn" onclick="closeModal()">Cancel</button>
      <button class="btn btn-solid" onclick="savePrice('${cid}','${pid || ''}')">Save price</button>
    </div>`);

  if (!p) {
    const sel = $('#pStore');
    const sync = () => { $('#pCur').value = sel.selectedOptions[0].dataset.cur || 'PKR'; };
    sel.addEventListener('change', sync); sync();
  }
}

function savePrice(cid, pid) {
  const price = parseFloat($('#pPrice').value);
  if (!isFinite(price) || price < 0) {
    const e = $('#pErr'); e.textContent = 'Enter a price as a number.'; e.classList.add('show'); return;
  }
  const rec = {
    cid, store: $('#pStore').value, price,
    cur: $('#pCur').value, stock: $('#pStock').value,
    date: $('#pDate').value || today(), url: $('#pUrl').value.trim(), demo: false
  };
  const ex = pid ? DB.prices.find(x => x.id === pid) : null;
  if (ex) Object.assign(ex, rec);
  else DB.prices.push(Object.assign({ id: uid() }, rec));
  save(); refreshFilters(); render(); closeModal();
  toast('Price saved.');
}

function delPrice(id, fromModal) {
  DB.prices = DB.prices.filter(p => p.id !== id);
  save(); refreshFilters(); render();
  if (fromModal) closeModal();
  toast('Price removed.');
}

/* ============================ manage data ============================ */
function openManage(tab) {
  tab = tab || 'stores';
  showModal(`
    <div class="modal-head"><h2>Manage data</h2>
      <button class="x" onclick="closeModal()" aria-label="Close">&times;</button></div>
    <div class="modal-body">
      <div class="tabs">
        <button class="${tab === 'stores' ? 'on' : ''}" onclick="openManage('stores')">Stores</button>
        <button class="${tab === 'backup' ? 'on' : ''}" onclick="openManage('backup')">Backup</button>
        <button class="${tab === 'cloud' ? 'on' : ''}" onclick="openManage('cloud')">Shared database</button>
      </div>
      <div id="pane"></div>
    </div>
    <div class="modal-foot"><button class="btn" onclick="closeModal()">Done</button></div>`);
  $('#pane').innerHTML = tab === 'stores' ? paneStores() : tab === 'backup' ? paneBackup() : paneCloud();
  if (tab === 'backup') wireBackup();
}

function paneStores() {
  return `<div class="stat">${DB.stores.filter(s => s.enabled).length} of ${DB.stores.length} stores shown in live search.</div>
    ${DB.stores.map(s => `<div class="mrow">
      <label class="sw"><input type="checkbox" ${s.enabled ? 'checked' : ''} onchange="toggleStore('${s.id}',this.checked)"></label>
      <span class="nmwrap"><b>${esc(s.name)}</b> <span class="pill">${esc(s.currency)}</span>
        <span class="sub">${esc(s.url)}</span></span>
      <button class="btn btn-sm" onclick="openStore('${s.id}')">Edit</button>
    </div>`).join('')}
    <div style="margin-top:14px"><button class="btn btn-solid btn-sm" onclick="openStore(null)">Add a store</button></div>
    <p class="hint" style="margin-top:12px;font-size:12px;color:var(--ink-faint)">
      A link that lands on the wrong page just needs its address fixed here. Copy a real search URL from the shop and swap the search term for <code>{q}</code>.</p>`;
}

function toggleStore(id, on) { const s = storeById(id); if (s) { s.enabled = on; save(); render(); } }

function openStore(id) {
  const s = id ? storeById(id) : null;
  showModal(`
    <div class="modal-head"><h2>${s ? 'Edit store' : 'Add store'}</h2>
      <button class="x" onclick="closeModal()" aria-label="Close">&times;</button></div>
    <div class="modal-body">
      <div class="err" id="sErr"></div>
      <div class="f"><label for="sName">Store name</label>
        <input id="sName" value="${esc(s ? s.name : '')}" placeholder="Hall Road shop"></div>
      <div class="f2">
        <div class="f"><label for="sCountry">Country</label>
          <input id="sCountry" value="${esc(s ? s.country : 'PK')}" placeholder="PK"></div>
        <div class="f"><label for="sCur">Currency</label>
          <select id="sCur">${['PKR','INR','USD','AED','GBP','EUR','CNY'].map(x =>
            `<option ${s && s.currency === x ? 'selected' : ''}>${x}</option>`).join('')}</select></div>
      </div>
      <div class="f"><label for="sUrl">Search address</label>
        <input id="sUrl" class="mono" value="${esc(s ? s.url : 'https://example.com/?s={q}')}">
        <div class="hint">Put <code>{q}</code> where the search term goes.</div></div>
    </div>
    <div class="modal-foot">
      ${s ? `<button class="btn btn-danger" onclick="delStore('${s.id}')">Delete</button>` : ''}
      <button class="btn" onclick="openManage('stores')">Back</button>
      <button class="btn btn-solid" onclick="saveStore('${id || ''}')">Save store</button>
    </div>`);
}

function saveStore(id) {
  const name = $('#sName').value.trim(), url = $('#sUrl').value.trim();
  const e = $('#sErr');
  if (!name) { e.textContent = 'Give the store a name.'; e.classList.add('show'); return; }
  if (!url.includes('{q}')) { e.textContent = 'The address needs {q} where the search term goes.'; e.classList.add('show'); return; }
  const rec = { name, url, country: $('#sCountry').value.trim(), currency: $('#sCur').value, enabled: true };
  const ex = id ? storeById(id) : null;
  if (ex) Object.assign(ex, rec); else DB.stores.push(Object.assign({ id: uid() }, rec));
  save(); refreshFilters(); render(); openManage('stores');
  toast('Store saved.');
}

function delStore(id) {
  const used = DB.prices.filter(p => p.store === id).length;
  if (!confirm(used ? `${used} saved price(s) point at this store and will lose their label. Delete anyway?` : 'Delete this store?')) return;
  DB.stores = DB.stores.filter(s => s.id !== id);
  save(); refreshFilters(); render(); openManage('stores');
  toast('Store deleted.');
}

function paneBackup() {
  return `<div class="stat">${DB.components.length} components · ${DB.prices.length} prices · ${DB.stores.length} stores</div>
    <div class="f"><label>Save a copy</label>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-sm" onclick="exportJSON()">Download JSON</button>
        <button class="btn btn-sm" onclick="exportCSV()">Download prices CSV</button>
      </div>
      <div class="hint">JSON restores everything. CSV opens in Excel or Sheets for bulk price editing.</div></div>
    <div class="f"><label for="impFile">Load a file back in</label>
      <input id="impFile" type="file" accept=".json,.csv">
      <div class="hint">JSON replaces everything. CSV adds or updates prices, keeping your catalogue.</div></div>
    <div class="f"><label>Start over</label>
      <button class="btn btn-sm btn-danger" onclick="resetAll()">Reset to the built-in catalogue</button>
      <div class="hint">Wipes your prices and edits. Download a backup first.</div></div>`;
}

function wireBackup() {
  const f = $('#impFile');
  if (f) f.addEventListener('change', e => {
    const file = e.target.files[0]; if (!file) return;
    const r = new FileReader();
    r.onload = () => file.name.toLowerCase().endsWith('.csv') ? importCSV(r.result) : importJSON(r.result);
    r.readAsText(file);
  });
}

function download(name, text, type) {
  const b = new Blob([text], { type: type || 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(b); a.download = name;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

function exportJSON() { download(`parts-bin-${today()}.json`, JSON.stringify(DB, null, 2), 'application/json'); toast('Backup downloaded.'); }

function csvCell(v) { const s = String(v == null ? '' : v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }

function exportCSV() {
  const head = ['part', 'component_name', 'category', 'store', 'price', 'currency', 'stock', 'date', 'url'];
  const rows = DB.prices.map(p => {
    const c = DB.components.find(x => x.id === p.cid) || {};
    return [c.part, c.name, c.cat, storeName(p.store), p.price, p.cur, p.stock, p.date, p.url];
  });
  download(`parts-bin-prices-${today()}.csv`,
    [head, ...rows].map(r => r.map(csvCell).join(',')).join('\n'), 'text/csv;charset=utf-8');
  toast('CSV downloaded.');
}

function parseCSV(text) {
  const rows = []; let row = [], cell = '', qt = false;
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (qt) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') qt = false;
      else cell += ch;
    } else if (ch === '"') qt = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(c => c.trim() !== ''));
}

function importCSV(text) {
  const rows = parseCSV(text);
  if (rows.length < 2) return toast('That CSV had no rows to read.');
  const head = rows[0].map(h => h.trim().toLowerCase());
  const col = n => head.indexOf(n);
  const iPart = col('part'), iStore = col('store'), iPrice = col('price');
  if (iPart < 0 || iStore < 0 || iPrice < 0)
    return toast('The CSV needs part, store and price columns.');

  let added = 0, updated = 0, newParts = 0;
  rows.slice(1).forEach(r => {
    const partNo = (r[iPart] || '').trim();
    const price = parseFloat(r[iPrice]);
    if (!partNo || !isFinite(price)) return;

    let c = DB.components.find(x => norm(x.part) === norm(partNo));
    if (!c) {
      c = { id: uid(), part: partNo, name: (r[col('component_name')] || '').trim(),
            cat: (r[col('category')] || '').trim(), pkg: '', tags: '', note: '' };
      DB.components.push(c); newParts++;
    }
    const sName = (r[iStore] || '').trim();
    let st = DB.stores.find(s => norm(s.name) === norm(sName) || s.id === sName);
    if (!st) { st = { id: uid(), name: sName, country: '', currency: (r[col('currency')] || 'PKR').trim() || 'PKR',
                      url: 'https://example.com/?s={q}', enabled: false }; DB.stores.push(st); }

    const rec = { cid: c.id, store: st.id, price,
      cur: (r[col('currency')] || st.currency || 'PKR').trim().toUpperCase(),
      stock: (r[col('stock')] || 'unk').trim().toLowerCase(),
      date: (r[col('date')] || today()).trim(), url: (r[col('url')] || '').trim(), demo: false };
    if (!['in', 'out', 'unk'].includes(rec.stock)) rec.stock = 'unk';

    const ex = DB.prices.find(p => p.cid === c.id && p.store === st.id);
    if (ex) { Object.assign(ex, rec); updated++; } else { DB.prices.push(Object.assign({ id: uid() }, rec)); added++; }
  });
  save(); refreshFilters(); render(); closeModal();
  toast(`${added} price(s) added, ${updated} updated, ${newParts} new part(s).`);
}

function importJSON(text) {
  try {
    const d = JSON.parse(text);
    if (!d || !Array.isArray(d.components)) throw new Error('shape');
    if (!confirm('This replaces everything currently saved. Continue?')) return;
    DB = d;
    DB.prices = DB.prices || []; DB.stores = DB.stores || SEED_STORES.map(s => ({ ...s }));
    DB.settings = DB.settings || { display: 'PKR', rates: { PKR: 1 } };
    save(); refreshFilters(); render(); closeModal();
    toast('Backup restored.');
  } catch (e) {
    toast('That file is not a Parts Bin backup.');
  }
}

function resetAll() {
  if (!confirm('Reset everything to the built-in catalogue? Your prices will be gone.')) return;
  DB = freshDB(); save(); refreshFilters(); render(); closeModal();
  toast('Reset done.');
}

function clearDemo() {
  DB.prices = DB.prices.filter(p => !p.demo);
  save(); refreshFilters(); render();
  toast('Sample prices cleared.');
}

/* ============================ shared database (Supabase) ============================ */
function paneCloud() {
  const cfg = DB.settings.supabase || {};
  return `<p style="font-size:13.5px;color:var(--ink-soft);margin-top:0">
      By default everything stays in this browser only. Connect a free Supabase project and your catalogue
      syncs across your phone, laptop and anyone else you share the link with. Setup steps are in the README.</p>
    <div class="f"><label for="sbUrl">Project URL</label>
      <input id="sbUrl" class="mono" value="${esc(cfg.url || '')}" placeholder="https://xxxx.supabase.co"></div>
    <div class="f"><label for="sbKey">Anon public key</label>
      <input id="sbKey" class="mono" value="${esc(cfg.key || '')}" placeholder="eyJhbGciOi...">
      <div class="hint">The anon key is meant to be public, but anyone with your site link can then write to the tables. Keep it to data you don't mind sharing.</div></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn btn-sm" onclick="saveCloud()">Save connection</button>
      <button class="btn btn-sm" onclick="cloudPush()">Upload my data</button>
      <button class="btn btn-sm" onclick="cloudPull()">Download shared data</button>
    </div>
    <div class="stat" id="cloudStat" style="margin-top:12px"></div>`;
}

function saveCloud() {
  DB.settings.supabase = { url: $('#sbUrl').value.trim().replace(/\/$/, ''), key: $('#sbKey').value.trim() };
  save(); toast('Connection saved.');
}

function sbHeaders() {
  const c = DB.settings.supabase || {};
  return { apikey: c.key, Authorization: 'Bearer ' + c.key, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates' };
}

async function cloudPush() {
  const c = DB.settings.supabase || {};
  if (!c.url || !c.key) return toast('Add the project URL and key first.');
  const stat = $('#cloudStat'); stat.textContent = 'Uploading…';
  try {
    const put = async (table, rows) => {
      if (!rows.length) return;
      const r = await fetch(`${c.url}/rest/v1/${table}`, { method: 'POST', headers: sbHeaders(), body: JSON.stringify(rows) });
      if (!r.ok) throw new Error(`${table}: ${r.status} ${await r.text()}`);
    };
    await put('stores', DB.stores.map(s => ({ id: s.id, name: s.name, country: s.country, currency: s.currency, search_url: s.url, enabled: s.enabled })));
    await put('components', DB.components.map(x => ({ id: x.id, part_no: x.part, name: x.name, category: x.cat, package: x.pkg, tags: x.tags, notes: x.note })));
    await put('prices', DB.prices.filter(p => !p.demo).map(p => ({ id: p.id, component_id: p.cid, store_id: p.store, price: p.price, currency: p.cur, stock: p.stock, url: p.url, checked_on: p.date })));
    stat.textContent = 'Uploaded.'; toast('Data uploaded.');
  } catch (e) { stat.textContent = 'Upload failed — ' + e.message; }
}

async function cloudPull() {
  const c = DB.settings.supabase || {};
  if (!c.url || !c.key) return toast('Add the project URL and key first.');
  const stat = $('#cloudStat'); stat.textContent = 'Downloading…';
  try {
    const get = async t => {
      const r = await fetch(`${c.url}/rest/v1/${t}?select=*`, { headers: { apikey: c.key, Authorization: 'Bearer ' + c.key } });
      if (!r.ok) throw new Error(`${t}: ${r.status}`);
      return r.json();
    };
    const [st, co, pr] = await Promise.all([get('stores'), get('components'), get('prices')]);
    if (!confirm('Replace what is in this browser with the shared data?')) { stat.textContent = ''; return; }
    if (st.length) DB.stores = st.map(s => ({ id: s.id, name: s.name, country: s.country, currency: s.currency, url: s.search_url, enabled: s.enabled !== false }));
    if (co.length) DB.components = co.map(x => ({ id: x.id, part: x.part_no, name: x.name, cat: x.category, pkg: x.package, tags: x.tags, note: x.notes }));
    DB.prices = pr.map(p => ({ id: p.id, cid: p.component_id, store: p.store_id, price: Number(p.price), cur: p.currency, stock: p.stock, url: p.url, date: (p.checked_on || '').slice(0, 10), demo: false }));
    save(); refreshFilters(); render();
    stat.textContent = `Loaded ${co.length} components and ${pr.length} prices.`;
    toast('Shared data loaded.');
  } catch (e) { stat.textContent = 'Download failed — ' + e.message; }
}

/* ============================ settings ============================ */
function openSettings() {
  const r = DB.settings.rates;
  const curs = ['PKR', 'INR', 'USD', 'AED', 'GBP', 'EUR', 'CNY'];
  showModal(`
    <div class="modal-head"><h2>Settings</h2>
      <button class="x" onclick="closeModal()" aria-label="Close">&times;</button></div>
    <div class="modal-body">
      <div class="f"><label for="setDisp">Compare prices in</label>
        <select id="setDisp">${curs.map(x => `<option ${DB.settings.display === x ? 'selected' : ''}>${x}</option>`).join('')}</select>
        <div class="hint">Prices from other currencies are converted to this one so “cheapest” means something.</div></div>
      <div class="f"><label>Conversion rates</label>
        <div class="hint" style="margin:0 0 8px">How much one unit of each currency is worth in your comparison currency. These start as rough placeholders — put in today's real rates.</div>
        ${curs.map(x => `<div class="mrow"><span class="nmwrap mono">1 ${x} =</span>
          <input class="mono" style="width:130px;padding:6px 8px;border:1px solid var(--line);border-radius:3px"
                 type="number" step="0.0001" min="0" id="rate_${x}" value="${r[x] != null ? r[x] : ''}"></div>`).join('')}
      </div>
    </div>
    <div class="modal-foot">
      <button class="btn" onclick="closeModal()">Cancel</button>
      <button class="btn btn-solid" onclick="saveSettings()">Save settings</button>
    </div>`);
}

function saveSettings() {
  DB.settings.display = $('#setDisp').value;
  ['PKR', 'INR', 'USD', 'AED', 'GBP', 'EUR', 'CNY'].forEach(x => {
    const v = parseFloat($('#rate_' + x).value);
    if (isFinite(v) && v > 0) DB.settings.rates[x] = v;
  });
  save(); render(); closeModal();
  toast('Settings saved.');
}

/* ============================ repo price file ============================ */
/* If data/prices.json exists (e.g. written by the scraper action), merge it in once. */
async function loadRepoPrices() {
  try {
    const r = await fetch('data/prices.json', { cache: 'no-store' });
    if (!r.ok) return;
    const rows = await r.json();
    if (!Array.isArray(rows) || !rows.length) return;
    let n = 0;
    rows.forEach(row => {
      const c = DB.components.find(x => norm(x.part) === norm(row.part));
      if (!c) return;
      const st = DB.stores.find(s => norm(s.name) === norm(row.store) || s.id === row.store);
      if (!st) return;
      const ex = DB.prices.find(p => p.cid === c.id && p.store === st.id);
      const rec = { cid: c.id, store: st.id, price: Number(row.price), cur: row.currency || st.currency,
                    stock: row.stock || 'unk', url: row.url || '', date: (row.date || today()).slice(0, 10),
                    variant: row.variant || '', demo: false };
      if (!isFinite(rec.price)) return;
      if (ex) Object.assign(ex, rec); else DB.prices.push(Object.assign({ id: uid() }, rec));
      n++;
    });
    if (n) { save(); render(); toast(`${n} price(s) loaded from the repo file.`); }
  } catch (e) { /* file:// or no file — fine */ }
}

/* ============================ boot ============================ */
function showAll() { browseAll = true; render(); }
function showTracked() { browseAll = false; render(); }

let tmr;
function onSearch() { browseAll = false; clearTimeout(tmr); tmr = setTimeout(render, 110); }

function init() {
  DB = load();
  refreshFilters();
  render();

  $('#q').addEventListener('input', onSearch);
  $('#btnClearQ').addEventListener('click', () => { $('#q').value = ''; $('#q').focus(); render(); });
  ['#fCat', '#fStore', '#fSort', '#fStock', '#fPriced'].forEach(s => $(s).addEventListener('change', render));
  $$('.chipsug').forEach(b => b.addEventListener('click', () => { $('#q').value = b.textContent; render(); $('#q').focus(); }));
  $('#btnManage').addEventListener('click', () => openManage('stores'));
  $('#btnSettings').addEventListener('click', openSettings);
  $('#btnClearDemo').addEventListener('click', clearDemo);
  $('#scrim').addEventListener('mousedown', e => { if (e.target.id === 'scrim') closeModal(); });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeModal();
    if (e.key === '/' && document.activeElement !== $('#q') && !$('#scrim').classList.contains('open')) {
      e.preventDefault(); $('#q').focus();
    }
  });

  loadRepoPrices();
}

document.addEventListener('DOMContentLoaded', init);
