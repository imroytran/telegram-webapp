// routes/cart.js - Маршруты корзины
const express = require('express');
const router = express.Router();
const { authMiddleware } = require('./auth');
const CartModel = require('../models/cart');
const ProductModel = require('../models/product');
const yadiskService = require('../yadisk-service');

// Получение корзины пользователя
router.get('/', authMiddleware, async (req, res, next) => {
  try {
    // Проверяем, что авторизован пользователь, а не админ
    if (!req.user) {
      return res.status(403).json({ success: false, error: 'Доступно только для пользователей' });
    }
    
    // Находим или создаем корзину пользователя
    let cart = await CartModel.findOne({ telegramId: req.user.telegramId });
    
    if (!cart) {
      cart = new CartModel({
        telegramId: req.user.telegramId,
        username: req.user.username,
        items: [],
        total: 0
      });
      
      await cart.save();
    }
    
    // Загружаем информацию о товарах в корзине
    await cart.populate('items.product');
    
    // Получаем ссылки на изображения товаров
    const cartObj = cart.toObject();
    
    for (const item of cartObj.items) {
      if (item.product && item.product.images && item.product.images.length > 0) {
        try {
          item.product.imageUrl = await yadiskService.getDownloadLink(item.product.images[0]);
        } catch (error) {
          console.error('Ошибка получения ссылки на изображение:', error);
          item.product.imageUrl = null;
        }
      } else {
        item.product.imageUrl = null;
      }
    }
    
    res.json({
      success: true,
      cart: cartObj
    });
  } catch (error) {
    next(error);
  }
});

// Добавление товара в корзину
router.post('/add', authMiddleware, async (req, res, next) => {
  try {
    // Проверяем, что авторизован пользователь, а не админ
    if (!req.user) {
      return res.status(403).json({ success: false, error: 'Доступно только для пользователей' });
    }
    
    const { productId, quantity = 1, size, color } = req.body;
    
    // Проверяем обязательные параметры
    if (!productId || !size || !color) {
      return res.status(400).json({ 
        success: false, 
        error: 'ID товара, размер и цвет обязательны' 
      });
    }
    
    // Находим товар
    const product = await ProductModel.findById(productId);
    
    if (!product || !product.active || !product.inStock) {
      return res.status(404).json({ 
        success: false, 
        error: 'Товар не найден или недоступен для заказа' 
      });
    }
    
    // Проверяем наличие выбранного размера и цвета
    if (!product.sizes.includes(size)) {
      return res.status(400).json({ 
        success: false, 
        error: `Размер ${size} недоступен для данного товара` 
      });
    }
    
    if (!product.colors.includes(color)) {
      return res.status(400).json({ 
        success: false, 
        error: `Цвет ${color} недоступен для данного товара` 
      });
    }
    
    // Находим или создаем корзину пользователя
    let cart = await CartModel.findOne({ telegramId: req.user.telegramId });
    
    if (!cart) {
      cart = new CartModel({
        telegramId: req.user.telegramId,
        username: req.user.username,
        items: [],
        total: 0
      });
    }
    
    // Добавляем товар в корзину
    await cart.addItem(productId, quantity, size, color);
    
    // Загружаем информацию о товарах в корзине
    await cart.populate('items.product');
    
    res.json({
      success: true,
      message: 'Товар успешно добавлен в корзину',
      cart
    });
  } catch (error) {
    next(error);
  }
});

// Удаление товара из корзины
router.delete('/remove/:itemIndex', authMiddleware, async (req, res, next) => {
  try {
    // Проверяем, что авторизован пользователь, а не админ
    if (!req.user) {
      return res.status(403).json({ success: false, error: 'Доступно только для пользователей' });
    }
    
    const { itemIndex } = req.params;
    
    // Находим корзину пользователя
    const cart = await CartModel.findOne({ telegramId: req.user.telegramId });
    
    if (!cart) {
      return res.status(404).json({ success: false, error: 'Корзина не найдена' });
    }
    
    // Удаляем товар из корзины
    const result = await cart.removeItem(parseInt(itemIndex));
    
    if (!result) {
      return res.status(400).json({ success: false, error: 'Товар не найден в корзине' });
    }
    
    // Загружаем информацию о товарах в корзине
    await cart.populate('items.product');
    
    res.json({
      success: true,
      message: 'Товар успешно удален из корзины',
      cart
    });
  } catch (error) {
    next(error);
  }
});

// Обновление количества товара в корзине
router.put('/update/:itemIndex', authMiddleware, async (req, res, next) => {
  try {
    // Проверяем, что авторизован пользователь, а не админ
    if (!req.user) {
      return res.status(403).json({ success: false, error: 'Доступно только для пользователей' });
    }
    
    const { itemIndex } = req.params;
    const { quantity } = req.body;
    
    if (!quantity || quantity < 1) {
      return res.status(400).json({ 
        success: false, 
        error: 'Количество должно быть положительным числом' 
      });
    }
    
    // Находим корзину пользователя
    const cart = await CartModel.findOne({ telegramId: req.user.telegramId });
    
    if (!cart) {
      return res.status(404).json({ success: false, error: 'Корзина не найдена' });
    }
    
    // Обновляем количество товара
    const result = await cart.updateItemQuantity(parseInt(itemIndex), parseInt(quantity));
    
    if (!result) {
      return res.status(400).json({ success: false, error: 'Товар не найден в корзине' });
    }
    
    // Загружаем информацию о товарах в корзине
    await cart.populate('items.product');
    
    res.json({
      success: true,
      message: 'Количество товара успешно обновлено',
      cart
    });
  } catch (error) {
    next(error);
  }
});

// Очистка корзины
router.delete('/clear', authMiddleware, async (req, res, next) => {
  try {
    // Проверяем, что авторизован пользователь, а не админ
    if (!req.user) {
      return res.status(403).json({ success: false, error: 'Доступно только для пользователей' });
    }
    
    // Находим корзину пользователя
    const cart = await CartModel.findOne({ telegramId: req.user.telegramId });
    
    if (!cart) {
      return res.status(404).json({ success: false, error: 'Корзина не найдена' });
    }
    
    // Очищаем корзину
    await cart.clear();
    
    res.json({
      success: true,
      message: 'Корзина успешно очищена',
      cart
    });
  } catch (error) {
    next(error);
  }
});

// Применение промокода
router.post('/apply-promo', authMiddleware, async (req, res, next) => {
  try {
    // Проверяем, что авторизован пользователь, а не админ
    if (!req.user) {
      return res.status(403).json({ success: false, error: 'Доступно только для пользователей' });
    }
    
    const { promoCode } = req.body;
    
    if (!promoCode) {
      return res.status(400).json({ success: false, error: 'Требуется промокод' });
    }
    
    // Находим корзину пользователя
    const cart = await CartModel.findOne({ telegramId: req.user.telegramId });
    
    if (!cart) {
      return res.status(404).json({ success: false, error: 'Корзина не найдена' });
    }
    
    // Применяем промокод
    const result = await cart.applyPromoCode(promoCode);
    
    if (!result) {
      return res.status(400).json({ 
        success: false, 
        error: 'Промокод недействителен или истек срок его действия' 
      });
    }
    
    // Загружаем информацию о товарах в корзине
    await cart.populate('items.product');
    
    res.json({
      success: true,
      message: 'Промокод успешно применен',
      cart
    });
  } catch (error) {
    next(error);
  }
});

// Экспортируем маршруты
module.exports = router;
