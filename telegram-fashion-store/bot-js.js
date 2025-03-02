// bot.js - Основной файл Telegram бота
const { Telegraf, Scenes, session, Markup } = require('telegraf');
const mongoose = require('mongoose');
const config = require('./config');
const ProductModel = require('./models/product');
const AdminModel = require('./models/admin');
const CartModel = require('./models/cart');
const OrderModel = require('./models/order');
const yadiskService = require('./yadisk-service');
const axios = require('axios');
const cheerio = require('cheerio');

// Инициализация бота Telegram
const bot = new Telegraf(config.TELEGRAM_BOT_TOKEN);

// Подключение к MongoDB
mongoose.connect(config.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('MongoDB успешно подключена'))
.catch(err => console.error('Ошибка подключения к MongoDB:', err));

// Middleware для проверки прав администратора
const adminMiddleware = async (ctx, next) => {
  const userId = ctx.from.id;
  const admin = await AdminModel.findOne({ telegramId: userId });
  
  if (!admin) {
    return ctx.reply('У вас нет прав администратора');
  }
  
  ctx.state.admin = admin;
  return next();
};

// Middleware для пользователей
const userMiddleware = async (ctx, next) => {
  const userId = ctx.from.id;
  const username = ctx.from.username || ctx.from.first_name;
  
  // Создаем или находим корзину для пользователя
  let cart = await CartModel.findOne({ telegramId: userId });
  if (!cart) {
    cart = new CartModel({
      telegramId: userId,
      username: username,
      items: [],
      total: 0
    });
    await cart.save();
  }
  
  ctx.state.cart = cart;
  return next();
};

// Сцена для добавления товара администратором
const addProductScene = new Scenes.WizardScene(
  'ADD_PRODUCT',
  // Шаг 1: Ввод названия товара
  async (ctx) => {
    ctx.wizard.state.productData = {};
    await ctx.reply('Введите название товара:');
    return ctx.wizard.next();
  },
  // Шаг 2: Ввод описания
  async (ctx) => {
    ctx.wizard.state.productData.title = ctx.message.text;
    await ctx.reply('Введите описание товара:');
    return ctx.wizard.next();
  },
  // Шаг 3: Ввод категории
  async (ctx) => {
    ctx.wizard.state.productData.description = ctx.message.text;
    await ctx.reply('Введите категорию товара:');
    return ctx.wizard.next();
  },
  // Шаг 4: Ввод цены
  async (ctx) => {
    ctx.wizard.state.productData.category = ctx.message.text;
    await ctx.reply('Введите цену товара в рублях (только число):');
    return ctx.wizard.next();
  },
  // Шаг 5: Ввод размеров
  async (ctx) => {
    const price = parseFloat(ctx.message.text);
    if (isNaN(price)) {
      await ctx.reply('Пожалуйста, введите корректную цену (только число):');
      return;
    }
    
    ctx.wizard.state.productData.price = price;
    await ctx.reply('Введите доступные размеры через запятую (например: S, M, L):');
    return ctx.wizard.next();
  },
  // Шаг 6: Ввод цветов
  async (ctx) => {
    const sizes = ctx.message.text.split(',').map(size => size.trim());
    ctx.wizard.state.productData.sizes = sizes;
    
    await ctx.reply('Введите доступные цвета через запятую (например: красный, синий, черный):');
    return ctx.wizard.next();
  },
  // Шаг 7: Загрузка изображений (до 5 изображений)
  async (ctx) => {
    const colors = ctx.message.text.split(',').map(color => color.trim());
    ctx.wizard.state.productData.colors = colors;
    
    ctx.wizard.state.productData.images = [];
    await ctx.reply('Пришлите от 1 до 5 изображений товара (по одному за раз). Когда закончите, напишите "Готово"');
    return ctx.wizard.next();
  },
  // Шаг 8: Сохранение товара
  async (ctx) => {
    // Если пользователь прислал фото
    if (ctx.message.photo && ctx.wizard.state.productData.images.length < 5) {
      const photo = ctx.message.photo.pop(); // Берем версию с наилучшим качеством
      const fileLink = await ctx.telegram.getFileLink(photo.file_id);
      
      try {
        // Загрузка изображения на Yandex Disk
        const imageResponse = await axios.get(fileLink.href, { responseType: 'arraybuffer' });
        const buffer = Buffer.from(imageResponse.data, 'binary');
        const fileName = `product_${Date.now()}_${ctx.wizard.state.productData.images.length + 1}.jpg`;
        
        const uploadedPath = await yadiskService.uploadFile(buffer, fileName);
        
        // Добавляем ссылку на изображение в массив
        ctx.wizard.state.productData.images.push(uploadedPath);
        await ctx.reply(`Изображение ${ctx.wizard.state.productData.images.length} загружено. ` +
                        `Пришлите еще изображение или напишите "Готово", если закончили.`);
        return;
      } catch (error) {
        console.error('Ошибка загрузки изображения:', error);
        await ctx.reply('Произошла ошибка при загрузке изображения. Попробуйте еще раз.');
        return;
      }
    } 
    // Если пользователь написал "Готово"
    else if (ctx.message.text === 'Готово') {
      // Проверяем, есть ли хотя бы одно изображение
      if (ctx.wizard.state.productData.images.length === 0) {
        await ctx.reply('Необходимо загрузить хотя бы одно изображение.');
        return;
      }
      
      try {
        // Создаем новый товар
        const newProduct = new ProductModel({
          title: ctx.wizard.state.productData.title,
          description: ctx.wizard.state.productData.description,
          category: ctx.wizard.state.productData.category,
          price: ctx.wizard.state.productData.price,
          sizes: ctx.wizard.state.productData.sizes,
          colors: ctx.wizard.state.productData.colors,
          images: ctx.wizard.state.productData.images,
          createdBy: ctx.state.admin._id
        });
        
        await newProduct.save();
        
        await ctx.reply(`Товар "${newProduct.title}" успешно добавлен!`, 
                       Markup.inlineKeyboard([
                         Markup.button.callback('Вернуться в меню админа', 'admin_menu')
                       ]));
        
        return ctx.scene.leave();
      } catch (error) {
        console.error('Ошибка сохранения товара:', error);
        await ctx.reply('Произошла ошибка при сохранении товара.');
        return ctx.scene.leave();
      }
    } else {
      await ctx.reply('Пришлите изображение или напишите "Готово", если закончили.');
      return;
    }
  }
);

