// routes/products.js - Маршруты товаров
const express = require('express');
const router = express.Router();
const auth = require('./auth');
const authMiddleware = auth.authMiddleware;
const adminMiddleware = auth.adminMiddleware;
const ProductModel = require('../models/product');
const yadiskService = require('../yadisk-service');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });
const path = require('path');

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
    
    // Получаем доступные категории, размеры и цвета для фильтров
    const categories = await ProductModel.distinct('category', { active: true });
    const sizes = await ProductModel.distinct('sizes', { active: true });
    const colors = await ProductModel.distinct('colors', { active: true });
    
    // Получаем минимальную и максимальную цены
    const priceRange = await ProductModel.aggregate([
      { $match: { active: true } },
      { $group: { 
        _id: null, 
        minPrice: { $min: '$price' }, 
        maxPrice: { $max: '$price' } 
      }}
    ]);
    
    const priceRangeObj = priceRange.length > 0 ? {
      minPrice: priceRange[0].minPrice,
      maxPrice: priceRange[0].maxPrice
    } : { minPrice: 0, maxPrice: 0 };
    
    res.json({
      success: true,
      products: productsWithImageUrls,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      },
      filters: {
        categories,
        sizes,
        colors,
        priceRange: priceRangeObj
      }
    });
  } catch (error) {
    next(error);
  }
});

// Получение товара по ID
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const product = await ProductModel.findById(id);
    
    if (!product || !product.active) {
      return res.status(404).json({ success: false, error: 'Товар не найден' });
    }
    
    // Инкрементируем счетчик просмотров
    product.views += 1;
    await product.save();
    
    // Получаем ссылки на изображения
    const productObj = product.toObject();
    
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
    
    res.json({
      success: true,
      product: productObj
    });
  } catch (error) {
    next(error);
  }
});

// Создание нового товара (только для админов)
router.post('/', adminMiddleware, upload.array('images', 5), async (req, res, next) => {
  try {
    const { 
      title,
      description,
      category,
      price,
      sizes,
      colors,
      discount,
      attributes
    } = req.body;
    
    // Проверяем обязательные поля
    if (!title || !description || !category || !price) {
      return res.status(400).json({ 
        success: false, 
        error: 'Название, описание, категория и цена обязательны' 
      });
    }
    
    // Создаем массив размеров и цветов из строк
    const sizesArray = sizes ? sizes.split(',').map(size => size.trim()) : [];
    const colorsArray = colors ? colors.split(',').map(color => color.trim()) : [];
    
    // Создаем новый товар
    const newProduct = new ProductModel({
      title,
      description,
      category,
      price: parseFloat(price),
      sizes: sizesArray,
      colors: colorsArray,
      discount: discount ? parseFloat(discount) : 0,
      createdBy: req.admin._id,
      images: []
    });
    
    // Добавляем дополнительные атрибуты, если они есть
    if (attributes) {
      try {
        const attributesMap = new Map(Object.entries(JSON.parse(attributes)));
        newProduct.attributes = attributesMap;
      } catch (error) {
        console.error('Ошибка при обработке атрибутов:', error);
      }
    }
    
    // Обрабатываем загруженные изображения
    if (req.files && req.files.length > 0) {
      for (let i = 0; i < req.files.length; i++) {
        const file = req.files[i];
        const fileName = `product_${Date.now()}_${i + 1}${path.extname(file.originalname)}`;
        
        try {
          // Загружаем файл на Yandex Disk
          const uploadedPath = await yadiskService.uploadFile(file.buffer, fileName);
          
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
      message: 'Товар успешно создан',
      product: newProduct
    });
  } catch (error) {
    next(error);
  }
});

// Обновление товара (только для админов)
router.put('/:id', adminMiddleware, upload.array('images', 5), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { 
      title,
      description,
      category,
      price,
      sizes,
      colors,
      discount,
      inStock,
      removeImages,
      attributes
    } = req.body;
    
    // Находим товар
    const product = await ProductModel.findById(id);
    
    if (!product) {
      return res.status(404).json({ success: false, error: 'Товар не найден' });
    }
    
    // Обновляем поля товара
    if (title) product.title = title;
    if (description) product.description = description;
    if (category) product.category = category;
    if (price) product.price = parseFloat(price);
    if (discount !== undefined) product.discount = parseFloat(discount);
    if (inStock !== undefined) product.inStock = inStock === 'true';
    
    // Обновляем размеры и цвета
    if (sizes) {
      product.sizes = sizes.split(',').map(size => size.trim());
    }
    
    if (colors) {
      product.colors = colors.split(',').map(color => color.trim());
    }
    
    // Обрабатываем атрибуты
    if (attributes) {
      try {
        const attributesMap = new Map(Object.entries(JSON.parse(attributes)));
        product.attributes = attributesMap;
      } catch (error) {
        console.error('Ошибка при обработке атрибутов:', error);
      }
    }
    
    // Удаляем указанные изображения, если нужно
    if (removeImages) {
      const imagesToRemove = removeImages.split(',');
      
      for (const imagePath of imagesToRemove) {
        // Удаляем из Yandex Disk
        try {
          await yadiskService.deleteFile(imagePath);
        } catch (error) {
          console.error('Ошибка удаления изображения:', error);
        }
        
        // Удаляем из массива изображений товара
        const imageIndex = product.images.indexOf(imagePath);
        if (imageIndex !== -1) {
          product.images.splice(imageIndex, 1);
        }
      }
    }
    
    // Добавляем новые изображения
    if (req.files && req.files.length > 0) {
      for (let i = 0; i < req.files.length; i++) {
        const file = req.files[i];
        const fileName = `product_${Date.now()}_${i + 1}${path.extname(file.originalname)}`;
        
        try {
          // Загружаем файл на Yandex Disk
          const uploadedPath = await yadiskService.uploadFile(file.buffer, fileName);
          
          // Добавляем путь к изображению в массив
          product.images.push(uploadedPath);
        } catch (error) {
          console.error('Ошибка загрузки изображения:', error);
        }
      }
    }
    
    // Сохраняем изменения
    await product.save();
    
    res.json({
      success: true,
      message: 'Товар успешно обновлен',
      product
    });
  } catch (error) {
    next(error);
  }
});

// Удаление товара (только для админов)
router.delete('/:id', adminMiddleware, async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Находим товар
    const product = await ProductModel.findById(id);
    
    if (!product) {
      return res.status(404).json({ success: false, error: 'Товар не найден' });
    }
    
    // Удаляем изображения с Yandex Disk
    for (const imagePath of product.images) {
      try {
        await yadiskService.deleteFile(imagePath);
      } catch (error) {
        console.error('Ошибка удаления изображения:', error);
      }
    }
    
    // Удаляем товар из базы данных
    await ProductModel.findByIdAndDelete(id);
    
    res.json({
      success: true,
      message: 'Товар успешно удален'
    });
  } catch (error) {
    next(error);
  }
});

// Получение категорий товаров
router.get('/categories/all', async (req, res, next) => {
  try {
    const categories = await ProductModel.distinct('category', { active: true });
    
    res.json({
      success: true,
      categories
    });
  } catch (error) {
    next(error);
  }
});

// Экспортируем маршруты
module.exports = router;