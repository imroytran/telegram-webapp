// models/admin.js - Модель администратора
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const bcrypt = require('bcryptjs');

const AdminSchema = new Schema({
  telegramId: {
    type: Number,
    required: true,
    unique: true
  },
  username: {
    type: String,
    required: true
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    match: [/.+\@.+\..+/, 'Введите корректный email адрес']
  },
  password: {
    type: String,
    select: false // Не включать поле в результаты запросов
  },
  role: {
    type: String,
    enum: ['admin', 'superadmin'],
    default: 'admin'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date,
    default: Date.now
  },
  permissions: {
    manageProducts: { type: Boolean, default: true },
    manageOrders: { type: Boolean, default: true },
    manageUsers: { type: Boolean, default: false },
    manageAdmins: { type: Boolean, default: false },
    viewStatistics: { type: Boolean, default: true }
  }
}, { timestamps: true });

// Метод для проверки пароля
AdminSchema.methods.comparePassword = async function(candidatePassword) {
  if (!this.password) return false;
  return await bcrypt.compare(candidatePassword, this.password);
};

// Middleware для хеширования пароля перед сохранением
AdminSchema.pre('save', async function(next) {
  // Хешируем пароль только если он был изменен или является новым
  if (this.password && (this.isModified('password') || this.isNew)) {
    try {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(this.password, salt);
      this.password = hashedPassword;
      next();
    } catch (error) {
      next(error);
    }
  } else {
    next();
  }
});

// Метод для создания JWT токена для администратора
AdminSchema.methods.generateJWT = function() {
  const jwt = require('jsonwebtoken');
  const config = require('../config');
  
  return jwt.sign({ 
    id: this._id, 
    telegramId: this.telegramId,
    role: this.role,
    permissions: this.permissions
  }, 
  config.JWT_SECRET, 
  { expiresIn: config.JWT_EXPIRATION });
};

module.exports = mongoose.model('Admin', AdminSchema);