// Сцена для импорта товара с Ozon
const importFromOzonScene = new Scenes.WizardScene(
  'IMPORT_FROM_OZON',
  // Шаг 1: Запрос ссылки на товар Ozon
  async (ctx) => {
    await ctx.reply('Введите ссылку на товар с Ozon:');
    return ctx.wizard.next();
  },
  // Шаг 2: Парсинг данных с Ozon
  async (ctx) => {
    const url = ctx.message.text;
    
    if (!url.includes('ozon.ru')) {
      await ctx.reply('Неверная ссылка. Пожалуйста, введите корректную ссылку на товар Ozon.');
      return;
    }
    
    try {
      await ctx.reply('Начинаю импорт товара с Ozon...');
      
      // Получаем HTML страницы товара
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      
      const $ = cheerio.load(response.data);
      
      // Парсим данные товара
      const title = $('h1').text().trim();
      const description = $('.product-description').text().trim();
      const priceText = $('.price-block__final-price').text().trim().replace(/[^\d]/g, '');
      const price = parseInt(priceText, 10);
      
      // Получаем изображения
      const images = [];
      $('.gallery-image-container img').each((i, el) => {
        if (i < 5) { // Ограничиваем до 5 изображений
          const imgUrl = $(el).attr('src');
          if (imgUrl) images.push(imgUrl);
        }
      });
      
      // Сохраняем информацию о товаре
      const productData = {
        title,
        description,
        price: isNaN(price) ? 0 : price,
        category: 'Импорт с Ozon', // Дефолтная категория
        sizes: [], // Пустые размеры для последующего редактирования
        colors: [], // Пустые цвета для последующего редактирования
        images: []
      };
      
      // Загружаем изображения на Yandex Disk
      for (let i = 0; i < images.length; i++) {
        try {
          const imageResponse = await axios.get(images[i], { responseType: 'arraybuffer' });
          const buffer = Buffer.from(imageResponse.data, 'binary');
          const fileName = `product_ozon_${Date.now()}_${i + 1}.jpg`;
          
          const uploadedPath = await yadiskService.uploadFile(buffer, fileName);
          productData.images.push(uploadedPath);
          
          await ctx.reply(`Изображение ${i + 1}/${images.length} загружено`);
        } catch (error) {
          console.error('Ошибка загрузки изображения:', error);
        }
      }
      
      // Создаем новый товар
      const newProduct = new ProductModel({
        ...productData,
        createdBy: ctx.state.admin._id
      });
      
      await newProduct.save();
      
      await ctx.reply(`Товар "${newProduct.title}" успешно импортирован с Ozon!
        
Вам необходимо отредактировать размеры и цвета товара, так как они не могут быть автоматически импортированы.`, 
                     Markup.inlineKeyboard([
                       Markup.button.callback('Редактировать товар', `edit_product_${newProduct._id}`),
                       Markup.button.callback('Вернуться в меню админа', 'admin_menu')
                     ]));
      
      return ctx.scene.leave();
    } catch (error) {
      console.error('Ошибка импорта товара с Ozon:', error);
      await ctx.reply('Произошла ошибка при импорте товара с Ozon. Попробуйте еще раз.');
      return ctx.scene.leave();
    }
  }
);

// Настройка сцен
const stage = new Scenes.Stage([addProductScene, importFromOzonScene]);

// Middleware
bot.use(session());
bot.use(stage.middleware());

// Команды пользователя
bot.start(async (ctx) => {
  // Проверяем, является ли пользователь администратором
  const admin = await AdminModel.findOne({ telegramId: ctx.from.id });
  
  if (admin) {
    ctx.reply('Добро пожаловать в панель администратора магазина!', 
             Markup.keyboard([
               ['Добавить товар', 'Импорт с Ozon'],
               ['Список товаров', 'Статистика заказов'],
               ['Перейти в режим покупателя']
             ]).resize());
  } else {
    ctx.reply('Добро пожаловать в наш магазин женской одежды!', 
             Markup.keyboard([
               ['Каталог', 'Корзина'],
               ['Мои заказы', 'Помощь']
             ]).resize());
  }
});

