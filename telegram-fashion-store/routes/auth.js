// routes/auth.js - Маршруты аутентификации
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const config = require('../config');
const AdminModel = require('../models/admin');
const UserModel = require('../models/user');

// Middleware для проверки авторизации
const authMiddleware = async (req, res, next) => {
  try {
    // Получаем токен из заголовка
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ success: false, error: 'Требуется авторизация' });
    }
    
    // Проверяем токен
    const decoded = jwt.verify(token, config.JWT_SECRET);
    
    // Проверяем, существует ли пользователь или админ
    let user;
    
    if (decoded.role) {
      // Если есть роль, ищем среди админов
      user = await AdminModel.findById(decoded.id);
      
      if (!user || !user.isActive) {
        return res.status(401).json({ success: false, error: 'Администратор не найден или деактивирован' });
      }
      
      req.admin = user;
    } else {
      // Иначе ищем среди обычных пользователей
      user = await UserModel.findById(decoded.id);
      
      if (!user) {
        return res.status(401).json({ success: false, error: 'Пользователь не найден' });
      }
      
      req.user = user;
    }
    
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, error: 'Недействительный или просроченный токен' });
    }
    
    next(error);
  }
};

// Middleware для проверки прав администратора
const adminMiddleware = async (req, res, next) => {
  try {
    // Получаем токен из заголовка
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ success: false, error: 'Требуется авторизация' });
    }
    
    // Проверяем токен
    const decoded = jwt.verify(token, config.JWT_SECRET);
    
    // Проверяем наличие роли администратора
    if (!decoded.role || !['admin', 'superadmin'].includes(decoded.role)) {
      return res.status(403).json({ success: false, error: 'Нет доступа. Требуются права администратора' });
    }
    
    // Проверяем существование администратора
    const admin = await AdminModel.findById(decoded.id);
    
    if (!admin || !admin.isActive) {
      return res.status(401).json({ success: false, error: 'Администратор не найден или деактивирован' });
    }
    
    // Обновляем время последнего входа
    admin.lastLogin = Date.now();
    await admin.save();
    
    req.admin = admin;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, error: 'Недействительный или просроченный токен' });
    }
    
    next(error);
  }
};

// Авторизация администратора через Telegram ID
router.post('/admin/telegram', async (req, res, next) => {
  try {
    const { telegramId } = req.body;
    
    if (!telegramId) {
      return res.status(400).json({ success: false, error: 'Требуется Telegram ID' });
    }
    
    // Ищем администратора по Telegram ID
    const admin = await AdminModel.findOne({ telegramId, isActive: true });
    
    if (!admin) {
      return res.status(401).json({ success: false, error: 'Администратор не найден или деактивирован' });
    }
    
    // Генерируем JWT токен
    const token = admin.generateJWT();
    
    // Обновляем время последнего входа
    admin.lastLogin = Date.now();
    await admin.save();
    
    res.json({
      success: true,
      token,
      admin: {
        id: admin._id,
        telegramId: admin.telegramId,
        username: admin.username,
        role: admin.role,
        permissions: admin.permissions
      }
    });
  } catch (error) {
    next(error);
  }
});

// Авторизация администратора через email и пароль
router.post('/admin/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email и пароль обязательны' });
    }
    
    // Ищем администратора по email
    const admin = await AdminModel.findOne({ email }).select('+password');
    
    if (!admin || !admin.isActive) {
      return res.status(401).json({ success: false, error: 'Администратор не найден или деактивирован' });
    }
    
    // Проверяем пароль
    const isPasswordValid = await admin.comparePassword(password);
    
    if (!isPasswordValid) {
      return res.status(401).json({ success: false, error: 'Неверный пароль' });
    }
    
    // Генерируем JWT токен
    const token = admin.generateJWT();
    
    // Обновляем время последнего входа
    admin.lastLogin = Date.now();
    await admin.save();
    
    res.json({
      success: true,
      token,
      admin: {
        id: admin._id,
        telegramId: admin.telegramId,
        username: admin.username,
        email: admin.email,
        role: admin.role,
        permissions: admin.permissions
      }
    });
  } catch (error) {
    next(error);
  }
});

// Авторизация пользователя через Telegram ID
router.post('/user/telegram', async (req, res, next) => {
  try {
    const { telegramId, username, firstName, lastName } = req.body;
    
    if (!telegramId) {
      return res.status(400).json({ success: false, error: 'Требуется Telegram ID' });
    }
    
    // Ищем пользователя по Telegram ID или создаем нового
    let user = await UserModel.findOne({ telegramId });
    
    if (!user) {
      // Создаем нового пользователя
      user = new UserModel({
        telegramId,
        username: username || `user_${telegramId}`,
        firstName,
        lastName
      });
      
      await user.save();
    } else {
      // Обновляем информацию о пользователе
      if (username) user.username = username;
      if (firstName) user.firstName = firstName;
      if (lastName) user.lastName = lastName;
      
      user.lastActivity = Date.now();
      await user.save();
    }
    
    // Генерируем JWT токен
    const token = user.generateJWT();
    
    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        telegramId: user.telegramId,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName
      }
    });
  } catch (error) {
    next(error);
  }
});

