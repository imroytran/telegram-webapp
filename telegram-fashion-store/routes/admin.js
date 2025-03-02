// routes/admin.js - Маршруты администратора
const express = require('express');
const router = express.Router();
const { adminMiddleware } = require('./auth');
const AdminModel = require('../models/admin');
const ProductModel = require('../models/product');
const OrderModel = require('../models/order');
const UserModel = require('../models/user');
const bcrypt = require('bcryptjs');
const axios = require('axios');
const cheerio = require('cheerio');
const yadiskService = require('../yadisk-service');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });
const path = require('path');

// Получение информации о текущем админе
router.get('/me', adminMiddleware, (req, res) => {
  const admin = req.admin;
  
  res.json({
    success: true,
    admin: {
      id: admin._id,
      telegramId: admin.telegramId,
      username: admin.username,
      email: admin.email,
      role: admin.role,
      permissions: admin.permissions,
      lastLogin: admin.lastLogin
    }
  });
});

// Обновление профиля админа
router.put('/profile', adminMiddleware, async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const admin = req.admin;
    
    if (email) admin.email = email;
    
    if (password) {
      admin.password = password;
    }
    
    await admin.save();
    
    res.json({
      success: true,
      message: 'Профиль администратора успешно обновлен',
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

// Получение списка всех администраторов (только для superadmin)
router.get('/admins', adminMiddleware, async (req, res, next) => {
  try {
    // Проверяем, что текущий админ имеет роль superadmin
    if (req.admin.role !== 'superadmin') {
      return res.status(403).json({ 
        success: false, 
        error: 'Доступно только для суперадминистратора' 
      });
    }
    
    const admins = await AdminModel.find().select('-password');
    
    res.json({
      success: true,
      admins
    });
  } catch (error) {
    next(error);
  }
});

// Создание нового администратора (только для superadmin)
router.post('/admins', adminMiddleware, async (req, res, next) => {
  try {
    // Проверяем, что текущий админ имеет роль superadmin
    if (req.admin.role !== 'superadmin') {
      return res.status(403).json({ 
        success: false, 
        error: 'Доступно только для суперадминистратора' 
      });
    }
    
    const { telegramId, username, email, password, role, permissions } = req.body;
    
    // Проверяем обязательные поля
    if (!telegramId || !username) {
      return res.status(400).json({ 
        success: false, 
        error: 'Telegram ID и имя пользователя обязательны' 
      });
    }
    
    // Проверяем, существует ли уже админ с таким Telegram ID
    const existingAdmin = await AdminModel.findOne({ telegramId });
    
    if (existingAdmin) {
      return res.status(400).json({ 
        success: false, 
        error: 'Администратор с таким Telegram ID уже существует' 
      });
    }
    
    // Создаем нового админа
    const newAdmin = new AdminModel({
      telegramId,
      username,
      email,
      password,
      role: role || 'admin',
      permissions: permissions || {
        manageProducts: true,
        manageOrders: true,
        manageUsers: false,
        manageAdmins: false,
        viewStatistics: true
      }
    });
    
    await newAdmin.save();
    
    res.status(201).json({
      success: true,
      message: 'Администратор успешно создан',
      admin: {
        id: newAdmin._id,
        telegramId: newAdmin.telegramId,
        username: newAdmin.username,
        email: newAdmin.email,
        role: newAdmin.role,
        permissions: newAdmin.permissions,
        isActive: newAdmin.isActive
      }
    });
  } catch (error) {
    next(error);
  }
});

// Обновление администратора (только для superadmin)
router.put('/admins/:id', adminMiddleware, async (req, res, next) => {
  try {
    // Проверяем, что текущий админ имеет роль superadmin
    if (req.admin.role !== 'superadmin') {
      return res.status(403).json({ 
        success: false, 
        error: 'Доступно только для суперадминистратора' 
      });
    }
    
    const { id } = req.params;
    const { username, email, password, role, permissions, isActive } = req.body;
    
    // Находим администратора
    const admin = await AdminModel.findById(id);
    
    if (!admin) {
      return res.status(404).json({ success: false, error: 'Администратор не найден' });
    }
    
    // Обновляем данные
    if (username) admin.username = username;
    if (email) admin.email = email;
    if (password) admin.password = password;
    if (role) admin.role = role;
    if (permissions) admin.permissions = { ...admin.permissions, ...permissions };
    if (isActive !== undefined) admin.isActive = isActive;
    
    await admin.save();
    
    res.json({
      success: true,
      message: 'Администратор успешно обновлен',
      admin: {
        id: admin._id,
        telegramId: admin.telegramId,
        username: admin.username,
        email: admin.email,
        role: admin.role,
        permissions: admin.permissions,
        isActive: admin.isActive
      }
    });
  } catch (error) {
    next(error);
  }
});

// Удаление администратора (только для superadmin)
router.delete('/admins/:id', adminMiddleware, async (req, res, next) => {
  try {
    // Проверяем, что текущий админ имеет роль superadmin
    if (req.admin.role !== 'superadmin') {
      return res.status(403).json({ 
        success: false, 
        error: 'Доступно только для суперадминистратора' 
      });
    }
    
    const { id } = req.params;
    
    // Проверяем, не пытаемся ли удалить самого себя
    if (id === req.admin._id.toString()) {
      return res.status(400).json({ 
        success: false, 
        error: 'Нельзя удалить свою учетную запись' 
      });
    }
    
    // Удаляем администратора
    const result = await AdminModel.findByIdAndDelete(id);
    
    if (!result) {
      return res.status(404).json({ success: false, error: 'Администратор не найден' });
    }
    
    res.json({
      success: true,
      message: 'Администратор успешно удален'
    });
  } catch (error) {
    next(error);
  }
});

// Получение списка пользователей
router.get('/users', adminMiddleware, async (req, res, next) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      sortBy = 'createdAt', 
      sortOrder = 'desc',
      search
    } = req.query;
    
    // Формируем фильтр
    const filter = {};
    
    // Поиск по имени пользователя, телефону или email
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      filter.$or = [
        { username: searchRegex },
        { phone: searchRegex },
        { email: searchRegex },
        { firstName: searchRegex },
        { lastName: searchRegex }
      ];
      
      // Если поиск похож на Telegram ID
      if (!isNaN(search)) {
        filter.$or.push({ telegramId: parseInt(search) });
      }
    }
    
    // Пагинация
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Сортировка
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;
    
    // Получаем общее количество пользователей, соответствующих фильтру
    const total = await UserModel.countDocuments(filter);
    
    // Получаем пользователей
    const users = await UserModel.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));
    
    res.json({
      success: true,
      users,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    next(error);
  }
});