// Обработчик для входа администратора
bot.command('admin', async (ctx) => {
  await ctx.reply('Введите секретный код администратора:');
  ctx.scene.state.awaitingAdminCode = true;
});

// Обработчик для проверки секретного кода администратора
bot.on('text', async (ctx, next) => {
  if (ctx.scene.state.awaitingAdminCode) {
    const adminCode = ctx.message.text;
    
    if (adminCode === config.ADMIN_SECRET_CODE) {
      const telegramId = ctx.from.id;
      const username = ctx.from.username || ctx.from.first_name;
      
      // Проверяем, существует ли админ
      let admin = await AdminModel.findOne({ telegramId });
      
      if (!admin) {
        // Создаем нового админа
        admin = new AdminModel({
          telegramId,
          username,
          isActive: true
        });
        
        await admin.save();
      } else if (!admin.isActive) {
        // Активируем админа, если он был деактивирован
        admin.isActive = true;
        await admin.save();
      }
      
      await ctx.reply('Вы успешно авторизованы как администратор!', 
                     Markup.keyboard([
                       ['Добавить товар', 'Импорт с Ozon'],
                       ['Список товаров', 'Статистика заказов'],
                       ['Перейти в режим покупателя']
                     ]).resize());
    } else {
      await ctx.reply('Неверный код администратора.');
    }
    
    ctx.scene.state.awaitingAdminCode = false;
    return;
  }
  
  await next();
});

// Обработчики команд администратора
bot.hears('Добавить товар', adminMiddleware, (ctx) => {
  ctx.scene.enter('ADD_PRODUCT');
});

bot.hears('Импорт с Ozon', adminMiddleware, (ctx) => {
  ctx.scene.enter('IMPORT_FROM_OZON');
});

bot.hears('Список товаров', adminMiddleware, async (ctx) => {
  const products = await ProductModel.find().sort({ createdAt: -1 }).limit(10);
  
  if (products.length === 0) {
    return ctx.reply('Товаров пока нет.');
  }
  
  for (const product of products) {
    const message = `
Название: ${product.title}
Категория: ${product.category}
Цена: ${product.price} руб.
Размеры: ${product.sizes.join(', ')}
Цвета: ${product.colors.join(', ')}
    `;
    
    // Если есть изображения, отправляем первое
    if (product.images && product.images.length > 0) {
      const imageUrl = await yadiskService.getDownloadLink(product.images[0]);
      await ctx.replyWithPhoto({ url: imageUrl }, {
        caption: message,
        ...Markup.inlineKeyboard([
          [Markup.button.callback('Редактировать', `edit_product_${product._id}`)],
          [Markup.button.callback('Удалить', `delete_product_${product._id}`)]
        ])
      });
    } else {
      await ctx.reply(message, Markup.inlineKeyboard([
        [Markup.button.callback('Редактировать', `edit_product_${product._id}`)],
        [Markup.button.callback('Удалить', `delete_product_${product._id}`)]
      ]));
    }
  }
});

bot.hears('Статистика заказов', adminMiddleware, async (ctx) => {
  const totalOrders = await OrderModel.countDocuments();
  const completedOrders = await OrderModel.countDocuments({ status: 'completed' });
  const pendingOrders = await OrderModel.countDocuments({ status: 'pending' });
  
  const totalRevenue = await OrderModel.aggregate([
    { $match: { status: 'completed' } },
    { $group: { _id: null, total: { $sum: '$total' } } }
  ]);
  
  const revenue = totalRevenue.length > 0 ? totalRevenue[0].total : 0;
  
  await ctx.reply(`📊 Статистика заказов:

Всего заказов: ${totalOrders}
Выполненных заказов: ${completedOrders}
Ожидающих заказов: ${pendingOrders}
Общий доход: ${revenue} руб.
  `);
  
  // Отправляем последние 5 заказов
  const recentOrders = await OrderModel.find()
    .sort({ createdAt: -1 })
    .limit(5)
    .populate('items.product');
  
  if (recentOrders.length > 0) {
    await ctx.reply('Последние заказы:');
    
    for (const order of recentOrders) {
      const orderItems = order.items.map(item => 
        `${item.product.title} x ${item.quantity} (${item.size}, ${item.color})`
      ).join('\n');
      
      await ctx.reply(`
Заказ #${order._id.toString().slice(-6)}
Статус: ${order.status}
Сумма: ${order.total} руб.
Дата: ${order.createdAt.toLocaleDateString()}

Товары:
${orderItems}
      `, Markup.inlineKeyboard([
        Markup.button.callback('Подробнее', `order_details_${order._id}`)
      ]));
    }
  }
});

// Пользовательские команды
bot.hears('Каталог', userMiddleware, async (ctx) => {
  const categories = await ProductModel.distinct('category');
  
  const buttons = categories.map(category => [Markup.button.callback(category, `category_${category}`)]);
  buttons.push([Markup.button.callback('Все товары', 'category_all')]);
  
  await ctx.reply('Выберите категорию:', Markup.inlineKeyboard(buttons));
});

