// routes/orders.js - Маршруты заказов
const express = require('express');
const router = express.Router();
const { authMiddleware, adminMiddleware } = require('./auth');
const OrderModel = require('../models/order');
const CartModel = require('../models/cart');
const UserModel = require('../models/user');
const config = require('../config');
const crypto = require('crypto');
const yadiskService = require('../yadisk-service');

// Создание заказа на основе корзины
router.post('/', authMiddleware, async (req, res, next) => {
  try {
    // Проверяем, что авторизован пользователь, а не админ
    if (!req.user) {
      return res.status(403).json({ success: false, error: 'Доступно только для пользователей' });
    }
    
    const { 
      address, 
      phone, 
      email, 
      deliveryMethod = 'courier', 
      paymentMethod = 'online',
      notes
    } = req.body;
    
    // Проверяем обязательные поля
    if (!address || !phone) {
      return res.status(400).json({ 
        success: false, 
        error: 'Адрес и телефон обязательны для оформления заказа' 
      });
    }
    
    // Находим корзину пользователя
    const cart = await CartModel.findOne({ telegramId: req.user.telegramId }).populate('items.product');
    
    if (!cart || !cart.items || cart.items.length === 0) {
      return res.status(400).json({ success: false, error: 'Корзина пуста' });
    }
    
    // Создаем заказ
    const orderData = {
      address,
      phone,
      email,
      deliveryMethod,
      paymentMethod,
      notes
    };
    
    try {
      const order = await OrderModel.createFromCart(cart, orderData);
      
      // Обновляем статистику пользователя
      if (req.user.updateOrderStats) {
        await req.user.updateOrderStats(order.total);
      }
      
      // Генерируем ссылку на оплату для ЮMoney
      let paymentLink = null;
      
      if (paymentMethod === 'online' && config.ENABLE_PAYMENT) {
        // Формируем данные для платежа
        const orderIdStr = order._id.toString();
        const label = `order_${orderIdStr}`;
        
        // Создаем ссылку на оплату
        paymentLink = `https://yoomoney.ru/checkout/payments/v2/contract?receiver=${config.YOOMONEY_WALLET}&quickpay-form=shop&targets=Оплата+заказа+${orderIdStr.slice(-6)}&sum=${order.total}&label=${label}`;
      }
      
      res.status(201).json({
        success: true,
        message: 'Заказ успешно создан',
        order,
        paymentLink
      });
    } catch (error) {
      console.error('Ошибка создания заказа:', error);
      return res.status(400).json({ success: false, error: error.message });
    }
  } catch (error) {
    next(error);
  }
});