// Получение информации о пользователе
router.get('/users/:id', adminMiddleware, async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Поиск пользователя по ID или Telegram ID
    let user;
    
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      // Если ID в формате MongoDB
      user = await UserModel.findById(id);
    } else if (!isNaN(id)) {
      // Если ID в формате числа (Telegram ID)
      user = await UserModel.findOne({ telegramId: parseInt(id) });
    } else {
      return res.status(400).json({ success: false, error: 'Неверный формат ID' });
    }
    
    if (!user) {
      return res.status(404).json({ success: false, error: 'Пользователь не найден' });
    }
    
    // Получаем заказы пользователя
    const orders = await OrderModel.find({ telegramId: user.telegramId })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('items.product');
    
    res.json({
      success: true,
      user,
      orders
    });
  } catch (error) {
    next(error);
  }
});

// Импорт товара с Ozon
router.post('/import-ozon', adminMiddleware, async (req, res, next) => {
  try {
    const { url } = req.body;
    
    if (!url || !url.includes('ozon.ru')) {
      return res.status(400).json({ 
        success: false, 
        error: 'Требуется валидная ссылка на товар Ozon' 
      });
    }
    
    try {
      // Получаем HTML страницы товара
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      
      const $ = cheerio.load(response.data);
      
      // Парсим данные товара
      const title = $('h1').text().trim();
      const description = $('.product-description').text().trim();
      const priceText = $('.price-block__final-price').text().trim().replace(/[^\d]/g, '');
      const price = parseInt(priceText, 10);
      
      // Получаем изображения
      const images = [];
      $('.gallery-image-container img').each((i, el) => {
        if (i < 5) { // Ограничиваем до 5 изображений
          const imgUrl = $(el).attr('src');
          if (imgUrl) images.push(imgUrl);
        }
      });
      
      // Собираем информацию о товаре
      const productData = {
        title,
        description,
        price: isNaN(price) ? 0 : price,
        category: 'Импорт с Ozon', // Дефолтная категория
        sizes: [], // Пустые размеры для последующего редактирования
        colors: [], // Пустые цвета для последующего редактирования
        imageUrls: images
      };
      
      res.json({
        success: true,
        product: productData
      });
    } catch (error) {
      console.error('Ошибка импорта товара с Ozon:', error);
      return res.status(400).json({ 
        success: false, 
        error: 'Не удалось импортировать товар. Проверьте ссылку и попробуйте еще раз.' 
      });
    }
  } catch (error) {
    next(error);
  }
});