// Обработчик выбора категории
bot.action(/category_(.+)/, userMiddleware, async (ctx) => {
  const category = ctx.match[1];
  let products;
  
  if (category === 'all') {
    products = await ProductModel.find().limit(10);
  } else {
    products = await ProductModel.find({ category }).limit(10);
  }
  
  if (products.length === 0) {
    return ctx.reply('В данной категории нет товаров.');
  }
  
  for (const product of products) {
    const message = `
${product.title}
Цена: ${product.price} руб.
Размеры: ${product.sizes.join(', ')}
Цвета: ${product.colors.join(', ')}
    `;
    
    // Если есть изображения, отправляем первое
    if (product.images && product.images.length > 0) {
      const imageUrl = await yadiskService.getDownloadLink(product.images[0]);
      await ctx.replyWithPhoto({ url: imageUrl }, {
        caption: message,
        ...Markup.inlineKeyboard([
          [Markup.button.callback('Подробнее', `product_details_${product._id}`)],
          [Markup.button.callback('Добавить в корзину', `add_to_cart_${product._id}`)]
        ])
      });
    } else {
      await ctx.reply(message, Markup.inlineKeyboard([
        [Markup.button.callback('Подробнее', `product_details_${product._id}`)],
        [Markup.button.callback('Добавить в корзину', `add_to_cart_${product._id}`)]
      ]));
    }
  }
});

// Обработчик просмотра деталей товара
bot.action(/product_details_(.+)/, userMiddleware, async (ctx) => {
  const productId = ctx.match[1];
  const product = await ProductModel.findById(productId);
  
  if (!product) {
    return ctx.reply('Товар не найден.');
  }
  
  const message = `
${product.title}

${product.description}

Цена: ${product.price} руб.
Категория: ${product.category}
Размеры: ${product.sizes.join(', ')}
Цвета: ${product.colors.join(', ')}
  `;
  
  // Создаем клавиатуру с размерами и цветами
  const sizeButtons = product.sizes.map(size => 
    Markup.button.callback(`Размер: ${size}`, `select_size_${productId}_${size}`)
  );
  
  const colorButtons = product.colors.map(color => 
    Markup.button.callback(`Цвет: ${color}`, `select_color_${productId}_${color}`)
  );
  
  const keyboard = [
    ...sizeButtons.map(button => [button]),
    ...colorButtons.map(button => [button]),
    [Markup.button.callback('Добавить в корзину', `add_to_cart_${productId}`)]
  ];
  
  // Отправляем все изображения товара в виде альбома
  if (product.images && product.images.length > 0) {
    const mediaGroup = [];
    
    for (const imagePath of product.images) {
      const imageUrl = await yadiskService.getDownloadLink(imagePath);
      mediaGroup.push({
        type: 'photo',
        media: { url: imageUrl }
      });
    }
    
    // Сначала отправляем альбом с изображениями
    await ctx.replyWithMediaGroup(mediaGroup);
    
    // Затем отправляем описание и кнопки
    await ctx.reply(message, Markup.inlineKeyboard(keyboard));
  } else {
    await ctx.reply(message, Markup.inlineKeyboard(keyboard));
  }
});

// Обработчики выбора размера и цвета
bot.action(/select_size_(.+)_(.+)/, userMiddleware, async (ctx) => {
  const [, productId, size] = ctx.match;
  ctx.session.selectedSize = size;
  await ctx.answerCbQuery(`Выбран размер: ${size}`);
});

bot.action(/select_color_(.+)_(.+)/, userMiddleware, async (ctx) => {
  const [, productId, color] = ctx.match;
  ctx.session.selectedColor = color;
  await ctx.answerCbQuery(`Выбран цвет: ${color}`);
});

// Обработчик добавления товара в корзину
bot.action(/add_to_cart_(.+)/, userMiddleware, async (ctx) => {
  const productId = ctx.match[1];
  const product = await ProductModel.findById(productId);
  
  if (!product) {
    return ctx.answerCbQuery('Товар не найден.', { show_alert: true });
  }
  
  // Проверяем, выбраны ли размер и цвет
  const size = ctx.session.selectedSize || product.sizes[0];
  const color = ctx.session.selectedColor || product.colors[0];
  
  if (!size || !color) {
    return ctx.answerCbQuery('Пожалуйста, выберите размер и цвет.', { show_alert: true });
  }
  
  // Получаем корзину пользователя
  const cart = ctx.state.cart;
  
  // Проверяем, есть ли товар уже в корзине
  const existingItemIndex = cart.items.findIndex(item => 
    item.product.toString() === productId && 
    item.size === size && 
    item.color === color
  );
  
  if (existingItemIndex >= 0) {
    // Увеличиваем количество
    cart.items[existingItemIndex].quantity += 1;
  } else {
    // Добавляем новый товар
    cart.items.push({
      product: productId,
      quantity: 1,
      size,
      color,
      price: product.price
    });
  }
  
  // Пересчитываем общую сумму
  cart.total = cart.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  
  await cart.save();
  
  await ctx.answerCbQuery(`Товар "${product.title}" добавлен в корзину!`, { show_alert: true });
  
  // Сбрасываем выбранные размер и цвет
  delete ctx.session.selectedSize;
  delete ctx.session.selectedColor;
});

