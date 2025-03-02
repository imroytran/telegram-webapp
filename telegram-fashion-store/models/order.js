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