// Получение списка заказов пользователя
router.get('/', authMiddleware, async (req, res, next) => {
  try {
    // Проверяем, что авторизован пользователь, а не админ
    if (!req.user) {
      return res.status(403).json({ success: false, error: 'Доступно только для пользователей' });
    }
    
    const { page = 1, limit = 10 } = req.query;
    
    // Пагинация
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Получаем общее количество заказов пользователя
    const total = await OrderModel.countDocuments({ telegramId: req.user.telegramId });
    
    // Получаем заказы пользователя
    const orders = await OrderModel.find({ telegramId: req.user.telegramId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('items.product');
    
    // Получаем ссылки на изображения товаров
    const ordersWithImages = await Promise.all(orders.map(async (order) => {
      const orderObj = order.toObject();
      
      for (const item of orderObj.items) {
        if (item.product && item.product.images && item.product.images.length > 0) {
          try {
            item.product.imageUrl = await yadiskService.getDownloadLink(item.product.images[0]);
          } catch (error) {
            console.error('Ошибка получения ссылки на изображение:', error);
            item.product.imageUrl = null;
          }
        } else {
          if (item.product) {
            item.product.imageUrl = null;
          }
        }
      }
      
      return orderObj;
    }));
    
    res.json({
      success: true,
      orders: ordersWithImages,
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

// Получение информации о заказе
router.get('/:id', authMiddleware, async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Находим заказ
    const order = await OrderModel.findById(id).populate('items.product');
    
    if (!order) {
      return res.status(404).json({ success: false, error: 'Заказ не найден' });
    }
    
    // Проверяем права доступа
    const isAdmin = req.admin !== undefined;
    const isOwner = req.user && req.user.telegramId === order.telegramId;
    
    if (!isAdmin && !isOwner) {
      return res.status(403).json({ success: false, error: 'Нет доступа к этому заказу' });
    }
    
    // Получаем ссылки на изображения товаров
    const orderObj = order.toObject();
    
    for (const item of orderObj.items) {
      if (item.product && item.product.images && item.product.images.length > 0) {
        try {
          item.product.imageUrl = await yadiskService.getDownloadLink(item.product.images[0]);
        } catch (error) {
          console.error('Ошибка получения ссылки на изображение:', error);
          item.product.imageUrl = null;
        }
      } else {
        if (item.product) {
          item.product.imageUrl = null;
        }
      }
    }
    
    // Добавляем ссылку на оплату, если заказ еще не оплачен
    let paymentLink = null;
    
    if (order.paymentStatus === 'awaiting' && order.paymentMethod === 'online' && config.ENABLE_PAYMENT) {
      const orderIdStr = order._id.toString();
      const label = `order_${orderIdStr}`;
      
      paymentLink = `https://yoomoney.ru/checkout/payments/v2/contract?receiver=${config.YOOMONEY_WALLET}&quickpay-form=shop&targets=Оплата+заказа+${orderIdStr.slice(-6)}&sum=${order.total}&label=${label}`;
    }
    
    res.json({
      success: true,
      order: orderObj,
      paymentLink
    });
  } catch (error) {
    next(error);
  }
});

// Отмена заказа пользователем
router.post('/:id/cancel', authMiddleware, async (req, res, next) => {
  try {
    // Проверяем, что авторизован пользователь, а не админ
    if (!req.user) {
      return res.status(403).json({ success: false, error: 'Доступно только для пользователей' });
    }
    
    const { id } = req.params;
    const { cancelReason } = req.body;
    
    // Находим заказ
    const order = await OrderModel.findById(id);
    
    if (!order) {
      return res.status(404).json({ success: false, error: 'Заказ не найден' });
    }
    
    // Проверяем, что это заказ текущего пользователя
    if (order.telegramId !== req.user.telegramId) {
      return res.status(403).json({ success: false, error: 'Нет доступа к этому заказу' });
    }
    
    // Проверяем, можно ли отменить заказ
    if (['completed', 'cancelled'].includes(order.status)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Невозможно отменить заказ в текущем статусе' 
      });
    }
    
    // Отменяем заказ
    const comment = cancelReason ? `Отменен пользователем: ${cancelReason}` : 'Отменен пользователем';
    await order.updateStatus('cancelled', comment);
    
    res.json({
      success: true,
      message: 'Заказ успешно отменен',
      order
    });
  } catch (error) {
    next(error);
  }
});

// --- Административные маршруты ---

// Получение списка всех заказов (только для админов)
router.get('/admin/all', adminMiddleware, async (req, res, next) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      status, 
      paymentStatus,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      search
    } = req.query;
    
    // Формируем фильтр
    const filter = {};
    
    if (status) filter.status = status;
    if (paymentStatus) filter.paymentStatus = paymentStatus;
    
    // Поиск по телефону, имени пользователя или ID заказа
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      filter.$or = [
        { username: searchRegex },
        { phone: searchRegex },
        { address: searchRegex }
      ];
      
      // Если поиск похож на ID заказа, добавляем его в условия
      if (search.match(/^[0-9a-fA-F]{24}$/)) {
        filter.$or.push({ _id: search });
      }
    }
    
    // Пагинация
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Сортировка
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;
    
    // Получаем общее количество заказов, соответствующих фильтру
    const total = await OrderModel.countDocuments(filter);
    
    // Получаем заказы
    const orders = await OrderModel.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .populate('items.product');
    
    res.json({
      success: true,
      orders,
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

// Обновление статуса заказа (только для админов)
router.put('/admin/:id/status', adminMiddleware, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, comment } = req.body;
    
    // Проверяем валидность статуса
    const validStatuses = ['pending', 'processing', 'shipped', 'completed', 'cancelled'];
    
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Недопустимый статус заказа' 
      });
    }
    
    // Находим заказ
    const order = await OrderModel.findById(id);
    
    if (!order) {
      return res.status(404).json({ success: false, error: 'Заказ не найден' });
    }
    
    // Обновляем статус заказа
    await order.updateStatus(status, comment, req.admin._id);
    
    res.json({
      success: true,
      message: 'Статус заказа успешно обновлен',
      order
    });
  } catch (error) {
    next(error);
  }
});

// Обновление статуса оплаты заказа (только для админов)
router.put('/admin/:id/payment', adminMiddleware, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { paymentStatus, transactionId } = req.body;
    
    // Проверяем валидность статуса оплаты
    const validPaymentStatuses = ['awaiting', 'paid', 'failed'];
    
    if (!paymentStatus || !validPaymentStatuses.includes(paymentStatus)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Недопустимый статус оплаты' 
      });
    }
    
    // Находим заказ
    const order = await OrderModel.findById(id);
    
    if (!order) {
      return res.status(404).json({ success: false, error: 'Заказ не найден' });
    }
    
    // Обновляем статус оплаты
    await order.updatePaymentStatus(paymentStatus, transactionId);
    
    res.json({
      success: true,
      message: 'Статус оплаты успешно обновлен',
      order
    });
  } catch (error) {
    next(error);
  }
});

// Добавление трекинг-номера для отслеживания доставки (только для админов)
router.put('/admin/:id/tracking', adminMiddleware, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { trackingNumber, estimatedDeliveryDate } = req.body;
    
    if (!trackingNumber) {
      return res.status(400).json({ 
        success: false, 
        error: 'Требуется указать трекинг-номер' 
      });
    }
    
    // Находим заказ
    const order = await OrderModel.findById(id);
    
    if (!order) {
      return res.status(404).json({ success: false, error: 'Заказ не найден' });
    }
    
    // Добавляем трекинг-номер
    let deliveryDate = null;
    if (estimatedDeliveryDate) {
      deliveryDate = new Date(estimatedDeliveryDate);
    }
    
    await order.addTrackingNumber(trackingNumber, deliveryDate);
    
    // Если заказ в статусе "processing", обновляем его до "shipped"
    if (order.status === 'processing') {
      await order.updateStatus('shipped', 'Добавлен трекинг-номер отправления', req.admin._id);
    }
    
    res.json({
      success: true,
      message: 'Трекинг-номер успешно добавлен',
      order
    });
  } catch (error) {
    next(error);
  }
});

// Получение статистики заказов (только для админов)
router.get('/admin/statistics', adminMiddleware, async (req, res, next) => {
  try {
    const { period = 'month' } = req.query;
    
    // Получаем статистику
    const statistics = await OrderModel.getStatistics(period);
    
    res.json({
      success: true,
      statistics
    });
  } catch (error) {
    next(error);
  }
});

// Экспортируем маршруты
module.exports = router;