// Обработчик просмотра корзины
bot.hears('Корзина', userMiddleware, async (ctx) => {
  const cart = await CartModel.findOne({ telegramId: ctx.from.id }).populate('items.product');
  
  if (!cart || cart.items.length === 0) {
    return ctx.reply('Ваша корзина пуста.');
  }
  
  let message = '🛒 Ваша корзина:\n\n';
  
  for (let i = 0; i < cart.items.length; i++) {
    const item = cart.items[i];
    message += `${i+1}. ${item.product.title}\n`;
    message += `   Размер: ${item.size}, Цвет: ${item.color}\n`;
    message += `   Количество: ${item.quantity} x ${item.price} руб.\n`;
    message += `   Сумма: ${item.quantity * item.price} руб.\n\n`;
  }
  
  message += `Общая сумма: ${cart.total} руб.`;
  
  const keyboard = [
    [Markup.button.callback('Оформить заказ', 'checkout')],
    ...cart.items.map((_, index) => [
      Markup.button.callback(`❌ Удалить ${index+1}`, `remove_from_cart_${index}`)
    ]),
    [Markup.button.callback('Очистить корзину', 'clear_cart')]
  ];
  
  await ctx.reply(message, Markup.inlineKeyboard(keyboard));
});

// Обработчик удаления товара из корзины
bot.action(/remove_from_cart_(\d+)/, userMiddleware, async (ctx) => {
  const index = parseInt(ctx.match[1]);
  const cart = ctx.state.cart;
  
  if (index >= 0 && index < cart.items.length) {
    cart.items.splice(index, 1);
    
    // Пересчитываем общую сумму
    cart.total = cart.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    await cart.save();
    
    await ctx.answerCbQuery('Товар удален из корзины!');
    
    // Обновляем корзину
    return ctx.editMessageText('Корзина обновлена! Нажмите "Корзина" для просмотра.');
  }
  
  await ctx.answerCbQuery('Ошибка при удалении товара.');
});

// Обработчик очистки корзины
bot.action('clear_cart', userMiddleware, async (ctx) => {
  const cart = ctx.state.cart;
  
  cart.items = [];
  cart.total = 0;
  
  await cart.save();
  
  await ctx.answerCbQuery('Корзина очищена!');
  await ctx.editMessageText('Ваша корзина пуста.');
});

// Обработчик для оформления заказа
bot.action('checkout', userMiddleware, async (ctx) => {
  const cart = await CartModel.findOne({ telegramId: ctx.from.id }).populate('items.product');
  
  if (!cart || cart.items.length === 0) {
    return ctx.answerCbQuery('Ваша корзина пуста.', { show_alert: true });
  }
  
  // Создаем новую сцену для оформления заказа
  ctx.session.checkoutData = {
    cart: cart,
    step: 'address'
  };
  
  await ctx.editMessageText('Для оформления заказа укажите ваш адрес доставки:', 
    Markup.inlineKeyboard([
      [Markup.button.callback('Отменить', 'cancel_checkout')]
    ])
  );
});

// Обработчик отмены оформления заказа
bot.action('cancel_checkout', userMiddleware, async (ctx) => {
  delete ctx.session.checkoutData;
  await ctx.answerCbQuery('Оформление заказа отменено');
  await ctx.editMessageText('Оформление заказа отменено. Вы можете вернуться к покупкам.');
});

// Обработчик ввода адреса
bot.on('text', userMiddleware, async (ctx, next) => {
  if (ctx.session.checkoutData && ctx.session.checkoutData.step === 'address') {
    ctx.session.checkoutData.address = ctx.message.text;
    ctx.session.checkoutData.step = 'phone';
    
    await ctx.reply('Укажите ваш контактный телефон:');
    return;
  }
  
  if (ctx.session.checkoutData && ctx.session.checkoutData.step === 'phone') {
    ctx.session.checkoutData.phone = ctx.message.text;
    ctx.session.checkoutData.step = 'confirmation';
    
    const cart = ctx.session.checkoutData.cart;
    
    let message = '📋 Подтвердите ваш заказ:\n\n';
    
    for (const item of cart.items) {
      message += `${item.product.title}\n`;
      message += `Размер: ${item.size}, Цвет: ${item.color}\n`;
      message += `Количество: ${item.quantity} x ${item.price} руб.\n`;
      message += `Сумма: ${item.quantity * item.price} руб.\n\n`;
    }
    
    message += `Общая сумма: ${cart.total} руб.\n\n`;
    message += `Адрес доставки: ${ctx.session.checkoutData.address}\n`;
    message += `Телефон: ${ctx.session.checkoutData.phone}\n\n`;
    message += 'Все верно?';
    
    await ctx.reply(message, Markup.inlineKeyboard([
      [Markup.button.callback('Подтвердить заказ', 'confirm_order')],
      [Markup.button.callback('Изменить адрес', 'change_address')],
      [Markup.button.callback('Изменить телефон', 'change_phone')],
      [Markup.button.callback('Отменить заказ', 'cancel_checkout')]
    ]));
    
    return;
  }
  
  await next();
});

// Обработчики изменения данных
bot.action('change_address', userMiddleware, async (ctx) => {
  ctx.session.checkoutData.step = 'address';
  await ctx.editMessageText('Укажите новый адрес доставки:');
});

bot.action('change_phone', userMiddleware, async (ctx) => {
  ctx.session.checkoutData.step = 'phone';
  await ctx.editMessageText('Укажите новый контактный телефон:');
});

