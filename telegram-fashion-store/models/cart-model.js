// models/cart.js - Модель корзины
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const CartItemSchema = new Schema({
  product: {
    type: Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
    default: 1
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  size: {
    type: String,
    required: true
  },
  color: {
    type: String,
    required: true
  },
  addedAt: {
    type: Date,
    default: Date.now
  }
});

const CartSchema = new Schema({
  telegramId: {
    type: Number,
    required: true,
    unique: true
  },
  username: {
    type: String,
    required: true
  },
  items: [CartItemSchema],
  total: {
    type: Number,
    default: 0
  },
  lastModified: {
    type: Date,
    default: Date.now
  },
  promoCode: {
    code: String,
    discount: Number, // в процентах
    expiresAt: Date
  }
}, { timestamps: true });

// Метод для обновления общей суммы корзины
CartSchema.methods.updateTotal = async function() {
  // Обновляем актуальные цены из базы данных товаров
  for (const item of this.items) {
    try {
      const Product = mongoose.model('Product');
      const product = await Product.findById(item.product);
      
      if (product) {
        // Используем finalPrice, который учитывает скидки
        const finalPrice = product.discount ? 
          product.price - (product.price * (product.discount / 100)) : 
          product.price;
        
        item.price = finalPrice;
      }
    } catch (error) {
      console.error('Ошибка обновления цены товара в корзине:', error);
    }
  }
  
  // Вычисляем общую сумму
  let total = this.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  
  // Применяем промокод, если он есть и не просрочен
  if (this.promoCode && this.promoCode.code && this.promoCode.expiresAt > Date.now()) {
    total = total * (1 - this.promoCode.discount / 100);
  }
  
  this.total = total;
  this.lastModified = Date.now();
  
  return this.save();
};

// Метод для добавления товара в корзину
CartSchema.methods.addItem = async function(productId, quantity, size, color) {
  const Product = mongoose.model('Product');
  const product = await Product.findById(productId);
  
  if (!product) {
    throw new Error('Товар не найден');
  }
  
  if (!product.inStock) {
    throw new Error('Товар отсутствует на складе');
  }
  
  // Проверяем наличие размера и цвета
  if (!product.sizes.includes(size)) {
    throw new Error(`Размер ${size} недоступен для данного товара`);
  }
  
  if (!product.colors.includes(color)) {
    throw new Error(`Цвет ${color} недоступен для данного товара`);
  }
  
  // Проверяем, есть ли товар уже в корзине
  const existingItemIndex = this.items.findIndex(item => 
    item.product.toString() === productId && 
    item.size === size && 
    item.color === color
  );
  
  // Вычисляем финальную цену с учетом скидки
  const finalPrice = product.discount ? 
    product.price - (product.price * (product.discount / 100)) : 
    product.price;
  
  if (existingItemIndex >= 0) {
    // Увеличиваем количество существующего товара
    this.items[existingItemIndex].quantity += quantity;
    this.items[existingItemIndex].price = finalPrice;
  } else {
    // Добавляем новый товар
    this.items.push({
      product: productId,
      quantity,
      price: finalPrice,
      size,
      color
    });
  }
  
  // Обновляем общую сумму
  await this.updateTotal();
  
  return this;
};

// Метод для удаления товара из корзины
CartSchema.methods.removeItem = async function(itemIndex) {
  if (itemIndex >= 0 && itemIndex < this.items.length) {
    this.items.splice(itemIndex, 1);
    await this.updateTotal();
    return true;
  }
  return false;
};

// Метод для изменения количества товара
CartSchema.methods.updateItemQuantity = async function(itemIndex, quantity) {
  if (itemIndex >= 0 && itemIndex < this.items.length && quantity > 0) {
    this.items[itemIndex].quantity = quantity;
    await this.updateTotal();
    return true;
  }
  return false;
};

// Метод для применения промокода
CartSchema.methods.applyPromoCode = async function(code) {
  // Здесь можно реализовать проверку промокода в базе данных
  // Например, через модель PromoCode
  const PromoCode = mongoose.model('PromoCode', new Schema({}));
  
  try {
    const promoCode = await PromoCode.findOne({ 
      code, 
      isActive: true,
      expiresAt: { $gt: Date.now() }
    });
    
    if (!promoCode) {
      throw new Error('Промокод недействителен или истек срок его действия');
    }
    
    this.promoCode = {
      code: promoCode.code,
      discount: promoCode.discount,
      expiresAt: promoCode.expiresAt
    };
    
    await this.updateTotal();
    return true;
  } catch (error) {
    // Если модель PromoCode не существует или произошла другая ошибка
    console.error('Ошибка применения промокода:', error);
    return false;
  }
};

// Метод для очистки корзины
CartSchema.methods.clear = async function() {
  this.items = [];
  this.total = 0;
  this.promoCode = null;
  this.lastModified = Date.now();
  
  return this.save();
};

module.exports = mongoose.model('Cart', CartSchema);