// Создание товара из данных Ozon
router.post('/create-from-ozon', adminMiddleware, async (req, res, next) => {
  try {
    const { 
      title,
      description,
      price,
      category,
      sizes,
      colors,
      imageUrls
    } = req.body;
    
    // Проверяем обязательные поля
    if (!title || !description || !price) {
      return res.status(400).json({ 
        success: false, 
        error: 'Название, описание и цена обязательны' 
      });
    }
    
    // Создаем новый товар
    const newProduct = new ProductModel({
      title,
      description,
      category: category || 'Импорт с Ozon',
      price: parseFloat(price),
      sizes: sizes || [],
      colors: colors || [],
      createdBy: req.admin._id,
      images: []
    });
    
    // Загружаем изображения
    if (imageUrls && imageUrls.length > 0) {
      for (let i = 0; i < imageUrls.length; i++) {
        try {
          // Загружаем изображение по URL
          const imageResponse = await axios.get(imageUrls[i], { responseType: 'arraybuffer' });
          const buffer = Buffer.from(imageResponse.data, 'binary');
          const fileName = `product_ozon_${Date.now()}_${i + 1}.jpg`;
          
          // Загружаем на Yandex Disk
          const uploadedPath = await yadiskService.uploadFile(buffer, fileName);
          
          // Добавляем путь к изображению в массив
          newProduct.images.push(uploadedPath);
        } catch (error) {
          console.error('Ошибка загрузки изображения:', error);
        }
      }
    }
    
    // Сохраняем товар
    await newProduct.save();
    
    res.status(201).json({
      success: true,
      message: 'Товар успешно создан из данных Ozon',
      product: newProduct
    });
  } catch (error) {
    next(error);
  }
});

// Получение статистики
router.get('/statistics', adminMiddleware, async (req, res, next) => {
  try {
    // Получаем статистику заказов
    const orderStats = await OrderModel.getStatistics();
    
    // Общая информация
    const totalProducts = await ProductModel.countDocuments();
    const totalUsers = await UserModel.countDocuments();
    const totalOrders = await OrderModel.countDocuments();
    
    // Статистика по популярным категориям
    const popularCategories = await ProductModel.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);
    
    // Статистика по просмотрам товаров
    const mostViewedProducts = await ProductModel.find()
      .sort({ views: -1 })
      .limit(5)
      .select('title category price views');
    
    // Последние пользователи
    const recentUsers = await UserModel.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('username telegramId firstName lastName createdAt');
    
    // Статистика по выручке
    const revenueByMonth = await OrderModel.aggregate([
      { $match: { paymentStatus: 'paid' } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          revenue: { $sum: '$total' },
          orderCount: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
      { $limit: 12 }
    ]);
    
    res.json({
      success: true,
      statistics: {
        summary: {
          totalProducts,
          totalUsers,
          totalOrders,
          totalRevenue: orderStats.totalRevenue
        },
        orders: orderStats,
        popularCategories,
        mostViewedProducts,
        recentUsers,
        revenueByMonth
      }
    });
  } catch (error) {
    next(error);
  }
});

// Экспортируем маршруты
module.exports = router;