// Обработчик подтверждения заказа
bot.action('confirm_order', userMiddleware, async (ctx) => {
  try {
    const { cart, address, phone } = ctx.session.checkoutData;
    
    // Создаем новый заказ
    const order = new OrderModel({
      telegramId: ctx.from.id,
      username: ctx.from.username || ctx.from.first_name,
      items: cart.items,
      total: cart.total,
      address,
      phone,
      status: 'pending',
      paymentStatus: 'awaiting'
    });
    
    await order.save();
    
    // Очищаем корзину
    cart.items = [];
    cart.total = 0;
    await cart.save();
    
    // Создаем ссылку на оплату через ЮMoney
    const paymentLink = `https://yoomoney.ru/checkout/payments/v2/contract?receiver=${config.YOOMONEY_WALLET}&quickpay-form=shop&targets=Оплата+заказа+${order._id.toString().slice(-6)}&sum=${order.total}&label=${order._id}`;
    
    await ctx.editMessageText(`🎉 Заказ #${order._id.toString().slice(-6)} успешно создан!

Для завершения оформления заказа, пожалуйста, оплатите его по ссылке:

После подтверждения оплаты мы свяжемся с вами для уточнения деталей доставки.`, 
      Markup.inlineKeyboard([
        [Markup.button.url('Оплатить заказ', paymentLink)],
        [Markup.button.callback('Мои заказы', 'my_orders')]
      ])
    );
    
    // Отправляем уведомление администраторам
    const admins = await AdminModel.find({ isActive: true });
    
    for (const admin of admins) {
      try {
        await bot.telegram.sendMessage(admin.telegramId, `🔔 Новый заказ #${order._id.toString().slice(-6)}!

Сумма: ${order.total} руб.
Статус оплаты: Ожидает оплату
        
Данные клиента:
Телефон: ${phone}
Адрес: ${address}`,
          Markup.inlineKeyboard([
            [Markup.button.callback('Подробнее', `admin_order_${order._id}`)]
          ])
        );
      } catch (error) {
        console.error(`Ошибка отправки уведомления администратору ${admin.telegramId}:`, error);
      }
    }
    
    // Очищаем данные оформления заказа
    delete ctx.session.checkoutData;
  } catch (error) {
    console.error('Ошибка при создании заказа:', error);
    await ctx.answerCbQuery('Произошла ошибка при оформлении заказа.', { show_alert: true });
  }
});

// Обработчик просмотра заказов пользователя
bot.hears('Мои заказы', userMiddleware, async (ctx) => {
  const orders = await OrderModel.find({ telegramId: ctx.from.id }).sort({ createdAt: -1 });
  
  if (orders.length === 0) {
    return ctx.reply('У вас пока нет заказов.');
  }
  
  await ctx.reply('Ваши заказы:');
  
  for (const order of orders) {
    const statusText = {
      'pending': '⏳ Ожидает обработки',
      'processing': '🔄 Обрабатывается',
      'shipped': '🚚 Отправлен',
      'completed': '✅ Выполнен',
      'cancelled': '❌ Отменен'
    }[order.status] || 'Неизвестно';
    
    const paymentStatusText = {
      'awaiting': '⏳ Ожидает оплаты',
      'paid': '✅ Оплачен',
      'failed': '❌ Ошибка оплаты'
    }[order.paymentStatus] || 'Неизвестно';
    
    await ctx.reply(`
Заказ #${order._id.toString().slice(-6)}
Дата: ${order.createdAt.toLocaleDateString()}
Сумма: ${order.total} руб.
Статус: ${statusText}
Оплата: ${paymentStatusText}
    `, Markup.inlineKeyboard([
      [Markup.button.callback('Подробнее', `order_details_${order._id}`)]
    ]));
  }
});

