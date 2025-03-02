// config.js - Файл конфигурации приложения
require('dotenv').config();

module.exports = {
  // Общие настройки
  PORT: process.env.PORT || 3000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  
  // Настройки базы данных
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/telegram-shop',
  
  // Настройки Telegram бота
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
  ADMIN_SECRET_CODE: process.env.ADMIN_SECRET_CODE || 'admin123',
  
  // Настройки Yandex Disk
  YANDEX_DISK_TOKEN: process.env.YANDEX_DISK_TOKEN,
  YANDEX_DISK_FOLDER: process.env.YANDEX_DISK_FOLDER || 'telegram-shop',
  
  // Настройки ЮMoney
  YOOMONEY_WALLET: process.env.YOOMONEY_WALLET,
  YOOMONEY_SECRET_KEY: process.env.YOOMONEY_SECRET_KEY,
  
  // Настройки веб-приложения
  APP_URL: process.env.APP_URL || 'http://localhost:3000',
  
  // Настройки JWT
  JWT_SECRET: process.env.JWT_SECRET || 'your-secret-key',
  JWT_EXPIRATION: process.env.JWT_EXPIRATION || '7d',
  
  // Настройки cors
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
  
  // Настройки Redis (для сессий и кеширования)
  REDIS_URL: process.env.REDIS_URL,
  
  // Флаги функциональности
  ENABLE_OZON_IMPORT: process.env.ENABLE_OZON_IMPORT === 'true' || true,
  ENABLE_PAYMENT: process.env.ENABLE_PAYMENT === 'true' || true,
};
