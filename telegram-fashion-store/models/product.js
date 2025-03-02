// models/product.js - Модель товара
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ProductSchema = new Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    required: true,
    trim: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  sizes: {
    type: [String],
    required: true
  },
  colors: {
    type: [String],
    required: true
  },
  images: {
    type: [String], // Пути к изображениям на Yandex Disk
    default: []
  },
  inStock: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'Admin',
    required: true
  },
  views: {
    type: Number,
    default: 0
  },
  rating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  reviews: [{
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    username: String,
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5
    },
    text: String,
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  discount: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  active: {
    type: Boolean,
    default: true
  },
  attributes: {
    type: Map,
    of: String,
    default: {}
  }
}, { timestamps: true });

// Виртуальное поле для вычисления цены со скидкой
ProductSchema.virtual('finalPrice').get(function() {
  if (!this.discount) return this.price;
  return this.price - (this.price * (this.discount / 100));
});

// Индексация для поиска
ProductSchema.index({ title: 'text', description: 'text', category: 'text' });

module.exports = mongoose.model('Product', ProductSchema);