// Получение информации о текущем пользователе
router.get('/me', authMiddleware, (req, res) => {
  if (req.admin) {
    // Если авторизован администратор
    const admin = req.admin;
    
    res.json({
      success: true,
      user: {
        id: admin._id,
        telegramId: admin.telegramId,
        username: admin.username,
        email: admin.email,
        role: admin.role,
        permissions: admin.permissions,
        isAdmin: true
      }
    });
  } else {
    // Если авторизован обычный пользователь
    const user = req.user;
    
    res.json({
      success: true,
      user: {
        id: user._id,
        telegramId: user.telegramId,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        email: user.email,
        addresses: user.addresses,
        isAdmin: false
      }
    });
  }
});

// Обновление профиля пользователя
router.put('/profile', authMiddleware, async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(403).json({ success: false, error: 'Доступно только для пользователей' });
    }
    
    const { firstName, lastName, phone, email } = req.body;
    const user = req.user;
    
    // Обновляем информацию
    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (phone) user.phone = phone;
    if (email) user.email = email;
    
    // Сохраняем изменения
    await user.save();
    
    res.json({
      success: true,
      message: 'Профиль успешно обновлен',
      user: {
        id: user._id,
        telegramId: user.telegramId,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        email: user.email
      }
    });
  } catch (error) {
    next(error);
  }
});

// Добавление адреса пользователя
router.post('/address', authMiddleware, async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(403).json({ success: false, error: 'Доступно только для пользователей' });
    }
    
    const { title, city, street, building, apartment, postalCode, isDefault } = req.body;
    const user = req.user;
    
    // Создаем новый адрес
    const newAddress = {
      title: title || 'Мой адрес',
      city,
      street,
      building,
      apartment,
      postalCode,
      isDefault: isDefault || false
    };
    
    // Если новый адрес устанавливается как основной, сбрасываем флаг isDefault у других адресов
    if (newAddress.isDefault) {
      user.addresses.forEach(addr => {
        addr.isDefault = false;
      });
    }
    
    // Добавляем адрес
    user.addresses.push(newAddress);
    
    // Если это первый адрес, делаем его основным
    if (user.addresses.length === 1) {
      user.addresses[0].isDefault = true;
    }
    
    // Сохраняем изменения
    await user.save();
    
    res.json({
      success: true,
      message: 'Адрес успешно добавлен',
      addresses: user.addresses
    });
  } catch (error) {
    next(error);
  }
});

// Обновление адреса пользователя
router.put('/address/:id', authMiddleware, async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(403).json({ success: false, error: 'Доступно только для пользователей' });
    }
    
    const addressId = req.params.id;
    const { title, city, street, building, apartment, postalCode, isDefault } = req.body;
    const user = req.user;
    
    // Находим адрес для обновления
    const addressIndex = user.addresses.findIndex(addr => addr._id.toString() === addressId);
    
    if (addressIndex === -1) {
      return res.status(404).json({ success: false, error: 'Адрес не найден' });
    }
    
    // Обновляем адрес
    if (title) user.addresses[addressIndex].title = title;
    if (city) user.addresses[addressIndex].city = city;
    if (street) user.addresses[addressIndex].street = street;
    if (building) user.addresses[addressIndex].building = building;
    if (apartment !== undefined) user.addresses[addressIndex].apartment = apartment;
    if (postalCode) user.addresses[addressIndex].postalCode = postalCode;
    
    // Обрабатываем флаг isDefault
    if (isDefault) {
      // Сбрасываем флаг у других адресов
      user.addresses.forEach((addr, index) => {
        addr.isDefault = index === addressIndex;
      });
    }
    
    // Сохраняем изменения
    await user.save();
    
    res.json({
      success: true,
      message: 'Адрес успешно обновлен',
      addresses: user.addresses
    });
  } catch (error) {
    next(error);
  }
});

// Удаление адреса пользователя
router.delete('/address/:id', authMiddleware, async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(403).json({ success: false, error: 'Доступно только для пользователей' });
    }
    
    const addressId = req.params.id;
    const user = req.user;
    
    // Находим адрес для удаления
    const addressIndex = user.addresses.findIndex(addr => addr._id.toString() === addressId);
    
    if (addressIndex === -1) {
      return res.status(404).json({ success: false, error: 'Адрес не найден' });
    }
    
    // Проверяем, был ли это основной адрес
    const wasDefault = user.addresses[addressIndex].isDefault;
    
    // Удаляем адрес
    user.addresses.splice(addressIndex, 1);
    
    // Если удаленный адрес был основным и есть другие адреса, делаем первый адрес основным
    if (wasDefault && user.addresses.length > 0) {
      user.addresses[0].isDefault = true;
    }
    
    // Сохраняем изменения
    await user.save();
    
    res.json({
      success: true,
      message: 'Адрес успешно удален',
      addresses: user.addresses
    });
  } catch (error) {
    next(error);
  }
});

// Экспортируем маршруты и middleware
module.exports = {
  router,
  authMiddleware,
  adminMiddleware
};
