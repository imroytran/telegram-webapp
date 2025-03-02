// routes/webhooks.js - Маршруты для веб-хуков
const express = require('express');
const router = express.Router();
const OrderModel = require('../models/order');
const config = require('../config');
const crypto = require('crypto');

// Веб-хук для обработки уведомлений об оплате от ЮMoney
router.post('/yoomoney', async (req, res, next) => {
  try {
    const {
      notification_type,
      operation_id,
      amount,
      currency,
      datetime,
      sender,
      codepro,
      label,
      sha1_hash
    } = req.body;
    
    // Проверяем тип уведомления
    if (notification_type !== 'p2p-incoming') {
      return res.status(400).send('Wrong notification type');
    }
    
    // Проверяем подпись для безопасности
    const string = [
      notification_type,
      operation_id,
      amount,
      currency,
      datetime,
      sender,
      codepro,
      config.YOOMONEY_SECRET_KEY,
      label
    ].join('&');
    
    const hash = crypto.createHash('sha1').update(string).digest('hex');
    
    if (hash !== sha1_hash) {
      console.error('YooMoney webhook: Invalid signature');
      return res.status(400).send('Invalid signature');
    }
    
    // Извлекаем ID заказа из метки
    const orderId = label.replace('order_', '');
    
    // Находим заказ
    const order = await OrderModel.findById(orderId);
    
    if (!order) {
      console.error(`YooMoney webhook: Order ${orderId} not found`);
      return res.status(404).send('Order not found');
    }
    
    // Проверяем сумму платежа
    if (parseFloat(amount) < order.total) {
      console.error(`YooMoney webhook: Payment amount ${amount} is less than order total ${order.total}`);
      // Отмечаем частичную оплату, но не меняем статус
      return res.status(400).send('Payment amount is less than order total');
    }
    
    // Обновляем статус оплаты заказа
    await order.updatePaymentStatus('paid', operation_id);
    
    console.log(`YooMoney webhook: Order ${orderId} marked as paid`);
    
    // Уведомляем пользователя о успешной оплате через бот
    // Это будет реализовано через бота Telegram
    
    res.send('OK');
  } catch (error) {
    console.error('YooMoney webhook error:', error);
    next(error);
  }
});

// Веб-хук для интеграции с системой доставки (пример)
router.post('/delivery', async (req, res, next) => {
  try {
    const { order_id, status, tracking_number, estimated_delivery_date } = req.body;
    
    // Проверяем подпись или API ключ для безопасности
    // const apiKey = req.headers['x-api-key'];
    // if (apiKey !== config.DELIVERY_API_KEY) {
    //   return res.status(401).send('Unauthorized');
    // }
    
    // Находим заказ
    const order = await OrderModel.findById(order_id);
    
    if (!order) {
      console.error(`Delivery webhook: Order ${order_id} not found`);
      return res.status(404).send('Order not found');
    }
    
    // Обновляем статус доставки
    switch (status) {
      case 'processing':
        await order.updateStatus('processing', 'Обновлено системой доставки');
        break;
      case 'shipped':
        await order.updateStatus('shipped', 'Отправлено службой доставки');
        if (tracking_number) {
          await order.addTrackingNumber(tracking_number, estimated_delivery_date);
        }
        break;
      case 'delivered':
        await order.updateStatus('completed', 'Доставлено получателю');
        break;
      case 'failed':
        await order.updateStatus('processing', 'Проблема с доставкой: ' + (req.body.message || ''));
        break;
    }
    
    console.log(`Delivery webhook: Order ${order_id} status updated to ${status}`);
    
    res.send('OK');
  } catch (error) {
    console.error('Delivery webhook error:', error);
    next(error);
  }
});

// Веб-хук для синхронизации данных с внешними системами (например, 1С)
router.post('/sync', async (req, res, next) => {
  try {
    // Здесь может быть логика для синхронизации товаров, цен, остатков и т.д.
    // Например, обновление информации о товарах из внешней системы
    
    res.json({
      success: true,
      message: 'Sync endpoint is working'
    });
  } catch (error) {
    console.error('Sync webhook error:', error);
    next(error);
  }
});

// Экспортируем маршруты
module.exports = router;