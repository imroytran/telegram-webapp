// models/order.js - Модель заказа
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const OrderItemSchema = new Schema({
  product: {
    type: Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  title: { // Сохраняем название товара на момент заказа
    type: String,
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
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
  }
});

const OrderSchema = new Schema({
  telegramId: {
    type: Number,
    required: true
  },
  username: {
    type: String,
    required: true
  },
  items: [OrderItemSchema],
  total: {
    type: Number,
    required: true,
    min: 0
  },
  address: {
    type: String,
    required: true
  },
  phone: {
    type: String,
    required: true
  },
  email: String,
  deliveryMethod: {
    type: String,
    enum: ['courier', 'pickup', 'post'],
    default: 'courier'
  },
  paymentMethod: {
    type: String,
    enum: ['online', 'cash', 'card_on_delivery'],
    default: 'online'
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'shipped', 'completed', 'cancelled'],
    default: 'pending'
  },
  paymentStatus: {
    type: String,
    enum: ['awaiting', 'paid', 'failed'],
    default: 'awaiting'
  },
  paymentDetails: {
    transactionId: String,
    paymentDate: Date,
    paymentMethod: String,
    amount: Number
  },
  notes: String,
  promoCode: {
    code: String,
    discount: Number
  },
  statusHistory: [{
    status: {
      type: String,
      enum: ['pending', 'processing', 'shipped', 'completed', 'cancelled']
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    comment: String,
    changedBy: {
      type: Schema.Types.ObjectId,
      ref: 'Admin'
    }
  }],
  trackingNumber: String,
  estimatedDeliveryDate: Date
}, { timestamps: true });

// Middleware для добавления начального статуса в историю
OrderSchema.pre('save', function(next) {
  if (this.isNew) {
    this.statusHistory = [{
      status: this.status,
      timestamp: Date.now(),
      comment: 'Заказ создан'
    }];
  } else if (this.isModified('status')) {
    // Добавляем новый статус в историю при изменении
    this.statusHistory.push({
      status: this.status,
      timestamp: Date.now()
    });
  }
  next();
});

// Метод для изменения статуса заказа
OrderSchema.methods.updateStatus = function(status, comment, changedBy) {
  this.status = status;
  this.statusHistory.push({
    status,
    timestamp: Date.now(),
    comment,
    changedBy
  });
  return this.save();
};

// Метод для обновления статуса оплаты
OrderSchema.methods.updatePaymentStatus = function(paymentStatus, transactionId = null) {
  this.paymentStatus = paymentStatus;
  
  if (transactionId) {
    this.paymentDetails = {
      ...this.paymentDetails,
      transactionId,
      paymentDate: Date.now()
    };
  }
  
  // Если заказ оплачен и находится в статусе "ожидает", обновляем до "в обработке"
  if (paymentStatus === 'paid' && this.status === 'pending') {
    this.status = 'processing';
    this.statusHistory.push({
      status: 'processing',
      timestamp: Date.now(),
      comment: 'Автоматическое обновление статуса после оплаты'
    });
  }
  
  return this.save();
};

// Метод для добавления трекинг-номера
OrderSchema.methods.addTrackingNumber = function(trackingNumber, estimatedDeliveryDate = null) {
  this.trackingNumber = trackingNumber;
  
  if (estimatedDeliveryDate) {
    this.estimatedDeliveryDate = estimatedDeliveryDate;
  }
  
  return this.save();
};

// Статический метод для получения статистики заказов
OrderSchema.statics.getStatistics = async function(period = 'month') {
  let dateFilter = {};
  const now = new Date();
  
  switch (period) {
    case 'day':
      dateFilter = {
        createdAt: {
          $gte: new Date(now.getFullYear(), now.getMonth(), now.getDate())
        }
      };
      break;
    case 'week':
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay());
      dateFilter = {
        createdAt: { $gte: weekStart }
      };
      break;
    case 'month':
      dateFilter = {
        createdAt: {
          $gte: new Date(now.getFullYear(), now.getMonth(), 1)
        }
      };
      break;
    case 'year':
      dateFilter = {
        createdAt: {
          $gte: new Date(now.getFullYear(), 0, 1)
        }
      };
      break;
    default:
      dateFilter = {};
  }
  
  // Получаем общее количество заказов
  const totalOrders = await this.countDocuments(dateFilter);
  
  // Получаем количество заказов по статусам
  const ordersByStatus = await this.aggregate([
    { $match: dateFilter },
    { $group: { _id: '$status', count: { $sum: 1 } } }
  ]);
  
  // Получаем общую сумму заказов
  const totalRevenue = await this.aggregate([
    { $match: { ...dateFilter, paymentStatus: 'paid' } },
    { $group: { _id: null, total: { $sum: '$total' } } }
  ]);
  
  // Получаем популярные товары
  const popularProducts = await this.aggregate([
    { $match: dateFilter },
    { $unwind: '$items' },
    { $group: { 
      _id: '$items.product', 
      title: { $first: '$items.title' },
      totalQuantity: { $sum: '$items.quantity' },
      totalRevenue: { $sum: { $multiply: ['$items.quantity', '$items.price'] } }
    }},
    { $sort: { totalQuantity: -1 } },
    { $limit: 5 }
  ]);
  
  // Преобразуем результаты агрегации в более удобный формат
  const ordersByStatusMap = {};
  ordersByStatus.forEach(item => {
    ordersByStatusMap[item._id] = item.count;
  });
  
  return {
    totalOrders,
    ordersByStatus: ordersByStatusMap,
    totalRevenue: totalRevenue.length > 0 ? totalRevenue[0].total : 0,
    popularProducts,
    period
  };
};

// Метод для создания заказа из корзины
OrderSchema.statics.createFromCart = async function(cart, orderData) {
  // Проверяем наличие обязательных данных
  if (!cart || !orderData || !orderData.address || !orderData.phone) {
    throw new Error('Недостаточно данных для создания заказа');
  }
  
  // Проверяем, что корзина не пуста
  if (!cart.items || cart.items.length === 0) {
    throw new Error('Корзина пуста');
  }
  
  // Обновляем цены и наличие товаров перед созданием заказа
  const Product = mongoose.model('Product');
  const orderItems = [];
  
  for (const item of cart.items) {
    const product = await Product.findById(item.product);
    
    if (!product) {
      throw new Error(`Товар с ID ${item.product} не найден`);
    }
    
    if (!product.inStock) {
      throw new Error(`Товар "${product.title}" отсутствует на складе`);
    }
    
    // Создаем элемент заказа
    orderItems.push({
      product: product._id,
      title: product.title,
      quantity: item.quantity,
      price: item.price, // Используем цену из корзины (она уже учитывает скидки)
      size: item.size,
      color: item.color
    });
  }
  
  // Создаем новый заказ
  const order = new this({
    telegramId: cart.telegramId,
    username: cart.username,
    items: orderItems,
    total: cart.total,
    address: orderData.address,
    phone: orderData.phone,
    email: orderData.email,
    deliveryMethod: orderData.deliveryMethod || 'courier',
    paymentMethod: orderData.paymentMethod || 'online',
    notes: orderData.notes,
    promoCode: cart.promoCode
  });
  
  // Сохраняем заказ
  await order.save();
  
  // Очищаем корзину
  await cart.clear();
  
  return order;
};

module.exports = mongoose.model('Order', OrderSchema);