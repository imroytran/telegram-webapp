// models/user.js - Модель пользователя
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const UserSchema = new Schema({
  telegramId: {
    type: Number,
    required: true,
    unique: true
  },
  username: {
    type: String,
    required: true
  },
  firstName: {
    type: String
  },
  lastName: {
    type: String
  },
  phone: {
    type: String
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    match: [/.+\@.+\..+/, 'Введите корректный email адрес']
  },
  addresses: [{
    title: String,
    city: String,
    street: String,
    building: String,
    apartment: String,
    postalCode: String,
    isDefault: {
      type: Boolean,
      default: false
    }
  }],
  favorites: [{
    type: Schema.Types.ObjectId,
    ref: 'Product'
  }],
  subscribed: {
    type: Boolean,
    default: false
  },
  lastActivity: {
    type: Date,
    default: Date.now
  },
  totalSpent: {
    type: Number,
    default: 0
  },
  orderCount: {
    type: Number,
    default: 0
  }
}, { timestamps: true });

// Метод для генерации JWT токена для пользователя
UserSchema.methods.generateJWT = function() {
  const jwt = require('jsonwebtoken');
  const config = require('../config');
  
  return jwt.sign({ 
    id: this._id, 
    telegramId: this.telegramId 
  }, 
  config.JWT_SECRET, 
  { expiresIn: config.JWT_EXPIRATION });
};

// Метод для обновления статистики пользователя после заказа
UserSchema.methods.updateOrderStats = function(orderTotal) {
  this.totalSpent += orderTotal;
  this.orderCount += 1;
  this.lastActivity = Date.now();
  return this.save();
};

module.exports = mongoose.model('User', UserSchema);
