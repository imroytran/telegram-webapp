// server.js - Backend API
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const config = require('./config');

// Подключаем маршруты API
const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const cartRoutes = require('./routes/cart');
const orderRoutes = require('./routes/orders');
const adminRoutes = require('./routes/admin');
const webhookRoutes = require('./routes/webhooks');

// Инициализация Express
const app = express();

// Middleware
app.use(cors({
  origin: config.CORS_ORIGIN,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(helmet()); // Безопасность
app.use(morgan('combined')); // Логирование
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Подключение к MongoDB
mongoose.connect(config.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('MongoDB успешно подключена'))
.catch(err => console.error('Ошибка подключения к MongoDB:', err));

// Маршруты API
//app.use('/api/auth', authRoutes);
//app.use('/api/products', productRoutes);
//app.use('/api/cart', cartRoutes);
//app.use('/api/orders', orderRoutes);
//app.use('/api/admin', adminRoutes);
//app.use('/api/webhooks', webhookRoutes);

// Статические файлы для фронтенда в продакшн режиме
if (config.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'client/build')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
  });
}

// Обработка ошибок
app.use((err, req, res, next) => {
  console.error(err.stack);
  
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Внутренняя ошибка сервера';
  
  res.status(statusCode).json({
    success: false,
    error: message,
    stack: config.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// Запуск сервера
const PORT = config.PORT;
app.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});

// Обработка необработанных исключений и отклоненных промисов
process.on('uncaughtException', (err) => {
  console.error('Необработанное исключение:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Необработанное отклонение промиса:', reason);
});

module.exports = app;