// Обработчик просмотра деталей заказа
bot.action(/order_details_(.+)/, userMiddleware, async (ctx) => {
  const orderId = ctx.match[1];
  const order = await OrderModel.findById(orderId).populate('items.product');
  
  if (!order) {
    return ctx.answerCbQuery('Заказ не найден.', { show_alert: true });
  }
  
  // Проверяем, принадлежит ли заказ пользователю или это админ
  const admin = await AdminModel.findOne({ telegramId: ctx.from.id });
  
  if (order.telegramId !== ctx.from.id && !admin) {
    return ctx.answerCbQuery('У вас нет доступа к этому заказу.', { show_alert: true });
  }
  
  const statusText = {
    'pending': '⏳ Ожидает обработки',
    'processing': '🔄 Обрабатывается',
    'shipped': '🚚 Отправлен',
    'completed': '✅ Выполнен',
    'cancelled': '❌ Отменен'
  }[order.status] || 'Неизвестно';
  
  const paymentStatusText = {
    'awaiting': '⏳ Ожидает оплаты',
    'paid': '✅ Оплачен',
    'failed': '❌ Ошибка оплаты'
  }[order.paymentStatus] || 'Неизвестно';
  
  let message = `
📦 Заказ #${order._id.toString().slice(-6)}
Дата: ${order.createdAt.toLocaleDateString()}
Статус: ${statusText}
Оплата: ${paymentStatusText}

📋 Товары:
`;
  
  for (const item of order.items) {
    message += `- ${item.product ? item.product.title : 'Товар удален'}\n`;
    message += `  Размер: ${item.size}, Цвет: ${item.color}\n`;
    message += `  Количество: ${item.quantity} x ${item.price} руб.\n\n`;
  }
  
  message += `💰 Общая сумма: ${order.total} руб.\n\n`;
  message += `📬 Адрес доставки: ${order.address}\n`;
  message += `📱 Телефон: ${order.phone}\n`;
  
  // Добавляем кнопки управления для администратора
  let keyboard = [];
  
  if (admin) {
    let statusButtons = [];
    
    if (order.status === 'pending') {
      statusButtons.push(Markup.button.callback('🔄 Обрабатывается', `set_status_${order._id}_processing`));
    }
    
    if (order.status === 'processing') {
      statusButtons.push(Markup.button.callback('🚚 Отправлен', `set_status_${order._id}_shipped`));
    }
    
    if (order.status === 'shipped') {
      statusButtons.push(Markup.button.callback('✅ Выполнен', `set_status_${order._id}_completed`));
    }
    
    if (order.status !== 'cancelled' && order.status !== 'completed') {
      statusButtons.push(Markup.button.callback('❌ Отменить', `set_status_${order._id}_cancelled`));
    }
    
    let paymentButtons = [];
    
    if (order.paymentStatus === 'awaiting') {
      paymentButtons.push(Markup.button.callback('✅ Отметить как оплаченный', `set_payment_${order._id}_paid`));
    }
    
    keyboard = [
      statusButtons,
      paymentButtons,
      [Markup.button.callback('Назад', 'admin_menu')]
    ];
  } else {
    // Кнопки для пользователя
    if (order.paymentStatus === 'awaiting') {
      const paymentLink = `https://yoomoney.ru/checkout/payments/v2/contract?receiver=${config.YOOMONEY_WALLET}&quickpay-form=shop&targets=Оплата+заказа+${order._id.toString().slice(-6)}&sum=${order.total}&label=${order._id}`;
      
      keyboard = [
        [Markup.button.url('Оплатить заказ', paymentLink)],
        [Markup.button.callback('Назад', 'my_orders')]
      ];
    } else {
      keyboard = [
        [Markup.button.callback('Назад', 'my_orders')]
      ];
    }
  }
  
  await ctx.editMessageText(message, Markup.inlineKeyboard(keyboard));
});

// Обработчики изменения статуса заказа
bot.action(/set_status_(.+)_(.+)/, adminMiddleware, async (ctx) => {
  const [, orderId, status] = ctx.match;
  
  try {
    const order = await OrderModel.findById(orderId);
    
    if (!order) {
      return ctx.answerCbQuery('Заказ не найден.', { show_alert: true });
    }
    
    order.status = status;
    await order.save();
    
    await ctx.answerCbQuery(`Статус заказа изменен на "${status}"!`);
    
    // Уведомляем пользователя об изменении статуса
    try {
      const statusText = {
        'processing': '🔄 В обработке',
        'shipped': '🚚 Отправлен',
        'completed': '✅ Выполнен',
        'cancelled': '❌ Отменен'
      }[status] || status;
      
      await bot.telegram.sendMessage(order.telegramId, `Статус вашего заказа #${order._id.toString().slice(-6)} изменен на "${statusText}".`);
    } catch (error) {
      console.error('Ошибка отправки уведомления пользователю:', error);
    }
    
    // Обновляем сообщение с информацией о заказе
    const callbackData = `order_details_${orderId}`;
    ctx.match[1] = orderId; // Устанавливаем orderId для повторного использования обработчика
    return ctx.callbackQuery.data = callbackData;
  } catch (error) {
    console.error('Ошибка изменения статуса заказа:', error);
    return ctx.answerCbQuery('Произошла ошибка при изменении статуса заказа.', { show_alert: true });
  }
});

// Обработчики изменения статуса оплаты
bot.action(/set_payment_(.+)_(.+)/, adminMiddleware, async (ctx) => {
  const [, orderId, paymentStatus] = ctx.match;
  
  try {
    const order = await OrderModel.findById(orderId);
    
    if (!order) {
      return ctx.answerCbQuery('Заказ не найден.', { show_alert: true });
    }
    
    order.paymentStatus = paymentStatus;
    await order.save();
    
    await ctx.answerCbQuery(`Статус оплаты заказа изменен на "${paymentStatus}"!`);
    
    // Уведомляем пользователя об изменении статуса оплаты
    try {
      const paymentStatusText = {
        'paid': '✅ Оплачен',
        'failed': '❌ Ошибка оплаты'
      }[paymentStatus] || paymentStatus;
      
      await bot.telegram.sendMessage(order.telegramId, `Статус оплаты вашего заказа #${order._id.toString().slice(-6)} изменен на "${paymentStatusText}".`);
    } catch (error) {
      console.error('Ошибка отправки уведомления пользователю:', error);
    }
    
    // Обновляем сообщение с информацией о заказе
    const callbackData = `order_details_${orderId}`;
    ctx.match[1] = orderId; // Устанавливаем orderId для повторного использования обработчика
    return ctx.callbackQuery.data = callbackData;
  } catch (error) {
    console.error('Ошибка изменения статуса оплаты:', error);
    return ctx.answerCbQuery('Произошла ошибка при изменении статуса оплаты.', { show_alert: true });
  }
});

