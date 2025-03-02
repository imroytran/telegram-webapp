// routes/products.js - Маршруты товаров
const express = require('express');
const router = express.Router();
const { authMiddleware, adminMiddleware } = require('./auth');
const ProductModel = require('../models/product');
const yadiskService = require('../yadisk-service');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

// Получение списка товаров с фильтрацией
router.get('/', async (req, res, next) => {
  try {
    const { 
      category, 
      size, 
      color, 
      minPrice, 
      maxPrice, 
      sort = 'createdAt', 
      order = 'desc',
      page = 1,
      limit = 10,
      search
    } = req.query;
    
    // Формируем фильтр
    const filter = { active: true };
    
    if (category) filter.category = category;
    if (size) filter.sizes = size;
    if (color) filter.colors = color;
    
    // Фильтр по цене
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = parseInt(minPrice);
      if (maxPrice) filter.price.$lte = parseInt(maxPrice);
    }
    
    // Поиск по тексту
    if (search) {
      filter.$text = { $search: search };
    }
    
    // Определяем сортировку
    const sortOptions = {};
    sortOptions[sort] = order === 'asc' ? 1 : -1;
    
    // Пагинация
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Получаем общее количество товаров, соответствующих фильтру
    const total = await ProductModel.countDocuments(filter);
    
    // Получаем товары
    const products = await ProductModel.find(filter)
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit));
    
    // Обрабатываем изображения товаров
    const productsWithImageUrls = await Promise.all(products.map(async (product) => {
      const productObj = product.toObject();
      
      // Если есть изображения, получаем ссылки для скачивания
      if (productObj.images && productObj.images.length > 0) {
        try {
          productObj.imageUrls = await Promise.all(
            productObj.images.map(async (imagePath) => await yadiskService.getDownloadLink(imagePath))
          );
        } catch (error) {
          console.error('Ошибка получения ссылок на изображения:', error);
          productObj.imageUrls = [];
        }
      } else {
        productObj.imageUrls = [];
      }
      
      return productObj;
    }));