// Команда помощи
bot.hears('Помощь', async (ctx) => {
  await ctx.reply(`
🛍️ Добро пожаловать в наш магазин женской одежды!

Доступные команды:
/start - Начать работу с ботом
Каталог - Просмотр каталога товаров
Корзина - Просмотр корзины
Мои заказы - Просмотр ваших заказов
Помощь - Показать это сообщение

Как сделать заказ:
1. Выберите товар из каталога
2. Укажите размер и цвет
3. Добавьте товар в корзину
4. Перейдите в корзину и нажмите "Оформить заказ"
5. Укажите адрес доставки и контактный телефон
6. Подтвердите и оплатите заказ

По всем вопросам обращайтесь к нашему менеджеру: @manager_username
  `);
});

// Обработчик для админ-меню
bot.action('admin_menu', adminMiddleware, async (ctx) => {
  await ctx.editMessageText('Меню администратора:', 
    Markup.inlineKeyboard([
      [Markup.button.callback('Добавить товар', 'add_product')],
      [Markup.button.callback('Импорт с Ozon', 'import_ozon')],
      [Markup.button.callback('Список товаров', 'list_products')],
      [Markup.button.callback('Статистика заказов', 'order_stats')]
    ])
  );
});

// Обработчики для админ-кнопок
bot.action('add_product', adminMiddleware, (ctx) => {
  ctx.answerCbQuery();
  ctx.scene.enter('ADD_PRODUCT');
});

bot.action('import_ozon', adminMiddleware, (ctx) => {
  ctx.answerCbQuery();
  ctx.scene.enter('IMPORT_FROM_OZON');
});

bot.action('list_products', adminMiddleware, async (ctx) => {
  ctx.answerCbQuery();
  const products = await ProductModel.find().sort({ createdAt: -1 }).limit(10);
  
  if (products.length === 0) {
    return ctx.editMessageText('Товаров пока нет.', 
      Markup.inlineKeyboard([
        [Markup.button.callback('Назад', 'admin_menu')]
      ])
    );
  }
  
  await ctx.editMessageText('Список последних 10 товаров:', 
    Markup.inlineKeyboard([
      [Markup.button.callback('Назад', 'admin_menu')]
    ])
  );
  
  for (const product of products) {
    const message = `
Название: ${product.title}
Категория: ${product.category}
Цена: ${product.price} руб.
Размеры: ${product.sizes.join(', ')}
Цвета: ${product.colors.join(', ')}
    `;
    
    // Если есть изображения, отправляем первое
    if (product.images && product.images.length > 0) {
      const imageUrl = await yadiskService.getDownloadLink(product.images[0]);
      await ctx.replyWithPhoto({ url: imageUrl }, {
        caption: message,
        ...Markup.inlineKeyboard([
          [Markup.button.callback('Редактировать', `edit_product_${product._id}`)],
          [Markup.button.callback('Удалить', `delete_product_${product._id}`)]
        ])
      });
    } else {
      await ctx.reply(message, Markup.inlineKeyboard([
        [Markup.button.callback('Редактировать', `edit_product_${product._id}`)],
        [Markup.button.callback('Удалить', `delete_product_${product._id}`)]
      ]));
    }
  }
});

bot.action('order_stats', adminMiddleware, async (ctx) => {
  ctx.answerCbQuery();
  
  const totalOrders = await OrderModel.countDocuments();
  const completedOrders = await OrderModel.countDocuments({ status: 'completed' });
  const pendingOrders = await OrderModel.countDocuments({ status: 'pending' });
  
  const totalRevenue = await OrderModel.aggregate([
    { $match: { status: 'completed' } },
    { $group: { _id: null, total: { $sum: '$total' } } }
  ]);
  
  const revenue = totalRevenue.length > 0 ? totalRevenue[0].total : 0;
  
  await ctx.editMessageText(`📊 Статистика заказов:

Всего заказов: ${totalOrders}
Выполненных заказов: ${completedOrders}
Ожидающих заказов: ${pendingOrders}
Общий доход: ${revenue} руб.
  `, Markup.inlineKeyboard([
    [Markup.button.callback('Последние заказы', 'recent_orders')],
    [Markup.button.callback('Назад', 'admin_menu')]
  ]));
});

// Обработчик удаления товара
bot.action(/delete_product_(.+)/, adminMiddleware, async (ctx) => {
  const productId = ctx.match[1];
  
  try {
    const product = await ProductModel.findById(productId);
    
    if (!product) {
      return ctx.answerCbQuery('Товар не найден.', { show_alert: true });
    }
    
    // Удаляем изображения с Yandex Disk
    for (const imagePath of product.images) {
      try {
        await yadiskService.deleteFile(imagePath);
      } catch (error) {
        console.error('Ошибка удаления изображения:', error);
      }
    }
    
    await ProductModel.findByIdAndDelete(productId);
    
    await ctx.answerCbQuery('Товар успешно удален!');
    await ctx.deleteMessage();
  } catch (error) {
    console.error('Ошибка удаления товара:', error);
    await ctx.answerCbQuery('Произошла ошибка при удалении товара.', { show_alert: true });
  }
});

// Включаем polling для бота
bot.launch()
  .then(() => console.log('Бот успешно запущен!'))
  .catch(err => console.error('Ошибка запуска бота:', err));

// Обработка остановки бота
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
  